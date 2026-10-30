package com.cocos.game.tap;

import android.app.Activity;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Dirichlet(TapADN)广告封装 —— TapTap APK 的变现链路。
 *
 * 走反射的原因同 TapAntiAddictionImpl(见 TapReflect 头部注释):
 *   没放 AAR 也能编译,放上就跑;版本差异靠"按参数类型找方法"消化。
 *
 * 已验证的 SDK 调用(来自 Dirichlet 官方 Android 文档):
 *   TapAdSdk.init(Application, TapAdConfig)
 *   TapAdManager.get().createAdNative(activity) -> TapAdNative
 *   tapAdNative.loadRewardVideoAd(AdRequest, RewardVideoAdListener)
 *   rewardAd.setRewardAdInteractionListener(RewardAdInteractionListener) / showRewardVideoAd(activity)
 *   tapAdNative.loadInterstitialAd / loadBannerAd / loadSplashAd
 *
 * 发奖判定(唯一标准):只有 onRewardVerify(rewardVerify=true) 之后关闭,才回 code=1。
 * 其余情况(跳过、出错、中途关)一律 code=0,JS 侧不发奖励。
 * 这个 if 少写一次,就会出现"没看完也发奖",直接亏钱。
 */
public final class TapAdImpl {

    private static final String TAG = "TapAd";

    private static final String[] AD_SDK_CANDIDATES = {"com.tapsdk.tapad.TapAdSdk"};
    private static final String[] AD_CONFIG_CANDIDATES = {"com.tapsdk.tapad.TapAdConfig"};
    private static final String[] AD_MANAGER_CANDIDATES = {"com.tapsdk.tapad.TapAdManager"};
    private static final String[] AD_REQUEST_CANDIDATES = {
            "com.tapsdk.tapad.AdRequest",
            "com.tapsdk.tapad.entity.AdRequest",
    };

    private static Activity sActivity;
    private static boolean sInited;
    private static boolean sAvailable;

    private static Object sAdNative;      // TapAdNative
    private static View sBannerView;      // Banner 挂载的 View
    private static boolean sRewardLoading;

    private TapAdImpl() {
    }

    public static void init(Activity activity) {
        sActivity = activity;
    }

    /** 初始化广告 SDK(幂等);返回是否可用 */
    public static boolean initIfNeeded() {
        if (sInited) return sAvailable;
        sInited = true;

        if (!TapConfig.isAdConfigured()) {
            Log.w(TAG, "未配置 MEDIA_ID / MEDIA_KEY,广告不会出 —— 提审前必须填 TapConfig");
            sAvailable = false;
            return false;
        }

        Class<?> sdk = TapReflect.findClass(AD_SDK_CANDIDATES);
        Class<?> cfg = TapReflect.findClass(AD_CONFIG_CANDIDATES);
        Class<?> mgr = TapReflect.findClass(AD_MANAGER_CANDIDATES);
        if (sdk == null || cfg == null || mgr == null) {
            Log.e(TAG, "未找到 TapAD SDK —— 请把 Dirichlet 的 aar 放到 app/libs/");
            sAvailable = false;
            return false;
        }

        try {
            Object config = buildAdConfig(cfg);
            if (config == null) {
                sAvailable = false;
                return false;
            }
            // 主线程调用;只需初始化一次
            TapReflect.callStatic(sdk, "init", sActivity.getApplication(), config);

            Object manager = TapReflect.callStatic(mgr, "get");
            sAdNative = TapReflect.call(manager, "createAdNative", sActivity);
            sAvailable = sAdNative != null;
            Log.i(TAG, sAvailable ? "广告 SDK 初始化成功" : "createAdNative 返回空");
        } catch (Throwable t) {
            Log.e(TAG, "广告 SDK 初始化异常", t);
            sAvailable = false;
        }
        return sAvailable;
    }

    private static Object buildAdConfig(Class<?> cfg) {
        try {
            Class<?> builderType = TapReflect.nestedClass(cfg, "Builder");
            if (builderType == null) {
                Log.e(TAG, "TapAdConfig 没有内部类 Builder");
                return null;
            }
            Object b = builderType.newInstance();
            TapReflect.call(b, "withMediaId", TapConfig.MEDIA_ID);
            TapReflect.call(b, "withMediaName", TapConfig.MEDIA_NAME);
            TapReflect.call(b, "withMediaKey", TapConfig.MEDIA_KEY);
            safeCall(b, "enableDebug", TapConfig.DEBUG);
            safeCall(b, "shakeEnabled", false); // 摇一摇容易误触,关掉
            return TapReflect.call(b, "build");
        } catch (Throwable t) {
            Log.e(TAG, "构建 TapAdConfig 异常", t);
            return null;
        }
    }

    private static void safeCall(Object target, String name, Object arg) {
        try {
            TapReflect.call(target, name, arg);
        } catch (Throwable ignored) {
            // 该版本无此方法
        }
    }

    // ==================== 激励视频 ====================

    public static void showRewarded(final String spaceId, final String userId,
                                    final String rewardName, final int rewardAmount,
                                    final String method, final String id) {
        if (!initIfNeeded()) {
            TapBridge.reply(method, id, false, -1, "ad sdk not available");
            return;
        }
        if (spaceId == null || spaceId.length() == 0) {
            TapBridge.reply(method, id, false, -2, "spaceId is empty");
            return;
        }
        if (sRewardLoading) {
            TapBridge.reply(method, id, false, -3, "already loading");
            return;
        }
        sRewardLoading = true;

        final AtomicBoolean replied = new AtomicBoolean(false);
        final AtomicBoolean verified = new AtomicBoolean(false);
        final AtomicBoolean shown = new AtomicBoolean(false);

        try {
            Object request = buildRequest(spaceId, userId, rewardName, String.valueOf(rewardAmount));

            // 找 loadRewardVideoAd(AdRequest, Listener) 的监听器接口
            Method load = findMethod(sAdNative.getClass(), "loadRewardVideoAd", 2);
            if (load == null) {
                sRewardLoading = false;
                TapBridge.reply(method, id, false, -4, "loadRewardVideoAd not found");
                return;
            }
            final Class<?> listenerType = load.getParameterTypes()[1];

            Object loadListener = TapReflect.proxy(listenerType, new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method m, Object[] args) {
                    String name = m.getName();
                    if ("onError".equals(name)) {
                        int code = (args != null && args.length > 0 && args[0] instanceof Integer) ? (Integer) args[0] : -1;
                        String msg = (args != null && args.length > 1) ? String.valueOf(args[1]) : "";
                        Log.w(TAG, "激励视频加载失败 " + code + " " + msg);
                        sRewardLoading = false;
                        if (replied.compareAndSet(false, true)) {
                            TapBridge.reply(method, id, false, code, "load error: " + msg);
                        }
                        return null;
                    }
                    // onRewardVideoAdLoad / onRewardVideoCached
                    if (!shown.compareAndSet(false, true)) {
                        return null; // 两个回调都会来,只展示一次
                    }
                    Object ad = (args != null && args.length > 0) ? args[0] : null;
                    if (ad != null) {
                        playRewarded(ad, verified, replied, method, id);
                    }
                    return null;
                }
            });

            load.invoke(sAdNative, request, loadListener);
            Log.i(TAG, "激励视频开始加载 spaceId=" + spaceId);
        } catch (Throwable t) {
            sRewardLoading = false;
            Log.e(TAG, "加载激励视频异常", t);
            TapBridge.reply(method, id, false, -5, String.valueOf(t.getMessage()));
        }
    }

    /** 注册交互回调并展示 */
    private static void playRewarded(Object ad, final AtomicBoolean verified,
                                     final AtomicBoolean replied,
                                     final String method, final String id) {
        try {
            Method setListener = findMethod(ad.getClass(), "setRewardAdInteractionListener", 1);
            if (setListener != null) {
                final Class<?> it = setListener.getParameterTypes()[0];
                Object interaction = TapReflect.proxy(it, new InvocationHandler() {
                    @Override
                    public Object invoke(Object proxy, Method m, Object[] args) {
                        String name = m.getName();
                        if ("onRewardVerify".equals(name)) {
                            // (boolean rewardVerify, int rewardAmount, String rewardName, int code, String msg)
                            boolean ok = args != null && args.length > 0 && args[0] instanceof Boolean && (Boolean) args[0];
                            if (ok) verified.set(true);
                        } else if ("onAdClose".equals(name)) {
                            sRewardLoading = false;
                            if (replied.compareAndSet(false, true)) {
                                TapBridge.reply(method, id, true, verified.get() ? 1 : 0,
                                        verified.get() ? "reward verified" : "closed without reward");
                            }
                        } else if ("onVideoError".equals(name)) {
                            sRewardLoading = false;
                            if (replied.compareAndSet(false, true)) {
                                TapBridge.reply(method, id, false, -7, "video error");
                            }
                        }
                        return null;
                    }
                });
                setListener.invoke(ad, interaction);
            }
            TapReflect.call(ad, "showRewardVideoAd", sActivity);
        } catch (Throwable t) {
            sRewardLoading = false;
            Log.e(TAG, "展示激励视频异常", t);
            if (replied.compareAndSet(false, true)) {
                TapBridge.reply(method, id, false, -6, String.valueOf(t.getMessage()));
            }
        }
    }

    // ==================== 插屏 ====================

    public static void showInterstitial(final String spaceId, final String method, final String id) {
        if (!initIfNeeded()) {
            TapBridge.reply(method, id, false, -1, "ad sdk not available");
            return;
        }
        if (spaceId == null || spaceId.length() == 0) {
            TapBridge.reply(method, id, false, -2, "spaceId is empty");
            return;
        }
        try {
            Object request = buildRequest(spaceId, null, null, null);
            Method load = findMethod(sAdNative.getClass(), "loadInterstitialAd", 2);
            if (load == null) {
                TapBridge.reply(method, id, false, -4, "loadInterstitialAd not found");
                return;
            }
            final Class<?> listenerType = load.getParameterTypes()[1];
            Object listener = TapReflect.proxy(listenerType, new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method m, Object[] args) {
                    if ("onError".equals(m.getName())) {
                        String msg = (args != null && args.length > 1) ? String.valueOf(args[1]) : "";
                        TapBridge.reply(method, id, false, -1, "load error: " + msg);
                        return null;
                    }
                    Object ad = (args != null && args.length > 0) ? args[0] : null;
                    if (ad != null) {
                        try {
                            TapReflect.call(ad, "show", sActivity);
                            TapBridge.reply(method, id, true, 0, "shown");
                        } catch (Throwable t) {
                            TapBridge.reply(method, id, false, -6, String.valueOf(t.getMessage()));
                        }
                    }
                    return null;
                }
            });
            load.invoke(sAdNative, request, listener);
        } catch (Throwable t) {
            Log.e(TAG, "插屏异常", t);
            TapBridge.reply(method, id, false, -5, String.valueOf(t.getMessage()));
        }
    }

    // ==================== Banner ====================

    public static void showBanner(final String spaceId, final String method, final String id) {
        if (!initIfNeeded()) {
            TapBridge.reply(method, id, false, -1, "ad sdk not available");
            return;
        }
        if (spaceId == null || spaceId.length() == 0) {
            TapBridge.reply(method, id, false, -2, "spaceId is empty");
            return;
        }
        if (sBannerView != null) {
            sBannerView.setVisibility(View.VISIBLE);
            TapBridge.reply(method, id, true, 0, "already shown");
            return;
        }
        try {
            Object request = buildRequest(spaceId, null, null, null);
            Method load = findMethod(sAdNative.getClass(), "loadBannerAd", 2);
            if (load == null) {
                TapBridge.reply(method, id, false, -4, "loadBannerAd not found");
                return;
            }
            final Class<?> listenerType = load.getParameterTypes()[1];
            Object listener = TapReflect.proxy(listenerType, new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method m, Object[] args) {
                    if ("onError".equals(m.getName())) {
                        String msg = (args != null && args.length > 1) ? String.valueOf(args[1]) : "";
                        TapBridge.reply(method, id, false, -1, "load error: " + msg);
                        return null;
                    }
                    Object ad = (args != null && args.length > 0) ? args[0] : null;
                    if (ad != null) {
                        try {
                            View banner = (View) TapReflect.call(ad, "getBannerView");
                            attachBanner(banner);
                            TapBridge.reply(method, id, true, 0, "shown");
                        } catch (Throwable t) {
                            TapBridge.reply(method, id, false, -6, String.valueOf(t.getMessage()));
                        }
                    }
                    return null;
                }
            });
            load.invoke(sAdNative, request, listener);
        } catch (Throwable t) {
            Log.e(TAG, "Banner 异常", t);
            TapBridge.reply(method, id, false, -5, String.valueOf(t.getMessage()));
        }
    }

    /** 把 Banner View 贴到 Activity 内容区底部居中 */
    private static void attachBanner(View banner) {
        if (banner == null || sActivity == null) return;
        try {
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            sActivity.addContentView(banner, lp);
            sBannerView = banner;
            Log.i(TAG, "Banner 已挂载");
        } catch (Throwable t) {
            Log.e(TAG, "Banner 挂载失败", t);
        }
    }

    public static void hideBanner() {
        if (sBannerView == null) return;
        try {
            sBannerView.setVisibility(View.GONE);
        } catch (Throwable ignored) {
        }
    }

    // ==================== 开屏 ====================

    public static void showSplash(final String spaceId, final String method, final String id) {
        if (!initIfNeeded()) {
            TapBridge.reply(method, id, false, -1, "ad sdk not available");
            return;
        }
        if (spaceId == null || spaceId.length() == 0) {
            TapBridge.reply(method, id, false, -2, "spaceId is empty");
            return;
        }
        try {
            Object request = buildRequest(spaceId, null, null, null);
            Method load = findMethod(sAdNative.getClass(), "loadSplashAd", 2);
            if (load == null) {
                TapBridge.reply(method, id, false, -4, "loadSplashAd not found");
                return;
            }
            final Class<?> listenerType = load.getParameterTypes()[1];
            Object listener = TapReflect.proxy(listenerType, new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method m, Object[] args) {
                    if ("onError".equals(m.getName())) {
                        String msg = (args != null && args.length > 1) ? String.valueOf(args[1]) : "";
                        TapBridge.reply(method, id, false, -1, "load error: " + msg);
                        return null;
                    }
                    Object ad = (args != null && args.length > 0) ? args[0] : null;
                    if (ad != null) {
                        try {
                            TapReflect.call(ad, "show", sActivity);
                            TapBridge.reply(method, id, true, 0, "shown");
                        } catch (Throwable t) {
                            TapBridge.reply(method, id, false, -6, String.valueOf(t.getMessage()));
                        }
                    }
                    return null;
                }
            });
            load.invoke(sAdNative, request, listener);
        } catch (Throwable t) {
            Log.e(TAG, "开屏异常", t);
            TapBridge.reply(method, id, false, -5, String.valueOf(t.getMessage()));
        }
    }

    // ==================== 工具 ====================

    /** 构建 AdRequest(带奖品信息的用于激励视频,其余传 null) */
    private static Object buildRequest(String spaceId, String userId, String rewardName, String rewardAmount) {
        Class<?> reqCls = TapReflect.findClass(AD_REQUEST_CANDIDATES);
        if (reqCls == null) {
            throw new IllegalStateException("AdRequest class not found");
        }
        try {
            Class<?> builderType = TapReflect.nestedClass(reqCls, "Builder");
            Object b = builderType.newInstance();
            TapReflect.call(b, "withSpaceId", spaceId);
            if (rewardName != null) safeCall(b, "withRewardName", rewardName);
            if (rewardAmount != null) safeCall(b, "withRewardAmount", rewardAmount);
            if (userId != null && userId.length() > 0) safeCall(b, "withUserId", userId);
            return TapReflect.call(b, "build");
        } catch (Throwable t) {
            throw new IllegalStateException("build AdRequest failed: " + t.getMessage(), t);
        }
    }

    /** 在目标类里找参数个数匹配的方法 */
    private static Method findMethod(Class<?> cls, String name, int paramCount) {
        for (Method m : cls.getMethods()) {
            if (m.getName().equals(name) && m.getParameterTypes().length == paramCount) {
                try {
                    m.setAccessible(true);
                } catch (Throwable ignored) {
                }
                return m;
            }
        }
        return null;
    }
}

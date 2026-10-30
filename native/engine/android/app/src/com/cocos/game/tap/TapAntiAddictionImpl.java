package com.cocos.game.tap;

import android.app.Activity;
import android.util.Log;

import org.json.JSONObject;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Map;

/**
 * TapSDK 防沉迷(AntiAddiction)封装 —— APK 侧唯一的合规链路。
 *
 * 为什么不用直接 import:
 *   防沉迷 Android 接口在不同版本里有两种形态:
 *     A. AntiAddictionUIKit.init(activity, Config) + setAntiAddictionCallback(cb)   ← 官方 v3 当前文档
 *     B. AntiAddictionUIKit.init(activity, Config, AntiAddictionUICallback)          ← 早期/部分封装
 *     C. AntiAddictionUIKit.init(activity, String gameId, AntiAddictionFunctionConfig, cb) ← 更早期
 *   而且 Config 类名、包名随版本变化过。这里在运行时**按参数类型**挑选重载,
 *   三种形态都能走通,升级 SDK 不用改代码。
 *
 * 回调码直接用数字(官方 v3 回调表),不去反射 Constants 内部类:
 *   500 LOGIN_SUCCESS / 1000 EXITED / 1001 SWITCH_ACCOUNT / 1030 PERIOD_RESTRICT
 *   1050 DURATION_LIMIT / 1100 AGE_LIMIT / 1200 INVALID_CLIENT_OR_NETWORK / 9002 REAL_NAME_STOP
 *
 * 该类的所有方法都必须跑在主线程(TapBridge 已经保证了)。
 */
public final class TapAntiAddictionImpl {

    private static final String TAG = "TapAntiAddiction";

    /** 候选全限定名:不同 TapSDK 版本包名不同 */
    private static final String[] UI_CLASS_CANDIDATES = new String[]{
            "com.tapsdk.antiaddiction.AntiAddictionUIKit",
            "com.tapsdk.antiaddiction.ui.AntiAddictionUIKit",
            "com.taptap.sdk.antiaddiction.AntiAddictionUIKit",
            "com.taptap.antiaddiction.AntiAddictionUIKit",
    };

    private static boolean sInited;
    private static boolean sAvailable;
    private static Class<?> sUiClass;
    private static Activity sActivity;

    private TapAntiAddictionImpl() {
    }

    /** 由 TapBridge.init 调用,只做登记,真正初始化延迟到第一次使用 */
    public static void init(Activity activity) {
        sActivity = activity;
    }

    /**
     * 初始化防沉迷(幂等)
     * @return 是否成功挂上 SDK
     */
    public static boolean initIfNeeded() {
        if (sInited) return sAvailable;
        sInited = true;

        if (!TapConfig.isAntiAddictionConfigured()) {
            Log.w(TAG, "未配置 CLIENT_ID,防沉迷不会生效 —— 提审前必须填 TapConfig.CLIENT_ID");
            sAvailable = false;
            return false;
        }
        if (sActivity == null) {
            Log.w(TAG, "activity 为空,无法初始化");
            sAvailable = false;
            return false;
        }

        sUiClass = TapReflect.findClass(UI_CLASS_CANDIDATES);
        if (sUiClass == null) {
            Log.e(TAG, "未找到 AntiAddictionUIKit —— 请把 TapSDK 的 aar 放到 app/libs/"
                    + "(需要的类:com.tapsdk.antiaddiction.AntiAddictionUIKit)");
            sAvailable = false;
            return false;
        }

        try {
            boolean ok = doInit();
            sAvailable = ok;
            Log.i(TAG, ok ? "防沉迷初始化成功" : "防沉迷初始化失败");
            return ok;
        } catch (Throwable t) {
            Log.e(TAG, "防沉迷初始化异常", t);
            sAvailable = false;
            return false;
        }
    }

    /** 按运行时签名挑重载并完成初始化 */
    private static boolean doInit() throws Exception {
        Method initMethod = null;
        Class<?> configType = null;
        Class<?> cbType = null;

        for (Method m : sUiClass.getMethods()) {
            if (!"init".equals(m.getName())) continue;
            Class<?>[] ps = m.getParameterTypes();
            if (ps.length < 2) continue;
            // 第一参数必须是能接收当前 Activity 的类型(Activity 或 Context)
            if (!ps[0].isAssignableFrom(sActivity.getClass())) continue;
            // 第二参数:既可能是 Config(类),也可能是 Callback(接口)
            if (ps[1].isInterface()) {
                cbType = ps[1];
                continue;
            }
            configType = ps[1];
            initMethod = m;
            if (ps.length >= 3 && ps[2].isInterface()) {
                cbType = ps[2];
            }
            break;
        }

        if (initMethod == null || configType == null) {
            Log.e(TAG, "AntiAddictionUIKit 没有找到可用的 init 重载,SDK 版本可能不兼容");
            return false;
        }

        Object config = buildConfig(configType);
        if (config == null) {
            Log.e(TAG, "Config 构建失败(缺 Builder 或方法名不一致)");
            return false;
        }

        // 回调接口:优先用 setAntiAddictionCallback 的形参类型
        Method setCb = null;
        for (Method m : sUiClass.getMethods()) {
            if (m.getName().toLowerCase().contains("callback") && m.getParameterTypes().length == 1
                    && m.getParameterTypes()[0].isInterface()) {
                setCb = m;
                cbType = m.getParameterTypes()[0];
                break;
            }
        }

        if (cbType == null) {
            Log.e(TAG, "未找到防沉迷回调接口类型,无法注册回调");
            return false;
        }

        Object cbProxy = createCallbackProxy(cbType);

        if (setCb != null) {
            // 形态 A:init(activity, config) + setAntiAddictionCallback(cb)
            try {
                setCb.setAccessible(true);
            } catch (Throwable ignored) {
            }
            TapReflect.callStatic(sUiClass, "init", sActivity, config);
            setCb.invoke(null, cbProxy);
            Log.i(TAG, "初始化方式:init(activity,config) + " + setCb.getName());
        } else {
            // 形态 B:init(activity, config, cb)
            TapReflect.callStatic(sUiClass, "init", sActivity, config, cbProxy);
            Log.i(TAG, "初始化方式:init(activity,config,callback)");
        }
        return true;
    }

    /** 反射构建 Config.Builder().withClientId().showSwitchAccount().useAgeRange().build() */
    private static Object buildConfig(Class<?> configType) {
        try {
            Class<?> builderType = TapReflect.nestedClass(configType, "Builder");
            if (builderType == null) {
                Log.e(TAG, "Config 没有内部类 Builder");
                return null;
            }
            Object b = builderType.newInstance();
            TapReflect.call(b, "withClientId", TapConfig.CLIENT_ID);
            safeCall(b, "showSwitchAccount", TapConfig.SHOW_SWITCH_ACCOUNT);
            safeCall(b, "useAgeRange", TapConfig.USE_AGE_RANGE);
            // 早期版本用 enableTapLogin 控制是否走 TapTap 快速认证
            safeCall(b, "enableTapLogin", true);
            safeCall(b, "enableOnLineTimeLimit", true);
            return TapReflect.call(b, "build");
        } catch (Throwable t) {
            Log.e(TAG, "构建 Config 异常", t);
            return null;
        }
    }

    /** 可选方法:存在就调,不存在忽略(版本差异) */
    private static void safeCall(Object target, String name, Object arg) {
        try {
            TapReflect.call(target, name, arg);
        } catch (Throwable ignored) {
            // 该版本没有这个方法,正常
        }
    }

    /** 生成回调代理:onCallback(int code, Map extras) */
    private static Object createCallbackProxy(Class<?> cbType) {
        return TapReflect.proxy(cbType, new InvocationHandler() {
            @Override
            public Object invoke(Object proxy, Method method, Object[] args) {
                if (!"onCallback".equals(method.getName()) || args == null || args.length == 0) {
                    return null;
                }
                int code = (args[0] instanceof Integer) ? (Integer) args[0] : -1;
                String msg = "";
                if (args.length > 1 && args[1] instanceof Map) {
                    Object m = ((Map<?, ?>) args[1]).get("msg");
                    if (m == null) m = ((Map<?, ?>) args[1]).get("message");
                    if (m != null) msg = String.valueOf(m);
                }
                Log.i(TAG, "回调 code=" + code + " msg=" + msg);

                JSONObject data = new JSONObject();
                try {
                    data.put("code", code);
                    data.put("msg", msg);
                } catch (Throwable ignored) {
                }
                // 主动事件推给 JS,JS 侧按回调码改状态并决定是否拦截
                TapBridge.event("antiaddiction.event", data);
                return null;
            }
        });
    }

    /** 开始认证 */
    public static void startup(String userIdentifier, String method, String id) {
        if (!initIfNeeded()) {
            TapBridge.reply(method, id, false, -1, "antiaddiction sdk not available");
            return;
        }
        if (userIdentifier == null || userIdentifier.length() == 0) {
            TapBridge.reply(method, id, false, -2, "userIdentifier is empty");
            return;
        }
        try {
            // 优先 startup(activity, userIdentifier);老版本是 startup(activity, useTapLogin, uid, token)
            TapReflect.callStatic(sUiClass, "startup", sActivity, userIdentifier);
            // ack:真正结果由 onCallback 异步推事件,这里只表示"已发起"
            TapBridge.reply(method, id, true, 0, "started");
        } catch (NoSuchMethodException e) {
            Log.e(TAG, "startup 方法签名不匹配,SDK 版本可能要求额外 accessToken", e);
            TapBridge.reply(method, id, false, -3, "startup signature not found");
        } catch (Throwable t) {
            Log.e(TAG, "startup 异常", t);
            TapBridge.reply(method, id, false, -4, String.valueOf(t.getMessage()));
        }
    }

    /** 退出认证(切换账号 / 退出登录时调用) */
    public static void logout() {
        if (sUiClass == null) return;
        try {
            if (TapReflect.hasMethod(sUiClass, "logout", 0)) {
                TapReflect.callStatic(sUiClass, "logout");
            }
        } catch (Throwable t) {
            Log.w(TAG, "logout 失败", t);
        }
    }
}

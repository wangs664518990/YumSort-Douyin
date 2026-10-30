package com.cocos.game.tap;

import android.app.Activity;
import android.util.Log;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.JsbBridge;

import org.json.JSONObject;

/**
 * TapTap APK 的 JS <-> Java 桥。
 *
 * 协议(与 assets/script/tap/TapNativeBridge.ts 严格对应):
 *   JS  -> Java : JsbBridge sendToNative(method, {"id":"tap-1","params":{...}})
 *   Java -> JS  : JsbBridge sendToScript(method, {"id":"tap-1","ok":true,"code":0,"msg":"","data":{...}})
 *                 不带 id 的是"主动事件",由 JS 侧按 method 名分发(如 antiaddiction.event)
 *
 * 线程模型:
 *   JS 线程 == 引擎 GL 线程,不是 Android 主线程。
 *   SDK 必须在主线程调用 -> 收到 JS 请求后切到主线程执行;
 *   回调又必须回到引擎线程才能调 sendToScript -> 用 CocosHelper.runOnGameThread 切回去。
 *   两边都切错会直接崩,不要省这两步。
 *
 * 依赖:TAP SDK / Dirichlet 通过反射调用(见 TapReflect 注释),
 *       所以没放 AAR 也能编译通过,只是运行时会明确报 "SDK 未集成"。
 */
public final class TapBridge {

    private static final String TAG = "TapBridge";

    private static Activity sActivity;
    private static boolean sInited;

    private TapBridge() {
    }

    /** 在 AppActivity.onCreate 里调用一次(必须在 super.onCreate 之后) */
    public static void init(Activity activity) {
        if (sInited) return;
        sInited = true;
        sActivity = activity;

        JsbBridge.setCallback(new JsbBridge.ICallback() {
            @Override
            public void onScript(String method, String arg1) {
                dispatch(method, arg1);
            }
        });

        TapAdImpl.init(activity);
        TapAntiAddictionImpl.init(activity);
        Log.i(TAG, "bridge ready");
    }

    public static Activity activity() {
        return sActivity;
    }

    // ==================== 收发 ====================

    private static void dispatch(String method, String payload) {
        final String id;
        final JSONObject params;
        try {
            JSONObject root = (payload == null || payload.isEmpty()) ? new JSONObject() : new JSONObject(payload);
            id = root.optString("id", null);
            params = root.optJSONObject("params");
        } catch (Throwable t) {
            Log.e(TAG, "payload 解析失败: " + payload, t);
            return;
        }
        if (sActivity == null) {
            reply(method, id, false, -10, "activity is null");
            return;
        }
        // SDK 调用统一走主线程
        sActivity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    handle(method, id, params == null ? new JSONObject() : params);
                } catch (Throwable t) {
                    Log.e(TAG, "处理 " + method + " 异常", t);
                    reply(method, id, false, -11, String.valueOf(t.getMessage()));
                }
            }
        });
    }

    private static void handle(String method, String id, JSONObject params) {
        switch (method) {
            // ---------- 广告 ----------
            case "ad.init":
                TapAdImpl.initIfNeeded();
                reply(method, id, true, 0, "");
                break;
            case "ad.showRewarded":
                TapAdImpl.showRewarded(params.optString("spaceId", ""),
                        params.optString("userId", ""),
                        params.optString("rewardName", "金币"),
                        params.optInt("rewardAmount", 1),
                        method, id);
                break;
            case "ad.showInterstitial":
                TapAdImpl.showInterstitial(params.optString("spaceId", ""), method, id);
                break;
            case "ad.showBanner":
                TapAdImpl.showBanner(params.optString("spaceId", ""), method, id);
                break;
            case "ad.hideBanner":
                TapAdImpl.hideBanner();
                reply(method, id, true, 0, "");
                break;
            case "ad.showSplash":
                TapAdImpl.showSplash(params.optString("spaceId", ""), method, id);
                break;

            // ---------- 防沉迷 ----------
            case "antiaddiction.init":
                reply(method, id, TapAntiAddictionImpl.initIfNeeded(), 0, "");
                break;
            case "antiaddiction.startup":
                TapAntiAddictionImpl.startup(params.optString("userIdentifier", ""), method, id);
                break;
            case "antiaddiction.logout":
                TapAntiAddictionImpl.logout();
                reply(method, id, true, 0, "");
                break;

            // ---------- 设备 ----------
            case "device.vibrateLong":
                CocosHelper.vibrate(0.4f);
                reply(method, id, true, 0, "");
                break;
            case "device.vibrateShort":
                CocosHelper.vibrate(0.05f);
                reply(method, id, true, 0, "");
                break;

            // ---------- 暂未接入 ----------
            case "login.startup":
            case "device.share":
                reply(method, id, false, -1, "not implemented");
                break;
            default:
                Log.w(TAG, "未识别的方法: " + method);
                reply(method, id, false, -1, "unknown method: " + method);
                break;
        }
    }

    /** 回包:id 对应 JS 侧的 PendingTask */
    static void reply(String method, String id, boolean ok, int code, String msg) {
        reply(method, id, ok, code, msg, null);
    }

    static void reply(final String method, final String id, final boolean ok, final int code,
                      final String msg, final JSONObject data) {
        final JSONObject root = new JSONObject();
        try {
            if (id != null) root.put("id", id);
            root.put("ok", ok);
            root.put("code", code);
            root.put("msg", msg == null ? "" : msg);
            if (data != null) root.put("data", data);
        } catch (Throwable t) {
            Log.e(TAG, "组包失败", t);
        }
        final String payload = root.toString();
        // 必须回到引擎线程,否则 sendToScript 会直接崩
        CocosHelper.runOnGameThread(new Runnable() {
            @Override
            public void run() {
                try {
                    JsbBridge.sendToScript(method, payload);
                } catch (Throwable t) {
                    Log.e(TAG, "sendToScript 失败", t);
                }
            }
        });
    }

    /** 主动事件:不带 id,JS 侧按 method 名分发 */
    static void event(final String name, final JSONObject data) {
        final String payload = data == null ? "{}" : data.toString();
        Log.i(TAG, "event " + name + " " + payload);
        CocosHelper.runOnGameThread(new Runnable() {
            @Override
            public void run() {
                try {
                    JsbBridge.sendToScript(name, payload);
                } catch (Throwable t) {
                    Log.e(TAG, "sendToScript(event) 失败", t);
                }
            }
        });
    }
}

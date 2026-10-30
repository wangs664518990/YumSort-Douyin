/**
 * TapTap 原生包(APK / iOS)与原生 SDK 的通信通道
 *
 * 用途:
 *   TapSDK(登录 / 防沉迷)与 Dirichlet(TapADN)广告 SDK 都是原生 SDK(Android AAR / iOS Framework),
 *   Cocos 的原生包里 JS 拿不到它们,必须经 Cocos 官方 JsbBridge 转发到 Java / OC 层。
 *
 * 通道协议(前后端约定,Java / OC 侧按此实现):
 *   JS -> Native : native.bridge.sendToNative(method, jsonString)
 *                   jsonString = { "id": "req-1", "params": { ... } }
 *   Native -> JS : 由 JsbBridgeWrapper / evalString 回调 onNative(method, jsonString)
 *                   jsonString = { "id": "req-1", "ok": true, "code": 0, "msg": "", "data": { ... } }
 *   id 用来把"回调"对回"调用",没有 id 的回调按主动事件处理(如防沉迷被踢下线)。
 *
 * 约定:
 *   - method 用「模块.动作」形式: login.startup / antiaddiction.startup / antiaddiction.logout
 *     / ad.init / ad.loadRewarded / ad.showRewarded / ad.showInterstitial / ad.showBanner / ad.hideBanner
 *   - 原生侧未实现的方法必须回 ok:false,code:-1,msg:"not implemented",
 *     JS 侧据此走降级逻辑,不允许静默挂起。
 *
 * 版本说明:JsbBridge 在 Cocos Creator 3.x 原生平台提供,接口以官方「原生平台与 JS 通信」文档为准:
 *   https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/js-java-bridge.html
 */
import { native } from "cc";

/** 单次桥接调用的默认超时(毫秒),超时按失败处理,避免业务被挂死 */
const DEFAULT_TIMEOUT = 5000;

interface PendingTask {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: any;
    method: string;
}

export class TapNativeBridge {

    private static _inited: boolean = false;
    private static _seq: number = 0;
    private static _pending: Map<string, PendingTask> = new Map();
    /** 主动事件监听:原生侧不带 id 或按事件名推送的回调 */
    private static _listeners: Map<string, Function[]> = new Map();

    /** 原生桥是否可用(浏览器预览 / 小游戏包都为 false) */
    public static isAvailable(): boolean {
        try {
            return !!(native && (native as any).bridge && typeof (native as any).bridge.sendToNative === "function");
        } catch (e) {
            return false;
        }
    }

    /** 注册原生主动事件监听(如防沉迷状态变化) */
    public static on(event: string, cb: Function): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(cb);
    }

    public static off(event: string, cb: Function): void {
        const arr = this._listeners.get(event);
        if (!arr) return;
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
    }

    private static init(): void {
        if (this._inited) return;
        this._inited = true;
        try {
            (native as any).bridge.onNative = (arg0: string, arg1?: string) => {
                this.onNativeMessage(arg0, arg1);
            };
        } catch (e) {
            console.log("[TapNativeBridge] 注册原生回调失败", e);
        }
    }

    /** 原生 -> JS 的入口 */
    private static onNativeMessage(method: string, payload?: string): void {
        let data: any = null;
        if (payload) {
            try {
                data = JSON.parse(payload);
            } catch (e) {
                console.log("[TapNativeBridge] 原生回调不是合法 JSON", method, payload);
            }
        }
        const id = data && data.id;
        if (id && this._pending.has(id)) {
            const task = this._pending.get(id);
            this._pending.delete(id);
            if (task.timer) clearTimeout(task.timer);
            if (data.ok === false) {
                task.reject({ code: data.code, msg: data.msg || "native error" });
            } else {
                task.resolve(data);
            }
            return;
        }
        // 无 id:按主动事件分发
        const arr = this._listeners.get(method);
        if (arr) {
            arr.forEach((cb) => {
                try {
                    cb(data);
                } catch (e) {
                    console.log("[TapNativeBridge] 事件回调异常", method, e);
                }
            });
            return;
        }
        console.log("[TapNativeBridge] 未处理的原生回调", method, payload);
    }

    /**
     * 调用原生方法
     * @param method 模块.动作,如 "antiaddiction.startup"
     * @param params 参数对象
     * @param timeoutMs 超时
     * @returns 原生回包的 data 字段;失败/超时 reject
     */
    public static call(method: string, params: any = {}, timeoutMs: number = DEFAULT_TIMEOUT): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.isAvailable()) {
                reject({ code: -2, msg: "native bridge unavailable" });
                return;
            }
            this.init();
            const id = `tap-${++this._seq}`;
            const timer = setTimeout(() => {
                if (this._pending.has(id)) {
                    this._pending.delete(id);
                    console.log(`[TapNativeBridge] ${method} 超时(${timeoutMs}ms),按失败处理`);
                    reject({ code: -3, msg: "timeout" });
                }
            }, timeoutMs);
            this._pending.set(id, { resolve, reject, timer, method });
            try {
                (native as any).bridge.sendToNative(method, JSON.stringify({ id: id, params: params }));
            } catch (e) {
                clearTimeout(timer);
                this._pending.delete(id);
                reject({ code: -4, msg: "sendToNative error" });
            }
        });
    }
}

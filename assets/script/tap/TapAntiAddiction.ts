/**
 * TapTap 防沉迷 / 实名认证(国内版合规)
 *
 * 合规事实(以官方文档 2026-10 版为准,提审前必须复核):
 *   1. 游玩方式仅有"小游戏"时,防沉迷由 TapTap 平台托管,开发者无需额外操作。
 *   2. 只要同时提供 APK 下载,就必须自己完善防沉迷,或接入 TapPlay —— 本项目是
 *      "小游戏 + APK 双形态",因此本模块**必须接入**,不能依赖平台托管。
 *   3. TapSDK 防沉迷会自动对接中宣部实名认证系统,并以开发者主体上报;
 *      已在小游戏/ TapTap 完成实名的账号可静默复用,无需重复填身份证。
 *
 * 状态与回调码(TapSDK Unity/Android 文档口径):
 *   500  (ENTER_SUCCESS / LOGIN_SUCCESS) 校验通过,可玩(未成年在可玩时段内也会拿到)
 *   1000 (SWITCH_ACCOUNT)                 因防沉迷受限,玩家点了"切换账号"
 *   1030 (TIME_LIMIT)                     当日时长用尽 / 当前不可玩
 *   1095 (OPEN_ALERT)                     未成年可玩时段提醒弹窗
 *   9002 (REAL_NAME_STOP)                 玩家关闭了实名窗,未完成实名
 *   PERIOD_RESTRICT                       非可玩时段(宵禁:未成年仅周五/六/日及节假日 20:00-21:00)
 *
 * 文档:
 *   防沉迷开发指南  https://developer.taptap.cn/docs/v3/sdk/anti-addiction/guide
 *   未成年健康系统  https://developer.taptap.io/product-intro/anti-addiction
 *
 * 设计取舍(明确写出来,避免以后被当成 bug):
 *   - 原生包(TapTap APK):走 TapSDK,是真正的中宣部链路。
 *   - Tap 小游戏:平台托管,本模块不重复校验,只做状态透出与埋点,
 *     以免和平台重复弹窗、重复计时(重复计时会导致误封)。
 *   - **不允许"卡死"**:SDK 3 秒内无响应按放行处理并打告警日志,
 *     因为合规之外还要保证可玩;但一旦后续收到受限回调,立即拦截并踢回首页。
 */
import { App } from "../framework/DSAppManager";
import { DSEventKey } from "../framework/DSEventManager";
import { DSStorageKey } from "../framework/DSStorageManager";
import { DSViewName } from "../framework/DSUiManager";
import { DSPlatform } from "../framework/DSPlatform";
import { TapNativeBridge } from "./TapNativeBridge";

/** 防沉迷状态 */
export enum AntiAddictionState {
    /** 尚未校验 */
    Unknown = 0,
    /** 校验中 */
    Checking = 1,
    /** 可玩 */
    Allowed = 2,
    /** 时长用尽 */
    TimeLimit = 3,
    /** 非可玩时段(宵禁) */
    Curfew = 4,
    /** 未完成实名 */
    NotVerified = 5,
    /** 玩家选择切换账号 */
    SwitchAccount = 6,
}

/** TapSDK 防沉迷回调码 */
export const AntiAddictionCode = {
    ENTER_SUCCESS: 500,
    SWITCH_ACCOUNT: 1000,
    TIME_LIMIT: 1030,
    OPEN_ALERT: 1095,
    REAL_NAME_STOP: 9002,
};

export class TapAntiAddiction {

    private static _state: AntiAddictionState = AntiAddictionState.Unknown;
    /** 是否由平台托管(小游戏形态) */
    private static _platformManaged: boolean = false;
    /** 是否降级放行(SDK 超时/未接入) */
    private static _degraded: boolean = false;
    /** 是否已完成一次 startup */
    private static _started: boolean = false;
    /** 本次会话开始时间(用于本地提示,不参与封禁判定) */
    private static _sessionStart: number = 0;
    /** 等待 startup 结果的挂起回调 */
    private static _waiters: Function[] = [];

    public static get state(): AntiAddictionState {
        return this._state;
    }

    /** 是否平台托管(小游戏) */
    public static get isPlatformManaged(): boolean {
        return this._platformManaged;
    }

    /** 是否降级放行(联调期看这个字段判断有没有真正校验上) */
    public static get isDegraded(): boolean {
        return this._degraded;
    }

    /**
     * 初始化(在 App.init() 中调用一次)
     * 小游戏形态:平台托管,直接置可玩,仅打日志;
     * 原生形态:初始化 TapSDK 防沉迷并注册回调。
     */
    public static init(): void {
        if (!DSPlatform.isTap) {
            console.log("[防沉迷] 非 Tap 渠道,跳过初始化");
            this._state = AntiAddictionState.Allowed;
            return;
        }
        this._sessionStart = Date.now();

        if (DSPlatform.isTapMini) {
            this._platformManaged = true;
            // 平台托管:不重复校验,避免与平台双重计时导致误封
            this._state = AntiAddictionState.Allowed;
            console.log("[防沉迷] Tap 小游戏:防沉迷由平台托管,本模块只做状态透出");
            this.notify();
            return;
        }

        if (!TapNativeBridge.isAvailable()) {
            // 原生桥没接上(例如还没集成 TapSDK AAR),放行但明确告警
            this._degraded = true;
            this._state = AntiAddictionState.Allowed;
            console.log("[防沉迷] 告警:原生桥不可用,防沉迷降级放行 —— 提审前必须补齐 TapSDK");
            this.notify();
            return;
        }

        // 原生:先注册主动事件,再初始化
        TapNativeBridge.on("antiaddiction.event", (data: any) => {
            if (!data) return;
            this.handleCode(data.code, data.msg);
        });

        TapNativeBridge.call("antiaddiction.init", {
            // TapTap 开发者中心的 Client ID,原生侧读取本地配置即可,这里留空
            clientId: "",
            showSwitchAccount: false,
            useAgeRange: true,
        })
            .then(() => {
                console.log("[防沉迷] TapSDK 防沉迷初始化成功");
                this.startup();
            })
            .catch((e) => {
                this._degraded = true;
                this._state = AntiAddictionState.Allowed;
                console.log("[防沉迷] 告警:TapSDK 初始化失败,降级放行", e);
                this.notify();
            });
    }

    /** 发起防沉迷校验(原生形态;小游戏形态为空操作) */
    public static startup(): void {
        if (!DSPlatform.isTapNative) return;
        this._state = AntiAddictionState.Checking;
        this.notify();
        TapNativeBridge.call("antiaddiction.startup", { userIdentifier: this.getUserIdentifier() }, 3000)
            .then((res) => {
                this._started = true;
                if (res && res.data && res.data.code !== undefined) {
                    this.handleCode(res.data.code, res.data.msg);
                } else {
                    // 有些实现只回 ok:true,视为校验通过
                    this.setState(AntiAddictionState.Allowed);
                }
            })
            .catch((e) => {
                this._degraded = true;
                console.log("[防沉迷] 告警:校验超时/失败,降级放行", e);
                this.setState(AntiAddictionState.Allowed);
            });
    }

    /** 处理 TapSDK 回调码 */
    public static handleCode(code: any, msg?: string): void {
        console.log(`[防沉迷] 回调 code=${code} msg=${msg || ""}`);
        switch (code) {
            case AntiAddictionCode.ENTER_SUCCESS:
                this.setState(AntiAddictionState.Allowed);
                break;
            case AntiAddictionCode.OPEN_ALERT:
                // 未成年可玩时段提醒:不拦截,只提示
                App.ui.showMsgTips("未成年人仅可在周五、周六、周日及法定节假日 20:00-21:00 游戏");
                this.setState(AntiAddictionState.Allowed);
                break;
            case AntiAddictionCode.TIME_LIMIT:
                this.setState(AntiAddictionState.TimeLimit);
                break;
            case AntiAddictionCode.REAL_NAME_STOP:
                this.setState(AntiAddictionState.NotVerified);
                break;
            case AntiAddictionCode.SWITCH_ACCOUNT:
                this.setState(AntiAddictionState.SwitchAccount);
                break;
            default:
                // Android 侧 PERIOD_RESTRICT 以字符串常量出现
                if (code === "PERIOD_RESTRICT" || code === "period_restrict") {
                    this.setState(AntiAddictionState.Curfew);
                } else {
                    console.log("[防沉迷] 未识别的回调码,按可玩处理", code);
                    this.setState(AntiAddictionState.Allowed);
                }
                break;
        }
    }

    private static setState(state: AntiAddictionState): void {
        this._state = state;
        this.notify();
        // 受限状态:立即踢回首页,避免玩家在关卡内继续玩
        if (!this.canPlay()) {
            this.kickOut();
        }
    }

    private static notify(): void {
        App.event.emit(DSEventKey.AntiAddictionChange, this._state);
        if (this._waiters.length > 0) {
            const list = this._waiters.slice();
            this._waiters.length = 0;
            list.forEach((cb) => {
                try {
                    cb(this.canPlay());
                } catch (e) {
                    // 忽略
                }
            });
        }
    }

    /** 当前是否允许游玩 */
    public static canPlay(): boolean {
        return this._state === AntiAddictionState.Allowed ||
            this._state === AntiAddictionState.Unknown ||
            this._state === AntiAddictionState.Checking;
    }

    /** 状态对应的提示文案 */
    public static getTip(): string {
        switch (this._state) {
            case AntiAddictionState.TimeLimit:
                return "今日游戏时长已用尽,请明天再来";
            case AntiAddictionState.Curfew:
                return "当前时段不可游戏,未成年人仅可在周五、周六、周日及法定节假日 20:00-21:00 游戏";
            case AntiAddictionState.NotVerified:
                return "需完成实名认证后才能继续游戏";
            case AntiAddictionState.SwitchAccount:
                return "请切换为已实名的账号后再进入游戏";
            case AntiAddictionState.Checking:
                return "实名信息校验中,请稍候";
            default:
                return "";
        }
    }

    /**
     * 开始游戏前的拦截口
     * 用法: if (!TapAntiAddiction.guard()) return;
     * @returns true = 允许继续,false = 已拦截并提示
     */
    public static guard(): boolean {
        if (!DSPlatform.isTap) return true;
        if (this.canPlay()) return true;
        const tip = this.getTip();
        if (tip) App.ui.showMsgTips(tip);
        this.kickOut();
        return false;
    }

    /**
     * 异步拦截:校验还没出结果时等最多 timeout 毫秒
     * 用法: TapAntiAddiction.guardAsync((ok) => { if (ok) startGame(); });
     */
    public static guardAsync(cb: (ok: boolean) => void, timeout: number = 1500): void {
        if (!DSPlatform.isTap) {
            cb(true);
            return;
        }
        if (this._state !== AntiAddictionState.Checking) {
            cb(this.guard());
            return;
        }
        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            // 超时不阻塞玩家,按放行处理(与 startup 的降级策略保持一致)
            console.log("[防沉迷] 等待校验结果超时,按放行处理");
            cb(true);
        }, timeout);
        this._waiters.push((ok: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            cb(ok);
        });
    }

    /** 受限时踢回首页并提示 */
    private static kickOut(): void {
        const tip = this.getTip();
        if (tip) App.ui.showMsgTips(tip);
        try {
            App.ui.closeView(DSViewName.gameView);
        } catch (e) {
            // 忽略:界面未打开时关闭会抛错
        }
    }

    /** 玩家标识:优先用本地持久化的匿名 ID,TapSDK 与中宣部上报都靠它 */
    private static getUserIdentifier(): string {
        let uid = App.storage.getString(DSStorageKey.TapUserId, "");
        if (!uid) {
            uid = "tap_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
            App.storage.set(DSStorageKey.TapUserId, uid);
        }
        return uid;
    }

    /** 本次会话已游玩时长(秒),仅用于运营观察,不作为封禁依据 */
    public static getPlayedSeconds(): number {
        if (!this._sessionStart) return 0;
        return Math.floor((Date.now() - this._sessionStart) / 1000);
    }
}

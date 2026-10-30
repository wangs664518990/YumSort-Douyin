/**
 * 平台判定统一入口
 *
 * 为什么必须集中判定(踩坑记录):
 *   抖音 = BYTEDANCE 构建,sys.platform 为 BYTEDANCE_MINI_GAME,判定稳定。
 *   快手 = "微信小游戏构建 + 适配快手小游戏",sys.platform 仍是 WECHAT_GAME。
 *   Tap 小游戏 = "微信小游戏构建 + Tap 转换插件",sys.platform 同样是 WECHAT_GAME。
 *   三者里后两者平台标志完全相同,只靠 sys.platform 一定误判。
 *
 * 判定顺序(顺序本身就是规则,不要调换):
 *   1. sys.isNative           -> 原生包(本分支只有 TapTap APK 一个原生发行渠道)
 *   2. 全局对象 tap           -> Tap 小游戏
 *   3. 全局对象 ks/KSGameGlobal -> 快手
 *   4. BYTEDANCE 构建         -> 抖音
 *   5. 其余 WECHAT_GAME       -> 微信(本项目未上线,仅兜底)
 *
 * 注意:全局对象在个别容器里可能取不到,所以对外只暴露"是不是 Tap"这类
 * 语义化判断,不把裸判定散落到业务代码里。
 */
import { sys } from "cc";
import { BYTEDANCE } from "cc/env";

export enum DSPlatformKind {
    /** Tap 小游戏(WebGL,跑在 TapTap 内) */
    TapMini = "tap-mini",
    /** TapTap 原生包(Android / iOS APK) */
    TapNative = "tap-native",
    /** 快手小游戏 */
    Kuaishou = "kuaishou",
    /** 抖音小游戏 */
    Douyin = "douyin",
    /** 微信小游戏(本项目未上线,仅兜底) */
    Wechat = "wechat",
    /** 浏览器预览 / 调试 */
    Web = "web",
    /** 其他 */
    Other = "other",
}

/** 编译期常量:BYTEDANCE 构建(预览环境恒为 false) */
function isByTedanceBuild(): boolean {
    return BYTEDANCE === true;
}

export class DSPlatform {

    private static _kind: DSPlatformKind = null;

    /**
     * 当前平台类型
     * 首次访问时判定并缓存;调试期若需要重新判定,调用 refresh()
     */
    public static get kind(): DSPlatformKind {
        if (null == this._kind) {
            this._kind = this.detect();
        }
        return this._kind;
    }

    /** 清空缓存,下次访问重新判定(仅调试用) */
    public static refresh(): DSPlatformKind {
        this._kind = null;
        return this.kind;
    }

    /** 取全局对象,取不到返回 null */
    public static getGlobal(name: string): any {
        // @ts-ignore 平台运行时全局对象,编译期无声明(取值与判断必须写在同一处)
        const g: any = typeof globalThis !== "undefined" ? globalThis : null;
        if (g && g[name]) return g[name];
        const w: any = typeof window !== "undefined" ? window : null;
        if (w && w[name]) return w[name];
        return null;
    }

    /** Tap 小游戏的平台对象 tap(APK 原生包没有它) */
    public static getTap(): any {
        return this.getGlobal("tap");
    }

    private static detect(): DSPlatformKind {
        // 1. 原生包:本分支原生只发 TapTap APK / iOS
        if (sys.isNative) {
            if (sys.platform === sys.Platform.ANDROID || sys.platform === sys.Platform.IOS) {
                return DSPlatformKind.TapNative;
            }
            return DSPlatformKind.Other;
        }

        // 2. Tap 小游戏:必须排在快手/微信之前
        if (this.getTap()) {
            return DSPlatformKind.TapMini;
        }

        // 3. 抖音
        if (isByTedanceBuild() || sys.platform === sys.Platform.BYTEDANCE_MINI_GAME) {
            return DSPlatformKind.Douyin;
        }

        // 4. 快手
        if (this.getGlobal("ks") || this.getGlobal("KSGameGlobal")) {
            return DSPlatformKind.Kuaishou;
        }

        // 5. 微信构建产物(快手/Tap 也是它,但上面已先判定;这里已是真微信或未知容器)
        if (sys.platform === sys.Platform.WECHAT_GAME) {
            return DSPlatformKind.Wechat;
        }

        if (sys.platform === sys.Platform.MOBILE_BROWSER || sys.platform === sys.Platform.DESKTOP_BROWSER) {
            return DSPlatformKind.Web;
        }
        return DSPlatformKind.Other;
    }

    /** 是否 Tap 渠道(小游戏或原生包) */
    public static get isTap(): boolean {
        const k = this.kind;
        return k === DSPlatformKind.TapMini || k === DSPlatformKind.TapNative;
    }

    /** 是否 Tap 小游戏 */
    public static get isTapMini(): boolean {
        if (this.kind === DSPlatformKind.TapMini) return true;
        // 缓存可能是早期(全局对象未就绪)判定的,这里再补一次全局对象探测
        return !!this.getTap();
    }

    /** 是否 TapTap 原生包 */
    public static get isTapNative(): boolean {
        return this.kind === DSPlatformKind.TapNative;
    }

    /** 是否快手 */
    public static get isKuaishou(): boolean {
        return this.kind === DSPlatformKind.Kuaishou;
    }

    /** 是否抖音 */
    public static get isDouyin(): boolean {
        return this.kind === DSPlatformKind.Douyin;
    }

    /** 是否真微信(排除快手/Tap 这类"微信构建但非微信渠道"的产物) */
    public static get isWechat(): boolean {
        return this.kind === DSPlatformKind.Wechat;
    }

    /** 是否浏览器(预览/调试) */
    public static get isWeb(): boolean {
        return this.kind === DSPlatformKind.Web;
    }
}

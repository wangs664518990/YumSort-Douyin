/**
 * 快手小游戏平台 SDK 管理
 *
 * 背景说明(Cocos Creator 3.8.x 适配快手的官方方式):
 *   引擎没有独立的"快手小游戏"构建入口,官方方案是:
 *   构建"微信小游戏" -> 安装快手构建扩展 -> 勾选"适配快手小游戏" -> 用快手开发者工具打开。
 *   产物在快手运行时中 sys.platform 仍为 WECHAT_GAME,
 *   快手开发者工具会生成 kwaiadapter.js(GameGlobal.wx = ks)兼容微信 API,
 *   但广告等开放能力必须使用 ks 命名空间下的快手原生 API。
 *
 * 平台判断:以官方推荐的 KSGameGlobal / ks 全局对象为准(见 assets/script/ks/KsManager.ts)。
 *
 * 快手广告能力(以快手官方文档为准):
 *   - 激励视频  ks.createRewardedVideoAd({ adUnitId })  全局单例,无 load(),直接 show()
 *   - 插屏      ks.createInterstitialAd({ adUnitId })    启动 30 秒后才能展示成功
 *   - Banner    ks.createBannerAd({ adUnitId, style, adIntervals })
 *   快手暂无原生模板/格子广告(createCustomAd),抖音的九宫格面板同样不适用。
 */
import { App } from "../framework/DSAppManager";
import { DSStorageKey } from "../framework/DSStorageManager";

export class KsManager {
    private static _instance: KsManager = null;

    public static get instance(): KsManager {
        if (null == this._instance) {
            this._instance = new KsManager();
        }
        return this._instance;
    }

    /**
     * 是否运行在快手小游戏环境
     * 官方判断方式:typeof KSGameGlobal !== 'undefined'
     * 兜底:全局 ks 对象存在
     */
    public static isKuaishouEnv(): boolean {
        try {
            const check = new Function(
                "return typeof KSGameGlobal !== 'undefined' || typeof ks !== 'undefined';"
            );
            if (check()) return true;
        } catch (e) {
            // 忽略,继续走 window 判断
        }
        const w: any = typeof window !== "undefined" ? window : null;
        return !!(w && w["ks"]);
    }

    /** 获取快手平台全局对象 ks,非快手环境返回 null */
    public static getKs(): any {
        const w: any = typeof window !== "undefined" ? window : null;
        if (w && w["ks"]) {
            return w["ks"];
        }
        try {
            // 兜底:个别运行时仅将 ks 挂在全局作用域
            const getter = new Function("return typeof ks !== 'undefined' ? ks : undefined;");
            const ksObj = getter();
            if (ksObj) return ksObj;
        } catch (e) {
            // 忽略
        }
        return null;
    }

    // ==================== 广告位配置 ====================
    // 在快手开放平台小游戏流量主后台(https://game.kuaishou.com)申请广告位后填入,
    // 留空则不加载对应广告(相关入口会提示未开放)。
    public videoId: string = "";         // 激励视频广告位 ID
    public interstitialId: string = "";  // 插屏广告位 ID
    public bannerId: string = "";        // Banner 广告位 ID
    /**
     * 开屏广告位 ID(可选)
     * 快手小游戏没有独立开屏广告 API,开屏位以插屏广告实现;
     * 此处可填一个专用插屏广告位用于数据统计,留空则回退使用 interstitialId。
     */
    public splashId: string = "";

    private videoAd: any = null;         // 激励视频(快手为全局单例)
    private interstitialAd: any = null;  // 插屏
    private bannerAd: any = null;        // Banner
    private splashAd: any = null;        // 开屏(插屏实现)

    /** 开屏广告本次冷启动是否已展示(每次启动最多一次) */
    private splashShown: boolean = false;

    /** 老用户判定阈值:首次游玩满 3 天(含) */
    private static readonly OLD_USER_MS: number = 3 * 24 * 60 * 60 * 1000;

    /** 当前激励视频关闭回调引用(移除监听时需要按函数引用传参) */
    private videoCloseHandler: any = null;

    /** 实例创建时间,用于插屏 30 秒冷却判断 */
    private bootTime: number = Date.now();

    /** 系统信息(取不到时给默认值) */
    private getSystemInfoSync(): any {
        const ks = KsManager.getKs();
        if (ks && ks.getSystemInfoSync) {
            try {
                return ks.getSystemInfoSync();
            } catch (e) {
                // 忽略
            }
        }
        return { windowWidth: 375, windowHeight: 667 };
    }

    // ==================== 初始化 ====================

    /** 初始化全部已配置广告(进入首页时调用) */
    initAds(): void {
        if (!KsManager.isKuaishouEnv()) return;
        this.initVideoAd();
        this.initInterstitialAd();
        this.initBannerAd();
    }

    /** 初始化激励视频 */
    initVideoAd(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.videoId === "") {
            console.log("[KsManager] 未配置激励视频广告位 videoId,跳过初始化");
            return;
        }
        if (this.videoAd) return;
        const ks = KsManager.getKs();
        try {
            this.videoAd = ks.createRewardedVideoAd({ adUnitId: this.videoId });
            this.videoAd.onError((err: any) => {
                console.log("[KsManager] 激励视频广告异常", err);
            });
        } catch (e) {
            console.log("[KsManager] 激励视频广告创建失败", e);
            this.videoAd = null;
        }
    }

    /** 初始化插屏 */
    initInterstitialAd(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.interstitialId === "") {
            console.log("[KsManager] 未配置插屏广告位 interstitialId,跳过初始化");
            return;
        }
        if (this.interstitialAd) return;
        this.interstitialAd = this.createInterstitialAd(this.interstitialId);
    }

    /** 创建插屏广告实例(内部复用) */
    private createInterstitialAd(adUnitId: string): any {
        const ks = KsManager.getKs();
        try {
            const ad = ks.createInterstitialAd({ adUnitId: adUnitId });
            ad.onError((err: any) => {
                console.log("[KsManager] 插屏广告异常", err);
            });
            return ad;
        } catch (e) {
            console.log("[KsManager] 插屏广告创建失败", e);
            return null;
        }
    }

    /** 初始化 Banner */
    initBannerAd(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.bannerId === "") {
            console.log("[KsManager] 未配置 Banner 广告位 bannerId,跳过初始化");
            return;
        }
        if (this.bannerAd) return;
        const ks = KsManager.getKs();
        try {
            const winSize = this.getSystemInfoSync();
            const bannerWidth = 300;
            this.bannerAd = ks.createBannerAd({
                adUnitId: this.bannerId,
                adIntervals: 30,
                style: {
                    left: (winSize.windowWidth - bannerWidth) / 2,
                    top: winSize.windowHeight - 120,
                    width: bannerWidth,
                },
            });
            // 按真实尺寸吸附到底部居中
            this.bannerAd.onResize((res: any) => {
                this.bannerAd.style.top = winSize.windowHeight - res.height;
                this.bannerAd.style.left = (winSize.windowWidth - res.width) / 2;
            });
            this.bannerAd.onError((err: any) => {
                console.log("[KsManager] Banner广告异常", err);
            });
        } catch (e) {
            console.log("[KsManager] Banner广告创建失败", e);
            this.bannerAd = null;
        }
    }

    // ==================== 激励视频 ====================

    /**
     * 展示激励视频
     * @param success 播放结束(isEnded)回调
     * @param fail    中断或失败回调(可选)
     */
    showVideoAds(success: any, fail?: any): void {
        if (!KsManager.isKuaishouEnv()) {
            return fail && fail("当前平台不支持");
        }
        if (this.videoId === "") {
            App.ui.showMsgTips("视频广告暂未开放");
            return fail && fail("未配置激励视频广告位");
        }
        if (!this.videoAd) {
            this.initVideoAd();
        }
        if (!this.videoAd) {
            App.ui.showMsgTips("视频广告加载失败");
            return fail && fail("激励视频广告创建失败");
        }
        App.global.isShowVideoAds = true;
        // 先按函数引用移除上一次的关闭回调,避免多次进入广告后重复发放奖励
        if (this.videoCloseHandler && typeof this.videoAd.offClose === "function") {
            try {
                this.videoAd.offClose(this.videoCloseHandler);
            } catch (e) {
                // 忽略
            }
            this.videoCloseHandler = null;
        }
        const closeHandler = (res: any) => {
            App.global.isShowVideoAds = false;
            // 清除自身回调,否则第 N 次广告会一次性给 N 个奖励
            if (typeof this.videoAd.offClose === "function") {
                try {
                    this.videoAd.offClose(closeHandler);
                } catch (e) {
                    // 忽略
                }
            }
            this.videoCloseHandler = null;
            // 低版本基础库 res 可能为 undefined,按播放结束处理
            if ((res && res.isEnded) || res === undefined) {
                return success && success("激励奖励已发放");
            }
            console.log("[KsManager] 激励视频播放中断");
            return fail && fail("视频播放中断");
        };
        this.videoCloseHandler = closeHandler;
        this.videoAd.onClose(closeHandler);
        const ret = this.videoAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => {
                App.global.isShowVideoAds = false;
                console.log("[KsManager] 激励视频展示失败", err);
                App.ui.showMsgTips("视频广告加载失败,请稍后重试");
                return fail && fail("广告展示失败");
            });
        }
    }

    // ==================== 插屏 ====================

    /**
     * 展示插屏
     * 注意:快手要求游戏运行 30 秒后才能展示插屏,提前调用会报错(-20037),
     * 这里对未满足冷却时间的调用做延迟处理。
     */
    showInterstitialAds(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.interstitialId === "") {
            console.log("[KsManager] 未配置插屏广告位,跳过展示");
            return;
        }
        if (!this.interstitialAd) {
            this.initInterstitialAd();
        }
        if (!this.interstitialAd) return;
        const elapsed = Date.now() - this.bootTime;
        if (elapsed < 30000) {
            setTimeout(() => {
                this.showInterstitialAdInternal(this.interstitialAd);
            }, 31000 - elapsed);
            return;
        }
        this.showInterstitialAdInternal(this.interstitialAd);
    }

    /** 展示插屏实例(内部复用,统一处理展示失败的 Promise) */
    private showInterstitialAdInternal(ad: any): void {
        if (!ad) return;
        const ret = ad.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => {
                // -10005:当前 App 版本不支持;-20037:30 秒冷却中 —— 静默处理
                console.log("[KsManager] 插屏展示失败", err);
            });
        }
    }

    // ==================== 开屏广告 ====================

    /**
     * 是否老用户(首次游玩时间在 3 天前,含第 3 天)
     * 首次游玩时间在 DSStorageManager.init() 时写入本地缓存,仅首次记录。
     */
    isOldUser(): boolean {
        const firstPlayTime = App.storage.getNumber(DSStorageKey.First_Play_Time, 0);
        if (firstPlayTime <= 0) return false;
        return Date.now() - firstPlayTime >= KsManager.OLD_USER_MS;
    }

    /**
     * 展示开屏广告
     * 规则:仅快手平台、仅首次游玩满 3 天的老用户、每次冷启动最多一次。
     *
     * 实现说明:快手小游戏没有独立开屏广告 API(ks.createSplashAd 不存在),
     * 开屏位以插屏广告实现;受平台频控限制(冷启动 30 秒内不允许播放插屏),
     * 会在启动 31 秒后展示,请知悉这与真正意义上的"启动瞬间全屏广告"有时差。
     */
    showSplashAds(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.splashShown) return;
        if (!this.isOldUser()) {
            console.log("[KsManager] 新用户(首次游玩未满3天)不展示开屏广告");
            return;
        }
        const splashId = this.splashId !== "" ? this.splashId : this.interstitialId;
        if (splashId === "") {
            console.log("[KsManager] 未配置开屏/插屏广告位,跳过开屏广告");
            return;
        }
        this.splashShown = true;
        if (!this.splashAd) {
            this.splashAd = this.createInterstitialAd(splashId);
        }
        if (!this.splashAd) return;
        console.log("[KsManager] 老用户冷启动,已调度开屏广告");
        const elapsed = Date.now() - this.bootTime;
        if (elapsed < 30000) {
            // 平台频控:冷启动 30 秒内插屏必失败,延迟到 31 秒
            setTimeout(() => {
                this.showInterstitialAdInternal(this.splashAd);
            }, 31000 - elapsed);
            return;
        }
        this.showInterstitialAdInternal(this.splashAd);
    }

    // ==================== Banner ====================

    /** 展示 Banner */
    showBannerAds(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (this.bannerId === "") {
            console.log("[KsManager] 未配置 Banner 广告位,跳过展示");
            return;
        }
        if (!this.bannerAd) {
            this.initBannerAd();
        }
        if (!this.bannerAd) return;
        const ret = this.bannerAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => {
                console.log("[KsManager] Banner展示失败", err);
            });
        }
    }

    /** 隐藏 Banner */
    hideBannerAds(): void {
        if (!KsManager.isKuaishouEnv()) return;
        if (!this.bannerAd) return;
        try {
            this.bannerAd.hide();
        } catch (e) {
            // 忽略
        }
    }

    // ==================== 震动 ====================

    /** 震动(调用方需先判断用户震动开关) */
    vibrate(isLong: boolean = true): void {
        if (!KsManager.isKuaishouEnv()) return;
        const ks = KsManager.getKs();
        try {
            if (isLong) {
                if (ks && ks.vibrateLong) ks.vibrateLong({});
            } else {
                if (ks && ks.vibrateShort) ks.vibrateShort({});
            }
        } catch (e) {
            // 忽略
        }
    }

    // ==================== 分享 ====================

    /**
     * 主动分享(快手分享 API 无回调,做存在性检测)
     * @param title 分享标题
     */
    share(title: string): void {
        if (!KsManager.isKuaishouEnv()) return;
        const ks = KsManager.getKs();
        if (ks && typeof ks.shareAppMessage === "function") {
            try {
                ks.shareAppMessage({ title: title });
            } catch (e) {
                console.log("[KsManager] 分享失败", e);
            }
        } else {
            console.log("[KsManager] 当前快手版本不支持分享");
        }
    }

    // ==================== 登录 ====================

    /** 登录建立会话(快手允许未登录进入游戏,此处仅按需调用) */
    login(): Promise<any> {
        return new Promise((resolve, reject) => {
            const ks = KsManager.getKs();
            if (!ks || typeof ks.login !== "function") {
                resolve(null);
                return;
            }
            try {
                ks.login({
                    success: (res: any) => resolve(res),
                    fail: (err: any) => reject(err),
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

/** 全局单例 */
export let KsMgr = new KsManager();

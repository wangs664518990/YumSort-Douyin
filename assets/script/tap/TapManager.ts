/**
 * TapTap 渠道 SDK 管理(国内版)
 *
 * 覆盖两个发行形态,能力实现完全不同,但对外只暴露一套接口:
 *
 *   ┌─────────────┬──────────────────────────────┬────────────────────────────────┐
 *   │ 形态        │ 广告                         │ 登录 / 防沉迷                  │
 *   ├─────────────┼──────────────────────────────┼────────────────────────────────┤
 *   │ Tap 小游戏  │ tap.* JS API(广告位来自     │ 平台托管(详见 TapAntiAddiction)│
 *   │ (WebGL)     │ Dirichlet 小游戏推广位)      │                                │
 *   │ TapTap APK  │ Dirichlet 原生 SDK(桥接)     │ TapSDK 原生(桥接)              │
 *   └─────────────┴──────────────────────────────┴────────────────────────────────┘
 *
 * 关键事实(以官方文档 2026-10 版本为准,接入前请复核):
 *   1. Tap 小游戏只支持 激励视频 / 插屏 / Banner / 原生模板 四种,没有开屏广告。
 *   2. 小游戏广告位在 Dirichlet 媒体平台创建(应用类型选"小游戏"),不是 TapTap 开发者中心。
 *   3. 插屏建议间隔 ≥ 2 分钟;激励视频必须玩家主动点击,不允许自动弹。
 *   4. 广告加载失败必须跳过,不能卡住游戏流程 —— 本实现所有失败路径都回调 fail,由业务兜底。
 *
 * 文档:
 *   小游戏广告  https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/
 *   APK 广告    https://ssp.dirichlet.cn/docs/
 */
import { sys } from "cc";
import { App } from "../framework/DSAppManager";
import { DSPlatform } from "../framework/DSPlatform";
import { DSStorageKey } from "../framework/DSStorageManager";
import { TapNativeBridge } from "./TapNativeBridge";

/** 广告位配置:全部留空则不加载该广告,对应入口走"暂未开放"或静默跳过 */
export class TapAdConfig {
    /** 激励视频广告位(Dirichlet 小游戏推广位) */
    public static rewardedId: string = "";
    /** 插屏广告位 */
    public static interstitialId: string = "";
    /** Banner 广告位 */
    public static bannerId: string = "";
    /** 原生模板广告位(仅 Tap 小游戏) */
    public static nativeId: string = "";
    /** 开屏广告位(仅 APK;Tap 小游戏无开屏) */
    public static splashId: string = "";

    /** 插屏最小间隔(毫秒),官方建议 ≥ 2 分钟 */
    public static interstitialInterval: number = 120 * 1000;

    /** 调试开关:true 时所有广告直接回调成功,不请求平台 */
    public static isTest: boolean = false;
}

export class TapManager {

    private static _instance: TapManager = null;

    public static get instance(): TapManager {
        if (null == this._instance) {
            this._instance = new TapManager();
        }
        return this._instance;
    }

    // ==================== 小游戏广告实例 ====================
    private rewardedAd: any = null;
    private interstitialAd: any = null;
    private bannerAd: any = null;
    private nativeAd: any = null;

    /** 激励视频关闭回调引用(移除监听必须传函数引用,否则第 N 次广告发 N 份奖励) */
    private rewardedCloseHandler: any = null;

    /** 上次插屏展示时间,用于 2 分钟频控 */
    private lastInterstitialAt: number = 0;

    /** 启动广告本次冷启动是否已调度 */
    private startupShown: boolean = false;

    /** 播放中标记,防止重复触发 */
    private videoPlaying: boolean = false;

    private get tapApi(): any {
        return DSPlatform.getTap();
    }

    /** 是否处于任何 Tap 渠道 */
    public get isTap(): boolean {
        return DSPlatform.isTap;
    }

    // ==================== 初始化 ====================

    /** 初始化全部已配置广告(通常在广告门面构造时调用一次) */
    public initAds(): void {
        if (!this.isTap) return;
        if (DSPlatform.isTapNative) {
            // APK:原生 SDK 初始化,失败不阻塞游戏
            TapNativeBridge.call("ad.init", {}).catch((e) => {
                console.log("[TapManager] 原生广告 SDK 初始化失败(可忽略,不影响游戏)", e);
            });
            return;
        }
        this.initRewardedAd();
        this.initInterstitialAd();
        this.initBannerAd();
    }

    private getSystemInfoSync(): any {
        const api = this.tapApi;
        if (api && typeof api.getSystemInfoSync === "function") {
            try {
                return api.getSystemInfoSync();
            } catch (e) {
                // 忽略
            }
        }
        return { windowWidth: 375, windowHeight: 667 };
    }

    // ==================== 激励视频 ====================

    private initRewardedAd(): void {
        if (TapAdConfig.rewardedId === "") {
            console.log("[TapManager] 未配置激励视频广告位 rewardedId,跳过初始化");
            return;
        }
        const api = this.tapApi;
        if (!api || typeof api.createRewardedVideoAd !== "function") {
            console.log("[TapManager] 当前容器不支持 createRewardedVideoAd");
            return;
        }
        if (this.rewardedAd) return;
        try {
            // 激励视频是单例组件,重复创建返回同一实例
            this.rewardedAd = api.createRewardedVideoAd({ adUnitId: TapAdConfig.rewardedId });
            this.rewardedAd.onError((err: any) => {
                console.log("[TapManager] 激励视频异常", err);
            });
        } catch (e) {
            console.log("[TapManager] 激励视频创建失败", e);
            this.rewardedAd = null;
        }
    }

    /**
     * 展示激励视频
     * @param success 完整播放回调
     * @param fail    中断/失败回调
     */
    public showVideoAds(success: Function, fail?: Function): void {
        if (TapAdConfig.isTest) {
            console.log("[TapManager] isTest=true,激励视频模拟成功");
            success && success("测试模式:激励奖励已发放");
            return;
        }
        if (!this.isTap) {
            return fail && fail("当前平台不支持");
        }
        if (this.videoPlaying) {
            console.log("[TapManager] 激励视频播放中,忽略重复请求");
            return fail && fail("广告播放中");
        }
        if (DSPlatform.isTapNative) {
            this.showNativeRewarded(success, fail);
            return;
        }

        if (TapAdConfig.rewardedId === "") {
            App.ui.showMsgTips("视频广告暂未开放");
            return fail && fail("未配置激励视频广告位");
        }
        if (!this.rewardedAd) this.initRewardedAd();
        const ad = this.rewardedAd;
        if (!ad) {
            App.ui.showMsgTips("视频广告加载失败");
            return fail && fail("激励视频广告创建失败");
        }

        this.videoPlaying = true;
        App.global.isShowVideoAds = true;

        // 先清上一次的关闭回调,避免奖励重复发放
        if (this.rewardedCloseHandler && typeof ad.offClose === "function") {
            try {
                ad.offClose(this.rewardedCloseHandler);
            } catch (e) {
                // 忽略
            }
            this.rewardedCloseHandler = null;
        }

        const onClose = (res: any) => {
            this.videoPlaying = false;
            App.global.isShowVideoAds = false;
            if (typeof ad.offClose === "function") {
                try {
                    ad.offClose(onClose);
                } catch (e) {
                    // 忽略
                }
            }
            this.rewardedCloseHandler = null;
            // 部分版本 res 为 undefined,按完整播放处理
            if ((res && res.isEnded) || res === undefined) {
                return success && success("激励奖励已发放");
            }
            console.log("[TapManager] 激励视频中途关闭,不发放奖励");
            return fail && fail("视频播放中断");
        };
        this.rewardedCloseHandler = onClose;
        ad.onClose(onClose);

        const ret = ad.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => {
                this.videoPlaying = false;
                App.global.isShowVideoAds = false;
                console.log("[TapManager] 激励视频展示失败,尝试重新加载", err);
                // 官方建议:先 load 再 show,仍失败则放弃,不卡流程
                if (typeof ad.load === "function") {
                    ad.load()
                        .then(() => ad.show())
                        .catch((e2: any) => {
                            this.videoPlaying = false;
                            App.global.isShowVideoAds = false;
                            console.log("[TapManager] 激励视频二次展示失败", e2);
                            App.ui.showMsgTips("视频广告加载失败,请稍后重试");
                            return fail && fail("广告展示失败");
                        });
                } else {
                    App.ui.showMsgTips("视频广告加载失败,请稍后重试");
                    return fail && fail("广告展示失败");
                }
            });
        }
    }

    /** APK:经原生桥展示激励视频 */
    private showNativeRewarded(success: Function, fail?: Function): void {
        if (TapAdConfig.rewardedId === "") {
            App.ui.showMsgTips("视频广告暂未开放");
            return fail && fail("未配置激励视频广告位");
        }
        this.videoPlaying = true;
        App.global.isShowVideoAds = true;
        TapNativeBridge.call("ad.showRewarded", {
            spaceId: TapAdConfig.rewardedId,
            userId: App.storage.getString(DSStorageKey.TapUserId, ""),
            rewardName: "体力",
            rewardAmount: 1,
        }, 20000)
            .then((res) => {
                this.videoPlaying = false;
                App.global.isShowVideoAds = false;
                // 原生只有 onRewardVerify 通过后才会回 code=1
                if (res && res.code === 1) {
                    return success && success("激励奖励已发放");
                }
                return fail && fail("视频播放中断");
            })
            .catch((e) => {
                this.videoPlaying = false;
                App.global.isShowVideoAds = false;
                console.log("[TapManager] 原生激励视频失败", e);
                App.ui.showMsgTips("视频广告加载失败,请稍后重试");
                return fail && fail("广告展示失败");
            });
    }

    // ==================== 插屏 ====================

    private initInterstitialAd(): void {
        if (TapAdConfig.interstitialId === "") {
            console.log("[TapManager] 未配置插屏广告位 interstitialId,跳过初始化");
            return;
        }
        const api = this.tapApi;
        if (!api || typeof api.createInterstitialAd !== "function") {
            console.log("[TapManager] 当前容器不支持 createInterstitialAd");
            return;
        }
        if (this.interstitialAd) return;
        try {
            this.interstitialAd = api.createInterstitialAd({ adUnitId: TapAdConfig.interstitialId });
            this.interstitialAd.onError((err: any) => {
                console.log("[TapManager] 插屏异常", err);
            });
        } catch (e) {
            console.log("[TapManager] 插屏创建失败", e);
            this.interstitialAd = null;
        }
    }

    /** 展示插屏(内置 2 分钟频控,频控内调用静默跳过) */
    public showInterstitialAds(): void {
        if (!this.isTap) return;
        if (TapAdConfig.isTest) {
            console.log("[TapManager] isTest=true,插屏跳过");
            return;
        }
        const now = Date.now();
        if (now - this.lastInterstitialAt < TapAdConfig.interstitialInterval) {
            console.log("[TapManager] 插屏处于频控期,跳过");
            return;
        }
        if (DSPlatform.isTapNative) {
            this.lastInterstitialAt = now;
            TapNativeBridge.call("ad.showInterstitial", {
                spaceId: TapAdConfig.interstitialId,
            }, 10000).catch((e) => {
                console.log("[TapManager] 原生插屏失败", e);
            });
            return;
        }
        if (TapAdConfig.interstitialId === "") {
            console.log("[TapManager] 未配置插屏广告位,跳过展示");
            return;
        }
        if (!this.interstitialAd) this.initInterstitialAd();
        if (!this.interstitialAd) return;
        this.lastInterstitialAt = now;
        const ret = this.interstitialAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => {
                console.log("[TapManager] 插屏展示失败(可忽略)", err);
            });
        }
    }

    // ==================== Banner ====================

    private initBannerAd(): void {
        if (TapAdConfig.bannerId === "") {
            console.log("[TapManager] 未配置 Banner 广告位 bannerId,跳过初始化");
            return;
        }
        const api = this.tapApi;
        if (!api || typeof api.createBannerAd !== "function") {
            console.log("[TapManager] 当前容器不支持 createBannerAd");
            return;
        }
        if (this.bannerAd) return;
        try {
            const winSize = this.getSystemInfoSync();
            const bannerWidth = 300;
            this.bannerAd = api.createBannerAd({
                adUnitId: TapAdConfig.bannerId,
                adIntervals: 30,
                style: {
                    left: (winSize.windowWidth - bannerWidth) / 2,
                    top: winSize.windowHeight - 110,
                    width: bannerWidth,
                },
            });
            // 按真实尺寸吸附底部居中
            this.bannerAd.onResize((res: any) => {
                this.bannerAd.style.top = winSize.windowHeight - res.height;
                this.bannerAd.style.left = (winSize.windowWidth - res.width) / 2;
            });
            this.bannerAd.onError((err: any) => {
                console.log("[TapManager] Banner 异常", err);
            });
        } catch (e) {
            console.log("[TapManager] Banner 创建失败", e);
            this.bannerAd = null;
        }
    }

    public showBannerAds(): void {
        if (!this.isTap) return;
        if (TapAdConfig.isTest) return;
        if (DSPlatform.isTapNative) {
            if (TapAdConfig.bannerId === "") return;
            TapNativeBridge.call("ad.showBanner", {
                spaceId: TapAdConfig.bannerId,
            }, 6000).catch(() => { });
            return;
        }
        if (TapAdConfig.bannerId === "") return;
        if (!this.bannerAd) this.initBannerAd();
        if (!this.bannerAd) return;
        const ret = this.bannerAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => console.log("[TapManager] Banner 展示失败", err));
        }
    }

    public hideBannerAds(): void {
        if (!this.isTap) return;
        if (DSPlatform.isTapNative) {
            TapNativeBridge.call("ad.hideBanner", {}, 3000).catch(() => { });
            return;
        }
        if (!this.bannerAd) return;
        try {
            this.bannerAd.hide();
        } catch (e) {
            // 忽略
        }
    }

    // ==================== 原生模板广告(仅 Tap 小游戏) ====================

    public showNativeAds(): void {
        if (!this.isTap) return;
        if (DSPlatform.isTapNative) return; // APK 用信息流需自渲染,本版不接
        if (TapAdConfig.nativeId === "") return;
        const api = this.tapApi;
        if (!api || typeof api.createCustomAd !== "function") {
            console.log("[TapManager] 当前容器不支持原生模板广告");
            return;
        }
        if (!this.nativeAd) {
            try {
                const winSize = this.getSystemInfoSync();
                this.nativeAd = api.createCustomAd({
                    adUnitId: TapAdConfig.nativeId,
                    adIntervals: 31,
                    style: {
                        left: 0,
                        top: ratioOfHeight(winSize, 0.45),
                        width: winSize.windowWidth,
                        fixed: 70,
                    },
                });
                this.nativeAd.onError((err: any) => console.log("[TapManager] 原生模板异常", err));
            } catch (e) {
                console.log("[TapManager] 原生模板创建失败", e);
                this.nativeAd = null;
                return;
            }
        }
        const ret = this.nativeAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => console.log("[TapManager] 原生模板展示失败", err));
        }
    }

    public hideNativeAds(): void {
        if (!this.nativeAd) return;
        try {
            this.nativeAd.hide();
        } catch (e) {
            // 忽略
        }
    }

    // ==================== 启动广告 ====================

    /**
     * 启动位广告
     * APK:走 Dirichlet 开屏(需在原生侧实现 ad.showSplash)
     * 小游戏:平台无开屏能力,降级为一次插屏,且每次冷启动最多一次
     */
    public showStartupAds(): void {
        if (!this.isTap) return;
        if (this.startupShown) return;
        this.startupShown = true;
        if (DSPlatform.isTapNative) {
            if (TapAdConfig.splashId === "") {
                console.log("[TapManager] 未配置开屏广告位,跳过");
                return;
            }
            TapNativeBridge.call("ad.showSplash", { spaceId: TapAdConfig.splashId }, 10000).catch((e) => {
                console.log("[TapManager] 开屏展示失败(可忽略)", e);
            });
            return;
        }
        // 小游戏无开屏,用插屏兜底
        if (TapAdConfig.interstitialId === "") return;
        if (!this.interstitialAd) this.initInterstitialAd();
        if (!this.interstitialAd) return;
        this.lastInterstitialAt = Date.now();
        const ret = this.interstitialAd.show();
        if (ret && typeof ret.catch === "function") {
            ret.catch((err: any) => console.log("[TapManager] 启动插屏展示失败(可忽略)", err));
        }
    }

    // ==================== 登录 ====================

    /**
     * TapTap 登录
     * 小游戏:官方要求包体内必须已接入 TapTap 登录,否则 TapTap 用户无法正常游玩。
     * APK:TapSDK TapLogin,原生侧实现后经桥返回 openid / unionid / accessToken。
     */
    public login(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.isTap) {
                resolve(null);
                return;
            }
            if (DSPlatform.isTapNative) {
                TapNativeBridge.call("login.startup", {}, 30000)
                    .then((res) => resolve(res && res.data))
                    .catch((e) => reject(e));
                return;
            }
            const api = this.tapApi;
            if (!api || typeof api.login !== "function") {
                console.log("[TapManager] 当前 Tap 小游戏容器未提供 login 接口");
                resolve(null);
                return;
            }
            try {
                api.login({
                    success: (res: any) => resolve(res),
                    fail: (err: any) => reject(err),
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    // ==================== 震动 ====================

    public vibrate(isLong: boolean = true): void {
        if (!this.isTap) return;
        if (DSPlatform.isTapNative) {
            TapNativeBridge.call(isLong ? "device.vibrateLong" : "device.vibrateShort", {}, 2000).catch(() => { });
            return;
        }
        const api = this.tapApi;
        if (!api) return;
        try {
            if (isLong) {
                if (typeof api.vibrateLong === "function") api.vibrateLong({});
            } else {
                if (typeof api.vibrateShort === "function") api.vibrateShort({});
            }
        } catch (e) {
            // 忽略
        }
    }

    // ==================== 分享 ====================

    /**
     * 主动分享
     * 注意:本游戏无排行榜开放数据域需求;Tap 渠道分享只做"存在性检测 + 静默失败",
     * 不做分享得奖励,避免违反平台"不得诱导分享"的要求。
     */
    public share(title: string): void {
        if (!this.isTap) return;
        if (DSPlatform.isTapNative) {
            TapNativeBridge.call("device.share", { title: title }, 3000).catch(() => { });
            return;
        }
        const api = this.tapApi;
        if (api && typeof api.shareAppMessage === "function") {
            try {
                api.shareAppMessage({ title: title });
            } catch (e) {
                console.log("[TapManager] 分享失败", e);
            }
        } else {
            console.log("[TapManager] 当前 Tap 小游戏容器不支持分享");
        }
    }

    // ==================== 系统信息 ====================

    /** 安全区 / 屏高宽(适配刘海屏用),取不到给默认值 */
    public getSystemInfo(): any {
        if (!this.isTap) return null;
        if (DSPlatform.isTapNative) {
            // 原生包安全区用引擎自身接口,不走桥
            const rect = typeof sys.getSafeAreaRect === "function" ? sys.getSafeAreaRect() : null;
            return { safeArea: rect };
        }
        return this.getSystemInfoSync();
    }
}

/** 按屏高比例取位置 */
function ratioOfHeight(winSize: any, ratio: number): number {
    return (winSize && winSize.windowHeight ? winSize.windowHeight : 667) * ratio;
}

/** 全局单例 */
export let TapMgr = new TapManager();

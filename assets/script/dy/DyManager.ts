import { BYTEDANCE, WECHAT } from "cc/env";
import { sys } from "cc";
import { App } from "../framework/DSAppManager";

/** 抖音广告位集中配置 */
const DY_AD_CONFIG = {
    rewardedVideoId: '1533aeej4hkk6a8jh5',
    interstitialId: '44d5a8ll12km6brkeb',
};

/** 插屏最小间隔（毫秒），避免短局快速结算时频繁弹出 */
const INTERSTITIAL_MIN_INTERVAL = 90 * 1000;

export class SdkManager {
    public static _instance: SdkManager = null

    public static get instance() {
        if (null == this._instance) {
            this._instance = new SdkManager();
        }
        return this._instance
    }

    // 激励视频
    private videoAd: any = null
    private videoCloseHandler: any = null
    /** 幂等保护：同一次 show 的 onClose 只结算一次 */
    private videoSettled: boolean = false

    // 插屏
    private interstitialAd: any = null
    /** 上次插屏展示时间戳 */
    private lastInterstitialTime: number = 0

    // 获取平台
    getPlatform() {
        let platform = null
        if (WECHAT) {
            platform = window['wx']
        } else if (BYTEDANCE) {
            platform = window['tt']
        }
        return platform
    }

    /** 是否抖音小游戏环境 */
    private isDouyin(): boolean {
        return sys.platform == sys.Platform.BYTEDANCE_MINI_GAME
    }

    // ==================== 启动初始化 ====================

    /**
     * 启动时预创建激励视频 / 插屏实例并预加载。
     * 应在 App.init() 之后、首页加载之前调用。
     */
    public init() {
        if (!this.isDouyin()) return
        this.initVideoAd()
        this.initInterstitialAd()
    }

    // ==================== 激励视频 ====================

    /** 初始化激励视频实例 */
    initVideoAd() {
        if (!this.isDouyin()) return
        const platform = this.getPlatform()
        if (!platform) {
            console.log('[DY-Ad] video ad init: platform not ready')
            return
        }
        if (this.videoAd == null) {
            this.videoAd = platform.createRewardedVideoAd({
                adUnitId: DY_AD_CONFIG.rewardedVideoId
            });
            this.videoAd.onError((err: any) => {
                console.warn('[DY-Ad] 激励视频错误', JSON.stringify(err))
            });
            // 预加载
            this.videoAd.load().then(() => {
                console.log('[DY-Ad] 激励视频预加载完成')
            }).catch((err: any) => {
                console.warn('[DY-Ad] 激励视频预加载失败', JSON.stringify(err))
            });
        }
    }

    /** 显示激励视频 */
    showVideoAd(success: Function, fail?: Function) {
        if (!this.isDouyin()) {
            return
        }
        if (!this.videoAd) {
            this.initVideoAd();
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.warn('[DY-Ad] platform not ready')
            fail && fail('广告暂不可用')
            return
        }
        if (!this.videoAd) {
            fail && fail('广告暂不可用')
            App.ui.showMsgTips('广告加载中，请稍后再试')
            return
        }

        // 重置幂等标志
        this.videoSettled = false

        // 先移除上一次的 onClose handler
        this.removeVideoCloseHandler()

        App.global.isShowVideoAds = true;

        // 注册 onClose
        const handler = (res: any) => {
            if (this.videoSettled) return
            this.videoSettled = true

            App.global.isShowVideoAds = false;
            this.removeVideoCloseHandler();

            if (res && res.isEnded || res === undefined) {
                success && success('激励奖励已发放')
            } else {
                fail && fail('视频播放中断')
                App.ui.showMsgTips('视频未播完，奖励未发放')
            }
        };
        this.videoCloseHandler = handler;
        this.videoAd.onClose(handler);

        // 展示，失败则重试一次
        this.videoAd.show().catch(() => {
            this.videoAd.load()
                .then(() => this.videoAd.show())
                .catch((err: any) => {
                    console.warn('[DY-Ad] 激励视频展示失败', JSON.stringify(err))
                    this.videoSettled = true
                    this.removeVideoCloseHandler()
                    App.global.isShowVideoAds = false
                    fail && fail('广告展示失败')
                    App.ui.showMsgTips('广告加载失败，请稍后再试')
                })
        });
    }

    /** 显式移除当前 onClose handler */
    private removeVideoCloseHandler() {
        if (this.videoAd && this.videoCloseHandler) {
            try {
                this.videoAd.offClose(this.videoCloseHandler)
            } catch (e) {
                console.warn('[DY-Ad] offClose 异常', e)
            }
        }
        this.videoCloseHandler = null
    }

    // ==================== 插屏 ====================

    /** 初始化插屏实例 */
    initInterstitialAd() {
        if (!this.isDouyin()) return
        const platform = this.getPlatform()
        if (!platform) {
            console.log('[DY-Ad] interstitial ad init: platform not ready')
            return
        }
        if (this.interstitialAd == null) {
            this.interstitialAd = platform.createInterstitialAd({
                adUnitId: DY_AD_CONFIG.interstitialId
            });
            this.interstitialAd.onError((err: any) => {
                console.warn('[DY-Ad] 插屏错误', JSON.stringify(err))
            });
        }
    }

    /** 显示插屏（带节流） */
    showInterstitialAd() {
        if (!this.isDouyin()) return

        // 节流：距上次展示不足间隔则跳过
        const now = Date.now()
        if (now - this.lastInterstitialTime < INTERSTITIAL_MIN_INTERVAL) {
            return
        }

        if (!this.interstitialAd) {
            this.initInterstitialAd();
        }

        const platform = this.getPlatform()
        if (!platform) {
            return
        }
        if (this.interstitialAd) {
            this.interstitialAd.show().catch((err: any) => {
                console.warn('[DY-Ad] 插屏展示失败', JSON.stringify(err))
                // 展示失败时重置时间窗口，避免节流误伤下次正常调用
                this.lastInterstitialTime = 0
            });
            this.lastInterstitialTime = now
        }
    }

    // ==================== 分享 ====================

    /** 分享 */
    openShare() {
        if (this.isDouyin()) {
            // @ts-ignore
            tt.shareAppMessage({
                templateId: "3blkgea02ne0ib4f72", // 替换成通过审核的分享ID
                query: "",
                success() {
                    console.log("分享成功");
                },
                fail(e) {
                    console.log("分享失败");
                },
            });
        }
    }

    // ==================== 巨量引擎转化上报 ====================

    /**
     * reportGdtEvent 简易版
     * 作用：向巨量引擎 /api/v2/conversion 上报转化事件
     *
     * @param {string} eventType - 转化事件名称，如 "active" / "register" / "game_addiction"…
     */
    public reportGdtEvent(eventType) {
        const platform = this.getPlatform();

        // 读取 clickid（callback）启动参数
        const launchOpt = platform.getLaunchOptionsSync?.() || {};
        const clickid = launchOpt.query?.clickid;
        console.log("获取到的clickid", clickid);

        // 发送 POST 请求
        platform.request({
        url: "https://analytics.oceanengine.com/api/v2/conversion",
        method: "POST",
        header: { "content-type": "application/json" },
        data: {
            event_type: eventType,
            context: { ad: { callback: clickid } },
            timestamp: Math.floor(Date.now() / 1000), // 秒级时间戳
        },
        success(res) {
            console.log("reportGdtEvent: 上报成功", eventType, res.data);
            // 若需内部埋点，可追加：
            // tt.reportAnalytics('ad_done', {});
        },
        fail(err) {
            console.log("reportGdtEvent: 上报失败", eventType, err.errMsg || err);
        },
        });
    }

    // ==================== 排行榜 ====================

    /**
     * 上报当前关卡分数到抖音 IM 排行榜。
     * 应在通关（resultView initParams isWin）时调用，确保排行榜数据是最新的。
     */
    setStarScore() {
        if (!this.isDouyin()) return;
        let curLevel = App.gameConfig.getCurLevel();
        // value 必须是字符串；用关卡数作为分数，关卡越高排名越靠前
        let value = String(curLevel);
        // @ts-ignore
        tt.setImRankData({
            dataType: 0, // 0 = 数字类型
            value: value,
            priority: 0, // 数字类型不需要权重
            extra: "extra",
            zoneId: 'default',
            success(res: any) {
                console.log('[DY-Rank] setImRankData success', JSON.stringify(res));
            },
            fail(res: any) {
                console.warn('[DY-Rank] setImRankData fail', res.errMsg);
            },
        });
    }

    /**
     * 拉起抖音排行榜面板。
     * 先上报当前分数，再展示排行榜，确保玩家最新成绩出现在榜上。
     * @param cb 排行榜关闭后的回调（可选）
     */
    getByteRankData(cb?: Function) {
        if (!this.isDouyin()) {
            App.ui.showMsgTips("该功能在抖音小程序上可见");
            return;
        }
        // 先上报当前分数，再拉排行榜
        this.setStarScore();
        // @ts-ignore
        tt.getImRankList({
            relationType: "default", // 好友榜 + 总榜都展示
            dataType: 0, // 0 = 数字类型，与 setImRankData 的 dataType 一致
            rankType: "week", // 按周排序
            suffix: "",
            rankTitle: "排行榜",
            zoneId: 'default',
            success(res: any) {
                console.log('[DY-Rank] getImRankList success', JSON.stringify(res));
                if (cb) cb(res);
            },
            fail(res: any) {
                console.warn('[DY-Rank] getImRankList fail', res.errMsg);
                App.ui.showMsgTips("排行榜暂不可用，请稍后再试");
            },
        });
    }

    // ==================== 格子广告 ====================

    //GridSizeType = "medium" | "small" | "large";
    //GridCountType = "one" | "four" | "nine";
    /** 四宫格 banner*/
    private customAdsFour: any = null;
    showCustomAdsFour(){
        if (!this.isDouyin()) return;
        //@ts-ignore
        this.customAdsFour = tt.createGridGamePanel({
            gridCount: "four",
            size: "large",
        });
        this.customAdsFour.show();
    }

    hideCustomAdsFour(){
        if (!this.isDouyin()) return;
        if(!this.customAdsFour)return;
        //@ts-ignore
        this.customAdsFour.hide();
    }
    /** 更多游戏 */
    private customAdsNine: any = null;
    showCustomAdsNine(){
        if (!this.isDouyin()) return;
        //@ts-ignore
        this.customAdsNine = tt.createGridGamePanel({
            gridCount: "nine",
            size: "medium",
        });
        this.customAdsNine.show();
    }

    hideCustomAdsNine(){
        if (!this.isDouyin()) return;
        if(!this.customAdsNine)return;
        //@ts-ignore
        this.customAdsNine.hide();
    }

    /** 单格 banner*/
    private customAdsOne: any = null;
    showCustomAdsOne(){
        if (!this.isDouyin()) return;
        //@ts-ignore
        this.customAdsOne = tt.createGridGamePanel({
            gridCount: "one",
            size: "small",
            position: {
                top: 90,
                left: 280,
            }
        });
        this.customAdsOne.show();
    }

    hideCustomAdsOne(){
        if (!this.isDouyin()) return;
        if(!this.customAdsOne)return;
        //@ts-ignore
        this.customAdsOne.hide();
    }

    // ==================== 登录 ====================

    /**
     * 执行登录操作
     * @returns Promise<void>
     */
    async performLogin() {
        if (!this.isDouyin()) return;
        console.log('执行登录操作:');
        await this.login();
    }
    login() {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            tt.login({
                force: false,
                success: result => {   resolve(""); },
                fail: error => reject(error)
            });
        });
    }
}

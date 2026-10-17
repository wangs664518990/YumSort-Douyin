import { BYTEDANCE, WECHAT } from "cc/env";
import { sys } from "cc";
import { App } from "../framework/DSAppManager";

export class SdkManager {
    public static _instance: SdkManager = null

    public static get instance() {
        if (null == this._instance) {
            this._instance = new SdkManager();
        }
        return this._instance
    }

    // 激励视频
    videoId: string = '1ogultp723s1rsr364'
    private videoAd = null
    // 插屏
    interstitialId: string = '2dmo642nln8c9ip4ll'
    private interstitialAd = null
    // 横幅
    bannerId: string = ''
    private bannerAd = null

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

    // 初始化横幅
    initBannerAd() {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.log('banner ad init...')
            return
        }
        if (this.bannerId == '') {
            return
        }
        let winSize = platform.getSystemInfoSync();
        if (this.bannerAd == null) {
            this.bannerAd = platform.createBannerAd({
                adUnitId: this.bannerId,
                adIntervals: 30,
                style: {
                    height: winSize.windowHeight - 80,
                    left: 0,
                    top: 500,
                    width: winSize.windowWidth
                }
            });
            this.bannerAd.onResize((res: any) => {
                this.bannerAd.style.top = winSize.windowHeight - this.bannerAd.style.realHeight;
                this.bannerAd.style.left = winSize.windowWidth / 2 - this.bannerAd.style.realWidth / 2;
            });
            this.bannerAd.onError((err: any) => {
                console.log('初始化异常', err)
            });
        }
    }

    // 横幅展示
    toggleBannerAd(isShow: boolean) {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.log(`【流量主横幅:${isShow}】`)
            return
        }
        if (this.bannerAd) {
            isShow ? this.bannerAd.show() : this.bannerAd.hide();
        }
    }

    // 初始化插屏
    initInterstitialAd() {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.log('inter ad init...')
            return
        }
        if (this.interstitialId == '') {
            return
        }
        if (this.interstitialAd == null) {
            this.interstitialAd = platform.createInterstitialAd({
                adUnitId: this.interstitialId
            });
            this.interstitialAd.onError((err: any) => {
            });
        }
    }

    // 插屏展示
    showInterstitialAd() {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return
        }
        if(!this.interstitialAd){
            this.initInterstitialAd();
        }

        const platform = this.getPlatform()
        if (!platform) {
            console.log('【流量主插屏】')
            return
        }
        if (this.interstitialAd) {
            this.interstitialAd.show().catch((err: any) => {
            });
        }
    }

    // 初始化激励
    initVideoAd() {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.log('video ad init...')
            return
        }
        if (this.videoId == '') {
            return
        }
        if (this.videoAd == null) {
            this.videoAd = platform.createRewardedVideoAd({
                adUnitId: this.videoId
            });
            this.videoAd.onError((err: any) => {
            });
        }
    }

    // 激励展示
    showVideoAd(success: any, fail?: any) {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            // success && success()
            return
        }
        if(!this.videoAd){
            this.initVideoAd();
        }
        const platform = this.getPlatform()
        if (!platform) {
            console.log('激励模拟成功')
            return success && success('模拟成功，激励奖励已发放')
        }
        if (this.videoAd) {
            App.global.isShowVideoAds = true;
            this.videoAd.offClose();
            this.videoAd.onClose((res: any) => {
                App.global.isShowVideoAds = false;
                this.videoAd.offClose();
                if (res && res.isEnded || res === undefined) {
                    // GlobalFuncHelper.addReward();
                    return success && success('激励奖励已发放')
                } else {
                    return fail && fail('视频播放中断')
                }
            });
            this.videoAd.show().catch(() => {
                this.videoAd.load()
                    .then(() => this.videoAd.show())
                    .catch((err: any) => {
                        console.log('广告展示失败')
                    })
            });
        } else {
            // console.log('激励模拟成功')
            return fail && fail('该功能尚未开放')
        }
    }


    /** 分享 */
    openShare() {
        if (sys.platform == sys.Platform.BYTEDANCE_MINI_GAME) {
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
            timestamp: Date.now(), // 使用当前时间即可
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

    /** 设置指定等级的星数 */
    setStarScore() {
        let cur = App.gameConfig.getCurLevel();
        let score = cur;
        if (sys.platform == sys.Platform.BYTEDANCE_MINI_GAME) {
            // @ts-ignore
            tt.setImRankData({
                dataType: 0, //成绩为数字类型
                value: score + "", //该用户得了999999分
                priority: 0, //dataType为数字类型，不需要权重，直接传0
                extra: "extra",
                zoneId: 'default',
                success(res) {
                    console.log(`setImRankData success res: ${res}`);
                    console.log(JSON.stringify(res));
                },
                fail(res) {
                    console.log(`setImRankData fail res: ${res.errMsg}`);
                },
            });
        }
    }

    getByteRankData(cb: Function) {
        if (sys.platform == sys.Platform.BYTEDANCE_MINI_GAME) {
            //moba游戏自动生成段位榜
            // @ts-ignore
            tt.getImRankList({
                relationType: "default", //好友榜、总榜都展示
                dataType: 0, //只圈选type为枚举类型的数据进行排序
                rankType: "week", //每天凌晨0点更新，只对当天0点到现在写入的数据进行排序
                suffix: "", //为空或不填，一般枚举类型不需要填后缀
                rankTitle: "排行榜", //标题
                zoneId: 'default',
                success(res) {
                    console.log(`getImRankData success res: ${res}`);
                    console.log(JSON.stringify(res));
                },
                fail(res) {
                    console.log(`getImRankData fail res: ${res.errMsg}`);
                },
            });
        }
        else{
            App.ui.showMsgTips("该功能在抖音小程序上可见");
        }
    }

    //GridSizeType = "medium" | "small" | "large";
    //GridCountType = "one" | "four" | "nine";
    /** 四宫格 banner*/
    private customAdsFour: any = null;
    showCustomAdsFour(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        //@ts-ignore
        this.customAdsFour = tt.createGridGamePanel({
            gridCount: "four",
            size: "large",
            // query: {
            //     tt51f42749cef9b2bb02: "age=8&name=往昔寻差异",
            // },
        });
        this.customAdsFour.show();
    }

    hideCustomAdsFour(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        if(!this.customAdsFour)return;
        //@ts-ignore
        this.customAdsFour.hide();
    }
    /** 更多游戏 */
    private customAdsNine: any = null;
    showCustomAdsNine(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        //@ts-ignore
        this.customAdsNine = tt.createGridGamePanel({
            gridCount: "nine",
            size: "medium",
            // query: {
            //     tt51f42749cef9b2bb02: "age=8&name=往昔寻差异",
            // },
        });
        this.customAdsNine.show();
    }

    hideCustomAdsNine(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        if(!this.customAdsNine)return;
        //@ts-ignore
        this.customAdsNine.hide();
    }

    /** 单格 banner*/
    private customAdsOne: any = null;
    showCustomAdsOne(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        //@ts-ignore
        this.customAdsOne = tt.createGridGamePanel({
            gridCount: "one",
            size: "small",
            query: {
                tt51f42749cef9b2bb02: "age=8&name=往昔寻差异",
            },
            position: {
                top: 90,
                left: 280,
            }
        });
        this.customAdsOne.show();
    }

    hideCustomAdsOne(){
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
        if(!this.customAdsOne)return;
        //@ts-ignore
        this.customAdsOne.hide();
    }

    /**
     * 执行登录操作
     * @returns Promise<void>
     */
    async performLogin() {
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME)return;
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

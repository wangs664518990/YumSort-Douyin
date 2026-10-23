import { sys } from "cc";
import { SdkManager } from "../dy/DyManager";
import { KsManager } from "../ks/KsManager";
import { App } from "../framework/DSAppManager";

export class Ads {
    //wx3217a33cf9eb6526
    public bannerAdv = null;//banner广告
    public videoAdv = null;//激励式视频广告
    public interstitialAd = null;//插屏广告
    public customAd = null;//插屏广告

    private bannerId: string = "adunit-7d625f1a128c8df1";// banner广告id
    private videoId: string = "adunit-836dcce9c6d9ede5";// 激励式视频广告id
    private interstitialId: string = "adunit-cc8d1c13a6baa75a";// 插屏r广告id
    private customAdId: string = "adunit-7fd41f723ce235c8";// 格子广告id

    constructor() {
        this.init();
    }

    init() {
        if (KsManager.isKuaishouEnv()) {
            // 快手环境:广告走 ks.* 接口(详见 KsManager)
            console.log('--------------init ks ads-----------------');
            KsManager.instance.initAds();
            return;
        }
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        console.log('--------------init ads-----------------');
        // @ts-ignore
        let winSize = wx.getSystemInfoSync();//获取像素size
        // 创建 Banner 广告实例，提前初始化
        let bannerWidth = 300
        let bannerHeight = 80
        // @ts-ignore
        let bannerAdv = wx.createBannerAd({
            adUnitId: this.bannerId,//传入自己的id，此处为banner广告位ID
            adIntervals: 30,//定时刷新，最低30S
            style: {
                left: (winSize.windowWidth - bannerWidth) / 2,
                top: winSize.windowHeight - bannerHeight,
                width: bannerWidth,
            },
        })
        this.bannerAdv = bannerAdv;
        //重新定banner位置
        bannerAdv.onResize((res) => {
            bannerAdv.style.top = winSize.windowHeight - bannerAdv.style.realHeight - 1;
        })
        // // 在适合的场景显示 Banner 广告
        // bannerAdv.show();//不建议直接显示
        //拉取失败处理
        bannerAdv.onError((err) => {
            console.log(err);
        })

        this.createVideoAds();
        // 创建插屏广告实例，提前初始化
        // @ts-ignore
        if (wx.createInterstitialAd) {
            // @ts-ignore
            let interstitialAd = wx.createInterstitialAd({
                adUnitId: this.interstitialId//传入自己的id，此处为插屏广告位ID
            })
            this.interstitialAd = interstitialAd;
        }
        // @ts-ignore
        let this_phone_Height = wx.getSystemInfoSync().windowHeight;
        // @ts-ignore
        let this_phone_Width = wx.getSystemInfoSync().windowWidth;
        // @ts-ignore
        this.customAd = wx.createCustomAd({
            adUnitId: this.customAdId,
            adIntervals: 31,
            style: {
                left: 0,
                top: this_phone_Height * 0.45,
                width: this_phone_Width,// 用于设置组件宽度，只有部分模板才支持，如矩阵格子模板
                fixed: 70 // fixed 只适用于小程序环境
            }
        });

        this.customAd.onLoad(() => console.log('原生模板广告加载成功'));
        this.customAd.onError(err => console.log(err));
    }

    createVideoAds() {
        //@ts-ignore
        if (KsManager.isKuaishouEnv()) return;
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        console.log('--------------init ads-----------------');

        // this.createBannerAds();
        // @ts-ignore 创建激励视频广告实例，提前初始化
        let videoAdv = wx.createRewardedVideoAd({
            adUnitId: this.videoId//传入自己的id，此处为视频广告位ID
        })
        videoAdv.onError((err) => {
            console.log(err);
        })
        this.videoAdv = videoAdv;
    }


    /** 显示格子广告 */
    showCoustomAd() {
        if (KsManager.isKuaishouEnv()) {
            // 快手暂不支持原生模板/格子广告
            console.log('[Ads] 快手平台不支持格子广告');
            return;
        }
        if (sys.platform != sys.Platform.WECHAT_GAME) return;

        this.customAd && this.customAd.show();
    }

    /** 隐藏格子广告 */
    hideCoustomAd() {
        if (KsManager.isKuaishouEnv()) return;
        this.customAd && this.customAd.hide();
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
    }

    //显示banner广告
    showBannerAds() {
        if (KsManager.isKuaishouEnv()) {
            KsManager.instance.showBannerAds();
            return;
        }
        SdkManager.instance.initBannerAd();
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        // 在适合的场景显示 Banner 广告
        // @ts-ignore
        this.bannerAdv.show();
    }

    // 隐藏banner广告
    hideBannerAds() {
        if (KsManager.isKuaishouEnv()) {
            KsManager.instance.hideBannerAds();
            return;
        }
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        // @ts-ignore
        this.bannerAdv.hide();
    }

    //显示视频广告
    showVideoAds(success:Function, fail?:Function) {
        if(sys.platform == sys.Platform.MOBILE_BROWSER || sys.platform == sys.Platform.DESKTOP_BROWSER){
            success && success();
            return;
        }
        if (KsManager.isKuaishouEnv()) {
            KsManager.instance.showVideoAds(success, fail);
            return;
        }
        SdkManager.instance.initVideoAd();
        SdkManager.instance.showVideoAd(success);
        if (sys.platform != sys.Platform.WECHAT_GAME) {
            return;
        };
        this.createVideoAds();
        // 在适合的场景显示 Video 广告
        // @ts-ignore
        let videoAdv = this.videoAdv;
        // 用户触发广告后，显示激励视频广告
        // @ts-ignore
        videoAdv.show().catch(() => {
            // 失败重试
            // @ts-ignore
            videoAdv.load()
                // @ts-ignore
                .then(() => videoAdv.show())
                .catch(err => {
                    console.log('激励视频 广告显示失败')
                })
        })
        // @ts-ignore
        //拉取异常处理
        videoAdv.onError((err) => {
            console.log(err);
        })
        App.global.isShowVideoAds = true;
        // @ts-ignore
        videoAdv.onClose((res) => {
            if (!videoAdv) return;
            // @ts-ignore
            videoAdv.offClose();//需要清除回调，否则第N次广告会一次性给N个奖励
            //关闭
            App.global.isShowVideoAds = false;
            if (res && res.isEnded || res === undefined) {
                //正常播放结束，需要下发奖励
                success && success();
            } else {
                //播放退出，不下发奖励
            }
            this.videoAdv = null;
        })
    }

    // 显示插件广告
    showInterstitialAds() {
        if (KsManager.isKuaishouEnv()) {
            KsManager.instance.showInterstitialAds();
            return;
        }
        SdkManager.instance.initInterstitialAd();
        SdkManager.instance.showInterstitialAd();
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        let interstitialAd = this.interstitialAd;
        // 在适合的场景显示插屏广告
        if (interstitialAd) {
            // @ts-ignore
            interstitialAd.show().catch((err) => {
                console.error(err)
            })
        }

    }

    /**
     * 显示启动插屏(快手启动位广告)
     * 快手没有开屏广告 API,启动位以插屏实现;
     * 仅快手平台、每次冷启动最多一次,所有用户可见(规则在 KsManager 内实现)。
     * 其他平台不展示。
     */
    showStartupInterstitial() {
        if (KsManager.isKuaishouEnv()) {
            KsManager.instance.showStartupInterstitial();
            return;
        }
        // 非快手平台不展示
    }
}

export let Advertise = new Ads();
import { _decorator, Component, Node, sys } from 'cc';
const { ccclass, property } = _decorator;
import { WxMgr } from '../wx/wxManager';
import { Advertise } from '../wx/advertise';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { DSViewName } from '../framework/DSUiManager';
import { SdkManager } from '../dy/DyManager';
import { KsManager } from '../ks/KsManager';
import { DSEventKey } from '../framework/DSEventManager';

@ccclass('homeView')
export class homeView extends DSBaseView {
    needAnim: boolean = false;
    needMask: boolean = false;
    private lbLife: Node = null;
    private lbTime: Node = null;
    onLoad(): void {
        super.onLoad();
        this.lbLife = this.getNodeByPath("top/heart/lbHeart");
        this.lbTime = this.getNodeByPath("top/heart/lbTime");

        App.event.on(DSEventKey.TimeDown,this.evtTimeDown,this);
        App.event.on(DSEventKey.UpdateLife,this.evtUpdateLife,this);

        this.getNodeByPath("center/moreBtn").active = sys.platform == sys.Platform.BYTEDANCE_MINI_GAME
    }

    /** 初始化参数 */
    initParams(): void {
        App.ui.closeView(DSViewName.loadingView);
        App.ui.closeView(DSViewName.gameView);
        this.evtTimeDown();
        let lv = App.gameConfig.getCurLevel();
        this.setLabelText(this.getNodeByPath("lbLevel"),"第"+lv.toString()+"关");

        this.evtUpdateLife();

        WxMgr.showGameQuan();
        if (KsManager.isKuaishouEnv()) {
            // 快手:启动位展示启动插屏(每次冷启动一次),代替普通启动插屏,避免双弹
            Advertise.showStartupInterstitial();
        } else {
            // 其他平台维持原启动插屏
            Advertise.showInterstitialAds();
        }
        Advertise.showBannerAds();
        Advertise.showCoustomAd();
        SdkManager.instance.showCustomAdsOne();
        SdkManager.instance.showCustomAdsFour();
    }
    /** 更新体力显示 */
    evtUpdateLife(){
        let heart = App.global.getLife();
        this.setLabelText(this.lbLife,`${heart}`);
        this.getNodeByPath("top/heart/lifeBtn").active = heart<5;
    }

    evtTimeDown(){
        let str = App.timer.formatTime(App.timer.TimeLife);
        let life = App.global.getLife();
        if(life>=5){
             str = "已满";
        }   
        this.setLabelText(this.lbTime, str);
    }
    /** 开始游戏 */
    async onClickstartBtn(){
        App.audio.playEffect("click")
        
        let life = App.global.getLife();
        if(life<=0 && !App.global.isTest){
            App.ui.showMsgTips("体力不足");
            await App.global.wait(0.5);
            App.ui.openView(DSViewName.getLifeView);
            return;
        }
        App.ui.openView(DSViewName.gameView);
        App.global.addLife(-1);
    }
    /** 获得体力 */
    onClicklifeBtn(){
        App.audio.playEffect("click")
        App.ui.openView(DSViewName.getLifeView);
    }
    /** 设置 */
    onClicksettingBtn(){
        App.audio.playEffect("click")
        App.ui.openView(DSViewName.settingView);
        App.gameConfig.nextLevel();
    }
    /** 排行榜 */
    onClickrankBtn(){
        App.audio.playEffect("click")
        if (sys.platform == sys.Platform.BYTEDANCE_MINI_GAME) {
            SdkManager.instance.getByteRankData(()=>{});
        }else{
            App.ui.openView(DSViewName.rankView);
        }
    }

    onClickmoreBtn(){
        App.audio.playEffect("click")
        SdkManager.instance.showCustomAdsNine();
    }
}


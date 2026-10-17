import { _decorator } from 'cc';
import { WxMgr } from '../wx/wxManager';
import { Advertise } from '../wx/advertise';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { DSViewName } from '../framework/DSUiManager';
import { DSEventKey } from '../framework/DSEventManager';
import { DSStorageKey } from '../framework/DSStorageManager';
const { ccclass, property } = _decorator;

@ccclass('settingView')
export class settingView extends DSBaseView {
    public enableMask: boolean = true
    onLoad() {
        super.onLoad();
        this.updateOperateStatus();
    }

    updateOperateStatus() {
        this.getNodeByPath('bg/top/btn/btnSound/on').active = App.storage.getBoolean(DSStorageKey.Music_Eff_Status,true);
        this.getNodeByPath('bg/top/btn/btnMusic/on').active = App.storage.getBoolean(DSStorageKey.Music_Status,true);
        this.getNodeByPath('bg/top/btn/btnVibration/on').active = App.storage.getBoolean(DSStorageKey.Zhen_Dong_Status,true);
        this.getNodeByPath('bg/top/btn/btnSound/off').active = !App.storage.getBoolean(DSStorageKey.Music_Eff_Status,true);
        this.getNodeByPath('bg/top/btn/btnMusic/off').active = !App.storage.getBoolean(DSStorageKey.Music_Status,true);
        this.getNodeByPath('bg/top/btn/btnVibration/off').active = !App.storage.getBoolean(DSStorageKey.Zhen_Dong_Status,true);
    }
    initParams() {
        Advertise.showBannerAds();
        this.getNodeByPath("bg/btn").active = !!App.ui.getView(DSViewName.gameView);
    }

    onClickbtnSound() {
        App.audio.playEffect('click');
        App.storage.set(DSStorageKey.Music_Eff_Status, !App.storage.getBoolean(DSStorageKey.Music_Eff_Status))
        this.updateOperateStatus();
    }
    onClickbtnMusic() {
        App.audio.playEffect('click');
        App.storage.set(DSStorageKey.Music_Status, !App.storage.getBoolean(DSStorageKey.Music_Status))
        this.updateOperateStatus();
    }
    onClickbtnVibration() {
        App.audio.playEffect('click');
        App.storage.set(DSStorageKey.Zhen_Dong_Status, !App.storage.getBoolean(DSStorageKey.Zhen_Dong_Status))
        this.updateOperateStatus();
        WxMgr.vibrate();
    }

    onClickcloseBtn() {
        App.audio.playEffect('click');
        // CustomUIManager.getInstance().closeView(ViewName.Single.settingView);
        this.closeSelf();
    }

    onClickhomeBtn() {
        this.onClickcloseBtn();
        App.ui.openView(DSViewName.leaveView);
    }
    onClickcontinueBtn() {
        if(App.global.isTest){
            App.gameConfig.nextLevel();
        }
        this.onClickcloseBtn();
    }
    onClickbtnVideo() {
        this.onClickcloseBtn();
    }

}



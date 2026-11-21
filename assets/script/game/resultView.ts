import { _decorator, Component, Node, sys } from 'cc';
import { WxMgr } from '../wx/wxManager';
import { Advertise } from '../wx/advertise';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { DSViewName } from '../framework/DSUiManager';
import { DSEventKey } from '../framework/DSEventManager';
import { DSPlatform } from '../framework/DSPlatform';
import { TapAntiAddiction } from '../tap/TapAntiAddiction';
import { SdkManager } from '../dy/DyManager';
const { ccclass, property } = _decorator;

@ccclass('resultView')
export class resultView extends DSBaseView {
    onLoad(): void {
        super.onLoad();   
    }
    initParams(isWin:boolean): void {
        Advertise.showInterstitialAds();
        Advertise.showCoustomAd();

        this.getNodeByPath('animNode/content/win').active = isWin;
        this.getNodeByPath('animNode/content/lose').active = !isWin;
        if (isWin) {
            App.gameConfig.nextLevel();
            // 通关后上报分数到抖音排行榜
            SdkManager.instance.setStarScore();
        }
        this.scheduleOnce(() => {
        if (isWin) {
            App.audio.playEffect('win');
        }
        else {
            App.audio.playEffect('lose');
        }
        }, 0.2);
    }


    onClicknextBtn() {
        App.audio.playEffect("click")
        // Tap 渠道:进入下一关前再校验一次(防沉迷可能在局中因时长用尽被置为受限)
        if (DSPlatform.isTap && !TapAntiAddiction.guard()) {
            return;
        }
        App.ui.closeView(DSViewName.resultView);
        App.event.emit(DSEventKey.NextLevel);
    }

    onClickhomeBtn() {
        App.audio.playEffect("click")
        App.ui.openView(DSViewName.homeView);
        App.ui.closeView(DSViewName.resultView);
    }

    onClickreplayBtn() {
        Advertise.showVideoAds(()=>{
            this.closeSelf();
            App.event.emit(DSEventKey.reAlive);
        });
    }

}


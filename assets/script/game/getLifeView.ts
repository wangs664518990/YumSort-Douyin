import { _decorator, Component, Node } from 'cc';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { Advertise } from '../wx/advertise';
const { ccclass, property } = _decorator;

@ccclass('getLifeView')
export class getLifeView extends DSBaseView {
    onClickgotBtn(){
        App.audio.playEffect('click');
        Advertise.showVideoAds(()=>{
            App.global.addLife(1);
            this.closeSelf();
        });
    }
}


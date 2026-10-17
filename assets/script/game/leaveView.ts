import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { Advertise } from '../wx/advertise';
import { DSViewName } from '../framework/DSUiManager';
@ccclass('leaveView')
export class leaveView extends DSBaseView {
    onClicknoBtn(){
        App.audio.playEffect('click');
        this.closeSelf();
    }
    onClickyesBtn(){
        App.audio.playEffect('click');
        this.onClickcloseBtn();
        App.ui.openView(DSViewName.homeView);
    }
}


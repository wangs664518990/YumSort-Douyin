import { _decorator, BaseNode, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { DSViewName } from '../framework/DSUiManager';
import { GameRankView } from '../rank/views/GameRankView';

@ccclass('rankView')
export class rankView extends DSBaseView {
    private friend: Node = null;
    onLoad() {
        super.onLoad();
        this.friend = this.getNodeByPath("rank/friend");
        this.initData();
    }

    initData() {
        console.log("开始了");
        this.friend.active = true;
        this.friend.getComponent(GameRankView).initRankWithData();
    }

    onClickcloseBtn(){
        App.audio.playEffect("click")
        this.closeSelf();
    }

}



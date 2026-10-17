import { _decorator, Component, Node } from 'cc';
import { DSBaseView } from '../framework/DSBaseView';
import { UnLockToolType } from '../framework/DSEnumManager';
const { ccclass, property } = _decorator;

@ccclass('unLockTool')
export class unLockTool extends DSBaseView {
    initParams(type: UnLockToolType): void {
        let icon = this.getNodeByPath("animNode/icon");
        icon.children.forEach((item) => {
            item.active = item.name === type;
        });
    }

    onClickokBtn(){
        this.closeSelf();
    }
}


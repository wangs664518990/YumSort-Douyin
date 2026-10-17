import { _decorator, Component, Node, tween, v3, Vec3 } from 'cc';
import { DSBaseNode } from '../framework/DSBaseNode';
import { App } from '../framework/DSAppManager';
const { ccclass, property } = _decorator;

@ccclass('tipsView')
export class tipsView extends DSBaseNode {
    onLoad() {
        super.onLoad();
        this.node.setPosition(v3());
    }

    setTips(str: string) {
        console.log(str);
        this.setLabelText(this.getNodeByPath('animNode/lb'), str);
    }

    async setCloseFunc(cb: Function) {
        await App.global.wait(2);
        tween(this.node).to(0.5, { position: new Vec3(0, 1000) }).call(() => {
            cb && cb();
        }).start()
    }

    upMove() {
        let pos = this.node.position;
        let v3p = new Vec3(pos.x, pos.y + 100, pos.z);
        this.node.setPosition(v3p);
    }

}


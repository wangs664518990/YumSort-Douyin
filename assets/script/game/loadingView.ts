import { _decorator, AssetManager, Component, Node, Sprite, UITransform } from 'cc';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { DSViewName } from '../framework/DSUiManager';


const { ccclass, property } = _decorator;

@ccclass('loadingView')
export class loadingView extends DSBaseView {
    needAnim: boolean = false;
    needMask: boolean = false;
    private spPro: Node = null;
    private lbPro: Node = null;
    onLoad() {
        super.onLoad();
        this.lbPro = this.getNodeByPath('lbPro');
        this.spPro = this.getNodeByPath('spPro');
        this.setLabelText(this.lbPro, "加载中... 0.00%");
        this.startLoadResources();
    }

    startLoadResources() {
        let url = [
            "./prefab/ui/homeView",
            "./prefab/ui/gameView",
        ];
        App.res.preloadPath(url, (finish: number, total: number, item: AssetManager.RequestItem) => {
            let per = `${(finish / total * 100).toFixed(2)}%`;
            if (this.spPro) {
                let width = 120+(finish/total*586);
                if(width>586)width=586;
                this.spPro.getComponent(UITransform).setContentSize(width, 58);
                this.setLabelText(this.lbPro, "加载中... " + per);
            }
        }, async () => {
            this.scheduleOnce(() => {
                App.ui.openView(DSViewName.homeView);
            }, 1)
        }, async (err) => {
            // 加载出错
        });
    }
}


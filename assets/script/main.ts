import { _decorator, Component, Node } from 'cc';
import { App } from './framework/DSAppManager';
import { DSViewName } from './framework/DSUiManager';
const { ccclass, property } = _decorator;

@ccclass('main')
export class main extends Component {
    start() {
        App.init();
        console.log(`[main] 初始化完成`);
        App.ui.openView(DSViewName.loadingView);
        App.audio.playMusic('background');
    }
}


import { _decorator, Component, Node, tween, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('panzi')
export class panzi extends Component {
    protected onLoad(): void {
        this.node.getComponent(UIOpacity).opacity = 0;
        tween(this.node.getComponent(UIOpacity))
            .to(0.2,{opacity:255})
            .start();
        
    }

    getPosByIndex(index:number){
        return this.node.getChildByName("p"+index).position;
    }
}


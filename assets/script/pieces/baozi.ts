import { _decorator, Component, Node, size, Sprite, SpriteFrame, tween, UIOpacity, UITransform, v3, Vec3 } from 'cc';
import { DSBaseNode } from '../framework/DSBaseNode';
import { App } from '../framework/DSAppManager';
import { DSEventKey } from '../framework/DSEventManager';
const { ccclass, property } = _decorator;

@ccclass('baozi')
export class baozi extends DSBaseNode {
    private isSmall:boolean = false;
    private originPos:Vec3 = v3();
    private originParent:Node = null;
    public posName:string = '';
    public id:number = 0;
    public isEliminate:boolean = false;
    private selectBtn:Node = null;
    public index:number = 0;
    onLoad(){
        super.onLoad();
        this.index = App.global.getIndex();
        this.selectBtn = this.node.getChildByName('selectBtn');
        this.showSelectBtn(false);
        App.event.on(DSEventKey.OnClick_Item, this.onClick_Item, this);
    }
    /** 初始化 */
    initData(id:number,isSmall:boolean = false){
        this.id = id;
        this.isSmall = isSmall;
        if(isSmall){
            this.node.getChildByName('icon').getComponent(UITransform).setContentSize(size(41,38))
        }
        this.loadIcon(id);
        this.setOriginPos(new Vec3(this.node.position.x, this.node.position.y, 0));
        this.setOriginNode(this.node.parent);
    }
    
    setPosName(name:string){
        this.posName = name;
    }
    /** 加载图标 */
    async loadIcon(id:number){
        this.node.getChildByName('icon').scale = v3();
        this.node.getChildByName('icon').getComponent(Sprite).spriteFrame = await App.res.loadCommonAssetSync(`icon/${id}`, SpriteFrame);
        tween(this.node.getChildByName('icon'))
            .to(0.1+Math.random()*0.5, { scale: v3(1,1) }, { easing: 'backOut' })
            .start();
    }
    /** 设置原始位置 */
    setOriginPos(pos:Vec3){
        this.originPos = pos;
    }
    /** 设置原始父节点 */
    setOriginNode(parent:Node){
        this.originParent = parent;
    }
    /** 销毁 */
    onDestroy(): void {
        App.event.offTarget(this);
    }
    /** 点击物品 */
    onClick_Item(pos:Vec3){
        if(this.isSmall || this.isEliminate) return;
        let p = this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(pos);
        let dis = Vec3.distance(p, this.node.position);
        if(dis<=50){
            App.audio.playEffect('select');
            App.event.emit(DSEventKey.SelectedTarget, this);
        }
    }
    /** 回到原始位置 */
    backToOrigin(){
        this.node.parent = this.originParent;
        this.node.setPosition(this.originPos);
    }
    /** 显示大物品 */
    showBig(){
        tween(this.node.getChildByName('icon').getComponent(UITransform))
            .to(0.2, { contentSize: size(89,84) }, { easing: 'backOut' })
            .call(()=>{
                this.isSmall = false;
            })
            .start();
    }
    /** 刷新 */
    refresh(id:number){
        this.id = id;
        tween(this.node.getComponent(UIOpacity))
            .to(0.2, { opacity: 0 })
            .call(()=>{
                this.loadIcon(id);
                tween(this.node.getComponent(UIOpacity))
                    .to(0.2, { opacity: 255 })
                    .start();
            })
            .start();
    }
    private callback:Function = null;
    /** 使用bigTips道具的时候 点击选择按钮 */
    onClickselectBtn(){
        App.audio.playEffect('click');
        this.callback && this.callback(this);
    }
    /** 使用bigTips道具的时候 显示选择按钮 */
    showSelectBtn(bool:boolean,callback?:Function){
        this.selectBtn.active = bool;
        this.callback = callback;
    }
}


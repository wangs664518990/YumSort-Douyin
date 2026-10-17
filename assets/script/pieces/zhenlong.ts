import { _decorator, Component, instantiate, Node, Sprite, SpriteFrame, tween, UIOpacity, UITransform, v3, Vec3 } from 'cc';
import { DSBaseNode } from '../framework/DSBaseNode';
import { BoxType, IBoxData } from '../framework/DSEnumManager';
import { App } from '../framework/DSAppManager';
import { Pieces } from '../framework/DSUiManager';
import { baozi } from './baozi';
import { DSEventKey } from '../framework/DSEventManager';
import { Advertise } from '../wx/advertise';
const { ccclass, property } = _decorator;

@ccclass('zhenlong')
export class zhenlong extends DSBaseNode {
    /** 物品节点 */
    private itemNode:Node = null;
    private small:Node = null;
    /** 箱子数据 */
    data:IBoxData;
    private list:string[][] = [];
    private posList:Vec3[] = [];
    private ads:Node = null;
    private hidden:Node = null;
    onLoad(){
        super.onLoad();
        this.itemNode = this.getNodeByPath("item");
        this.small = this.getNodeByPath("small");
        this.ads = this.getNodeByPath("ads");
        this.ads.active = false;
        this.hidden = this.getNodeByPath("hidden");
        this.hidden.active = false;
        this.small.children.forEach((node)=>{
            node.active = false;
        })
        this.small.active = false;
        for(let i = 0; i<3;i++){
            this.posList.push(v3(this.node.getChildByName(`p${i}`).position.x,this.node.getChildByName(`p${i}`).position.y,0));
        }
    }

    addEvents(): void {
        App.event.on(DSEventKey.AddSmaillToTop, this.onAddSmaillToTop, this);
    }

    /** 初始化数据 */
    async initData(data:IBoxData){
        this.data = data;
        this.initLayout()
        this.ads.active = data.BoxType == BoxType.Ads;
        this.hidden.active = data.BoxType == BoxType.Hidden;
        if(data.BoxType == BoxType.Hidden){
            let id = data.BoxTypeConfig.split("x")[1]
            this.hidden.getChildByName("icon").getComponent(Sprite).spriteFrame = await App.res.loadCommonAssetSync(`icon/${id}`, SpriteFrame);
            this.small.active = false;
        }
    }
    /** 初始化布局 */
    async initLayout(){
        let list = this.data.ItemData;
        for(let i=0;i<list.length;i++){
            this.list.push(list[i].split('_'));
        }
        for(let i = 0; i<this.list.length; i++){
            let itemList = this.list[i];
            if(i == 0){
                for(let j = 0; j<itemList.length; j++){
                    let id = +itemList[j];
                    if(id == 0)continue;
                    let itemNode = await this.loadBaozi(id,j);
                    itemNode.parent = this.itemNode;
                    itemNode.getComponent(baozi).initData(id);
                    itemNode.getComponent(baozi).setPosName(`p${j}`);
                }
            }else{
                this.small.active = true;
                let smallNode = this.small.getChildByName((i-1).toString());
                smallNode.active = true;
                for(let j = 0; j<itemList.length; j++){
                    let id = +itemList[j];
                    if(id == 0)continue;
                    let itemNode = await this.loadBaozi(id,j);
                    itemNode.parent = smallNode.getChildByName("item");
                    let pos = smallNode.getChildByName(`p${j+1}`).position;
                    itemNode.setPosition(pos);
                    itemNode.getComponent(baozi).initData(id,true);
                    itemNode.getComponent(baozi).setPosName(`p${j}`);
                }
            }
        }
        if(this.data.BoxType == BoxType.Hidden){
            this.small.active = false;
        }
    }
    /** 新增物品 */
    onAddNewBaozi(bz:baozi){
        if(this.itemNode.children.length >= 3)return false;
        if(this.ads.active){
            // App.ui.showMsgTips("请先解锁");
            return false;
        }
        if(this.hidden.active)return false;

        let p = this.node.getComponent(UITransform).convertToNodeSpaceAR(bz.node.worldPosition);
        let dis = Vec3.distance(p,this.itemNode.position);
        if(dis<120){
            bz.node.parent = this.itemNode;
            for(let i = 0; i<this.itemNode.children.length;i++){
                let itemNode = this.itemNode.children[i];
                itemNode.setPosition(this.posList[i]);
                itemNode.getComponent(baozi).setOriginNode(this.itemNode);
                itemNode.getComponent(baozi).setOriginPos(this.posList[i]);
            }
            return true;
        }
        return false;
    }
    /** 将小盘子中的食物添加到盘子 */
    onAddSmaillToTop(){
        this.clearEmptyPaizi();
        if(this.itemNode.children.length > 0)return;
        if(!this.small.active)return;
        let len = this.small.children.length;
        let list = [];
        for(let i = len-1;i>=0;i--){
            let smallNode = this.small.getChildByName(i.toString());
            if(smallNode.active){
                if(smallNode.children.length == 0){
                    smallNode.active = false;
                    continue;
                }
                App.audio.playEffect('merge2');
                let itemNode = smallNode.getChildByName("item");
                if(itemNode.children.length == 0)continue;
                for(let j = 0; j<itemNode.children.length; j++){
                    let item = itemNode.children[j];
                    list.push(item);
                }
                tween(smallNode.getComponent(UIOpacity))
                    .to(0.3, { opacity: 0 })
                    .call(()=>{{}
                        smallNode.active = false;
                    })
                    .start();
                break;
            }
        }
        for(let i = 0; i<list.length;i++){
            let item = list[i];
            item.parent = this.itemNode;
            let bz = item.getComponent(baozi);
            bz.showBig();
            bz.setOriginNode(this.itemNode);
            bz.setOriginPos(this.posList[i]);
            tween(item)
                .to(0.3, { position: this.posList[i] }, { easing: "backOut" })
                .start();
        }
    }
    /** 清除空小盘子 */
    private clearEmptyPaizi(){
        if(!this.small.active)return;
        let len = this.small.children.length;
        for(let i = len-1;i>=0;i--){
            let smallNode = this.small.getChildByName(i.toString());
            if(smallNode.active){
                let itemNode = smallNode.getChildByName("item");
                if(itemNode.children.length == 0){
                    tween(smallNode.getComponent(UIOpacity))
                    .to(0.3, { opacity: 0 })
                    .call(()=>{{}
                        smallNode.active = false;
                    })
                    .start();
                }
            }
        }
    }
    /** 检查目标合成解锁 */
    checkUnlockHidden(id:number){
        if(!this.hidden.active)return;
        let id1 = this.data.BoxTypeConfig.split("x")[1]
        if(id == +id1){
            tween(this.hidden.getComponent(UIOpacity))
                .to(0.5, { opacity: 0 })
                .call(()=>{
                    this.small.active = true;
                    this.hidden.active = false;
                })
                .start();
        }
    }
    /** 检查消除 */
    checkEliminate(){
        if(this.itemNode.children.length < 3)return null;
        let list = this.itemNode.children;
        for(let i = 0; i<list.length;i++){
            let item = list[i];
            let bz = item.getComponent(baozi);
            if(bz.isEliminate){
                return null;
            }
        }
        
        let id = list[0].getComponent(baozi).id;
        let ida2 = list[1].getComponent(baozi).id;
        let ida3 = list[2].getComponent(baozi).id;
        if(id == ida2 && id == ida3){
            for(let i = 0; i<list.length;i++){
                let item = list[i];
                let bz = item.getComponent(baozi);
                bz.isEliminate = true;
            }
            App.event.emit(DSEventKey.StartEliminate,this);
            return id;
        }
        return null;
    }
    /** 获取当前消除的物品列表 */
    getCurEliminateItemList(){
        let list = [];
        for(let i = 0; i<this.itemNode.children.length;i++){
            let item = this.itemNode.children[i];
            list.push(item);
        }
        return list;
    }

    /** 加载物品 */
    async loadBaozi(id:number,idx:number){
        let baoziPrefab = await App.res.loadPrefabAsync(Pieces.baozi);
        let itemNode = instantiate(baoziPrefab);
        let pos = this.node.getChildByName(`p${idx}`).position;
        itemNode.setPosition(pos);
        return itemNode;
    }
    isLocked(){
        if(this.ads.active)return true;
        if(this.hidden.active)return true;
        return false;
    }

    onClickadsBtn(){
        App.audio.playEffect("click");
        Advertise.showVideoAds(()=>{
            tween(this.ads.getComponent(UIOpacity))
                .to(0.5, { opacity: 0 })
                .call(()=>{
                    this.ads.active = false;
                })
                .start();
        });
    }

    /** 获取所有小盘子中的物品 */
    getAllFoodListbaozi(){
        let list = this.getCurEliminateItemList();
        let len = this.small.children.length;
        for(let i = 0; i<len;i++){
            let smallNode = this.small.getChildByName(i.toString());
            let itemNode = smallNode.getChildByName("item");
            if(itemNode.children.length == 0)continue;
            for(let j = 0; j<itemNode.children.length; j++){
                let item = itemNode.children[j];
                list.push(item);
            }
        }
        return list;
    }

    /** 刷新 */
    refresh(){
        if(this.isLocked())return;
        let list = this.getCurEliminateItemList();
        let len = this.small.children.length;
        for(let i = 0; i<len;i++){
            let smallNode = this.small.getChildByName(i.toString());
            if(smallNode.active){
                let itemNode = smallNode.getChildByName("item");
                if(itemNode.children.length == 0)continue;
                for(let j = 0; j<itemNode.children.length; j++){
                    let item = itemNode.children[j];
                    list.push(item);
                }
            }
        }
        let idList = [];
        for(let i = 0; i<list.length;i++){
            let item = list[i];
            let bz = item.getComponent(baozi);
            idList.push(bz.id);
        }
        idList.sort(()=>{return Math.random()-0.5});

        for(let i = 0; i<idList.length;i++){
            let id = idList[i];
            let item = list[i];
            item.getComponent(baozi).refresh(id);
        }
    }
}


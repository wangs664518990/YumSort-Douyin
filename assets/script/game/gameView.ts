import { _decorator, Component, EventTouch, instantiate, Node, tween, UIOpacity, UITransform, v3, warn } from 'cc';
import { DSBaseView } from '../framework/DSBaseView';
import { App } from '../framework/DSAppManager';
import { ILevelConfig, UnLockToolType } from '../framework/DSEnumManager';
import { DSViewName, Pieces } from '../framework/DSUiManager';
import { zhenlong } from '../pieces/zhenlong';
import { DSEventKey } from '../framework/DSEventManager';
import { baozi } from '../pieces/baozi';
import { panzi } from '../pieces/panzi';
import { Advertise } from '../wx/advertise';
import { GameUtils } from '../rank/utils/GameUtils';
import { WxMgr } from '../wx/wxManager';
const { ccclass, property } = _decorator;

@ccclass('gameView')
export class gameView extends DSBaseView {
    needMask: boolean = false;
    needAnim: boolean = false;
    private data:ILevelConfig = null;
    private center:Node = null;
    private maskNode:Node = null;
    private selectedTarget:baozi = null;
    private zhenlList:zhenlong[] = [];
    private lbLevel:Node = null;
    private lbTime:Node = null;
    private lbTarget:Node = null;
    private freeze:Node = null;
    private curCount:number = 0;
    private isStart:boolean = false;
    private isGameOver:boolean = false;
    private ConstLevelTime:number = 0;
    onLoad(){
        super.onLoad();
        this.center = this.getNodeByPath("center");
        this.lbLevel = this.getNodeByPath("top/lbLevel");
        this.lbTime = this.getNodeByPath("top/lbTime");
        this.lbTarget = this.getNodeByPath("top/lbTarget");
        this.maskNode = this.getNodeByPath("maskNode");
        this.freeze = this.getNodeByPath("freeze");
        this.maskNode.active = false;
        this.freeze.active = false;

        this.node.on(Node.EventType.TOUCH_END,this.onTouchEnd,this);
        this.node.on(Node.EventType.TOUCH_START,this.onTouchStart,this);
        this.node.on(Node.EventType.TOUCH_MOVE,this.onTouchMove,this);
    }
    addEvents(){
        App.event.on(DSEventKey.SelectedTarget,this.onSelectedTarget,this);
        App.event.on(DSEventKey.StartEliminate,this.onStartEliminate,this);
        App.event.on(DSEventKey.TimeDown,this.onTimeDown,this);
        App.event.on(DSEventKey.NextLevel,this.onNextLevel,this);
        App.event.on(DSEventKey.reAlive,this.onReAlive,this);
    }
    
    async initParams(params?: any): Promise<void> {
        App.ui.closeView(DSViewName.homeView);
        this.getNodeByPath("guild").active = App.gameConfig.getCurLevel() == 1;
        await this.initData()
        this.initLayout();
        Advertise.hideBannerAds();
        Advertise.hideCoustomAd();
    }

    /** 刷新目标进度 */
    refreshTargetProgress(){
        this.setLabelText(this.lbTarget,`${this.curCount}/${this.data.Dish}`);
        if(+this.curCount == +this.data.Dish){
            this.isGameOver = true;
            App.ui.openView(DSViewName.resultView,true);
        }
    }
    /** 刷新时间 */
    onTimeDown(){
        if(!this.isValid)return;
        if(App.global.isShowVideoAds) return;
        if(this.freeze.active) return;
        if(!this.isStart) return;
        if(this.isGameOver) return;
        this.setLabelText(this.lbTime,App.timer.formatTime(this.ConstLevelTime));
        this.ConstLevelTime--;
        if(this.ConstLevelTime <= 0){
            this.isGameOver = true; 
            App.ui.openView(DSViewName.resultView,false);
        }
    }
    /** 初始化数据 */
    async initData(): Promise<void> {
        let curLevel = App.gameConfig.getCurLevel();
        let levelConfig:ILevelConfig = await App.gameConfig.loadLevelConfig(curLevel);
        this.data = levelConfig;

        this.setLabelText(this.lbLevel,`第${curLevel}关`);
        let time = App.timer.formatTime(+this.data.Time);
        this.setLabelText(this.lbTime,time);
        this.refreshTargetProgress();

        this.getNodeByPath("bottom/tipsBtn/lock").active = curLevel<4 && !App.global.isTest;
        this.getNodeByPath("bottom/tipsBtn/video").active = curLevel>=4 && !App.global.isTest;
        
        this.getNodeByPath("bottom/refreshBtn/lock").active = curLevel<6 && !App.global.isTest;
        this.getNodeByPath("bottom/refreshBtn/video").active = curLevel>=6 && !App.global.isTest;

        this.getNodeByPath("bottom/bigTipsBtn/lock").active = curLevel<8 && !App.global.isTest;
        this.getNodeByPath("bottom/bigTipsBtn/video").active = curLevel>=8 && !App.global.isTest;

        this.getNodeByPath("bottom/freezeBtn/lock").active = curLevel<12 && !App.global.isTest;
        this.getNodeByPath("bottom/freezeBtn/video").active = curLevel>=12 && !App.global.isTest;

        this.scheduleOnce(()=>{
            switch(curLevel){
                case 4:
                    App.ui.openView(DSViewName.unLockTool,UnLockToolType.tips);
                    break;
                case 6:
                    App.ui.openView(DSViewName.unLockTool,UnLockToolType.refresh);
                    break;
                case 8:
                    App.ui.openView(DSViewName.unLockTool,UnLockToolType.bigTips);
                    break;
                case 12:
                    App.ui.openView(DSViewName.unLockTool,UnLockToolType.freeze);
                    break;
                default:
                    break;
            }
        },1);
    }
    /** 初始化布局 */
    async initLayout(): Promise<void> {
        if(!this.data){
            warn('gameView initLayout data is null');
            return;
        }
        let gapx = 248;
        let gapy = 248;
        let bottomDis = this.getBottomDistance();
        for(let i = 0; i<this.data.Box; i++){
            let zhenl = await App.res.loadPrefabAsync(Pieces.zhenlong);
            let zhenlNode = instantiate(zhenl);
            let rans = zhenlNode.getComponent(UITransform)
            zhenlNode.parent = this.center;
            let xx = gapx*(i%3) - gapx/2 - rans.width/2;
            let yy = gapy*(Math.floor(i/3))-gapy/2 - rans.height/2-bottomDis;
            if(this.data.Box%3 !=0 && i == this.data.Box-1){
                xx = gapx*((i+1)%3) - gapx/2 - rans.width/2;
            }
            zhenlNode.setPosition(xx, yy, 0);
            let zhenlComponent = zhenlNode.getComponent(zhenlong);
            zhenlComponent.initData(this.data.BoxData[i]);
            this.zhenlList.push(zhenlComponent);
        }
    }
    /** 获取底部距离 */
    getBottomDistance(){
        if(this.data.Box<=6){
            return 0;
        }
        else if(this.data.Box> 6 && this.data.Box == 9){
            return 100;
        }else{
            return 200;
        }
    }

    onTouchStart(event:EventTouch){
        if(this.isBigTipsBusy||this.selectedTarget) return;
        let location = event.getUILocation();
        App.event.emit(DSEventKey.OnClick_Item, v3(location.x,location.y,0));
    }
    onTouchEnd(event:EventTouch){
        if(this.isBigTipsBusy||!this.selectedTarget)return;
        App.audio.playEffect('selectin');
        let bool = false;
        let idx = 0;
        for(let i = 0; i<this.zhenlList.length;i++){
            bool = this.zhenlList[i].onAddNewBaozi(this.selectedTarget);
            if(bool)break;
        }
        if(!bool){
            this.selectedTarget.backToOrigin();
        }else{
            if(!this.isStart){
                this.isStart = true;
                this.ConstLevelTime = +this.data.Time;
            }
            App.event.emit(DSEventKey.AddSmaillToTop);
            this.checkEliminate();
        }
        this.selectedTarget = null;
    }
    onTouchMove(event:EventTouch){
        if(this.isBigTipsBusy||!this.selectedTarget)return;
        let location = event.getUILocation();
        let p = this.center.getComponent(UITransform).convertToNodeSpaceAR(v3(location.x,location.y,0));
        this.selectedTarget.node.setPosition(p);
    }

    /** 检查消除 */
    checkEliminate(id1:number=null){
        let id = id1;
        for(let i = 0; i<this.zhenlList.length;i++){
            if(!id){
                id = this.zhenlList[i].checkEliminate();
            }
        }
        if(id){
            for(let i = 0; i<this.zhenlList.length;i++){
                this.zhenlList[i].checkUnlockHidden(id);
            }
        }
    }
    /** 开始消除 */
    async onStartEliminate(zhenl:zhenlong,list?:Node[],onComplete?:Function){
        WxMgr.vibrate(false);
        let dia = this.getNodeByPath("top/dia")
        let die = instantiate(dia);
        die.parent = this.center;
        die.active = true;
        let pos2 = v3(650,500);
        let pos3 = v3(450,500);
        die.setPosition(pos2);
        tween(die)
            .to(0.3, { position: pos3 }, { easing: "backOut" })
            .start();
        
        let pz = await App.res.loadPrefabAsync(Pieces.panzi);
        let pzNode = instantiate(pz);
        pzNode.parent = this.center;
        let pos = v3();
        if(!list){
            pos = v3(zhenl.node.position.x,zhenl.node.position.y+150,0);
        }
        pzNode.setPosition(pos);
        await App.global.wait(0.2);
        let itemList = list || zhenl.getCurEliminateItemList();
        let count = 0;
        App.audio.playEffect('merge1');
        let moveBack= ()=>{
            let pos = die.getComponent(UITransform).convertToNodeSpaceAR(pzNode.worldPosition);
            pzNode.parent = die
            pzNode.setPosition(pos);
            let t1 = tween(pzNode)
                .to(0.3, { position: v3(-170) }, { easing: 'sineOut' })
            let t2 =tween(pzNode)
                .to(0.3, { scale: v3(0.5,0.5) }, { easing: 'sineOut' })
            tween(pzNode).parallel(t1,t2).call(()=>{
                App.event.emit(DSEventKey.AddSmaillToTop);
                this.curCount++;
                this.refreshTargetProgress();
                this.checkEliminate(itemList[0].getComponent(baozi).id);
                onComplete && onComplete();
                tween(die)
                    .to(0.3, { position: pos2 }, { easing: 'backIn' })
                    .call(()=>{
                        die.destroy();
                    })
                    .start();
            }).start();
            
        }

        for(let i = 0; i<itemList.length;i++){
            let item = itemList[i];
            let p = pzNode.getComponent(UITransform).convertToNodeSpaceAR(item.worldPosition);
            item.parent = pzNode;
            item.getComponent(baozi).showBig();
            item.setPosition(p);
            await App.global.wait(0.1);
            let pos = pzNode.getComponent(panzi).getPosByIndex(i);
            tween(item)
                .to(0.3, { position: pos }, { easing: "backOut" })
                .call(()=>{
                    count++;
                    if(count == itemList.length){
                        moveBack();
                    }
                })
                .start();
        }
    }

    /** 选中目标 */
    onSelectedTarget(target:baozi){
        if(this.isBigTipsBusy || this.selectedTarget) return;
        this.selectedTarget = target;
        let pos = target.node.worldPosition;
        let p = this.center.getComponent(UITransform).convertToNodeSpaceAR(pos);
        this.selectedTarget.node.parent = this.center;
        this.selectedTarget.node.setPosition(p);
    }

    onClicksetBtn(){
        App.audio.playEffect('click');
        // App.gameConfig.nextLevel();
        // this.clearData();
        // this.initParams();
        App.ui.openView(DSViewName.settingView);
    }

    onClickbackBtn(){
        App.audio.playEffect('click');
        App.ui.openView(DSViewName.leaveView);
    }

    /** 下一关 */
    onNextLevel(){
        this.clearData();
        this.initParams();
    }
    /** 重新开始 */
    onReAlive(){
        this.ConstLevelTime = 100;
        this.onTimeDown();
        this.isGameOver = false;
    }

    /** 刷新 */
    onClickrefreshBtn(){
        App.audio.playEffect('click');
        if(App.gameConfig.getCurLevel()<6&&!App.global.isTest){
            App.ui.showMsgTips("第6关解锁");
            return;
        }
        Advertise.showVideoAds(()=>{
            for(let i = 0; i<this.zhenlList.length;i++){
                let zhenl = this.zhenlList[i];
                zhenl.refresh();
            }
        });
    }

    /** 大提示 选择一种食物进行消除*/
    onClickbigTipsBtn(){
        if(this.isBigTipsBusy || this.selectedTarget) return;
        App.audio.playEffect('click');
        if(App.gameConfig.getCurLevel()<8&&!App.global.isTest){
            App.ui.showMsgTips("第8关解锁");
            return;
        }
        Advertise.showVideoAds(()=>{
            this.handleBigTipsBtn();
        })
    }

    private handleBigTipsBtn(){
        if(this.isBigTipsBusy) return;
        let topList:Node[] = [];
        for(let i = 0; i < this.zhenlList.length; i++){
            let zhenl = this.zhenlList[i];
            if(zhenl.isLocked()) continue;
            topList.push(...zhenl.getCurEliminateItemList());
        }
        if(topList.length == 0) return;
        this.isBigTipsBusy = true;
        this.maskNode.active = true;
        let used = false;
        let callback = (bz:baozi)=>{
            if(used) return;
            used = true;
            this.eliminateSelectedTarget(bz, topList);
        };
        for(let i = 0; i < topList.length; i++){
            let item = topList[i];
            let pos = this.maskNode.getComponent(UITransform).convertToNodeSpaceAR(item.worldPosition);
            item.parent = this.maskNode;
            item.setPosition(pos);
            item.getComponent(baozi).showSelectBtn(true, callback);
        }
    }
    

    /** bigtips提示道具 消除指定的目标 */
    private eliminateSelectedTarget(bz:baozi,topList:Node[]){
        let listAll = [].concat(topList);
        for(let i = 0; i<this.zhenlList.length;i++){
            let zhenl = this.zhenlList[i];
            let list = zhenl.getAllFoodListbaozi();
            listAll.push(...list);
        }
        let tempList:Node[] = [bz.node];
        for(let i = 0; i<listAll.length;i++){
            let item = listAll[i];
            let bazi = item.getComponent(baozi);
            if(bazi.index == bz.index)continue;
            if(bazi.isEliminate)continue;
            if(bazi.id == bz.id){
                tempList.push(item);
                if(tempList.length >= 3)break;
            }
        }
        
        if(tempList.length>=3){
            let temp = tempList.splice(0,3);
            for(let i = 0; i<topList.length;i++){
                let item = topList[i];
                let bazi = item.getComponent(baozi);
                bazi.showSelectBtn(false);
                if(temp.indexOf(item) >= 0) continue;
                bazi.backToOrigin();
            }
            for(let i = 0; i<temp.length; i++){
                temp[i].getComponent(baozi).isEliminate = true;
            }
            this.maskNode.active = false;
            this.onStartEliminate(null,temp,()=>{
                this.isBigTipsBusy = false;
            });
        }else{ 
            for(let i = 0; i<topList.length; i++){
                let bazi = topList[i].getComponent(baozi);
                bazi.showSelectBtn(false);
                bazi.backToOrigin();
            }
            this.maskNode.active = false;
            this.isBigTipsBusy = false;
        }
    }

    /** 提示 只查找上面一层是否有可以消除的*/
    onClicktipsBtn(){
        App.audio.playEffect('click');
        if(App.gameConfig.getCurLevel()<4&&!App.global.isTest){
            App.ui.showMsgTips("第4关解锁");
            return;
        }
        let spObj = {};
        for(let i = 0; i<this.zhenlList.length;i++){
            let zhenl = this.zhenlList[i];
            if(zhenl.isLocked())continue;
            let list = zhenl.getCurEliminateItemList();
            for(let j = 0; j<list.length;j++){
                let item = list[j].getComponent(baozi);
                if(item.isEliminate)continue;
                if(!spObj[item.id]){
                    spObj[item.id] = [item.node];
                }else{
                    spObj[item.id].push(item.node);
                }
            }
        }
        let isHave:boolean = false;
        for(let key in spObj){
            let itemList = spObj[key];
            if(itemList.length == 3){
                isHave = true;
                break;
            }
        }
        if(!isHave){
            App.ui.showMsgTips("没有可以合成的对象")
            return;
        }
        Advertise.showVideoAds(()=>{
            for(let key in spObj){
                let itemList = spObj[key];
                if(itemList.length == 3){
                    for(let i = 0; i<itemList.length;i++){
                        let item = itemList[i];
                        item.isEliminate = true;
                    }
                    this.onStartEliminate(null,itemList);
                    break;
                }
            }
        });
    }
    onClickfreezeBtn(){
        App.audio.playEffect('click');
        if(App.gameConfig.getCurLevel()<12&&!App.global.isTest){
            App.ui.showMsgTips("第12关解锁");
            return;
        }
        if(this.freeze.active) return;
        Advertise.showVideoAds(async ()=>{
            this.freeze.active = true;
            this.freeze.getComponent(UIOpacity).opacity = 0;
            tween(this.freeze.getComponent(UIOpacity)).to(0.5,{opacity:255}).start();
            await App.global.wait(30);
            if(!this.isValid)return;
            this.freeze.active = false;
        });
    }

    /** 清除数据 */
    clearData(){
        this.center.children.forEach((node) => {
            node.destroy();
        });
        this.zhenlList = [];
        this.selectedTarget = null;
        this.curCount = 0;
        this.isStart = false;
        this.isGameOver = false;
        this.maskNode.active = false;
        this.freeze.active = false;
        this.isBigTipsBusy = false;
    }
    private isBigTipsBusy:boolean = false;

}

 
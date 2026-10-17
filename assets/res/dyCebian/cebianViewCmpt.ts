import { _decorator, Component, Label, Node, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('cebianViewCmpt')
export class cebianViewCmpt extends Component {

    @property(Node)
    private giftButton: Node = null;
    @property(Label)
    private enterLabel: Label = null;
    /* *************************** dy ****************************** */
    isShowLeft = null;
    protected onEnable(): void {
        let that = this;
        if (sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            this.giftButton.active = false;
            return
        }
        // @ts-ignore
        tt.onShow((res) => {
            //判断是否从侧边栏进入
            that.isShowLeft = (res.launch_from == 'homepage' && res.location == 'sidebar_card');
            console.log("that.isShowLeft================================", that.isShowLeft)
            if (that.isShowLeft) {
                //此处可以直接操作领取红包
                //...写下你的红包领取逻辑
                let oldDay = localStorage.getItem("oldDay");

                if (!oldDay) {
                    that.enterLabel.string = "领取奖励"
                } else {
                    let isSameDay = that.isSameDay(parseInt(oldDay), new Date().valueOf());
                    if (isSameDay) {
                        that.enterLabel.string = "领取奖励"
                    } else {
                        that.enterLabel.string = "入口有奖"
                    }
                }
            } else {
                that.setRewardLabel()
            }
        });
        // @ts-ignore
        //判断用户手机是否具备侧边
        tt.checkScene({
            scene: "sidebar",
            success: (res) => {
                //具备时更新状态
                that.isShowLeft = true;
                that.giftButton.active = true;

                return;
            },
            fail: (res) => {
                //隐藏按钮，显示不支持提示
                that.giftButton.active = false;
            }
        });

        this.setRewardLabel()
    }

    private setRewardLabel() {
        let that = this;

        let oldDay = localStorage.getItem("oldDay");
        if (!oldDay) {
            that.enterLabel.string = "入口有奖"
        } else {
            let isSameDay = that.isSameDay(parseInt(oldDay), new Date().valueOf());
            if (isSameDay) {
                that.enterLabel.string = "领取奖励"
            } else {
                that.enterLabel.string = "入口有奖"
            }
        }
    }

    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    /************************** 侧边栏进入领取奖励，这里给玩家发进入侧边栏的奖励，如：50金币 ***************************/
    private getReward() {
        localStorage.setItem("oldDay", new Date().valueOf() + "");
        // GlobalFuncHelper.setGold(50);
        // let str = +this.lbGold.string + 50;
        // this.lbGold.string = str + "";
        
    }

    private isSameDay(startTime, endTime) {
        const startTimeMs = new Date(startTime).setHours(0, 0, 0, 0);
        const endTimeMs = new Date(endTime).setHours(0, 0, 0, 0);
        return startTimeMs === endTimeMs ? true : false
    }

    /**
     * 打开侧边栏
     */
    onClick_goBtn() {
        let that = this;
        // @ts-ignore
        tt.navigateToScene({
            scene: "sidebar",
            success: (res) => {
                console.log("侧边栏打开成功");
                that.showContent(false);
            },
            fail: (res) => {
                console.log("侧边栏打开失败: ", res);
            },
        });
    }

    /**
     * 关闭侧边栏
     */
    onClick_closeBtn() {
        this.showContent(false);
    }

    onClick_giftButton(){
        let that = this;
        let oldDay = localStorage.getItem("oldDay");
        let isSameDay = this.isSameDay(parseInt(oldDay), new Date().valueOf())
        console.log("isSameDay=======>", isSameDay)
        if (isSameDay) {
            // App.view.showMsgTips("请明日再领取")
            return;
        }

        if (this.enterLabel.string == "领取奖励") {
            this.getReward()
            return;
        }

        this.showContent(true);
    }

    showContent(bool:boolean){
        this.node.getChildByName("content").active = bool;
    }
}



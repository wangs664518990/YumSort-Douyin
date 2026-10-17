import { _decorator, Component, Label, Node, TWO_PI } from 'cc';
import { GameUtils } from '../utils/GameUtils';
import { WXUserPostMsgKey } from '../consts/GameConsts';
const { ccclass, property } = _decorator;

@ccclass('GameRankView')
export class GameRankView extends Component {
    start() {
        this._initUIData();
    }

    /**
     * @Description: 初始化排行界面
     * @Date: 2024-07-17 18:09:15
     * @Author: GFanStudio-LeeSir-JYJ add
     * @return {*}
     */
    public initRankWithData(type?: number) {
        // let titleStr = `微信好友排行榜`;

        // this._type = type;
        // if (type == 1) {
        //     titleStr = `默认样式微信好友排行榜`;
        // } else if (type == 2) {
        //     titleStr = `自定义背景图微信好友排行榜`;
        // }
        // if (this.titleLabel) {
        //     this.titleLabel.string = titleStr;
        // }
        this._initWxRankUINotice();
    }

    /**
     * @Description: 初始化设置开放域要监听的消息和内容
     * @Date: 2024-07-17 19:35:01
     * @Author: GFanStudio-LeeSir-JYJ add
     * @return {*}
     */
    private _initWxRankUINotice() {
        if (!GameUtils.isWx) {
            return;
        }
        // //上传自定义key的对应数据到微信后台<key和value根据自己项目实际需求修改>-此处为演示数据，自己的项目需要在合适的位置提前上传数据到微信后台
        GameUtils.doUploadWXUserCloudFunc();
        // if (this._type == 1) {
        //     GameUtils.WXPostMessage(WXUserPostMsgKey.WXP_friendRankDataDefault);
        // } else if (this._type == 2) {
        GameUtils.WXPostMessage(WXUserPostMsgKey.WXP_friendRankDataCustom);
        // }
    }

    private _initUIData() {
        this.node.active = true;
    }

    onClickCloseBtnEvent() {
        if (this.node) {
            this.node.active = false;
            this.node.removeFromParent();
            this.node.parent = null;
            this.node.destroy();
        }

    }
}


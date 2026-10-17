

import { sys } from "cc";
import { WXUserCloudKey } from "../consts/GameConsts";
import { App } from "../../framework/DSAppManager";
export class GameUtils {

    /**
     * @Description: 统一放到此处 同时上传最高分数和星星数<测试数据需根据自己项目实际情况变换>
     * @Date: 2024-07-07 20:27:13
     * @Author: GFanStudio-LeeSir-JYJ add
     * @return {*}
     */
    public static doUploadWXUserCloudFunc() {
        // let starNum = GlobalFuncHelper.getStarScore();
        let lv = App.gameConfig.getCurLevel();
        
        this.setUploadWXUserCloudData(WXUserCloudKey.WXK_BestScore, lv  + "");//测试数据-key根据自己需求修改调整
        // this.setUploadWXUserCloudData(WXUserCloudKey.WXK_Stars, starNum + "");//测试数据-key根据自己需求修改调整
    }

    /**
     * @Description: 判断是否为微信平台
     * @Date: 2024-07-17 18:26:01
     * @Author: GFanStudio-LeeSir-JYJ add
     * @return {*}
     */
    public static get isWx() {
        if (sys.platform === sys.Platform.WECHAT_GAME) {
            return true;
        }
        return false;
    }

    /**
     * @Description: 主动请求打开用户协议
     * @Date: 2024-07-17 23:33:20
     * @Author: GFanStudio-LeeSir-JYJ add
     * @return {*}
     */
    public static WXRequirePrivacyAuthorize() {
        if (!this.isWx) {
            return;
        }
        window['wx'].requirePrivacyAuthorize({
            success: (res) => {
                // 非标准API的方式处理用户个人信息
            },
            fail: () => { },
            complete: () => { }
        });
    }

    /**
     * @Description: 发送微信消息通知在openDataContext开放域中监听使用
     * @Date: 2024-07-17 19:24:10
     * @Author: GFanStudio-LeeSir-JYJ add
     * @param {string} key
     * @return {*}
     */
    public static WXPostMessage(key: string) {
        if (!this.isWx) {
            return;
        }
        window['wx'].postMessage({
            key: key
        });
    }

    /**
     * @Description: 上传玩家数据到微信后台
     * @Date: 2024-07-07 09:47:31
     * @Author: GFanStudio-LeeSir-JYJ add
     * @param {string} key
     * @param {*} value
     * @return {*}
     */
    public static setUploadWXUserCloudData(key: string, value: string) {
        if (!this.isWx) {
            return;
        }
        // console.log(`<setWXUserCloudData> 上传数据：,{ ${key} , ${value} }`);
        window['wx'].setUserCloudStorage({
            KVDataList: [{ key, value }],
            success: (res) => {
                // console.log(`<setWXUserCloudData> 上传玩家数据成功：,{ ${key} , ${value} }   , res: ${JSON.stringify(res)}`);
            },
            fail: (err) => {
                // console.log(`<setWXUserCloudData> 上传玩家数据失败：,{ ${key} , ${value} } , err: ${JSON.stringify(err)}`);
            },
        });
    }

}
/**
 * 微信接口  wx92a00da0fc2944c6
 */
import { _decorator, sys } from 'cc';
import { App } from '../framework/DSAppManager';
import { DSStorageKey } from '../framework/DSStorageManager';
export var IsGetInfo = false;
export class WxManager {
    private wxCode = '';
    public init() {
        this._wxLogin();
    }

    /**
     * 登录接口
     */
    _wxLogin() {
        if (sys.platform != sys.Platform.WECHAT_GAME) return;
        console.log('start_login');
        let self = this;
        // @ts-ignore
        wx.login({
            success: function (res) {
                console.log('loginSuccess');
                self.wxCode = res.code
                self._wxGetUserState()
            }.bind(this)
        })
    }

    /**
     * 用户状态
     */
    private _wxGetUserState() {
        console.log('_wxGetUserState');
        let self = this;
        // @ts-ignore
        wx.getSetting({
            fail: function (res) {
                console.log('_wxGetUserState1');
                self._wxPrivacy()
            }.bind(this),

            success: function (res) {
                console.log('_wxGetUserState2');
                if (res.authSetting['scope.userInfo']) {
                    console.log('获取用户状态成功');
                    // self.getUserInfo();
                    // self._wxPrivacy();
                    self._requirePrivaceAuthorize();
                }
                else {
                    self._wxPrivacy();
                }
            }.bind(this)
        })
    }


    /** 新版隐私权限请求 */
    private _wxPrivacy() {
        let self = this;

        // wx.openPrivacyContract({
        //     success: function () {
        self._requirePrivaceAuthorize();
        //     }, // 打开成功
        //     fail: function () {
        //     }, // 打开失败
        //     complete: function () { }
        // })
    }

    private _requirePrivaceAuthorize() {
        let self = this;
        // @ts-ignore
        wx.requirePrivacyAuthorize({
            success: function (res) {
                console.log("-------- privacy --------")
                console.log(res);
                // 非标准API的方式处理用户个人信息
                self._wxGetUserInfo();
            },
            fail: function () {
            },
            complete: function () { }
        })
    }

    /**
     * 授权获取玩家信息
     */
    private _wxGetUserInfo() {
        console.log('手动授权 wxgetuserInfo');
        let self = this;
        // @ts-ignore
        let WXInfoButton = wx.createUserInfoButton({
            type: 'text',
            text: 'click',
            style: {
                left: 0,
                top: 0,
                width: 750,
                height: 1443,
                backgroundColor: '',
                borderColor: '#FFFFFF',
                borderWidth: 0,
                borderRadius: 0,
                color: '#FFFFFF',
                textAlign: 'center',
                fontSize: 1,
                lineHeight: 1400,
            }
        })
        WXInfoButton.onTap((res) => {
            if (res.errMsg.indexOf('auth deny') > -1 || res.errMsg.indexOf('auth denied') > -1) {
                // 处理用户拒绝授权的情况
                self._guideActive();
            } else {
                self._setUserData(res)
            }
            WXInfoButton.hide();
        })
        WXInfoButton.show();
    }


    _guideActive() {
        let self = this;
        // @ts-ignore
        wx.showModal({
            title: '警告',
            content: '拒绝授权将无法正常游戏',
            cancelText: '取消',
            showCancel: true,
            confirmText: '设置',
            success: (function (res) {
                if (res.confirm) {
                    // @ts-ignore
                    wx.openSetting({
                        success: (function (res) {
                            if (res.authSetting['scope.userInfo'] === true) {
                                self.getUserInfo()
                            }
                        }).bind(this)
                    })
                } else {
                }
            }).bind(this)
        })
    }

    /**
     * 获取用户数据
     */
    getUserInfo() {
        console.log('getUserInfo1');
        let self = this;
        // @ts-ignore
        wx.getUserProfile({
            fail: function (res) {
                console.log('getUserInfo3');
                console.log(res);
                if (res.errMsg.indexOf('auth deny') > -1 || res.errMsg.indexOf('auth denied') > -1) {
                    // 处理用户拒绝授权的情况
                    self._guideActive();
                }
            }.bind(this),
            success: function (res) {
                console.log('getUserInfo2');
                self._setUserData(res);
            }.bind(this)
        })
    }

    /**
     * 被动分享
     */
    private _shareFunc() {
        // @ts-ignore
        wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });
        // @ts-ignore
        let imgUrl = canvas.toTempFilePathSync({
            x: 10,
            y: 10,
            width: 700,
            height: 1100,
            destWidth: 400,
            destHeight: 300
        });
        // @ts-ignore
        wx.onShareAppMessage(function () {
            return {
                title: '快来和我一起撸串吗，好吃的串串哟～',
                imageUrl: imgUrl,
            }
        });
        // @ts-ignore
        wx.onShareTimeline(function () {
            return {
                title: '快来和我一起撸串吗，好吃的串串哟～', //分享标题
                imageUrl: imgUrl,
            }
        })
    }

    /**
    * 主动拉起分享
    */
    private _evtShareToOthers(lv: number) {
        if (sys.platform == sys.Platform.WECHAT_GAME) {
            // @ts-ignore
            let tempFilePath = canvas.toTempFilePathSync({
                x: 10,
                y: 10,
                width: 700,
                height: 1100,
                destWidth: 400,
                destHeight: 300
            })
            // @ts-ignore
            wx.shareAppMessage({
                title: `腿都蹲麻了，这个游戏太上瘾了，来挑战一下吧`,
                imageUrl: tempFilePath
            })
        }
    }

    public ShareToOthers(lv: number) {
        if (sys.platform == sys.Platform.WECHAT_GAME) {
            // @ts-ignore
            let tempFilePath = canvas.toTempFilePathSync({
                x: 10,
                y: 10,
                width: 700,
                height: 1100,
                destWidth: 400,
                destHeight: 300
            })
            // @ts-ignore
            wx.shareAppMessage({
                title: `我以闯过${lv}关，邀您来挑战`,
                imageUrl: tempFilePath
            })
        }
    }

    private _setUserData(res) {
        console.log("------------------res------------");
        console.log(res);
        let self = this;
        let info = res.userInfo;
        /* 初始化右上角分享 */
        self._shareFunc();
        if (info && info.nickName) {
            // let data = { name: info.nickName, icon: info.avatarUrl };
            // console.log(data);
            // App.user.rankData.name = info.nickName;
            // App.user.rankData.icon = info.avatarUrl;
            // Advertise.init(); // 初始化广告
        }
    }

    public setWxCloudRankData(lv: number) {
        // @ts-ignore
        wx.setUserCloudStorage({
            KVDataList: [{ key: 'level', value: lv }], //KVDataList: K表示Key V表示Value DateList表示用户数据列表 用户要修改的 KV 数据列表 , 即存入用户信息到//微信云存储上 , 在下面的子域中将获取这个值进行排序，
            success: () => {
                console.log('setwxcloudrankdata success');
            }
        })
    }

    // 在适当的时机调用该函数来触发设备的震动
    public vibrate(isLong: boolean = true) {
        // @ts-ignore
        if (typeof ks != 'undefined') return;
        if (sys.platform != sys.Platform.WECHAT_GAME && sys.platform != sys.Platform.BYTEDANCE_MINI_GAME) {
            return;
        }
        if (sys.platform != sys.Platform.WECHAT_GAME) {
            return;
        }
        let bool = App.storage.getBoolean(DSStorageKey.Zhen_Dong_Status,true);
        if (!bool) return;
        if(isLong){
            // @ts-ignore
            if (wx.vibrateLong) {
                // @ts-ignore
                wx.vibrateLong({
                    success: function () {
                        console.log('震动成功');
                    },
                    fail: function (res) {
                        console.error('震动失败', res);
                    }
                });
            } else {
                console.error('当前设备不支持震动功能');
            }
        }else{
            // @ts-ignore
            if (wx.vibrateShort) {
                // @ts-ignore
                wx.vibrateShort({
                    success: function () {
                        console.log('震动成功');
                    },
                    fail: function (res) {
                        console.error('震动失败', res);
                    }
                });
            } else {
                console.error('当前设备不支持震动功能');
            }
        }
    }



    private gamequan: null;
    /** 创建游戏圈 */
    showGameQuan() {
        if (sys.platform != sys.Platform.WECHAT_GAME) {
            return;
        }
        if (this.gamequan) {
            // @ts-ignore
            this.gamequan.show();
            return;
        }
        // @ts-ignore
        let this_phone_Height = wx.getSystemInfoSync().windowHeight;
        // @ts-ignore
        this.gamequan = wx.createGameClubButton({
            icon: 'green',
            text: "游戏圈",
            style: {
                text: "游戏圈",
                left: 10,
                top: 100,
                width: 40,
                height: 40,
                textAlign: "center",
            },
            openlink: ''
        })
    }

}
export let WxMgr = new WxManager();

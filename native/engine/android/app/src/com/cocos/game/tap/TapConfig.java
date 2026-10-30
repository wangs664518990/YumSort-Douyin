package com.cocos.game.tap;

/**
 * TapTap 渠道参数(APK 侧)
 *
 * 全部留空时:SDK 不初始化,相关能力返回 "not configured",游戏仍可正常进入,
 * 但**防沉迷不会生效、广告不会出** —— 提审前必须填完,并确认日志里没有 "未配置" 告警。
 *
 * 取值位置:
 *   CLIENT_ID / CLIENT_TOKEN  TapTap 开发者中心 > 你的游戏 > 游戏服务 > 应用配置
 *   MEDIA_ID / MEDIA_NAME / MEDIA_KEY  Dirichlet(TapADN) 媒体管理平台 > 媒体信息
 *
 * 安全提醒:MEDIA_KEY 是密钥,不要提交到公开仓库。
 *   如果这个工程会开源或多人协作,改成从 local.properties / 服务器下发,不要写死在代码里。
 */
public final class TapConfig {

    private TapConfig() {
    }

    /** TapTap Client ID(防沉迷必填) */
    public static final String CLIENT_ID = "";

    /** TapTap Client Token(登录用,本游戏暂不需要可留空) */
    public static final String CLIENT_TOKEN = "";

    /** Dirichlet 媒体 ID(广告必填,数字) */
    public static final long MEDIA_ID = 0L;

    /** Dirichlet 媒体名称 */
    public static final String MEDIA_NAME = "";

    /** Dirichlet 媒体密钥 */
    public static final String MEDIA_KEY = "";

    /** 调试日志:上架前必须为 false */
    public static final boolean DEBUG = false;

    /** 防沉迷是否显示"切换账号"按钮(本游戏无账号体系,关闭) */
    public static final boolean SHOW_SWITCH_ACCOUNT = false;

    /** 是否申请年龄段信息(用于按年龄分级提示,建议 true) */
    public static final boolean USE_AGE_RANGE = true;

    public static boolean isAntiAddictionConfigured() {
        return CLIENT_ID != null && CLIENT_ID.length() > 0;
    }

    public static boolean isAdConfigured() {
        return MEDIA_ID > 0 && MEDIA_KEY != null && MEDIA_KEY.length() > 0;
    }
}

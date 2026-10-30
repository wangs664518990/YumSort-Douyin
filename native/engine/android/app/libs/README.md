# 把 TapSDK 与 Dirichlet 的 aar 放在这个目录

`app/build.gradle` 里已经有:

```gradle
implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])
```

所以**不需要改 gradle**,把文件拷进来重新编译即可。

## TapSDK(防沉迷 / 登录)

从 TapTap 开发者中心「下载页」取 TapSDK Android 包,按下表挑需要的:

| 文件 | 必需 | 用途 |
| --- | --- | --- |
| `TapCommon_x.y.z.aar` | ✅ | TapSDK 基础库 |
| `TapLogin_x.y.z.aar` | ✅ | 登录(防沉迷依赖它) |
| `AntiAddiction_x.y.z.aar` | ✅ | 防沉迷核心 |
| `AntiAddictionUI_x.y.z.aar` | ✅ | 实名窗 UI |
| `TapBootstrap_x.y.z.aar` | ⬜ | 统一启动器,用单独 init 方式时可不放 |

## Dirichlet(TapADN)广告

从 Dirichlet 媒体管理平台「接入中心」下载 Android SDK,通常是一个 `TapAdSdk-x.y.z.aar`
(部分版本还带 `oaid` 等辅助 aar,按官方说明一并放入)。

## 放完怎么验证

1. 编译通过(没放时报的是 "package com.tapsdk... does not exist" 之类,如果走反射则不会报);
2. 装到手机上,看 logcat 过滤 `TapBridge` / `TapAntiAddiction` / `TapAd`:
   - `bridge ready` = 桥通了;
   - `未找到 AntiAddictionUIKit` = 防沉迷 aar 没放对;
   - `未找到 TapAD SDK` = 广告 aar 没放对;
   - `防沉迷初始化成功` + `广告 SDK 初始化成功` = 都挂上了。

> 代码是反射调用(见 `TapReflect.java` 头部说明),所以 AAR 缺失时**能编译、不能工作**,
> 一定靠日志确认,不要只看"编译过了"。
>
> MEDIA_KEY 是密钥,别提交到公开仓库。

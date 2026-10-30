# TapTap 国内版适配说明

> 项目:美食餐厅爱消消(Cocos Creator 3.8.8)
> 分支:`feature/taptap-cn`
> 本文档记录 TapTap 国内版「Tap 小游戏 + APK」双形态的接入方式、合规要求与构建流程。
> 文档口径核对时间:2026-10。**提审前请以官方文档当时版本复核**,文末给了核对路径。

> 🔴 **当前范围变更(阶段决定):只发 Tap 小游戏,APK 暂缓。**
> 由此产生三处变化,读本文时请注意:
> 1. **防沉迷改为平台托管,不需要自接** —— 第四节的自接逻辑保留但不再是小游戏上线前提;
> 2. **APK 相关章节(3.2 / 5.1 桥协议 / TapConfig / AAR)暂不执行** —— 代码已就绪,将来发 APK 直接启用;
> 3. 版号 / ICP / 签名 / keystore 全部不在本阶段范围。
>
> 只看小游戏的话,直接读 `TapTap-小游戏上架清单.md`。

---

## 〇、结论先行

| 结论 | 说明 |
| --- | --- |
| 是**两种形态**,不是一种 | Tap 小游戏(WebGL,zip 上传)与 APK(原生包),**文档与 SDK 完全不通用**,官方原话:"读错档是返工最常见的原因" |
| 防沉迷看形态定 | 只发小游戏 → **平台托管,零代码**;同时提供 APK → 必须自接或接 TapPlay。**当前只发小游戏,所以托管** |
| 广告走 **Dirichlet(TapADN)** | TapTap 自带的广告变现能力只对"星火 / H5 小游戏 / 制造"开放,Tap 小游戏与 APK 一律接 Dirichlet |
| 小游戏**必须接 TapTap 登录** | 官方要求包体内已正确接入 TapTap 登录,否则 TapTap 用户无法正常游玩。**"接入"指调用接口,不是要做登录 UI** —— 本项目单机无账号,静默调用 `tap.login()` 后丢弃 code 即可 |
| 首包 **≤ 60MB** | 小游戏硬线;wasm br 超 6MB 建议开分包,超 10MB 必须开 |

---

## 一、形态与文档路由(先认路,再写码)

| 形态 | 是什么 | 走哪份文档 | 本项目状态 |
| --- | --- | --- | --- |
| **Tap 小游戏** | 用 Cocos 构建微信小游戏,再用官方插件转成 Tap 小游戏 zip | `minigameapidoc` | 代码已就绪,构建需装插件 |
| **APK** | 原生 Android 包,上传安装包分发 | `docs/sdk/*`(游戏服务 SDK) | 代码骨架已就绪,**原生 SDK 需在原生工程补齐** |

官方文档地址:

- 引擎适配(Cocos):`https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/`
- 小游戏广告:`https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/ad/ad/`
- 防沉迷开发指南:`https://developer.taptap.cn/docs/v3/sdk/anti-addiction/guide`
- Dirichlet 接入:`https://ssp.dirichlet.cn/docs/ssp-guide/`
- 未成年健康系统:`https://developer.taptap.io/product-intro/anti-addiction`

---

## 二、平台判定(本分支最容易踩的坑)

Tap 小游戏和快手一样,都是"**微信小游戏构建产物 + 转换插件**",运行时 `sys.platform` 仍然是 `WECHAT_GAME`。

- 快手靠 `KsManager.isKuaishouEnv()` 直接以 `WECHAT_GAME` 判快手(见快手适配说明);
- 如果不处理,Tap 包在本项目会被**误判成快手**,走 `ks.*` 全部崩掉。

所以本分支新增 `assets/script/framework/DSPlatform.ts` 做**唯一判定入口**,顺序不可调换:

```
1. sys.isNative            -> TapTap 原生包(本分支原生只发 TapTap)
2. 全局对象 tap            -> Tap 小游戏
3. 全局对象 ks/KSGameGlobal -> 快手
4. BYTEDANCE 构建          -> 抖音
5. 其余 WECHAT_GAME        -> 微信(本项目未上线,仅兜底)
```

同时 `KsManager.isKuaishouEnv()` 增加了 `if (DSPlatform.isTapMini) return false;` 前置排除,快手行为不变。

**后续新增平台,一律先改 `DSPlatform`,不要在业务里散写 `sys.platform` 判断。**

---

## 三、构建流程

### 3.1 Tap 小游戏

1. **装插件**:Cocos Creator → 扩展 → 扩展管理器 → 导入本地扩展,选 `tap-minigame-ts.zip`(官方当前版本 1.2.2);启用 `taptap-minigame-tools`,控制台出现 `[Tap小游戏] 扩展已加载` 即成功。
2. **配置构建**:项目 → 构建发布 → 平台选 **微信小游戏**(填 AppID、初始场景)→ 面板下方勾选 **转换为Tap小游戏** → 填 **Tap小游戏 AppID**。
3. **构建**:构建分两阶段(先标准微信小游戏,再自动转换 10 步)。
4. **取产物**:
   - 微信小游戏:`build/wechatgame-001/`
   - Tap 小游戏:`build/TapBuild/game/`,最终上传文件是 **`build/TapBuild/game.zip`**。
5. 开发者中心 → 上传包体 → 生成测试二维码自测 → 提审 → **审核通过后还要单独点"上线"**。

> 包体注意:首包 ≤60MB;wasm br >6MB 建议开分包、>10MB 必须开。分包采集需要 iOS/Android 各 ≥2 台设备覆盖主要场景。

### 3.2 APK

原生工程已生成在 **`native/engine/android/`**(Cocos Creator 3.8 的原生工程目录,随工程走 git)。

**代码侧已完成**,只剩放 SDK 和填参数两步:

1. **放 AAR**:把 TapSDK 与 Dirichlet 的 aar 拷到 `native/engine/android/app/libs/`。
   `app/build.gradle` 里已有 `implementation fileTree(dir: 'libs', include: ['*.jar','*.aar'])`,
   **不需要改 gradle**,放进去就自动参与编译与打包。
2. **填参数**:编辑 `native/engine/android/app/src/com/cocos/game/tap/TapConfig.java`
   填 `CLIENT_ID` / `MEDIA_ID` / `MEDIA_NAME` / `MEDIA_KEY`。
3. **出包**:Cocos Creator「构建发布 → Android」或直接 `build/android/proj` 下 gradle 编译。

> `MEDIA_KEY` 是密钥,别提交到公开仓库;如果这份工程要多人协作或开源,改成从 `local.properties` 注入。

---

## 四、防沉迷(合规核心)

### 4.1 合规结论

| 场景 | 官方要求 | 本项目做法 |
| --- | --- | --- |
| **仅小游戏(当前)** | 防沉迷由 TapTap 平台托管,开发者无需操作 | ✅ **零代码**,实名/时长/宵禁全由平台接管 |
| 小游戏 + APK(暂缓) | 必须自己完善防沉迷,或接入 TapPlay | 代码已备好(原生 TapSDK),发 APK 时启用 |
| 实名 | TapSDK 自动对接中宣部系统,以开发者主体上报 | 小游戏走平台实名;APK 走 TapSDK |

### 4.2 状态与回调码

**以官方 v3 文档「回调 code」表格为准**(早期 Unity 文档里的 1095 在 v3 表里不存在,已移除):

| 回调码 | 官方常量 | 含义 | 模块状态 | 是否阻断 |
| --- | --- | --- | --- | --- |
| 500 | `LOGIN_SUCCESS` | 校验通过(未成年在可玩时段内也是 500) | `Allowed` | 否 |
| 1000 | `EXITED` | 退出防沉迷流程 / 认证信息失效 | `Exited` | **是** |
| 1001 | `SWITCH_ACCOUNT` | 玩家点了"切换账号" | `SwitchAccount` | **是** |
| 1030 | `PERIOD_RESTRICT` | 当前时段不可玩(宵禁) | `Curfew` | **是** |
| 1050 | `DURATION_LIMIT` | 可玩时长用尽 | `TimeLimit` | **是** |
| 1100 | `AGE_LIMIT` | 触发应用设置的年龄限制(优先级高于 1030,无弹窗) | `AgeLimit` | **是** |
| 1200 | `INVALID_CLIENT_OR_NETWORK_ERROR` | ClientId 配置错误 / 网络异常 | `Allowed` + 告警 | 否 |
| 9002 | `REAL_NAME_STOP` | 玩家关闭实名窗,未完成实名 | `NotVerified` | **是** |

> 1200 不拦玩家是刻意的:这是配置或网络问题,封玩家等于把自家事故转嫁给用户。
> 但日志里出现 1200 等于**上线事故**,提审前必须清零。

未成年可玩时段(国家规定):**周五、周六、周日及法定节假日 20:00-21:00**;21:00 后无法登录。

> **不需要做游戏内的"防沉迷说明"页面。** 实名窗、身份校验、时长限制提示全部由 TapSDK 自带 UI 完成,
> 游戏侧只负责"什么时候校验 + 校验不通就不让进关"。
> 启动页已有的「健康游戏忠告 + 已接入健康系统」文案已经覆盖了合规展示要求。

### 4.3 拦截点

- `homeView.onClickstartBtn` —— 开始游戏
- `resultView.onClicknextBtn` —— 进入下一关(防止局中时长用尽后还能续关)

两处都调 `TapAntiAddiction.guard()`,非 Tap 渠道直接返回 `true`,不影响抖音/快手。

### 4.4 降级策略(明确写出来,避免以后被当 bug 修)

- 原生桥不可用 / TapSDK 初始化失败 / 3 秒内无响应 → **放行**(`isDegraded = true`)并打告警日志。
  理由:合规之外还要保证可玩,卡死在启动页是更严重的问题;
- 但**后续一旦收到受限回调,立即置受限并踢回首页**,所以不会出现"降级后永久放行";
- 提审前必须确认日志里**没有** `[防沉迷] 告警:` 前缀,有就说明没真正校验上。

---

## 五、代码结构

```
assets/script/
├── framework/
│   ├── DSPlatform.ts          # 新增:平台判定唯一入口(tap / ks / dy / 微信 / 原生)
│   ├── DSAppManager.ts        # 改造:init() 里调用 TapAntiAddiction.init()
│   ├── DSEventManager.ts      # 改造:新增事件 AntiAddictionChange
│   └── DSStorageManager.ts    # 改造:新增存储键 TapUserId
├── tap/
│   ├── TapManager.ts          # 新增:广告(激励/插屏/Banner/原生模板/开屏)、登录、震动、分享
│   ├── TapAntiAddiction.ts    # 新增:防沉迷状态机 + 拦截 + 降级
│   └── TapNativeBridge.ts     # 新增:APK 的 JS↔Java/OC 通道(JsbBridge)
├── wx/
│   ├── advertise.ts           # 改造:广告门面增加 Tap 分发(4 个平台统一入口)
│   └── wxManager.ts           # 改造:Tap 跳过微信登录/游戏圈/云数据,震动与分享走 Tap
| `ks/KsManager.ts` | 改造:isKuaishouEnv() 前置排除 Tap |
| `rank/utils/GameUtils.ts` | 改造:isWx 排除 Tap(无微信开放数据域) |

原生工程:

```
native/engine/android/app/
├── src/com/cocos/game/
│   ├── AppActivity.java              # 改造:onCreate 里加一行 TapBridge.init(this)
│   └── tap/
│       ├── TapBridge.java            # 新增:JS↔Java 桥 + 协议分发 + 线程切换
│       ├── TapReflect.java           # 新增:反射调用工具(按签名找方法、动态代理)
│       ├── TapAntiAddictionImpl.java # 新增:防沉迷(TapSDK),按重载自适应 3 种 init 形态
│       ├── TapAdImpl.java            # 新增:广告(Dirichlet)激励/插屏/Banner/开屏
│       └── TapConfig.java            # 新增:CLIENT_ID / MEDIA_* 参数(待填)
├── proguard-rules.pro                # 改造:保留 com.tapsdk / com.taptap / tap 包(反射依赖)
└── libs/                             # 待放:TapSDK 与 Dirichlet 的 aar
```

**业务侧无需改动**:各界面仍调 `Advertise.showVideoAds() / showBannerAds() / showInterstitialAds() / showCoustomAd()`,由门面按平台分发。

### 5.1 APK 原生桥协议(已实现)

JS → Native:`native.bridge.sendToNative(method, JSON.stringify({ id, params }))`
Native → JS:`onNative(method, JSON.stringify({ id, ok, code, msg, data }))`

| method | params | 返回 | 状态 |
| --- | --- | --- | --- |
| `ad.init` | `{}` | `{ok}` | ✅ |
| `ad.showRewarded` | `{spaceId, userId, rewardName, rewardAmount}` | `{code:1}` 验真发奖 / `{code:0}` 中断 | ✅ |
| `ad.showInterstitial` | `{spaceId}` | `{ok}` | ✅ |
| `ad.showBanner` / `ad.hideBanner` | `{spaceId}` / `{}` | `{ok}` | ✅ |
| `ad.showSplash` | `{spaceId}` | `{ok}` | ✅ |
| `antiaddiction.init` | `{}` | `{ok}` | ✅ |
| `antiaddiction.startup` | `{userIdentifier}` | `{ok}`(ack,结果走事件) | ✅ |
| `antiaddiction.logout` | `{}` | `{ok}` | ✅ |
| `device.vibrateLong` / `device.vibrateShort` | `{}` | `{ok}` | ✅ |
| `login.startup` | `{}` | `{ok:false}` | ⬜ 未接(本游戏无云存档需求,不阻塞) |
| `device.share` | `{}` | `{ok:false}` | ⬜ 未接 |

主动事件(不带 id,JS 按 method 名分发):`antiaddiction.event` → `{code, msg}`

> 所有原生方法没实现也必须回包(JS 侧有超时兜底),不允许静默挂起。

---

## 六、广告位配置(必须)

在 **`assets/script/tap/TapManager.ts`** 顶部的 `TapAdConfig` 里填(广告位在 Dirichlet 媒体平台创建,应用类型选"小游戏"或"APP"):

```ts
public static rewardedId: string = "";      // 激励视频
public static interstitialId: string = "";  // 插屏
public static bannerId: string = "";        // Banner
public static nativeId: string = "";        // 原生模板(仅小游戏)
public static splashId: string = "";        // 开屏(仅 APK)
public static interstitialInterval = 120000;// 插屏频控 2 分钟
public static isTest: boolean = false;      // 联调置 true 直接模拟成功
```

- 留空 = 不加载该广告,对应入口提示"暂未开放"或静默跳过,不会报错;
- **APK 的广告位也填在这里**:JS 会把 `spaceId` 随桥参数传给原生,原生 `TapConfig` 只放媒体级参数(ID/名称/密钥),广告位不用在 Java 里再填一遍;
- 广告位需在 Dirichlet 后台**审核通过并把属性改为"正式"、开关打开**,否则没有收益;
- 官方注意事项:**激励视频必须玩家主动点**、**插屏间隔 ≥2 分钟**、**加载失败就跳过不要卡住流程** —— 三条都已在代码里实现。

### 广告能力对照

| 广告形式 | 抖音 | 快手 | Tap 小游戏 | Tap APK |
| --- | --- | --- | --- | --- |
| 激励视频 | ✅ | ✅ | ✅ `tap.createRewardedVideoAd` | ✅ Dirichlet(桥) |
| 插屏 | ✅ | ✅ | ✅ `tap.createInterstitialAd` | ✅ Dirichlet(桥) |
| Banner | ✅ | ✅ | ✅ `tap.createBannerAd` | ✅ Dirichlet(桥) |
| 开屏 | — | ❌ 无 API | ❌ 无 API | ✅ Dirichlet(桥) |
| 原生模板/格子 | — | ❌ | ✅ `tap.createCustomAd` | ❌ 本版不接 |
| 九宫格/更多游戏 | ✅ | ❌ | ❌ | ❌ |

---

## 七、资质与合规(提审硬前提)

| 项 | 要求 | 本项目状态 |
| --- | --- | --- |
| 小游戏前置备案 | **不涉及内购的小游戏无需版号,但正式上架前必须完成"小游戏前置备案"** | ❌ 未办 |
| 版号 | 小游戏无内购可免;APK 上架的版号要求以 TapTap 当时《资质要求》为准 | 待确认 |
| 开发者实名认证 | 主体信息需与 Dirichlet 签约主体一致 | ❌ 未办 |
| **防沉迷接入** | 双形态必须自接(见第四节)。**不要求游戏内有"防沉迷说明"页面** —— TapSDK 自带实名窗与时长限制界面,平台审的是"接没接"而不是"写没写说明" | ✅ 代码已接(原生 SDK 待补) |
| 健康游戏忠告 + 防沉迷声明 | 启动/登录页展示 | ✅ **已有**,在 `assets/resources/prefab/ui/loadingView.prefab`(含"已接入健康系统…"四行文案) |
| 隐私政策 | 本轮**不做游戏内入口**;改为在 TapTap 开发者中心「商店资料」填写隐私政策链接,并在广告 SDK 的权限/数据声明中对齐 | ⚠️ 后台链接待填 |

> 驳回高发点:玩法同质化、内容太短、商店截图不用实机画面、**有广告却没勾隐私政策和防沉迷声明**。
> 后一条指的是**提审表单/后台声明**,不是游戏内页面 —— 所以游戏内不放隐私入口可以,但后台链接不能空着。

> 文案提醒:`loadingView` 里现有文案是"该**小游戏**已接入健康系统"。双形态发布后 APK 包也说"小游戏"不妥,
> 建议把这两个字改成"该**游戏**已接入健康系统",三个平台通用、不影响抖音/快手。

---

## 八、待办(按优先级)

| 优先级 | 事项 | 说明 |
| --- | --- | --- |
| **P0** | 把 TapSDK / Dirichlet 的 aar 放进 `native/engine/android/app/libs/` | gradle 已 `fileTree` 引入,放进去即可编译;不放则日志报"未找到 xxx"并降级 |
| **P0** | 填 `TapConfig.java`(CLIENT_ID / MEDIA_ID / MEDIA_NAME / MEDIA_KEY) | 空值 = APK 侧防沉迷与广告都不生效 |
| **P0** | 填 `TapAdConfig` 广告位 ID(小游戏位 / APP 位各一套) | 空位 = 无收益 |
| **P0** | 小游戏前置备案 + 开发者主体认证 | 不办不能上线 |
| P1 | 装 `tap-minigame-ts` 插件并出 `build/TapBuild/game.zip` | 出包才能真机测 |
| P1 | TapTap 后台填写隐私政策链接 + 广告/权限声明 | 游戏内不放,但后台不能空;链接可指向官网或文档页 |
| P2 | 排行榜接入 Tap 排行榜(替代现有本地榜) | 可选,ROI 一般 |
| P2 | TapDB 数据上报 | 可选,便于看留存 |

> 已确认不做:游戏内「防沉迷说明」独立页(TapSDK 自带界面)、游戏内隐私政策入口(改走后台链接)。
> 「健康游戏忠告 + 防沉迷声明」已在 `loadingView.prefab`,无需改动。

### 8.1 关于反射调用(重要,别当 bug 改)

原生侧对 TapSDK / Dirichlet 全部走**反射**,不是没写 import 的疏忽:

- 好处:仓库里没有 AAR 也能编译通过(否则现在 APK 构建会直接红),换 SDK 版本不用改代码;
- 代价:**没有编译期检查**。所以每次换 SDK 版本后必须真机跑一遍,看日志有没有:
  - `未找到 AntiAddictionUIKit` / `未找到 TapAD SDK` → AAR 没放对目录;
  - `没有找到可用的 init 重载` / `缺少方法 xxx` / `startup signature not found` → SDK 版本与代码预期不符;
- 反射调用点集中在这几个类,改起来很轻:`TapAntiAddictionImpl`(3 个候选包名 + 3 种 init 重载)、`TapAdImpl`(4 种广告)、`TapReflect`(通用工具)。

> 如果后续想换回强类型调用(有编译期检查),做法是:把 aar 放进 `libs/` 后,
> 用 `implementation files('libs/xxx.aar')` 显式引入 + 把这几个 Impl 类改成直接 import 对应类。
> 换之前先确认 `javap -classpath classes.jar` 能看到真实方法签名。

---

## 九、上线检查清单

- [ ] `DSPlatform` 判定正确:小游戏真机日志显示 `tap-mini`,APK 显示 `tap-native`
- [ ] APK 日志出现 `TapBridge: bridge ready`,且**没有** `未找到 AntiAddictionUIKit` / `未找到 TapAD SDK`
- [ ] 日志中**无** `[防沉迷] 告警:`(有 = 降级放行,提审会被打回)
- [ ] 实名弹窗真机可拉起,未实名账号被正确拦截
- [ ] 受限回调(1000 / 1001 / 1030 / 1050 / 1100 / 9002)能踢回首页并给出对应文案
- [ ] 激励视频:主动点击 → 看完发奖 → 中途关闭不发奖 → **连点不会重复发奖**
- [ ] 插屏:2 分钟内连续调用只弹一次
- [ ] Banner:不遮挡底部按钮;切场景正确显示/隐藏
- [ ] Tap 小游戏 TapTap 登录可用(未接会导致 TapTap 用户无法游玩)
- [ ] 启动页「健康游戏忠告 + 防沉迷声明」文案已按双形态改为"本游戏"(不再是"小游戏")
- [ ] TapTap 后台已填隐私政策链接(游戏内不放,但后台必填)
- [ ] 提审前把 `TapAdConfig.isTest` 与 `TapConfig.DEBUG` 都改回 `false`
- [ ] 包体 ≤60MB;wasm br >10MB 已开分包
- [ ] 版本号 `V x.y.z`,唯一且高于已上线版本
- [ ] 抖音/快手包回归:两条链路行为与改造前一致(`git diff main` 复核)

---

## 十、改动影响面(回归范围)

改造是"加法 + 前置排除",但仍需回归:

1. **抖音包**:`DSPlatform.isTap` 为 false,`Ads` 走原分支;`SdkManager` 未改逻辑 → 预期无变化。
2. **快手包**:`KsManager.isKuaishouEnv()` 增加一行前置排除;因快手无 `tap` 全局对象,仍返回 true → 预期无变化。
3. **浏览器预览**:`Ads` 直接走 Tap 分支会让广告变空转(预览无 `tap`),`TapManager` 内部全部有 `isTap` 守卫,不会崩。若预览时广告行为异常,先看 `DSPlatform.kind` 是否为 `web`。

---

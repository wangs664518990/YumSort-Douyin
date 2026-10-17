/*
 * @Description:  微信开放域模版index
 * @Version: 1.0.0
 * @Autor: GFanStudio-LeeSir
 * @Date: 2024-07-06 23:35:47
 * @LastEditTime: 2024-07-17 19:56:24
 * @FilePath: /LessonWXFriendRank/build/wechatgame/openDataContext/index.js
 * Copyright (c) 2024 by GFanStudio-LeeSir-JYJ, All Rights Reserved. 
 */
const {
  getWXFriendRankData,
  friendRankData,
} = require('./render/dataDemo');
const {
  defaultModifyStyle,
  customRankStyle
} = require('./render/style')
const {
  setCustomDefaultRankTemplate,
  setCustomItemBgRankTemplate
} = require('./render/template')
const Layout = require('./engine').default;

let __env = GameGlobal.wx || GameGlobal.tt || GameGlobal.swan;
let sharedCanvas = __env.getSharedCanvas();
let sharedContext = sharedCanvas.getContext('2d');

/**
 * @Description:自定义绘制排行榜方法
 * @Date: 2024-07-07 09:17:24
 * @Author: GFanStudio-LeeSir-JYJ add
 * @return {*}
 */
function drawMyRankDefault() {
  Layout.clear();
  //使用cocos默认导出的openDataContext的模版导出修改
  Layout.init(setCustomDefaultRankTemplate(friendRankData), defaultModifyStyle);
  Layout.layout(sharedContext);
}

/**
 * @Description: 自定义修改带自定义item背景图和排行icon的
 * @Date: 2024-07-17 19:50:14
 * @Author: GFanStudio-LeeSir-JYJ add
 * @return {*}
 */
function drawMyRankCustom() {
  Layout.clear();
  //自定义修改带自定义item背景图和排行icon的
  Layout.init(setCustomItemBgRankTemplate(friendRankData), customRankStyle);
  Layout.layout(sharedContext);
}


function updateViewPort(data) {
  Layout.updateViewPort({
    x: data.x,
    y: data.y,
    width: 900, //900
    height: 960, //960
  });
}

__env.onMessage(data => {
  console.log("wx==> <onMessage> ==>" + JSON.stringify(data));
  if (data.type === 'engine' && data.event === 'viewport') {
    updateViewPort(data);
  } else if (data.key === 'friendRankDataDefault') {
    //使用cocos默认导出的openDataContext的模版导出修改
    getWXFriendRankData(['bestscore', 'stars'], drawMyRankDefault);
  } else if (data.key === 'friendRankDataCustom') {
    //自定义修改带自定义item背景图和排行icon的
    getWXFriendRankData(['bestscore', 'stars'], drawMyRankCustom);
  }
});
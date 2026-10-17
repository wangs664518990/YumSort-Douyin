/*
 * @Description: 排行榜样式数据处理类
 * @Version: 1.0.0
 * @Author: GFanStudio-LeeSir-JYJ add<关注GFanStudio微信公众号获得更多精彩技术>
 * @Date: 2024-07-06 23:35:47
 * @LastEditTime: 2024-07-17 20:18:34
 * Copyright (c) 2024 by GFanStudio-LeeSir-JYJ, All Rights Reserved. 
 */

/**
 * @Description: 好友排行data数据结构定义
 * @Date: 2024-07-07 15:25:11
 * @Author: GFanStudio-LeeSir-JYJ add
 * @param {*} key
 * @param {*} callback
 * @return {*}
 */
export let friendRankData = {
  data: [
    /*
    {
        rankScore: 0,
        avatarUrl: '',
        nickname: '',
    },
    */
  ],
  rankItemBg: "",
};

/**
 * @Description: 好友排行榜
 * @Date: 2024-07-07 15:25:11
 * @Author: GFanStudio-LeeSir-JYJ add
 * @param {*} key
 * @param {*} callback
 * @return {*}
 */
export function getWXFriendRankData(keyArr, callback) {
  wx.getFriendCloudStorage({
    // keyList: ['bestscore', 'stars'],
    keyList: keyArr,
    success: res => {
      // console.log(`<getWXFriendRankData> success: ${JSON.stringify(res)}`);
      friendRankData.data = res.data;
      friendRankData.data.sort((a, b) => b.KVDataList[0].value - a.KVDataList[0].value);
      friendRankData.rankItemBg = 'openDataContext/render/imgs/rankitemBg.png'; //设置自定义的item背景图片路径
      for (let i = 0; i < friendRankData.data.length; i++) {
        let indexIcon = 3;
        if (i < 3) {//设置自定义的item排行数字替代图片路径
          indexIcon = i + 1;
        }else{
          indexIcon = 4;
        }
        friendRankData.data[i].rankImg = 'openDataContext/render/imgs/rank_' + (indexIcon) + '.png';

      }
      callback && callback();
    },
    fail: res => {
      // console.log(`<getWXFriendRankData> fail: ${JSON.stringify(res)}`);
      callback && callback(res.data);
    }
  });
}
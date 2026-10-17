/*
 * @Description: 
 * @Version: 1.0.0
 * @Author: GFanStudio-LeeSir-JYJ add<关注GFanStudio微信公众号获得更多精彩技术>
 * @Date: 2024-07-06 23:35:47
 * @LastEditTime: 2024-07-17 20:16:26
 * Copyright (c) 2024 by GFanStudio-LeeSir-JYJ, All Rights Reserved. 
 */

/**
 * @Description: //使用导出模版默认的自定义函数修改后的方法
 * @Date: 2024-07-17 19:54:23
 * @Author: GFanStudio-LeeSir-JYJ add
 * @return {*}
 */
// 上述模板经过模板引擎编译成版本函数，可通过 olado.github.io/doT/index.html 在线获得
//使用导出模版默认的自定义函数修改后的方法
export function setCustomDefaultRankTemplate(it) {
    // var out = '<view class="container" id="main"> <view class="rankList"> <scrollview class="list" scrollY="true"> ';
    // var arr1 = it.data;
    // if (arr1) {
    //     var item, index = -1,
    //         l1 = arr1.length - 1;
    //     if (l1 >= 20) {
    //         l1 = 20;
    //     }
    //     while (index < l1) {
    //         item = arr1[index += 1];
    //         out += ' ';
    //         if (index % 2 === 1) {
    //             out += ' <view class="listItem listItemOld"> ';
    //         }
    //         out += ' ';
    //         if (index % 2 === 0) {
    //             out += ' <view class="listItem"> ';
    //         }
    //         let namee = item.nickname.length < 6 ? item.nickname : item.nickname.substring(0, 4) + "...";
    //         out += ' <view id="listItemUserData"> <text class="listItemNum" value="' + (index + 1) + '"></text> <image class="listHeadImg" src="' + (item.avatarUrl) + '"></image> <text class="listItemName" value="' + (namee) + '"></text> <text class="listItemScore" value="' + (item.KVDataList[0].value) + ' 关"></text><text class="listItemStarNum" value="' + (item.KVDataList[1].value) + ' 颗星"></text></view>  </view> ';
    //     }
    // }
    // out += ' </scrollview> <text class="listTips" value="仅展示前 ' + (20) + ' 位好友排名"></text> </view></view>';
    // // out += ' </scrollview> <text class="listTips" value="仅展示前 ' + (it.data.length) + ' 位好友排名"></text> </view></view>';
    // return out;
}


/**
 * @Description: //使用纯自定义的列表带有自定义的item背景图片合排行
 * @Date: 2024-07-17 19:54:13
 * @Author: GFanStudio-LeeSir-JYJ add
 * @return {*}
 */
// 上述模板经过模板引擎编译成版本函数，可通过 olado.github.io/doT/index.html 在线获得
//使用纯自定义的列表带有自定义的item背景图片合排行
export function setCustomItemBgRankTemplate(it) {
    var out = '<view class="container" id="main"> <view class="rankAreaList"> <scrollview class="scrollviewlist"> ';
    var arr1 = it.data;
    if (arr1) {
        var item, index = -1,
            l1 = arr1.length - 1;
        if (l1 >= 20) {
            l1 = 20;
        }
        while (index < l1) {
            item = arr1[index += 1];
            // out += ' <view class="listItem">  <image class="listRankItemBg" src="' + (it.rankItemBg) + '"></image> ';
            out += ' <view class="listItem">  <image class="listRankItemBg" src="' + (it.rankItemBg) + '"></image> ';
            if (index <= 2) { //使用图标代替排行数字<根据自己需求替换成自己定义的图标>
                out += ' <image class="listItemNumImg" src="' + (item.rankImg) + '"></image> ';
            }
            out += ' ';
            if (index > 2) { //使用图标代替排行数字<根据自己需求替换成自己定义的图标>
                out += ' <text class="listItemNum" value="' + (index + 1) + '"></text> ';
            }
            let namee = item.nickname.length < 6 ? item.nickname : item.nickname.substring(0, 4) + "...";
            out += ' <text class="listItemStarNum1" value=""></text><image class="listHeadIcon" src="' + (item.avatarUrl) + '"></image><text class="listItemName" value="' + (namee) + '"></text> <text class="listItemStarNum" value="' + (item.KVDataList[0].value) + ' 关"></text><text class="listItemStarNum" value=""></text></view> ';
        }
    }
    out += ' </scrollview> </view></view>';
    return out;
}
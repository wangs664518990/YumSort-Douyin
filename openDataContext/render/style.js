
/**
 * @Description: 带自定义排行item背景图的样式
 * @Date: 2024-07-07 09:17:40
 * @Author: GFanStudio-LeeSir-JYJ add<关注GFanStudio微信公众号获得更多精彩技术>
 * @return {*}
 */
//-----------------------------------customRankStyle-------------------------------------------
export let customRankStyle = {
  container: {
    width: '100%',
    height: '110%', //120%
    borderRadius: 12,
    // backgroundColor: '#ffffff', //白色背景(方便调试)
    backgroundColor: 'rgba(0, 0, 0, 0)', //透明背景
    alignItems: 'center',
  },
  //控制排行榜内部list列表的
  rankAreaList: {
    width: '100%',
    // height: '100%',
    height: '110%',
    marginTop: 2, //10
    // backgroundColor: '#f005ff',//紫色背景
    backgroundColor: 'rgba(0, 0, 0, 0)', //透明背景
    borderRadius: 12,
  },
  //控制排行版scrollview
  scrollviewlist: {
    width: '100%',
    height: '88%',
    // backgroundColor: 'rgba(0, 0, 0, 0)',
    // backgroundColor: '#000000',
    alignItems: 'center',
    marginTop: 10, //30
    borderRadius: 12,
  },

  listItem: {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    width: '100%',
    height: '16%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
  },
  //排行榜排名index的替代图片
  listItemNumImg: {
    marginLeft: 28,
    marginRight: 18,
    borderRadius: 6,
    width: 80,
    height: 88,
  },
  //排行榜排名index
  listItemNum: {
    marginLeft: 45,
    width: 80,
    height: 80,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#817565',
    lineHeight: 90,
    textAlign: 'center',
  },
  //列表item的背景图片
  listRankItemBg: {
    position: 'absolute',
    borderRadius: 6,
    width: '100%', //100%
    height: '93%', //120
  },
  //列表item玩家头像的样式
  listHeadIcon: {
    borderRadius: 10, //20
    width: 90, //70
    height: 90, //70
  },
  //分数
  listItemScore: {
    fontSize: 30,
    fontWeight: 'bold',
    marginLeft: 10,
    width: 100,
    height: 100,
    lineHeight: 100,
    textAlign: 'left',
  },

  //当前星星数<分数>
  listItemStarNum: {
    width: '10%',
    height: 100,
    fontSize: 36,
    fontWeight: 'bold',
    paddingRight: 150,
    lineHeight: 100,
    textAlign: 'left',
    marginLeft: 30,
    // color: 'white',
    color: '#B8591F',
    textStrokeWidth: 2,
    textStrokeColor: '#B8591F',
  },
  //当前星星数<分数>
  listItemStarNum1: {
    width: '80',
  },

  //列表item玩家名称
  listItemName: {
    width: '25%',
    height: 100,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#817565',
    textAlign: 'left',
    lineHeight: 100,
    marginLeft: 10,
  },

  listScoreUnit: {
    opacity: 0.5,
    color: '#000000',
    fontSize: 30,
    height: 100,
    lineHeight: 100,
    marginLeft: 8,
  },
  //最底部和列表分开的提示显示多少人的位置
  listTips: {
    width: '100%',
    height: '10%',
    lineHeight: 90, //90
    textAlign: 'center',
    alignItems: 'center',
    marginTop: 15,
    // marginBottom: 5,
    fontSize: 30,
    color: 'rgba(33,90,102,1)',//绿色
    backgroundColor: 'rgba(228,236,163,0.2)', //#ffffff白色 #f005ff紫色
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(162, 12, 168, 1)', //rgba(0, 0, 0, 1)
  },
}
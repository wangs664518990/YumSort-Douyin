/**
 * DSEnumManager - 全局枚举和接口定义管理器
 * 统一管理项目中所有枚举和数据结构定义，按需扩展。
 */

// ==================== 关卡配置数据结构 ====================

/** 关卡难度 */
export enum Difficulty {
    Normal = '简单',
    Hard = '困难',
    VeryHard = '非常困难',
}

/** 包子类型 */
export enum BoxType {
    Ads = 'Ads',
    Hidden = 'Hidden',
}

/** 盘子数据 */
export interface IBoxData {
    /** 箱子ID，如 "Box_4" */
    BoxID: string;
    /** 箱子类型 */
    BoxType: BoxType;
    BoxTypeConfig: string;
    /** 物品数据数组，如 ["1_0_2"] */
    ItemData: string[];
    /** 物品类型数组，如 ["Normal_Normal_Normal"] */
    ItemType: string[];
}

/** 关卡配置 */
export interface ILevelConfig {
    /** 关卡编号 */
    Level: number;
    /** 关卡难度 */
    Difficulty: Difficulty;
    /** 箱子数量 */
    Box: number;
    /** 盘子数量 */
    Dish: number;
    /** 时间限制（秒） */
    Time: number;
    /** 箱子数据列表 */
    BoxData: IBoxData[];
}


export enum UnLockToolType {
    tips = 'tips',
    refresh = 'refresh',
    bigTips = 'bigTips',
    freeze = 'freeze',
}

// ==================== 全局枚举管理器 ====================

export class DSEnumManager {
    // 按业务需要在下方添加枚举
}

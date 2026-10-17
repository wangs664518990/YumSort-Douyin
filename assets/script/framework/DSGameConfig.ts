import { GameUtils } from '../rank/utils/GameUtils';
import { App } from './DSAppManager';
import { DSStorageKey } from './DSStorageManager';

/**
 * DSGameConfig - 游戏配置管理器
 * 负责加载关卡配置 JSON、管理游戏常量配置。
 * 所有加载方法均为 async/await 异步方式。
 * 
 * 使用方式：
 *   import { App } from './framework/DSAppManager';
 *   const config = await App.gameConfig.loadLevelConfig(1);
 *   const maxLevel = App.gameConfig.consts.MAX_LEVEL;
 */
export class DSGameConfig {

    /** 关卡配置缓存：关卡ID -> 配置数据 */
    private _levelConfigs: Map<number, any> = new Map();

    /** JSON 配置根目录 */
    private _configRoot: string = 'config/';

    // ==================== 游戏常量 ====================

    /** 游戏常量配置 */
    readonly consts = {
        /** 游戏名称 */
        GAME_NAME: 'FoodSort',
        /** 游戏版本 */
        VERSION: '1.0.0',
        /** 最大关卡数 */
        MAX_LEVEL: 100,
        /** 每关初始时间（秒） */
        LEVEL_TIME: 60,
        /** 连击加分 */
        COMBO_SCORE: 50,
        /** 基础得分 */
        BASE_SCORE: 10,
        /** 星级评定：三星分数阈值 */
        STAR3_SCORE: 500,
        /** 星级评定：二星分数阈值 */
        STAR2_SCORE: 300,
        /** 星级评定：一星分数阈值 */
        STAR1_SCORE: 100,
        /** 食物种类数量 */
        FOOD_TYPE_COUNT: 5,
        /** 每关食物槽数量 */
        SLOT_COUNT: 7,
        /** 食物生成间隔（秒） */
        FOOD_SPAWN_INTERVAL: 2,
        /** 动画默认时长（秒） */
        ANIM_DURATION: 0.3,
        /** 音频：背景音乐音量 */
        MUSIC_VOLUME: 0.8,
        /** 音频：音效音量 */
        SFX_VOLUME: 1.0,
    };

    // ==================== 配置路径 ====================

    /**
     * 设置 JSON 配置根目录
     * @param rootPath resources 下的目录路径，默认 'config/'
     */
    setConfigRoot(rootPath: string): void {
        this._configRoot = rootPath;
    }
    /** 获取当前关卡ID */
    getCurLevel(){
        return App.storage.get(DSStorageKey.Level, 1);
    }
    /** 进入下一关 */
    nextLevel(){
        const curLevel = this.getCurLevel();
        App.storage.set(DSStorageKey.Level, curLevel + 1);
        GameUtils.doUploadWXUserCloudFunc();
    }

    // ==================== 关卡配置加载 ====================

    /**
     * 加载指定关卡的配置
     * @param levelId 关卡 ID
     * @returns 关卡配置数据
     */
    async loadLevelConfig(levelId: number): Promise<any> {
        // 检查缓存
        const cached = this._levelConfigs.get(levelId);
        if (cached) return cached;

        if(levelId>60){
            levelId = 10+Math.floor(Math.random()*50);
        }

        const path = `${this._configRoot}Level_${levelId}`;
        const data = await App.res.loadJsonAsync(path);
        this._levelConfigs.set(levelId, data);
        return data;
    }

    /**
     * 批量加载关卡配置
     * @param levelIds 关卡 ID 数组
     * @returns 所有关卡配置
     */
    async loadLevelConfigs(levelIds: number[]): Promise<Map<number, any>> {
        const results = new Map<number, any>();

        // 分离已缓存和未加载的
        const uncached: number[] = [];
        for (const id of levelIds) {
            const cached = this._levelConfigs.get(id);
            if (cached) {
                results.set(id, cached);
            } else {
                uncached.push(id);
            }
        }

        if (uncached.length === 0) return results;

        // 并行加载未缓存的
        const promises = uncached.map(id =>
            App.res.loadJsonAsync(`${this._configRoot}level_${id}`)
                .then(data => {
                    this._levelConfigs.set(id, data);
                    results.set(id, data);
                })
        );

        await Promise.all(promises);
        return results;
    }

    /**
     * 预加载关卡范围（如 1-10 关）
     * @param from 起始关卡
     * @param to 结束关卡（含）
     */
    async preloadLevelRange(from: number, to: number): Promise<void> {
        const ids: number[] = [];
        for (let i = from; i <= to; i++) {
            if (!this._levelConfigs.has(i)) {
                ids.push(i);
            }
        }
        if (ids.length > 0) {
            await this.loadLevelConfigs(ids);
        }
    }

    /**
     * 获取已缓存的关卡配置
     * @param levelId 关卡 ID
     */
    getLevelConfig(levelId: number): any | null {
        return this._levelConfigs.get(levelId) || null;
    }

    /**
     * 获取关卡配置中的指定字段
     * @param levelId 关卡 ID
     * @param key 字段名
     * @param defaultValue 默认值
     */
    getLevelConfigField<T = any>(levelId: number, key: string, defaultValue?: T): T | undefined {
        const config = this._levelConfigs.get(levelId);
        if (!config) return defaultValue;
        return config[key] !== undefined ? config[key] : defaultValue;
    }

    // ==================== 通用 JSON 配置加载 ====================

    /**
     * 加载任意 JSON 配置文件
     * @param fileName 文件名（不含扩展名）
     * @returns 配置数据
     */
    async loadConfig<T = any>(fileName: string): Promise<T> {
        const path = `${this._configRoot}${fileName}`;
        return App.res.loadJsonAsync<T>(path);
    }

    // ==================== 缓存管理 ====================

    /**
     * 清除指定关卡的缓存
     * @param levelId 关卡 ID
     */
    clearLevelCache(levelId: number): void {
        this._levelConfigs.delete(levelId);
    }

    /**
     * 清除所有关卡配置缓存
     */
    clearAllLevelCache(): void {
        this._levelConfigs.clear();
    }

    /**
     * 获取已缓存的关卡数量
     */
    getCachedLevelCount(): number {
        return this._levelConfigs.size;
    }
}

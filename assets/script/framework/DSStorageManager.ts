import { sys } from 'cc';
import { App } from './DSAppManager';

/**
 * 本地缓存键名枚举
 * 外部可扩展，统一管理所有缓存 key
 */
export enum DSStorageKey {
    Init = 'Init',
    /** 示例键名，业务中按需扩展 */
    Level = 'Levelbaozi',
    Zhen_Dong_Status = 'Zhen_Dong_Status',
    Music_Eff_Status = 'Music_Eff_Status',
    Music_Status = 'Music_Status',
    Life = 'Life',
    CurTimeCount = 'CurTimeCount',
}

/**
 * DSStorageManager - 本地缓存管理器
 * 基于 sys.localStorage 封装，提供类型安全的存取、过期管理、批量操作等功能。
 * 
 * 使用方式：
 *   const storage = new DSStorageManager();
 *   storage.set('userName', '张三');
 *   const name = storage.get('userName', '默认值');
 *   storage.setWithExpire('token', 'xxx', 3600); // 1小时过期
 */
export class DSStorageManager {

    /** 存储键前缀，避免与其他模块冲突 */
    private readonly PREFIX: string = 'ds_';

    /** 过期时间后缀 */
    private readonly EXPIRE_SUFFIX: string = '_expire';

    init(){
        if(this.get(DSStorageKey.Init)){
            return;
        }
        this.set(DSStorageKey.Init, true);

        if(!this.get(DSStorageKey.Level)){
            this.set(DSStorageKey.Level, 1);
        }
        if(!this.get(DSStorageKey.Life)){
            this.set(DSStorageKey.Life, 5);
        }
        if(!this.get(DSStorageKey.Music_Eff_Status)){
            this.set(DSStorageKey.Music_Eff_Status, true);
        }
        if(!this.get(DSStorageKey.Music_Status)){
            this.set(DSStorageKey.Music_Status, true);
        }
        if(!this.get(DSStorageKey.Zhen_Dong_Status)){
            this.set(DSStorageKey.Zhen_Dong_Status, true);
        }

    }

    // ==================== 基础存取 ====================

    /**
     * 存储数据
     * @param key 键名（自动添加前缀）
     * @param value 值（支持 string/number/boolean/object）
     */
    set(key: string, value: any): void {
        const fullKey = this._getKey(key);
        let strValue: string;

        if (typeof value === 'string') {
            strValue = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            strValue = String(value);
        } else if (typeof value === 'object') {
            strValue = JSON.stringify(value);
        } else {
            strValue = String(value);
        }

        sys.localStorage.setItem(fullKey, strValue);
        if(key == DSStorageKey.Music_Status){
            if(!value){
                App.audio.pauseMusic();
            }else{
                App.audio.resumeMusic();
            }
        }

    }

    /**
     * 读取数据
     * @param key 键名
     * @param defaultValue 默认值（未找到或已过期时返回）
     * @returns 存储的值或默认值
     */
    get(key: string, defaultValue?: any): any {
        const fullKey = this._getKey(key);

        // 检查是否过期
        if (this._isExpired(key)) {
            this.remove(key);
            return defaultValue;
        }

        const value = sys.localStorage.getItem(fullKey);
        if (value === null || value === undefined) {
            return defaultValue;
        }

        // 尝试解析 JSON
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * 读取字符串
     */
    getString(key: string, defaultValue: string = ''): string {
        const val = this.get(key);
        return val !== undefined && val !== null ? String(val) : defaultValue;
    }

    /**
     * 读取数字
     */
    getNumber(key: string, defaultValue: number = 0): number {
        const val = this.get(key);
        if (val === undefined || val === null) return defaultValue;
        const num = Number(val);
        return isNaN(num) ? defaultValue : num;
    }

    /**
     * 读取布尔值
     */
    getBoolean(key: string, defaultValue: boolean = false): boolean {
        const val = this.get(key);
        if (val === undefined || val === null) return defaultValue;
        if (typeof val === 'boolean') return val;
        if (val === 'true' || val === '1') return true;
        if (val === 'false' || val === '0') return false;
        return defaultValue;
    }

    /**
     * 读取对象
     */
    getObject<T = any>(key: string, defaultValue?: T): T | undefined {
        const val = this.get(key);
        if (val === undefined || val === null) return defaultValue;
        if (typeof val === 'object') return val as T;
        return defaultValue;
    }

    // ==================== 过期管理 ====================

    /**
     * 存储带过期时间的数据
     * @param key 键名
     * @param value 值
     * @param expireSeconds 过期时间（秒）
     */
    setWithExpire(key: string, value: any, expireSeconds: number): void {
        this.set(key, value);
        const expireKey = this._getExpireKey(key);
        const expireTime = Date.now() + expireSeconds * 1000;
        sys.localStorage.setItem(expireKey, String(expireTime));
    }

    /**
     * 检查键是否已过期
     */
    private _isExpired(key: string): boolean {
        const expireKey = this._getExpireKey(key);
        const expireStr = sys.localStorage.getItem(expireKey);
        if (!expireStr) return false;

        const expireTime = Number(expireStr);
        return Date.now() > expireTime;
    }

    /**
     * 获取剩余有效时间（秒），-1 表示永不过期，-2 表示已过期或不存在
     */
    getRemainTime(key: string): number {
        if (!this.has(key)) return -2;

        const expireKey = this._getExpireKey(key);
        const expireStr = sys.localStorage.getItem(expireKey);
        if (!expireStr) return -1;

        const expireTime = Number(expireStr);
        const remain = expireTime - Date.now();
        return remain > 0 ? Math.floor(remain / 1000) : -2;
    }

    // ==================== 删除与判断 ====================

    /**
     * 删除指定键
     */
    remove(key: string): void {
        const fullKey = this._getKey(key);
        const expireKey = this._getExpireKey(key);
        sys.localStorage.removeItem(fullKey);
        sys.localStorage.removeItem(expireKey);
    }

    /**
     * 判断键是否存在（且未过期）
     */
    has(key: string): boolean {
        if (this._isExpired(key)) {
            this.remove(key);
            return false;
        }
        const fullKey = this._getKey(key);
        return sys.localStorage.getItem(fullKey) !== null;
    }

    /**
     * 清空所有带 ds_ 前缀的缓存数据
     */
    clearAll(): void {
        const keysToRemove: string[] = [];
        const length = sys.localStorage.length;

        for (let i = 0; i < length; i++) {
            const key = sys.localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(k => sys.localStorage.removeItem(k));
    }

    /**
     * 获取所有带 ds_ 前缀的键名（不含前缀）
     */
    getAllKeys(): string[] {
        const keys: string[] = [];
        const length = sys.localStorage.length;

        for (let i = 0; i < length; i++) {
            const key = sys.localStorage.key(i);
            if (key && key.startsWith(this.PREFIX) && !key.endsWith(this.EXPIRE_SUFFIX)) {
                keys.push(key.substring(this.PREFIX.length));
            }
        }

        return keys;
    }

    /**
     * 获取缓存总数
     */
    getCount(): number {
        return this.getAllKeys().length;
    }

    // ==================== 批量操作 ====================

    /**
     * 批量存储
     * @param data 键值对对象
     */
    setBatch(data: Record<string, any>): void {
        for (const key in data) {
            this.set(key, data[key]);
        }
    }

    /**
     * 批量读取
     * @param keys 键名数组
     * @returns 键值对对象
     */
    getBatch(keys: string[]): Record<string, any> {
        const result: Record<string, any> = {};
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    /**
     * 批量删除
     * @param keys 键名数组
     */
    removeBatch(keys: string[]): void {
        for (const key of keys) {
            this.remove(key);
        }
    }

    // ==================== 内部工具 ====================

    /** 获取带前缀的完整键名 */
    private _getKey(key: string): string {
        return this.PREFIX + key;
    }

    /** 获取过期时间键名 */
    private _getExpireKey(key: string): string {
        return this.PREFIX + key + this.EXPIRE_SUFFIX;
    }
}

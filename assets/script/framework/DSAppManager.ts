import { DSEventManager } from './DSEventManager';
import { DSStorageManager } from './DSStorageManager';
import { DSResManager } from './DSResManager';
import { DSUiManager } from './DSUiManager';
import { DSGameConfig } from './DSGameConfig';
import { DSTimerManager } from './DSTimerManager';
import { DSAudioManager } from './DSAudioManager';
import { DSGlobalFunc } from './DSGlobalFunc';
import { WxManager, WxMgr } from '../wx/wxManager';

/**
 * DSAppManager - 所有管理器统一入口
 * 在 init() 中实例化各子管理器，通过 App 全局实例访问。
 * 
 * 使用方式：
 *   import { App } from './framework/DSAppManager';
 *   App.init();
 *   App.event.on('xxx', callback, this);
 *   App.storage.set('key', value);
 *   App.res.loadPrefab('path', callback);
 *   App.ui.openView('ViewName', params);
 */
export class DSAppManager {

    /** 事件管理器 */
    event!: DSEventManager;

    /** 本地缓存管理器 */
    storage!: DSStorageManager;

    /** 资源加载管理器 */
    res!: DSResManager;

    /** 界面管理器 */
    ui!: DSUiManager;

    /** 游戏配置管理器 */
    gameConfig!: DSGameConfig;

    /** 时间管理器 */
    timer!: DSTimerManager;

    /** 音乐音效管理器 */
    audio!: DSAudioManager;

    /** 全局通用函数管理器 */
    global!: DSGlobalFunc;

    /** 是否已初始化 */
    private _inited: boolean = false;

    /**
     * 初始化所有管理器
     */
    init(): void {
        if (this._inited) return;

        this.event = new DSEventManager();
        this.storage = new DSStorageManager();
        this.res = new DSResManager();
        this.ui = new DSUiManager();
        this.gameConfig = new DSGameConfig();
        this.audio = new DSAudioManager();
        this.audio.init();
        this.global = new DSGlobalFunc();
        this.storage.init();
        this.timer = new DSTimerManager();
        this.timer.init();

        this._inited = true;
        WxMgr.init();
    }

    /**
     * 销毁所有管理器，释放资源
     */
    destroy(): void {
        this.event.destroy();
        this.storage.clearAll();
        this.ui.closeAllViews();
        this._inited = false;
    }
}

/** 全局实例 */
export const App = new DSAppManager();

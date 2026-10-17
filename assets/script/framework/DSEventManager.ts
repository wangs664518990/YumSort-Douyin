/**
 * 事件键名枚举
 * 外部可扩展，统一管理所有事件名
 */
export enum DSEventKey {
    /** 示例事件名，业务中按需扩展 */
    OnClick_Item = 'OnClick_Item',
    SelectedTarget = 'SelectedTarget',
    AddSmaillToTop = 'AddSmaillToTop',
    StartEliminate = 'StartEliminate',
    TimeDown = 'TimeDown',
    NextLevel = 'NextLevel',
    reAlive = 'reAlive',
    UpdateLife = 'UpdateLife',
}

/**
 * 事件回调类型
 */
type EventCallback = (...args: any[]) => void;

/**
 * 事件监听项
 */
interface EventListener {
    callback: EventCallback;
    target: any;
    once: boolean;
}

/**
 * DSEventManager - 事件管理器
 * 提供自定义事件的注册、派发、移除功能，支持 once 和按 target 批量解绑。
 * 
 * 使用方式：
 *   const eventMgr = new DSEventManager();
 *   eventMgr.on('gameStart', this.onGameStart, this);
 *   eventMgr.emit('gameStart', data);
 *   eventMgr.off('gameStart', this.onGameStart, this);
 */
export class DSEventManager {

    /** 事件映射表：事件名 -> 监听器列表 */
    private _eventMap: Map<string, EventListener[]> = new Map();

    /**
     * 注册事件监听
     * @param eventName 事件名
     * @param callback 回调函数
     * @param target 绑定目标（用于批量解绑）
     */
    on(eventName: string, callback: EventCallback, target?: any): void {
        if (!this._eventMap.has(eventName)) {
            this._eventMap.set(eventName, []);
        }

        const listeners = this._eventMap.get(eventName)!;

        // 防止重复注册
        for (const item of listeners) {
            if (item.callback === callback && item.target === target) {
                return;
            }
        }

        listeners.push({ callback, target, once: false });
    }

    /**
     * 注册一次性事件监听（触发后自动移除）
     * @param eventName 事件名
     * @param callback 回调函数
     * @param target 绑定目标
     */
    once(eventName: string, callback: EventCallback, target?: any): void {
        if (!this._eventMap.has(eventName)) {
            this._eventMap.set(eventName, []);
        }

        const listeners = this._eventMap.get(eventName)!;
        listeners.push({ callback, target, once: true });
    }

    /**
     * 派发事件
     * @param eventName 事件名
     * @param args 传递给回调的参数
     */
    emit(eventName: string, ...args: any[]): void {
        const listeners = this._eventMap.get(eventName);
        if (!listeners || listeners.length === 0) return;

        // 复制一份再遍历，防止回调中修改列表
        const copy = [...listeners];

        for (const item of copy) {
            item.callback.apply(item.target, args);

            // once 监听器触发后移除
            if (item.once) {
                const idx = listeners.indexOf(item);
                if (idx !== -1) {
                    listeners.splice(idx, 1);
                }
            }
        }
    }

    /**
     * 移除指定事件监听
     * @param eventName 事件名
     * @param callback 回调函数（不传则移除该事件下所有监听）
     * @param target 目标对象（不传则移除所有匹配的回调）
     */
    off(eventName: string, callback?: EventCallback, target?: any): void {
        const listeners = this._eventMap.get(eventName);
        if (!listeners) return;

        if (!callback) {
            // 不传 callback，移除该事件下所有监听
            this._eventMap.delete(eventName);
            return;
        }

        for (let i = listeners.length - 1; i >= 0; i--) {
            const item = listeners[i];
            if (item.callback === callback && (target === undefined || item.target === target)) {
                listeners.splice(i, 1);
            }
        }

        // 列表为空时清理 key
        if (listeners.length === 0) {
            this._eventMap.delete(eventName);
        }
    }

    /**
     * 移除指定 target 上绑定的所有事件
     * @param target 目标对象
     */
    offTarget(target: any): void {
        this._eventMap.forEach((listeners, eventName) => {
            for (let i = listeners.length - 1; i >= 0; i--) {
                if (listeners[i].target === target) {
                    listeners.splice(i, 1);
                }
            }

            if (listeners.length === 0) {
                this._eventMap.delete(eventName);
            }
        });
    }

    /**
     * 移除指定事件名下属于某个 target 的所有监听
     * @param eventName 事件名
     * @param target 目标对象
     */
    offTargetForEvent(eventName: string, target: any): void {
        const listeners = this._eventMap.get(eventName);
        if (!listeners) return;

        for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i].target === target) {
                listeners.splice(i, 1);
            }
        }

        if (listeners.length === 0) {
            this._eventMap.delete(eventName);
        }
    }

    /**
     * 判断某个事件是否有监听者
     * @param eventName 事件名
     */
    hasListener(eventName: string): boolean {
        const listeners = this._eventMap.get(eventName);
        return listeners ? listeners.length > 0 : false;
    }

    /**
     * 获取某个事件的监听者数量
     * @param eventName 事件名
     */
    getListenerCount(eventName: string): number {
        const listeners = this._eventMap.get(eventName);
        return listeners ? listeners.length : 0;
    }

    /**
     * 清空所有事件监听
     */
    clear(): void {
        this._eventMap.clear();
    }

    /**
     * 销毁管理器，释放所有资源
     */
    destroy(): void {
        this.clear();
    }
}

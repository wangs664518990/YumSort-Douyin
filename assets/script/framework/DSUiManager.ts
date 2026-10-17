import { Node, Prefab, instantiate, Component, director, error, warn } from 'cc';
import { App } from './DSAppManager';
import { DSBaseView, ViewLayer } from './DSBaseView';
import { tipsView } from '../game/tipsView';

/**
 * 界面名称枚举
 * 外部可扩展，统一管理所有界面名称
 */
export enum DSViewName {
    /** 示例界面名，业务中按需扩展 */
    gameView = 'prefab/ui/gameView',
    tipsView = 'prefab/ui/tipsView',
    loadingView = 'prefab/ui/loadingView',
    homeView = 'prefab/ui/homeView',
    settingView = 'prefab/ui/settingView',
    rankView = 'prefab/ui/rankView',
    resultView = 'prefab/ui/resultView',
    unLockTool = 'prefab/ui/unLockTool',
    getLifeView = 'prefab/ui/getLifeView',
    leaveView = 'prefab/ui/leaveView',
}
/** 非界面元素 */
export enum Pieces {
        /** 盘子 */
        zhenlong = "prefab/pieces/zhenlong",
        /** 包子 */
        baozi = "prefab/pieces/baozi",
        /** 盘子 */
        panzi = "prefab/pieces/panzi",
    }
/**
 * DSUiManager - 界面管理器
 * 负责界面的打开、关闭，结合资源加载管理器自动加载预制体并挂载脚本。
 * 
 * 使用方式：
 *   const uiMgr = new DSUiManager();
 *   uiMgr.openView('MyDialog', { title: '提示', content: '这是一条消息' });
 *   uiMgr.closeView('MyDialog');
 */
export class DSUiManager {

    /** 资源加载管理器（引用 App 中的实例） */
    private get _resMgr() {
        return App.res;
    }

    /** 已打开的界面映射：界面名 -> 节点 */
    private _viewMap: Map<string, Node> = new Map();

    /** UI 根节点（所有界面挂载的父节点） */
    private _uiRoot: Node | null = null;

    constructor() {
        // 资源加载管理器通过 App.res 获取，无需外部传入
    }

    // ==================== 配置 ====================

    /**
     * 设置 UI 根节点
     * @param root 所有界面的父节点，不设置则默认挂载到 Canvas
     */
    setUIRoot(root: Node): void {
        this._uiRoot = root;
    }

    // ==================== 打开界面 ====================

    /**
     * 打开界面
     * @param viewName 界面名称（与预制体文件名和脚本名保持一致）
     * @param params 传递给界面的参数（可选）
     */
    openView(viewName: string, params?: any): void {
        console.log(`[DSUiManager] 打开界面: ${viewName}`);
        // 如果界面已打开，直接复用
        if (this._viewMap.has(viewName)) {
            const existingNode = this._viewMap.get(viewName)!;
            existingNode.active = true;

            // 调用 show 方法（如果存在）
            const viewComp = existingNode.getComponent(viewName) as any;
            if (viewComp && typeof viewComp.show === 'function') {
                viewComp.show();
            }
            return;
        }

        // 加载预制体
        const prefabPath = viewName;
        this._resMgr.loadPrefab(prefabPath, (err, prefab) => {
            if (err) {
                error(`[DSUiManager] 加载预制体失败: ${prefabPath}`, err);
                return;
            }

            // 实例化
            const node = instantiate(prefab!);
            let compName = node.name

            // 检查并挂载同名脚本组件
            this._ensureComponent(node, compName);

            // 缓存节点
            this._viewMap.set(viewName, node);

            // 传递参数给界面
            let viewComp: DSBaseView = node.getComponent(compName) as any;
            
            // 挂载到 UI 根节点（放在最后，确保脚本初始化完成后再添加到场景树）
            const parent = this._getUIRoot(viewComp.viewLayer);
            node.setParent(parent);
            if (viewComp) {
                if (typeof viewComp.initParams === 'function') {
                    viewComp.initParams(params);
                }
            }else{
                warn(`[DSUiManager] 挂载脚本 "${compName}" 失败，请确保脚本已注册到 Cocos 中`);
                return;
            }
        });
    }

    // ==================== 关闭界面 ====================

    /**
     * 关闭界面（销毁节点）
     * @param viewName 界面名称
     */
    closeView(viewName: string): void {
        const node = this._viewMap.get(viewName);
        if (!node) {
            warn(`[DSUiManager] 关闭界面失败，界面未打开: ${viewName}`);
            return;
        }

        // 调用 hide 方法（如果存在）
        const viewComp = node.getComponent(viewName) as any;
        if (viewComp && typeof viewComp.hide === 'function') {
            viewComp.hide();
        }

        // 销毁节点
        node.destroy();
        this._viewMap.delete(viewName);
    }

    /**
     * 隐藏界面（不销毁，仅设置 active = false）
     * @param viewName 界面名称
     */
    hideView(viewName: string): void {
        const node = this._viewMap.get(viewName);
        if (!node) {
            warn(`[DSUiManager] 隐藏界面失败，界面未打开: ${viewName}`);
            return;
        }

        const viewComp = node.getComponent(viewName) as any;
        if (viewComp && typeof viewComp.hide === 'function') {
            viewComp.hide();
        } else {
            node.active = false;
        }
    }

    /**
     * 关闭所有界面
     */
    closeAllViews(): void {
        this._viewMap.forEach((node, viewName) => {
            const viewComp = node.getComponent(viewName) as any;
            if (viewComp && typeof viewComp.hide === 'function') {
                viewComp.hide();
            }
            node.destroy();
        });
        this._viewMap.clear();
    }

    // ==================== 查询 ====================

    /**
     * 获取已打开的界面节点
     * @param viewName 界面名称
     */
    getView(viewName: string): Node | null {
        return this._viewMap.get(viewName) || null;
    }

    /**
     * 获取界面上的脚本组件
     * @param viewName 界面名称
     */
    getViewComponent<T extends Component>(viewName: string): T | null {
        const node = this._viewMap.get(viewName);
        if (!node) return null;
        return node.getComponent(viewName) as T;
    }

    /**
     * 判断界面是否已打开
     * @param viewName 界面名称
     */
    isViewOpen(viewName: string): boolean {
        const node = this._viewMap.get(viewName);
        return node ? node.isValid && node.active : false;
    }

    /**
     * 获取所有已打开的界面名称
     */
    getOpenedViews(): string[] {
        return Array.from(this._viewMap.keys());
    }

    // ==================== 内部方法 ====================

    /**
     * 获取 UI 根节点，找不到则自动查找 Canvas
     */
    private _getUIRoot(layer: number): Node {
        if (this._uiRoot && this._uiRoot.isValid) {
            return this._uiRoot;
        }

        // 自动查找 Canvas
        const scene = director.getScene();
        if (scene) {
            const canvas = scene.getChildByName('Canvas');
            if (canvas) {
                switch(layer){
                    case ViewLayer.BASE:
                        this._uiRoot = canvas.getChildByName("base");
                        break;
                    case ViewLayer.POP:
                        this._uiRoot = canvas.getChildByName("pop");
                        break;
                    case ViewLayer.NOTICE:
                        this._uiRoot = canvas.getChildByName("notice");
                        break;
                    default:
                        this._uiRoot = canvas;
                        return canvas;
                }
                this._uiRoot = canvas;
                return canvas;
            }
        }

        // 兜底：使用场景根节点
        error('[DSUiManager] 未找到 UI 根节点，请调用 setUIRoot() 设置');
        return scene || new Node('UIRoot');
    }

    /**
     * 确保节点上挂载了同名脚本组件
     * @param node 目标节点
     * @param componentName 组件名（与脚本文件名一致）
     */
    private _ensureComponent(node: Node, componentName: string): void {
        // 检查是否已挂载
        const existing = node.getComponent(componentName);
        if (existing) {
            return;
        }

        // 动态挂载：尝试通过 node.addComponent(componentName)
        // 前提是该脚本已在项目中注册
        try {
            node.addComponent(componentName as any);
        } catch (e) {
            warn(`[DSUiManager] 挂载脚本 "${componentName}" 失败，请确保脚本已注册到 Cocos 中`);
        }
    }

        /**
     * 显示消息提示
     * @param msg 提示消息
     */
    public async showMsgTips(msg: string): Promise<void> {
        let tipsPre = await App.res.loadPrefabAsync(DSViewName.tipsView)        
        let tipsNode = instantiate(tipsPre);
        tipsNode.parent = this._getUIRoot(ViewLayer.POP);
        let tsView = tipsNode.getComponent(tipsView);
        tsView.setTips(msg);
        tsView.setCloseFunc(() => {
            tipsNode.destroy();
        });
    }
}

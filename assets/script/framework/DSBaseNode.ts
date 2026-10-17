import { _decorator, Component, Node, Button, tween, Vec3, Color, Label } from 'cc';
import { App } from './DSAppManager';

const { ccclass } = _decorator;

/**
 * DSBaseNode - 节点基类
 * 继承 Component，提供子节点遍历、路径查找、按钮事件绑定等功能。
 * 业务组件继承此类后，只需重写对应按钮事件名的方法即可自动响应点击。
 */
@ccclass('DSBaseNode')
export class DSBaseNode extends Component {
    /** 存储所有子节点的映射（节点名 -> Node） */
    protected _childMap: Map<string, Node> = new Map();

    /** 存储所有子节点的列表 */
    protected _allChildren: Node[] = [];

    /** 存储已绑定的按钮及其事件名 */
    private _buttonEvents: Map<Node, string> = new Map();

    onLoad() {
        this._initNodes();
        this._bindButtonEvents();
        this.addEvents();
    }

    addEvents(){

    }

    // ==================== 初始化 ====================

    /**
     * 遍历当前节点下所有子节点，存入映射表
     */
    private _initNodes(): void {
        this._childMap.clear();
        this._allChildren = [];
        this._traverseChildren(this.node);
    }

    /**
     * 递归遍历子节点
     */
    private _traverseChildren(parent: Node): void {
        const children = parent.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            this._allChildren.push(child);

            // 用路径作为 key 存储，方便通过路径直接查找
            // 同时用节点名存储（同名节点会被覆盖，优先使用路径查找）
            if (!this._childMap.has(child.name)) {
                this._childMap.set(child.name, child);
            }

            // 递归遍历子节点的子节点
            this._traverseChildren(child);
        }
    }

    // ==================== 节点查找 ====================

    /**
     * 通过节点路径获取节点
     * 路径格式: "A/B/C" 或直接传节点名 "C"
     * @param path 节点路径，以 "/" 分隔层级
     * @returns 找到的节点，未找到返回 null
     */
    protected getNodeByPath(path: string): Node | null {
        if (!path) return null;

        // 先尝试从映射表直接获取（适用于无重复节点名）
        const direct = this._childMap.get(path);
        if (direct) return direct;

        // 按路径逐级查找
        const parts = path.split('/');
        let current: Node | null = this.node;

        for (const part of parts) {
            if (!current) return null;
            current = this._findDirectChild(current, part);
        }

        return current;
    }

    /**
     * 在指定父节点下查找直接子节点
     */
    private _findDirectChild(parent: Node, name: string): Node | null {
        const children = parent.children;
        for (let i = 0; i < children.length; i++) {
            if (children[i].name === name) {
                return children[i];
            }
        }
        return null;
    }

    // ==================== 按钮事件 ====================

    /** 按钮点击缩放比例 */
    private readonly BTN_PRESS_SCALE: number = 0.9;

    /** 按钮缩放动画时长（秒） */
    private readonly BTN_SCALE_DURATION: number = 0.1;

    /**
     * 遍历所有子节点，查找 Button 组件并绑定点击事件
     */
    private _bindButtonEvents(): void {
        for (const child of this._allChildren) {
            const button = child.getComponent(Button);
            if (button) {
                // 生成事件方法名：onClick + 节点名（首字母大写）
                const methodName = this._getButtonMethodName(child.name);
                this._buttonEvents.set(child, methodName);

                // 注册点击事件
                button.node.on(Button.EventType.CLICK, () => {
                    this._onButtonClicked(child, methodName);
                });

                // 添加按压缩放效果
                this._addButtonScaleEffect(child, button);
            }
        }
    }

    /**
     * 为按钮添加点击缩放效果（缩小到 0.9 倍，松开恢复）
     */
    private _addButtonScaleEffect(node: Node, button: Button): void {
        node.on(Node.EventType.TOUCH_START, () => {
            if (!button.interactable) return;
            tween(node)
                .to(this.BTN_SCALE_DURATION, { scale: new Vec3(this.BTN_PRESS_SCALE, this.BTN_PRESS_SCALE, 1) })
                .start();
        });

        node.on(Node.EventType.TOUCH_END, () => {
            tween(node)
                .to(this.BTN_SCALE_DURATION, { scale: new Vec3(1, 1, 1) })
                .start();
        });

        node.on(Node.EventType.TOUCH_CANCEL, () => {
            tween(node)
                .to(this.BTN_SCALE_DURATION, { scale: new Vec3(1, 1, 1) })
                .start();
        });
    }

    /**
     * 根据节点名生成按钮回调方法名
     * 规则：onClick + 节点名（首字母大写）
     * 例如：节点名 "startBtn" -> 方法名 "onClickStartBtn"
     */
    private _getButtonMethodName(nodeName: string): string {
        if (!nodeName || nodeName.length === 0) return '';
        return 'onClick' + nodeName//.charAt(0).toUpperCase() + nodeName.slice(1);
    }

    /**
     * 按钮点击时的内部处理
     * 通过反射调用对应的方法
     */
    private _onButtonClicked(node: Node, methodName: string): void {
        if (!methodName) return;
        const handler = (this as any)[methodName];
        if (typeof handler === 'function') {
            handler.call(this, node);
        } else {
            console.warn(
                `[DSBaseNode] 按钮 "${node.name}" 点击事件未处理：请重写 "${methodName}" 方法`
            );
        }
    }

    /**
     * 手动为某个节点绑定按钮事件（用于动态创建的节点）
     * @param node 目标节点
     * @param methodName 自定义方法名（可选，默认按规则生成）
     */
    protected bindButtonEvent(node: Node, methodName?: string): void {
        const button = node.getComponent(Button);
        if (!button) {
            console.warn(`[DSBaseNode] 节点 "${node.name}" 上没有 Button 组件`);
            return;
        }

        const mName = methodName || this._getButtonMethodName(node.name);
        this._buttonEvents.set(node, mName);

        button.node.on(Button.EventType.CLICK, () => {
            this._onButtonClicked(node, mName);
        });
    }

    /**
     * 获取所有已绑定的按钮及其事件方法名
     */
    protected getButtonEvents(): Map<Node, string> {
        return this._buttonEvents;
    }

    // ==================== 工具方法 ====================

    /**
     * 获取所有子节点列表
     */
    protected getAllChildren(): Node[] {
        return this._allChildren;
    }

    /**
     * 获取子节点映射表
     */
    protected getChildMap(): Map<string, Node> {
        return this._childMap;
    }

    onDestroy() {
        // 清理按钮事件
        // this._buttonEvents.forEach((_, node) => {
        //     node.targetOff(this);
        // });
        this._buttonEvents.clear();
        this._childMap.clear();
        this._allChildren = [];
        App.event.offTarget(this);
    }

        /**
     * 设置节点上的文本内容
     * @param node 带有 Label 组件的节点
     * @param text 文本内容字符串
     * @param color 文本颜色（可选，不传则不修改颜色）
     */
    protected setLabelText(node: Node, text: string, color?: Color): void {
        if (!node) {
            console.warn('[DSBaseView] setLabelText: 节点为空');
            return;
        }

        const label = node.getComponent(Label);
        if (!label) {
            console.warn(`[DSBaseView] setLabelText: 节点 "${node.name}" 上没有 Label 组件`);
            return;
        }

        label.string = text;

        if (color) {
            label.color = color;
        }
    }
}

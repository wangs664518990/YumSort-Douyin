import { _decorator, Node, Button, Label, Color, tween, Vec3, UITransform, Widget, UIOpacity, Enum, Graphics, view, screen } from 'cc';
import { DSBaseNode } from './DSBaseNode';
import { App } from './DSAppManager';
import { DSViewName } from './DSUiManager';

const { ccclass, property } = _decorator;

/**
 * 界面层级枚举
 */
export enum ViewLayer {
    /** 基础层 */
    BASE = 0,
    /** 弹窗层 */
    POP = 1,
    /** 通知层（最高） */
    NOTICE = 2,
}

/**
 * DSBaseView - 界面基类
 * 继承 DSBaseNode，提供弹窗动画、遮罩控制、层级管理、文本设置等功能。
 * 
 * 使用方式：
 * 1. 继承此类，在编辑器中勾选 needAnim / needMask 控制动画和遮罩
 * 2. 调用 show() / hide() 控制界面显隐
 * 3. 调用 setLabelText() 快速设置文本
 */
@ccclass('DSBaseView')
export class DSBaseView extends DSBaseNode {

    // ==================== 编辑器属性 ====================

    @property({ tooltip: '是否启用弹窗动画（经典的缩放+淡入弹窗效果）' })
    needAnim: boolean = true;

    @property({ tooltip: '是否显示黑色半透明遮罩（遮罩不可点击）' })
    needMask: boolean = true;

    @property({
        type: Enum(ViewLayer),
        tooltip: '界面层级：BASE=基础层, POP=弹窗层, NOTICE=通知层'
    })
    viewLayer: ViewLayer = ViewLayer.BASE;

    // ==================== 私有变量 ====================

    /** 遮罩节点 */
    private _maskNode: Node | null = null;

    /** 动画时长（秒） */
    private _animDuration: number = 0.3;

    /** 弹窗动画的起始缩放比例 */
    private _animStartScale: number = 0.6;

    // ==================== 生命周期 ====================

    onLoad() {
        super.onLoad();

        // 创建遮罩
        if (this.needMask) {
            this._createMask();
        }

        // 设置层级
        this._applyLayer();

        // 自动播放显示动画
        this.show();
    }

    initParams(params?: any){}
    

    // ==================== 遮罩 ====================

    /**
     * 创建黑色半透明遮罩（不可点击，挂在父节点上，位于当前节点下方）
     */
    private _createMask(): void {
        const parent = this.node.parent;
        if (!parent) {
            console.warn('[DSBaseView] 创建遮罩失败：当前节点没有父节点');
            return;
        }

        this._maskNode = new Node('DSMask');
        // 遮罩挂在父节点上，放在当前节点之前
        this._maskNode.setParent(parent);
        const siblingIndex = this.node.getSiblingIndex();
        this._maskNode.setSiblingIndex(Math.max(0, siblingIndex));

        // 设置遮罩层级最低，确保不拦截点击
        this._maskNode.layer = parent.layer;

        // 获取设计分辨率尺寸
        const visibleSize = view.getVisibleSize();
        const width = visibleSize.width;
        const height = visibleSize.height;

        // 添加 UITransform，设置为全屏
        const uiTransform = this._maskNode.addComponent(UITransform);
        uiTransform.setContentSize(width, height);
        uiTransform.setAnchorPoint(0.5, 0.5);

        // 添加 Widget 实现全屏拉伸
        const widget = this._maskNode.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;

        // 使用 Graphics 绘制纯色黑色半透明矩形（不依赖任何纹理资源）
        const graphics = this._maskNode.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();

        this._maskNode.addComponent(Button);
    }

    /**
     * 设置遮罩是否可见
     * @param visible 是否可见
     */
    protected setMaskVisible(visible: boolean): void {
        if (this._maskNode) {
            this._maskNode.active = visible;
        }
    }

    /**
     * 获取遮罩节点
     */
    protected getMaskNode(): Node | null {
        return this._maskNode;
    }

    // ==================== 层级管理 ====================

    /**
     * 应用界面层级
     * 通过设置节点的 siblingIndex 来控制渲染顺序
     * 层级越高的节点，siblingIndex 越大，渲染越靠前
     */
    private _applyLayer(): void {
        if (!this.node.parent) return;

        // 将节点移到父节点的最后（渲染在最前面）
        const parent = this.node.parent;
        const childCount = parent.children.length;
        this.node.setSiblingIndex(childCount - 1);
    }

    /**
     * 设置界面层级
     * @param layer 目标层级
     */
    protected setViewLayer(layer: ViewLayer): void {
        this.viewLayer = layer;
        this._applyLayer();
    }

    // ==================== 弹窗动画 ====================

    /**
     * 显示界面（带动画）
     */
    show(): void {
        this.node.active = true;

        // 显示遮罩
        if (this.needMask && this._maskNode) {
            this._maskNode.active = true;
        }

        if (this.needAnim) {
            this._playShowAnimation();
        }
    }

    /**
     * 隐藏界面（带动画）
     */
    hide(): void {
        if (this.needAnim) {
            this._playHideAnimation(() => {
                this.node.active = false;
                if (this._maskNode) {
                    this._maskNode.active = false;
                }
            });
        } else {
            this.node.active = false;
            if (this._maskNode) {
                this._maskNode.active = false;
            }
        }
    }

    /**
     * 播放显示动画（缩放从 0.6 到 1.0 + 淡入）
     */
    private _playShowAnimation(): void {
        // 初始状态：缩小 + 透明
        this.node.setScale(new Vec3(this._animStartScale, this._animStartScale, 1));

        const uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        uiOpacity.opacity = 0;

        // 缩放动画
        tween(this.node)
            .to(this._animDuration, { scale: new Vec3(1, 1, 1) }, {
                easing: 'backOut'
            })
            .start();

        // 透明度动画
        tween(uiOpacity)
            .to(this._animDuration, { opacity: 255 })
            .start();

        // 遮罩淡入
        if (this._maskNode) {
            const maskOpacity = this._maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                maskOpacity.opacity = 0;
                tween(maskOpacity)
                    .to(this._animDuration, { opacity: 180 })
                    .start();
            }
        }
    }

    /**
     * 播放隐藏动画（缩放从 1.0 到 0.6 + 淡出）
     * @param onComplete 动画完成回调
     */
    private _playHideAnimation(onComplete?: () => void): void {
        // 缩放动画
        tween(this.node)
            .to(this._animDuration, { scale: new Vec3(this._animStartScale, this._animStartScale, 1) }, {
                easing: 'backIn'
            })
            .call(() => {
                onComplete?.();
            })
            .start();

        // 透明度动画
        const uiOpacity = this.node.getComponent(UIOpacity);
        if (uiOpacity) {
            tween(uiOpacity)
                .to(this._animDuration, { opacity: 0 })
                .start();
        }

        // 遮罩淡出
        if (this._maskNode) {
            const maskOpacity = this._maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                tween(maskOpacity)
                    .to(this._animDuration, { opacity: 0 })
                    .start();
            }
        }
    }

    /**
     * 设置动画时长
     * @param duration 时长（秒）
     */
    protected setAnimDuration(duration: number): void {
        this._animDuration = duration;
    }

    /**
     * 设置弹窗动画起始缩放比例
     * @param scale 起始缩放值（默认 0.6）
     */
    protected setAnimStartScale(scale: number): void {
        this._animStartScale = scale;
    }

    // ==================== 文本设置 ====================

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

    // ==================== 清理 ====================

    onDestroy() {
        // 销毁时自动播放隐藏动画
        this.hide();

        // 停止所有动画
        tween(this.node).stop();

        // 清理遮罩节点
        if (this._maskNode) {
            this._maskNode.destroy();
            this._maskNode = null;
        }

        super.onDestroy();
    }
    closeSelf(){
        App.ui.closeView(DSViewName[this.node.name]);
    }

    onClickcloseBtn(){
        this.closeSelf();
    }
}

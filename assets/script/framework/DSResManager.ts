import {
    assetManager, resources, AssetManager, Prefab, SpriteFrame, JsonAsset,
    AudioClip, ImageAsset, Texture2D, Sprite, Node, instantiate,
    Asset, error, log
} from 'cc';

/**
 * 资源加载进度回调
 */
export type ResProgressCallback = (completed: number, total: number) => void;

/**
 * 资源加载完成回调
 */
export type ResCompleteCallback<T extends Asset = Asset> = (err: Error | null, asset: T | null) => void;

/**
 * DSResManager - 资源加载管理器
 * 统一管理预制体、图片、JSON、音频、远程资源、Bundle 等各类资源的加载与释放。
 * 
 * 使用方式：
 *   const resMgr = new DSResManager();
 *   resMgr.loadPrefab('prefabs/MyPrefab', (err, prefab) => { ... });
 *   resMgr.loadRemoteImage('https://xxx.png', (err, spriteFrame) => { ... });
 */
export class DSResManager {

    // ==================== 预制体加载 ====================

    private piecesMap = new Map<string, Prefab>();
    /**
     * 加载预制体（从 resources 目录）
     * @param path resources 下的路径（不含扩展名）
     * @param onComplete 完成回调
     */
    loadPrefab(path: string, onComplete: ResCompleteCallback<Prefab>): void {
        if (this.piecesMap.has(path)) {
            onComplete(null, this.piecesMap.get(path)!);
            return;
        }
        resources.load(path, Prefab, (err, prefab) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            this.piecesMap.set(path, prefab);
            onComplete(err, prefab);
        });
    }
    async loadPrefabAsync(path: string): Promise<Prefab> {
        return new Promise((resolve, reject) => {
            if (this.piecesMap.has(path)) {
                resolve(this.piecesMap.get(path)!);
                return;
            }
            resources.load(path, Prefab, (err, prefab) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.piecesMap.set(path, prefab);
                resolve(prefab);
            });
        });
    }

    /**
     * 加载预制体并实例化
     * @param path resources 下的路径（不含扩展名）
     * @param parent 父节点（可选）
     * @param onComplete 完成回调，返回实例化的 Node
     */
    loadPrefabAndInstantiate(
        path: string,
        parent?: Node,
        onComplete?: (err: Error | null, node: Node | null) => void
    ): void {
        resources.load(path, Prefab, (err, prefab) => {
            if (err) {
                onComplete?.(err, null);
                return;
            }
            const node = instantiate(prefab!);
            if (parent) {
                node.setParent(parent);
            }
            onComplete?.(null, node);
        });
    }

    /**
     * 批量加载预制体
     * @param paths 路径数组
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadPrefabs(
        paths: string[],
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, prefabs: Map<string, Prefab>) => void
    ): void {
        const prefabMap = new Map<string, Prefab>();
        let completed = 0;
        const total = paths.length;

        if (total === 0) {
            onComplete?.(null, prefabMap);
            return;
        }

        for (const path of paths) {
            this.loadPrefab(path, (err, prefab) => {
                if (!err && prefab) {
                    prefabMap.set(path, prefab);
                }
                completed++;
                onProgress?.(completed, total);

                if (completed >= total) {
                    onComplete?.(null, prefabMap);
                }
            });
        }
    }

    // ==================== 本地图片加载 ====================

    /**
     * 加载 SpriteFrame（从 resources 目录）
     * @param path resources 下的路径（不含扩展名）
     * @param onComplete 完成回调
     */
    loadSpriteFrame(path: string, onComplete:Function) {
        resources.load(path, SpriteFrame, (err, spriteFrame) => {
            onComplete(err, spriteFrame);
        });
    }

        // 加载通用资源
    loadCommonAssetSync(url: string, type: typeof Asset) {
        return new Promise((resolve: (ret: any) => void) => {
            url = type == Prefab ? `prefab/${url}` : url;
            if (type == SpriteFrame) {
                url += "/spriteFrame"
            }
            resources.load(url, type, (err, assets) => {
                if (err) {
                    resolve(null);
                } else {
                    resolve(assets);
                }
            });
        });
    }



    /**
     * 加载 SpriteFrame 并设置到 Sprite 组件
     * @param path resources 下的路径
     * @param sprite Sprite 组件
     * @param onComplete 完成回调（可选）
     */
    loadSpriteFrameToSprite(
        path: string,
        sprite: Sprite,
        onComplete?: (err: Error | null) => void
    ): void {
        this.loadSpriteFrame(path, (err, spriteFrame) => {
            if (err) {
                onComplete?.(err);
                return;
            }
            sprite.spriteFrame = spriteFrame!;
            onComplete?.(null);
        });
    }

    /**
     * 批量加载 SpriteFrame
     * @param paths 路径数组
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadSpriteFrames(
        paths: string[],
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, frames: Map<string, SpriteFrame>) => void
    ): void {
        const frameMap = new Map<string, SpriteFrame>();
        let completed = 0;
        const total = paths.length;

        if (total === 0) {
            onComplete?.(null, frameMap);
            return;
        }

        for (const path of paths) {
            this.loadSpriteFrame(path, (err, frame) => {
                if (!err && frame) {
                    frameMap.set(path, frame);
                }
                completed++;
                onProgress?.(completed, total);

                if (completed >= total) {
                    onComplete?.(null, frameMap);
                }
            });
        }
    }

    /**
     * 加载 ImageAsset 并转为 SpriteFrame
     * @param path resources 下的路径
     * @param onComplete 完成回调
     */
    loadImageAsSpriteFrame(path: string, onComplete: ResCompleteCallback<SpriteFrame>): void {
        resources.load(path, ImageAsset, (err, imageAsset) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            const texture = new Texture2D();
            texture.image = imageAsset!;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            onComplete(null, spriteFrame);
        });
    }

    // ==================== JSON 配置加载 ====================

    /**
     * 加载 JSON 配置文件
     * @param path resources 下的路径（不含扩展名）
     * @param onComplete 完成回调，返回解析后的对象
     */
    loadJson<T = any>(path: string, onComplete: (err: Error | null, data: T | null) => void): void {
        resources.load(path, JsonAsset, (err, jsonAsset) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            onComplete(null, jsonAsset!.json as T);
        });
    }

    /**
     * 加载 JSON 配置文件（Promise 版本）
     * @param path resources 下的路径（不含扩展名）
     * @returns Promise<T>
     */
    loadJsonAsync<T = any>(path: string): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, jsonAsset) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(jsonAsset!.json as T);
            });
        });
    }

    /**
     * 批量加载 JSON 配置
     * @param paths 路径数组
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadJsons<T = any>(
        paths: string[],
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, dataMap: Map<string, T>) => void
    ): void {
        const dataMap = new Map<string, T>();
        let completed = 0;
        const total = paths.length;

        if (total === 0) {
            onComplete?.(null, dataMap);
            return;
        }

        for (const path of paths) {
            this.loadJson<T>(path, (err, data) => {
                if (!err && data !== null) {
                    dataMap.set(path, data);
                }
                completed++;
                onProgress?.(completed, total);

                if (completed >= total) {
                    onComplete?.(null, dataMap);
                }
            });
        }
    }

    // ==================== 音乐音效加载 ====================

    /**
     * 加载音频资源
     * @param path resources 下的路径（不含扩展名）
     * @param onComplete 完成回调
     */
    loadAudio(path: string, onComplete: ResCompleteCallback<AudioClip>): void {
        resources.load(path, AudioClip, (err, audioClip) => {
            onComplete(err, audioClip);
        });
    }

    /**
     * 批量加载音频资源
     * @param paths 路径数组
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadAudios(
        paths: string[],
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, clips: Map<string, AudioClip>) => void
    ): void {
        const clipMap = new Map<string, AudioClip>();
        let completed = 0;
        const total = paths.length;

        if (total === 0) {
            onComplete?.(null, clipMap);
            return;
        }

        for (const path of paths) {
            this.loadAudio(path, (err, clip) => {
                if (!err && clip) {
                    clipMap.set(path, clip);
                }
                completed++;
                onProgress?.(completed, total);

                if (completed >= total) {
                    onComplete?.(null, clipMap);
                }
            });
        }
    }

    // ==================== 远程 Bundle 加载 ====================

    /**
     * 加载远程 Bundle
     * @param bundleName Bundle 名称
     * @param url 远程 Bundle 地址（可选，不传则从 resources 加载本地 Bundle）
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadBundle(
        bundleName: string,
        url?: string,
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, bundle: AssetManager.Bundle | null) => void
    ): void {
        if (url) {
            // 远程 Bundle
            assetManager.loadBundle(url, {
                onProgress: (completed: number, total: number) => {
                    onProgress?.(completed, total);
                }
            }, (err, bundle) => {
                onComplete?.(err, bundle);
            });
        } else {
            // 本地 Bundle
            assetManager.loadBundle(bundleName, (err, bundle) => {
                onComplete?.(err, bundle);
            });
        }
    }

    /**
     * 从指定 Bundle 中加载资源
     * @param bundle Bundle 实例
     * @param path 资源路径
     * @param type 资源类型
     * @param onComplete 完成回调
     */
    loadFromBundle<T extends Asset>(
        bundle: AssetManager.Bundle,
        path: string,
        type: new (...args: any[]) => T,
        onComplete: ResCompleteCallback<T>
    ): void {
        bundle.load(path, type, (err, asset) => {
            onComplete(err, asset);
        });
    }

    /**
     * 从指定 Bundle 中加载预制体并实例化
     * @param bundle Bundle 实例
     * @param path 预制体路径
     * @param parent 父节点（可选）
     * @param onComplete 完成回调
     */
    loadPrefabFromBundle(
        bundle: AssetManager.Bundle,
        path: string,
        parent?: Node,
        onComplete?: (err: Error | null, node: Node | null) => void
    ): void {
        bundle.load(path, Prefab, (err, prefab) => {
            if (err) {
                onComplete?.(err, null);
                return;
            }
            const node = instantiate(prefab!);
            if (parent) {
                node.setParent(parent);
            }
            onComplete?.(null, node);
        });
    }

    /**
     * 释放 Bundle
     * @param bundle Bundle 实例
     */
    releaseBundle(bundle: AssetManager.Bundle): void {
        assetManager.removeBundle(bundle);
    }

    // ==================== 远程图片加载 ====================

    /**
     * 加载远程图片
     * @param url 图片 URL
     * @param onComplete 完成回调，返回 SpriteFrame
     */
    loadRemoteImage(url: string, onComplete: ResCompleteCallback<SpriteFrame>): void {
        assetManager.loadRemote<ImageAsset>(url, { ext: '.png' }, (err, imageAsset) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            const texture = new Texture2D();
            texture.image = imageAsset!;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            onComplete(null, spriteFrame);
        });
    }

    /**
     * 加载远程图片并设置到 Sprite 组件
     * @param url 图片 URL
     * @param sprite Sprite 组件
     * @param onComplete 完成回调（可选）
     */
    loadRemoteImageToSprite(
        url: string,
        sprite: Sprite,
        onComplete?: (err: Error | null) => void
    ): void {
        this.loadRemoteImage(url, (err, spriteFrame) => {
            if (err) {
                onComplete?.(err);
                return;
            }
            sprite.spriteFrame = spriteFrame!;
            onComplete?.(null);
        });
    }

    /**
     * 批量加载远程图片
     * @param urls URL 数组
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadRemoteImages(
        urls: string[],
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, frames: Map<string, SpriteFrame>) => void
    ): void {
        const frameMap = new Map<string, SpriteFrame>();
        let completed = 0;
        const total = urls.length;

        if (total === 0) {
            onComplete?.(null, frameMap);
            return;
        }

        for (const url of urls) {
            this.loadRemoteImage(url, (err, frame) => {
                if (!err && frame) {
                    frameMap.set(url, frame);
                }
                completed++;
                onProgress?.(completed, total);

                if (completed >= total) {
                    onComplete?.(null, frameMap);
                }
            });
        }
    }

    // ==================== 远程资源通用加载 ====================

    /**
     * 加载远程任意资源
     * @param url 资源 URL
     * @param options 加载选项（扩展名等）
     * @param onComplete 完成回调
     */
    loadRemote<T extends Asset>(
        url: string,
        options: { ext?: string } = {},
        onComplete: ResCompleteCallback<T>
    ): void {
        assetManager.loadRemote<T>(url, options, (err, asset) => {
            onComplete(err, asset);
        });
    }

    /**
     * 加载远程文本文件
     * @param url 文本文件 URL
     * @param onComplete 完成回调，返回文本内容
     */
    loadRemoteText(url: string, onComplete: (err: Error | null, text: string | null) => void): void {
        assetManager.loadRemote<Asset>(url, { ext: '.txt' }, (err, asset) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            // TextAsset 的 text 属性
            const text = (asset as any)?.text || (asset as any)?._nativeAsset;
            onComplete(null, typeof text === 'string' ? text : null);
        });
    }

    /**
     * 加载远程 JSON
     * @param url JSON 文件 URL
     * @param onComplete 完成回调，返回解析后的对象
     */
    loadRemoteJson<T = any>(url: string, onComplete: (err: Error | null, data: T | null) => void): void {
        assetManager.loadRemote<JsonAsset>(url, { ext: '.json' }, (err, jsonAsset) => {
            if (err) {
                onComplete(err, null);
                return;
            }
            onComplete(null, jsonAsset!.json as T);
        });
    }

    // ==================== 通用资源加载 ====================

    /**
     * 加载任意类型资源（从 resources）
     * @param path resources 下的路径
     * @param type 资源类型
     * @param onComplete 完成回调
     */
    load<T extends Asset>(
        path: string,
        type: new (...args: any[]) => T,
        onComplete: ResCompleteCallback<T>
    ): void {
        resources.load(path, type, (err, asset) => {
            onComplete(err, asset);
        });
    }

    /**
     * 加载 resources 目录下的整个文件夹
     * @param dirPath 文件夹路径
     * @param type 资源类型
     * @param onProgress 进度回调
     * @param onComplete 完成回调
     */
    loadDir<T extends Asset>(
        dirPath: string,
        type: new (...args: any[]) => T,
        onProgress?: ResProgressCallback,
        onComplete?: (err: Error | null, assets: T[]) => void
    ): void {
        resources.loadDir(dirPath, type, (err, assets) => {
            onComplete?.(err, assets);
        });
    }

    // ==================== 资源释放 ====================

    /**
     * 释放单个资源
     * @param asset 要释放的资源
     */
    release(asset: Asset): void {
        assetManager.releaseAsset(asset);
    }

    /**
     * 释放指定路径的资源
     * @param path 资源路径
     */
    releaseByPath(path: string): void {
        // const released = assetManager.releaseAsset(path);
        // if (!released) {
        //     log(`[DSResManager] 释放资源失败或资源不存在: ${path}`);
        // }
    }

    /**
     * 释放 resources 目录下的所有资源
     */
    releaseAllResources(): void {
        resources.releaseAll();
    }

    /**
     * 释放未使用的资源
     */
    releaseUnusedAssets(): void {
        // assetManager.releaseUnusedAssets();
    }

    /**
     * 获取资源引用计数
     * @param path 资源路径
     */
    getAssetRefCount(path: string): number {
        // return assetManager.getAssetRefCount(path);
        return 0;
    }

    // ==================== 缓存管理 ====================

    /**
     * 获取已缓存的资源（不发起加载）
     * @param path 资源路径
     * @param type 资源类型
     */
    getCachedAsset<T extends Asset>(path: string, type: new (...args: any[]) => T): T | null {
        const asset = resources.get(path, type);
        return asset || null;
    }

    /**
     * 预加载资源（缓存但不使用）
     * @param path resources 下的路径
     * @param type 资源类型
     * @param onComplete 完成回调
     */
    preload<T extends Asset>(
        path: string,
        type: new (...args: any[]) => T,
        onComplete?: (err: Error | null) => void
    ): void {
        resources.load(path, type, (err) => {
            onComplete?.(err);
        });
    }

            /** 预加载文件 */
    preloadPath(url: string[], onProgress: (finish: number, total: number, item: AssetManager.RequestItem) => void, call: (items: AssetManager.RequestItem[]) => void, faild: Function) {
        resources.preload(url, (finish: number, total: number, item: AssetManager.RequestItem) => {
            onProgress && onProgress(finish, total, item);
        }, (err: Error, items: AssetManager.RequestItem[]) => {
            if (err) {
                faild && faild(err);
                error(`preload 加载asset失败, url:${url}, err: ${err}`);
                return null;
            }
            call && call(items);
        });
    }

}

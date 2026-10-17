import { AudioClip, AudioSource, Node, _decorator } from 'cc';
import { App } from './DSAppManager';
import { DSStorageKey } from './DSStorageManager';

/**
 * DSAudioManager - 音乐音效管理器
 * 负责背景音乐和音效的播放、暂停、音量控制。
 * 音乐资源统一从 resources/audio/ 目录动态加载。
 * 
 * 使用方式：
 *   import { App } from './framework/DSAppManager';
 *   App.init();
 *   App.audio.playMusic('bgm');           // 循环播放背景音乐
 *   App.audio.playEffect('click');        // 播放一次音效
 */
export class DSAudioManager {

    /** 音乐资源根目录 */
    private readonly AUDIO_ROOT: string = 'audio/';

    /** 音乐 AudioSource（只有一个，循环播放） */
    private _musicSource: AudioSource | null = null;

    /** 音效 AudioSource 池（支持多个同时播放） */
    private _effectSources: AudioSource[] = [];

    /** 音效池大小 */
    private readonly EFFECT_POOL_SIZE: number = 5;

    /** 当前音效池索引 */
    private _effectIndex: number = 0;

    /** 已加载的音乐缓存 */
    private _musicCache: Map<string, AudioClip> = new Map();

    /** 已加载的音效缓存 */
    private _effectCache: Map<string, AudioClip> = new Map();

    /** 当前播放的音乐名称 */
    private _currentMusic: string = '';

    /** 音乐音量 (0-1) */
    private _musicVolume: number = 0.8;

    /** 音效音量 (0-1) */
    private _effectVolume: number = 1.0;

    /** 音乐是否静音 */
    private _musicMuted: boolean = false;

    /** 音效是否静音 */
    private _effectMuted: boolean = false;

    /** 挂载 AudioSource 的根节点 */
    private _audioNode: Node | null = null;
    private isInit:boolean = false;

    /**
     * 初始化音频管理器（创建 AudioSource 节点）
     * @param parent 父节点，不传则挂在场景根节点
     */
    init(parent?: Node): void {
        if(this.isInit) return;
        this.isInit = true;
        if (this._audioNode) return;

        // 创建音频根节点
        this._audioNode = new Node('DSAudio');
        if (parent) {
            this._audioNode.setParent(parent);
        }

        // 创建音乐 AudioSource
        const musicNode = new Node('Music');
        musicNode.setParent(this._audioNode);
        this._musicSource = musicNode.addComponent(AudioSource);
        this._musicSource.loop = true;
        this._musicSource.playOnAwake = false;
        this._musicSource.volume = this._musicVolume;

        // 创建音效 AudioSource 池
        for (let i = 0; i < this.EFFECT_POOL_SIZE; i++) {
            const effectNode = new Node(`Effect_${i}`);
            effectNode.setParent(this._audioNode);
            const source = effectNode.addComponent(AudioSource);
            source.loop = false;
            source.playOnAwake = false;
            source.volume = this._effectVolume;
            this._effectSources.push(source);
        }
    }

    // ==================== 背景音乐 ====================

    /**
     * 播放背景音乐（循环播放）
     * @param name 音频文件名（不含扩展名，位于 resources/audio/ 下）
     */
    playMusic(name: string): void {
        if (!this._musicSource) {
            console.warn('[DSAudioManager] 未初始化，请先调用 init()');
            return;
        }
        let bool = App.storage.getBoolean(DSStorageKey.Music_Status);
        if(!bool){
            return;
        }

        // 同一首音乐不重复加载
        if (this._currentMusic === name && this._musicSource.playing) {
            return;
        }

        this._currentMusic = name;

        // 检查缓存
        const cached = this._musicCache.get(name);
        if (cached) {
            this._playMusicClip(cached);
            return;
        }

        // 动态加载
        const path = this.AUDIO_ROOT + name;
        App.res.loadAudio(path, (err, clip) => {
            if (err) {
                console.warn(`[DSAudioManager] 加载音乐失败: ${path}`, err);
                return;
            }
            this._musicCache.set(name, clip!);
            this._playMusicClip(clip!);
        });
    }

    /**
     * 暂停背景音乐
     */
    pauseMusic(): void {
        if (this._musicSource) {
            this._musicSource.pause();
        }
    }

    /**
     * 恢复背景音乐
     */
    resumeMusic(): void {
        if (this._musicSource) {
            this._musicSource.play();
        }
        if(!this._currentMusic){
            this.playMusic('background');
        }
    }

    /**
     * 停止背景音乐
     */
    stopMusic(): void {
        if (this._musicSource) {
            this._musicSource.stop();
            this._currentMusic = '';
        }
    }

    /** 设置音乐音量 (0-1) */
    setMusicVolume(volume: number): void {
        this._musicVolume = Math.max(0, Math.min(1, volume));
        if (this._musicSource) {
            this._musicSource.volume = this._musicMuted ? 0 : this._musicVolume;
        }
    }

    /** 获取音乐音量 */
    getMusicVolume(): number {
        return this._musicVolume;
    }

    /** 设置音乐静音 */
    setMusicMuted(muted: boolean): void {
        this._musicMuted = muted;
        if (this._musicSource) {
            this._musicSource.volume = muted ? 0 : this._musicVolume;
        }
    }

    /** 音乐是否静音 */
    isMusicMuted(): boolean {
        return this._musicMuted;
    }

    /** 音乐是否正在播放 */
    isMusicPlaying(): boolean {
        return this._musicSource ? this._musicSource.playing : false;
    }

    // ==================== 音效 ====================

    /**
     * 播放音效（只播放一次，支持连续播放不打断）
     * @param name 音频文件名（不含扩展名，位于 resources/audio/ 下）
     */
    playEffect(name: string): void {
        if(!this.isInit){
            this.init();
        }

        let bool = App.storage.getBoolean(DSStorageKey.Music_Eff_Status);
        if(!bool){
            return;
        }
        
        if (this._effectSources.length === 0) {
            console.warn('[DSAudioManager] 未初始化，请先调用 init()');
            return;
        }

        // 检查缓存
        const cached = this._effectCache.get(name);
        if (cached) {
            this._playEffectClip(cached);
            return;
        }

        // 动态加载
        const path = this.AUDIO_ROOT + name;
        App.res.loadAudio(path, (err, clip) => {
            if (err) {
                console.warn(`[DSAudioManager] 加载音效失败: ${path}`, err);
                return;
            }
            this._effectCache.set(name, clip!);
            this._playEffectClip(clip!);
        });
    }

    /** 设置音效音量 (0-1) */
    setEffectVolume(volume: number): void {
        this._effectVolume = Math.max(0, Math.min(1, volume));
        const vol = this._effectMuted ? 0 : this._effectVolume;
        for (const source of this._effectSources) {
            source.volume = vol;
        }
    }

    /** 获取音效音量 */
    getEffectVolume(): number {
        return this._effectVolume;
    }

    /** 设置音效静音 */
    setEffectMuted(muted: boolean): void {
        this._effectMuted = muted;
        const vol = muted ? 0 : this._effectVolume;
        for (const source of this._effectSources) {
            source.volume = vol;
        }
    }

    /** 音效是否静音 */
    isEffectMuted(): boolean {
        return this._effectMuted;
    }

    /** 停止所有音效 */
    stopAllEffects(): void {
        for (const source of this._effectSources) {
            source.stop();
        }
    }

    // ==================== 全局控制 ====================

    /** 暂停所有音频 */
    pauseAll(): void {
        this.pauseMusic();
        for (const source of this._effectSources) {
            source.pause();
        }
    }

    /** 恢复所有音频 */
    resumeAll(): void {
        this.resumeMusic();
        for (const source of this._effectSources) {
            if (source.clip) {
                source.play();
            }
        }
    }

    /** 停止所有音频 */
    stopAll(): void {
        this.stopMusic();
        this.stopAllEffects();
    }

    // ==================== 缓存管理 ====================

    /** 清除音乐缓存 */
    clearMusicCache(): void {
        this.stopMusic();
        this._musicCache.clear();
    }

    /** 清除音效缓存 */
    clearEffectCache(): void {
        this.stopAllEffects();
        this._effectCache.clear();
    }

    /** 清除所有缓存 */
    clearAllCache(): void {
        this.clearMusicCache();
        this.clearEffectCache();
    }

    // ==================== 内部方法 ====================

    /** 播放音乐 AudioClip */
    private _playMusicClip(clip: AudioClip): void {
        if (!this._musicSource) return;
        this._musicSource.clip = clip;
        this._musicSource.volume = this._musicMuted ? 0 : this._musicVolume;
        this._musicSource.play();
    }

    /**
     * 播放音效 AudioClip（使用池轮转，不打断前一个）
     */
    private _playEffectClip(clip: AudioClip): void {
        // 轮转选择空闲的 AudioSource
        const source = this._effectSources[this._effectIndex];
        this._effectIndex = (this._effectIndex + 1) % this.EFFECT_POOL_SIZE;

        // 直接设置 clip 并播放（不先 stop，避免打断）
        source.clip = clip;
        source.volume = this._effectMuted ? 0 : this._effectVolume;
        source.play();
    }

    /** 销毁 */
    destroy(): void {
        this.stopAll();
        this._musicCache.clear();
        this._effectCache.clear();
        this._effectSources = [];
        this._musicSource = null;
        if (this._audioNode) {
            this._audioNode.destroy();
            this._audioNode = null;
        }
    }
}

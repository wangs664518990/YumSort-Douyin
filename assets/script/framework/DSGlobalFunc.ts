import { App } from "./DSAppManager";
import { DSEventKey } from "./DSEventManager";
import { DSStorageKey } from "./DSStorageManager";

/**
 * DSGlobalFunc - 全局通用函数管理器
 * 统一管理项目中所有通用工具函数，按需扩展。
 */
export class DSGlobalFunc {
    public isShowVideoAds:boolean = false;
    public isTest:boolean = false;

    /**
     * 异步等待指定秒数
     * @param seconds 等待时间（秒）
     * 
     * 使用方式：await wait(1.5);
     */
    wait(seconds: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, seconds * 1000);
        });
    }
    /** 获取生命值 */   
    getLife() {
        let ct = +App.storage.get(DSStorageKey.Life,0);
        if (ct < 0 || !ct) ct = 0;;
        return ct;
    }
    /** 增加生命值 */
    addLife(count: number) {
        let ct = +this.getLife()+count;
        if(ct>=5){
            ct = 5;
        }
        if(ct<=0){
            ct = 0;
        }
        App.storage.set(DSStorageKey.Life, ct);
        App.event.emit(DSEventKey.UpdateLife);
    }

    private index:number = 0;
    /** 获取索引 */
    getIndex(){
        return this.index++;
    }
}

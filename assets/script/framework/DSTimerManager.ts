import { App } from "./DSAppManager";
import { DSEventKey } from "./DSEventManager";
import { DSStorageKey } from "./DSStorageManager";

/**
 * DSTimerManager - 时间管理器
 * 提供常用的时间转换、格式化、倒计时、时间戳等工具方法。
 * 
 * 使用方式：
 *   import { App } from './framework/DSAppManager';
 *   App.init();
 *   App.timer.formatTime(90);        // "01:30"
 *   App.timer.getNowTimestamp();     // 当前时间戳
 */
export class DSTimerManager {
    public TimeLifeConst: number = 10*60;
    public TimeLife: number = 10*60;
    private isInited: boolean = false;
    init() {
        if (this.isInited) return;
        this.isInited = true;

        let time = +App.storage.get(DSStorageKey.CurTimeCount, 0);
        if(time>0){
            let curTime = +new Date();
            let gap = Math.floor((curTime-time)/1000)/60;//分钟
            let addlife = Math.floor(gap/10);
            App.global.addLife(addlife);
        }
        setInterval(this.updateSecound.bind(this), 1000);
    }

    /** 全局倒计时 */
    updateSecound() {
        this.TimeLife--;
        if(this.TimeLife<=0){
            this.TimeLife = this.TimeLifeConst;
            App.global.addLife(1);
        }
        App.storage.set(DSStorageKey.CurTimeCount, +new Date());
        App.event.emit(DSEventKey.TimeDown);
    }

    // ==================== 时间获取 ====================

    /** 获取当前时间戳（毫秒） */
    getNowTimestamp(): number {
        return Date.now();
    }

    /** 获取当前时间戳（秒） */
    getNowTimestampSec(): number {
        return Math.floor(Date.now() / 1000);
    }

    /** 获取当前 Date 对象 */
    getNowDate(): Date {
        return new Date();
    }

    /** 获取当前年份 */
    getNowYear(): number {
        return new Date().getFullYear();
    }

    /** 获取当前月份（1-12） */
    getNowMonth(): number {
        return new Date().getMonth() + 1;
    }

    /** 获取当前日期（1-31） */
    getNowDay(): number {
        return new Date().getDate();
    }

    /** 获取当前星期几（0=周日, 1=周一, ..., 6=周六） */
    getNowWeekDay(): number {
        return new Date().getDay();
    }

    /** 获取当前小时（0-23） */
    getNowHour(): number {
        return new Date().getHours();
    }

    /** 获取当前分钟（0-59） */
    getNowMinute(): number {
        return new Date().getMinutes();
    }

    /** 获取当前秒（0-59） */
    getNowSecond(): number {
        return new Date().getSeconds();
    }

    // ==================== 时间格式化 ====================

    /**
     * 格式化秒数为 MM:SS 格式
     * @param seconds 总秒数
     * @returns 格式化后的字符串，如 "01:30"
     */
    formatTime(seconds: number): string {
        if (seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${this._padZero(m)}:${this._padZero(s)}`;
    }

    /**
     * 格式化秒数为 HH:MM:SS 格式
     * @param seconds 总秒数
     * @returns 格式化后的字符串，如 "01:30:05"
     */
    formatTimeHMS(seconds: number): string {
        if (seconds < 0) seconds = 0;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${this._padZero(h)}:${this._padZero(m)}:${this._padZero(s)}`;
    }

    /**
     * 格式化毫秒数为 MM:SS.ms 格式
     * @param ms 总毫秒数
     * @returns 格式化后的字符串，如 "01:30.500"
     */
    formatTimeMs(ms: number): string {
        if (ms < 0) ms = 0;
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const millis = ms % 1000;
        return `${this._padZero(m)}:${this._padZero(s)}.${this._padMs(millis)}`;
    }

    /**
     * 格式化时间戳为日期字符串
     * @param timestamp 时间戳（毫秒），不传则用当前时间
     * @param format 格式，如 "YYYY-MM-DD HH:mm:ss"
     * @returns 格式化后的字符串
     */
    formatDate(timestamp?: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
        const date = timestamp ? new Date(timestamp) : new Date();

        const map: Record<string, string> = {
            'YYYY': String(date.getFullYear()),
            'MM': this._padZero(date.getMonth() + 1),
            'DD': this._padZero(date.getDate()),
            'HH': this._padZero(date.getHours()),
            'mm': this._padZero(date.getMinutes()),
            'ss': this._padZero(date.getSeconds()),
            'SSS': this._padMs(date.getMilliseconds()),
        };

        let result = format;
        for (const key in map) {
            result = result.replace(key, map[key]);
        }
        return result;
    }

    /**
     * 格式化时间戳为中文日期
     * @param timestamp 时间戳（毫秒），不传则用当前时间
     * @returns 如 "2024年1月15日"
     */
    formatDateCN(timestamp?: number): string {
        const date = timestamp ? new Date(timestamp) : new Date();
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }

    /**
     * 格式化时间戳为中文日期+时间
     * @param timestamp 时间戳（毫秒），不传则用当前时间
     * @returns 如 "2024年1月15日 14:30"
     */
    formatDateTimeCN(timestamp?: number): string {
        const date = timestamp ? new Date(timestamp) : new Date();
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${this._padZero(date.getHours())}:${this._padZero(date.getMinutes())}`;
    }

    // ==================== 时间转换 ====================

    /** 秒 → 毫秒 */
    secToMs(sec: number): number {
        return sec * 1000;
    }

    /** 毫秒 → 秒 */
    msToSec(ms: number): number {
        return Math.floor(ms / 1000);
    }

    /** 分钟 → 秒 */
    minToSec(min: number): number {
        return min * 60;
    }

    /** 秒 → 分钟 */
    secToMin(sec: number): number {
        return sec / 60;
    }

    /** 小时 → 秒 */
    hourToSec(hour: number): number {
        return hour * 3600;
    }

    /** 秒 → 小时 */
    secToHour(sec: number): number {
        return sec / 3600;
    }

    /** 天 → 秒 */
    dayToSec(day: number): number {
        return day * 86400;
    }

    /** 秒 → 天 */
    secToDay(sec: number): number {
        return sec / 86400;
    }

    // ==================== 时间计算 ====================

    /**
     * 计算两个时间戳之间的差值
     * @param from 起始时间戳（毫秒）
     * @param to 结束时间戳（毫秒），不传则用当前时间
     * @returns 差值对象
     */
    getTimeDiff(from: number, to?: number): {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        totalMs: number;
        totalSec: number;
    } {
        const end = to || Date.now();
        const diffMs = end - from;
        const totalSec = Math.floor(diffMs / 1000);

        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;

        return { days, hours, minutes, seconds, totalMs: diffMs, totalSec };
    }

    /**
     * 格式化时间差值为可读字符串
     * @param from 起始时间戳（毫秒）
     * @param to 结束时间戳（毫秒），不传则用当前时间
     * @returns 如 "2天3小时" / "5分钟" / "刚刚"
     */
    formatTimeDiff(from: number, to?: number): string {
        const diff = this.getTimeDiff(from, to);

        if (diff.totalSec <= 0) return '刚刚';
        if (diff.totalSec < 60) return `${diff.totalSec}秒`;
        if (diff.totalSec < 3600) return `${diff.minutes}分钟`;
        if (diff.totalSec < 86400) return `${diff.hours}小时${diff.minutes > 0 ? diff.minutes + '分钟' : ''}`;
        if (diff.days < 30) return `${diff.days}天${diff.hours > 0 ? diff.hours + '小时' : ''}`;

        return this.formatDateCN(from);
    }

    /**
     * 判断时间戳是否是今天
     * @param timestamp 时间戳（毫秒）
     */
    isToday(timestamp: number): boolean {
        const date = new Date(timestamp);
        const today = new Date();
        return date.getFullYear() === today.getFullYear()
            && date.getMonth() === today.getMonth()
            && date.getDate() === today.getDate();
    }

    /**
     * 判断时间戳是否是昨天
     * @param timestamp 时间戳（毫秒）
     */
    isYesterday(timestamp: number): boolean {
        const date = new Date(timestamp);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date.getFullYear() === yesterday.getFullYear()
            && date.getMonth() === yesterday.getMonth()
            && date.getDate() === yesterday.getDate();
    }

    /**
     * 获取某天开始的时间戳（00:00:00.000）
     * @param timestamp 任意时间戳（毫秒），不传则用当前时间
     */
    getDayStart(timestamp?: number): number {
        const date = timestamp ? new Date(timestamp) : new Date();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * 获取某天结束的时间戳（23:59:59.999）
     * @param timestamp 任意时间戳（毫秒），不传则用当前时间
     */
    getDayEnd(timestamp?: number): number {
        const date = timestamp ? new Date(timestamp) : new Date();
        date.setHours(23, 59, 59, 999);
        return date.getTime();
    }

    /**
     * 获取本周一 00:00:00 的时间戳
     */
    getWeekStart(): number {
        const date = new Date();
        const day = date.getDay();
        const diff = day === 0 ? 6 : day - 1; // 周一为一周开始
        date.setDate(date.getDate() - diff);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    // ==================== 倒计时 ====================

    /**
     * 将剩余秒数拆分为天/时/分/秒
     * @param seconds 剩余秒数
     */
    parseCountdown(seconds: number): { days: number; hours: number; minutes: number; seconds: number } {
        if (seconds < 0) seconds = 0;
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return { days, hours, minutes, seconds: secs };
    }

    /**
     * 格式化倒计时为可读字符串
     * @param seconds 剩余秒数
     * @returns 如 "1天 02:30:05" / "02:30:05" / "00:30"
     */
    formatCountdown(seconds: number): string {
        const cd = this.parseCountdown(seconds);

        if (cd.days > 0) {
            return `${cd.days}天 ${this._padZero(cd.hours)}:${this._padZero(cd.minutes)}:${this._padZero(cd.seconds)}`;
        }
        if (cd.hours > 0) {
            return `${this._padZero(cd.hours)}:${this._padZero(cd.minutes)}:${this._padZero(cd.seconds)}`;
        }
        return `${this._padZero(cd.minutes)}:${this._padZero(cd.seconds)}`;
    }

    // ==================== 工具方法 ====================

    /** 个位数补零 */
    private _padZero(num: number): string {
        return num < 10 ? `0${num}` : `${num}`;
    }

    /** 毫秒补零（3位） */
    private _padMs(ms: number): string {
        if (ms < 10) return `00${ms}`;
        if (ms < 100) return `0${ms}`;
        return `${ms}`;
    }
}

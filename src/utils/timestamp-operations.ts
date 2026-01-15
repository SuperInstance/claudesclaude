/**
 * High-Performance Timestamp Operations Utility
 *
 * Provides efficient timestamp manipulation, formatting, and comparison
 * operations for use in orchestration systems where precise timing
 * is critical for performance and correctness.
 */

// Cache for frequently used time values
const TIME_CACHE = new Map<string, number>();
const CACHE_EXPIRY = 1000; // 1 second cache

// Pre-compiled date format regexes for faster parsing
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-]\d{2}:\d{2})?$/;
const UNIX_DATE_REGEX = /^\d+$/;

// Timezone offset cache
let timezoneOffset = new Date().getTimezoneOffset();
let timezoneOffsetCacheTime = Date.now();

export interface TimeFormatOptions {
  includeTimezone?: boolean;
  includeMilliseconds?: boolean;
  useUTC?: boolean;
}

export interface TimeRange {
  start: Date;
  end: Date;
  duration: number; // in milliseconds
}

export interface TimeInterval {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * High-performance timestamp operations
 */
export class TimestampOperations {
  private static cacheClearInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cache cleanup if not already running
    if (!TimestampOperations.cacheClearInterval) {
      TimestampOperations.cacheClearInterval = setInterval(() => {
        this.clearExpiredCache();
      }, 5000);
    }
  }

  /**
   * Get current timestamp with high precision
   */
  static now(): number {
    return Date.now();
  }

  /**
   * Get current timestamp with microsecond precision
   */
  static nowMicroseconds(): number {
    const [seconds, microseconds] = process.hrtime();
    return seconds * 1000 + Math.floor(microseconds / 1000);
  }

  /**
   * Format timestamp with caching for better performance
   */
  static format(timestamp: number | Date, options: TimeFormatOptions = {}): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    // Check cache first
    const cacheKey = `${date.getTime()}-${JSON.stringify(options)}`;
    const cached = TIME_CACHE.get(cacheKey);
    if (cached && Date.now() - cached < CACHE_EXPIRY) {
      return new Date(cached).toISOString();
    }

    const {
      includeTimezone = false,
      includeMilliseconds = false,
      useUTC = false
    } = options;

    let formatted: string;

    if (useUTC) {
      formatted = date.toISOString();

      if (!includeTimezone) {
        // Remove timezone part
        formatted = formatted.replace(/Z$/, '');
      }

      if (!includeMilliseconds) {
        // Remove milliseconds part
        formatted = formatted.replace(/\.\d+Z?$/, '');
      }
    } else {
      // Local time formatting
      const pad = (num: number) => num.toString().padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());

      formatted = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

      if (includeMilliseconds) {
        const ms = pad(date.getMilliseconds());
        formatted += `.${ms}`;
      }

      if (includeTimezone) {
        const offset = -date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMinutes = Math.abs(offset) % 60;
        const sign = offset <= 0 ? '+' : '-';
        formatted += `${sign}${pad(offsetHours)}:${pad(offsetMinutes)}`;
      }
    }

    // Cache the result
    TIME_CACHE.set(cacheKey, date.getTime());

    return formatted;
  }

  /**
   * Parse timestamp with multiple format support
   */
  static parse(timestamp: string | number): Date {
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }

    // Try to parse as number first
    if (UNIX_DATE_REGEX.test(timestamp)) {
      const num = parseInt(timestamp);
      return new Date(num);
    }

    // Try ISO format
    const isoMatch = timestamp.match(ISO_DATE_REGEX);
    if (isoMatch) {
      // Fast parsing for ISO format
      const [, year, month, day, hours, minutes, seconds, milliseconds] = isoMatch;
      const date = new Date();
      date.setUTCFullYear(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      );
      date.setUTCHours(
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds) || 0,
        parseInt(milliseconds) || 0
      );
      return date;
    }

    // Fallback to Date constructor
    return new Date(timestamp);
  }

  /**
   * Get timezone offset with caching
   */
  static getTimezoneOffset(): number {
    const now = Date.now();
    if (now - timezoneOffsetCacheTime > 60000) { // Refresh every minute
      timezoneOffset = new Date().getTimezoneOffset();
      timezoneOffsetCacheTime = now;
    }
    return timezoneOffset;
  }

  /**
   * Calculate time difference between two timestamps
   */
  static diff(start: number | Date, end: number | Date): TimeInterval {
    const startTime = typeof start === 'number' ? start : start.getTime();
    const endTime = typeof end === 'number' ? end : end.getTime();

    const diffMs = Math.abs(endTime - startTime);

    return {
      days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
      milliseconds: diffMs % 1000
    };
  }

  /**
   * Add time interval to a timestamp
   */
  static add(date: number | Date, interval: Partial<TimeInterval>): number {
    const result = typeof date === 'number' ? new Date(date) : new Date(date);

    if (interval.days) result.setDate(result.getDate() + interval.days);
    if (interval.hours) result.setHours(result.getHours() + interval.hours);
    if (interval.minutes) result.setMinutes(result.getMinutes() + interval.minutes);
    if (interval.seconds) result.setSeconds(result.getSeconds() + interval.seconds);
    if (interval.milliseconds) result.setMilliseconds(result.getMilliseconds() + interval.milliseconds);

    return result.getTime();
  }

  /**
   * Check if timestamp is within a range
   */
  static isInRange(timestamp: number | Date, range: TimeRange): boolean {
    const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
    return time >= range.start.getTime() && time <= range.end.getTime();
  }

  /**
   * Create time range
   */
  static createRange(start: number | Date, duration: number): TimeRange {
    const startTime = typeof start === 'number' ? start : start.getTime();
    return {
      start: new Date(startTime),
      end: new Date(startTime + duration),
      duration
    };
  }

  /**
   * Round timestamp to nearest interval
   */
  static round(timestamp: number | Date, interval: number): number {
    const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
    return Math.round(time / interval) * interval;
  }

  /**
   * Floor timestamp to nearest interval
   */
  static floor(timestamp: number | Date, interval: number): number {
    const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
    return Math.floor(time / interval) * interval;
  }

  /**
   * Ceiling timestamp to nearest interval
   */
  static ceil(timestamp: number | Date, interval: number): number {
    const time = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
    return Math.ceil(time / interval) * interval;
  }

  /**
   * Get start of day (UTC or local)
   */
  static startOfDay(timestamp: number | Date, useUTC = false): number {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    if (useUTC) {
      return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
    } else {
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
    }
  }

  /**
   * Get end of day (UTC or local)
   */
  static endOfDay(timestamp: number | Date, useUTC = false): number {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    if (useUTC) {
      return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23, 59, 59, 999
      );
    } else {
      const end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23, 59, 59, 999
      );
      return end.getTime();
    }
  }

  /**
   * Get start of week
   */
  static startOfWeek(timestamp: number | Date, useUTC = false, startDay = 0): number {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const day = useUTC ? date.getUTCDay() : date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : startDay);

    if (useUTC) {
      return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        diff
      );
    } else {
      const result = new Date(date.getFullYear(), date.getMonth(), diff);
      return result.getTime();
    }
  }

  /**
   * Benchmark timestamp operations
   */
  static benchmark(operation: () => void, iterations: number = 10000): {
    time: number;
    throughput: number;
  } {
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      operation();
    }

    const end = performance.now();
    const time = end - start;
    const throughput = iterations / time;

    return { time, throughput };
  }

  private static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, timestamp] of TIME_CACHE.entries()) {
      if (now - timestamp > CACHE_EXPIRY) {
        TIME_CACHE.delete(key);
      }
    }
  }

  /**
   * Cleanup resources
   */
  static destroy(): void {
    if (TimestampOperations.cacheClearInterval) {
      clearInterval(TimestampOperations.cacheClearInterval);
      TimestampOperations.cacheClearInterval = null;
    }
    TIME_CACHE.clear();
  }
}

// Convenience functions
export const now = TimestampOperations.now;
export const format = TimestampOperations.format;
export const parse = TimestampOperations.parse;
export const diff = TimestampOperations.diff;
export const add = TimestampOperations.add;
export const isInRange = TimestampOperations.isInRange;
export const createRange = TimestampOperations.createRange;
export const round = TimestampOperations.round;
export const floor = TimestampOperations.floor;
export const ceil = TimestampOperations.ceil;
export const startOfDay = TimestampOperations.startOfDay;
export const endOfDay = TimestampOperations.endOfDay;
export const startOfWeek = TimestampOperations.startOfWeek;
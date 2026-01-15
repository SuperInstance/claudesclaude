/**
 * Consolidated Utilities - Ultra-optimized utility functions
 * All utilities in one file with maximum performance
 */

// UUID generation - ultra-fast
export const uuid = {
  fast: (): string => Date.now().toString(36) + Math.random().toString(36).substr(2),
  secure: (): string => crypto.randomUUID(),
  generate: (secure: boolean = false): string => secure ? uuid.secure() : uuid.fast()
};

// Time utilities - direct functions
export const time = {
  now: (): number => Date.now(),
  format: (timestamp: number, options: { includeTimezone?: boolean; includeMilliseconds?: boolean } = {}): string => {
    const date = new Date(timestamp);
    let result = date.toISOString().split('T')[0];
    const timePart = date.toTimeString().split(' ')[0];
    result += ' ' + timePart;

    if (options.includeMilliseconds) {
      result += '.' + date.getMilliseconds().toString().padStart(3, '0');
    }

    return result;
  },
  diff: (start: number, end: number): { hours: number; minutes: number; seconds: number } => {
    const diff = Math.abs(end - start);
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000)
    };
  },
  range: (start: number, duration: number): { start: number; end: number; duration: number } => ({
    start,
    end: start + duration,
    duration
  }),
  inRange: (timestamp: number, start: number, end: number): boolean => timestamp >= start && timestamp <= end
};

// Object pooling for performance
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(options: {
    create: () => T;
    reset?: (obj: T) => void;
    maxSize?: number;
  }) {
    this.createFn = options.create;
    this.resetFn = options.reset || (() => {});
    this.maxSize = options.maxSize || 100;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.resetFn(obj);
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool = [];
  }

  size(): number {
    return this.pool.length;
  }
}

// Event batching for performance
export class EventBatcher<T> {
  private batch: T[] = [];
  private callbacks: Set<(items: T[]) => void> = new Set();
  private batchSize: number;
  private batchTime: number;

  constructor(options: {
    batchSize?: number;
    batchTime?: number;
  } = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTime = options.batchTime || 100;
    this.startBatchTimer();
  }

  add(item: T): void {
    this.batch.push(item);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  addAll(items: T[]): void {
    this.batch.push(...items);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  subscribe(callback: (items: T[]) => void): void {
    this.callbacks.add(callback);
  }

  unsubscribe(callback: (items: T[]) => void): void {
    this.callbacks.delete(callback);
  }

  private flush(): void {
    if (this.batch.length === 0) return;

    const batch = [...this.batch];
    this.batch = [];

    this.callbacks.forEach(callback => {
      try {
        callback(batch);
      } catch (error) {
        console.error('Error in event batch callback:', error);
      }
    });
  }

  private startBatchTimer(): void {
    setInterval(() => {
      this.flush();
    }, this.batchTime);
  }

  size(): number {
    return this.batch.length;
  }
}

// Performance metrics collector
export class MetricsCollector {
  private metrics = new Map<string, number>();
  private timers = new Map<string, number>();
  private counters = new Map<string, number>();

  // Start timing
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  // End timing and record
  endTimer(name: string): number {
    const start = this.timers.get(name);
    if (!start) return 0;

    const duration = performance.now() - start;
    this.timers.delete(name);

    this.incrementMetric(`${name}_duration`, duration);
    return duration;
  }

  // Increment a counter
  increment(name: string, value: number = 1): void {
    this.incrementCounter(name, value);
  }

  // Record a metric
  recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  // Get all metrics
  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};

    // Add regular metrics
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });

    // Add counters
    this.counters.forEach((value, key) => {
      result[`${key}_count`] = value;
    });

    return result;
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.timers.clear();
    this.counters.clear();
  }

  private incrementCounter(name: string, value: number): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  private incrementMetric(name: string, value: number): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }
}

// Singleton instances
export const metrics = new MetricsCollector();
export const eventBatcher = new EventBatcher<any>();
export const sessionPool = new ObjectPool<any>({
  create: () => ({}),
  reset: (obj) => Object.keys(obj).forEach(key => delete obj[key])
});

// Convenience functions
export const generateUUID = uuid.generate;
export const generateFastUUID = uuid.fast;
export const generateSecureUUID = uuid.secure;
export const now = time.now;
export const formatTime = time.format;
export const timeDiff = time.diff;
export const createTimeRange = time.range;
export const isTimeInRange = time.inRange;

// Export all utilities for easy import
export default {
  uuid,
  time,
  ObjectPool,
  EventBatcher,
  MetricsCollector,
  metrics,
  eventBatcher,
  sessionPool,
  generateUUID,
  generateFastUUID,
  generateSecureUUID,
  now,
  formatTime,
  timeDiff,
  createTimeRange,
  isTimeInRange
};
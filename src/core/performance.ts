/**
 * Performance Optimization Module
 * Provides caching, memoization, and performance monitoring utilities
 */

import { EventEmitter } from 'events';

// Cache entry interface
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
  hits: number;
  size: number;
}

// Cache configuration
interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
  enableMetrics: boolean;
}

// Performance metrics
interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  averageResponseTime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  operationCounts: Map<string, number>;
  slowOperations: Array<{ operation: string; duration: number; timestamp: number }>;
}

/**
 * Advanced Cache System with TTL, size limits, and metrics
 */
export class AdvancedCache<T = any> extends EventEmitter {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private metrics: PerformanceMetrics;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = {
      maxSize: 1000,
      defaultTtl: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0,
      averageResponseTime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      operationCounts: new Map(),
      slowOperations: []
    };

    this.startCleanup();
    this.startMemoryMonitoring();
  }

  /**
   * Set a value in cache
   */
  public set(key: string, value: T, ttl?: number): void {
    // Check if we're at max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    // Calculate size (rough estimate)
    const size = this.estimateSize(value);

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.metrics.cacheSize = this.cache.size;

    // Emit cache set event
    this.emit('set', { key, size });

    // Log if cache is getting full
    if (this.cache.size > this.config.maxSize * 0.9) {
      console.warn(`Cache is ${Math.round((this.cache.size / this.config.maxSize) * 100)}% full`);
    }
  }

  /**
   * Get a value from cache
   */
  public get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.cacheMisses++;
      this.incrementOperation('get.miss');
      return undefined;
    }

    // Check if entry has expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      this.incrementOperation('get.expired');
      return undefined;
    }

    // Update metrics
    entry.hits++;
    this.metrics.cacheHits++;
    this.incrementOperation('get.hit');

    // Emit cache hit event
    this.emit('hit', { key, hits: entry.hits });

    return entry.value;
  }

  /**
   * Check if a key exists in cache
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from cache
   */
  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.cacheSize = this.cache.size;
      this.emit('delete', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.metrics.cacheSize = 0;
    this.emit('clear', { count });
  }

  /**
   * Get cache statistics
   */
  public getStats(): PerformanceMetrics {
    // Update memory usage
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = {
      used: usage.heapUsed,
      total: usage.heapTotal,
      percentage: (usage.heapUsed / usage.heapTotal) * 100
    };

    return { ...this.metrics };
  }

  /**
   * Get all cache keys
   */
  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry details
   */
  public getEntry(key: string): CacheEntry<T> | undefined {
    return this.cache.get(key);
  }

  /**
   * Update cache configuration
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart cleanup with new interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.startCleanup();
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.metrics.cacheSize = this.cache.size;

    if (cleanedCount > 0) {
      this.emit('cleanup', { cleanedCount });
      console.log(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    let minHits = Infinity;
    let keyToDelete: string | undefined;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        keyToDelete = key;
      }
    }

    if (keyToDelete) {
      this.cache.delete(keyToDelete);
      this.emit('evict', { key: keyToDelete });
    }
  }

  /**
   * Estimate object size
   */
  private estimateSize(obj: any): number {
    if (typeof obj === 'string') return obj.length * 2; // Rough estimate
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (obj === null || obj === undefined) return 0;

    if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => acc + this.estimateSize(item), 0);
    }

    if (typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        return acc + this.estimateSize(key) + this.estimateSize(obj[key]);
      }, 0);
    }

    return 0;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const memoryUsage = (usage.heapUsed / usage.heapTotal) * 100;

      // Emit memory usage event
      this.emit('memory', {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: memoryUsage
      });

      // Warn if memory usage is high
      if (memoryUsage > 80) {
        console.warn(`Memory usage is high: ${memoryUsage.toFixed(2)}%`);
      }
    }, 5000);
  }

  /**
   * Increment operation count
   */
  private incrementOperation(operation: string): void {
    const current = this.metrics.operationCounts.get(operation) || 0;
    this.metrics.operationCounts.set(operation, current + 1);
  }
}

/**
 * Memoization utility with caching and TTL
 */
export class Memoizer {
  private cache = new Map<string, { value: any; timestamp: number; ttl?: number }>();

  /**
   * Create a memoized function
   */
  public static memoize<T>(
    fn: (...args: any[]) => T,
    keyGenerator?: (...args: any[]) => string,
    ttl?: number
  ): (...args: any[]) => T {
    const memoizer = new Memoizer(ttl);
    return memoizer.wrap(fn, keyGenerator);
  }

  constructor(private defaultTtl?: number) {}

  /**
   * Wrap a function with memoization
   */
  public wrap<T>(fn: (...args: any[]) => T, keyGenerator?: (...args: any[]) => string): (...args: any[]) => T {
    return (...args: any[]): T => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

      const cached = this.cache.get(key);
      if (cached) {
        // Check if cached value is still valid
        if (!cached.ttl || Date.now() - cached.timestamp < cached.ttl) {
          return cached.value;
        }
        // Remove expired entry
        this.cache.delete(key);
      }

      // Execute function
      const result = fn(...args);

      // Cache the result
      this.cache.set(key, {
        value: result,
        timestamp: Date.now(),
        ttl: this.defaultTtl
      });

      return result;
    };
  }

  /**
   * Clear cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; hitRate: number } {
    // In a real implementation, you would track hits and misses
    return {
      size: this.cache.size,
      hitRate: 0 // Placeholder
    };
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private thresholds: Map<string, number> = new Map();
  private alerts: Array<{ metric: string; value: number; threshold: number; timestamp: number }> = [];

  /**
   * Record a metric value
   */
  public record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const values = this.metrics.get(metric)!;
    values.push(value);

    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }

    // Check thresholds
    const threshold = this.thresholds.get(metric);
    if (threshold && value > threshold) {
      this.alerts.push({
        metric,
        value,
        threshold,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get average metric value
   */
  public getAverage(metric: string): number {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Get max metric value
   */
  public getMax(metric: string): number {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) return 0;

    return Math.max(...values);
  }

  /**
   * Set threshold for metric
   */
  public setThreshold(metric: string, threshold: number): void {
    this.thresholds.set(metric, threshold);
  }

  /**
   * Get recent alerts
   */
  public getAlerts(count: number = 10): Array<{ metric: string; value: number; threshold: number; timestamp: number }> {
    return this.alerts.slice(-count);
  }

  /**
   * Clear alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get all metrics summary
   */
  public getSummary(): { [metric: string]: { average: number; max: number; count: number } } {
    const summary: { [metric: string]: { average: number; max: number; count: number } } = {};

    for (const [metric, values] of this.metrics.entries()) {
      summary[metric] = {
        average: this.getAverage(metric),
        max: this.getMax(metric),
        count: values.length
      };
    }

    return summary;
  }
}

/**
 * Debounce utility
 */
export class Debouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Debounce a function
   */
  public debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    key?: string
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const timerKey = key || fn.name || 'anonymous';

      // Clear existing timer
      if (this.timers.has(timerKey)) {
        clearTimeout(this.timers.get(timerKey)!);
      }

      // Set new timer
      this.timers.set(timerKey, setTimeout(() => {
        fn(...args);
        this.timers.delete(timerKey);
      }, delay));
    };
  }

  /**
   * Cancel all debounced functions
   */
  public cancelAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

/**
 * Throttle utility
 */
export class Throttler {
  private lastCall: Map<string, number> = new Map();

  /**
   * Throttle a function
   */
  public throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number,
    key?: string
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      const timerKey = key || fn.name || 'anonymous';
      const now = Date.now();

      // Check if we can call the function
      if (!this.lastCall.has(timerKey) || now - this.lastCall.get(timerKey)! >= limit) {
        fn(...args);
        this.lastCall.set(timerKey, now);
      }
    };
  }

  /**
   * Reset throttle
   */
  public reset(key?: string): void {
    if (key) {
      this.lastCall.delete(key);
    } else {
      this.lastCall.clear();
    }
  }
}

// Global instances
export const cache = new AdvancedCache({ maxSize: 1000, defaultTtl: 300000 });
export const memoizer = new Memoizer();
export const performanceMonitor = new PerformanceMonitor();
export const debouncer = new Debouncer();
export const throttler = new Throttler();

// Utility functions
export const createMemoizedFunction = <T>(
  fn: (...args: any[]) => T,
  options: { keyGenerator?: (...args: any[]) => string; ttl?: number } = {}
) => {
  return Memoizer.memoize(fn, options.keyGenerator, options.ttl);
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  key?: string
) => {
  return debouncer.debounce(fn, delay, key);
};

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  key?: string
) => {
  return throttler.throttle(fn, limit, key);
};

// Performance monitoring decorator
export function measurePerformance(metricName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const start = Date.now();
      const result = originalMethod.apply(this, args);
      const end = Date.now();
      const duration = end - start;

      performanceMonitor.record(metricName, duration);

      if (duration > 1000) { // Log slow operations
        console.warn(`Slow operation: ${propertyKey} took ${duration}ms`);
      }

      return result;
    };

    return descriptor;
  };
}
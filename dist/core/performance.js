/**
 * Performance Optimization Module
 * Provides caching, memoization, and performance monitoring utilities
 */
import { EventEmitter } from 'events';
/**
 * Advanced Cache System with TTL, size limits, and metrics
 */
export class AdvancedCache extends EventEmitter {
    constructor(config = {}) {
        super();
        this.cache = new Map();
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
    set(key, value, ttl) {
        // Check if we're at max size
        if (this.cache.size >= this.config.maxSize) {
            this.evictLeastRecentlyUsed();
        }
        // Calculate size (rough estimate)
        const size = this.estimateSize(value);
        const entry = {
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
    get(key) {
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
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Delete a key from cache
     */
    delete(key) {
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
    clear() {
        const count = this.cache.size;
        this.cache.clear();
        this.metrics.cacheSize = 0;
        this.emit('clear', { count });
    }
    /**
     * Get cache statistics
     */
    getStats() {
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
    getKeys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get cache entry details
     */
    getEntry(key) {
        return this.cache.get(key);
    }
    /**
     * Update cache configuration
     */
    updateConfig(config) {
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
    cleanup() {
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
    evictLeastRecentlyUsed() {
        let minHits = Infinity;
        let keyToDelete;
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
    estimateSize(obj) {
        if (typeof obj === 'string')
            return obj.length * 2; // Rough estimate
        if (typeof obj === 'number')
            return 8;
        if (typeof obj === 'boolean')
            return 4;
        if (obj === null || obj === undefined)
            return 0;
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
    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
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
    incrementOperation(operation) {
        const current = this.metrics.operationCounts.get(operation) || 0;
        this.metrics.operationCounts.set(operation, current + 1);
    }
}
/**
 * Memoization utility with caching and TTL
 */
export class Memoizer {
    /**
     * Create a memoized function
     */
    static memoize(fn, keyGenerator, ttl) {
        const memoizer = new Memoizer(ttl);
        return memoizer.wrap(fn, keyGenerator);
    }
    constructor(defaultTtl) {
        this.defaultTtl = defaultTtl;
        this.cache = new Map();
    }
    /**
     * Wrap a function with memoization
     */
    wrap(fn, keyGenerator) {
        return (...args) => {
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
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getStats() {
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
    constructor() {
        this.metrics = new Map();
        this.thresholds = new Map();
        this.alerts = [];
    }
    /**
     * Record a metric value
     */
    record(metric, value) {
        if (!this.metrics.has(metric)) {
            this.metrics.set(metric, []);
        }
        const values = this.metrics.get(metric);
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
    getAverage(metric) {
        const values = this.metrics.get(metric);
        if (!values || values.length === 0)
            return 0;
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }
    /**
     * Get max metric value
     */
    getMax(metric) {
        const values = this.metrics.get(metric);
        if (!values || values.length === 0)
            return 0;
        return Math.max(...values);
    }
    /**
     * Set threshold for metric
     */
    setThreshold(metric, threshold) {
        this.thresholds.set(metric, threshold);
    }
    /**
     * Get recent alerts
     */
    getAlerts(count = 10) {
        return this.alerts.slice(-count);
    }
    /**
     * Clear alerts
     */
    clearAlerts() {
        this.alerts = [];
    }
    /**
     * Get all metrics summary
     */
    getSummary() {
        const summary = {};
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
    constructor() {
        this.timers = new Map();
    }
    /**
     * Debounce a function
     */
    debounce(fn, delay, key) {
        return (...args) => {
            const timerKey = key || fn.name || 'anonymous';
            // Clear existing timer
            if (this.timers.has(timerKey)) {
                clearTimeout(this.timers.get(timerKey));
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
    cancelAll() {
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
    constructor() {
        this.lastCall = new Map();
    }
    /**
     * Throttle a function
     */
    throttle(fn, limit, key) {
        return (...args) => {
            const timerKey = key || fn.name || 'anonymous';
            const now = Date.now();
            // Check if we can call the function
            if (!this.lastCall.has(timerKey) || now - this.lastCall.get(timerKey) >= limit) {
                fn(...args);
                this.lastCall.set(timerKey, now);
            }
        };
    }
    /**
     * Reset throttle
     */
    reset(key) {
        if (key) {
            this.lastCall.delete(key);
        }
        else {
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
export const createMemoizedFunction = (fn, options = {}) => {
    return Memoizer.memoize(fn, options.keyGenerator, options.ttl);
};
export const debounce = (fn, delay, key) => {
    return debouncer.debounce(fn, delay, key);
};
export const throttle = (fn, limit, key) => {
    return throttler.throttle(fn, limit, key);
};
// Performance monitoring decorator
export function measurePerformance(metricName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
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

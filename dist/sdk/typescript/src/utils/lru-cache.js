import { LRUCache } from 'lru-cache';
export class OptimizedLRUCache {
    cache;
    memoryMetrics;
    sizeCalculator;
    memoryLimit;
    weakReferences = new Set();
    constructor(options = {}) {
        this.memoryLimit = options.maxMemoryBytes || 100 * 1024 * 1024;
        this.sizeCalculator = options.sizeCalculation;
        this.memoryMetrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
            lastHitRate: 0
        };
        const effectiveMax = options.max || (options.sizeCalculation ? 1000 : 1000);
        this.cache = new LRUCache({
            max: effectiveMax,
            ttl: options.ttl || 1000 * 60 * 5,
            ttlAutopurge: true,
            sizeCalculation: options.sizeCalculation || ((value) => {
                return value.size || (this.sizeCalculator ? this.sizeCalculator(value.value) : 1);
            }),
            dispose: (value, key) => {
                this.memoryMetrics.evictions++;
                options.dispose?.(value.value, key);
            },
            allowStale: options.allowStale || false,
            updateAgeOnGet: options.updateAgeOnGet || true,
            updateAgeOnHas: options.updateAgeOnHas || false,
        });
        this.startMemoryMonitoring();
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.memoryMetrics.misses++;
            return undefined;
        }
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.memoryMetrics.expirations++;
            this.memoryMetrics.misses++;
            return undefined;
        }
        item.lastAccess = Date.now();
        this.memoryMetrics.hits++;
        this.updateHitRate();
        if (!item.weakReference) {
            return item.value;
        }
        if (this.isWeakReferenceValid(key, item.value)) {
            return item.value;
        }
        this.cache.delete(key);
        this.weakReferences.delete(key);
        this.memoryMetrics.misses++;
        return undefined;
    }
    set(key, value, options) {
        if (this.shouldEvictBeforeSet(value)) {
            this.evictOldest();
        }
        const item = {
            value,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            size: options?.size || (this.sizeCalculator ? this.sizeCalculator(value) : 1),
            ttl: options?.ttl,
            weakReference: options?.weakReference || false
        };
        if (item.weakReference) {
            this.weakReferences.add(key);
        }
        this.cache.set(key, item);
        this.checkMemoryPressure();
    }
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.weakReferences.delete(key);
        }
        return deleted;
    }
    has(key) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.weakReferences.delete(key);
            this.memoryMetrics.expirations++;
            return false;
        }
        return true;
    }
    clear() {
        this.cache.clear();
        this.weakReferences.clear();
    }
    get size() {
        return this.cache.size;
    }
    getMemoryMetrics() {
        const totalMemoryBytes = this.calculateTotalMemoryUsage();
        const hitRate = this.memoryMetrics.hits + this.memoryMetrics.misses > 0
            ? this.memoryMetrics.hits / (this.memoryMetrics.hits + this.memoryMetrics.misses)
            : 0;
        return {
            totalItems: this.cache.size,
            totalMemoryBytes,
            hitRate,
            evictionCount: this.memoryMetrics.evictions,
            expiredCount: this.memoryMetrics.expirations,
            lastEviction: this.memoryMetrics.evictions > 0 ? new Date() : undefined
        };
    }
    getStats() {
        return {
            size: this.cache.size,
            hits: this.memoryMetrics.hits,
            misses: this.memoryMetrics.misses,
            evictions: this.memoryMetrics.evictions,
            expirations: this.memoryMetrics.expirations,
            weakReferences: this.weakReferences.size,
            memoryUsage: this.calculateTotalMemoryUsage()
        };
    }
    cleanup() {
        let cleaned = 0;
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (item.ttl && now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                this.weakReferences.delete(key);
                this.memoryMetrics.expirations++;
                cleaned++;
            }
        }
        return cleaned;
    }
    resize(newMax) {
        this.cache.max = newMax;
        while (this.cache.size > newMax) {
            this.evictOldest();
        }
    }
    setMemoryLimit(limit) {
        this.memoryLimit = limit;
        if (this.calculateTotalMemoryUsage() > limit) {
            this.evictToMemoryLimit();
        }
    }
    startMemoryMonitoring() {
        setInterval(() => {
            this.cleanup();
            this.checkMemoryPressure();
        }, 60000);
    }
    updateHitRate() {
        const totalRequests = this.memoryMetrics.hits + this.memoryMetrics.misses;
        if (totalRequests > 0) {
            this.memoryMetrics.lastHitRate = this.memoryMetrics.hits / totalRequests;
        }
    }
    shouldEvictBeforeSet(value) {
        const newItemSize = this.sizeCalculator ? this.sizeCalculator(value) : 1;
        const currentMemoryUsage = this.calculateTotalMemoryUsage();
        return currentMemoryUsage + newItemSize > this.memoryLimit * 0.9;
    }
    checkMemoryPressure() {
        const currentUsage = this.calculateTotalMemoryUsage();
        if (currentUsage > this.memoryLimit) {
            this.evictToMemoryLimit();
        }
    }
    evictOldest() {
    }
    evictToMemoryLimit() {
        const targetUsage = this.memoryLimit * 0.8;
        let currentUsage = this.calculateTotalMemoryUsage();
        while (this.cache.size > 0 && currentUsage > targetUsage) {
            this.evictOldest();
            currentUsage = this.calculateTotalMemoryUsage();
        }
    }
    calculateTotalMemoryUsage() {
        let total = 0;
        for (const item of this.cache.values()) {
            total += item.size || 1;
        }
        return total;
    }
    isWeakReferenceValid(key, value) {
        return value !== null && value !== undefined;
    }
    disposeWeakReferences() {
        let disposed = 0;
        for (const key of this.weakReferences) {
            const item = this.cache.get(key);
            if (item && !this.isWeakReferenceValid(key, item.value)) {
                this.cache.delete(key);
                this.weakReferences.delete(key);
                disposed++;
            }
        }
        return disposed;
    }
}
export function createSessionCache(options) {
    return new OptimizedLRUCache({
        max: 1000,
        ttl: 30 * 60 * 1000,
        maxMemoryBytes: 50 * 1024 * 1024,
        ...options
    });
}
export function createContextCache(options) {
    return new OptimizedLRUCache({
        max: 5000,
        ttl: 15 * 60 * 1000,
        maxMemoryBytes: 100 * 1024 * 1024,
        ...options
    });
}
export function createEventCache(options) {
    return new OptimizedLRUCache({
        max: 10000,
        ttl: 5 * 60 * 1000,
        maxMemoryBytes: 25 * 1024 * 1024,
        ...options,
        weakReference: true
    });
}
//# sourceMappingURL=lru-cache.js.map
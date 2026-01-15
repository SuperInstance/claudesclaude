export class SimpleLRUCache {
    cache;
    options;
    metrics;
    sizeCalculator;
    constructor(options = {}) {
        this.cache = new Map();
        this.options = {
            max: options.max || 1000,
            ttl: options.ttl || 0,
            maxSize: options.maxSize || 0,
            sizeCalculation: options.sizeCalculation || (() => 1),
            dispose: options.dispose || (() => { }),
            updateAgeOnGet: options.updateAgeOnGet || true,
            updateAgeOnHas: options.updateAgeOnHas || false,
            allowStale: options.allowStale || false,
        };
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
        };
        this.sizeCalculator = this.options.sizeCalculation;
        if (this.options.ttl > 0) {
            setInterval(() => this.cleanupExpired(), this.options.ttl);
        }
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.metrics.misses++;
            return undefined;
        }
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.metrics.expirations++;
            this.metrics.misses++;
            return undefined;
        }
        if (this.options.updateAgeOnGet) {
            item.lastAccess = Date.now();
        }
        this.metrics.hits++;
        return item.value;
    }
    set(key, value, options = {}) {
        if (this.shouldEvictBeforeSet(value, key, options.size)) {
            this.evictOldest();
        }
        const item = {
            value,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            ttl: options.ttl || this.options.ttl,
            size: options.size || this.sizeCalculator ? this.sizeCalculator(value, key) : 1,
        };
        this.cache.set(key, item);
        if (this.options.maxSize > 0 && this.getTotalSize() > this.options.maxSize) {
            this.evictOldest();
        }
    }
    delete(key) {
        const item = this.cache.get(key);
        if (item) {
            this.options.dispose(item.value, key);
            this.cache.delete(key);
            return true;
        }
        return false;
    }
    has(key) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.metrics.expirations++;
            return false;
        }
        if (this.options.updateAgeOnHas) {
            item.lastAccess = Date.now();
        }
        return true;
    }
    clear() {
        for (const [key, item] of Array.from(this.cache.entries())) {
            this.options.dispose(item.value, key);
        }
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
    get keys() {
        return this.cache.keys();
    }
    get values() {
        const values = [];
        for (const item of Array.from(this.cache.values())) {
            values.push(item.value);
        }
        return values[Symbol.iterator]();
    }
    getMemoryMetrics() {
        const totalMemoryBytes = this.getTotalSize();
        const totalRequests = this.metrics.hits + this.metrics.misses;
        const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
        return {
            totalItems: this.cache.size,
            totalMemoryBytes,
            hitRate,
            evictionCount: this.metrics.evictions,
            expiredCount: this.metrics.expirations,
        };
    }
    getStats() {
        return {
            size: this.cache.size,
            hits: this.metrics.hits,
            misses: this.metrics.misses,
            evictions: this.metrics.evictions,
            expirations: this.metrics.expirations,
            memoryUsage: this.getTotalSize(),
        };
    }
    cleanup() {
        let cleaned = 0;
        const now = Date.now();
        for (const [key, item] of Array.from(this.cache.entries())) {
            if (item.ttl && now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                this.metrics.expirations++;
                cleaned++;
            }
        }
        return cleaned;
    }
    shouldEvictBeforeSet(value, key, providedSize) {
        if (this.options.max > 0 && this.cache.size >= this.options.max) {
            return true;
        }
        if (this.options.maxSize > 0) {
            const newSize = providedSize || (this.sizeCalculator ? this.sizeCalculator(value, key) : 1);
            const currentSize = this.getTotalSize();
            return currentSize + newSize > this.options.maxSize;
        }
        return false;
    }
    evictOldest() {
        if (this.cache.size === 0)
            return;
        let oldestKey;
        let oldestTime = Infinity;
        for (const [key, item] of Array.from(this.cache.entries())) {
            if (item.timestamp < oldestTime) {
                oldestTime = item.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            const item = this.cache.get(oldestKey);
            if (item) {
                this.options.dispose(item.value, oldestKey);
                this.cache.delete(oldestKey);
                this.metrics.evictions++;
            }
        }
    }
    getTotalSize() {
        let total = 0;
        for (const item of Array.from(this.cache.values())) {
            total += item.size || 1;
        }
        return total;
    }
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, item] of Array.from(this.cache.entries())) {
            if (item.ttl && now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                this.metrics.expirations++;
                cleaned++;
            }
        }
        return cleaned;
    }
    resize(newMax) {
        this.options.max = newMax;
        while (this.cache.size > newMax) {
            this.evictOldest();
        }
    }
    setMemoryLimit(limit) {
        this.options.maxSize = limit;
        if (this.getTotalSize() > limit) {
            this.evictToMemoryLimit();
        }
    }
    evictToMemoryLimit() {
        const targetUsage = this.options.maxSize * 0.8;
        let currentUsage = this.getTotalSize();
        while (this.cache.size > 0 && currentUsage > targetUsage) {
            this.evictOldest();
            currentUsage = this.getTotalSize();
        }
    }
    disposeWeakReferences() {
        return 0;
    }
}
export function createSessionCache(options) {
    return new SimpleLRUCache({
        max: 1000,
        ttl: 30 * 60 * 1000,
        maxSize: 50 * 1024 * 1024,
        ...options
    });
}
export function createContextCache(options) {
    return new SimpleLRUCache({
        max: 5000,
        ttl: 15 * 60 * 1000,
        maxSize: 100 * 1024 * 1024,
        ...options
    });
}
export function createEventCache(options) {
    return new SimpleLRUCache({
        max: 10000,
        ttl: 5 * 60 * 1000,
        maxSize: 25 * 1024 * 1024,
        ...options
    });
}
//# sourceMappingURL=simple-lru-cache.js.map
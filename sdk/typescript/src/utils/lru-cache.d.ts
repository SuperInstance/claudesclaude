export interface CacheItem<T = any> {
    value: T;
    timestamp: number;
    lastAccess: number;
    size?: number;
    ttl?: number;
    weakReference?: boolean;
}
export interface LRUCacheOptions<K, V> {
    max?: number;
    ttl?: number;
    maxMemoryBytes?: number;
    sizeCalculation?: (value: V) => number;
    dispose?: (value: V, key: K) => void;
    updateAgeOnGet?: boolean;
    updateAgeOnHas?: boolean;
    allowStale?: boolean;
    disposeOnSet?: boolean;
}
export interface MemoryMetrics {
    totalItems: number;
    totalMemoryBytes: number;
    hitRate: number;
    evictionCount: number;
    expiredCount: number;
    lastEviction?: Date;
}
export declare class OptimizedLRUCache<K extends string, V = any> {
    private cache;
    private memoryMetrics;
    private sizeCalculator?;
    private memoryLimit;
    private weakReferences;
    constructor(options?: LRUCacheOptions<K, V>);
    get(key: K): V | undefined;
    set(key: K, value: V, options?: {
        ttl?: number;
        size?: number;
        weakReference?: boolean;
    }): void;
    delete(key: K): boolean;
    has(key: K): boolean;
    clear(): void;
    get size(): number;
    getMemoryMetrics(): MemoryMetrics;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        evictions: number;
        expirations: number;
        weakReferences: number;
        memoryUsage: number;
    };
    cleanup(): void;
    resize(newMax: number): void;
    setMemoryLimit(limit: number): void;
    private startMemoryMonitoring;
    private updateHitRate;
    private shouldEvictBeforeSet;
    private checkMemoryPressure;
    private evictOldest;
    private evictToMemoryLimit;
    private calculateTotalMemoryUsage;
    private isWeakReferenceValid;
    disposeWeakReferences(): number;
}
export declare function createSessionCache(options?: LRUCacheOptions<string, any>): OptimizedLRUCache<string, any>;
export declare function createContextCache(options?: LRUCacheOptions<string, any>): OptimizedLRUCache<string, any>;
export declare function createEventCache(options?: LRUCacheOptions<string, any>): OptimizedLRUCache<string, any>;

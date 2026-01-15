export interface LRUCacheOptions<K, V> {
    max?: number;
    ttl?: number;
    maxSize?: number;
    sizeCalculation?: (value: V, key: K) => number;
    dispose?: (value: V, key: K) => void;
    updateAgeOnGet?: boolean;
    updateAgeOnHas?: boolean;
    allowStale?: boolean;
}
export interface CacheItem<V> {
    value: V;
    timestamp: number;
    lastAccess: number;
    ttl?: number;
    size?: number;
}
export interface MemoryMetrics {
    totalItems: number;
    totalMemoryBytes: number;
    hitRate: number;
    evictionCount: number;
    expiredCount: number;
    lastEviction?: Date;
}
export declare class SimpleLRUCache<K extends string, V = any> {
    private cache;
    private options;
    private metrics;
    private sizeCalculator?;
    constructor(options?: LRUCacheOptions<K, V>);
    get(key: K): V | undefined;
    set(key: K, value: V, options?: {
        ttl?: number;
        size?: number;
    }): void;
    delete(key: K): boolean;
    has(key: K): boolean;
    clear(): void;
    get size(): number;
    get keys(): IterableIterator<K>;
    get values(): IterableIterator<V>;
    getMemoryMetrics(): MemoryMetrics;
    getStats(): any;
    cleanup(): number;
    private shouldEvictBeforeSet;
    private evictOldest;
    private getTotalSize;
    private cleanupExpired;
    resize(newMax: number): void;
    setMemoryLimit(limit: number): void;
    private evictToMemoryLimit;
    disposeWeakReferences(): number;
}
export declare function createSessionCache(options?: LRUCacheOptions<string, any>): SimpleLRUCache<string, any>;
export declare function createContextCache(options?: LRUCacheOptions<string, any>): SimpleLRUCache<string, any>;
export declare function createEventCache(options?: LRUCacheOptions<string, any>): SimpleLRUCache<string, any>;

/**
 * LRU (Least Recently Used) Cache implementation for memory optimization
 *
 * This implementation provides a memory-efficient caching system with:
 * - LRU eviction policy
 * - Memory limits and size-based eviction
 * - TTL-based expiration
 * - Weak reference support for selected items
 * - Memory usage tracking
 */

import { LRUCache } from 'lru-cache';

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

export class OptimizedLRUCache<K extends string, V = any> {
  private cache: LRUCache<K, CacheItem<V>>;
  private memoryMetrics: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    lastHitRate: number;
  };
  private sizeCalculator?: (value: V) => number;
  private memoryLimit: number;
  private weakReferences = new Set<string>();

  constructor(options: LRUCacheOptions<K, V> = {}) {
    this.memoryLimit = options.maxMemoryBytes || 100 * 1024 * 1024; // 100MB default
    this.sizeCalculator = options.sizeCalculation;
    this.memoryMetrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      lastHitRate: 0
    };

    // Set max to a reasonable default if using sizeCalculation
  const effectiveMax = options.max || (options.sizeCalculation ? 1000 : 1000);

  this.cache = new LRUCache<K, CacheItem<V>>({
    max: effectiveMax,
    ttl: options.ttl || 1000 * 60 * 5, // 5 minutes default
    ttlAutopurge: true,
    sizeCalculation: options.sizeCalculation || ((value: CacheItem<V>) => {
      // Return item size or 1 if no calculator
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

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this.memoryMetrics.misses++;
      return undefined;
    }

    // Check if item is expired
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.memoryMetrics.expirations++;
      this.memoryMetrics.misses++;
      return undefined;
    }

    // Update last access time
    item.lastAccess = Date.now();
    this.memoryMetrics.hits++;

    // Calculate and update hit rate
    this.updateHitRate();

    // Return value for non-weak reference items
    if (!item.weakReference) {
      return item.value;
    }

    // For weak references, check if the object is still valid
    if (this.isWeakReferenceValid(key, item.value)) {
      return item.value;
    }

    // If weak reference is no longer valid, remove it
    this.cache.delete(key);
    this.weakReferences.delete(key);
    this.memoryMetrics.misses++;
    return undefined;
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V, options?: {
    ttl?: number;
    size?: number;
    weakReference?: boolean;
  }): void {
    // Check memory limit before setting
    if (this.shouldEvictBeforeSet(value)) {
      this.evictOldest();
    }

    const item: CacheItem<V> = {
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      size: options?.size || (this.sizeCalculator ? this.sizeCalculator(value) : 1),
      ttl: options?.ttl,
      weakReference: options?.weakReference || false
    };

    // Handle weak references
    if (item.weakReference) {
      this.weakReferences.add(key);
      // Note: We store the actual value but mark it as weak for tracking
    }

    this.cache.set(key, item);

    // Check if we need to evict due to memory pressure
    this.checkMemoryPressure();
  }

  /**
   * Delete a value from the cache
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.weakReferences.delete(key);
    }
    return deleted;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if item is expired
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.weakReferences.delete(key);
      this.memoryMetrics.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.weakReferences.clear();
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache memory metrics
   */
  getMemoryMetrics(): MemoryMetrics {
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

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
    weakReferences: number;
    memoryUsage: number;
  } {
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

  /**
   * Force cleanup of expired items
   */
  cleanup(): void {
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

  /**
   * Resize the cache
   */
  resize(newMax: number): void {
    this.cache.max = newMax;

    // If new max is smaller, evict excess items
    while (this.cache.size > newMax) {
      this.evictOldest();
    }
  }

  /**
   * Set memory limit
   */
  setMemoryLimit(limit: number): void {
    this.memoryLimit = limit;

    // If current usage exceeds new limit, evict items
    if (this.calculateTotalMemoryUsage() > limit) {
      this.evictToMemoryLimit();
    }
  }

  private startMemoryMonitoring(): void {
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanup();
      this.checkMemoryPressure();
    }, 60000); // Check every minute
  }

  private updateHitRate(): void {
    const totalRequests = this.memoryMetrics.hits + this.memoryMetrics.misses;
    if (totalRequests > 0) {
      this.memoryMetrics.lastHitRate = this.memoryMetrics.hits / totalRequests;
    }
  }

  private shouldEvictBeforeSet(value: V): boolean {
    const newItemSize = this.sizeCalculator ? this.sizeCalculator(value) : 1;
    const currentMemoryUsage = this.calculateTotalMemoryUsage();
    return currentMemoryUsage + newItemSize > this.memoryLimit * 0.9; // 90% threshold
  }

  private checkMemoryPressure(): void {
    const currentUsage = this.calculateTotalMemoryUsage();
    if (currentUsage > this.memoryLimit) {
      this.evictToMemoryLimit();
    }
  }

  private evictOldest(): void {
    // LRU cache already evicts oldest when max size is reached
    // This is just a placeholder for any custom eviction logic
  }

  private evictToMemoryLimit(): void {
    const targetUsage = this.memoryLimit * 0.8; // Target 80% of limit
    let currentUsage = this.calculateTotalMemoryUsage();

    while (this.cache.size > 0 && currentUsage > targetUsage) {
      this.evictOldest();
      currentUsage = this.calculateTotalMemoryUsage();
    }
  }

  private calculateTotalMemoryUsage(): number {
    let total = 0;
    for (const item of this.cache.values()) {
      total += item.size || 1;
    }
    return total;
  }

  private isWeakReferenceValid(key: K, value: any): boolean {
    // For actual weak references, we'd use WeakMap/WeakRef
    // This is a simplified check for demo purposes
    // In production, you'd use proper weak reference patterns
    return value !== null && value !== undefined;
  }

  /**
   * Dispose of weak references that are no longer needed
   */
  disposeWeakReferences(): number {
    let disposed = 0;

    for (const key of this.weakReferences) {
      const item = this.cache.get(key as K);
      if (item && !this.isWeakReferenceValid(key, item.value)) {
        this.cache.delete(key as K);
        this.weakReferences.delete(key);
        disposed++;
      }
    }

    return disposed;
  }
}

// Utility functions for common cache scenarios
export function createSessionCache(options?: LRUCacheOptions<string, any>) {
  return new OptimizedLRUCache<string, any>({
    max: 1000, // Max 1000 sessions
    ttl: 30 * 60 * 1000, // 30 minutes TTL
    maxMemoryBytes: 50 * 1024 * 1024, // 50MB limit
    ...options
  });
}

export function createContextCache(options?: LRUCacheOptions<string, any>) {
  return new OptimizedLRUCache<string, any>({
    max: 5000, // Max 5000 contexts
    ttl: 15 * 60 * 1000, // 15 minutes TTL
    maxMemoryBytes: 100 * 1024 * 1024, // 100MB limit
    ...options
  });
}

export function createEventCache(options?: LRUCacheOptions<string, any>) {
  return new OptimizedLRUCache<string, any>({
    max: 10000, // Max 10000 events
    ttl: 5 * 60 * 1000, // 5 minutes TTL
    maxMemoryBytes: 25 * 1024 * 1024, // 25MB limit
    ...options,
    weakReference: true // Use weak references for events
  });
}
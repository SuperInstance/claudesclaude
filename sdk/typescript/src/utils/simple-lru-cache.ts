/**
 * Simple LRU Cache implementation without external dependencies
 */

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

export class SimpleLRUCache<K extends string, V = any> {
  private cache: Map<K, CacheItem<V>>;
  private options: Required<LRUCacheOptions<K, V>>;
  private metrics: {
    hits: number;
    misses: number;
    evictions: number;
    expirations: number;
  };
  private sizeCalculator?: (value: V, key: K) => number;

  constructor(options: LRUCacheOptions<K, V> = {}) {
    this.cache = new Map();
    this.options = {
      max: options.max || 1000,
      ttl: options.ttl || 0,
      maxSize: options.maxSize || 0,
      sizeCalculation: options.sizeCalculation || (() => 1),
      dispose: options.dispose || (() => {}),
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

    // Start periodic cleanup for TTL
    if (this.options.ttl > 0) {
      setInterval(() => this.cleanupExpired(), this.options.ttl);
    }
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);

    if (!item) {
      this.metrics.misses++;
      return undefined;
    }

    // Check if item is expired
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.metrics.expirations++;
      this.metrics.misses++;
      return undefined;
    }

    // Update last access time if enabled
    if (this.options.updateAgeOnGet) {
      item.lastAccess = Date.now();
    }

    this.metrics.hits++;
    return item.value;
  }

  set(key: K, value: V, options: { ttl?: number; size?: number } = {}): void {
    // Check if we need to evict before setting
    if (this.shouldEvictBeforeSet(value, key, options.size)) {
      this.evictOldest();
    }

    const item: CacheItem<V> = {
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      ttl: options.ttl || this.options.ttl,
      size: options.size || this.sizeCalculator ? this.sizeCalculator(value, key) : 1,
    };

    this.cache.set(key, item);

    // Check if we need to evict due to max size
    if (this.options.maxSize > 0 && this.getTotalSize() > this.options.maxSize) {
      this.evictOldest();
    }
  }

  delete(key: K): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.options.dispose(item.value, key);
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if item is expired
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.metrics.expirations++;
      return false;
    }

    // Update last access time if enabled
    if (this.options.updateAgeOnHas) {
      item.lastAccess = Date.now();
    }

    return true;
  }

  clear(): void {
    for (const [key, item] of Array.from(this.cache.entries())) {
      this.options.dispose(item.value, key);
    }
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  get keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  get values(): IterableIterator<V> {
    const values = [];
    for (const item of Array.from(this.cache.values())) {
      values.push(item.value);
    }
    return values[Symbol.iterator]();
  }

  getMemoryMetrics(): MemoryMetrics {
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

  getStats(): any {
    return {
      size: this.cache.size,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      expirations: this.metrics.expirations,
      memoryUsage: this.getTotalSize(),
    };
  }

  cleanup(): number {
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

  private shouldEvictBeforeSet(value: V, key: K, providedSize?: number): boolean {
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

  private evictOldest(): void {
    if (this.cache.size === 0) return;

    // Find the oldest item
    let oldestKey: K | undefined;
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

  private getTotalSize(): number {
    let total = 0;
    for (const item of Array.from(this.cache.values())) {
      total += item.size || 1;
    }
    return total;
  }

  private cleanupExpired(): number {
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

  resize(newMax: number): void {
    this.options.max = newMax;

    // If new max is smaller, evict excess items
    while (this.cache.size > newMax) {
      this.evictOldest();
    }
  }

  setMemoryLimit(limit: number): void {
    this.options.maxSize = limit;

    // If current usage exceeds new limit, evict items
    if (this.getTotalSize() > limit) {
      this.evictToMemoryLimit();
    }
  }

  private evictToMemoryLimit(): void {
    const targetUsage = this.options.maxSize * 0.8; // Target 80% of limit
    let currentUsage = this.getTotalSize();

    while (this.cache.size > 0 && currentUsage > targetUsage) {
      this.evictOldest();
      currentUsage = this.getTotalSize();
    }
  }

  disposeWeakReferences(): number {
    // For simple LRU cache, this is a no-op
    // In a real implementation, you'd check for weak references
    return 0;
  }
}

// Utility functions for common cache scenarios
export function createSessionCache(options?: LRUCacheOptions<string, any>) {
  return new SimpleLRUCache<string, any>({
    max: 1000, // Max 1000 sessions
    ttl: 30 * 60 * 1000, // 30 minutes TTL
    maxSize: 50 * 1024 * 1024, // 50MB limit
    ...options
  });
}

export function createContextCache(options?: LRUCacheOptions<string, any>) {
  return new SimpleLRUCache<string, any>({
    max: 5000, // Max 5000 contexts
    ttl: 15 * 60 * 1000, // 15 minutes TTL
    maxSize: 100 * 1024 * 1024, // 100MB limit
    ...options
  });
}

export function createEventCache(options?: LRUCacheOptions<string, any>) {
  return new SimpleLRUCache<string, any>({
    max: 10000, // Max 10000 events
    ttl: 5 * 60 * 1000, // 5 minutes TTL
    maxSize: 25 * 1024 * 1024, // 25MB limit
    ...options
  });
}
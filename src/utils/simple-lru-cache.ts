export interface LRUCacheOptions {
  maxSize: number;
  ttl?: number;
  maxMemoryUsage?: number;
}

export interface LRUCacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  currentMemoryUsage: number;
  maxSize: number;
  ttl: number | null;
}

export class SimpleLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private options: Required<LRUCacheOptions>;
  private hits = 0;
  private misses = 0;

  constructor(options: LRUCacheOptions) {
    this.options = {
      ttl: null,
      maxMemoryUsage: Infinity,
      ...options
    };
  }

  set(key: K, value: V): void {
    // Check if we're at capacity and need to evict
    if (this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    // Check memory usage if specified
    if (this.options.maxMemoryUsage < Infinity) {
      const estimatedSize = this.estimateSize(value);
      if (estimatedSize > this.options.maxMemoryUsage) {
        throw new Error(`Item size ${estimatedSize} exceeds max memory limit ${this.options.maxMemoryUsage}`);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (this.options.ttl && Date.now() - item.timestamp > this.options.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, {
      ...item,
      timestamp: Date.now()
    });

    this.hits++;
    return item.value;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  getMetrics(): LRUCacheMetrics {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      maxSize: this.options.maxSize,
      ttl: this.options.ttl || null
    };
  }

  getCurrentMemoryUsage(): number {
    // Simple estimation based on number of items
    return this.cache.size * 1024; // Assume 1KB per item
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (this.options.ttl && now - item.timestamp > this.options.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    // Remove the first item (least recently used)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  private estimateSize(value: V): number {
    // Simple size estimation
    const str = JSON.stringify(value);
    return str.length * 2; // Rough estimate in bytes
  }
}
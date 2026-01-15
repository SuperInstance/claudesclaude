/**
 * Simplified LRU Cache - Basic LRU functionality with optional TTL
 */

export interface LRUCacheOptions {
  maxSize: number;
  ttl?: number;
}

export class SimpleLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl?: number;

  constructor(options: LRUCacheOptions | number) {
    if (typeof options === 'number') {
      this.maxSize = options;
    } else {
      this.maxSize = options.maxSize;
      this.ttl = options.ttl;
    }
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      for (const firstKey of this.cache.keys()) {
        this.cache.delete(firstKey);
        break;
      }
    }
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, {
      ...item,
      timestamp: Date.now()
    });

    return item.value;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  size(): number {
    return this.cache.size;
  }
}
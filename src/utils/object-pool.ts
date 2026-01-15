/**
 * High-Performance Object Pool System
 *
 * Provides efficient object pooling for session objects and other frequently
 * allocated objects to reduce GC pressure and improve performance.
 */

import type { Session } from '../core/types.js';

export interface PoolConfig<T> {
  initialSize: number;
  maxPoolSize: number;
  minPoolSize: number;
  resetObject: (obj: T) => T;
  createObject: () => T;
  enableDynamicSizing: boolean;
  growthFactor: number; // How much to grow the pool when empty
  shrinkThreshold: number; // When to shrink the pool
  shrinkIntervalMs: number;
}

export interface PoolStats {
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  currentPoolSize: number;
  activeObjects: number;
  peakPoolSize: number;
  poolHits: number;
  poolMisses: number;
  lastShrinkTime?: Date;
}

export class ObjectPool<T> {
  private config: Required<PoolConfig<T>>;
  private pool: T[] = [];
  private activeObjects = new Set<T>();
  private stats: PoolStats;
  private shrinkTimer: NodeJS.Timeout | null = null;
  private isGrowing = false;

  constructor(config: PoolConfig<T>) {
    this.config = {
      initialSize: config.initialSize,
      maxPoolSize: config.maxPoolSize,
      minPoolSize: config.minPoolSize,
      resetObject: config.resetObject,
      createObject: config.createObject,
      enableDynamicSizing: config.enableDynamicSizing ?? true,
      growthFactor: config.growthFactor ?? 1.5,
      shrinkThreshold: config.shrinkThreshold ?? 0.25,
      shrinkIntervalMs: config.shrinkIntervalMs ?? 30000
    };

    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      currentPoolSize: 0,
      activeObjects: 0,
      peakPoolSize: 0,
      poolHits: 0,
      poolMisses: 0
    };

    // Initialize pool
    this.initializePool();
    this.setupShrinking();
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    this.stats.totalAcquired++;

    // Try to get from pool first
    let obj = this.pool.pop();

    if (obj) {
      this.stats.poolHits++;
      this.stats.currentPoolSize--;
    } else {
      // Pool is empty, create new object
      this.stats.poolMisses++;
      obj = this.createObject();
      this.stats.totalCreated++;

      // If we need to grow the pool and dynamic sizing is enabled
      if (this.isGrowing && this.config.enableDynamicSizing) {
        this.growPool();
      }
    }

    this.activeObjects.add(obj);
    this.stats.activeObjects = this.activeObjects.size;
    this.updatePeakPoolSize();

    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): void {
    if (!this.activeObjects.has(obj)) {
      // Object was not from this pool
      return;
    }

    this.activeObjects.delete(obj);
    this.stats.activeObjects = this.activeObjects.size;
    this.stats.totalReleased++;

    // Reset the object before returning to pool
    const resetObj = this.config.resetObject(obj);

    // Check if we should add to pool or just discard
    if (this.pool.length < this.config.maxPoolSize) {
      this.pool.push(resetObj);
      this.stats.currentPoolSize++;
    } else {
      // Pool is full, discard the object
      // This is by design - we don't want unbounded memory usage
    }

    // Check if we should trigger shrinking
    this.checkShrinkCondition();
  }

  /**
   * Pre-warm the pool with objects
   */
  warmup(count: number = this.config.initialSize): void {
    const toCreate = Math.min(count - this.pool.length, this.config.maxPoolSize - this.pool.length);

    for (let i = 0; i < toCreate; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
      this.stats.totalCreated++;
      this.stats.currentPoolSize++;
    }

    this.updatePeakPoolSize();
  }

  /**
   * Shrink the pool if needed
   */
  shrink(): number {
    if (this.pool.length <= this.config.minPoolSize) {
      return 0;
    }

    const targetSize = Math.max(
      this.config.minPoolSize,
      Math.floor(this.pool.length * this.config.shrinkThreshold)
    );

    const toRemove = this.pool.length - targetSize;
    const removed = this.pool.splice(targetSize, toRemove);

    this.stats.currentPoolSize = this.pool.length;
    this.stats.lastShrinkTime = new Date();

    return removed.length;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool = [];
    this.activeObjects.clear();
    this.stats.currentPoolSize = 0;
    this.stats.activeObjects = 0;

    if (this.shrinkTimer) {
      clearTimeout(this.shrinkTimer);
      this.shrinkTimer = null;
    }
  }

  /**
   * Dispose of the pool
   */
  dispose(): void {
    this.clear();
  }

  /**
   * Enable/disable dynamic sizing
   */
  setDynamicSizing(enabled: boolean): void {
    this.config.enableDynamicSizing = enabled;
    if (!enabled) {
      this.isGrowing = false;
    }
  }

  /**
   * Update pool configuration
   */
  updateConfig(newConfig: Partial<PoolConfig<T>>): void {
    this.config = { ...this.config, ...newConfig };

    // If max size decreased, shrink the pool
    if (newConfig.maxPoolSize !== undefined && this.pool.length > this.config.maxPoolSize) {
      this.shrink();
    }
  }

  private initializePool(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
      this.stats.totalCreated++;
    }

    this.stats.currentPoolSize = this.pool.length;
    this.updatePeakPoolSize();
  }

  private setupShrinking(): void {
    if (this.config.enableDynamicSizing) {
      this.shrinkTimer = setInterval(() => {
        this.shrink();
      }, this.config.shrinkIntervalMs);
    }
  }

  private growPool(): void {
    if (this.pool.length >= this.config.maxPoolSize) {
      this.isGrowing = false;
      return;
    }

    const toGrow = Math.min(
      Math.floor(this.pool.length * (this.config.growthFactor - 1)),
      this.config.maxPoolSize - this.pool.length
    );

    for (let i = 0; i < toGrow; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
      this.stats.totalCreated++;
    }

    this.stats.currentPoolSize = this.pool.length;
    this.updatePeakPoolSize();
  }

  private createObject(): T {
    return this.config.createObject();
  }

  private checkShrinkCondition(): void {
    if (this.pool.length > this.config.minPoolSize &&
        this.activeObjects.size < this.pool.length * this.config.shrinkThreshold) {
      // Schedule a shrink operation
      if (this.shrinkTimer) {
        clearTimeout(this.shrinkTimer);
      }

      this.shrinkTimer = setTimeout(() => {
        this.shrink();
      }, this.config.shrinkIntervalMs);
    }
  }

  private updatePeakPoolSize(): void {
    if (this.stats.currentPoolSize > this.stats.peakPoolSize) {
      this.stats.peakPoolSize = this.stats.currentPoolSize;
    }
  }
}

// Specialized pool for Session objects
export class SessionPool extends ObjectPool<Session> {
  private static nextId = 0;

  constructor(config?: Partial<PoolConfig<Session>>) {
    const defaultConfig: PoolConfig<Session> = {
      initialSize: 50,
      maxPoolSize: 500,
      minPoolSize: 10,
      createObject: () => ({
        id: `session-${SessionPool.nextId++}`,
        type: 'ai-assistant' as const,
        name: '',
        workspace: '',
        config: {},
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      resetObject: (session) => ({
        ...session,
        status: 'active',
        config: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      enableDynamicSizing: true,
      growthFactor: 1.5,
      shrinkThreshold: 0.25,
      shrinkIntervalMs: 30000,
      ...config
    };

    super(defaultConfig);
  }

  /**
   * Create a session with custom data
   */
  acquireSession(type: string, name: string, workspace: string): Session {
    const session = this.acquire();
    session.id = `session-${SessionPool.nextId++}`;
    session.type = type as any;
    session.name = name;
    session.workspace = workspace;
    session.config = {};
    session.status = 'active';
    session.createdAt = new Date();
    session.updatedAt = new Date();
    return session;
  }
}

// Generic pool factory
export function createPool<T>(config: PoolConfig<T>): ObjectPool<T> {
  return new ObjectPool<T>(config);
}

// Pre-configured pools for common use cases
export const sessionPool = new SessionPool();

// High-performance pool for frequently allocated objects
export class HighFrequencyPool<T> extends ObjectPool<T> {
  constructor(
    createObject: () => T,
    resetObject: (obj: T) => T,
    config?: Partial<PoolConfig<T>>
  ) {
    super({
      initialSize: 100,
      maxPoolSize: 10000,
      minPoolSize: 50,
      createObject,
      resetObject,
      enableDynamicSizing: true,
      growthFactor: 2, // Aggressive growth
      shrinkThreshold: 0.1, // Aggressive shrinking
      shrinkIntervalMs: 60000,
      ...config
    });
  }
}

// Lightweight pool for when tracking is not needed
export class SimplePool<T> {
  private pool: T[] = [];
  private createObject: () => T;
  private resetObject: (obj: T) => T;

  constructor(createObject: () => T, resetObject: (obj: T) => T) {
    this.createObject = createObject;
    this.resetObject = resetObject;
  }

  acquire(): T {
    return this.pool.pop() || this.createObject();
  }

  release(obj: T): void {
    this.pool.push(this.resetObject(obj));
  }

  clear(): void {
    this.pool = [];
  }
}

// Performance utilities for pool testing
export interface PoolBenchmark {
  operations: number;
  totalTime: number;
  avgAcquireTime: number;
  avgReleaseTime: number;
  poolUtilization: number;
  hitRate: number;
}

export function benchmarkPool<T>(
  pool: ObjectPool<T>,
  operations: number = 10000
): PoolBenchmark {
  const start = performance.now();
  const results: T[] = [];

  // Acquire objects
  const acquireStart = performance.now();
  for (let i = 0; i < operations; i++) {
    results.push(pool.acquire());
  }
  const acquireEnd = performance.now();

  // Release objects
  const releaseStart = performance.now();
  for (const obj of results) {
    pool.release(obj);
  }
  const releaseEnd = performance.now();

  const totalTime = releaseEnd - start;
  const avgAcquireTime = (acquireEnd - acquireStart) / operations;
  const avgReleaseTime = (releaseEnd - releaseStart) / operations;
  const poolUtilization = pool.getStats().activeObjects / operations;
  const hitRate = pool.getStats().poolHits / operations;

  return {
    operations,
    totalTime,
    avgAcquireTime,
    avgReleaseTime,
    poolUtilization,
    hitRate
  };
}
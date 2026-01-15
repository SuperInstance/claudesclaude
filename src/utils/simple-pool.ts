/**
 * Simplified Pool System - Consolidated from Object Pool and Connection Pool
 * Provides generic resource pooling with minimal overhead
 */

import { uuidGenerator } from './simple-utils.js';

// Generic pool interface
export interface PoolConfig<T> {
  initialSize: number;
  maxSize: number;
  minSize: number;
  createObject: () => T;
  resetObject?: (obj: T) => T;
  destroyObject?: (obj: T) => void;
}

// Pool metrics interface
export interface PoolMetrics {
  totalAcquired: number;
  totalReleased: number;
  currentSize: number;
  maxSize: number;
  averageAcquireTime: number;
  averageReleaseTime: number;
}

// Generic pool implementation
export class SimplePool<T> {
  private pool: T[] = [];
  private inUse = new Set<T>();
  private config: Required<PoolConfig<T>>;
  private metrics: PoolMetrics;
  private acquireTimes: number[] = [];
  private releaseTimes: number[] = [];

  constructor(config: PoolConfig<T>) {
    this.config = {
      resetObject: (obj: T) => obj,
      destroyObject: () => {},
      ...config
    };

    // Initialize pool
    for (let i = 0; i < config.initialSize; i++) {
      this.pool.push(this.config.createObject());
    }

    this.metrics = {
      totalAcquired: 0,
      totalReleased: 0,
      currentSize: this.pool.length,
      maxSize: config.maxSize,
      averageAcquireTime: 0,
      averageReleaseTime: 0
    };
  }

  // Acquire object from pool
  acquire(): T {
    const startTime = performance.now();

    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.inUse.size + this.pool.length < this.config.maxSize) {
      obj = this.config.createObject();
    } else {
      throw new Error('Pool at maximum capacity');
    }

    // Reset object if needed
    if (this.config.resetObject) {
      obj = this.config.resetObject(obj);
    }

    this.inUse.add(obj);
    this.metrics.totalAcquired++;

    // Update metrics
    const acquireTime = performance.now() - startTime;
    this.acquireTimes.push(acquireTime);
    if (this.acquireTimes.length > 100) {
      this.acquireTimes.shift();
    }

    this.updateMetrics();
    return obj;
  }

  // Release object back to pool
  release(obj: T): void {
    const startTime = performance.now();

    if (!this.inUse.has(obj)) {
      throw new Error('Object not in use');
    }

    this.inUse.delete(obj);

    // Destroy or reset based on pool size
    if (this.pool.length < this.config.minSize) {
      this.pool.push(obj);
    } else if (this.pool.length < this.config.maxSize) {
      obj = this.config.resetObject(obj);
      this.pool.push(obj);
    } else {
      this.config.destroyObject(obj);
    }

    this.metrics.totalReleased++;

    // Update metrics
    const releaseTime = performance.now() - startTime;
    this.releaseTimes.push(releaseTime);
    if (this.releaseTimes.length > 100) {
      this.releaseTimes.shift();
    }

    this.updateMetrics();
  }

  // Get current metrics
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  // Update metrics
  private updateMetrics(): void {
    this.metrics.currentSize = this.pool.length + this.inUse.size;

    if (this.acquireTimes.length > 0) {
      this.metrics.averageAcquireTime =
        this.acquireTimes.reduce((a, b) => a + b, 0) / this.acquireTimes.length;
    }

    if (this.releaseTimes.length > 0) {
      this.metrics.averageReleaseTime =
        this.releaseTimes.reduce((a, b) => a + b, 0) / this.releaseTimes.length;
    }
  }

  // Clear all objects
  clear(): void {
    // Destroy all objects
    this.pool.forEach(obj => this.config.destroyObject(obj));
    this.inUse.forEach(obj => this.config.destroyObject(obj));

    this.pool = [];
    this.inUse.clear();
    this.acquireTimes = [];
    this.releaseTimes = [];
    this.updateMetrics();
  }

  // Get current pool size
  size(): number {
    return this.pool.length + this.inUse.size;
  }

  
  
  // Get in-use objects count
  inUseCount(): number {
    return this.inUse.size;
  }
}

// String pool for simple string reuse
export class StringPool extends SimplePool<string> {
  constructor(config: Partial<PoolConfig<string>> = {}) {
    super({
      initialSize: 10,
      maxSize: 100,
      minSize: 5,
      createObject: () => '',
      resetObject: (str) => str.trim(),
      ...config
    });
  }
}

// Session pool (simplified)
export class SessionPool extends SimplePool<any> {
  constructor(config: Partial<PoolConfig<any>> = {}) {
    super({
      initialSize: 5,
      maxSize: 50,
      minSize: 2,
      createObject: () => ({
        id: '',
        type: 'default',
        name: '',
        workspace: '',
        config: {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      resetObject: (session) => ({
        ...session,
        id: '',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      ...config
    });
  }

  acquireSession(type = 'default', name = '', workspace = '') {
    const session = this.acquire();
    session.id = uuidGenerator.generateFast();
    session.type = type;
    session.name = name;
    session.workspace = workspace;
    session.createdAt = new Date();
    session.updatedAt = new Date();
    return session;
  }
}

// Connection pool (simplified TCP)
export class TCPConnectionPool extends SimplePool<any> {
  private host: string;
  private port: number;
  private connectionConfig: any;

  constructor(
    host: string,
    port: number,
    config: Partial<PoolConfig<any>> = {}
  ) {
    const baseConfig: PoolConfig<any> = {
      initialSize: 2,
      maxSize: 10,
      minSize: 1,
      createObject: () => ({ connected: false, lastUsed: 0 }),
      resetObject: (conn) => ({ connected: false, lastUsed: 0 }),
      destroyObject: (conn) => {},
      ...config
    };

    super(baseConfig);
    this.host = host;
    this.port = port;
    this.connectionConfig = config;
  }

  // Get connection with auto-connect
  async getConnection(): Promise<any> {
    let conn = this.acquire();

    if (!conn.connected) {
      // Simulate connection
      conn.connected = true;
      conn.lastUsed = Date.now();
    }

    return conn;
  }

  // Release connection
  releaseConnection(conn: any): void {
    conn.lastUsed = Date.now();
    this.release(conn);
  }
}
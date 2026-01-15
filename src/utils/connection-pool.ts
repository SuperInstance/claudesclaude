/**
 * High-Performance Connection Pool for Distributed Systems
 *
 * Provides efficient connection pooling for distributed orchestration
 * with support for multiple connection types, health checks, and
 * automatic failover.
 */

import * as net from 'net';
import * as tls from 'tls';
import { EventEmitter } from 'events';

// Connection pool statistics
const POOL_STATS = new Map<string, {
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  totalFailed: number;
  currentSize: number;
  activeConnections: number;
  averageResponseTime: number;
  lastHealthCheck: Date;
}>();

// Global configuration
const GLOBAL_CONFIG = {
  maxPools: 100,
  defaultTimeout: 30000,
  healthCheckInterval: 10000,
  maxRetries: 3,
  retryDelay: 1000,
  enableMetrics: true,
  enableHealthChecks: true
};

export interface ConnectionConfig {
  host: string;
  port: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    cert?: string;
    key?: string;
    ca?: string;
  };
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    path?: string;
    expectedResponse?: number | string;
  };
}

export interface PoolOptions {
  maxConnections?: number;
  minConnections?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
  maxUses?: number;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  retryOptions?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };
}

export interface ConnectionInfo {
  id: string;
  config: ConnectionConfig;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  healthy: boolean;
  responseTime: number;
  errorCount: number;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  healthScore: number;
  lastHealthCheck: Date;
}

/**
 * Base connection interface
 */
export interface IConnection {
  id: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(command: string): Promise<any>;
  ping(): Promise<boolean>;
  isHealthy(): boolean;
  getInfo(): ConnectionInfo;
}

/**
 * Generic connection pool implementation
 */
export class ConnectionPool<T extends IConnection> extends EventEmitter {
  private connections: Map<string, T> = new Map();
  private idleConnections: Set<string> = new Set();
  private activeConnections: Set<string> = new Set();
  private config: Required<PoolOptions>;
  private connectionConfig: ConnectionConfig;
  private isDestroyed = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private metrics: PoolMetrics;

  constructor(connectionConfig: ConnectionConfig, options: PoolOptions = {}) {
    super();

    this.connectionConfig = connectionConfig;
    this.config = {
      maxConnections: options.maxConnections || 10,
      minConnections: options.minConnections || 2,
      acquireTimeout: options.acquireTimeout || GLOBAL_CONFIG.defaultTimeout,
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      maxUses: options.maxUses || 1000,
      enableHealthChecks: options.enableHealthChecks ?? GLOBAL_CONFIG.enableHealthChecks,
      healthCheckInterval: options.healthCheckInterval || GLOBAL_CONFIG.healthCheckInterval,
      retryOptions: {
        maxRetries: options.retryOptions?.maxRetries || GLOBAL_CONFIG.maxRetries,
        retryDelay: options.retryOptions?.retryDelay || GLOBAL_CONFIG.retryDelay,
        backoffMultiplier: options.retryOptions?.backoffMultiplier || 2,
        ...options.retryOptions
      }
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      averageResponseTime: 0,
      errorRate: 0,
      successRate: 0,
      healthScore: 100,
      lastHealthCheck: new Date()
    };

    // Initialize pool
    this.initializePool();
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<T> {
    if (this.isDestroyed) {
      throw new Error('Connection pool has been destroyed');
    }

    const timeout = setTimeout(() => {
      throw new Error(`Connection acquisition timed out after ${this.config.acquireTimeout}ms`);
    }, this.config.acquireTimeout);

    try {
      // First try to get an idle connection
      let connection = await this.getIdleConnection();

      if (!connection) {
        // Create new connection if within limits
        connection = await this.createConnection();
      }

      // Mark as active
      this.activeConnections.add(connection.id);
      this.idleConnections.delete(connection.id);

      // Update metrics
      this.metrics.activeConnections = this.activeConnections.size;
      this.metrics.idleConnections = this.idleConnections.size;

      return connection;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: T): Promise<void> {
    if (!this.connections.has(connection.id) || this.isDestroyed) {
      return;
    }

    try {
      // Mark as idle
      this.activeConnections.delete(connection.id);
      this.idleConnections.add(connection.id);

      // Update metrics
      this.metrics.activeConnections = this.activeConnections.size;
      this.metrics.idleConnections = this.idleConnections.size;

      this.emit('connectionReleased', connection);
    } catch (error) {
      // Handle connection error during release
      await this.handleConnectionError(connection, error);
    }
  }

  /**
   * Execute a command on the first available connection
   */
  async execute(command: string): Promise<any> {
    const connection = await this.acquire();

    try {
      const result = await connection.execute(command);
      await this.release(connection);
      return result;
    } catch (error) {
      await this.release(connection);
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get all connection information
   */
  getConnectionInfo(): ConnectionInfo[] {
    const info: ConnectionInfo[] = [];

    for (const connection of this.connections.values()) {
      info.push(connection.getInfo());
    }

    return info;
  }

  /**
   * Resize the pool
   */
  async resize(newMaxConnections: number): Promise<void> {
    const oldMax = this.config.maxConnections;
    this.config.maxConnections = newMaxConnections;

    if (newMaxConnections > oldMax) {
      // Grow the pool
      const toCreate = newMaxConnections - this.connections.size;
      for (let i = 0; i < toCreate; i++) {
        await this.createConnection();
      }
    } else if (newMaxConnections < oldMax) {
      // Shrink the pool
      const toRemove = this.connections.size - newMaxConnections;
      const idleArray = Array.from(this.idleConnections);

      for (let i = 0; i < Math.min(toRemove, idleArray.length); i++) {
        const connectionId = idleArray[i];
        const connection = this.connections.get(connectionId);
        if (connection) {
          await this.destroyConnection(connection);
        }
      }
    }
  }

  /**
   * Check pool health
   */
  async checkPoolHealth(): Promise<boolean> {
    if (!this.config.enableHealthChecks) {
      return true;
    }

    const startTime = Date.now();
    let healthyConnections = 0;
    let totalResponseTime = 0;
    let errorCount = 0;

    const connectionArray = Array.from(this.connections.values());

    for (const connection of connectionArray) {
      try {
        const isHealthy = await connection.isHealthy();
        if (isHealthy) {
          const pingStart = Date.now();
          await connection.ping();
          const pingTime = Date.now() - pingStart;

          healthyConnections++;
          totalResponseTime += pingTime;

          connection.responseTime = pingTime;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        await this.handleConnectionError(connection, error);
      }
    }

    // Update metrics
    const totalConnections = this.connections.size;
    this.metrics.totalConnections = totalConnections;
    this.metrics.activeConnections = this.activeConnections.size;
    this.metrics.idleConnections = this.idleConnections.size;
    this.metrics.averageResponseTime = totalResponseTime / totalConnections || 0;
    this.metrics.errorRate = errorCount / totalConnections;
    this.metrics.successRate = healthyConnections / totalConnections;
    this.metrics.healthScore = (healthyConnections / totalConnections) * 100;
    this.metrics.lastHealthCheck = new Date();

    const totalCheckTime = Date.now() - startTime;
    this.emit('healthCheckCompleted', {
      healthyConnections,
      totalConnections,
      errorCount,
      duration: totalCheckTime
    });

    return healthyConnections > 0;
  }

  /**
   * Warm up the pool
   */
  async warmup(): Promise<void> {
    const targetSize = this.config.minConnections;
    const currentSize = this.connections.size;

    if (currentSize < targetSize) {
      const toCreate = targetSize - currentSize;
      const createPromises = [];

      for (let i = 0; i < toCreate; i++) {
        createPromises.push(this.createConnection());
      }

      await Promise.all(createPromises);
    }
  }

  /**
   * Drain the pool
   */
  async drain(): Promise<void> {
    const destroyPromises = [];

    for (const connection of this.connections.values()) {
      destroyPromises.push(this.destroyConnection(connection));
    }

    await Promise.all(destroyPromises);

    this.connections.clear();
    this.idleConnections.clear();
    this.activeConnections.clear();

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Destroy the pool
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    await this.drain();
    this.emit('poolDestroyed');
  }

  /**
   * Retry wrapper for connection operations
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    retryDelay?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.retryOptions.maxRetries;
    const delay = retryDelay ?? this.config.retryOptions.retryDelay;

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          const exponentialDelay = delay * Math.pow(this.config.retryOptions.backoffMultiplier || 2, attempt);
          await new Promise(resolve => setTimeout(resolve, exponentialDelay));
        }
      }
    }

    throw lastError;
  }

  // Private methods
  private async initializePool(): Promise<void> {
    // Start with minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection();
    }

    // Start health checks
    if (this.config.enableHealthChecks) {
      this.healthCheckTimer = setInterval(() => {
        this.checkPoolHealth();
      }, this.config.healthCheckInterval);
    }
  }

  private async getIdleConnection(): Promise<T | null> {
    if (this.idleConnections.size === 0) {
      return null;
    }

    // Get the oldest idle connection (FIFO)
    const connectionId = this.idleConnections.values().next().value;
    const connection = this.connections.get(connectionId);

    if (connection && connection.isHealthy()) {
      return connection;
    }

    // Remove unhealthy connection
    if (connection) {
      await this.destroyConnection(connection);
    }

    return null;
  }

  private async createConnection(): Promise<T> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Connection pool is full');
    }

    const connection = this.createConnectionInstance();

    try {
      await connection.connect();
      this.connections.set(connection.id, connection);

      // Update metrics
      this.metrics.totalConnections = this.connections.size;

      return connection;
    } catch (error) {
      await this.handleConnectionError(connection, error);
      throw error;
    }
  }

  private createConnectionInstance(): T {
    // This should be implemented by subclasses
    throw new Error('createConnectionInstance must be implemented by subclass');
  }

  private async destroyConnection(connection: T): Promise<void> {
    try {
      await connection.disconnect();
    } catch (error) {
      // Ignore errors during disconnect
    } finally {
      this.connections.delete(connection.id);
      this.idleConnections.delete(connection.id);
      this.activeConnections.delete(connection.id);

      // Update metrics
      this.metrics.totalConnections = this.connections.size;
      this.metrics.activeConnections = this.activeConnections.size;
      this.metrics.idleConnections = this.idleConnections.size;

      this.emit('connectionDestroyed', connection);
    }
  }

  private async handleConnectionError(connection: T, error: Error): Promise<void> {
    this.emit('connectionError', { connection, error });

    // Increment error count
    const info = connection.getInfo();
    info.errorCount++;

    // Destroy connection if too many errors
    if (info.errorCount >= 5) {
      await this.destroyConnection(connection);
    }
  }
}

/**
 * TCP connection implementation
 */
export class TCPConnection implements IConnection {
  public readonly id: string;
  private socket: net.Socket | null = null;
  private config: ConnectionConfig;
  private info: ConnectionInfo;

  constructor(config: ConnectionConfig) {
    this.id = `tcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = config;
    this.info = {
      id: this.id,
      config,
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
      healthy: true,
      responseTime: 0,
      errorCount: 0
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.config.port, this.config.host);

      this.socket.on('connect', () => {
        this.info.healthy = true;
        resolve();
      });

      this.socket.on('error', (error) => {
        this.info.healthy = false;
        reject(error);
      });

      this.socket.on('close', () => {
        this.info.healthy = false;
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async execute(command: string): Promise<any> {
    if (!this.socket) {
      throw new Error('Connection not established');
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.socket!.write(command + '\n', (error) => {
        if (error) {
          reject(error);
          return;
        }

        // Simple response handling (customize as needed)
        this.socket!.once('data', (data) => {
          const responseTime = Date.now() - startTime;
          this.info.responseTime = responseTime;
          this.info.lastUsed = new Date();
          this.info.usageCount++;
          resolve(data.toString());
        });
      });
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.execute('ping');
      return true;
    } catch {
      return false;
    }
  }

  isHealthy(): boolean {
    return this.info.healthy && !!this.socket;
  }

  getInfo(): ConnectionInfo {
    return { ...this.info };
  }
}

/**
 * TLS connection implementation
 */
export class TLSConnection implements IConnection {
  public readonly id: string;
  private socket: tls.TLSSocket | null = null;
  private config: ConnectionConfig;
  private info: ConnectionInfo;

  constructor(config: ConnectionConfig) {
    this.id = `tls-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = config;
    this.info = {
      id: this.id,
      config,
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
      healthy: true,
      responseTime: 0,
      errorCount: 0
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        host: this.config.host,
        port: this.config.port,
        rejectUnauthorized: this.config.ssl?.rejectUnauthorized ?? true,
        cert: this.config.ssl?.cert,
        key: this.config.ssl?.key,
        ca: this.config.ssl?.ca
      };

      this.socket = tls.connect(options, () => {
        this.info.healthy = true;
        resolve();
      });

      this.socket.on('error', (error) => {
        this.info.healthy = false;
        reject(error);
      });

      this.socket.on('close', () => {
        this.info.healthy = false;
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async execute(command: string): Promise<any> {
    if (!this.socket) {
      throw new Error('Connection not established');
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.socket!.write(command + '\n', (error) => {
        if (error) {
          reject(error);
          return;
        }

        this.socket!.once('data', (data) => {
          const responseTime = Date.now() - startTime;
          this.info.responseTime = responseTime;
          this.info.lastUsed = new Date();
          this.info.usageCount++;
          resolve(data.toString());
        });
      });
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.execute('ping');
      return true;
    } catch {
      return false;
    }
  }

  isHealthy(): boolean {
    return this.info.healthy && !!this.socket;
  }

  getInfo(): ConnectionInfo {
    return { ...this.info };
  }
}

// Factory functions
export function createTCPConnectionPool(config: ConnectionConfig, options?: PoolOptions): ConnectionPool<TCPConnection> {
  return new ConnectionPool<TCPConnection>(config, options);
}

export function createTLSConnectionPool(config: ConnectionConfig, options?: PoolOptions): ConnectionPool<TLSConnection> {
  return new ConnectionPool<TLSConnection>(config, options);
}

// Connection pool management
export class ConnectionPoolManager {
  private pools: Map<string, ConnectionPool<IConnection>> = new Map();

  createPool(key: string, connectionConfig: ConnectionConfig, options?: PoolOptions): ConnectionPool<IConnection> {
    let pool: ConnectionPool<IConnection>;

    if (connectionConfig.ssl) {
      pool = createTLSConnectionPool(connectionConfig, options);
    } else {
      pool = createTCPConnectionPool(connectionConfig, options);
    }

    this.pools.set(key, pool);
    return pool;
  }

  getPool(key: string): ConnectionPool<IConnection> | undefined {
    return this.pools.get(key);
  }

  async closeAll(): Promise<void> {
    const closePromises = [];

    for (const pool of this.pools.values()) {
      closePromises.push(pool.destroy());
    }

    await Promise.all(closePromises);
    this.pools.clear();
  }
}

// Global connection pool manager
export const connectionPoolManager = new ConnectionPoolManager();
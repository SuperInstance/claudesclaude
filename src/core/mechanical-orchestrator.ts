/**
 * Mechanical Operations Service - Fully Integrated Implementation
 *
 * This orchestrator integrates all mechanical operations for maximum performance
 * and efficiency. It separates purely mechanical operations from AI model processing.
 */

import type { Session, SessionType, Message } from './types.js';
import { WorkspaceManager, createWorkspaceManager } from '../utils/workspace-manager.js';
import { TimestampOperations, format as formatTimestamp } from '../utils/timestamp-operations.js';
import { SerializationUtils, serialize, deserialize } from '../utils/serialization-utils.js';
import { ObjectPool, SessionPool } from '../utils/object-pool.js';
import { ConnectionPoolManager } from '../utils/connection-pool.js';
import { uuidGenerator, generateUUID } from '../utils/uuid-generator.js';

export interface MechanicalOrchestratorConfig {
  // Path configuration
  workspacePath: string;
  tempPath?: string;

  // Performance configurations
  enableSerialization: boolean;
  enableObjectPooling: boolean;
  enableConnectionPooling: boolean;
  enableWorkspaceManagement: boolean;
  enableCompression: boolean;
  enableCaching: boolean;

  // Pool configurations
  sessionPoolConfig?: {
    initialSize?: number;
    maxPoolSize?: number;
    minPoolSize?: number;
  };

  // Serialization configurations
  serializationConfig?: {
    format?: 'json' | 'msgpack' | 'cbor';
    compress?: boolean;
    cacheSize?: number;
    compressionThreshold?: number;
  };

  // Connection pooling configurations
  connectionPoolConfig?: {
    maxConnections?: number;
    minConnections?: number;
    acquireTimeout?: number;
  };
}

export interface MechanicalMetrics {
  // Core metrics
  sessionOperations: number;
  fileOperations: number;
  serializationTime: number;
  deserializationTime: number;
  poolAcquisitions: number;
  poolReleases: number;

  // Performance metrics
  averageResponseTime: number;
  cacheHitRate: number;
  compressionRatio: number;

  // Memory metrics
  memoryUsage: number;
  poolUtilization: number;

  // System metrics
  workspaceSize: number;
  connectionPoolHealth: number;
}

/**
 * Mechanical Operations Orchestrator
 *
 * This service handles all mechanical operations that don't require AI models:
 * - UUID generation
 * - Timestamp operations
 * - File operations for workspace management
 * - Serialization/deserialization
 * - Memory management and object pooling
 * - Connection pooling for distributed systems
 */
export class MechanicalOrchestrator {
  // Core data structures
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private events = new Map<string, Function[]>();

  // Mechanical services
  private workspaceManager!: WorkspaceManager;
  private sessionPool!: SessionPool;
  private serializationPool!: ObjectPool<any>;
  private connectionPoolManager = new ConnectionPoolManager();

  // Configuration
  private config: Required<MechanicalOrchestratorConfig>;

  // Metrics tracking
  private metrics: MechanicalMetrics = {
    sessionOperations: 0,
    fileOperations: 0,
    serializationTime: 0,
    deserializationTime: 0,
    poolAcquisitions: 0,
    poolReleases: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    compressionRatio: 0,
    memoryUsage: 0,
    poolUtilization: 0,
    workspaceSize: 0,
    connectionPoolHealth: 100
  };

  constructor(config: MechanicalOrchestratorConfig) {
    this.config = {
      tempPath: './temp',
      sessionPoolConfig: {
        initialSize: 50,
        maxPoolSize: 500,
        minPoolSize: 10
      },
      serializationConfig: {
        format: 'json',
        compress: true,
        cacheSize: 1000,
        compressionThreshold: 1024
      },
      connectionPoolConfig: {
        maxConnections: 10,
        minConnections: 2,
        acquireTimeout: 30000
      },
      ...config
    };

    this.initializeMechanicalServices();
    this.startMetricsCollection();
  }

  /**
   * Initialize all mechanical services
   */
  private initializeMechanicalServices(): void {
    // Initialize workspace management
    if (this.config.enableWorkspaceManagement) {
      this.workspaceManager = createWorkspaceManager(this.config.workspacePath);

      // Create temp directory
      require('fs').mkdirSync(this.config.tempPath!, { recursive: true });
    }

    // Initialize session pool
    if (this.config.enableObjectPooling) {
      this.sessionPool = new SessionPool({
        initialSize: this.config.sessionPoolConfig.initialSize,
        maxPoolSize: this.config.sessionPoolConfig.maxPoolSize,
        minPoolSize: this.config.sessionPoolConfig.minPoolSize,
        createObject: this.createSessionObject.bind(this),
        resetObject: this.resetSessionObject.bind(this),
        enableDynamicSizing: true,
        growthFactor: 1.5,
        shrinkThreshold: 0.25,
        shrinkIntervalMs: 30000
      });

      // Initialize serialization pool
      this.serializationPool = new ObjectPool({
        initialSize: 20,
        maxPoolSize: 100,
        minPoolSize: 5,
        createObject: () => ({ buffer: null, type: 'serialization' }),
        resetObject: (obj) => ({ buffer: null, type: 'serialization' }),
        enableDynamicSizing: true,
        growthFactor: 1.5,
        shrinkThreshold: 0.25,
        shrinkIntervalMs: 30000
      });
    }

    // Initialize connection pools
    if (this.config.enableConnectionPooling) {
      this.connectionPoolManager.createPool('default', {
        host: 'localhost',
        port: 8080
      }, {
        maxConnections: this.config.connectionPoolConfig.maxConnections,
        minConnections: this.config.connectionPoolConfig.minConnections,
        acquireTimeout: this.config.connectionPoolConfig.acquireTimeout
      });
    }
  }

  /**
   * Create a new session with mechanical optimizations
   */
  async createSession(config: {
    type: SessionType;
    name: string;
    workspace: string;
    config?: any;
    persist?: boolean;
  }): Promise<Session> {
    const startTime = performance.now();
    this.metrics.sessionOperations++;

    try {
      // Get session from pool or create new
      let session: Session;

      if (this.config.enableObjectPooling) {
        session = this.sessionPool.acquireSession(config.type, config.name, config.workspace);
      } else {
        session = this.createSessionDirect(config);
      }

      // Persist to workspace if enabled
      if (this.config.enableWorkspaceManagement && config.persist && this.workspaceManager) {
        await this.persistSession(session);
      }

      // Update metrics
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      this.emit('session', session);
      return session;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get session with optimized retrieval
   */
  async getSession(id: string): Promise<Session | null> {
    const startTime = performance.now();

    // Check memory first
    let session = this.sessions.get(id);

    // Try workspace if not in memory
    if (!session && this.config.enableWorkspaceManagement && this.workspaceManager) {
      try {
        const sessionData = await this.workspaceManager.readFile(
          `sessions/${id}.json`,
          { cache: this.config.enableCaching }
        );

        let deserializedSession: Session;
        if (this.config.enableSerialization) {
          const deserializationStart = performance.now();
          deserializedSession = await deserialize(sessionData as Buffer, {
            format: this.config.serializationConfig.format,
            compress: this.config.enableCompression
          });
          this.metrics.deserializationTime += performance.now() - deserializationStart;
        } else {
          deserializedSession = JSON.parse(sessionData.toString());
        }

        session = deserializedSession;
        this.sessions.set(id, session);
      } catch {
        // Session not found in workspace
      }
    }

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    return session || null;
  }

  /**
   * Update session with optimized persistence
   */
  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const startTime = performance.now();

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    // Apply updates efficiently
    Object.assign(session, updates, { updatedAt: new Date() });
    this.sessions.set(id, session);

    // Persist to workspace
    if (this.config.enableWorkspaceManagement && this.workspaceManager) {
      await this.persistSession(session);
    }

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);
  }

  /**
   * Delete session with cleanup
   */
  async deleteSession(id: string): Promise<void> {
    const startTime = performance.now();

    // Remove from memory
    this.sessions.delete(id);
    this.contexts.delete(id);

    // Remove from workspace
    if (this.config.enableWorkspaceManagement && this.workspaceManager) {
      try {
        await this.workspaceManager.deleteFile(`sessions/${id}.json`);
      } catch {
        // File not found, ignore
      }
    }

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);
  }

  /**
   * Get all sessions with optimized retrieval
   */
  async getAllSessions(): Promise<Session[]> {
    const startTime = performance.now();

    // Get sessions from memory
    let sessions = Array.from(this.sessions.values());

    // Load from workspace if memory is empty
    if (sessions.length === 0 && this.config.enableWorkspaceManagement && this.workspaceManager) {
      try {
        const sessionFiles = await this.workspaceManager.listFiles('sessions', {
          extensions: ['.json']
        });

        for (const file of sessionFiles) {
          try {
            const sessionData = await this.workspaceManager.readFile(file, {
              cache: this.config.enableCaching
            });

            let session: Session;
            if (this.config.enableSerialization) {
              session = await deserialize(sessionData as Buffer, {
                format: this.config.serializationConfig.format,
                compress: this.config.enableCompression
              });
            } else {
              session = JSON.parse(sessionData.toString());
            }

            this.sessions.set(session.id, session);
            sessions.push(session);
          } catch {
            // Skip invalid session files
          }
        }
      } catch {
        // No sessions directory
      }
    }

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    return sessions;
  }

  /**
   * Context management with serialization
   */
  async setContext(id: string, context: any): Promise<void> {
    const startTime = performance.now();

    let serializedContext = context;

    if (this.config.enableSerialization) {
      const serializationStart = performance.now();
      const result = await serialize(context, {
        format: this.config.serializationConfig.format,
        compress: this.config.enableCompression && this.config.serializationConfig.compressionThreshold !== undefined,
        cache: this.config.enableCaching
      });
      serializedContext = result.data;
      this.metrics.serializationTime += performance.now() - serializationStart;
    }

    this.contexts.set(id, serializedContext);

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);
  }

  /**
   * Get context with deserialization
   */
  async getContext(id: string): Promise<any> {
    const startTime = performance.now();

    let context = this.contexts.get(id);

    if (this.config.enableSerialization && context && Buffer.isBuffer(context)) {
      const deserializationStart = performance.now();
      context = await deserialize(context, {
        format: this.config.serializationConfig.format,
        compress: this.config.enableCompression
      });
      this.metrics.deserializationTime += performance.now() - deserializationStart;
    }

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    return context;
  }

  /**
   * Enhanced publish with file persistence
   */
  async publish(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const startTime = performance.now();

    // Create optimized message
    const fullMessage: Message = {
      ...message,
      id: generateUUID(),
      timestamp: new Date()
    };

    // Persist message if enabled
    if (this.config.enableWorkspaceManagement && this.workspaceManager) {
      try {
        await this.workspaceManager.writeFile(
          `messages/${fullMessage.id}.json`,
          JSON.stringify(fullMessage, null, 2),
          { createDirectory: true, overwrite: false }
        );
        this.metrics.fileOperations++;
      } catch {
        // Ignore persistence errors
      }
    }

    // Emit to subscribers
    this.emit('message', fullMessage);

    const responseTime = performance.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    return fullMessage;
  }

  /**
   * Get comprehensive mechanical metrics
   */
  getMetrics(): MechanicalMetrics {
    // Update workspace size
    if (this.workspaceManager) {
      this.metrics.workspaceSize = this.calculateWorkspaceSize();
    }

    // Update pool utilization
    if (this.sessionPool) {
      const poolStats = this.sessionPool.getStats();
      this.metrics.poolUtilization = poolStats.activeObjects / poolStats.totalCreated;
    }

    // Update connection pool health
    const defaultPool = this.connectionPoolManager.getPool('default');
    if (defaultPool) {
      this.metrics.connectionPoolHealth = defaultPool.getMetrics().healthScore;
    }

    // Update memory usage
    if (process.memoryUsage) {
      const memory = process.memoryUsage();
      this.metrics.memoryUsage = memory.heapUsed;
    }

    return { ...this.metrics };
  }

  /**
   * Perform workspace cleanup operations
   */
  async cleanupWorkspace(options: {
    olderThan?: number;
    patterns?: RegExp[];
    dryRun?: boolean;
  } = {}): Promise<{ deleted: string[]; totalSize: number }> {
    if (!this.workspaceManager) {
      return { deleted: [], totalSize: 0 };
    }

    return this.workspaceManager.cleanup({
      olderThan: options.olderThan || 86400000, // 24 hours
      patterns: options.patterns || [],
      dryRun: options.dryRun || false
    });
  }

  /**
   * Create workspace backup
   */
  async createBackup(backupPath?: string): Promise<string | null> {
    if (!this.workspaceManager) {
      return null;
    }

    return this.workspaceManager.createBackup(backupPath);
  }

  /**
   * Warm up all caches and pools
   */
  async warmup(): Promise<void> {
    // Warm up session pool
    if (this.config.enableObjectPooling) {
      this.sessionPool.warmup(20);
    }

    // Warm up serialization pool
    if (this.config.enableObjectPooling && this.serializationPool) {
      for (let i = 0; i < 10; i++) {
        const obj = this.serializationPool.acquire();
        this.serializationPool.release(obj);
      }
    }

    // Pre-load workspace
    if (this.config.enableWorkspaceManagement && this.workspaceManager) {
      try {
        await this.workspaceManager.listFiles('', { recursive: true });
      } catch {
        // Ignore if workspace doesn't exist
      }
    }
  }

  /**
   * Shutdown with proper cleanup
   */
  async shutdown(): Promise<void> {
    // Persist all sessions
    if (this.config.enableWorkspaceManagement && this.workspaceManager) {
      for (const session of this.sessions.values()) {
        await this.persistSession(session);
      }
    }

    // Cleanup pools
    if (this.config.enableObjectPooling) {
      this.sessionPool.dispose();
      if (this.serializationPool) {
        this.serializationPool.dispose();
      }
    }

    // Clear data structures
    this.sessions.clear();
    this.contexts.clear();
    this.events.clear();

    // Cleanup workspace
    if (this.workspaceManager) {
      await this.workspaceManager.destroy();
    }
  }

  // Helper methods
  private createSessionDirect(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const now = Date.now();
    return {
      id: generateUUID(),
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  private createSessionObject(): Session {
    const now = Date.now();
    return {
      id: generateUUID(),
      type: 'ai-assistant',
      name: '',
      workspace: '',
      config: {},
      status: 'active',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  }

  private resetSessionObject(session: Session): Session {
    return {
      ...session,
      name: '',
      workspace: '',
      config: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async persistSession(session: Session): Promise<void> {
    if (!this.workspaceManager) return;

    try {
      const sessionDir = 'sessions';
      const sessionFile = `${session.id}.json`;

      // Ensure directory exists
      await this.workspaceManager.writeFile(
        `${sessionDir}/.keep`,
        '',
        { createDirectory: true }
      );

      // Serialize and save
      let sessionData: string | Buffer = JSON.stringify(session, null, 2);

      if (this.config.enableSerialization) {
        const result = await serialize(session, {
          format: this.config.serializationConfig.format,
          compress: this.config.enableCompression,
          cache: this.config.enableCaching
        });
        sessionData = result.data;
      }

      await this.workspaceManager.writeFile(
        `${sessionDir}/${sessionFile}`,
        sessionData,
        { overwrite: false }
      );
    } catch {
      // Ignore persistence errors
    }
  }

  private calculateWorkspaceSize(): number {
    // This would calculate the actual workspace size
    // For now, return an estimate
    return this.sessions.size * 1024 + this.contexts.size * 512;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const count = this.metrics.sessionOperations;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (count - 1) + responseTime) / count;
  }

  private startMetricsCollection(): void {
    // Update metrics periodically
    setInterval(() => {
      // Update cache hit rate (simplified)
      if (this.workspaceManager) {
        const workspaceStats = this.workspaceManager.getStats();
        this.metrics.cacheHitRate = workspaceStats.hits / (workspaceStats.hits + workspaceStats.misses);
      }

      // Update memory usage
      if (process.memoryUsage) {
        const memory = process.memoryUsage();
        this.metrics.memoryUsage = memory.heapUsed;
      }
    }, 5000);
  }

  // Event system
  on(event: string, handler: Function): void {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event)!.push(handler);
  }

  emit(event: string, data: any): void {
    const handlers = this.events.get(event);
    if (handlers) handlers.forEach(h => h(data));
  }

  subscribe(callback: (message: Message) => void): void {
    this.on('message', callback);
  }
}

// Factory function
export function createMechanicalOrchestrator(config: MechanicalOrchestratorConfig): MechanicalOrchestrator {
  return new MechanicalOrchestrator(config);
}

// Default configuration
export const DEFAULT_MECHANICAL_CONFIG: MechanicalOrchestratorConfig = {
  workspacePath: './workspace',
  enableSerialization: true,
  enableObjectPooling: true,
  enableConnectionPooling: true,
  enableWorkspaceManagement: true,
  enableCompression: true,
  enableCaching: true
};
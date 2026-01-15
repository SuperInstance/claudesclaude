import type { Session, SessionType, Message } from './types.js';
import { SimpleLRUCache } from '../utils/simple-lru-cache.js';
import { OptimizedSessionManager } from '../utils/session-manager.js';
import { OptimizedEventManager } from '../utils/event-manager.js';
import { uuidGenerator } from '../utils/uuid-generator.js';
import { PerformanceCollector } from '../utils/performance-metrics.js';
import { EventBatcher } from '../utils/event-batcher.js';
import { ObjectPool } from '../utils/object-pool.js';
import { createMechanicalOrchestrator } from '../core/mechanical-orchestrator.js';

export interface UnifiedOrchestratorConfig {
  enableOptimizations?: boolean;
  uuidStrategy?: 'fast' | 'secure' | 'hybrid' | 'thread-safe';
  enableEventBatching?: boolean;
  enableObjectPooling?: boolean;
  enablePerformanceMetrics?: boolean;
  maxSessionCacheSize?: number;
  maxContextCacheSize?: number;
  sessionTTL?: number;
  contextTTL?: number;
  maxBatchSize?: number;
  maxBatchWaitMs?: number;
  maxMemoryUsage?: number;
}

export interface OptimizedMetrics {
  // Session metrics
  sessionCount: number;
  activeSessions: number;
  sessionsCreated: number;
  sessionsDeleted: number;

  // Performance metrics
  averageSessionCreationTime: number;
  averageSessionUpdateTime: number;
  averageMessagePublishTime: number;
  performance: any;

  // Cache metrics
  cache: {
    sessions: any;
    contexts: any;
  };

  // Manager metrics
  managers: {
    sessions: any;
    events: any;
  };

  // Memory metrics
  memory: {
    sessionCacheUsage: number;
    contextCacheUsage: number;
    totalMemoryUsage: number;
  };

  // System health
  health: {
    uptime: number;
    lastCleanup: number;
    optimizations: {
      eventBatching: boolean;
      objectPooling: boolean;
      performanceMetrics: boolean;
      uuidOptimization: boolean;
    };
  };

  // System metrics
  memoryUsage: number;
  eventThroughput: number;
  poolUtilization: number;

  // UUID generation metrics
  uuidThroughput: number;
  uuidStrategy: string;

  // Event batching metrics
  batchSize: number;
  batchWaitTime: number;
  memoryPercentage: number;
}

export class UnifiedOrchestratorOptimized {
  private config: Required<UnifiedOrchestratorConfig>;

  // Core storage with optimizations
  private sessionCache: SimpleLRUCache<string, Session>;
  private contextCache: SimpleLRUCache<string, any>;
  private sessionManager: OptimizedSessionManager;
  private eventManager: OptimizedEventManager;

  // Performance components
  private uuidGenerator: UUIDGenerator;
  private metrics: PerformanceMetrics;
  private eventBatcher: EventBatcher;
  private sessionPool: ObjectPool<Session>;
  private mechanicalOrchestrator: ReturnType<typeof createMechanicalOrchestrator>;

  // State tracking
  private isInitialized = false;
  private lastCleanup = 0;
  private cleanupInterval = 30000; // 30 seconds

  constructor(config: UnifiedOrchestratorConfig = {}) {
    this.config = {
      enableOptimizations: true,
      uuidStrategy: 'hybrid',
      enableEventBatching: true,
      enableObjectPooling: true,
      enablePerformanceMetrics: true,
      maxSessionCacheSize: 1000,
      maxContextCacheSize: 500,
      sessionTTL: 30 * 60 * 1000, // 30 minutes
      contextTTL: 60 * 60 * 1000, // 1 hour
      maxBatchSize: 100,
      maxBatchWaitMs: 16,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      ...config
    };

    this.initializeOptimizations();
  }

  private initializeOptimizations() {
    // Initialize caches
    this.sessionCache = new SimpleLRUCache({
      maxSize: this.config.maxSessionCacheSize,
      ttl: this.config.sessionTTL,
      maxMemoryUsage: this.config.maxMemoryUsage
    });

    this.contextCache = new SimpleLRUCache({
      maxSize: this.config.maxContextCacheSize,
      ttl: this.config.contextTTL,
      maxMemoryUsage: this.config.maxMemoryUsage
    });

    // Initialize performance components
    this.uuidGenerator = uuidGenerator;
    this.metrics = new PerformanceCollector();
    this.eventBatcher = new EventBatcher({
      maxBatchSize: this.config.maxBatchSize,
      maxBatchWaitMs: this.config.maxBatchWaitMs
    });

    // Initialize managers
    this.sessionManager = new OptimizedSessionManager({
      maxCacheSize: this.config.maxSessionCacheSize,
      sessionTTL: this.config.sessionTTL,
      enableMetrics: this.config.enablePerformanceMetrics
    });

    this.eventManager = new OptimizedEventManager({
      enableWeakReferences: this.config.enableOptimizations,
      enableBatching: this.config.enableEventBatching
    });

    // Initialize object pooling if enabled
    if (this.config.enableObjectPooling) {
      this.sessionPool = new ObjectPool({
        createObject: () => ({
          id: '',
          type: 'development' as SessionType,
          name: '',
          workspace: '',
          config: {},
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        resetObject: (session) => {
          session.config = {};
          session.status = 'active';
          session.updatedAt = new Date();
        },
        initialSize: 10,
        maxPoolSize: 1000,
        minPoolSize: 5,
        enableDynamicSizing: true,
        growthFactor: 1.5,
        shrinkThreshold: 0.25,
        shrinkIntervalMs: 30000
      });
    }

    // Initialize mechanical orchestrator
    this.mechanicalOrchestrator = createMechanicalOrchestrator({
      enableUUIDGeneration: this.config.enableOptimizations,
      enableTimestampOperations: this.config.enableOptimizations,
      enableWorkspaceManagement: true,
      enableSerialization: true
    });

    this.isInitialized = true;
  }

  // Core session management with optimizations
  async createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Promise<Session> {
    const timer = this.metrics.startTimer('session.create');

    try {
      // Use mechanical orchestrator for basic operations
      const sessionId = this.mechanicalOrchestrator.generateUUID();
      const now = this.mechanicalOrchestrator.getCurrentTimestamp();

      // Get session from pool or create new
      let session: Session;
      if (this.config.enableObjectPooling && this.sessionPool) {
        session = this.sessionPool.acquire();
        Object.assign(session, {
          id: sessionId,
          type: config.type,
          name: config.name,
          workspace: config.workspace,
          config: config.config || {},
          status: 'active',
          createdAt: now,
          updatedAt: now
        });
      } else {
        session = {
          id: sessionId,
          type: config.type,
          name: config.name,
          workspace: config.workspace,
          config: config.config || {},
          status: 'active',
          createdAt: now,
          updatedAt: now
        };
      }

      // Store in cache and session manager
      this.sessionCache.set(sessionId, session);
      this.sessionManager.addSession(session);

      // Emit event with batching
      if (this.config.enableEventBatching) {
        this.eventBatcher.batchEvent('session', session);
      } else {
        this.eventManager.emit('session', session);
      }

      this.metrics.endTimer(timer);
      return session;
    } catch (error) {
      this.metrics.endTimer(timer);
      throw error;
    }
  }

  // Session management with caching
  getSession(id: string): Session | undefined {
    const timer = this.metrics.startTimer('session.get');

    // Check cache first
    let session = this.sessionCache.get(id);

    if (!session) {
      session = this.sessionManager.getSession(id);
      if (session) {
        this.sessionCache.set(id, session);
      }
    }

    this.metrics.endTimer(timer);
    return session;
  }

  getAllSessions(): Session[] {
    const timer = this.metrics.startTimer('session.getAll');

    const sessions = this.sessionManager.getAllSessions();
    this.metrics.endTimer(timer);
    return sessions;
  }

  updateSession(id: string, updates: Partial<Session>): void {
    const timer = this.metrics.startTimer('session.update');

    const session = this.getSession(id);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = this.mechanicalOrchestrator.getCurrentTimestamp();

      this.sessionCache.set(id, session);
      this.sessionManager.updateSession(id, updates);

      // Emit update event
      if (this.config.enableEventBatching) {
        this.eventBatcher.batchEvent('session.update', { id, updates });
      } else {
        this.eventManager.emit('session.update', { id, updates });
      }
    }

    this.metrics.endTimer(timer);
  }

  deleteSession(id: string): void {
    const timer = this.metrics.startTimer('session.delete');

    this.sessionCache.delete(id);
    this.sessionManager.removeSession(id);

    // Return to pool if enabled
    if (this.config.enableObjectPooling && this.sessionPool) {
      const session = this.sessionCache.get(id);
      if (session) {
        this.sessionPool.release(session);
      }
    }

    this.metrics.endTimer(timer);
  }

  // Context management with optimizations
  getContext(id: string) {
    const timer = this.metrics.startTimer('context.get');

    let context = this.contextCache.get(id);

    if (!context) {
      context = this.contextCache.get(id);
      if (context) {
        this.contextCache.set(id, context);
      }
    }

    this.metrics.endTimer(timer);
    return context;
  }

  setContext(id: string, context: any) {
    const timer = this.metrics.startTimer('context.set');

    // Use mechanical orchestrator for serialization if needed
    const serialized = this.config.enableOptimizations
      ? this.mechanicalOrchestrator.serializeData(context)
      : context;

    this.contextCache.set(id, serialized);
    this.metrics.endTimer(timer);
  }

  getAllContexts() {
    const timer = this.metrics.startTimer('context.getAll');
    const contexts = this.contextCache.values();
    this.metrics.endTimer(timer);
    return Array.from(contexts);
  }

  // Event system with optimizations
  on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  off(event: string, handler: Function): void {
    this.eventManager.off(event, handler);
  }

  emit(event: string, data: any): void {
    if (this.config.enableEventBatching) {
      this.eventBatcher.batchEvent(event, data);
    } else {
      this.eventManager.emit(event, data);
    }
  }

  // Simple messaging with optimizations
  publish(message: Omit<Message, 'id' | 'timestamp'>) {
    const timer = this.metrics.startTimer('message.publish');

    const messageId = this.mechanicalOrchestrator.generateUUID();
    const timestamp = this.mechanicalOrchestrator.getCurrentTimestamp();

    const fullMessage = {
      ...message,
      id: messageId,
      timestamp
    };

    // Emit with batching if enabled
    if (this.config.enableEventBatching) {
      this.eventBatcher.batchEvent('message', fullMessage);
    } else {
      this.eventManager.emit('message', fullMessage);
    }

    this.metrics.endTimer(timer);
    return fullMessage;
  }

  subscribe(callback: (message: Message) => void): void {
    this.eventManager.on('message', callback);
  }

  unsubscribe(callback: (message: Message) => void): void {
    this.eventManager.off('message', callback);
  }

  // Enhanced metrics with performance data
  getMetrics() {
    const timer = this.metrics.startTimer('metrics.get');

    const sessions = this.getAllSessions();
    const cacheMetrics = this.sessionCache.getMetrics();
    const contextMetrics = this.contextCache.getMetrics();
    const sessionManagerMetrics = this.sessionManager.getMetrics();
    const eventMetrics = this.eventManager.getMetrics();

    const metrics = {
      // Basic session metrics
      sessionCount: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,

      // Performance metrics
      performance: this.metrics.getMetrics(),

      // Cache metrics
      cache: {
        sessions: cacheMetrics,
        contexts: contextMetrics
      },

      // Manager metrics
      managers: {
        sessions: sessionManagerMetrics,
        events: eventMetrics
      },

      // Memory metrics
      memory: {
        sessionCacheUsage: this.sessionCache.getCurrentMemoryUsage(),
        contextCacheUsage: this.contextCache.getCurrentMemoryUsage(),
        totalMemoryUsage: this.sessionCache.getCurrentMemoryUsage() + this.contextCache.getCurrentMemoryUsage()
      },

      // System health
      health: {
        uptime: process.uptime(),
        lastCleanup: this.lastCleanup,
        optimizations: {
          eventBatching: this.config.enableEventBatching,
          objectPooling: this.config.enableObjectPooling,
          performanceMetrics: this.config.enablePerformanceMetrics,
          uuidOptimization: this.config.enableOptimizations
        }
      }
    };

    this.metrics.endTimer(timer);
    return metrics;
  }

  // Lifecycle management
  shutdown(): void {
    const timer = this.metrics.startTimer('shutdown');

    // Clear all caches
    this.sessionCache.clear();
    this.contextCache.clear();

    // Shutdown managers
    this.sessionManager.shutdown();
    this.eventManager.shutdown();

    // Shutdown pools
    if (this.sessionPool) {
      this.sessionPool.clear();
    }

    // Shutdown metrics
    this.metrics.shutdown();

    this.isInitialized = false;
    this.metrics.endTimer(timer);
  }

  // Periodic cleanup
  private performCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.sessionCache.cleanup();
      this.contextCache.cleanup();
      this.eventManager.cleanup();
      this.lastCleanup = now;
    }
  }

  // Manual cleanup trigger
  cleanup(): void {
    this.performCleanup();
  }

  // Get current configuration
  getConfig(): UnifiedOrchestratorConfig {
    return { ...this.config };
  }

  // Update configuration at runtime
  updateConfig(newConfig: Partial<UnifiedOrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize affected components
    if (newConfig.uuidStrategy) {
      this.uuidGenerator = uuidGenerator;
    }

    if (newConfig.enableEventBatching !== undefined) {
      this.eventBatcher.setEnabled(this.config.enableEventBatching);
    }
  }
}

// Factory function with optimizations
export function createUnifiedOrchestrator(config: UnifiedOrchestratorConfig = {}) {
  return new UnifiedOrchestratorOptimized(config);
}

// Default optimized orchestrator
export const createOptimizedUnifiedOrchestrator = () =>
  createUnifiedOrchestrator({
    enableOptimizations: true,
    uuidStrategy: 'hybrid',
    enableEventBatching: true,
    enableObjectPooling: true,
    enablePerformanceMetrics: true
  });
/**
 * Unified Memory Manager for Orchestration System
 *
 * This coordinates all memory optimization components:
 * - Session caching and cleanup
 * - Event management with weak references
 * - Context caching
 * - Memory limits and eviction policies
 * - Comprehensive memory metrics
 */

import { EventEmitter } from 'events';
import { Logger } from './simple-logger';
import { SimpleLRUCache, MemoryMetrics as CacheMetrics } from './simple-lru-cache';
import { OptimizedSessionManager, SessionManagerMetrics } from './session-manager';
import { OptimizedEventManager, EventManagerMetrics } from './event-manager';

export interface MemoryManagerMetrics {
  totalMemoryUsage: number;
  heapUsage: number;
  heapLimit: number;
  heapUsagePercentage: number;

  // Cache metrics
  sessionCache: CacheMetrics;
  contextCache: CacheMetrics;
  eventCache: CacheMetrics;

  // Manager metrics
  sessionManager: SessionManagerMetrics;
  eventManager: EventManagerMetrics;

  // System metrics
  evictions: number;
  cleanups: number;
  lastMemoryCheck?: Date;
  memoryPressureEvents: number;
}

export interface MemoryManagerOptions {
  logger?: Logger;
  enableMemoryMonitoring?: boolean;
  memoryCheckIntervalMs?: number;
  memoryPressureThreshold?: number; // 0.0 to 1.0
  enableAutoOptimization?: boolean;
  enableWeakReferences?: boolean;
  maxSessions?: number;
  maxContexts?: number;
  maxEvents?: number;
}

export class UnifiedMemoryManager extends EventEmitter {
  private logger: Logger;
  private options: Required<MemoryManagerOptions>;

  private sessionCache: SimpleLRUCache<string, any>;
  private contextCache: SimpleLRUCache<string, any>;
  private sessionManager: OptimizedSessionManager;
  private eventManager: OptimizedEventManager;

  private memoryMetrics: MemoryManagerMetrics;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private weakReferenceCleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: MemoryManagerOptions = {}) {
    super();

    this.options = {
      logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
      enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
      memoryCheckIntervalMs: options.memoryCheckIntervalMs || 30000, // 30 seconds
      memoryPressureThreshold: options.memoryPressureThreshold || 0.8, // 80%
      enableAutoOptimization: options.enableAutoOptimization !== false,
      enableWeakReferences: options.enableWeakReferences !== false,
      maxSessions: options.maxSessions || 1000,
      maxContexts: options.maxContexts || 5000,
      maxEvents: options.maxEvents || 10000
    };

    this.logger = this.options.logger.createChildLogger({ component: 'memory-manager' });

    // Initialize caches
    this.sessionCache = new SimpleLRUCache({
      max: this.options.maxSessions,
      ttl: 30 * 60 * 1000, // 30 minutes
      maxMemoryBytes: 50 * 1024 * 1024, // 50MB
      updateAgeOnGet: true
    });

    this.contextCache = new SimpleLRUCache({
      max: this.options.maxContexts,
      ttl: 15 * 60 * 1000, // 15 minutes
      maxMemoryBytes: 100 * 1024 * 1024, // 100MB
      updateAgeOnGet: true
    });

    // Initialize managers
    this.sessionManager = new OptimizedSessionManager({
      logger: this.logger.createChildLogger({ component: 'session-manager' }),
      maxSessions: this.options.maxSessions,
      sessionTTL: 30 * 60 * 1000,
      enableWeakReferences: this.options.enableWeakReferences
    });

    this.eventManager = new OptimizedEventManager({
      logger: this.logger.createChildLogger({ component: 'event-manager' }),
      enableWeakReferences: this.options.enableWeakReferences,
      maxSubscriptions: this.options.maxEvents,
      enableAutoCleanup: true,
      cleanupIntervalMs: 300000 // 5 minutes
    });

    // Initialize metrics
    this.memoryMetrics = {
      totalMemoryUsage: 0,
      heapUsage: 0,
      heapLimit: 0,
      heapUsagePercentage: 0,
      sessionCache: this.sessionCache.getMemoryMetrics(),
      contextCache: this.contextCache.getMemoryMetrics(),
      sessionManager: this.sessionManager.getMetrics(),
      eventManager: this.eventManager.getMetrics(),
      evictions: 0,
      cleanups: 0,
      memoryPressureEvents: 0
    };

    this.setupEventHandlers();
    this.initializeMemoryMonitoring();
  }

  /**
   * Get comprehensive memory metrics
   */
  getMetrics(): MemoryManagerMetrics {
    // Update current memory usage
    const memoryUsage = process.memoryUsage();
    const now = Date.now();

    this.memoryMetrics = {
      totalMemoryUsage: memoryUsage.heapUsed,
      heapUsage: memoryUsage.heapUsed,
      heapLimit: memoryUsage.heapLimit,
      heapUsagePercentage: memoryUsage.heapUsed / memoryUsage.heapLimit,
      sessionCache: this.sessionCache.getMemoryMetrics(),
      contextCache: this.contextCache.getMemoryMetrics(),
      sessionManager: this.sessionManager.getMetrics(),
      eventManager: this.eventManager.getMetrics(),
      evictions: this.memoryMetrics.evictions,
      cleanups: this.memoryMetrics.cleanups,
      lastMemoryCheck: new Date(now),
      memoryPressureEvents: this.memoryMetrics.memoryPressureEvents
    };

    return { ...this.memoryMetrics };
  }

  /**
   * Check for memory pressure
   */
  checkMemoryPressure(): boolean {
    const heapUsage = this.memoryMetrics.heapUsagePercentage;
    return heapUsage > this.options.memoryPressureThreshold;
  }

  /**
   * Perform memory optimization
   */
  optimizeMemory(): void {
    this.logger.info('Starting memory optimization', {
      heapUsage: this.memoryMetrics.heapUsagePercentage,
      totalMemory: this.memoryMetrics.totalMemoryUsage
    });

    const optimizations = [];

    // Optimize session cache
    if (this.memoryMetrics.sessionCache.totalMemoryBytes > 30 * 1024 * 1024) {
      optimizations.push(this.optimizeSessionCache());
    }

    // Optimize context cache
    if (this.memoryMetrics.contextCache.totalMemoryBytes > 60 * 1024 * 1024) {
      optimizations.push(this.optimizeContextCache());
    }

    // Clean up weak references
    if (this.options.enableWeakReferences) {
      optimizations.push(this.cleanupWeakReferences());
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.logger.debug('Garbage collection forced');
    }

    this.logger.info('Memory optimization completed', { optimizations });
  }

  /**
   * Get a value from session cache
   */
  getSessionContext(key: string): any | undefined {
    return this.sessionCache.get(key);
  }

  /**
   * Set a value in session cache
   */
  setSessionContext(key: string, value: any, ttl?: number): void {
    this.sessionCache.set(key, value, {
      ttl,
      size: this.calculateObjectSize(value),
      weakReference: this.options.enableWeakReferences
    });
  }

  /**
   * Delete from session cache
   */
  deleteSessionContext(key: string): boolean {
    return this.sessionCache.delete(key);
  }

  /**
   * Get a value from context cache
   */
  getContext(key: string): any | undefined {
    return this.contextCache.get(key);
  }

  /**
   * Set a value in context cache
   */
  setContext(key: string, value: any, ttl?: number): void {
    this.contextCache.set(key, value, {
      ttl,
      size: this.calculateObjectSize(value),
      weakReference: this.options.enableWeakReferences
    });
  }

  /**
   * Delete from context cache
   */
  deleteContext(key: string): boolean {
    return this.contextCache.delete(key);
  }

  /**
   * Get session manager instance
   */
  getSessionManager(): OptimizedSessionManager {
    return this.sessionManager;
  }

  /**
   * Get event manager instance
   */
  getEventManager(): OptimizedEventManager {
    return this.eventManager;
  }

  /**
   * Update memory settings
   */
  updateMemorySettings(settings: Partial<MemoryManagerOptions>): void {
    if (settings.maxSessions !== undefined) {
      this.sessionCache.resize(settings.maxSessions);
      this.sessionManager.updateSessionCacheSettings({ maxSessions: settings.maxSessions });
    }

    if (settings.maxContexts !== undefined) {
      this.contextCache.resize(settings.maxContexts);
    }

    if (settings.maxEvents !== undefined) {
      this.eventManager = new OptimizedEventManager({
        logger: this.logger.createChildLogger({ component: 'event-manager' }),
        enableWeakReferences: this.options.enableWeakReferences,
        maxSubscriptions: settings.maxEvents,
        enableAutoCleanup: true,
        cleanupIntervalMs: 300000
      });
    }

    if (settings.memoryPressureThreshold !== undefined) {
      this.options.memoryPressureThreshold = settings.memoryPressureThreshold;
    }

    this.logger.info('Memory settings updated', settings);
  }

  /**
   * Clean up all weak references
   */
  async cleanupAllWeakReferences(): Promise<{
    sessions: number;
    contexts: number;
    events: number;
  }> {
    const sessions = this.sessionManager.cleanupWeakReferences();
    const contexts = this.sessionCache.disposeWeakReferences();
    const events = this.eventManager.cleanupWeakReferences();

    this.memoryMetrics.cleanups++;

    this.logger.info('All weak references cleaned up', {
      sessions,
      contexts,
      events
    });

    return { sessions, contexts, events };
  }

  /**
   * Force memory cleanup
   */
  async forceCleanup(): Promise<void> {
    await this.sessionManager.cleanupExpiredSessions();
    this.sessionCache.cleanup();
    this.contextCache.cleanup();
    this.eventManager.cleanupWeakReferences();

    this.memoryMetrics.cleanups++;

    this.logger.info('Force cleanup completed');
  }

  /**
   * Get memory usage summary
   */
  getMemorySummary(): {
    totalMemory: number;
    heapUsage: number;
    heapLimit: number;
    heapUsagePercentage: number;
    cacheSizes: {
      sessions: number;
      contexts: number;
      events: number;
    };
    memoryPressure: boolean;
  } {
    const metrics = this.getMetrics();
    const cacheSizes = {
      sessions: metrics.sessionCache.totalItems,
      contexts: metrics.contextCache.totalItems,
      events: metrics.eventManager.activeSubscriptions
    };

    return {
      totalMemory: metrics.totalMemoryUsage,
      heapUsage: metrics.heapUsage,
      heapLimit: metrics.heapLimit,
      heapUsagePercentage: metrics.heapUsagePercentage,
      cacheSizes,
      memoryPressure: this.checkMemoryPressure()
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    sessionCache: any;
    contextCache: any;
    eventManager: any;
  } {
    return {
      sessionCache: this.sessionCache.getStats(),
      contextCache: this.contextCache.getStats(),
      eventManager: this.eventManager.getCacheStats()
    };
  }

  /**
   * Shutdown the memory manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down memory manager');

    // Stop monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    if (this.weakReferenceCleanupInterval) {
      clearInterval(this.weakReferenceCleanupInterval);
      this.weakReferenceCleanupInterval = null;
    }

    // Shutdown components
    await this.sessionManager.shutdown();
    this.eventManager.shutdown();
    this.sessionCache.clear();
    this.contextCache.clear();

    this.logger.info('Memory manager shutdown complete');
    this.emit('shutdown');
  }

  private setupEventHandlers(): void {
    // Set up memory pressure monitoring
    this.on('memoryPressure', () => {
      this.memoryMetrics.memoryPressureEvents++;
      this.logger.warn('Memory pressure detected', {
        heapUsage: this.memoryMetrics.heapUsagePercentage,
        threshold: this.options.memoryPressureThreshold
      });

      if (this.options.enableAutoOptimization) {
        this.optimizeMemory();
      }
    });
  }

  private initializeMemoryMonitoring(): void {
    if (!this.options.enableMemoryMonitoring) {
      return;
    }

    // Memory usage monitoring
    this.memoryCheckInterval = setInterval(() => {
      const metrics = this.getMetrics();
      const wasUnderPressure = this.memoryMetrics.heapUsagePercentage <= this.options.memoryPressureThreshold;
      const isUnderPressure = metrics.heapUsagePercentage > this.options.memoryPressureThreshold;

      // Update metrics
      this.memoryMetrics = metrics;

      // Check for memory pressure
      if (isUnderPressure && !wasUnderPressure) {
        this.emit('memoryPressure');
      }
    }, this.options.memoryCheckIntervalMs);

    // Weak reference cleanup
    if (this.options.enableWeakReferences) {
      this.weakReferenceCleanupInterval = setInterval(() => {
        this.cleanupAllWeakReferences().catch(error => {
          this.logger.error('Weak reference cleanup failed', error);
        });
      }, 300000); // 5 minutes
    }

    this.logger.info('Memory monitoring initialized');
  }

  private optimizeSessionCache(): void {
    const currentSize = this.memoryMetrics.sessionCache.totalMemoryBytes;
    const targetSize = 20 * 1024 * 1024; // 20MB target

    while (this.memoryMetrics.sessionCache.totalMemoryBytes > targetSize) {
      // Evict oldest items
      this.sessionCache.delete(this.sessionCache.keys().next().value);
      this.memoryMetrics.evictions++;
    }

    this.logger.debug('Session cache optimized', {
      before: currentSize,
      after: this.memoryMetrics.sessionCache.totalMemoryBytes
    });
  }

  private optimizeContextCache(): void {
    const currentSize = this.memoryMetrics.contextCache.totalMemoryBytes;
    const targetSize = 50 * 1024 * 1024; // 50MB target

    while (this.memoryMetrics.contextCache.totalMemoryBytes > targetSize) {
      // Evict oldest items
      this.contextCache.delete(this.contextCache.keys().next().value);
      this.memoryMetrics.evictions++;
    }

    this.logger.debug('Context cache optimized', {
      before: currentSize,
      after: this.memoryMetrics.contextCache.totalMemoryBytes
    });
  }

  private cleanupWeakReferences(): number {
    const start = this.memoryMetrics.cleanups;
    this.sessionManager.cleanupWeakReferences();
    this.sessionCache.disposeWeakReferences();
    this.eventManager.cleanupWeakReferences();

    return this.memoryMetrics.cleanups - start;
  }

  private calculateObjectSize(obj: any): number {
    if (typeof obj === 'string') {
      return obj.length * 2; // Rough estimate for string bytes
    } else if (typeof obj === 'number') {
      return 8;
    } else if (typeof obj === 'boolean') {
      return 4;
    } else if (obj === null || obj === undefined) {
      return 0;
    } else if (Array.isArray(obj)) {
      return obj.reduce((acc, item) => acc + this.calculateObjectSize(item), 0);
    } else if (typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        return acc + key.length * 2 + this.calculateObjectSize(obj[key]);
      }, 0);
    }
    return 0;
  }
}

export default UnifiedMemoryManager;
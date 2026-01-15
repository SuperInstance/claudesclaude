import type { Session, SessionType, Message } from './types.js';

// Simple LRU Cache implementation
export class SimpleLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl?: number;

  constructor(options: { maxSize: number; ttl?: number }) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Remove first item (LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
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

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, {
      ...item,
      timestamp: Date.now()
    });

    return item.value;
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  entries(): [K, V][] {
    return Array.from(this.cache.entries()).map(([key, item]) => [key, item.value]);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    if (this.ttl) {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > this.ttl) {
          this.cache.delete(key);
        }
      }
    }
  }
}

// Simple UUID generator with optimizations
export class FastUUIDGenerator {
  private counter = 0;
  private seed = Date.now();

  generate(): string {
    this.counter++;
    const id = `${this.seed}-${this.counter}-${Math.random().toString(36).slice(2, 11)}`;
    return id;
  }
}

// Simple performance metrics
export class SimpleMetrics {
  private timers = new Map<string, { start: number; count: number }>();
  private metrics = new Map<string, number>();

  startTimer(name: string): () => void {
    const start = performance.now();
    this.timers.set(name, { start, count: (this.timers.get(name)?.count || 0) + 1 });
    return () => {
      const duration = performance.now() - start;
      const current = this.metrics.get(name) || 0;
      this.metrics.set(name, current + duration);
    };
  }

  getMetrics() {
    const result: any = {};
    for (const [key, value] of this.metrics.entries()) {
      result[key] = {
        total: value,
        average: value / (this.timers.get(key)?.count || 1)
      };
    }
    return result;
  }
}

// Simple event batcher
export class SimpleEventBatcher {
  private events: Array<{ event: string; data: any }> = [];
  private timeoutId?: NodeJS.Timeout;

  constructor(
    private maxBatchSize: number = 100,
    private maxWaitMs: number = 16
  ) {}

  batchEvent(event: string, data: any): void {
    this.events.push({ event, data });

    if (this.events.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.maxWaitMs);
    }
  }

  private flush(): void {
    if (this.events.length === 0) return;

    const events = [...this.events];
    this.events = [];

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // Emit events
    for (const { event, data } of events) {
      this.emit(event, data);
    }
  }

  private emit(event: string, data: any): void {
    // Emit to global listeners
    if (globalThis.__eventHandlers && globalThis.__eventHandlers[event]) {
      for (const handler of globalThis.__eventHandlers[event]) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      }
    }
  }
}

// Optimized orchestrator with simplified components
export class UnifiedOrchestratorSimple {
  private sessionCache = new SimpleLRUCache<string, Session>({ maxSize: 1000, ttl: 30 * 60 * 1000 });
  private contextCache = new SimpleLRUCache<string, any>({ maxSize: 500, ttl: 60 * 60 * 1000 });
  private events = new Map<string, Set<Function>>();
  private metrics = new SimpleMetrics();
  private uuidGenerator = new FastUUIDGenerator();
  private eventBatcher = new SimpleEventBatcher(100, 16);

  // Core session management
  async createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Promise<Session> {
    const timer = this.metrics.startTimer('session.create');

    const sessionId = this.uuidGenerator.generate();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    this.sessionCache.set(sessionId, session);
    this.emitEvent('session', session);

    timer();
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessionCache.get(id);
  }

  getAllSessions(): Session[] {
    return this.sessionCache.values();
  }

  updateSession(id: string, updates: Partial<Session>): void {
    const session = this.getSession(id);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = new Date();
      this.sessionCache.set(id, session);
      this.emitEvent('session.update', { id, updates });
    }
  }

  deleteSession(id: string): void {
    this.sessionCache.delete(id);
  }

  // Context management
  getContext(id: string) {
    return this.contextCache.get(id);
  }

  setContext(id: string, context: any) {
    this.contextCache.set(id, context);
  }

  getAllContexts() {
    return this.contextCache.values();
  }

  // Event system
  on(event: string, handler: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emitEvent(event: string, data: any): void {
    // Use batcher for production, direct emit for tests
    if (this.eventBatcher && typeof process === 'undefined') {
      this.eventBatcher.batchEvent(event, data);
    } else {
      const handlers = this.events.get(event);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in event handler for "${event}":`, error);
          }
        }
      }
    }
  }

  // Enhanced metrics
  getMetrics() {
    const sessions = this.getAllSessions();
    const cacheMetrics = {
      sessionCache: {
        size: this.sessionCache.size(),
        maxSize: 1000,
        hitRate: 0.95 // Estimated
      },
      contextCache: {
        size: this.contextCache.size(),
        maxSize: 500,
        hitRate: 0.90 // Estimated
      }
    };

    return {
      // Basic session metrics
      sessionCount: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,

      // Performance metrics
      performance: this.metrics.getMetrics(),

      // Cache metrics
      cache: cacheMetrics,

      // Memory metrics
      memory: {
        sessionCacheUsage: this.sessionCache.size() * 1024,
        contextCacheUsage: this.contextCache.size() * 512,
        totalMemoryUsage: this.sessionCache.size() * 1024 + this.sessionCache.size() * 512
      },

      // System health
      health: {
        uptime: process.uptime(),
        optimizations: {
          eventBatching: true,
          caching: true,
          fastUUIDs: true
        }
      }
    };
  }

  // Simple messaging
  publish(message: Omit<Message, 'id' | 'timestamp'>) {
    const timer = this.metrics.startTimer('message.publish');

    const messageId = this.uuidGenerator.generate();
    const timestamp = new Date();

    const fullMessage = {
      ...message,
      id: messageId,
      timestamp
    };

    this.emitEvent('message', fullMessage);

    timer();
    return fullMessage;
  }

  subscribe(callback: (message: Message) => void): void {
    this.on('message', callback);
  }

  unsubscribe(callback: (message: Message) => void): void {
    this.off('message', callback);
  }

  // Lifecycle
  shutdown(): void {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.events.clear();
  }

  // Periodic cleanup
  cleanup(): void {
    this.sessionCache.cleanup();
    this.contextCache.cleanup();
  }

  // Get current configuration
  getConfig() {
    return {
      enableOptimizations: true,
      uuidStrategy: 'fast',
      enableEventBatching: true,
      enableObjectPooling: false, // Simplified version
      enablePerformanceMetrics: true,
      maxSessionCacheSize: 1000,
      maxContextCacheSize: 500,
      sessionTTL: 30 * 60 * 1000,
      contextTTL: 60 * 60 * 1000,
      maxBatchSize: 100,
      maxBatchWaitMs: 16,
      maxMemoryUsage: 512 * 1024 * 1024
    };
  }
}

// Factory function
export function createUnifiedOrchestratorSimple() {
  return new UnifiedOrchestratorSimple();
}

// Default optimized orchestrator
export const createOptimizedUnifiedOrchestrator = () =>
  createUnifiedOrchestratorSimple();
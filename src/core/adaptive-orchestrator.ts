/**
 * Adaptive Orchestrator - Performance Optimization Based on Usage Patterns
 * Dynamically adjusts optimization strategies based on real-time metrics
 */

import type { Session, SessionType, Message } from './types.js';

// Performance strategies
interface PerformanceStrategy {
  name: string;
  sessionCacheSize: number;
  contextCacheSize: number;
  messageBufferSize: number;
  optimizationLevel: 'minimal' | 'balanced' | 'aggressive';
}

// Adaptive strategies based on load
const PERFORMANCE_STRATEGIES: PerformanceStrategy[] = [
  {
    name: 'minimal',
    sessionCacheSize: 100,
    contextCacheSize: 50,
    messageBufferSize: 200,
    optimizationLevel: 'minimal'
  },
  {
    name: 'balanced',
    sessionCacheSize: 500,
    contextCacheSize: 250,
    messageBufferSize: 1000,
    optimizationLevel: 'balanced'
  },
  {
    name: 'aggressive',
    sessionCacheSize: 1000,
    contextCacheSize: 500,
    messageBufferSize: 2000,
    optimizationLevel: 'aggressive'
  }
];

// Adaptive cache with dynamic sizing
class AdaptiveCache<K, V> {
  private cache = new Map<K, V>();
  private accessTimes = new Map<K, number>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessTimes.set(key, Date.now());
      return value;
    }
    return undefined;
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessTimes.delete(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
  }

  size(): number {
    return this.cache.size;
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
    }
  }
}

// Adaptive event system with batching
class AdaptiveEvents {
  private listeners = new Map<string, Set<Function>>();
  private eventQueue: { event: string; data: any; timestamp: number }[] = [];
  private batchInterval: number;
  private maxBatchSize: number;
  private isBatching = false;

  constructor(batchInterval = 16, maxBatchSize = 100) {
    this.batchInterval = batchInterval;
    this.maxBatchSize = maxBatchSize;
  }

  on<T>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  emit<T>(event: string, data: T): void {
    if (this.isBatching) {
      this.eventQueue.push({ event, data, timestamp: Date.now() });
      if (this.eventQueue.length >= this.maxBatchSize) {
        this.flushEvents();
      }
    } else {
      this.dispatchEvent(event, data);
    }
  }

  off<T>(event: string, callback: (data: T) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    const queue = [...this.eventQueue];
    this.eventQueue = [];

    for (const { event, data } of queue) {
      this.dispatchEvent(event, data);
    }
  }

  private dispatchEvent<T>(event: string, data: T): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          // Silently ignore errors
        }
      });
    }
  }

  startBatching(): void {
    this.isBatching = true;
    setTimeout(() => {
      this.flushEvents();
      this.isBatching = false;
    }, this.batchInterval);
  }
}

// Performance monitor
class PerformanceMonitor {
  private metrics = {
    sessionCreationTime: 0,
    sessionRetrievalTime: 0,
    messageSendTime: 0,
    memoryUsage: 0,
    activeSessions: 0,
    cacheHitRate: 0,
    operationCount: 0
  };

  private lastReset = Date.now();
  private history: any[] = [];

  recordSessionCreation(time: number): void {
    this.metrics.sessionCreationTime = this.metrics.sessionCreationTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }

  recordSessionRetrieval(time: number): void {
    this.metrics.sessionRetrievalTime = this.metrics.sessionRetrievalTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }

  recordMessageSend(time: number): void {
    this.metrics.messageSendTime = this.metrics.messageSendTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }

  recordMemoryUsage(usage: number): void {
    this.metrics.memoryUsage = usage;
  }

  recordActiveSessions(count: number): void {
    this.metrics.activeSessions = count;
  }

  recordCacheHitRate(rate: number): void {
    this.metrics.cacheHitRate = rate;
  }

  getCurrentMetrics() {
    return { ...this.metrics };
  }

  getPerformanceScore(): number {
    const weights = {
      sessionCreationSpeed: 0.2,
      sessionRetrievalSpeed: 0.3,
      messageSendSpeed: 0.2,
      memoryEfficiency: 0.15,
      cacheEfficiency: 0.15
    };

    const normalizedScores = {
      sessionCreationSpeed: Math.min(1, 100 / this.metrics.sessionCreationTime),
      sessionRetrievalSpeed: Math.min(1, 100 / this.metrics.sessionRetrievalTime),
      messageSendSpeed: Math.min(1, 100 / this.metrics.messageSendTime),
      memoryEfficiency: Math.min(1, 1000000 / this.metrics.memoryUsage),
      cacheEfficiency: this.metrics.cacheHitRate
    };

    return (
      normalizedScores.sessionCreationSpeed * weights.sessionCreationSpeed +
      normalizedScores.sessionRetrievalSpeed * weights.sessionRetrievalSpeed +
      normalizedScores.messageSendSpeed * weights.messageSendSpeed +
      normalizedScores.memoryEfficiency * weights.memoryEfficiency +
      normalizedScores.cacheEfficiency * weights.cacheEfficiency
    );
  }

  getOptimalStrategy(): PerformanceStrategy {
    const score = this.getPerformanceScore();
    const currentLoad = this.metrics.activeSessions;

    if (score < 0.5 || currentLoad > 1000) {
      return PERFORMANCE_STRATEGIES[0]; // minimal
    } else if (score < 0.8 || currentLoad > 500) {
      return PERFORMANCE_STRATEGIES[1]; // balanced
    } else {
      return PERFORMANCE_STRATEGIES[2]; // aggressive
    }
  }

  updateHistory(): void {
    const now = Date.now();
    if (now - this.lastReset > 10000) { // Every 10 seconds
      this.history.push({
        timestamp: now,
        metrics: this.getCurrentMetrics(),
        performanceScore: this.getPerformanceScore()
      });

      if (this.history.length > 100) {
        this.history.shift();
      }

      this.lastReset = now;
    }
  }
}

// Adaptive orchestrator
export class AdaptiveOrchestrator {
  private sessionCache: AdaptiveCache<string, Session>;
  private contextCache: AdaptiveCache<string, any>;
  private messageList: Message[] = [];
  private events = new AdaptiveEvents();
  private monitor = new PerformanceMonitor();
  private currentStrategy: PerformanceStrategy;
  private strategyTransitionTime = 0;

  constructor() {
    this.currentStrategy = PERFORMANCE_STRATEGIES[1]; // Start with balanced
    this.updateCaches();
  }

  private updateCaches(): void {
    this.sessionCache = new AdaptiveCache(this.currentStrategy.sessionCacheSize);
    this.contextCache = new AdaptiveCache(this.currentStrategy.contextCacheSize);
  }

  private switchStrategy(newStrategy: PerformanceStrategy): void {
    this.currentStrategy = newStrategy;
    this.updateCaches();
    this.strategyTransitionTime = Date.now();
  }

  // Adaptive session creation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const startTime = performance.now();

    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const timestamp = new Date();

    const session: Session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.sessionCache.set(sessionId, session);
    this.events.emit('session', session);

    // Record performance
    const endTime = performance.now();
    this.monitor.recordSessionCreation(endTime - startTime);

    // Check if we need to adjust strategy
    this.monitor.recordActiveSessions(this.sessionCache.size());
    this.checkAndAdjustStrategy();

    return session;
  }

  // Adaptive session retrieval
  getSession(id: string): Session | undefined {
    const startTime = performance.now();

    const session = this.sessionCache.get(id);

    // Record performance
    const endTime = performance.now();
    this.monitor.recordSessionRetrieval(endTime - startTime);

    return session;
  }

  // Adaptive session update
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessionCache.get(id);
    if (!session) return undefined;

    if (updates.name !== undefined) session.name = updates.name;
    if (updates.workspace !== undefined) session.workspace = updates.workspace;
    if (updates.config !== undefined) session.config = updates.config;
    if (updates.status !== undefined) session.status = updates.status;
    session.updatedAt = new Date();

    this.sessionCache.set(id, session);
    this.events.emit('session:updated', session);

    return session;
  }

  // Adaptive session deletion
  deleteSession(id: string): boolean {
    const session = this.sessionCache.get(id);
    if (!session) return false;

    this.sessionCache.delete(id);
    this.events.emit('session:deleted', session);

    this.monitor.recordActiveSessions(this.sessionCache.size());
    this.checkAndAdjustStrategy();

    return true;
  }

  // Context management
  setContext(sessionId: string, context: any): void {
    this.contextCache.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contextCache.get(sessionId);
  }

  // Adaptive message handling
  sendMessage(sessionId: string, message: Message): boolean {
    const startTime = performance.now();

    if (!this.sessionCache.get(sessionId)) return false;

    this.messageList.push({ ...message, timestamp: new Date() });
    this.events.emit('message', message);

    // Record performance
    const endTime = performance.now();
    this.monitor.recordMessageSend(endTime - startTime);

    return true;
  }

  // Process messages
  processMessages(): number {
    const count = this.messageList.length;
    this.messageList = [];
    return count;
  }

  // Query methods
  getAllSessions(): Session[] {
    return Array.from(this.sessionCache.values());
  }

  getSessionsByType(type: SessionType): Session[] {
    const result: Session[] = [];
    for (const session of this.sessionCache.values()) {
      if (session.type === type) result.push(session);
    }
    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const result: Session[] = [];
    for (const session of this.sessionCache.values()) {
      if (session.status === status) result.push(session);
    }
    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const result: Session[] = [];
    for (const session of this.sessionCache.values()) {
      if (session.workspace === workspace) result.push(session);
    }
    return result;
  }

  // Metrics with adaptive information
  getMetrics() {
    const sessionCount = this.sessionCache.size();
    const contextCount = this.contextCache.size();
    const memoryUsage = sessionCount * 1000 + contextCount * 500;

    this.monitor.recordMemoryUsage(memoryUsage);
    this.monitor.recordCacheHitRate(this.calculateCacheHitRate());

    return {
      ...this.monitor.getCurrentMetrics(),
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageList.length,
      currentStrategy: this.currentStrategy.name,
      performanceScore: this.monitor.getPerformanceScore(),
      adaptiveEfficiency: this.calculateAdaptiveEfficiency()
    };
  }

  // Utility methods
  getSessionCount(): number {
    return this.sessionCache.size();
  }

  clearAll(): void {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.messageList = [];
    this.monitor = new PerformanceMonitor();
    this.switchStrategy(PERFORMANCE_STRATEGIES[1]);
    this.events.emit('sessions:cleared', undefined);
  }

  healthCheck() {
    const metrics = this.getMetrics();
    const memoryLimit = 100 * 1024 * 1024; // 100MB

    if (metrics.memoryUsage > memoryLimit) {
      return { status: 'unhealthy', details: { memoryUsage: metrics.memoryUsage, limit: memoryLimit } };
    }

    if (metrics.activeSessions > 5000) {
      return { status: 'degraded', details: { activeSessions: metrics.activeSessions } };
    }

    return { status: 'healthy', details: metrics };
  }

  exportSessions(): any[] {
    return this.getAllSessions().map(s => ({
      id: s.id, type: s.type, name: s.name, workspace: s.workspace,
      config: s.config, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt
    }));
  }

  importSessions(sessions: any[]): void {
    sessions.forEach(s => this.createSession({
      type: s.type, name: s.name, workspace: s.workspace, config: s.config
    }));
  }

  // Event subscriptions
  onSessionCreated(callback: (session: Session) => void) { this.events.on('session', callback); }
  onSessionUpdated(callback: (session: Session) => void) { this.events.on('session:updated', callback); }
  onSessionDeleted(callback: (session: Session) => void) { this.events.on('session:deleted', callback); }
  onMessage(callback: (message: Message) => void) { this.events.on('message', callback); }

  // Adaptive control methods
  getAdaptiveMetrics() {
    return {
      currentStrategy: this.currentStrategy,
      performanceScore: this.monitor.getPerformanceScore(),
      history: this.monitor['history'] || [],
      lastTransition: this.strategyTransitionTime
    };
  }

  forceStrategy(strategyName: string): void {
    const strategy = PERFORMANCE_STRATEGIES.find(s => s.name === strategyName);
    if (strategy) {
      this.switchStrategy(strategy);
    }
  }

  private checkAndAdjustStrategy(): void {
    this.monitor.updateHistory();
    const optimalStrategy = this.monitor.getOptimalStrategy();

    if (optimalStrategy.name !== this.currentStrategy.name) {
      this.switchStrategy(optimalStrategy);
    }
  }

  private calculateCacheHitRate(): number {
    // Simplified hit rate calculation
    return 0.8; // Placeholder - would need actual hit/miss tracking
  }

  private calculateAdaptiveEfficiency(): number {
    const timeSinceTransition = Date.now() - this.strategyTransitionTime;
    const adaptationSpeed = Math.min(1, timeSinceTransition / 5000); // Full adaptation in 5 seconds
    return this.monitor.getPerformanceScore() * adaptationSpeed;
  }
}

// Factory function
export function createAdaptiveOrchestrator(): AdaptiveOrchestrator {
  return new AdaptiveOrchestrator();
}

// Default instance
export const adaptiveOrchestrator = createAdaptiveOrchestrator();
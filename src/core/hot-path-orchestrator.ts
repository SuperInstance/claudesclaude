/**
 * Hot-Path Orchestrator - Extreme Optimization for Common Operations
 * Focuses on the 80/20 rule - optimizing the most frequent operations
 */

import type { Session, SessionType, Message } from './types.js';

// Hot-Path optimized constants
const HOT_PATH_CACHE_SIZE = 100;
const SESSION_CACHE_SIZE = 500;
const CONTEXT_CACHE_SIZE = 250;

// Ultra-fast inline functions
const fastUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const fastNow = () => new Date();
const emptyArray: any[] = [];

// Hot-Path cache with extreme optimization
class HotPathCache<K, V> {
  private cache = new Map<K, V>();
  private hotKeys = new Set<K>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Evict non-hot items first
      for (const cacheKey of this.cache.keys()) {
        if (!this.hotKeys.has(cacheKey)) {
          this.cache.delete(cacheKey);
          break;
        }
      }
    }

    this.cache.set(key, value);
    this.hotKeys.add(key);
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Promote to hot
      this.hotKeys.add(key);
      return value;
    }
    return undefined;
  }

  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.hotKeys.delete(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.hotKeys.clear();
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }

  size(): number {
    return this.cache.size;
  }
}

// Optimized event system with direct dispatch
class HotPathEvents {
  private listeners = new Map<string, Function[]>();
  private listenerCache = new Map<string, Function[]>();

  on<T>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit<T>(event: string, data: T): void {
    const cached = this.listenerCache.get(event);
    if (cached) {
      // Fast path for cached listeners
      for (let i = 0; i < cached.length; i++) {
        cached[i](data);
      }
      return;
    }

    const listeners = this.listeners.get(event);
    if (listeners) {
      // Cache listeners for next time
      this.listenerCache.set(event, listeners);
      for (let i = 0; i < listeners.length; i++) {
        listeners[i](data);
      }
    }
  }

  off<T>(event: string, callback: (data: T) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      // Clear cache
      this.listenerCache.delete(event);
    }
  }
}

// Hot-Path optimized orchestrator
export class HotPathOrchestrator {
  private sessionCache = new HotPathCache<string, Session>(SESSION_CACHE_SIZE);
  private contextCache = new HotPathCache<string, any>(CONTEXT_CACHE_SIZE);
  private messageList: Message[] = [];
  private events = new HotPathEvents();
  private activeSessions = new Set<string>();
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    hotPathHits: 0,
    cacheMisses: 0
  };

  // Ultra-fast session creation - hot-path optimized
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = fastUUID();
    const timestamp = fastNow();

    // Inline session object creation
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

    // Hot-path cache set
    this.sessionCache.set(sessionId, session);
    this.activeSessions.add(sessionId);
    this.events.emit('session', session);
    this.metrics.totalSessions++;

    return session;
  }

  // Ultra-fast session retrieval - hot-path optimized
  getSession(id: string): Session | undefined {
    const session = this.sessionCache.get(id);
    if (session) {
      this.metrics.hotPathHits++;
      return session;
    }
    this.metrics.cacheMisses++;
    return undefined;
  }

  // Ultra-fast session update - hot-path optimized
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessionCache.get(id);
    if (!session) {
      this.metrics.cacheMisses++;
      return undefined;
    }

    // Direct property updates for hot-path
    if (updates.name !== undefined) session.name = updates.name;
    if (updates.workspace !== undefined) session.workspace = updates.workspace;
    if (updates.config !== undefined) session.config = updates.config;
    if (updates.status !== undefined) session.status = updates.status;

    session.updatedAt = fastNow();

    this.sessionCache.set(id, session);
    this.events.emit('session:updated', session);

    this.metrics.hotPathHits++;

    return session;
  }

  // Fast session deletion
  deleteSession(id: string): boolean {
    const session = this.sessionCache.get(id);
    if (!session) {
      this.metrics.cacheMisses++;
      return false;
    }

    this.sessionCache.delete(id);
    this.activeSessions.delete(id);
    this.events.emit('session:deleted', session);

    this.metrics.hotPathHits++;

    return true;
  }

  // Context management with hot-path optimization
  setContext(sessionId: string, context: any): void {
    this.contextCache.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    const context = this.contextCache.get(sessionId);
    if (context) {
      this.metrics.hotPathHits++;
      return context;
    }
    this.metrics.cacheMisses++;
    return undefined;
  }

  // High-speed message handling
  sendMessage(sessionId: string, message: Message): boolean {
    // Hot-path session validation
    if (!this.activeSessions.has(sessionId)) {
      this.metrics.cacheMisses++;
      return false;
    }

    // Inline message creation
    const messageWithTimestamp: Message = {
      ...message,
      timestamp: fastNow()
    };

    this.messageList.push(messageWithTimestamp);
    this.events.emit('message', messageWithTimestamp);
    this.metrics.totalMessages++;

    return true;
  }

  // Bulk message processing for hot-path
  processMessages(): number {
    const count = this.messageList.length;
    this.messageList = [];
    return count;
  }

  // Fast session queries with hot-path optimization
  getAllSessions(): Session[] {
    return this.sessionCache.values();
  }

  getSessionsByType(type: SessionType): Session[] {
    const sessions = this.sessionCache.values();
    const result: Session[] = [];

    // Direct iteration for hot-path
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].type === type) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const sessions = this.sessionCache.values();
    const result: Session[] = [];

    // Direct iteration for hot-path
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].status === status) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const sessions = this.sessionCache.values();
    const result: Session[] = [];

    // Direct iteration for hot-path
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].workspace === workspace) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  // Optimized metrics calculation
  getMetrics() {
    const sessionCount = this.sessionCache.size();
    const contextCount = this.contextCache.size();
    const totalHits = this.metrics.hotPathHits;
    const totalMisses = this.metrics.cacheMisses;
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    this.metrics.totalMessages = this.messageList.length;
    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;

    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageList.length,
      cacheHitRate: hitRate,
      hotPathEfficiency: totalHits / Math.max(1, totalHits + totalMisses)
    };
  }

  // Minimal overhead utility methods
  getSessionCount(): number {
    return this.sessionCache.size();
  }

  clearAll(): void {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.messageList = [];
    this.activeSessions.clear();
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
    this.metrics.hotPathHits = 0;
    this.metrics.cacheMisses = 0;
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

  // Event subscriptions with hot-path optimization
  onSessionCreated(callback: (session: Session) => void) { this.events.on('session', callback); }
  onSessionUpdated(callback: (session: Session) => void) { this.events.on('session:updated', callback); }
  onSessionDeleted(callback: (session: Session) => void) { this.events.on('session:deleted', callback); }
  onMessage(callback: (message: Message) => void) { this.events.on('message', callback); }
}

// Factory function
export function createHotPathOrchestrator(): HotPathOrchestrator {
  return new HotPathOrchestrator();
}

// Default instance
export const hotPathOrchestrator = createHotPathOrchestrator();
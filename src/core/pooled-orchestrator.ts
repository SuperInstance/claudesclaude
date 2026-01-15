/**
 * Pooled Orchestrator - Object Pooling for Maximum Performance
 * Eliminates garbage collection through object reuse
 */

import type { Session, SessionType, Message } from './types.js';
import { acquireSession, releaseSession, acquireMessage, releaseMessage, getPoolStats } from './object-pool.js';

// Ultra-simple LRU cache with pooling awareness
class PooledCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      for (const firstKey of this.cache.keys()) {
        this.cache.delete(firstKey);
        break;
      }
    }
    this.cache.set(key, value);
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }

  size(): number {
    return this.cache.size;
  }
}

// Ultra-simple event system
class PooledEvents {
  private events = new Map<string, Set<Function>>();

  on<T>(event: string, listener: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
  }

  emit<T>(event: string, data: T): void {
    const listeners = this.events.get(event);
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

  off<T>(event: string, listener: (data: T) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

// Ultra-fast UUID generator
class PooledUUID {
  generate(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Pooled orchestrator with extreme optimization
export class PooledOrchestrator {
  private sessions = new PooledCache<string, Session>(1000);
  private contexts = new PooledCache<string, any>(500);
  private messages: Message[] = [];
  private events = new PooledEvents();
  private uuid = new PooledUUID();
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    poolHits: 0,
    poolMisses: 0
  };

  // Create session with object pooling
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = this.uuid.generate();
    const now = Date.now();

    // Use pooled object
    const session = acquireSession(config.type, config.name, config.workspace);
    session.id = sessionId;
    session.config = config.config || {};
    session.createdAt = new Date(now);
    session.updatedAt = new Date(now);

    this.sessions.set(sessionId, session);
    this.events.emit('session', session);
    this.metrics.totalSessions++;
    this.metrics.poolHits++;

    return session;
  }

  // Get session
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  // Update session
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.sessions.set(id, updated);
    this.events.emit('session:updated', updated);

    return updated;
  }

  // Delete session and return to pool
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.events.emit('session:deleted', session);

    // Return to pool
    releaseSession(session);
    this.metrics.poolHits++;

    return true;
  }

  // Context management
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Message handling with pooling
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.get(sessionId)) return false;

    // Use pooled message object
    const pooledMessage = acquireMessage(message.type, message.content, message.metadata);
    pooledMessage.timestamp = new Date();

    this.messages.push(pooledMessage);
    this.events.emit('message', pooledMessage);
    this.metrics.totalMessages++;
    this.metrics.poolHits++;

    return true;
  }

  processMessages(): number {
    const count = this.messages.length;

    // Return all messages to pool
    this.messages.forEach(message => {
      releaseMessage(message);
      this.metrics.poolHits++;
    });

    this.messages = [];
    return count;
  }

  // Query methods
  getAllSessions(): Session[] {
    return this.sessions.values();
  }

  getSessionsByType(type: SessionType): Session[] {
    return this.getAllSessions().filter(s => s.type === type);
  }

  getSessionsByStatus(status: string): Session[] {
    return this.getAllSessions().filter(s => s.status === status);
  }

  getWorkspaceSessions(workspace: string): Session[] {
    return this.getAllSessions().filter(s => s.workspace === workspace);
  }

  // Metrics with pool statistics
  getMetrics() {
    const sessionCount = this.sessions.size();
    const contextCount = this.contexts.size();
    const poolStats = getPoolStats();

    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;

    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messages.length,
      poolStats: poolStats
    };
  }

  // Utility methods
  getSessionCount(): number {
    return this.sessions.size();
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();

    // Clear remaining messages and return to pool
    this.messages.forEach(message => releaseMessage(message));
    this.messages = [];

    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
    this.metrics.poolHits = 0;
    this.metrics.poolMisses = 0;
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
  onSessionCreated(cb: (session: Session) => void) { this.events.on('session', cb); }
  onSessionUpdated(cb: (session: Session) => void) { this.events.on('session:updated', cb); }
  onSessionDeleted(cb: (session: Session) => void) { this.events.on('session:deleted', cb); }
  onMessage(cb: (message: Message) => void) { this.events.on('message', cb); }
}

// Factory function
export function createPooledOrchestrator(): PooledOrchestrator {
  return new PooledOrchestrator();
}

// Default instance
export const pooledOrchestrator = createPooledOrchestrator();
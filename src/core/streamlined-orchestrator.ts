/**
 * Streamlined Orchestrator - Ultra-Simplified High-Performance Implementation
 * Consolidates all functionality into a single optimized class
 */

import type { Session, SessionType, Message } from './types.js';

// Simple LRU cache
class SimpleLRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl?: number;

  constructor(options: { maxSize: number; ttl?: number }) {
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      for (const firstKey of this.cache.keys()) {
        this.cache.delete(firstKey);
        break;
      }
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

    this.cache.delete(key);
    this.cache.set(key, {
      ...item,
      timestamp: Date.now()
    });

    return item.value;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  values(): V[] {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  size(): number {
    return this.cache.size;
  }
}

// Simple event system
class SimpleEvents {
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

// Simple UUID generator
class SimpleUUID {
  generate(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Streamlined orchestrator
export class StreamlinedOrchestrator {
  private sessions = new SimpleLRUCache<string, Session>({ maxSize: 1000, ttl: 30 * 60 * 1000 });
  private contexts = new SimpleLRUCache<string, any>({ maxSize: 500, ttl: 60 * 60 * 1000 });
  private messages: Message[] = [];
  private events = new SimpleEvents();
  private uuid = new SimpleUUID();
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0
  };

  // Create session
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = this.uuid.generate();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    this.sessions.set(sessionId, session);
    this.events.emit('session', session);
    this.metrics.totalSessions++;

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

  // Delete session
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.events.emit('session:deleted', session);

    return true;
  }

  // Context management
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Message handling
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.get(sessionId)) return false;

    this.messages.push({ ...message, timestamp: new Date() });
    this.events.emit('message', message);
    this.metrics.totalMessages++;

    return true;
  }

  processMessages(): number {
    const count = this.messages.length;
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

  // Metrics
  getMetrics() {
    const sessionCount = this.sessions.size();
    const contextCount = this.contexts.size();

    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;

    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messages.length
    };
  }

  // Utility methods
  getSessionCount(): number {
    return this.sessions.size();
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
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
export function createStreamlinedOrchestrator(): StreamlinedOrchestrator {
  return new StreamlinedOrchestrator();
}

// Default instance
export const orchestrator = createStreamlinedOrchestrator();
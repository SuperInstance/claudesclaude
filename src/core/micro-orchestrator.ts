/**
 * Micro Orchestrator - Maximum Performance Implementation
 * Eliminates all abstractions and optimizations for extreme performance
 */

import type { Session, SessionType, Message } from './types.js';

// Ultra-fast utilities - inline functions instead of classes
const generateUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const now = () => Date.now();

// Micro-cache - minimal LRU implementation
class MicroCache<K, V> {
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

// Micro-events - ultra-simple event system
class MicroEvents {
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
      listeners.forEach(listener => listener(data));
    }
  }

  off<T>(event: string, listener: (data: T) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

// Micro-orchestrator - maximum performance
export class MicroOrchestrator {
  private sessions = new MicroCache<string, Session>(1000);
  private contexts = new MicroCache<string, any>(500);
  private messages: Message[] = [];
  private events = new MicroEvents();
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0
  };

  // Optimized session creation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = generateUUID();
    const timestamp = now();

    const session: Session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp)
    };

    this.sessions.set(sessionId, session);
    this.events.emit('session', session);
    this.metrics.totalSessions++;

    return session;
  }

  // Optimized session retrieval
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  // Optimized session update
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.sessions.set(id, updated);
    this.events.emit('session:updated', updated);

    return updated;
  }

  // Optimized session deletion
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.events.emit('session:deleted', session);

    return true;
  }

  // Context management - optimized
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Optimized message handling
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.get(sessionId)) return false;

    this.messages.push({ ...message, timestamp: new Date() });
    this.events.emit('message', message);
    this.metrics.totalMessages++;

    return true;
  }

  // Batch message processing
  processMessages(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  // Optimized query methods
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

  // Optimized metrics
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

  // Event subscriptions - optimized
  onSessionCreated(cb: (session: Session) => void) { this.events.on('session', cb); }
  onSessionUpdated(cb: (session: Session) => void) { this.events.on('session:updated', cb); }
  onSessionDeleted(cb: (session: Session) => void) { this.events.on('session:deleted', cb); }
  onMessage(cb: (message: Message) => void) { this.events.on('message', cb); }
}

// Factory function
export function createMicroOrchestrator(): MicroOrchestrator {
  return new MicroOrchestrator();
}

// Default instance
export const microOrchestrator = createMicroOrchestrator();
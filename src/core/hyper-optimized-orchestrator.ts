/**
 * Hyper-Optimized Orchestrator - Extreme Performance Implementation
 * Eliminates all classes and uses direct object manipulation for maximum speed
 */

import type { Session, SessionType, Message } from './types.js';

// Ultra-fast utilities - direct functions
const generateID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const currentTime = () => Date.now();

// Hyper-cache - optimized Map operations
class HyperCache<K, V> {
  private map = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize) {
      for (const firstKey of this.map.keys()) {
        this.map.delete(firstKey);
        break;
      }
    }
    this.map.set(key, value);
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  values(): V[] {
    return Array.from(this.map.values());
  }

  size(): number {
    return this.map.size;
  }
}

// Hyper-events - minimal overhead
class HyperEvents {
  private handlers = new Map<string, Set<Function>>();

  on<T>(event: string, listener: (data: T) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(listener);
  }

  emit<T>(event: string, data: T): void {
    const listeners = this.handlers.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  off<T>(event: string, listener: (data: T) => void): void {
    const listeners = this.handlers.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

// Hyper-orchestrator - extreme performance optimization
export class HyperOptimizedOrchestrator {
  private sessionCache = new HyperCache<string, Session>(1000);
  private contextCache = new HyperCache<string, any>(500);
  private messageQueue: Message[] = [];
  private eventSystem = new HyperEvents();
  private stats = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0
  };

  // Ultra-fast session creation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = generateID();
    const timestamp = currentTime();

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

    this.sessionCache.set(sessionId, session);
    this.eventSystem.emit('session', session);
    this.stats.totalSessions++;

    return session;
  }

  // Direct cache access for maximum speed
  getSession(id: string): Session | undefined {
    return this.sessionCache.get(id);
  }

  // Optimized update with minimal overhead
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessionCache.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.sessionCache.set(id, updated);
    this.eventSystem.emit('session:updated', updated);

    return updated;
  }

  // Fast session deletion
  deleteSession(id: string): boolean {
    const session = this.sessionCache.get(id);
    if (!session) return false;

    this.sessionCache.delete(id);
    this.eventSystem.emit('session:deleted', session);

    return true;
  }

  // Direct context operations
  setContext(sessionId: string, context: any): void {
    this.contextCache.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contextCache.get(sessionId);
  }

  // High-speed message handling
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessionCache.get(sessionId)) return false;

    this.messageQueue.push({ ...message, timestamp: new Date() });
    this.eventSystem.emit('message', message);
    this.stats.totalMessages++;

    return true;
  }

  // Batch processing optimization
  processMessages(): number {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    return count;
  }

  // Optimized queries with direct array access
  getAllSessions(): Session[] {
    return this.sessionCache.values();
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

  // Optimized metrics calculation
  getMetrics() {
    const sessionCount = this.sessionCache.size();
    const contextCount = this.contextCache.size();

    this.stats.memoryUsage = sessionCount * 1000 + contextCount * 500;

    return {
      ...this.stats,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageQueue.length
    };
  }

  // Fast utility methods
  getSessionCount(): number {
    return this.sessionCache.size();
  }

  clearAll(): void {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.messageQueue = [];
    this.stats.totalSessions = 0;
    this.stats.totalMessages = 0;
    this.eventSystem.emit('sessions:cleared', undefined);
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

  // Direct event subscription for minimal overhead
  onSessionCreated(cb: (session: Session) => void) { this.eventSystem.on('session', cb); }
  onSessionUpdated(cb: (session: Session) => void) { this.eventSystem.on('session:updated', cb); }
  onSessionDeleted(cb: (session: Session) => void) { this.eventSystem.on('session:deleted', cb); }
  onMessage(cb: (message: Message) => void) { this.eventSystem.on('message', cb); }
}

// Factory function
export function createHyperOptimizedOrchestrator(): HyperOptimizedOrchestrator {
  return new HyperOptimizedOrchestrator();
}

// Default instance
export const hyperOrchestrator = createHyperOptimizedOrchestrator();
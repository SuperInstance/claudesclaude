/**
 * Ultimate Orchestrator - Maximum Performance Implementation
 * Zero abstraction, direct object manipulation for extreme speed
 */

import type { Session, SessionType, Message } from './types.js';

// Ultra-fast direct functions - no classes
const fastUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const getNow = () => Date.now();

// Ultimate cache - optimized Map operations with minimal overhead
class UltimateCache<K, V> {
  private data = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): void {
    if (this.data.size >= this.maxSize) {
      for (const firstKey of this.data.keys()) {
        this.data.delete(firstKey);
        break;
      }
    }
    this.data.set(key, value);
  }

  get(key: K): V | undefined {
    const value = this.data.get(key);
    if (value !== undefined) {
      this.data.delete(key);
      this.data.set(key, value);
    }
    return value;
  }

  delete(key: K): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  values(): V[] {
    return Array.from(this.data.values());
  }

  size(): number {
    return this.data.size;
  }
}

// Ultimate events - minimal possible overhead
class UltimateEvents {
  private listeners = new Map<string, Set<Function>>();

  on<T>(event: string, callback: (data: T) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  off<T>(event: string, callback: (data: T) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }
}

// Ultimate orchestrator - extreme performance optimization
export class UltimateOrchestrator {
  private sessionStore = new UltimateCache<string, Session>(1000);
  private contextStore = new UltimateCache<string, any>(500);
  private messageBuffer: Message[] = [];
  private eventHandler = new UltimateEvents();
  private performanceStats = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0
  };

  // Blazing fast session creation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = fastUUID();
    const timestamp = getNow();

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

    this.sessionStore.set(sessionId, session);
    this.eventHandler.emit('session', session);
    this.performanceStats.totalSessions++;

    return session;
  }

  // Maximum speed session retrieval
  getSession(id: string): Session | undefined {
    return this.sessionStore.get(id);
  }

  // Optimized session update with minimal overhead
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessionStore.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.sessionStore.set(id, updated);
    this.eventHandler.emit('session:updated', updated);

    return updated;
  }

  // Ultra-fast session deletion
  deleteSession(id: string): boolean {
    const session = this.sessionStore.get(id);
    if (!session) return false;

    this.sessionStore.delete(id);
    this.eventHandler.emit('session:deleted', session);

    return true;
  }

  // Direct context operations for maximum speed
  setContext(sessionId: string, context: any): void {
    this.contextStore.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contextStore.get(sessionId);
  }

  // High-speed message processing
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessionStore.get(sessionId)) return false;

    this.messageBuffer.push({ ...message, timestamp: new Date() });
    this.eventHandler.emit('message', message);
    this.performanceStats.totalMessages++;

    return true;
  }

  // Optimized batch message processing
  processMessages(): number {
    const count = this.messageBuffer.length;
    this.messageBuffer = [];
    return count;
  }

  // Fast session queries
  getAllSessions(): Session[] {
    return this.sessionStore.values();
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
    const sessionCount = this.sessionStore.size();
    const contextCount = this.contextStore.size();

    this.performanceStats.memoryUsage = sessionCount * 1000 + contextCount * 500;

    return {
      ...this.performanceStats,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageBuffer.length
    };
  }

  // Minimal overhead utility methods
  getSessionCount(): number {
    return this.sessionStore.size();
  }

  clearAll(): void {
    this.sessionStore.clear();
    this.contextStore.clear();
    this.messageBuffer = [];
    this.performanceStats.totalSessions = 0;
    this.performanceStats.totalMessages = 0;
    this.eventHandler.emit('sessions:cleared', undefined);
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

  // Direct event subscription for maximum performance
  onSessionCreated(callback: (session: Session) => void) { this.eventHandler.on('session', callback); }
  onSessionUpdated(callback: (session: Session) => void) { this.eventHandler.on('session:updated', callback); }
  onSessionDeleted(callback: (session: Session) => void) { this.eventHandler.on('session:deleted', callback); }
  onMessage(callback: (message: Message) => void) { this.eventHandler.on('message', callback); }
}

// Factory function
export function createUltimateOrchestrator(): UltimateOrchestrator {
  return new UltimateOrchestrator();
}

// Default instance
export const ultimateOrchestrator = createUltimateOrchestrator();
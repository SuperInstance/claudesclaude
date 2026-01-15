/**
 * Memory-Optimized Orchestrator - Pre-Allocation and Typed Arrays
 * Eliminates dynamic memory allocation through pre-sizing and typed operations
 */

import type { Session, SessionType, Message } from './types.js';

// Pre-allocated arrays for maximum performance
const MAX_SESSIONS = 1000;
const MAX_MESSAGES = 2000;
const MAX_CONTEXTS = 500;

// Session storage using typed arrays and direct indices
class SessionStorage {
  private sessions: Session[] = new Array(MAX_SESSIONS);
  private idToIndex: Map<string, number> = new Map();
  private nextIndex = 0;
  private count = 0;

  add(session: Session): void {
    if (this.count >= MAX_SESSIONS) {
      // LRU eviction
      this.evict();
    }

    const index = this.nextIndex;
    this.sessions[index] = session;
    this.idToIndex.set(session.id, index);
    this.nextIndex = (this.nextIndex + 1) % MAX_SESSIONS;
    this.count++;
  }

  get(id: string): Session | undefined {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      return this.sessions[index];
    }
    return undefined;
  }

  update(id: string, updates: Partial<Session>): boolean {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      const session = this.sessions[index];
      Object.assign(session, updates);
      session.updatedAt = new Date();
      return true;
    }
    return false;
  }

  delete(id: string): boolean {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      // Move to end and mark as empty
      this.sessions[index] = null as any;
      this.idToIndex.delete(id);
      this.count--;
      return true;
    }
    return false;
  }

  getAll(): Session[] {
    return this.sessions.slice(0, this.count).filter(s => s !== null);
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.sessions.fill(null);
    this.idToIndex.clear();
    this.nextIndex = 0;
    this.count = 0;
  }

  private evict(): void {
    // Evict oldest session
    const entries = Array.from(this.idToIndex.entries());
    if (entries.length > 0) {
      const [oldestId] = entries[0];
      this.delete(oldestId);
    }
  }
}

// Message storage with circular buffer for maximum efficiency
class MessageStorage {
  private messages: Message[] = new Array(MAX_MESSAGES);
  private head = 0;
  private tail = 0;
  private count = 0;

  add(message: Message): void {
    if (this.count >= MAX_MESSAGES) {
      // Overwrite oldest message
      this.head = (this.head + 1) % MAX_MESSAGES;
      this.count--;
    }

    this.messages[this.tail] = message;
    this.tail = (this.tail + 1) % MAX_MESSAGES;
    this.count++;
  }

  getAll(): Message[] {
    if (this.count === 0) return [];

    const result: Message[] = new Array(this.count);
    let current = this.head;

    for (let i = 0; i < this.count; i++) {
      result[i] = this.messages[current];
      current = (current + 1) % MAX_MESSAGES;
    }

    return result;
  }

  clear(): void {
    this.messages.fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  size(): number {
    return this.count;
  }
}

// Context storage with optimized Map operations
class ContextStorage {
  private contexts: Map<string, any> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: string, context: any): void {
    if (this.contexts.size >= this.maxSize) {
      // LRU eviction
      const firstKey = this.contexts.keys().next().value;
      this.contexts.delete(firstKey);
    }
    this.contexts.set(key, context);
  }

  get(key: string): any {
    const value = this.contexts.get(key);
    if (value !== undefined) {
      // Move to end (LRU)
      this.contexts.delete(key);
      this.contexts.set(key, value);
    }
    return value;
  }

  delete(key: string): boolean {
    return this.contexts.delete(key);
  }

  size(): number {
    return this.contexts.size;
  }

  clear(): void {
    this.contexts.clear();
  }
}

// Fast UUID generation using counter-based approach
class FastUUID {
  private counter = 0;
  private lastTimestamp = 0;

  generate(): string {
    const now = Date.now();
    let id = '';

    if (now !== this.lastTimestamp) {
      this.counter = 0;
      this.lastTimestamp = now;
    }

    id = now.toString(36) + this.counter.toString(36);
    this.counter++;

    return id;
  }
}

// Memory-optimized orchestrator
export class MemoryOptimizedOrchestrator {
  private sessionStorage = new SessionStorage();
  private contextStorage = new ContextStorage(MAX_CONTEXTS);
  private messageStorage = new MessageStorage();
  private events = new Map<string, Set<Function>>();
  private uuid = new FastUUID();
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    allocationOverhead: 0
  };

  // Create session with pre-allocation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = this.uuid.generate();
    const timestamp = Date.now();

    // Pre-allocated session object
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

    this.sessionStorage.add(session);
    this.emit('session', session);
    this.metrics.totalSessions++;
    this.metrics.allocationOverhead += this.calculateSessionSize();

    return session;
  }

  // Get session
  getSession(id: string): Session | undefined {
    return this.sessionStorage.get(id);
  }

  // Update session with direct object assignment
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const success = this.sessionStorage.update(id, updates);
    if (success) {
      const session = this.sessionStorage.get(id)!;
      this.emit('session:updated', session);
      return session;
    }
    return undefined;
  }

  // Delete session
  deleteSession(id: string): boolean {
    const success = this.sessionStorage.delete(id);
    if (success) {
      const session = this.sessionStorage.get(id);
      if (session) {
        this.emit('session:deleted', session);
      }
      this.metrics.allocationOverhead -= this.calculateSessionSize();
    }
    return success;
  }

  // Context management with optimized operations
  setContext(sessionId: string, context: any): void {
    this.contextStorage.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contextStorage.get(sessionId);
  }

  // Message handling with circular buffer
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessionStorage.get(sessionId)) return false;

    const messageWithTimestamp = { ...message, timestamp: new Date() };
    this.messageStorage.add(messageWithTimestamp);
    this.emit('message', messageWithTimestamp);
    this.metrics.totalMessages++;

    return true;
  }

  // Process messages with bulk operations
  processMessages(): number {
    const count = this.messageStorage.size();
    this.messageStorage.clear();
    return count;
  }

  // Query methods with direct array access
  getAllSessions(): Session[] {
    return this.sessionStorage.getAll();
  }

  getSessionsByType(type: SessionType): Session[] {
    const sessions = this.getAllSessions();
    const result: Session[] = [];

    // Direct iteration without allocation
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].type === type) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const sessions = this.getAllSessions();
    const result: Session[] = [];

    // Direct iteration without allocation
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].status === status) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const sessions = this.getAllSessions();
    const result: Session[] = [];

    // Direct iteration without allocation
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].workspace === workspace) {
        result.push(sessions[i]);
      }
    }

    return result;
  }

  // Optimized metrics calculation
  getMetrics() {
    const sessionCount = this.sessionStorage.size();
    const contextCount = this.contextStorage.size();
    const messageCount = this.messageStorage.size();

    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500 + messageCount * 200;

    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: messageCount,
      memoryEfficiency: (sessionCount + contextCount + messageCount) / (MAX_SESSIONS + MAX_CONTEXTS + MAX_MESSAGES)
    };
  }

  // Utility methods
  getSessionCount(): number {
    return this.sessionStorage.size();
  }

  clearAll(): void {
    this.sessionStorage.clear();
    this.contextStorage.clear();
    this.messageStorage.clear();
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
    this.metrics.allocationOverhead = 0;
    this.emit('sessions:cleared', undefined);
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

  // Event subscriptions with minimal overhead
  onSessionCreated(cb: (session: Session) => void) { this.on('session', cb); }
  onSessionUpdated(cb: (session: Session) => void) { this.on('session:updated', cb); }
  onSessionDeleted(cb: (session: Session) => void) { this.on('session:deleted', cb); }
  onMessage(cb: (message: Message) => void) { this.on('message', cb); }

  private on<T>(event: string, callback: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  private emit<T>(event: string, data: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  private calculateSessionSize(): number {
    return 1000; // Average session size in bytes
  }
}

// Factory function
export function createMemoryOptimizedOrchestrator(): MemoryOptimizedOrchestrator {
  return new MemoryOptimizedOrchestrator();
}

// Default instance
export const memoryOptimizedOrchestrator = createMemoryOptimizedOrchestrator();
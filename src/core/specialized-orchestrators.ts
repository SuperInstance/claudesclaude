/**
 * Specialized Orchestrator Variants
 * Optimized for specific use cases and workloads
 */

import type { Session, SessionType, Message } from './types.js';

// ==================== READ-ONLY ORCHESTRATOR ====================
// Optimized for high read throughput with minimal write overhead

class ReadOnlyOrchestrator {
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();
  private sessionIndex = new Map<string, Set<string>>(); // workspace -> session IDs
  private typeIndex = new Map<string, Set<string>>(); // type -> session IDs
  private statusIndex = new Map<string, Set<string>>(); // status -> session IDs

  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
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

    this.sessions.set(sessionId, session);
    this.updateIndex(sessionId, session, 'add');
    this.emit('session', session);

    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Store old values for index updates
    const oldType = session.type;
    const oldWorkspace = session.workspace;
    const oldStatus = session.status;

    // Apply updates
    if (updates.name !== undefined) session.name = updates.name;
    if (updates.type !== undefined) session.type = updates.type;
    if (updates.workspace !== undefined) session.workspace = updates.workspace;
    if (updates.config !== undefined) session.config = updates.config;
    if (updates.status !== undefined) session.status = updates.status;
    session.updatedAt = new Date();

    // Update indices if needed
    if (updates.type !== undefined && oldType !== updates.type) {
      this.updateIndex(id, session, 'update', oldType);
    }
    if (updates.workspace !== undefined && oldWorkspace !== updates.workspace) {
      this.updateIndex(id, session, 'update', undefined, oldWorkspace);
    }
    if (updates.status !== undefined && oldStatus !== updates.status) {
      this.updateIndex(id, session, 'update', undefined, undefined, oldStatus);
    }

    this.emit('session:updated', session);
    return session;
  }

  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.updateIndex(id, session, 'delete');
    this.emit('session:deleted', session);

    return true;
  }

  // Optimized read operations using indices
  getSessionsByType(type: SessionType): Session[] {
    const sessionIds = this.typeIndex.get(type);
    if (!sessionIds) return [];

    const result: Session[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const sessionIds = this.statusIndex.get(status);
    if (!sessionIds) return [];

    const result: Session[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const sessionIds = this.sessionIndex.get(workspace);
    if (!sessionIds) return [];

    const result: Session[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) result.push(session);
    }
    return result;
  }

  private updateIndex(sessionId: string, session: Session, operation: 'add' | 'update' | 'delete',
                     oldType?: string, oldWorkspace?: string, oldStatus?: string): void {
    if (operation === 'add' || operation === 'update') {
      // Add to workspace index
      if (!this.sessionIndex.has(session.workspace)) {
        this.sessionIndex.set(session.workspace, new Set());
      }
      this.sessionIndex.get(session.workspace)!.add(sessionId);

      // Add to type index
      if (!this.typeIndex.has(session.type)) {
        this.typeIndex.set(session.type, new Set());
      }
      this.typeIndex.get(session.type)!.add(sessionId);

      // Add to status index
      if (!this.statusIndex.has(session.status)) {
        this.statusIndex.set(session.status, new Set());
      }
      this.statusIndex.get(session.status)!.add(sessionId);
    }

    if (operation === 'update') {
      // Remove from old indices
      if (oldType && oldType !== session.type) {
        const oldTypeSet = this.typeIndex.get(oldType);
        if (oldTypeSet) oldTypeSet.delete(sessionId);
      }
      if (oldWorkspace && oldWorkspace !== session.workspace) {
        const oldWorkspaceSet = this.sessionIndex.get(oldWorkspace);
        if (oldWorkspaceSet) oldWorkspaceSet.delete(sessionId);
      }
      if (oldStatus && oldStatus !== session.status) {
        const oldStatusSet = this.statusIndex.get(oldStatus);
        if (oldStatusSet) oldStatusSet.delete(sessionId);
      }
    }

    if (operation === 'delete') {
      // Remove from all indices
      this.sessionIndex.get(session.workspace)?.delete(sessionId);
      this.typeIndex.get(session.type)?.delete(sessionId);
      this.statusIndex.get(session.status)?.delete(sessionId);
    }
  }

  // Other methods simplified for read-only use case
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.has(sessionId)) return false;
    this.messages.push({ ...message, timestamp: new Date() });
    return true;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
  }

  // Event methods (simplified)
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

  // Remaining utility methods
  getSessionCount(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.sessionIndex.clear();
    this.typeIndex.clear();
    this.statusIndex.clear();
  }

  healthCheck() {
    return { status: 'healthy', details: this.getMetrics() };
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
}

// ==================== WRITE-HEAVY ORCHESTRATOR ====================
// Optimized for high write throughput with minimal read overhead

class WriteHeavyOrchestrator {
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();
  private sessionPool: Session[] = [];
  private messagePool: Message[] = [];
  private poolSize = 100;

  constructor() {
    // Pre-allocate object pools
    for (let i = 0; i < this.poolSize; i++) {
      this.sessionPool.push({
        id: '',
        type: 'agent',
        name: '',
        workspace: '',
        config: {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      this.messagePool.push({
        id: '',
        type: '',
        content: '',
        metadata: undefined,
        timestamp: new Date()
      });
    }
  }

  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const session = this.sessionPool.pop() || {
      id: '',
      type: 'agent',
      name: '',
      workspace: '',
      config: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    session.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    session.type = config.type;
    session.name = config.name;
    session.workspace = config.workspace;
    session.config = config.config || {};
    session.status = 'active';

    this.sessions.set(session.id, session);
    this.emit('session', session);

    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Direct property updates for maximum write speed
    Object.assign(session, updates, { updatedAt: new Date() });
    this.emit('session:updated', session);

    return session;
  }

  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);

    // Return to pool
    if (this.sessionPool.length < this.poolSize * 2) {
      session.id = '';
      session.name = '';
      session.workspace = '';
      session.config = {};
      this.sessionPool.push(session);
    }

    this.emit('session:deleted', session);

    return true;
  }

  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.has(sessionId)) return false;

    const pooledMessage = this.messagePool.pop() || {
      id: '',
      type: '',
      content: '',
      metadata: undefined,
      timestamp: new Date()
    };

    pooledMessage.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    pooledMessage.type = message.type;
    pooledMessage.content = message.content;
    pooledMessage.metadata = message.metadata;
    pooledMessage.timestamp = new Date();

    this.messages.push(pooledMessage);
    this.emit('message', pooledMessage);

    return true;
  }

  // Bulk operations for write-heavy workloads
  createSessionsBatch(sessions: Array<{ type: SessionType; name: string; workspace: string; config?: any }>): Session[] {
    const results: Session[] = [];
    for (const config of sessions) {
      results.push(this.createSession(config));
    }
    return results;
  }

  sendMessagesBatch(sessionId: string, messages: Message[]): boolean {
    if (!this.sessions.has(sessionId)) return false;

    for (const message of messages) {
      this.sendMessage(sessionId, message);
    }
    return true;
  }

  // Other methods
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSessionsByType(type: SessionType): Session[] {
    const result: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.type === type) result.push(session);
    }
    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const result: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === status) result.push(session);
    }
    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const result: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.workspace === workspace) result.push(session);
    }
    return result;
  }

  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      poolUtilization: this.sessionPool.length / this.poolSize
    };
  }

  // Event methods
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

  // Utility methods
  getSessionCount(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.sessionPool = [];
    this.messagePool = [];
  }

  healthCheck() {
    return { status: 'healthy', details: this.getMetrics() };
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
}

// ==================== LOW-LATENCY ORCHESTRATOR ====================
// Optimized for minimum latency in critical operations

class LowLatencyOrchestrator {
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();
  private criticalPathCache = new Map<string, Session>(); // Hot-path cache

  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
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

    // Store in both regular and hot-path cache
    this.sessions.set(sessionId, session);
    this.criticalPathCache.set(sessionId, session);
    this.emit('session', session);

    return session;
  }

  getSession(id: string): Session | undefined {
    // Try hot-path cache first
    const session = this.criticalPathCache.get(id);
    if (session) {
      return session;
    }

    // Fall back to regular cache
    const session2 = this.sessions.get(id);
    if (session2) {
      // Promote to hot-path cache
      this.criticalPathCache.set(id, session2);
      return session2;
    }

    return undefined;
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;

    // Ultra-fast updates
    Object.assign(session, updates, { updatedAt: new Date() });

    // Update in both caches
    this.sessions.set(id, session);
    this.criticalPathCache.set(id, session);
    this.emit('session:updated', session);

    return session;
  }

  deleteSession(id: string): boolean {
    const session = this.getSession(id);
    if (!session) return false;

    // Delete from both caches
    this.sessions.delete(id);
    this.criticalPathCache.delete(id);
    this.emit('session:deleted', session);

    return true;
  }

  // Optimized for critical path operations
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.getSession(sessionId)) return false;

    // Ultra-fast message creation
    this.messages.push({ ...message, timestamp: new Date() });
    this.emit('message', message);

    return true;
  }

  // Fast queries with hot-path optimization
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSessionsByType(type: SessionType): Session[] {
    const result: Session[] = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.type === type) result.push(session);
    }
    return result;
  }

  getSessionsByStatus(status: string): Session[] {
    const result: Session[] = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.status === status) result.push(session);
    }
    return result;
  }

  getWorkspaceSessions(workspace: string): Session[] {
    const result: Session[] = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.workspace === workspace) result.push(session);
    }
    return result;
  }

  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      hotPathCacheSize: this.criticalPathCache.size,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
  }

  // Event methods
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

  // Utility methods
  getSessionCount(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.criticalPathCache.clear();
  }

  healthCheck() {
    return { status: 'healthy', details: this.getMetrics() };
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
}

// Export specialized orchestrators
export { ReadOnlyOrchestrator, WriteHeavyOrchestrator, LowLatencyOrchestrator };

// Factory functions
export function createReadOnlyOrchestrator(): ReadOnlyOrchestrator {
  return new ReadOnlyOrchestrator();
}

export function createWriteHeavyOrchestrator(): WriteHeavyOrchestrator {
  return new WriteHeavyOrchestrator();
}

export function createLowLatencyOrchestrator(): LowLatencyOrchestrator {
  return new LowLatencyOrchestrator();
}

// Default instances
export const readOnlyOrchestrator = createReadOnlyOrchestrator();
export const writeHeavyOrchestrator = createWriteHeavyOrchestrator();
export const lowLatencyOrchestrator = createLowLatencyOrchestrator();
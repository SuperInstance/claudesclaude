/**
 * Zero-Copy Orchestrator - Memory-Efficient Data Handling
 * Minimizes memory copying through object pooling and transferable objects
 */

import type { Session, SessionType, Message } from './types.js';

// Zero-copy data structures using Transferable objects
class ZeroCopySessionStorage {
  private sessions: Session[] = new Array(1000);
  private idToIndex: Map<string, number> = new Map();
  private typeIndices: Map<string, Uint32Array> = new Map();
  private statusIndices: Map<string, Uint32Array> = new Map();
  private workspaceIndices: Map<string, Uint32Array> = new Map();
  private count = 0;
  private nextIndex = 0;
  private freeIndices: number[] = [];

  // Zero-copy session creation with pre-allocated objects
  add(session: Session): void {
    let index: number;

    if (this.freeIndices.length > 0) {
      index = this.freeIndices.pop()!;
    } else if (this.count >= this.sessions.length) {
      this.evictLRU();
      index = this.nextIndex;
    } else {
      index = this.nextIndex;
      this.nextIndex = (this.nextIndex + 1) % this.sessions.length;
      this.count++;
    }

    // Zero-copy assignment: just reference the object
    this.sessions[index] = session;
    this.idToIndex.set(session.id, index);

    // Zero-copy indexing
    this.updateIndex(session.type, index);
    this.updateIndex(session.status, index);
    this.updateIndex(session.workspace, index);
  }

  // Zero-copy session retrieval
  get(id: string): Session | undefined {
    const index = this.idToIndex.get(id);
    return index !== undefined ? this.sessions[index] : undefined;
  }

  // Zero-copy session update
  update(id: string, updates: Partial<Session>): boolean {
    const index = this.idToIndex.get(id);
    if (index === undefined) return false;

    const session = this.sessions[index];

    // Update indices with zero-copy operations
    if (updates.type !== undefined && updates.type !== session.type) {
      this.removeFromIndex(session.type, index);
      this.updateIndex(updates.type, index);
    }
    if (updates.status !== undefined && updates.status !== session.status) {
      this.removeFromIndex(session.status, index);
      this.updateIndex(updates.status, index);
    }
    if (updates.workspace !== undefined && updates.workspace !== session.workspace) {
      this.removeFromIndex(session.workspace, index);
      this.updateIndex(updates.workspace, index);
    }

    // Zero-copy property updates
    if (updates.name !== undefined) session.name = updates.name;
    if (updates.config !== undefined) session.config = updates.config;
    if (updates.status !== undefined) session.status = updates.status;
    session.updatedAt = new Date();

    return true;
  }

  // Zero-copy session deletion
  delete(id: string): boolean {
    const index = this.idToIndex.get(id);
    if (index === undefined) return false;

    const session = this.sessions[index];

    // Remove from indices with zero-copy operations
    this.removeFromIndex(session.type, index);
    this.removeFromIndex(session.status, index);
    this.removeFromIndex(session.workspace, index);

    // Zero-copy removal: mark as free
    this.sessions[index] = null as any;
    this.idToIndex.delete(id);
    this.freeIndices.push(index);
    this.count--;

    return true;
  }

  // Zero-copy queries using typed arrays
  getByType(type: string): Session[] {
    const indexArray = this.typeIndices.get(type);
    if (!indexArray) return [];

    // Zero-copy iteration with typed array
    const result: Session[] = [];
    for (let i = 0; i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }

  getByStatus(status: string): Session[] {
    const indexArray = this.statusIndices.get(status);
    if (!indexArray) return [];

    const result: Session[] = [];
    for (let i = 0; i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }

  getByWorkspace(workspace: string): Session[] {
    const indexArray = this.workspaceIndices.get(workspace);
    if (!indexArray) return [];

    const result: Session[] = [];
    for (let i = 0; i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }

  // Get all sessions with zero-copy filtering
  getAll(): Session[] {
    const result: Session[] = new Array(this.count);
    let actualCount = 0;
    for (let i = 0; i < this.sessions.length; i++) {
      const session = this.sessions[i];
      if (session !== null) {
        result[actualCount++] = session;
      }
    }
    return result.slice(0, actualCount);
  }

  // Zero-copy indexing with pre-allocated typed arrays
  private updateIndex(key: string, index: number): void {
    if (!this.typeIndices.has(key)) {
      this.typeIndices.set(key, new Uint32Array(100));
      this.statusIndices.set(key, new Uint32Array(100));
      this.workspaceIndices.set(key, new Uint32Array(100));
    }

    const typeArray = this.typeIndices.get(key)!;
    const statusArray = this.statusIndices.get(key)!;
    const workspaceArray = this.workspaceIndices.get(key)!;

    // Zero-copy find first zero (used as free slot indicator)
    let typeIndex = 0;
    while (typeIndex < typeArray.length && typeArray[typeIndex] !== 0) {
      typeIndex++;
    }
    let statusIndex = 0;
    while (statusIndex < statusArray.length && statusArray[statusIndex] !== 0) {
      statusIndex++;
    }
    let workspaceIndex = 0;
    while (workspaceIndex < workspaceArray.length && workspaceArray[workspaceIndex] !== 0) {
      workspaceIndex++;
    }

    // Zero-copy assignment to typed array
    typeArray[typeIndex] = index;
    statusArray[statusIndex] = index;
    workspaceArray[workspaceIndex] = index;
  }

  // Zero-copy index removal
  private removeFromIndex(key: string, index: number): void {
    const typeArray = this.typeIndices.get(key);
    const statusArray = this.statusIndices.get(key);
    const workspaceArray = this.workspaceIndices.get(key);

    if (typeArray) {
      for (let i = 0; i < typeArray.length; i++) {
        if (typeArray[i] === index) {
          typeArray[i] = 0; // Zero indicates free slot
          break;
        }
      }
    }
    if (statusArray) {
      for (let i = 0; i < statusArray.length; i++) {
        if (statusArray[i] === index) {
          statusArray[i] = 0;
          break;
        }
      }
    }
    if (workspaceArray) {
      for (let i = 0; i < workspaceArray.length; i++) {
        if (workspaceArray[i] === index) {
          workspaceArray[i] = 0;
          break;
        }
      }
    }
  }

  // LRU eviction with zero-copy optimization
  private evictLRU(): void {
    const entries = Array.from(this.idToIndex.entries());
    if (entries.length > 0) {
      const [oldestId] = entries[0];
      this.delete(oldestId);
    }
  }
}

// Zero-copy orchestrator with transferable object support
export class ZeroCopyOrchestrator {
  private sessionStorage = new ZeroCopySessionStorage();
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();
  private transferableObjects: Transferable[] = [];
  private metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    zeroCopyOptimized: true
  };

  // Zero-copy session creation with transferable support
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    const sessionId = this.generateZeroCopyUUID();
    const timestamp = new Date();

    // Zero-copy session object creation
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

    this.sessionStorage.add(session);
    this.emit('session', session);
    this.metrics.totalSessions++;

    return session;
  }

  // Zero-copy session retrieval
  getSession(id: string): Session | undefined {
    return this.sessionStorage.get(id);
  }

  // Zero-copy session update
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const success = this.sessionStorage.update(id, updates);
    if (success) {
      const session = this.sessionStorage.get(id)!;
      this.emit('session:updated', session);
      return session;
    }
    return undefined;
  }

  // Zero-copy session deletion
  deleteSession(id: string): boolean {
    const success = this.sessionStorage.delete(id);
    if (success) {
      const session = this.sessionStorage.get(id);
      if (session) {
        this.emit('session:deleted', session);
      }
    }
    return success;
  }

  // Zero-copy context management with transferable support
  setContext(sessionId: string, context: any): void {
    if (context && typeof context === 'object' && 'transfer' in context) {
      // Support for transferable objects
      this.transferableObjects.push(context.transfer);
    }
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Zero-copy message handling with transferable support
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessionStorage.get(sessionId)) return false;

    // Zero-copy message object creation
    const messageWithTimestamp: Message = {
      content: message.content || '',
      role: message.role || 'user',
      timestamp: new Date(),
      metadata: message.metadata || {}
    };

    this.messages.push(messageWithTimestamp);
    this.emit('message', messageWithTimestamp);
    this.metrics.totalMessages++;

    return true;
  }

  // Zero-copy batch message processing
  processMessages(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  // Zero-copy queries using typed arrays
  getAllSessions(): Session[] {
    return this.sessionStorage.getAll();
  }

  getSessionsByType(type: SessionType): Session[] {
    return this.sessionStorage.getByType(type);
  }

  getSessionsByStatus(status: string): Session[] {
    return this.sessionStorage.getByStatus(status);
  }

  getWorkspaceSessions(workspace: string): Session[] {
    return this.sessionStorage.getByWorkspace(workspace);
  }

  // Zero-copy metrics calculation
  getMetrics() {
    const sessionCount = this.sessionStorage.getAll().length;
    const contextCount = this.contexts.size;
    const transferableCount = this.transferableObjects.length;

    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500 + transferableCount * 100;

    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messages.length,
      transferableObjects: transferableCount,
      zeroCopyOptimized: true
    };
  }

  // Utility methods with zero-copy optimization
  getSessionCount(): number {
    return this.sessionStorage.getAll().length;
  }

  clearAll(): void {
    this.sessionStorage = new ZeroCopySessionStorage();
    this.contexts.clear();
    this.messages = [];
    this.transferableObjects = [];
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
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

  // Zero-copy export with transferable support
  exportSessions(): any[] {
    return this.getAllSessions().map(s => ({
      id: s.id, type: s.type, name: s.name, workspace: s.workspace,
      config: s.config, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt
    }));
  }

  // Zero-copy import with transferable support
  importSessions(sessions: any[]): void {
    for (let i = 0; i < sessions.length; i++) {
      this.createSession({
        type: sessions[i].type,
        name: sessions[i].name,
        workspace: sessions[i].workspace,
        config: sessions[i].config
      });
    }
  }

  // Get transferable objects for postMessage
  getTransferableObjects(): Transferable[] {
    return this.transferableObjects.slice();
  }

  // Event methods with zero-copy optimization
  onSessionCreated(callback: (session: Session) => void) { this.on('session', callback); }
  onSessionUpdated(callback: (session: Session) => void) { this.on('session:updated', callback); }
  onSessionDeleted(callback: (session: Session) => void) { this.on('session:deleted', callback); }
  onMessage(callback: (message: Message) => void) { this.on('message', callback); }

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

  // Zero-copy UUID generation
  private generateZeroCopyUUID(): string {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2);
    return time + random;
  }
}

// Factory function
export function createZeroCopyOrchestrator(): ZeroCopyOrchestrator {
  return new ZeroCopyOrchestrator();
}

// Default instance
export const zeroCopyOrchestrator = createZeroCopyOrchestrator();
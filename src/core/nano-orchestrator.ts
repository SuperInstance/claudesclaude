/**
 * Nano Orchestrator - Absolute Minimal Overhead
 * Zero abstraction, inline operations, maximum performance
 */

import type { Session, SessionType, Message } from './types.js';
import { validateWorkspace, validateSessionName } from './types.js';

// Nano-orchestrator - extreme minimalism
export class NanoOrchestrator {
  // Direct storage with minimal abstractions
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private messages: Message[] = [];
  private events = new Map<string, Set<Function>>();
  private totalSessions = 0;
  private totalMessages = 0;

  // Ultra-simple UUID generation
  private nanoUUID(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Create session - maximum speed with validation
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    // Validate inputs for security
    try {
      validateWorkspace(config.workspace);
      validateSessionName(config.name);
    } catch (error) {
      throw new Error(`Invalid session configuration: ${error.message}`);
    }

    const sessionId = this.nanoUUID();
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
    this.emit('session', session);
    this.totalSessions++;

    return session;
  }

  // Get session - direct Map access
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  // Update session - direct property access
  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Direct property updates
    if (updates.name !== undefined) session.name = updates.name;
    if (updates.workspace !== undefined) session.workspace = updates.workspace;
    if (updates.config !== undefined) session.config = updates.config;
    if (updates.status !== undefined) session.status = updates.status;
    session.updatedAt = new Date();

    this.emit('session:updated', session);

    return session;
  }

  // Delete session - direct Map deletion
  deleteSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);
    this.emit('session:deleted', session);

    return true;
  }

  // Context management - direct Map operations
  setContext(sessionId: string, context: any): void {
    this.contexts.set(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.contexts.get(sessionId);
  }

  // Message handling - direct array push
  sendMessage(sessionId: string, message: Message): boolean {
    if (!this.sessions.has(sessionId)) return false;

    this.messages.push({ ...message, timestamp: new Date() });
    this.emit('message', message);
    this.totalMessages++;

    return true;
  }

  // Process messages - direct array clear
  processMessages(): number {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  // Query methods - direct array iteration
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

  // Metrics - direct calculations
  getMetrics() {
    return {
      totalSessions: this.totalSessions,
      totalMessages: this.totalMessages,
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
  }

  // Utility methods - direct operations
  getSessionCount(): number {
    return this.sessions.size;
  }

  clearAll(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.totalSessions = 0;
    this.totalMessages = 0;
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
    const result: any[] = [];
    for (const session of this.sessions.values()) {
      result.push({
        id: session.id,
        type: session.type,
        name: session.name,
        workspace: session.workspace,
        config: session.config,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });
    }
    return result;
  }

  importSessions(sessions: any[]): void {
    for (const s of sessions) {
      this.createSession({
        type: s.type,
        name: s.name,
        workspace: s.workspace,
        config: s.config
      });
    }
  }

  // Event handling - minimal overhead
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
}

// Factory function
export function createNanoOrchestrator(): NanoOrchestrator {
  return new NanoOrchestrator();
}

// Default instance
export const nanoOrchestrator = createNanoOrchestrator();
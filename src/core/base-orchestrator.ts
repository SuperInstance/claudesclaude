/**
 * Base Orchestrator Interface
 * Defines the standard contract that all orchestrators must implement
 */

import type { Session, SessionType, Message } from './types.js';

/**
 * Session configuration interface
 */
export interface SessionConfig {
  type: SessionType;
  name: string;
  workspace: string;
  config?: Record<string, any>;
}

/**
 * Orchestrator metrics interface
 */
export interface OrchestratorMetrics {
  totalSessions: number;
  totalMessages: number;
  activeSessions: number;
  cachedContexts: number;
  pendingMessages: number;
  memoryUsage: number;
}

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}

/**
 * Session export interface
 */
export interface SessionExport {
  id: string;
  type: SessionType;
  name: string;
  workspace: string;
  config: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base orchestrator interface
 * All orchestrators should implement this interface for consistency
 */
export interface BaseOrchestrator {
  // Core session methods
  createSession(config: SessionConfig): Session;
  getSession(id: string): Session | undefined;
  updateSession(id: string, updates: Partial<Session>): Session | undefined;
  deleteSession(id: string): boolean;

  // Context management
  setContext(sessionId: string, context: any): void;
  getContext(sessionId: string): any;

  // Message handling
  sendMessage(sessionId: string, message: Message): boolean;
  processMessages(): number;

  // Query methods
  getAllSessions(): Session[];
  getSessionsByType(type: SessionType): Session[];
  getSessionsByStatus(status: string): Session[];
  getWorkspaceSessions(workspace: string): Session[];

  // Utilities
  getSessionCount(): number;
  clearAll(): void;
  healthCheck(): HealthCheckResult;
  exportSessions(): SessionExport[];
  importSessions(sessions: SessionExport[]): void;

  // Events
  onSessionCreated(callback: (session: Session) => void): void;
  onSessionUpdated(callback: (session: Session) => void): void;
  onSessionDeleted(callback: (session: Session) => void): void;
  onMessage(callback: (message: Message) => void): void;

  // Metrics
  getMetrics(): OrchestratorMetrics & Record<string, any>;
}

/**
 * Abstract base class with common orchestrator functionality
 * Provides shared validation and error handling
 */
export abstract class AbstractOrchestrator implements BaseOrchestrator {
  protected events = new Map<string, Set<Function>>();

  /**
   * Validate session configuration
   * @throws Error if configuration is invalid
   */
  protected validateSessionConfig(config: SessionConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Session name cannot be empty');
    }
    if (config.name.length > 255) {
      throw new Error('Session name must be 255 characters or less');
    }
    if (!config.workspace || config.workspace.trim().length === 0) {
      throw new Error('Workspace cannot be empty');
    }
    if (config.workspace.includes('..') || config.workspace.includes('~')) {
      throw new Error('Workspace cannot contain path traversal characters');
    }
    if (config.workspace.startsWith('/')) {
      throw new Error('Workspace must be a relative path');
    }
    if (!/^[\w\-\/]+$/.test(config.workspace)) {
      throw new Error('Workspace contains invalid characters');
    }
  }

  /**
   * Emit event to registered listeners
   */
  protected emit<T>(event: string, data: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Register event listener
   */
  protected on<T>(event: string, callback: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  // Abstract methods that must be implemented by subclasses
  abstract createSession(config: SessionConfig): Session;
  abstract getSession(id: string): Session | undefined;
  abstract updateSession(id: string, updates: Partial<Session>): Session | undefined;
  abstract deleteSession(id: string): boolean;
  abstract setContext(sessionId: string, context: any): void;
  abstract getContext(sessionId: string): any;
  abstract sendMessage(sessionId: string, message: Message): boolean;
  abstract processMessages(): number;
  abstract getAllSessions(): Session[];
  abstract getSessionsByType(type: SessionType): Session[];
  abstract getSessionsByStatus(status: string): Session[];
  abstract getWorkspaceSessions(workspace: string): Session[];
  abstract getSessionCount(): number;
  abstract clearAll(): void;
  abstract healthCheck(): HealthCheckResult;
  abstract exportSessions(): SessionExport[];
  abstract importSessions(sessions: SessionExport[]): void;
  abstract getMetrics(): OrchestratorMetrics & Record<string, any>;

  // Event methods
  onSessionCreated(callback: (session: Session) => void): void {
    this.on('session', callback);
  }

  onSessionUpdated(callback: (session: Session) => void): void {
    this.on('session:updated', callback);
  }

  onSessionDeleted(callback: (session: Session) => void): void {
    this.on('session:deleted', callback);
  }

  onMessage(callback: (message: Message) => void): void {
    this.on('message', callback);
  }
}
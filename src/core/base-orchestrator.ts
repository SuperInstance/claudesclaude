/**
 * Base Orchestrator Interface
 * Defines the standard contract that all orchestrators must implement
 *
 * This interface ensures consistency across different orchestrator implementations
 * and provides a common API for session management, context handling, and messaging.
 *
 * @example
 * ```typescript
 * class MyOrchestrator implements BaseOrchestrator {
 *   // Implement all required methods...
 * }
 * ```
 */

import type { Session, SessionType, Message } from './types.js';

/**
 * Session configuration interface
 *
 * Defines the required and optional parameters for creating a session.
 *
 * @property type - The type of session (agent, task, workflow, etc.)
 * @property name - Human-readable name for the session (max 255 chars)
 * @property workspace - Workspace identifier (relative path, validated)
 * @property config - Optional session-specific configuration object
 *
 * @example
 * ```typescript
 * const config: SessionConfig = {
 *   type: 'agent',
 *   name: 'Code Assistant',
 *   workspace: 'team/backend',
 *   config: { model: 'claude-opus-4', maxTokens: 4096 }
 * };
 * ```
 */
export interface SessionConfig {
  type: SessionType;
  name: string;
  workspace: string;
  config?: Record<string, any>;
}

/**
 * Orchestrator metrics interface
 *
 * Provides standardized metrics for monitoring orchestrator performance and resource usage.
 *
 * @property totalSessions - Total number of sessions created (lifetime counter)
 * @property totalMessages - Total number of messages processed (lifetime counter)
 * @property activeSessions - Number of currently active sessions
 * @property cachedContexts - Number of session contexts currently cached
 * @property pendingMessages - Number of messages waiting to be processed
 * @property memoryUsage - Estimated memory usage in bytes
 *
 * @example
 * ```typescript
 * const metrics = orchestrator.getMetrics();
 * console.log(`Active sessions: ${metrics.activeSessions}`);
 * console.log(`Memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
 * ```
 *
 * @remarks
 * - Metrics are calculated based on internal counters
 * - Memory usage is approximate and doesn't account for all overhead
 * - Additional custom metrics may be included by specific implementations
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
 *
 * Represents the health status of an orchestrator with detailed diagnostics.
 *
 * @property status - Overall health status: 'healthy', 'degraded', or 'unhealthy'
 * @property details - Additional diagnostic information and metrics
 *
 * @example
 * ```typescript
 * const health = orchestrator.healthCheck();
 * if (health.status === 'healthy') {
 *   console.log('All systems operational');
 * } else {
 *   console.warn('Health check:', health.details);
 * }
 * ```
 *
 * @remarks
 * - healthy: All systems functioning within normal parameters
 * - degraded: Some metrics exceeded thresholds but system is functional
 * - unhealthy: Critical thresholds exceeded, immediate attention required
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}

/**
 * Session export interface
 *
 * Defines the structure of session data when exported for serialization or transfer.
 *
 * @property id - Unique session identifier
 * @property type - Session type (agent, task, workflow, etc.)
 * @property name - Human-readable session name
 * @property workspace - Workspace identifier
 * @property config - Session configuration object
 * @property status - Current session status
 * @property createdAt - Session creation timestamp
 * @property updatedAt - Last update timestamp
 *
 * @example
 * ```typescript
 * const exported: SessionExport[] = orchestrator.exportSessions();
 * const json = JSON.stringify(exported);
 * // Save to file or transfer over network
 * ```
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
 *
 * Defines the standard contract that all orchestrator implementations must follow.
 * This interface ensures consistency and interoperability across different orchestrator types.
 *
 * @example
 * ```typescript
 * class CustomOrchestrator implements BaseOrchestrator {
 *   createSession(config: SessionConfig): Session {
 *     // Implementation
 *   }
 *   // ... implement all other methods
 * }
 * ```
 *
 * @remarks
 * All orchestrator implementations should:
 * - Validate inputs according to the interface contracts
 * - Emit appropriate events for state changes
 * - Handle errors gracefully with informative messages
 * - Provide consistent behavior across all methods
 */
export interface BaseOrchestrator {
  // Core session methods
  /**
   * Creates a new session with the provided configuration
   * @param config - Session configuration
   * @returns The newly created Session object
   * @throws {Error} If configuration validation fails
   */
  createSession(config: SessionConfig): Session;

  /**
   * Retrieves a session by its unique identifier
   * @param id - Session ID to retrieve
   * @returns The Session object, or undefined if not found
   */
  getSession(id: string): Session | undefined;

  /**
   * Updates a session with the provided changes
   * @param id - Session ID to update
   * @param updates - Partial session object with fields to update
   * @returns The updated Session object, or undefined if not found
   */
  updateSession(id: string, updates: Partial<Session>): Session | undefined;

  /**
   * Deletes a session and its associated data
   * @param id - Session ID to delete
   * @returns true if session was deleted, false if not found
   */
  deleteSession(id: string): boolean;

  // Context management
  /**
   * Stores context data for a session
   * @param sessionId - Session ID to associate context with
   * @param context - Context data object
   */
  setContext(sessionId: string, context: any): void;

  /**
   * Retrieves context data for a session
   * @param sessionId - Session ID to get context for
   * @returns The context object, or undefined if not found
   */
  getContext(sessionId: string): any;

  // Message handling
  /**
   * Sends a message to a session
   * @param sessionId - Session ID to send message to
   * @param message - Message object to send
   * @returns true if message was sent, false if session not found
   */
  sendMessage(sessionId: string, message: Message): boolean;

  /**
   * Processes all pending messages
   * @returns The number of messages processed
   */
  processMessages(): number;

  // Query methods
  /**
   * Retrieves all active sessions
   * @returns Array of all sessions
   */
  getAllSessions(): Session[];

  /**
   * Retrieves sessions of a specific type
   * @param type - Session type to filter by
   * @returns Array of matching sessions
   */
  getSessionsByType(type: SessionType): Session[];

  /**
   * Retrieves sessions with a specific status
   * @param status - Session status to filter by
   * @returns Array of matching sessions
   */
  getSessionsByStatus(status: string): Session[];

  /**
   * Retrieves sessions belonging to a workspace
   * @param workspace - Workspace identifier to filter by
   * @returns Array of matching sessions
   */
  getWorkspaceSessions(workspace: string): Session[];

  // Utilities
  /**
   * Gets the count of active sessions
   * @returns Number of active sessions
   */
  getSessionCount(): number;

  /**
   * Clears all sessions, contexts, and resets counters
   */
  clearAll(): void;

  /**
   * Performs health check with status assessment
   * @returns Health check result with status and details
   */
  healthCheck(): HealthCheckResult;

  /**
   * Exports all sessions to a serializable format
   * @returns Array of session objects suitable for serialization
   */
  exportSessions(): SessionExport[];

  /**
   * Imports sessions from an exported array
   * @param sessions - Array of session objects to import
   */
  importSessions(sessions: SessionExport[]): void;

  // Events
  /**
   * Registers a callback for session creation events
   * @param callback - Function to call when session is created
   */
  onSessionCreated(callback: (session: Session) => void): void;

  /**
   * Registers a callback for session update events
   * @param callback - Function to call when session is updated
   */
  onSessionUpdated(callback: (session: Session) => void): void;

  /**
   * Registers a callback for session deletion events
   * @param callback - Function to call when session is deleted
   */
  onSessionDeleted(callback: (session: Session) => void): void;

  /**
   * Registers a callback for message events
   * @param callback - Function to call when message is sent
   */
  onMessage(callback: (message: Message) => void): void;

  // Metrics
  /**
   * Gets current orchestrator metrics
   * @returns Metrics object with performance and usage statistics
   */
  getMetrics(): OrchestratorMetrics & Record<string, any>;
}

/**
 * Abstract base class with common orchestrator functionality
 *
 * Provides shared validation, event handling, and error handling for all orchestrator implementations.
 * Extend this class to create custom orchestrators with consistent behavior.
 *
 * @example
 * ```typescript
 * class MyOrchestrator extends AbstractOrchestrator {
 *   private sessions = new Map<string, Session>();
 *
 *   createSession(config: SessionConfig): Session {
 *     this.validateSessionConfig(config); // Use inherited validation
 *     // ... implementation
 *   }
 *   // ... implement other abstract methods
 * }
 * ```
 *
 * @remarks
 * - Implements BaseOrchestrator interface
 * - Provides protected methods for event handling
 * - Includes session configuration validation
 * - All abstract methods must be implemented by subclasses
 */
export abstract class AbstractOrchestrator implements BaseOrchestrator {
  /**
   * Event storage for the orchestrator
   *
   * Maps event names to sets of callback functions.
   * Uses Set for automatic deduplication of callbacks.
   *
   * @protected
   */
  protected events = new Map<string, Set<Function>>();

  /**
   * Validates session configuration according to security and format requirements
   *
   * @performance O(1) - String operations and regex validation
   * @param config - Session configuration to validate
   * @throws {Error} If configuration validation fails with descriptive message
   * @throws {Error} If session name is empty or exceeds 255 characters
   * @throws {Error} If workspace is empty or contains invalid characters
   * @throws {Error} If workspace contains path traversal characters (.. or ~)
   * @throws {Error} If workspace is an absolute path
   *
   * @example
   * ```typescript
   * this.validateSessionConfig({
   *   type: 'agent',
   *   name: 'My Session',
   *   workspace: 'team/project'
   * }); // Passes validation
   *
   * this.validateSessionConfig({
   *   type: 'agent',
   *   name: '../../../etc/passwd',
   *   workspace: 'malicious'
   * }); // Throws Error: Session name must be 255 characters or less
   * ```
   *
   * @remarks
   * Validation rules:
   * - Session name: 1-255 characters, non-empty
   * - Workspace: 1+ characters, relative path only
   * - Workspace characters: alphanumeric, hyphen, underscore, forward slash
   * - No path traversal: blocks .. and ~ characters
   * - No absolute paths: must not start with /
   *
   * @protected
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
   * Emits an event to all registered listeners
   *
   * @performance O(n) - n = number of registered callbacks for the event
   * @param event - Event name to emit
   * @param data - Data to pass to each callback function
   * @returns void
   *
   * @example
   * ```typescript
   * this.emit('session:created', session);
   * this.emit('error', { message: 'Operation failed' });
   * ```
   *
   * @remarks
   * - Calls all registered callbacks in Set iteration order
   * - No error handling - exceptions in callbacks propagate
   * - Returns early if no handlers are registered
   * - Synchronous execution (no async/await support)
   *
   * @protected
   */
  protected emit<T>(event: string, data: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Registers an event listener for a specific event
   *
   * @performance O(1) - Direct Map/Set operations
   * @param event - Event name to listen for
   * @param callback - Function to call when event is emitted
   * @returns void
   *
   * @example
   * ```typescript
   * this.on('session:created', (session) => {
   *   console.log('New session:', session.name);
   * });
   * ```
   *
   * @remarks
   * - Creates new Set for event if it doesn't exist
   * - Uses Set for automatic callback deduplication
   * - Same callback can only be registered once per event
   * - No unregister method - callbacks persist for orchestrator lifetime
   * - Generic type T enables type-safe callback data
   *
   * @protected
   */
  protected on<T>(event: string, callback: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  // Abstract methods that must be implemented by subclasses

  /**
   * Creates a new session with the provided configuration
   *
   * @param config - Session configuration object
   * @returns The newly created Session object
   * @throws {Error} If configuration validation fails
   *
   * @example
   * ```typescript
   * const session = orchestrator.createSession({
   *   type: 'agent',
   *   name: 'Code Assistant',
   *   workspace: 'team/backend',
   *   config: { model: 'claude-opus-4' }
   * });
   * ```
   */
  abstract createSession(config: SessionConfig): Session;

  /**
   * Retrieves a session by its unique identifier
   *
   * @param id - Unique session identifier
   * @returns The Session object if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const session = orchestrator.getSession('session-id-123');
   * if (session) {
   *   console.log(session.name);
   * }
   * ```
   */
  abstract getSession(id: string): Session | undefined;

  /**
   * Updates a session with the provided changes
   *
   * @param id - Unique session identifier
   * @param updates - Partial session object with fields to update
   * @returns The updated Session object if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const updated = orchestrator.updateSession('session-id-123', {
   *   status: 'paused',
   *   config: { newSetting: true }
   * });
   * ```
   */
  abstract updateSession(id: string, updates: Partial<Session>): Session | undefined;

  /**
   * Deletes a session and its associated data
   *
   * @param id - Unique session identifier
   * @returns true if session was deleted, false if not found
   *
   * @example
   * ```typescript
   * const deleted = orchestrator.deleteSession('session-id-123');
   * if (deleted) {
   *   console.log('Session deleted successfully');
   * }
   * ```
   */
  abstract deleteSession(id: string): boolean;

  /**
   * Stores context data for a session
   *
   * @param sessionId - Unique session identifier
   * @param context - Context data object (any structure)
   *
   * @example
   * ```typescript
   * orchestrator.setContext('session-id-123', {
   *   userPreferences: { theme: 'dark' },
   *   conversationHistory: []
   * });
   * ```
   */
  abstract setContext(sessionId: string, context: any): void;

  /**
   * Retrieves context data for a session
   *
   * @param sessionId - Unique session identifier
   * @returns The context object if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const context = orchestrator.getContext('session-id-123');
   * if (context) {
   *   console.log(context.userPreferences);
   * }
   * ```
   */
  abstract getContext(sessionId: string): any;

  /**
   * Sends a message to a session
   *
   * @param sessionId - Unique session identifier
   * @param message - Message object to send
   * @returns true if message was sent, false if session not found
   *
   * @example
   * ```typescript
   * const sent = orchestrator.sendMessage('session-id-123', {
   *   id: 'msg-1',
   *   type: 'user',
   *   content: 'Hello, AI!'
   * });
   * ```
   */
  abstract sendMessage(sessionId: string, message: Message): boolean;

  /**
   * Processes all pending messages
   *
   * @returns The number of messages processed
   *
   * @example
   * ```typescript
   * const processed = orchestrator.processMessages();
   * console.log(`Processed ${processed} messages`);
   * ```
   */
  abstract processMessages(): number;

  /**
   * Retrieves all active sessions
   *
   * @returns Array of all sessions
   *
   * @example
   * ```typescript
   * const allSessions = orchestrator.getAllSessions();
   * console.log(`Total sessions: ${allSessions.length}`);
   * ```
   */
  abstract getAllSessions(): Session[];

  /**
   * Retrieves sessions of a specific type
   *
   * @param type - Session type to filter by
   * @returns Array of matching sessions
   *
   * @example
   * ```typescript
   * const agents = orchestrator.getSessionsByType('agent');
   * console.log(`Active agents: ${agents.length}`);
   * ```
   */
  abstract getSessionsByType(type: SessionType): Session[];

  /**
   * Retrieves sessions with a specific status
   *
   * @param status - Session status to filter by
   * @returns Array of matching sessions
   *
   * @example
   * ```typescript
   * const active = orchestrator.getSessionsByStatus('active');
   * const failed = orchestrator.getSessionsByStatus('failed');
   * ```
   */
  abstract getSessionsByStatus(status: string): Session[];

  /**
   * Retrieves sessions belonging to a workspace
   *
   * @param workspace - Workspace identifier to filter by
   * @returns Array of matching sessions
   *
   * @example
   * ```typescript
   * const projectSessions = orchestrator.getWorkspaceSessions('team/backend');
   * console.log(`Backend sessions: ${projectSessions.length}`);
   * ```
   */
  abstract getWorkspaceSessions(workspace: string): Session[];

  /**
   * Gets the count of active sessions
   *
   * @returns Number of active sessions
   *
   * @example
   * ```typescript
   * const count = orchestrator.getSessionCount();
   * console.log(`Active sessions: ${count}`);
   * ```
   */
  abstract getSessionCount(): number;

  /**
   * Clears all sessions, contexts, and resets counters
   *
   * @example
   * ```typescript
   * orchestrator.clearAll();
   * console.log('All data cleared');
   * ```
   *
   * @warning This is a destructive operation that cannot be undone
   */
  abstract clearAll(): void;

  /**
   * Performs health check with status assessment
   *
   * @returns Health check result with status and details
   *
   * @example
   * ```typescript
   * const health = orchestrator.healthCheck();
   * if (health.status === 'healthy') {
   *   console.log('System is healthy');
   * } else {
   *   console.warn('Health status:', health.status, health.details);
   * }
   * ```
   */
  abstract healthCheck(): HealthCheckResult;

  /**
   * Exports all sessions to a serializable format
   *
   * @returns Array of session objects suitable for serialization
   *
   * @example
   * ```typescript
   * const exported = orchestrator.exportSessions();
   * const json = JSON.stringify(exported);
   * // Save to file or send over network
   * ```
   */
  abstract exportSessions(): SessionExport[];

  /**
   * Imports sessions from an exported array
   *
   * @param sessions - Array of session objects to import
   *
   * @example
   * ```typescript
   * const imported = JSON.parse(jsonString);
   * orchestrator.importSessions(imported);
   * ```
   */
  abstract importSessions(sessions: SessionExport[]): void;

  /**
   * Gets current orchestrator metrics
   *
   * @returns Metrics object with performance and usage statistics
   *
   * @example
   * ```typescript
   * const metrics = orchestrator.getMetrics();
   * console.log(`Active sessions: ${metrics.activeSessions}`);
   * console.log(`Memory usage: ${metrics.memoryUsage} bytes`);
   * ```
   */
  abstract getMetrics(): OrchestratorMetrics & Record<string, any>;

  // Event methods with inherited documentation from BaseOrchestrator interface

  /**
   * Registers a callback for session creation events
   *
   * @param callback - Function to call when a session is created
   *
   * @example
   * ```typescript
   * orchestrator.onSessionCreated((session) => {
   *   console.log('New session created:', session.name);
   * });
   * ```
   */
  onSessionCreated(callback: (session: Session) => void): void {
    this.on('session', callback);
  }

  /**
   * Registers a callback for session update events
   *
   * @param callback - Function to call when a session is updated
   *
   * @example
   * ```typescript
   * orchestrator.onSessionUpdated((session) => {
   *   console.log('Session updated:', session.name);
   * });
   * ```
   */
  onSessionUpdated(callback: (session: Session) => void): void {
    this.on('session:updated', callback);
  }

  /**
   * Registers a callback for session deletion events
   *
   * @param callback - Function to call when a session is deleted
   *
   * @example
   * ```typescript
   * orchestrator.onSessionDeleted((session) => {
   *   console.log('Session deleted:', session.name);
   * });
   * ```
   */
  onSessionDeleted(callback: (session: Session) => void): void {
    this.on('session:deleted', callback);
  }

  /**
   * Registers a callback for message events
   *
   * @param callback - Function to call when a message is sent
   *
   * @example
   * ```typescript
   * orchestrator.onMessage((message) => {
   *   console.log('Message sent:', message.content);
   * });
   * ```
   */
  onMessage(callback: (message: Message) => void): void {
    this.on('message', callback);
  }
}
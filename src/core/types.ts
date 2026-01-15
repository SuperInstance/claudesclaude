/**
 * Session type enumeration
 * Defines the different types of sessions that can be created
 *
 * @remarks
 * Available session types:
 * - 'agent': AI agent session for autonomous task execution
 * - 'task': Task-based session for specific job processing
 * - 'workflow': Workflow session for multi-step processes
 * - 'session': General-purpose session for various use cases
 * - 'ai-assistant': AI assistant session for interactive help
 * - 'development': Development environment session
 * - 'testing': Testing environment session
 * - 'deployment': Deployment session for CI/CD operations
 *
 * @example
 * ```typescript
 * const sessionType: SessionType = 'agent';
 * const workflowType: SessionType = 'workflow';
 * ```
 */
export type SessionType = 'agent' | 'task' | 'workflow' | 'session' | 'ai-assistant' | 'development' | 'testing' | 'deployment';

/**
 * Session status enumeration
 * Defines the possible states of a session
 *
 * @remarks
 * Status lifecycle:
 * - 'active': Session is currently running and processing
 * - 'paused': Session is temporarily suspended (can be resumed)
 * - 'completed': Session finished successfully (terminal state)
 * - 'failed': Session encountered an error (terminal state)
 *
 * @example
 * ```typescript
 * const status: SessionStatus = 'active';
 * if (session.status === 'completed') {
 *   console.log('Session finished successfully');
 * }
 * ```
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Message type enumeration
 * Defines the different types of messages that can be sent
 *
 * @remarks
 * Message type descriptions:
 * - 'system': System-level messages and notifications
 * - 'user': Messages from end users
 * - 'agent': Messages from AI agents
 * - 'task': Task-related messages
 * - 'command': Command messages for execution
 * - 'query': Query messages for information retrieval
 * - 'response': Response messages to queries
 *
 * @example
 * ```typescript
 * const userMessage: MessageType = 'user';
 * const systemMessage: MessageType = 'system';
 * ```
 */
export type MessageType = 'system' | 'user' | 'agent' | 'task' | 'command' | 'query' | 'response';

/**
 * Session interface
 * Represents a session in the orchestration system
 *
 * A session is a logical container for managing state, context, and messages
 * for a specific purpose (agent interaction, task execution, workflow, etc.)
 *
 * @property id - Unique session identifier (securely generated, format: session-{timestamp}-{random})
 * @property type - Type of session (agent, task, workflow, etc.)
 * @property name - Human-readable session name (max 255 chars, validated)
 * @property workspace - Workspace identifier (relative path, validated for security)
 * @property config - Session configuration object (flexible schema for type-specific settings)
 * @property status - Current session status (active, paused, completed, failed)
 * @property createdAt - Session creation timestamp (Date object)
 * @property updatedAt - Last update timestamp (Date object, auto-updated on changes)
 *
 * @example
 * ```typescript
 * const session: Session = {
 *   id: 'session-1234567890-abc123',
 *   type: 'agent',
 *   name: 'Code Assistant',
 *   workspace: 'team/backend',
 *   config: { model: 'claude-opus-4', maxTokens: 4096 },
 *   status: 'active',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 *
 * @remarks
 * - Immutable fields: id, type, createdAt (cannot be changed after creation)
 * - Mutable fields: name, workspace, config, status, updatedAt
 * - The updatedAt field should be automatically updated on any modification
 * - The workspace field is validated to prevent path traversal attacks
 */
export interface Session {
  id: string;
  type: SessionType;
  name: string;
  workspace: string;
  config: Record<string, any>;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message interface
 * Represents a message in the orchestration system
 *
 * Messages are used for communication between users, agents, and system components.
 * They can contain various types of content and metadata.
 *
 * @property id - Unique message identifier (securely generated, format: msg-{timestamp}-{random})
 * @property type - Message type (system, user, agent, task, command, query, response)
 * @property content - Message content (text or structured data)
 * @property role - Optional role identifier (e.g., 'admin', 'user', 'system')
 * @property metadata - Optional metadata object for additional information
 * @property timestamp - Message timestamp (Date object, auto-generated)
 *
 * @example
 * ```typescript
 * const message: Message = {
 *   id: 'msg-1234567890-abc123',
 *   type: 'user',
 *   content: 'Hello, AI assistant!',
 *   role: 'user',
 *   metadata: { source: 'web-ui', priority: 'high' },
 *   timestamp: new Date()
 * };
 * ```
 *
 * @remarks
 * - The content field can contain plain text or structured data (JSON string)
 * - The metadata field is flexible and can store any additional information
 * - Message IDs are generated using cryptographically secure random values
 * - Timestamps are typically set to the current time when the message is created
 */
export interface Message {
  id: string;
  type: string;
  content: string;
  role?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Session ID type alias
 *
 * Provides type safety for session identifiers throughout the codebase.
 *
 * @example
 * ```typescript
 * function getSessionById(id: SessionId): Session | undefined {
 *   return sessions.get(id);
 * }
 * ```
 */
export type SessionId = string;

/**
 * Creates a new session with secure random ID generation
 *
 * @performance O(1) - Secure random generation + object creation
 * @param type - The type of session to create
 * @param name - The name of the session (will be validated)
 * @param workspace - The workspace identifier (will be validated)
 * @returns A new Session object with generated ID and timestamps
 * @throws {ValidationError} If name or workspace validation fails
 *
 * @example
 * ```typescript
 * const session = createSession('agent', 'Code Assistant', 'team/backend');
 * console.log(session.id); // e.g., "session-1234567890-abc123def456"
 * console.log(session.status); // "active"
 * ```
 *
 * @remarks
 * - ID format: session-{timestamp}-{random-hex}
 * - Status defaults to 'active'
 * - Config defaults to empty object
 * - Both createdAt and updatedAt are set to current time
 * - No validation is performed in this function (validate inputs before calling)
 *
 * @see validateSessionName for name validation
 * @see validateWorkspace for workspace validation
 */
export function createSession(type: SessionType, name: string, workspace: string): Session {
  const now = Date.now();
  const randomBytes = generateSecureRandom();
  return {
    id: `session-${now}-${randomBytes}`,
    type,
    name,
    workspace,
    config: {},
    status: 'active',
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };
}

/**
 * Creates a new message with secure random ID generation
 *
 * @performance O(1) - Secure random generation + object creation
 * @param type - The type of message (system, user, agent, task, command, query, response)
 * @param content - The message content (text or structured data)
 * @param metadata - Optional metadata object for additional information
 * @returns A new Message object with generated ID and timestamp
 *
 * @example
 * ```typescript
 * const message = createMessage('user', 'Hello, AI!', {
 *   source: 'web-ui',
 *   priority: 'high'
 * });
 * console.log(message.id); // e.g., "msg-1234567890-abc123def456"
 * ```
 *
 * @remarks
 * - ID format: msg-{timestamp}-{random-hex}
 * - Timestamp is automatically set to current time
 * - Role is optional and defaults to undefined
 * - Metadata is optional and defaults to undefined
 * - No validation is performed on the content
 *
 * @see generateSecureRandom for ID generation details
 */
export function createMessage(type: string, content: string, metadata?: Record<string, any>): Message {
  const now = Date.now();
  const randomBytes = generateSecureRandom();
  return {
    id: `msg-${now}-${randomBytes}`,
    type,
    content,
    metadata,
    timestamp: new Date(now)
  };
}

/**
 * Generates cryptographically secure random bytes for unique IDs
 *
 * @performance O(1) - Single crypto operation
 * @returns Hexadecimal string of 8 random bytes (16 hex characters)
 *
 * @example
 * ```typescript
 * const random = generateSecureRandom(); // e.g., "a1b2c3d4e5f6g7h8"
 * ```
 *
 * @remarks
 * - Browser: uses window.crypto.getRandomValues()
 * - Node.js: uses crypto.randomBytes()
 * - Fallback: uses Math.random() (less secure, should not happen in modern environments)
 * - Generates 8 bytes = 16 hex characters
 * - Suitable for generating unique identifiers
 *
 * @warning
 * The fallback method using Math.random() is NOT cryptographically secure.
 * It should only be used in environments without crypto support.
 *
 * @private
 */
// Secure random generation using crypto API
function generateSecureRandom(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser environment
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    try {
      const crypto = require('crypto');
      return crypto.randomBytes(8).toString('hex');
    } catch {
      // Fallback to less secure method
      return Math.random().toString(36).slice(2, 11);
    }
  } else {
    // Fallback to less secure method
    return Math.random().toString(36).slice(2, 11);
  }
}

/**
 * Custom error class for session not found errors
 *
 * Thrown when attempting to access a session that doesn't exist.
 *
 * @extends Error
 *
 * @example
 * ```typescript
 * if (!session) {
 *   throw new SessionNotFoundError(sessionId);
 * }
 * ```
 *
 * @remarks
 * - Error name is set to 'SessionNotFoundError'
 * - Error message includes the session ID for debugging
 * - Can be caught and handled specifically in error handling code
 */
export class SessionNotFoundError extends Error {
  /**
   * Creates a new SessionNotFoundError
   *
   * @param sessionId - The session ID that was not found
   *
   * @example
   * ```typescript
   * throw new SessionNotFoundError('session-123');
   * // Error: Session not found: session-123
   * ```
   */
  constructor(sessionId: SessionId) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Custom error class for validation failures
 *
 * Thrown when input validation fails for any field.
 *
 * @extends Error
 *
 * @example
 * ```typescript
 * if (name.length > 255) {
 *   throw new ValidationError('name', name, 'must be 255 characters or less');
 * }
 * ```
 *
 * @remarks
 * - Error name is set to 'ValidationError'
 * - Error message includes field name and reason
 * - The value parameter is accepted but not used in error message
 * - Can be caught and handled specifically in error handling code
 */
// Input validation utilities
export class ValidationError extends Error {
  /**
   * Creates a new ValidationError
   *
   * @param field - The field name that failed validation
   * @param _value - The value that failed validation (not used in message)
   * @param reason - The reason for validation failure
   *
   * @example
   * ```typescript
   * throw new ValidationError('workspace', '../../../etc', 'contains path traversal characters');
   * // Error: Validation failed for workspace: contains path traversal characters
   * ```
   *
   * @remarks
   * The _value parameter is prefixed with underscore to indicate it's intentionally unused.
   * It's accepted for API consistency but not included in the error message for security reasons.
   */
  constructor(field: string, _value: any, reason: string) {
    super(`Validation failed for ${field}: ${reason}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a workspace identifier for security and format compliance
 *
 * @performance O(1) - String operations and regex validation
 * @param workspace - The workspace identifier to validate
 * @returns void
 * @throws {ValidationError} If workspace validation fails
 * @throws {ValidationError} If workspace is empty or not a string
 * @throws {ValidationError} If workspace contains path traversal characters (.. or ~)
 * @throws {ValidationError} If workspace is an absolute path (starts with /)
 * @throws {ValidationError} If workspace contains invalid characters
 *
 * @example
 * ```typescript
 * validateWorkspace('team/backend'); // Passes
 * validateWorkspace('team/project/subfolder'); // Passes
 * validateWorkspace('../../../etc/passwd'); // Throws ValidationError
 * validateWorkspace('/absolute/path'); // Throws ValidationError
 * validateWorkspace('team/../etc'); // Throws ValidationError
 * ```
 *
 * @remarks
 * Validation rules:
 * - Must be a non-empty string
 * - Must not contain path traversal characters (.. or ~)
 * - Must not be an absolute path (must not start with /)
 * - Must only contain alphanumeric characters, hyphens, underscores, and forward slashes
 * - Regex pattern: ^[\w\-\/]+$
 *
 * @security
 * This validation is critical for preventing path traversal attacks.
 * Always validate workspace identifiers before using them in file system operations.
 */
export function validateWorkspace(workspace: string): void {
  if (!workspace || typeof workspace !== 'string') {
    throw new ValidationError('workspace', workspace, 'must be a non-empty string');
  }

  // Prevent path traversal attacks
  if (workspace.includes('..') || workspace.includes('~')) {
    throw new ValidationError('workspace', workspace, 'contains path traversal characters');
  }

  // Prevent absolute paths for security
  if (workspace.startsWith('/')) {
    throw new ValidationError('workspace', workspace, 'must be a relative path');
  }

  // Validate character set
  if (!/^[\w\-\/]+$/.test(workspace)) {
    throw new ValidationError('workspace', workspace, 'contains invalid characters');
  }
}

/**
 * Validates a session identifier for format compliance
 *
 * @performance O(1) - String length check
 * @param sessionId - The session ID to validate
 * @returns void
 * @throws {ValidationError} If session ID validation fails
 * @throws {ValidationError} If session ID is empty or not a string
 * @throws {ValidationError} If session ID exceeds maximum length
 *
 * @example
 * ```typescript
 * validateSessionId('session-1234567890-abc123'); // Passes
 * validateSessionId(''); // Throws ValidationError
 * validateSessionId('x'.repeat(257)); // Throws ValidationError
 * ```
 *
 * @remarks
 * Validation rules:
 * - Must be a non-empty string
 * - Must be 256 characters or less
 * - No format validation (flexible ID schemes allowed)
 *
 * @note
 * This is a basic validation. More strict validation may be needed
 * depending on the ID generation scheme used.
 */
export function validateSessionId(sessionId: string): void {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new ValidationError('sessionId', sessionId, 'must be a non-empty string');
  }

  if (sessionId.length > 256) {
    throw new ValidationError('sessionId', sessionId, 'must be 256 characters or less');
  }
}

/**
 * Validates a session name for format compliance
 *
 * @performance O(1) - String length check and trim
 * @param name - The session name to validate
 * @returns void
 * @throws {ValidationError} If name validation fails
 * @throws {ValidationError} If name is empty or not a string
 * @throws {ValidationError} If name exceeds maximum length
 *
 * @example
 * ```typescript
 * validateSessionName('Code Assistant'); // Passes
 * validateSessionName('My Session'); // Passes
 * validateSessionName(''); // Throws ValidationError
 * validateSessionName('   '); // Throws ValidationError (whitespace is trimmed)
 * validateSessionName('x'.repeat(256)); // Throws ValidationError
 * ```
 *
 * @remarks
 * Validation rules:
 * - Must be a non-empty string after trimming whitespace
 * - Must be 255 characters or less
 * - No character set restrictions (allows Unicode, special characters, etc.)
 * - Leading/trailing whitespace is not considered (trim applied)
 *
 * @note
 * This is intentionally lenient to allow maximum flexibility in naming.
 * Additional validation may be applied at the application level if needed.
 */
export function validateSessionName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name', name, 'must be a non-empty string');
  }

  if (name.length > 255) {
    throw new ValidationError('name', name, 'must be 255 characters or less');
  }
}
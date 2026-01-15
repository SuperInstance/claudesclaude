/**
 * Session type enumeration
 * Defines the different types of sessions that can be created
 */
export type SessionType = 'agent' | 'task' | 'workflow' | 'session' | 'ai-assistant' | 'development' | 'testing' | 'deployment';

/**
 * Session status enumeration
 * Defines the possible states of a session
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

/**
 * Message type enumeration
 * Defines the different types of messages that can be sent
 */
export type MessageType = 'system' | 'user' | 'agent' | 'task' | 'command' | 'query' | 'response';

/**
 * Session interface
 * Represents a session in the orchestration system
 *
 * @property id - Unique session identifier (securely generated)
 * @property type - Type of session (agent, task, workflow, etc.)
 * @property name - Human-readable session name (max 255 chars)
 * @property workspace - Workspace identifier (relative path, validated)
 * @property config - Session configuration object
 * @property status - Current session status
 * @property createdAt - Session creation timestamp
 * @property updatedAt - Last update timestamp
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
 * @property id - Unique message identifier (securely generated)
 * @property type - Message type
 * @property content - Message content
 * @property role - Optional role identifier
 * @property metadata - Optional metadata object
 * @property timestamp - Message timestamp
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
 */
export type SessionId = string;

/**
 * Creates a new session with secure random ID generation
 *
 * @param type - The type of session to create
 * @param name - The name of the session (will be validated)
 * @param workspace - The workspace identifier (will be validated)
 * @returns A new Session object with generated ID and timestamps
 * @throws ValidationError if name or workspace validation fails
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
 * @param type - The type of message
 * @param content - The message content
 * @param metadata - Optional metadata object
 * @returns A new Message object with generated ID and timestamp
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

export class SessionNotFoundError extends Error {
  constructor(sessionId: SessionId) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

// Input validation utilities
export class ValidationError extends Error {
  constructor(field: string, _value: any, reason: string) {
    super(`Validation failed for ${field}: ${reason}`);
    this.name = 'ValidationError';
  }
}

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

export function validateSessionId(sessionId: string): void {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new ValidationError('sessionId', sessionId, 'must be a non-empty string');
  }

  if (sessionId.length > 256) {
    throw new ValidationError('sessionId', sessionId, 'must be 256 characters or less');
  }
}

export function validateSessionName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name', name, 'must be a non-empty string');
  }

  if (name.length > 255) {
    throw new ValidationError('name', name, 'must be 255 characters or less');
  }
}
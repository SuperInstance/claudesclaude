export type SessionType = 'agent' | 'task' | 'workflow' | 'session' | 'ai-assistant' | 'development' | 'testing' | 'deployment';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';
export type MessageType = 'system' | 'user' | 'agent' | 'task' | 'command' | 'query' | 'response';

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

export interface Message {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export type SessionId = string;

export function createSession(type: SessionType, name: string, workspace: string): Session {
  const now = Date.now();
  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 11)}`,
    type,
    name,
    workspace,
    config: {},
    status: 'active',
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };
}

export function createMessage(type: string, content: string, metadata?: Record<string, any>): Message {
  const now = Date.now();
  return {
    id: `msg-${now}-${Math.random().toString(36).slice(2, 11)}`,
    type,
    content,
    metadata,
    timestamp: new Date(now)
  };
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: SessionId) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}
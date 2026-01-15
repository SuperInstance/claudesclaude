/**
 * Mock types for testing purposes
 */

export enum SessionType {
  CHAT = 'chat',
  WORKFLOW = 'workflow',
  AGENT = 'agent'
}

export enum MessageType {
  TEXT = 'text',
  COMMAND = 'command',
  SYSTEM = 'system',
  ERROR = 'error'
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum SessionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WorkerTaskType {
  EXECUTE = 'execute',
  TRANSFORM = 'transform',
  VALIDATE = 'validate',
  ANALYZE = 'analyze'
}

export enum WorkerState {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error'
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high'
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum WorkerMessageType {
  TASK = 'task',
  RESULT = 'result',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

export class ValidationError extends Error {
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
  field?: string;
}

export class SessionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}

export class MessageTimeoutError extends Error {
  constructor(message: string, timeout: number) {
    super(`Message timeout after ${timeout}ms: ${message}`);
    this.name = 'MessageTimeoutError';
    this.timeout = timeout;
  }
  timeout: number;
}

export class CheckpointNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckpointNotFoundError';
  }
}

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreError';
  }
}

export class ContextNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextNotFoundError';
  }
}

export class ContextConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextConflictError';
  }
}

export class DepartmentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DepartmentNotFoundError';
  }
}

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export class OrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestrationError';
  }
}
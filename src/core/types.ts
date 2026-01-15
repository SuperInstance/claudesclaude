// Core types for the orchestration system

export type SessionType = 'ai-assistant' | 'development' | 'testing' | 'deployment' | 'director' | 'department' | 'observer';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';
export type MessageType = 'system' | 'user' | 'agent' | 'task' | 'command' | 'query' | 'response';
export type WorkflowStepType = 'initialize' | 'execute' | 'validate' | 'complete';
export type CheckpointType = 'auto' | 'manual' | 'scheduled';
export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

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
  source: string;
  target?: string;
  data: any;
  timestamp: Date;
}


export interface Checkpoint {
  id: string;
  sessionId: string;
  type: CheckpointType;
  name: string;
  data: any;
  createdAt: Date;
  expiresAt?: Date;
}

export interface Task {
  id: string;
  name: string;
  type: string;
  priority: number;
  payload: Record<string, any>;
  timeoutMs: number;
  retries: number;
  maxRetries: number;
}

export interface DepartmentConfig {
  id: string;
  name: string;
  domain: string;
  maxConcurrentTasks: number;
  taskTimeoutMs: number;
  enableAutoScaling: boolean;
  resourceLimits: {
    memory: number;
    cpu: number;
    disk: number;
  };
  capabilities: string[];
  constraints: string[];
}

export interface Department {
  id: string;
  name: string;
  type: SessionType;
  config: DepartmentConfig;
  sessions: Set<string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrchestrationError extends Error {
  code: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  sessionId?: string;
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  message: string;
  code: string;
}

export interface SecurityConfig {
  enableInputValidation: boolean;
  enableOutputSanitization: boolean;
  maxKeyLength: number;
  maxWorkspacePathLength: number;
  blockedKeyPatterns: string[];
  sensitiveDataFields: string[];
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

export function createMessage(type: string, data: any, source: string): Message {
  const now = Date.now();
  return {
    id: `msg-${now}-${Math.random().toString(36).slice(2, 11)}`,
    type,
    source,
    data,
    timestamp: new Date(now)
  };
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: SessionId) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class MessageTimeoutError extends Error {
  constructor(messageId: string, timeout: number) {
    super(`Message timeout: ${messageId} after ${timeout}ms`);
    this.name = 'MessageTimeoutError';
  }
}

export class WorkflowError extends Error {
  constructor(workflowId: string, message: string) {
    super(`Workflow error: ${workflowId} - ${message}`);
    this.name = 'WorkflowError';
  }
}



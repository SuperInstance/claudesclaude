/**
 * Core types for Multi-Session Orchestration Plugin
 * Defines all message types, session interfaces, and communication protocols
 */

import { v4 as uuidv4 } from 'uuid';

export enum SessionType {
  DIRECTOR = 'director',
  DEPARTMENT = 'department',
  OBSERVER = 'observer',
  ACTIVE = 'active'
}

export enum WorkflowStepType {
  EXECUTE = 'execute',
  VERIFY = 'verify',
  CHECKPOINT = 'checkpoint',
  ROLLBACK = 'rollback'
}

export enum MessageType {
  // Director → Department
  DIRECTION = 'direction',
  COMMAND = 'command',
  VERIFICATION_REQUEST = 'verification_request',
  MERGE_REQUEST = 'merge_request',

  // Department → Director
  STATUS_UPDATE = 'status_update',
  PROGRESS_REPORT = 'progress_report',
  COMPLETION_NOTIFICATION = 'completion_notification',
  BLOCKED_NOTIFICATION = 'blocked_notification',

  // Bidirectional
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  ACKNOWLEDGMENT = 'acknowledgment',

  // System
  SESSION_REGISTER = 'session_register',
  SESSION_DEREGISTER = 'session_deregister',
  CHECKPOINT_CREATE = 'checkpoint_create',
  CHECKPOINT_RESTORE = 'checkpoint_restore'
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum SessionStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  COMPLETED = 'completed',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

export interface Message {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  sender: SessionId;
  receiver?: SessionId;
  timestamp: Date;
  content: MessageContent;
  metadata: MessageMetadata;
  requiresResponse: boolean;
  responseDeadline?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface MessageContent {
  action?: string;
  data?: any;
  error?: ErrorContent;
  progress?: ProgressContent;
  checkpoint?: CheckpointContent;
  verification?: VerificationContent;
}

export interface MessageMetadata {
  traceId?: string;
  sessionId?: string;
  departmentId?: string;
  correlationId?: string;
  tags?: string[];
  [key: string]: any;
}

export interface ErrorContent {
  code: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
}

export interface ProgressContent {
  percentage: number;
  currentStep: string;
  totalSteps: number;
  estimatedTimeRemaining?: number;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  completed: boolean;
  timestamp?: Date;
}

export interface CheckpointContent {
  id: string;
  name: string;
  timestamp: Date;
  snapshot: any;
  branches: string[];
  metadata: Record<string, any>;
}

export interface VerificationContent {
  type: 'code' | 'integration' | 'security' | 'performance';
  result: 'pass' | 'fail' | 'warning';
  details: string;
  recommendations?: string[];
}

export interface Session {
  id: SessionId;
  type: SessionType;
  name: string;
  status: SessionStatus;
  branch: string;
  workspace: string;
  createdAt: Date;
  lastActivity: Date;
  capabilities: string[];
  constraints: string[];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  departmentDomain?: string;
  userId?: string;
  projectId?: string;
  version?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

export type SessionId = string;

export interface Department {
  id: string;
  name: string;
  domain: string;
  session: Session;
  isActive: boolean;
  currentTask?: string;
  completedTasks: string[];
  pendingMessages: Message[];
  performance: DepartmentPerformance;
}

export interface DepartmentPerformance {
  messagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastActivity: Date;
}

export interface Checkpoint {
  id: string;
  name: string;
  sessionId: SessionId;
  timestamp: Date;
  snapshot: SystemSnapshot;
  branches: string[];
  metadata: {
    feature?: string;
    priority?: string;
    author?: string;
    description?: string;
    tags: string[];
  };
  createdBy: SessionId;
  size: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  retentionExpiresAt?: Date;
  restoredFrom?: string;
}

export interface CheckpointSnapshot extends SystemSnapshot {}

export interface SystemSnapshot {
  timestamp: Date;
  sessions: SessionSnapshot[];
  messages: MessageSnapshot[];
  gitState: GitSnapshot;
  systemState: SystemStateSnapshot;
  context: ContextSnapshot;
}

export interface SessionSnapshot {
  id: string;
  name: string;
  type: string;
  status: string;
  branch: string | null;
  workspace: string;
  metadata: Record<string, any>;
  departments: DepartmentSnapshot[];
  lastActivity: Date;
  createdAt: Date;
}

export interface DepartmentSnapshot {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  currentTask: string | null;
  completedTasks: string[];
  pendingMessages: string[];
  performance: PerformanceSnapshot;
}

export interface PerformanceSnapshot {
  messagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastActivity: Date;
}

export interface MessageSnapshot {
  id: string;
  type: string;
  sender: string;
  receiver: string | null;
  content: any;
  timestamp: Date;
}

export interface GitSnapshot {
  currentBranch: string;
  headCommit: string;
  branches: string[];
  tags: string[];
  untrackedFiles: string[];
  modifiedFiles: string[];
  stagedFiles: string[];
  remotes: RemoteSnapshot[];
}

export interface RemoteSnapshot {
  name: string;
  url: string;
  connected: boolean;
  lastSync: Date | null;
}

export interface SystemStateSnapshot {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  activeConnections: number;
  uptime: number;
  loadAverage: number[];
  environment: string;
  version: string;
}

export interface ContextSnapshot {
  totalItems: number;
  windows: number;
  averageImportance: number;
  itemsByType: Record<string, number>;
  conflicts: number;
  knowledgeGraph: {
    nodes: number;
    edges: number;
    version: number;
  };
}

// Legacy interfaces - kept for backward compatibility
export interface GitState extends Omit<GitSnapshot, 'branches' | 'tags' | 'remotes'> {}
export interface SystemState extends Omit<SystemStateSnapshot, 'loadAverage' | 'environment' | 'version'> {}

// Legacy interfaces - kept for backward compatibility
export interface GitState extends Omit<GitSnapshot, 'branches' | 'tags' | 'remotes'> {}
export interface SystemState extends Omit<SystemStateSnapshot, 'loadAverage' | 'environment' | 'version'> {}

export interface SessionRegistry {
  sessions: Map<SessionId, Session>;
  departments: Map<string, Department>;
  checkpoints: Map<string, Checkpoint>;
  messageQueue: Message[];
  stats: RegistryStats;
}

export interface RegistryStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  totalCheckpoints: number;
  uptime: Date;
}

export interface VerificationRequest {
  target: SessionId;
  type: VerificationType;
  criteria: VerificationCriteria;
  timeout: number;
}

export enum VerificationType {
  CODE_QUALITY = 'code_quality',
  INTEGRATION = 'integration',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

export interface VerificationCriteria {
  rules: VerificationRule[];
  threshold: number;
  weight: number;
}

export interface VerificationRule {
  id: string;
  name: string;
  check: (target: any) => boolean;
  weight: number;
  description: string;
}

export interface GitOperation {
  type: 'checkout' | 'commit' | 'branch' | 'merge' | 'reset';
  branch?: string;
  message?: string;
  files?: string[];
  metadata?: Record<string, any>;
}

export interface MessageBus {
  publish(message: Message): Promise<void>;
  subscribe(subscriber: MessageSubscriber, filter?: MessageFilter): () => void;
  request(request: Message, timeout: number): Promise<Message>;
  acknowledge(messageId: string): Promise<void>;
  reject(messageId: string, reason: string): Promise<void>;
  getStats(): MessageBusStats;
}

export interface MessageSubscriber {
  id: string;
  callback: (message: Message) => Promise<void>;
  filter?: MessageFilter;
}

export interface MessageFilter {
  types?: MessageType[];
  priorities?: MessagePriority[];
  senders?: SessionId[];
  receivers?: SessionId[];
  tags?: string[];
}

export interface MessageBusStats {
  messagesPublished: number;
  messagesDelivered: number;
  messagesFailed: number;
  averageLatency: number;
  subscribers: number;
  queueSize: number;
}

export interface OrchestrationConfig {
  messageQueuePath: string;
  registryPath: string;
  checkpointPath: string;
  defaultTimeout: number;
  maxRetries: number;
  heartbeatInterval: number;
  maxSessions: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Error types
export class OrchestrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

export class ValidationError extends OrchestrationError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 'medium', true);
    this.field = field;
  }
  field?: string;
}

export class SessionNotFoundError extends OrchestrationError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 'high', false);
  }
}

export class MessageTimeoutError extends OrchestrationError {
  constructor(messageId: string, timeout: number) {
    super(`Message timeout: ${messageId} after ${timeout}ms`, 'MESSAGE_TIMEOUT', 'medium', true);
  }
}

export class CheckpointNotFoundError extends OrchestrationError {
  constructor(checkpointId: string) {
    super(`Checkpoint not found: ${checkpointId}`, 'CHECKPOINT_NOT_FOUND', 'high', false);
  }
}

export class RestoreError extends OrchestrationError {
  constructor(message: string, originalError?: Error) {
    super(message, 'RESTORE_ERROR', 'critical', false);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

// Helper functions
export const createMessage = (
  type: MessageType,
  sender: SessionId,
  content: MessageContent,
  receiver?: SessionId,
  priority: MessagePriority = MessagePriority.NORMAL
): Message => ({
  id: uuidv4(),
  type,
  priority,
  sender,
  receiver,
  timestamp: new Date(),
  content,
  metadata: {},
  requiresResponse: false,
  retryCount: 0,
  maxRetries: 3
});

export const createSession = (
  type: SessionType,
  name: string,
  workspace: string,
  metadata: SessionMetadata = {}
): Session => ({
  id: uuidv4(),
  type,
  name,
  status: SessionStatus.INITIALIZING,
  branch: `auto/${name}-${Date.now()}`,
  workspace,
  createdAt: new Date(),
  lastActivity: new Date(),
  capabilities: [],
  constraints: [],
  metadata
});

export const isExpired = (date: Date, ttlMs: number): boolean => {
  return Date.now() - date.getTime() > ttlMs;
};

export const isValidMessage = (message: Message): boolean => {
  return !!message.id &&
         !!message.type &&
         !!message.sender &&
         !!message.timestamp &&
         message.content !== undefined;
};

export const filterMessages = (messages: Message[], filter: MessageFilter): Message[] => {
  // Create a copy of the array to prevent modification of the original
  const result: Message[] = [];

  for (const message of messages) {
    if (filter.types && !filter.types.includes(message.type)) continue;
    if (filter.priorities && !filter.priorities.includes(message.priority)) continue;
    if (filter.senders && !filter.senders.includes(message.sender)) continue;
    if (filter.receivers && message.receiver && !filter.receivers.includes(message.receiver)) continue;
    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some(tag =>
        message.metadata.tags?.includes(tag) ||
        Object.keys(message.metadata).some(key =>
          key.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (!hasTag) continue;
    }
    result.push(message);
  }

  return result;
};

/**
 * Safely copies an array, removing any potentially dangerous properties
 */
export const safeArrayCopy = <T>(items: T[]): T[] => {
  return items.map(item => JSON.parse(JSON.stringify(item)));
};

/**
 * Validates and sanitizes array operations
 */
export const safeArrayOperation = <T>(
  operation: (items: T[]) => T[],
  items: T[],
  maxLength: number = 10000
): T[] => {
  // Check for excessively large arrays
  if (items.length > maxLength) {
    throw new Error(`Array size ${items.length} exceeds maximum allowed size ${maxLength}`);
  }

  // Create a safe copy before operations
  const safeCopy = safeArrayCopy(items);

  try {
    return operation(safeCopy);
  } catch (error) {
    throw new OrchestrationError(
      `Array operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ARRAY_OPERATION_ERROR',
      'high',
      false
    );
  }
};
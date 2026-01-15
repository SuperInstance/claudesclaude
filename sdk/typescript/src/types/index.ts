/**
 * Core types and interfaces for the Orchestration SDK
 */

// Export all types from the core system
export {
  SessionType,
  MessageType,
  MessagePriority,
  SessionStatus,
  WorkflowStepType,
  VerificationType,
  WorkerTaskType,
  WorkerState,
  TaskPriority,
  TaskStatus,
  WorkerMessageType
} from '../../claudesclaude/dist/src/core/types';

export {
  OrchestrationError,
  ValidationError,
  SessionNotFoundError,
  MessageTimeoutError,
  CheckpointNotFoundError,
  RestoreError,
  ContextNotFoundError,
  ContextConflictError,
  DepartmentNotFoundError,
  ExecutionError
} from '../../claudesclaude/dist/src/core/types';

// Message types
export interface Message {
  id: string;
  type: MessageType;
  priority: MessagePriority;
  sender: string;
  receiver?: string;
  timestamp: Date;
  content: any;
  metadata: Record<string, any>;
  requiresResponse?: boolean;
  responseDeadline?: Date;
  retryCount?: number;
  maxRetries?: number;
}

export interface MessageFilter {
  types?: MessageType[];
  priorities?: MessagePriority[];
  senders?: string[];
  receivers?: string[];
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

// Session types
export interface Session {
  id: string;
  type: SessionType;
  name: string;
  status: SessionStatus;
  branch: string;
  workspace: string;
  createdAt: Date;
  lastActivity: Date;
  capabilities: string[];
  constraints: string[];
  metadata: Record<string, any>;
}

export interface SessionData {
  type: SessionType;
  name: string;
  workspace: string;
  capabilities?: string[];
  constraints?: string[];
  metadata?: Record<string, any>;
}

export interface SessionFilter {
  where?: string;
  params?: any[];
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  pagination?: {
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
  };
}

// Department types
export interface Department {
  id: string;
  name: string;
  domain: string;
  sessionId: string;
  isActive: boolean;
  currentTask?: string;
  completedTasks: string[];
  pendingMessages: string[];
  performance: DepartmentPerformance;
}

export interface DepartmentPerformance {
  messagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastActivity: Date;
}

// Checkpoint types
export interface Checkpoint {
  id: string;
  name: string;
  sessionId: string;
  timestamp: Date;
  snapshot: any;
  branches: string[];
  metadata: CheckpointMetadata;
  createdBy: string;
  size: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  retentionExpiresAt?: Date;
  restoredFrom?: string;
}

export interface CheckpointMetadata {
  feature?: string;
  priority?: string;
  author?: string;
  description?: string;
  workflowId?: string;
  stepId?: string;
  tags: string[];
}

export interface CheckpointFilter {
  where?: string;
  params?: any[];
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  pagination?: {
    page?: number;
    pageSize?: number;
    offset?: number;
    limit?: number;
  };
}

// Worker types
export interface WorkerManagerConfig {
  minWorkers?: number;
  maxWorkers?: number;
  maxTaskQueueSize?: number;
  taskTimeout?: number;
  healthCheckInterval?: number;
  workerIdleTimeout?: number;
  maxWorkerMemory?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableAutoScaling?: boolean;
  enableHealthChecks?: boolean;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  backpressureThreshold?: number;
  maxTasksPerWorker?: number;
  workerRecycleThreshold?: number;
}

export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  payload: any;
  priority: TaskPriority;
  timeout: number;
  maxRetries: number;
  retryCount: number;
  status: TaskStatus;
  createdAt: Date;
  dependencies?: string[];
  metadata?: Record<string, any>;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  result?: any;
  error?: any;
}

export interface WorkerMetrics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  unhealthyWorkers: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  averageQueueTime: number;
  throughput: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

// Database types
export interface DatabaseConfig {
  path: string;
  enableFTS?: boolean;
  connectionPool?: {
    min?: number;
    max?: number;
    idleTimeout?: number;
  };
}

export interface DatabaseOperations {
  createSession(session: SessionData): Promise<Session>;
  bulkInsertSessions(sessions: SessionData[]): Promise<BulkOperationResult>;
  getSession(sessionId: string): Promise<Session | null>;
  getSessionsByType(type: SessionType, options?: SessionFilter): Promise<Session[]>;
  getSessionsByStatus(status: SessionStatus, options?: SessionFilter): Promise<Session[]>;
  getAllSessions(filter?: SessionFilter): Promise<Session[]>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean>;
  deleteSession(sessionId: string): Promise<boolean>;
  countSessionsByStatus(): Promise<Record<SessionStatus, number>>;
  searchSessions(searchTerm: string, limit?: number): Promise<Session[]>;

  createDepartment(department: Omit<Department, 'sessionId'> & { sessionId: string }): Promise<Department>;
  getDepartment(departmentId: string): Promise<Department | null>;
  getDepartmentsBySession(sessionId: string): Promise<Department[]>;
  getAllDepartments(filter?: CheckpointFilter): Promise<Department[]>;
  updateDepartment(departmentId: string, updates: Partial<Department>): Promise<boolean>;
  deleteDepartment(departmentId: string): Promise<boolean>;
  getDepartmentMetrics(departmentId: string): Promise<any>;

  createCheckpoint(checkpoint: Omit<Checkpoint, 'timestamp' | 'createdBy'> & {
    timestamp: Date;
    createdBy: string;
  }): Promise<Checkpoint>;
  getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
  getCheckpointsBySession(sessionId: string, filter?: CheckpointFilter): Promise<Checkpoint[]>;
  getAllCheckpoints(filter?: CheckpointFilter): Promise<Checkpoint[]>;
  getCheckpointsByFeature(feature: string): Promise<Checkpoint[]>;
  deleteCheckpoint(checkpointId: string): Promise<boolean>;
  deleteExpiredCheckpoints(): Promise<number>;
  searchCheckpoints(searchTerm: string, limit?: number): Promise<Checkpoint[]>;

  createMessage(message: Message): Promise<Message>;
  bulkInsertMessages(messages: Message[]): Promise<BulkOperationResult>;
  getMessagesBySender(senderId: string, filter?: CheckpointFilter): Promise<Message[]>;
  getMessagesByReceiver(receiverId: string, filter?: CheckpointFilter): Promise<Message[]>;
  getMessagesByType(type: MessageType, filter?: CheckpointFilter): Promise<Message[]>;
  getConversation(session1: string, session2: string, limit?: number): Promise<Message[]>;
  markMessageDelivered(messageId: string): Promise<boolean>;
  markMessageFailed(messageId: string, reason: string): Promise<boolean>;
  deleteOldMessages(daysOld?: number): Promise<number>;

  aggregate(table: string, column: string, func: string, filter?: any): Promise<any>;
  groupByAggregate(table: string, groupColumn: string, aggregateColumn: string, func: string, filter?: any): Promise<any[]>;
}

export interface BulkOperationResult {
  success: boolean;
  inserted: number;
  updated: number;
  deleted: number;
  failed: number;
  errors: string[];
}

// Config types
export interface OrchestrationConfig {
  database: DatabaseConfig;
  messageBus?: {
    queuePath?: string;
    maxQueueSize?: number;
    gcIntervalMs?: number;
  };
  workerManager?: WorkerManagerConfig;
  security?: {
    authMethod?: 'api_key' | 'jwt' | 'oauth2' | 'session' | 'certificate';
    apiKeyHeader?: string;
    jwtSecret?: string;
    sessionTimeout?: number;
    enableMultiFactor?: boolean;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableConsole?: boolean;
    enableFile?: boolean;
    filePath?: string;
  };
  monitoring?: {
    enableMetrics?: boolean;
    metricsInterval?: number;
    enableHealthChecks?: boolean;
    healthCheckInterval?: number;
  };
}

// Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    traceId?: string;
  };
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    timestamp: Date;
    uptime: number;
    memoryUsage: number;
    cpuUsage?: number;
    checks: {
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
    }[];
  };
}

// Event types
export interface EventListener<T = any> {
  (data: T): void;
}

export interface EventEmitter<T = any> {
  on(event: string, listener: EventListener<T>): void;
  off(event: string, listener: EventListener<T>): void;
  emit(event: string, data: T): void;
  once(event: string, listener: EventListener<T>): void;
  removeAllListeners(event?: string): void;
}
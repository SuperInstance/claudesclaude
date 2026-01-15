/**
 * Mock types for testing purposes
 */
export declare enum SessionType {
    CHAT = "chat",
    WORKFLOW = "workflow",
    AGENT = "agent"
}
export declare enum MessageType {
    TEXT = "text",
    COMMAND = "command",
    SYSTEM = "system",
    ERROR = "error"
}
export declare enum MessagePriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
export declare enum SessionStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum WorkerTaskType {
    EXECUTE = "execute",
    TRANSFORM = "transform",
    VALIDATE = "validate",
    ANALYZE = "analyze"
}
export declare enum WorkerState {
    IDLE = "idle",
    BUSY = "busy",
    ERROR = "error"
}
export declare enum TaskPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high"
}
export declare enum TaskStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum WorkerMessageType {
    TASK = "task",
    RESULT = "result",
    ERROR = "error",
    HEARTBEAT = "heartbeat"
}
export declare class ValidationError extends Error {
    constructor(message: string, field?: string);
    field?: string;
}
export declare class SessionNotFoundError extends Error {
    constructor(message: string);
}
export declare class MessageTimeoutError extends Error {
    constructor(message: string, timeout: number);
    timeout: number;
}
export declare class CheckpointNotFoundError extends Error {
    constructor(message: string);
}
export declare class RestoreError extends Error {
    constructor(message: string);
}
export declare class ContextNotFoundError extends Error {
    constructor(message: string);
}
export declare class ContextConflictError extends Error {
    constructor(message: string);
}
export declare class DepartmentNotFoundError extends Error {
    constructor(message: string);
}
export declare class ExecutionError extends Error {
    constructor(message: string);
}
export declare class OrchestrationError extends Error {
    constructor(message: string);
}

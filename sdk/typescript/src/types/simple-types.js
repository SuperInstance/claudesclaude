export var SessionType;
(function (SessionType) {
    SessionType["CHAT"] = "chat";
    SessionType["WORKFLOW"] = "workflow";
    SessionType["AGENT"] = "agent";
})(SessionType || (SessionType = {}));
export var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["COMMAND"] = "command";
    MessageType["SYSTEM"] = "system";
    MessageType["ERROR"] = "error";
})(MessageType || (MessageType = {}));
export var MessagePriority;
(function (MessagePriority) {
    MessagePriority["LOW"] = "low";
    MessagePriority["NORMAL"] = "normal";
    MessagePriority["HIGH"] = "high";
    MessagePriority["URGENT"] = "urgent";
})(MessagePriority || (MessagePriority = {}));
export var SessionStatus;
(function (SessionStatus) {
    SessionStatus["ACTIVE"] = "active";
    SessionStatus["PAUSED"] = "paused";
    SessionStatus["COMPLETED"] = "completed";
    SessionStatus["FAILED"] = "failed";
    SessionStatus["CANCELLED"] = "cancelled";
})(SessionStatus || (SessionStatus = {}));
export var WorkerTaskType;
(function (WorkerTaskType) {
    WorkerTaskType["EXECUTE"] = "execute";
    WorkerTaskType["TRANSFORM"] = "transform";
    WorkerTaskType["VALIDATE"] = "validate";
    WorkerTaskType["ANALYZE"] = "analyze";
})(WorkerTaskType || (WorkerTaskType = {}));
export var WorkerState;
(function (WorkerState) {
    WorkerState["IDLE"] = "idle";
    WorkerState["BUSY"] = "busy";
    WorkerState["ERROR"] = "error";
})(WorkerState || (WorkerState = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["NORMAL"] = "normal";
    TaskPriority["HIGH"] = "high";
})(TaskPriority || (TaskPriority = {}));
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (TaskStatus = {}));
export var WorkerMessageType;
(function (WorkerMessageType) {
    WorkerMessageType["TASK"] = "task";
    WorkerMessageType["RESULT"] = "result";
    WorkerMessageType["ERROR"] = "error";
    WorkerMessageType["HEARTBEAT"] = "heartbeat";
})(WorkerMessageType || (WorkerMessageType = {}));
export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
    field;
}
export class SessionNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SessionNotFoundError';
    }
}
export class MessageTimeoutError extends Error {
    constructor(message, timeout) {
        super(`Message timeout after ${timeout}ms: ${message}`);
        this.name = 'MessageTimeoutError';
        this.timeout = timeout;
    }
    timeout;
}
export class CheckpointNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CheckpointNotFoundError';
    }
}
export class RestoreError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RestoreError';
    }
}
export class ContextNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContextNotFoundError';
    }
}
export class ContextConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContextConflictError';
    }
}
export class DepartmentNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DepartmentNotFoundError';
    }
}
export class ExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExecutionError';
    }
}
export class OrchestrationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OrchestrationError';
    }
}
//# sourceMappingURL=simple-types.js.map
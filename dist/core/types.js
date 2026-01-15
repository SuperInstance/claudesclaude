export function createSession(type, name, workspace) {
    return {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        name,
        workspace,
        config: {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
    };
}
export function createMessage(type, data, source) {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        source,
        data,
        timestamp: new Date()
    };
}
export class SessionNotFoundError extends Error {
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`);
        this.name = 'SessionNotFoundError';
    }
}
export class MessageTimeoutError extends Error {
    constructor(messageId, timeout) {
        super(`Message timeout: ${messageId} after ${timeout}ms`);
        this.name = 'MessageTimeoutError';
    }
}
export class WorkflowError extends Error {
    constructor(workflowId, message) {
        super(`Workflow error: ${workflowId} - ${message}`);
        this.name = 'WorkflowError';
    }
}
//# sourceMappingURL=types.js.map
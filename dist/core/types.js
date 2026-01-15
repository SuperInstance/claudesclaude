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
export function createMessage(type, payload, source) {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload,
        timestamp: new Date(),
        source
    };
}
export class SessionNotFoundError extends Error {
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`);
        this.name = 'SessionNotFoundError';
    }
}
//# sourceMappingURL=types.js.map
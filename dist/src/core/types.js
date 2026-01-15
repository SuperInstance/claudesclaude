export function createSession(type, name, workspace) {
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
export function createMessage(type, content, metadata) {
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
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`);
        this.name = 'SessionNotFoundError';
    }
}
//# sourceMappingURL=types.js.map
export class UnifiedOrchestrator {
    sessions = new Map();
    contexts = new Map();
    events = new Map();
    async createSession(config) {
        const now = Date.now();
        const session = {
            id: crypto.randomUUID(),
            type: config.type,
            name: config.name,
            workspace: config.workspace,
            config: config.config || {},
            status: 'active',
            createdAt: new Date(now),
            updatedAt: new Date(now)
        };
        this.sessions.set(session.id, session);
        this.emit('session', session);
        return session;
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    updateSession(id, updates) {
        const session = this.sessions.get(id);
        if (session) {
            Object.assign(session, updates);
            session.updatedAt = new Date();
        }
    }
    deleteSession(id) {
        this.sessions.delete(id);
    }
    getContext(id) {
        return this.contexts.get(id);
    }
    setContext(id, context) {
        this.contexts.set(id, context);
    }
    getAllContexts() {
        return Array.from(this.contexts.values());
    }
    on(event, handler) {
        if (!this.events.has(event))
            this.events.set(event, []);
        this.events.get(event).push(handler);
    }
    emit(event, data) {
        const handlers = this.events.get(event);
        if (handlers)
            handlers.forEach(h => h(data));
    }
    getMetrics() {
        const sessions = this.getAllSessions();
        return {
            sessionCount: sessions.length,
            activeSessions: sessions.filter(s => s.status === 'active').length,
            averageResponseTime: 0
        };
    }
    publish(message) {
        const full = { ...message, id: crypto.randomUUID(), timestamp: new Date() };
        this.emit('message', full);
        return full;
    }
    subscribe(callback) {
        this.on('message', callback);
    }
    shutdown() {
        this.sessions.clear();
        this.contexts.clear();
        this.events.clear();
    }
}
export function createUnifiedOrchestrator() {
    return new UnifiedOrchestrator();
}
//# sourceMappingURL=unified.js.map
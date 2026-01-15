import { MessageBus } from './message-bus.js';
export class OrchestrationSystem {
    sessions = new Map();
    messageBus = new MessageBus();
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
    loadRegistry() {
        return Promise.resolve();
    }
    getAllCheckpoints() {
        return [];
    }
    shutdown() {
        this.sessions.clear();
    }
}
export function createRegistry() {
    return new OrchestrationSystem();
}
//# sourceMappingURL=registry.js.map
import { MessageBus } from './message-bus.js';
export class OrchestrationSystem {
    sessions = new Map();
    messageBusInstance;
    constructor() {
        this.messageBusInstance = new MessageBus();
    }
    get messageBus() {
        return this.messageBusInstance;
    }
    async createSession(config) {
        const session = {
            id: crypto.randomUUID(),
            type: config.type,
            name: config.name,
            workspace: config.workspace,
            config: config.config || {},
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
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
}
export function createRegistry() {
    return new OrchestrationSystem();
}
//# sourceMappingURL=registry.js.map
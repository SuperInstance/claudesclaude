class SimpleLRUCache {
    cache = new Map();
    maxSize;
    ttl;
    constructor(options) {
        this.maxSize = options.maxSize;
        this.ttl = options.ttl;
    }
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            for (const firstKey of this.cache.keys()) {
                this.cache.delete(firstKey);
                break;
            }
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item)
            return undefined;
        if (this.ttl && Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, {
            ...item,
            timestamp: Date.now()
        });
        return item.value;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    values() {
        return Array.from(this.cache.values()).map(item => item.value);
    }
    size() {
        return this.cache.size;
    }
}
class SimpleEvents {
    events = new Map();
    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(listener);
    }
    emit(event, data) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                }
                catch (e) {
                }
            });
        }
    }
    off(event, listener) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    }
}
class SimpleUUID {
    generate() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
export class StreamlinedOrchestrator {
    sessions = new SimpleLRUCache({ maxSize: 1000, ttl: 30 * 60 * 1000 });
    contexts = new SimpleLRUCache({ maxSize: 500, ttl: 60 * 60 * 1000 });
    messages = [];
    events = new SimpleEvents();
    uuid = new SimpleUUID();
    metrics = {
        totalSessions: 0,
        totalMessages: 0,
        memoryUsage: 0
    };
    createSession(config) {
        const sessionId = this.uuid.generate();
        const now = Date.now();
        const session = {
            id: sessionId,
            type: config.type,
            name: config.name,
            workspace: config.workspace,
            config: config.config || {},
            status: 'active',
            createdAt: new Date(now),
            updatedAt: new Date(now)
        };
        this.sessions.set(sessionId, session);
        this.events.emit('session', session);
        this.metrics.totalSessions++;
        return session;
    }
    getSession(id) {
        return this.sessions.get(id);
    }
    updateSession(id, updates) {
        const session = this.sessions.get(id);
        if (!session)
            return undefined;
        const updated = { ...session, ...updates, updatedAt: new Date() };
        this.sessions.set(id, updated);
        this.events.emit('session:updated', updated);
        return updated;
    }
    deleteSession(id) {
        const session = this.sessions.get(id);
        if (!session)
            return false;
        this.sessions.delete(id);
        this.events.emit('session:deleted', session);
        return true;
    }
    setContext(sessionId, context) {
        this.contexts.set(sessionId, context);
    }
    getContext(sessionId) {
        return this.contexts.get(sessionId);
    }
    sendMessage(sessionId, message) {
        if (!this.sessions.get(sessionId))
            return false;
        this.messages.push({ ...message, timestamp: new Date() });
        this.events.emit('message', message);
        this.metrics.totalMessages++;
        return true;
    }
    processMessages() {
        const count = this.messages.length;
        this.messages = [];
        return count;
    }
    getAllSessions() {
        return this.sessions.values();
    }
    getSessionsByType(type) {
        return this.getAllSessions().filter(s => s.type === type);
    }
    getSessionsByStatus(status) {
        return this.getAllSessions().filter(s => s.status === status);
    }
    getWorkspaceSessions(workspace) {
        return this.getAllSessions().filter(s => s.workspace === workspace);
    }
    getMetrics() {
        const sessionCount = this.sessions.size();
        const contextCount = this.contexts.size();
        this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;
        return {
            ...this.metrics,
            activeSessions: sessionCount,
            cachedContexts: contextCount,
            pendingMessages: this.messages.length
        };
    }
    getSessionCount() {
        return this.sessions.size();
    }
    clearAll() {
        this.sessions.clear();
        this.contexts.clear();
        this.messages = [];
        this.metrics.totalSessions = 0;
        this.metrics.totalMessages = 0;
        this.events.emit('sessions:cleared', undefined);
    }
    healthCheck() {
        const metrics = this.getMetrics();
        const memoryLimit = 100 * 1024 * 1024;
        if (metrics.memoryUsage > memoryLimit) {
            return { status: 'unhealthy', details: { memoryUsage: metrics.memoryUsage, limit: memoryLimit } };
        }
        if (metrics.activeSessions > 5000) {
            return { status: 'degraded', details: { activeSessions: metrics.activeSessions } };
        }
        return { status: 'healthy', details: metrics };
    }
    exportSessions() {
        return this.getAllSessions().map(s => ({
            id: s.id, type: s.type, name: s.name, workspace: s.workspace,
            config: s.config, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt
        }));
    }
    importSessions(sessions) {
        sessions.forEach(s => this.createSession({
            type: s.type, name: s.name, workspace: s.workspace, config: s.config
        }));
    }
    onSessionCreated(cb) { this.events.on('session', cb); }
    onSessionUpdated(cb) { this.events.on('session:updated', cb); }
    onSessionDeleted(cb) { this.events.on('session:deleted', cb); }
    onMessage(cb) { this.events.on('message', cb); }
}
export function createStreamlinedOrchestrator() {
    return new StreamlinedOrchestrator();
}
export const orchestrator = createStreamlinedOrchestrator();
//# sourceMappingURL=streamlined-orchestrator.js.map
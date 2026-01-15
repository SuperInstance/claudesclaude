import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionData, SessionStatus, SessionFilter, SessionType } from '../types';
import { Logger } from './simple-logger';
import { SimpleLRUCache, createSessionCache, MemoryMetrics } from './simple-lru-cache';
import { ValidationError, SessionNotFoundError } from '../types/simple-types';
export class OptimizedSessionManager extends EventEmitter {
    sessionCache;
    logger;
    metrics;
    options;
    cleanupInterval = null;
    weakReferenceSessions = new Set();
    constructor(options = {}) {
        super();
        this.options = {
            logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
            maxSessions: options.maxSessions || 1000,
            sessionTTL: options.sessionTTL || 30 * 60 * 1000,
            maxSize: options.maxSize || 50 * 1024 * 1024,
            enableAutoCleanup: options.enableAutoCleanup !== false,
            cleanupIntervalMs: options.cleanupIntervalMs || 5 * 60 * 1000,
            enableWeakReferences: options.enableWeakReferences || false
        };
        this.logger = this.options.logger.createChildLogger({ component: 'session-manager' });
        this.sessionCache = createSessionCache({
            max: this.options.maxSessions,
            ttl: this.options.sessionTTL,
            maxSize: this.options.maxSize
        });
        this.metrics = {
            totalSessions: 0,
            activeSessions: 0,
            memoryUsage: 0,
            cacheHits: 0,
            cacheMisses: 0,
            sessionsCreated: 0,
            sessionsDeleted: 0,
            sessionsExpired: 0,
            averageSessionSize: 0
        };
        this.setupEventHandlers();
        this.startAutoCleanup();
    }
    async createSession(sessionData) {
        const sessionId = uuidv4();
        const now = new Date();
        const session = {
            id: sessionId,
            type: sessionData.type,
            name: sessionData.name,
            status: SessionStatus.ACTIVE,
            branch: sessionData.workspace,
            workspace: sessionData.workspace,
            createdAt: now,
            lastActivity: now,
            capabilities: sessionData.capabilities || [],
            constraints: sessionData.constraints || [],
            metadata: sessionData.metadata || {}
        };
        this.sessionCache.set(sessionId, session, {
            size: this.calculateSessionSize(session),
        });
        if (this.options.enableWeakReferences) {
            this.weakReferenceSessions.add(sessionId);
        }
        this.metrics.sessionsCreated++;
        this.metrics.totalSessions++;
        this.metrics.activeSessions++;
        this.logger.debug('Session created', { sessionId, sessionType: session.type });
        this.emit('sessionCreated', session);
        return session;
    }
    async getSession(sessionId) {
        let session = this.sessionCache.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
            this.sessionCache.set(sessionId, session, {
                size: this.calculateSessionSize(session),
            });
            this.metrics.cacheHits++;
            return session;
        }
        this.metrics.cacheMisses++;
        this.logger.warn('Session not found in cache', { sessionId });
        return null;
    }
    async updateSession(sessionId, updates) {
        const session = this.sessionCache.get(sessionId);
        if (!session) {
            this.logger.warn('Session not found for update', { sessionId });
            return false;
        }
        const updatedSession = { ...session, ...updates, lastActivity: new Date() };
        this.sessionCache.set(sessionId, updatedSession, {
            size: this.calculateSessionSize(updatedSession),
        });
        this.logger.debug('Session updated', { sessionId });
        this.emit('sessionUpdated', updatedSession);
        return true;
    }
    async deleteSession(sessionId) {
        const deleted = this.sessionCache.delete(sessionId);
        if (deleted) {
            this.weakReferenceSessions.delete(sessionId);
            this.metrics.sessionsDeleted++;
            this.metrics.totalSessions--;
            this.metrics.activeSessions--;
            this.logger.debug('Session deleted', { sessionId });
            this.emit('sessionDeleted', { sessionId });
        }
        return deleted;
    }
    async getSessionsByStatus(status, options) {
        const sessions = [];
        for (const session of this.sessionCache.values()) {
            if (session.status === status) {
                sessions.push(session);
            }
        }
        return this.applySessionFilters(sessions, options);
    }
    async getActiveSessions() {
        const sessions = [];
        for (const session of this.sessionCache.values()) {
            if (session.status === SessionStatus.ACTIVE) {
                sessions.push(session);
            }
        }
        return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    }
    async getSessionsByType(type, options) {
        const sessions = [];
        for (const session of this.sessionCache.values()) {
            if (session.type === type) {
                sessions.push(session);
            }
        }
        return this.applySessionFilters(sessions, options);
    }
    async searchSessions(searchTerm, limit = 50) {
        const sessions = [];
        const term = searchTerm.toLowerCase();
        for (const session of this.sessionCache.values()) {
            if (session.name.toLowerCase().includes(term) ||
                session.workspace.toLowerCase().includes(term) ||
                session.id.toLowerCase().includes(term) ||
                session.type.toLowerCase().includes(term)) {
                sessions.push(session);
            }
        }
        return sessions
            .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
            .slice(0, limit);
    }
    async countSessionsByStatus() {
        const counts = {
            [SessionStatus.ACTIVE]: 0,
            [SessionStatus.PAUSED]: 0,
            [SessionStatus.COMPLETED]: 0,
            [SessionStatus.FAILED]: 0,
            [SessionStatus.CANCELLED]: 0
        };
        for (const session of this.sessionCache.values()) {
            counts[session.status]++;
        }
        return counts;
    }
    async cleanupExpiredSessions() {
        let cleanedCount = 0;
        const now = Date.now();
        const sessionTTL = this.options.sessionTTL;
        const sessions = [];
        for (const sessionId of Array.from(this.sessionCache.keys)) {
            const session = this.sessionCache.get(sessionId);
            if (session) {
                sessions.push([sessionId, session]);
            }
        }
        for (const [sessionId, session] of sessions) {
            if (now - session.lastActivity.getTime() > sessionTTL) {
                await this.deleteSession(sessionId);
                cleanedCount++;
                this.metrics.sessionsExpired++;
            }
        }
        if (cleanedCount > 0) {
            this.metrics.lastCleanup = new Date();
            this.logger.info('Expired sessions cleaned up', { count: cleanedCount });
            this.emit('sessionsCleaned', { count: cleanedCount });
        }
        return cleanedCount;
    }
    getMetrics() {
        const cacheMetrics = this.sessionCache.getMemoryMetrics();
        return {
            ...this.metrics,
            memoryUsage: cacheMetrics.totalMemoryBytes,
            averageSessionSize: this.metrics.totalSessions > 0
                ? cacheMetrics.totalMemoryBytes / this.metrics.totalSessions
                : 0
        };
    }
    getCacheStats() {
        return this.sessionCache.getStats();
    }
    getMemoryMetrics() {
        return this.sessionCache.getMemoryMetrics();
    }
    updateSessionCacheSettings(options) {
        if (options.maxSessions !== undefined) {
            this.sessionCache.resize(options.maxSessions);
            this.options.maxSessions = options.maxSessions;
        }
        if (options.sessionTTL !== undefined) {
            this.sessionCache = createSessionCache({
                max: this.options.maxSessions,
                ttl: options.sessionTTL,
                maxSize: this.options.maxSize
            });
            this.options.sessionTTL = options.sessionTTL;
        }
        if (options.maxSize !== undefined) {
            this.sessionCache.setMemoryLimit(options.maxSize);
            this.options.maxSize = options.maxSize;
        }
        this.logger.info('Session cache settings updated', options);
    }
    cleanupWeakReferences() {
        const disposed = this.sessionCache.disposeWeakReferences();
        this.logger.info('Weak reference sessions cleaned up', { count: disposed });
        return disposed;
    }
    get cacheSize() {
        return this.sessionCache.size;
    }
    async clearAllSessions() {
        this.sessionCache.clear();
        this.weakReferenceSessions.clear();
        this.metrics.totalSessions = 0;
        this.metrics.activeSessions = 0;
        this.logger.info('All sessions cleared');
        this.emit('sessionsCleared');
    }
    setupEventHandlers() {
    }
    startAutoCleanup() {
        if (this.options.enableAutoCleanup) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupExpiredSessions().catch(error => {
                    this.logger.error('Auto cleanup failed', error);
                });
            }, this.options.cleanupIntervalMs);
        }
    }
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    calculateSessionSize(session) {
        const metadataSize = JSON.stringify(session.metadata).length;
        const capabilitiesSize = session.capabilities.join(',').length;
        const constraintsSize = session.constraints.join(',').length;
        const nameSize = session.name.length;
        return (256 +
            metadataSize +
            capabilitiesSize +
            constraintsSize +
            nameSize +
            32);
    }
    applySessionFilters(sessions, options) {
        let filtered = sessions;
        if (options?.where) {
            filtered = sessions.filter(session => {
                const searchTerm = options.where?.toLowerCase();
                return (session.name.toLowerCase().includes(searchTerm) ||
                    session.workspace.toLowerCase().includes(searchTerm) ||
                    session.type.toLowerCase().includes(searchTerm));
            });
        }
        if (options?.pagination) {
            const { page = 1, pageSize = 10, limit } = options.pagination;
            const effectiveLimit = limit || pageSize;
            const offset = (page - 1) * effectiveLimit;
            filtered = filtered.slice(offset, offset + effectiveLimit);
        }
        return filtered;
    }
    async shutdown() {
        this.stopAutoCleanup();
        this.sessionCache.clear();
        this.logger.info('Session manager shutdown complete');
        this.emit('shutdown');
    }
}
export default OptimizedSessionManager;
//# sourceMappingURL=session-manager.js.map
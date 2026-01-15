"use strict";
/**
 * Streamlined Orchestrator - Ultra-Simplified High-Performance Implementation
 * Consolidates all functionality into a single optimized class
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrator = exports.StreamlinedOrchestrator = void 0;
exports.createStreamlinedOrchestrator = createStreamlinedOrchestrator;
// Simple LRU cache
var SimpleLRUCache = /** @class */ (function () {
    function SimpleLRUCache(options) {
        this.cache = new Map();
        this.maxSize = options.maxSize;
        this.ttl = options.ttl;
    }
    SimpleLRUCache.prototype.set = function (key, value) {
        if (this.cache.size >= this.maxSize) {
            for (var _i = 0, _a = this.cache.keys(); _i < _a.length; _i++) {
                var firstKey = _a[_i];
                this.cache.delete(firstKey);
                break;
            }
        }
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    };
    SimpleLRUCache.prototype.get = function (key) {
        var item = this.cache.get(key);
        if (!item)
            return undefined;
        if (this.ttl && Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        this.cache.delete(key);
        this.cache.set(key, __assign(__assign({}, item), { timestamp: Date.now() }));
        return item.value;
    };
    SimpleLRUCache.prototype.delete = function (key) {
        return this.cache.delete(key);
    };
    SimpleLRUCache.prototype.clear = function () {
        this.cache.clear();
    };
    SimpleLRUCache.prototype.values = function () {
        return Array.from(this.cache.values()).map(function (item) { return item.value; });
    };
    SimpleLRUCache.prototype.size = function () {
        return this.cache.size;
    };
    return SimpleLRUCache;
}());
// Simple event system
var SimpleEvents = /** @class */ (function () {
    function SimpleEvents() {
        this.events = new Map();
    }
    SimpleEvents.prototype.on = function (event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(listener);
    };
    SimpleEvents.prototype.emit = function (event, data) {
        var listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(function (listener) {
                try {
                    listener(data);
                }
                catch (e) {
                    // Silently ignore errors
                }
            });
        }
    };
    SimpleEvents.prototype.off = function (event, listener) {
        var listeners = this.events.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    };
    return SimpleEvents;
}());
// Simple UUID generator
var SimpleUUID = /** @class */ (function () {
    function SimpleUUID() {
    }
    SimpleUUID.prototype.generate = function () {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };
    return SimpleUUID;
}());
// Streamlined orchestrator
var StreamlinedOrchestrator = /** @class */ (function () {
    function StreamlinedOrchestrator() {
        this.sessions = new SimpleLRUCache({ maxSize: 1000, ttl: 30 * 60 * 1000 });
        this.contexts = new SimpleLRUCache({ maxSize: 500, ttl: 60 * 60 * 1000 });
        this.messages = [];
        this.events = new SimpleEvents();
        this.uuid = new SimpleUUID();
        this.metrics = {
            totalSessions: 0,
            totalMessages: 0,
            memoryUsage: 0
        };
    }
    // Create session
    StreamlinedOrchestrator.prototype.createSession = function (config) {
        var sessionId = this.uuid.generate();
        var now = Date.now();
        var session = {
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
    };
    // Get session
    StreamlinedOrchestrator.prototype.getSession = function (id) {
        return this.sessions.get(id);
    };
    // Update session
    StreamlinedOrchestrator.prototype.updateSession = function (id, updates) {
        var session = this.sessions.get(id);
        if (!session)
            return undefined;
        var updated = __assign(__assign(__assign({}, session), updates), { updatedAt: new Date() });
        this.sessions.set(id, updated);
        this.events.emit('session:updated', updated);
        return updated;
    };
    // Delete session
    StreamlinedOrchestrator.prototype.deleteSession = function (id) {
        var session = this.sessions.get(id);
        if (!session)
            return false;
        this.sessions.delete(id);
        this.events.emit('session:deleted', session);
        return true;
    };
    // Context management
    StreamlinedOrchestrator.prototype.setContext = function (sessionId, context) {
        this.contexts.set(sessionId, context);
    };
    StreamlinedOrchestrator.prototype.getContext = function (sessionId) {
        return this.contexts.get(sessionId);
    };
    // Message handling
    StreamlinedOrchestrator.prototype.sendMessage = function (sessionId, message) {
        if (!this.sessions.get(sessionId))
            return false;
        this.messages.push(__assign(__assign({}, message), { timestamp: new Date() }));
        this.events.emit('message', message);
        this.metrics.totalMessages++;
        return true;
    };
    StreamlinedOrchestrator.prototype.processMessages = function () {
        var count = this.messages.length;
        this.messages = [];
        return count;
    };
    // Query methods
    StreamlinedOrchestrator.prototype.getAllSessions = function () {
        return this.sessions.values();
    };
    StreamlinedOrchestrator.prototype.getSessionsByType = function (type) {
        return this.getAllSessions().filter(function (s) { return s.type === type; });
    };
    StreamlinedOrchestrator.prototype.getSessionsByStatus = function (status) {
        return this.getAllSessions().filter(function (s) { return s.status === status; });
    };
    StreamlinedOrchestrator.prototype.getWorkspaceSessions = function (workspace) {
        return this.getAllSessions().filter(function (s) { return s.workspace === workspace; });
    };
    // Metrics
    StreamlinedOrchestrator.prototype.getMetrics = function () {
        var sessionCount = this.sessions.size();
        var contextCount = this.contexts.size();
        this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;
        return __assign(__assign({}, this.metrics), { activeSessions: sessionCount, cachedContexts: contextCount, pendingMessages: this.messages.length });
    };
    // Utility methods
    StreamlinedOrchestrator.prototype.getSessionCount = function () {
        return this.sessions.size();
    };
    StreamlinedOrchestrator.prototype.clearAll = function () {
        this.sessions.clear();
        this.contexts.clear();
        this.messages = [];
        this.metrics.totalSessions = 0;
        this.metrics.totalMessages = 0;
        this.events.emit('sessions:cleared', undefined);
    };
    StreamlinedOrchestrator.prototype.healthCheck = function () {
        var metrics = this.getMetrics();
        var memoryLimit = 100 * 1024 * 1024; // 100MB
        if (metrics.memoryUsage > memoryLimit) {
            return { status: 'unhealthy', details: { memoryUsage: metrics.memoryUsage, limit: memoryLimit } };
        }
        if (metrics.activeSessions > 5000) {
            return { status: 'degraded', details: { activeSessions: metrics.activeSessions } };
        }
        return { status: 'healthy', details: metrics };
    };
    StreamlinedOrchestrator.prototype.exportSessions = function () {
        return this.getAllSessions().map(function (s) { return ({
            id: s.id, type: s.type, name: s.name, workspace: s.workspace,
            config: s.config, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt
        }); });
    };
    StreamlinedOrchestrator.prototype.importSessions = function (sessions) {
        var _this = this;
        sessions.forEach(function (s) { return _this.createSession({
            type: s.type, name: s.name, workspace: s.workspace, config: s.config
        }); });
    };
    // Event subscriptions
    StreamlinedOrchestrator.prototype.onSessionCreated = function (cb) { this.events.on('session', cb); };
    StreamlinedOrchestrator.prototype.onSessionUpdated = function (cb) { this.events.on('session:updated', cb); };
    StreamlinedOrchestrator.prototype.onSessionDeleted = function (cb) { this.events.on('session:deleted', cb); };
    StreamlinedOrchestrator.prototype.onMessage = function (cb) { this.events.on('message', cb); };
    return StreamlinedOrchestrator;
}());
exports.StreamlinedOrchestrator = StreamlinedOrchestrator;
// Factory function
function createStreamlinedOrchestrator() {
    return new StreamlinedOrchestrator();
}
// Default instance
exports.orchestrator = createStreamlinedOrchestrator();

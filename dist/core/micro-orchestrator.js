"use strict";
/**
 * Micro Orchestrator - Maximum Performance Implementation
 * Eliminates all abstractions and optimizations for extreme performance
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
exports.microOrchestrator = exports.MicroOrchestrator = void 0;
exports.createMicroOrchestrator = createMicroOrchestrator;
// Ultra-fast utilities - inline functions instead of classes
var generateUUID = function () { return Date.now().toString(36) + Math.random().toString(36).substr(2); };
var now = function () { return Date.now(); };
// Micro-cache - minimal LRU implementation
var MicroCache = /** @class */ (function () {
    function MicroCache(maxSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    MicroCache.prototype.set = function (key, value) {
        if (this.cache.size >= this.maxSize) {
            for (var _i = 0, _a = this.cache.keys(); _i < _a.length; _i++) {
                var firstKey = _a[_i];
                this.cache.delete(firstKey);
                break;
            }
        }
        this.cache.set(key, value);
    };
    MicroCache.prototype.get = function (key) {
        var value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    };
    MicroCache.prototype.delete = function (key) {
        return this.cache.delete(key);
    };
    MicroCache.prototype.clear = function () {
        this.cache.clear();
    };
    MicroCache.prototype.values = function () {
        return Array.from(this.cache.values());
    };
    MicroCache.prototype.size = function () {
        return this.cache.size;
    };
    return MicroCache;
}());
// Micro-events - ultra-simple event system
var MicroEvents = /** @class */ (function () {
    function MicroEvents() {
        this.events = new Map();
    }
    MicroEvents.prototype.on = function (event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(listener);
    };
    MicroEvents.prototype.emit = function (event, data) {
        var listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(function (listener) { return listener(data); });
        }
    };
    MicroEvents.prototype.off = function (event, listener) {
        var listeners = this.events.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    };
    return MicroEvents;
}());
// Micro-orchestrator - maximum performance
var MicroOrchestrator = /** @class */ (function () {
    function MicroOrchestrator() {
        this.sessions = new MicroCache(1000);
        this.contexts = new MicroCache(500);
        this.messages = [];
        this.events = new MicroEvents();
        this.metrics = {
            totalSessions: 0,
            totalMessages: 0,
            memoryUsage: 0
        };
    }
    // Optimized session creation
    MicroOrchestrator.prototype.createSession = function (config) {
        var sessionId = generateUUID();
        var timestamp = now();
        var session = {
            id: sessionId,
            type: config.type,
            name: config.name,
            workspace: config.workspace,
            config: config.config || {},
            status: 'active',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp)
        };
        this.sessions.set(sessionId, session);
        this.events.emit('session', session);
        this.metrics.totalSessions++;
        return session;
    };
    // Optimized session retrieval
    MicroOrchestrator.prototype.getSession = function (id) {
        return this.sessions.get(id);
    };
    // Optimized session update
    MicroOrchestrator.prototype.updateSession = function (id, updates) {
        var session = this.sessions.get(id);
        if (!session)
            return undefined;
        var updated = __assign(__assign(__assign({}, session), updates), { updatedAt: new Date() });
        this.sessions.set(id, updated);
        this.events.emit('session:updated', updated);
        return updated;
    };
    // Optimized session deletion
    MicroOrchestrator.prototype.deleteSession = function (id) {
        var session = this.sessions.get(id);
        if (!session)
            return false;
        this.sessions.delete(id);
        this.events.emit('session:deleted', session);
        return true;
    };
    // Context management - optimized
    MicroOrchestrator.prototype.setContext = function (sessionId, context) {
        this.contexts.set(sessionId, context);
    };
    MicroOrchestrator.prototype.getContext = function (sessionId) {
        return this.contexts.get(sessionId);
    };
    // Optimized message handling
    MicroOrchestrator.prototype.sendMessage = function (sessionId, message) {
        if (!this.sessions.get(sessionId))
            return false;
        this.messages.push(__assign(__assign({}, message), { timestamp: new Date() }));
        this.events.emit('message', message);
        this.metrics.totalMessages++;
        return true;
    };
    // Batch message processing
    MicroOrchestrator.prototype.processMessages = function () {
        var count = this.messages.length;
        this.messages = [];
        return count;
    };
    // Optimized query methods
    MicroOrchestrator.prototype.getAllSessions = function () {
        return this.sessions.values();
    };
    MicroOrchestrator.prototype.getSessionsByType = function (type) {
        return this.getAllSessions().filter(function (s) { return s.type === type; });
    };
    MicroOrchestrator.prototype.getSessionsByStatus = function (status) {
        return this.getAllSessions().filter(function (s) { return s.status === status; });
    };
    MicroOrchestrator.prototype.getWorkspaceSessions = function (workspace) {
        return this.getAllSessions().filter(function (s) { return s.workspace === workspace; });
    };
    // Optimized metrics
    MicroOrchestrator.prototype.getMetrics = function () {
        var sessionCount = this.sessions.size();
        var contextCount = this.contexts.size();
        this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;
        return __assign(__assign({}, this.metrics), { activeSessions: sessionCount, cachedContexts: contextCount, pendingMessages: this.messages.length });
    };
    // Utility methods
    MicroOrchestrator.prototype.getSessionCount = function () {
        return this.sessions.size();
    };
    MicroOrchestrator.prototype.clearAll = function () {
        this.sessions.clear();
        this.contexts.clear();
        this.messages = [];
        this.metrics.totalSessions = 0;
        this.metrics.totalMessages = 0;
        this.events.emit('sessions:cleared', undefined);
    };
    MicroOrchestrator.prototype.healthCheck = function () {
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
    MicroOrchestrator.prototype.exportSessions = function () {
        return this.getAllSessions().map(function (s) { return ({
            id: s.id, type: s.type, name: s.name, workspace: s.workspace,
            config: s.config, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt
        }); });
    };
    MicroOrchestrator.prototype.importSessions = function (sessions) {
        var _this = this;
        sessions.forEach(function (s) { return _this.createSession({
            type: s.type, name: s.name, workspace: s.workspace, config: s.config
        }); });
    };
    // Event subscriptions - optimized
    MicroOrchestrator.prototype.onSessionCreated = function (cb) { this.events.on('session', cb); };
    MicroOrchestrator.prototype.onSessionUpdated = function (cb) { this.events.on('session:updated', cb); };
    MicroOrchestrator.prototype.onSessionDeleted = function (cb) { this.events.on('session:deleted', cb); };
    MicroOrchestrator.prototype.onMessage = function (cb) { this.events.on('message', cb); };
    return MicroOrchestrator;
}());
exports.MicroOrchestrator = MicroOrchestrator;
// Factory function
function createMicroOrchestrator() {
    return new MicroOrchestrator();
}
// Default instance
exports.microOrchestrator = createMicroOrchestrator();

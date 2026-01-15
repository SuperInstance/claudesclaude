// src/core/hot-path-orchestrator.ts
var SESSION_CACHE_SIZE = 500;
var CONTEXT_CACHE_SIZE = 250;
var fastUUID = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
var fastNow = () => new Date;
class HotPathCache {
  cache = new Map;
  hotKeys = new Set;
  maxSize;
  constructor(maxSize) {
    this.maxSize = maxSize;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      for (const cacheKey of this.cache.keys()) {
        if (!this.hotKeys.has(cacheKey)) {
          this.cache.delete(cacheKey);
          break;
        }
      }
    }
    this.cache.set(key, value);
    this.hotKeys.add(key);
  }
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hotKeys.add(key);
      return value;
    }
    return;
  }
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.hotKeys.delete(key);
    }
    return deleted;
  }
  clear() {
    this.cache.clear();
    this.hotKeys.clear();
  }
  values() {
    return Array.from(this.cache.values());
  }
  size() {
    return this.cache.size;
  }
}

class HotPathEvents {
  listeners = new Map;
  listenerCache = new Map;
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  emit(event, data) {
    const cached = this.listenerCache.get(event);
    if (cached) {
      for (let i = 0;i < cached.length; i++) {
        cached[i](data);
      }
      return;
    }
    const listeners = this.listeners.get(event);
    if (listeners) {
      this.listenerCache.set(event, listeners);
      for (let i = 0;i < listeners.length; i++) {
        listeners[i](data);
      }
    }
  }
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      this.listenerCache.delete(event);
    }
  }
}

class HotPathOrchestrator {
  sessionCache = new HotPathCache(SESSION_CACHE_SIZE);
  contextCache = new HotPathCache(CONTEXT_CACHE_SIZE);
  messageList = [];
  events = new HotPathEvents;
  activeSessions = new Set;
  metrics = {
    totalSessions: 0,
    totalMessages: 0,
    hotPathHits: 0,
    cacheMisses: 0
  };
  createSession(config) {
    const sessionId = fastUUID();
    const timestamp = fastNow();
    const session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.sessionCache.set(sessionId, session);
    this.activeSessions.add(sessionId);
    this.events.emit("session", session);
    this.metrics.totalSessions++;
    return session;
  }
  getSession(id) {
    const session = this.sessionCache.get(id);
    if (session) {
      this.metrics.hotPathHits++;
      return session;
    }
    this.metrics.cacheMisses++;
    return;
  }
  updateSession(id, updates) {
    const session = this.sessionCache.get(id);
    if (!session) {
      this.metrics.cacheMisses++;
      return;
    }
    if (updates.name !== undefined)
      session.name = updates.name;
    if (updates.workspace !== undefined)
      session.workspace = updates.workspace;
    if (updates.config !== undefined)
      session.config = updates.config;
    if (updates.status !== undefined)
      session.status = updates.status;
    session.updatedAt = fastNow();
    this.sessionCache.set(id, session);
    this.events.emit("session:updated", session);
    this.metrics.hotPathHits++;
    return session;
  }
  deleteSession(id) {
    const session = this.sessionCache.get(id);
    if (!session) {
      this.metrics.cacheMisses++;
      return false;
    }
    this.sessionCache.delete(id);
    this.activeSessions.delete(id);
    this.events.emit("session:deleted", session);
    this.metrics.hotPathHits++;
    return true;
  }
  setContext(sessionId, context) {
    this.contextCache.set(sessionId, context);
  }
  getContext(sessionId) {
    const context = this.contextCache.get(sessionId);
    if (context) {
      this.metrics.hotPathHits++;
      return context;
    }
    this.metrics.cacheMisses++;
    return;
  }
  sendMessage(sessionId, message) {
    if (!this.activeSessions.has(sessionId)) {
      this.metrics.cacheMisses++;
      return false;
    }
    const messageWithTimestamp = {
      ...message,
      timestamp: fastNow()
    };
    this.messageList.push(messageWithTimestamp);
    this.events.emit("message", messageWithTimestamp);
    this.metrics.totalMessages++;
    return true;
  }
  processMessages() {
    const count = this.messageList.length;
    this.messageList = [];
    return count;
  }
  getAllSessions() {
    return this.sessionCache.values();
  }
  getSessionsByType(type) {
    const sessions = this.sessionCache.values();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].type === type) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getSessionsByStatus(status) {
    const sessions = this.sessionCache.values();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].status === status) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const sessions = this.sessionCache.values();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].workspace === workspace) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getMetrics() {
    const sessionCount = this.sessionCache.size();
    const contextCount = this.contextCache.size();
    const totalHits = this.metrics.hotPathHits;
    const totalMisses = this.metrics.cacheMisses;
    const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;
    this.metrics.totalMessages = this.messageList.length;
    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;
    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageList.length,
      cacheHitRate: hitRate,
      hotPathEfficiency: totalHits / Math.max(1, totalHits + totalMisses)
    };
  }
  getSessionCount() {
    return this.sessionCache.size();
  }
  clearAll() {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.messageList = [];
    this.activeSessions.clear();
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
    this.metrics.hotPathHits = 0;
    this.metrics.cacheMisses = 0;
    this.events.emit("sessions:cleared", undefined);
  }
  healthCheck() {
    const metrics = this.getMetrics();
    const memoryLimit = 100 * 1024 * 1024;
    if (metrics.memoryUsage > memoryLimit) {
      return { status: "unhealthy", details: { memoryUsage: metrics.memoryUsage, limit: memoryLimit } };
    }
    if (metrics.activeSessions > 5000) {
      return { status: "degraded", details: { activeSessions: metrics.activeSessions } };
    }
    return { status: "healthy", details: metrics };
  }
  exportSessions() {
    return this.getAllSessions().map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      workspace: s.workspace,
      config: s.config,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
  }
  importSessions(sessions) {
    sessions.forEach((s) => this.createSession({
      type: s.type,
      name: s.name,
      workspace: s.workspace,
      config: s.config
    }));
  }
  onSessionCreated(callback) {
    this.events.on("session", callback);
  }
  onSessionUpdated(callback) {
    this.events.on("session:updated", callback);
  }
  onSessionDeleted(callback) {
    this.events.on("session:deleted", callback);
  }
  onMessage(callback) {
    this.events.on("message", callback);
  }
}
function createHotPathOrchestrator() {
  return new HotPathOrchestrator;
}
var hotPathOrchestrator = createHotPathOrchestrator();
export {
  hotPathOrchestrator,
  createHotPathOrchestrator,
  HotPathOrchestrator
};

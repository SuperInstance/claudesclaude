// src/core/adaptive-orchestrator.ts
var PERFORMANCE_STRATEGIES = [
  {
    name: "minimal",
    sessionCacheSize: 100,
    contextCacheSize: 50,
    messageBufferSize: 200,
    optimizationLevel: "minimal"
  },
  {
    name: "balanced",
    sessionCacheSize: 500,
    contextCacheSize: 250,
    messageBufferSize: 1000,
    optimizationLevel: "balanced"
  },
  {
    name: "aggressive",
    sessionCacheSize: 1000,
    contextCacheSize: 500,
    messageBufferSize: 2000,
    optimizationLevel: "aggressive"
  }
];

class AdaptiveCache {
  cache = new Map;
  accessTimes = new Map;
  maxSize;
  constructor(maxSize) {
    this.maxSize = maxSize;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessTimes.set(key, Date.now());
      return value;
    }
    return;
  }
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessTimes.delete(key);
    }
    return deleted;
  }
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }
  size() {
    return this.cache.size;
  }
  values() {
    return Array.from(this.cache.values());
  }
  evictLRU() {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
    }
  }
}

class AdaptiveEvents {
  listeners = new Map;
  eventQueue = [];
  batchInterval;
  maxBatchSize;
  isBatching = false;
  constructor(batchInterval = 16, maxBatchSize = 100) {
    this.batchInterval = batchInterval;
    this.maxBatchSize = maxBatchSize;
  }
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set);
    }
    this.listeners.get(event).add(callback);
  }
  emit(event, data) {
    if (this.isBatching) {
      this.eventQueue.push({ event, data, timestamp: Date.now() });
      if (this.eventQueue.length >= this.maxBatchSize) {
        this.flushEvents();
      }
    } else {
      this.dispatchEvent(event, data);
    }
  }
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  flushEvents() {
    if (this.eventQueue.length === 0)
      return;
    const queue = [...this.eventQueue];
    this.eventQueue = [];
    for (const { event, data } of queue) {
      this.dispatchEvent(event, data);
    }
  }
  dispatchEvent(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {}
      });
    }
  }
  startBatching() {
    this.isBatching = true;
    setTimeout(() => {
      this.flushEvents();
      this.isBatching = false;
    }, this.batchInterval);
  }
}

class PerformanceMonitor {
  metrics = {
    sessionCreationTime: 0,
    sessionRetrievalTime: 0,
    messageSendTime: 0,
    memoryUsage: 0,
    activeSessions: 0,
    cacheHitRate: 0,
    operationCount: 0
  };
  lastReset = Date.now();
  history = [];
  recordSessionCreation(time) {
    this.metrics.sessionCreationTime = this.metrics.sessionCreationTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }
  recordSessionRetrieval(time) {
    this.metrics.sessionRetrievalTime = this.metrics.sessionRetrievalTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }
  recordMessageSend(time) {
    this.metrics.messageSendTime = this.metrics.messageSendTime * 0.9 + time * 0.1;
    this.metrics.operationCount++;
  }
  recordMemoryUsage(usage) {
    this.metrics.memoryUsage = usage;
  }
  recordActiveSessions(count) {
    this.metrics.activeSessions = count;
  }
  recordCacheHitRate(rate) {
    this.metrics.cacheHitRate = rate;
  }
  getCurrentMetrics() {
    return { ...this.metrics };
  }
  getPerformanceScore() {
    const weights = {
      sessionCreationSpeed: 0.2,
      sessionRetrievalSpeed: 0.3,
      messageSendSpeed: 0.2,
      memoryEfficiency: 0.15,
      cacheEfficiency: 0.15
    };
    const normalizedScores = {
      sessionCreationSpeed: Math.min(1, 100 / this.metrics.sessionCreationTime),
      sessionRetrievalSpeed: Math.min(1, 100 / this.metrics.sessionRetrievalTime),
      messageSendSpeed: Math.min(1, 100 / this.metrics.messageSendTime),
      memoryEfficiency: Math.min(1, 1e6 / this.metrics.memoryUsage),
      cacheEfficiency: this.metrics.cacheHitRate
    };
    return normalizedScores.sessionCreationSpeed * weights.sessionCreationSpeed + normalizedScores.sessionRetrievalSpeed * weights.sessionRetrievalSpeed + normalizedScores.messageSendSpeed * weights.messageSendSpeed + normalizedScores.memoryEfficiency * weights.memoryEfficiency + normalizedScores.cacheEfficiency * weights.cacheEfficiency;
  }
  getOptimalStrategy() {
    const score = this.getPerformanceScore();
    const currentLoad = this.metrics.activeSessions;
    if (score < 0.5 || currentLoad > 1000) {
      return PERFORMANCE_STRATEGIES[0];
    } else if (score < 0.8 || currentLoad > 500) {
      return PERFORMANCE_STRATEGIES[1];
    } else {
      return PERFORMANCE_STRATEGIES[2];
    }
  }
  updateHistory() {
    const now = Date.now();
    if (now - this.lastReset > 1e4) {
      this.history.push({
        timestamp: now,
        metrics: this.getCurrentMetrics(),
        performanceScore: this.getPerformanceScore()
      });
      if (this.history.length > 100) {
        this.history.shift();
      }
      this.lastReset = now;
    }
  }
}

class AdaptiveOrchestrator {
  sessionCache;
  contextCache;
  messageList = [];
  events = new AdaptiveEvents;
  monitor = new PerformanceMonitor;
  currentStrategy;
  strategyTransitionTime = 0;
  constructor() {
    this.currentStrategy = PERFORMANCE_STRATEGIES[1];
    this.updateCaches();
  }
  updateCaches() {
    this.sessionCache = new AdaptiveCache(this.currentStrategy.sessionCacheSize);
    this.contextCache = new AdaptiveCache(this.currentStrategy.contextCacheSize);
  }
  switchStrategy(newStrategy) {
    this.currentStrategy = newStrategy;
    this.updateCaches();
    this.strategyTransitionTime = Date.now();
  }
  createSession(config) {
    const startTime = performance.now();
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const timestamp = new Date;
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
    this.events.emit("session", session);
    const endTime = performance.now();
    this.monitor.recordSessionCreation(endTime - startTime);
    this.monitor.recordActiveSessions(this.sessionCache.size());
    this.checkAndAdjustStrategy();
    return session;
  }
  getSession(id) {
    const startTime = performance.now();
    const session = this.sessionCache.get(id);
    const endTime = performance.now();
    this.monitor.recordSessionRetrieval(endTime - startTime);
    return session;
  }
  updateSession(id, updates) {
    const session = this.sessionCache.get(id);
    if (!session)
      return;
    if (updates.name !== undefined)
      session.name = updates.name;
    if (updates.workspace !== undefined)
      session.workspace = updates.workspace;
    if (updates.config !== undefined)
      session.config = updates.config;
    if (updates.status !== undefined)
      session.status = updates.status;
    session.updatedAt = new Date;
    this.sessionCache.set(id, session);
    this.events.emit("session:updated", session);
    return session;
  }
  deleteSession(id) {
    const session = this.sessionCache.get(id);
    if (!session)
      return false;
    this.sessionCache.delete(id);
    this.events.emit("session:deleted", session);
    this.monitor.recordActiveSessions(this.sessionCache.size());
    this.checkAndAdjustStrategy();
    return true;
  }
  setContext(sessionId, context) {
    this.contextCache.set(sessionId, context);
  }
  getContext(sessionId) {
    return this.contextCache.get(sessionId);
  }
  sendMessage(sessionId, message) {
    const startTime = performance.now();
    if (!this.sessionCache.get(sessionId))
      return false;
    this.messageList.push({ ...message, timestamp: new Date });
    this.events.emit("message", message);
    const endTime = performance.now();
    this.monitor.recordMessageSend(endTime - startTime);
    return true;
  }
  processMessages() {
    const count = this.messageList.length;
    this.messageList = [];
    return count;
  }
  getAllSessions() {
    return Array.from(this.sessionCache.values());
  }
  getSessionsByType(type) {
    const result = [];
    for (const session of this.sessionCache.values()) {
      if (session.type === type)
        result.push(session);
    }
    return result;
  }
  getSessionsByStatus(status) {
    const result = [];
    for (const session of this.sessionCache.values()) {
      if (session.status === status)
        result.push(session);
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const result = [];
    for (const session of this.sessionCache.values()) {
      if (session.workspace === workspace)
        result.push(session);
    }
    return result;
  }
  getMetrics() {
    const sessionCount = this.sessionCache.size();
    const contextCount = this.contextCache.size();
    const memoryUsage = sessionCount * 1000 + contextCount * 500;
    this.monitor.recordMemoryUsage(memoryUsage);
    this.monitor.recordCacheHitRate(this.calculateCacheHitRate());
    return {
      ...this.monitor.getCurrentMetrics(),
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messageList.length,
      currentStrategy: this.currentStrategy.name,
      performanceScore: this.monitor.getPerformanceScore(),
      adaptiveEfficiency: this.calculateAdaptiveEfficiency()
    };
  }
  getSessionCount() {
    return this.sessionCache.size();
  }
  clearAll() {
    this.sessionCache.clear();
    this.contextCache.clear();
    this.messageList = [];
    this.monitor = new PerformanceMonitor;
    this.switchStrategy(PERFORMANCE_STRATEGIES[1]);
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
  getAdaptiveMetrics() {
    return {
      currentStrategy: this.currentStrategy,
      performanceScore: this.monitor.getPerformanceScore(),
      history: this.monitor["history"] || [],
      lastTransition: this.strategyTransitionTime
    };
  }
  forceStrategy(strategyName) {
    const strategy = PERFORMANCE_STRATEGIES.find((s) => s.name === strategyName);
    if (strategy) {
      this.switchStrategy(strategy);
    }
  }
  checkAndAdjustStrategy() {
    this.monitor.updateHistory();
    const optimalStrategy = this.monitor.getOptimalStrategy();
    if (optimalStrategy.name !== this.currentStrategy.name) {
      this.switchStrategy(optimalStrategy);
    }
  }
  calculateCacheHitRate() {
    return 0.8;
  }
  calculateAdaptiveEfficiency() {
    const timeSinceTransition = Date.now() - this.strategyTransitionTime;
    const adaptationSpeed = Math.min(1, timeSinceTransition / 5000);
    return this.monitor.getPerformanceScore() * adaptationSpeed;
  }
}
function createAdaptiveOrchestrator() {
  return new AdaptiveOrchestrator;
}
var adaptiveOrchestrator = createAdaptiveOrchestrator();
export {
  createAdaptiveOrchestrator,
  adaptiveOrchestrator,
  AdaptiveOrchestrator
};

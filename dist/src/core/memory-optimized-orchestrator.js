// src/core/memory-optimized-orchestrator.ts
var MAX_SESSIONS = 1000;
var MAX_MESSAGES = 2000;
var MAX_CONTEXTS = 500;

class SessionStorage {
  sessions = new Array(MAX_SESSIONS);
  idToIndex = new Map;
  nextIndex = 0;
  count = 0;
  add(session) {
    if (this.count >= MAX_SESSIONS) {
      this.evict();
    }
    const index = this.nextIndex;
    this.sessions[index] = session;
    this.idToIndex.set(session.id, index);
    this.nextIndex = (this.nextIndex + 1) % MAX_SESSIONS;
    this.count++;
  }
  get(id) {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      return this.sessions[index];
    }
    return;
  }
  update(id, updates) {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      const session = this.sessions[index];
      Object.assign(session, updates);
      session.updatedAt = new Date;
      return true;
    }
    return false;
  }
  delete(id) {
    const index = this.idToIndex.get(id);
    if (index !== undefined) {
      this.sessions[index] = null;
      this.idToIndex.delete(id);
      this.count--;
      return true;
    }
    return false;
  }
  getAll() {
    return this.sessions.slice(0, this.count).filter((s) => s !== null);
  }
  size() {
    return this.count;
  }
  clear() {
    this.sessions.fill(null);
    this.idToIndex.clear();
    this.nextIndex = 0;
    this.count = 0;
  }
  evict() {
    const entries = Array.from(this.idToIndex.entries());
    if (entries.length > 0) {
      const [oldestId] = entries[0];
      this.delete(oldestId);
    }
  }
}

class MessageStorage {
  messages = new Array(MAX_MESSAGES);
  head = 0;
  tail = 0;
  count = 0;
  add(message) {
    if (this.count >= MAX_MESSAGES) {
      this.head = (this.head + 1) % MAX_MESSAGES;
      this.count--;
    }
    this.messages[this.tail] = message;
    this.tail = (this.tail + 1) % MAX_MESSAGES;
    this.count++;
  }
  getAll() {
    if (this.count === 0)
      return [];
    const result = new Array(this.count);
    let current = this.head;
    for (let i = 0;i < this.count; i++) {
      result[i] = this.messages[current];
      current = (current + 1) % MAX_MESSAGES;
    }
    return result;
  }
  clear() {
    this.messages.fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
  size() {
    return this.count;
  }
}

class ContextStorage {
  contexts = new Map;
  maxSize;
  constructor(maxSize) {
    this.maxSize = maxSize;
  }
  set(key, context) {
    if (this.contexts.size >= this.maxSize) {
      const firstKey = this.contexts.keys().next().value;
      this.contexts.delete(firstKey);
    }
    this.contexts.set(key, context);
  }
  get(key) {
    const value = this.contexts.get(key);
    if (value !== undefined) {
      this.contexts.delete(key);
      this.contexts.set(key, value);
    }
    return value;
  }
  delete(key) {
    return this.contexts.delete(key);
  }
  size() {
    return this.contexts.size;
  }
  clear() {
    this.contexts.clear();
  }
}

class FastUUID {
  counter = 0;
  lastTimestamp = 0;
  generate() {
    const now = Date.now();
    let id = "";
    if (now !== this.lastTimestamp) {
      this.counter = 0;
      this.lastTimestamp = now;
    }
    id = now.toString(36) + this.counter.toString(36);
    this.counter++;
    return id;
  }
}

class MemoryOptimizedOrchestrator {
  sessionStorage = new SessionStorage;
  contextStorage = new ContextStorage(MAX_CONTEXTS);
  messageStorage = new MessageStorage;
  events = new Map;
  uuid = new FastUUID;
  metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    allocationOverhead: 0
  };
  createSession(config) {
    const sessionId = this.uuid.generate();
    const timestamp = Date.now();
    const session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: "active",
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp)
    };
    this.sessionStorage.add(session);
    this.emit("session", session);
    this.metrics.totalSessions++;
    this.metrics.allocationOverhead += this.calculateSessionSize();
    return session;
  }
  getSession(id) {
    return this.sessionStorage.get(id);
  }
  updateSession(id, updates) {
    const success = this.sessionStorage.update(id, updates);
    if (success) {
      const session = this.sessionStorage.get(id);
      this.emit("session:updated", session);
      return session;
    }
    return;
  }
  deleteSession(id) {
    const success = this.sessionStorage.delete(id);
    if (success) {
      const session = this.sessionStorage.get(id);
      if (session) {
        this.emit("session:deleted", session);
      }
      this.metrics.allocationOverhead -= this.calculateSessionSize();
    }
    return success;
  }
  setContext(sessionId, context) {
    this.contextStorage.set(sessionId, context);
  }
  getContext(sessionId) {
    return this.contextStorage.get(sessionId);
  }
  sendMessage(sessionId, message) {
    if (!this.sessionStorage.get(sessionId))
      return false;
    const messageWithTimestamp = { ...message, timestamp: new Date };
    this.messageStorage.add(messageWithTimestamp);
    this.emit("message", messageWithTimestamp);
    this.metrics.totalMessages++;
    return true;
  }
  processMessages() {
    const count = this.messageStorage.size();
    this.messageStorage.clear();
    return count;
  }
  getAllSessions() {
    return this.sessionStorage.getAll();
  }
  getSessionsByType(type) {
    const sessions = this.getAllSessions();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].type === type) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getSessionsByStatus(status) {
    const sessions = this.getAllSessions();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].status === status) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const sessions = this.getAllSessions();
    const result = [];
    for (let i = 0;i < sessions.length; i++) {
      if (sessions[i].workspace === workspace) {
        result.push(sessions[i]);
      }
    }
    return result;
  }
  getMetrics() {
    const sessionCount = this.sessionStorage.size();
    const contextCount = this.contextStorage.size();
    const messageCount = this.messageStorage.size();
    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500 + messageCount * 200;
    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: messageCount,
      memoryEfficiency: (sessionCount + contextCount + messageCount) / (MAX_SESSIONS + MAX_CONTEXTS + MAX_MESSAGES)
    };
  }
  getSessionCount() {
    return this.sessionStorage.size();
  }
  clearAll() {
    this.sessionStorage.clear();
    this.contextStorage.clear();
    this.messageStorage.clear();
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
    this.metrics.allocationOverhead = 0;
    this.emit("sessions:cleared", undefined);
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
  onSessionCreated(cb) {
    this.on("session", cb);
  }
  onSessionUpdated(cb) {
    this.on("session:updated", cb);
  }
  onSessionDeleted(cb) {
    this.on("session:deleted", cb);
  }
  onMessage(cb) {
    this.on("message", cb);
  }
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set);
    }
    this.events.get(event).add(callback);
  }
  emit(event, data) {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
  calculateSessionSize() {
    return 1000;
  }
}
function createMemoryOptimizedOrchestrator() {
  return new MemoryOptimizedOrchestrator;
}
var memoryOptimizedOrchestrator = createMemoryOptimizedOrchestrator();
export {
  memoryOptimizedOrchestrator,
  createMemoryOptimizedOrchestrator,
  MemoryOptimizedOrchestrator
};

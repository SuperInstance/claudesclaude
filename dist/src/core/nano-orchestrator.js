// src/core/nano-orchestrator.ts
class NanoOrchestrator {
  sessions = new Map;
  contexts = new Map;
  messages = [];
  events = new Map;
  totalSessions = 0;
  totalMessages = 0;
  nanoUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  createSession(config) {
    const sessionId = this.nanoUUID();
    const now = Date.now();
    const session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: "active",
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
    this.sessions.set(sessionId, session);
    this.emit("session", session);
    this.totalSessions++;
    return session;
  }
  getSession(id) {
    return this.sessions.get(id);
  }
  updateSession(id, updates) {
    const session = this.sessions.get(id);
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
    this.emit("session:updated", session);
    return session;
  }
  deleteSession(id) {
    const session = this.sessions.get(id);
    if (!session)
      return false;
    this.sessions.delete(id);
    this.emit("session:deleted", session);
    return true;
  }
  setContext(sessionId, context) {
    this.contexts.set(sessionId, context);
  }
  getContext(sessionId) {
    return this.contexts.get(sessionId);
  }
  sendMessage(sessionId, message) {
    if (!this.sessions.has(sessionId))
      return false;
    this.messages.push({ ...message, timestamp: new Date });
    this.emit("message", message);
    this.totalMessages++;
    return true;
  }
  processMessages() {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
  getSessionsByType(type) {
    const result = [];
    for (const session of this.sessions.values()) {
      if (session.type === type)
        result.push(session);
    }
    return result;
  }
  getSessionsByStatus(status) {
    const result = [];
    for (const session of this.sessions.values()) {
      if (session.status === status)
        result.push(session);
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const result = [];
    for (const session of this.sessions.values()) {
      if (session.workspace === workspace)
        result.push(session);
    }
    return result;
  }
  getMetrics() {
    return {
      totalSessions: this.totalSessions,
      totalMessages: this.totalMessages,
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
  }
  getSessionCount() {
    return this.sessions.size;
  }
  clearAll() {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.totalSessions = 0;
    this.totalMessages = 0;
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
    const result = [];
    for (const session of this.sessions.values()) {
      result.push({
        id: session.id,
        type: session.type,
        name: session.name,
        workspace: session.workspace,
        config: session.config,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });
    }
    return result;
  }
  importSessions(sessions) {
    for (const s of sessions) {
      this.createSession({
        type: s.type,
        name: s.name,
        workspace: s.workspace,
        config: s.config
      });
    }
  }
  onSessionCreated(callback) {
    this.on("session", callback);
  }
  onSessionUpdated(callback) {
    this.on("session:updated", callback);
  }
  onSessionDeleted(callback) {
    this.on("session:deleted", callback);
  }
  onMessage(callback) {
    this.on("message", callback);
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
}
function createNanoOrchestrator() {
  return new NanoOrchestrator;
}
var nanoOrchestrator = createNanoOrchestrator();
export {
  nanoOrchestrator,
  createNanoOrchestrator,
  NanoOrchestrator
};

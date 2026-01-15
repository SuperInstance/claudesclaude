// src/core/jit-orchestrator.ts
class JitSessionStorage {
  sessions = new Array(1000);
  idToIndex = new Map;
  typeIndices = new Map;
  statusIndices = new Map;
  workspaceIndices = new Map;
  count = 0;
  nextIndex = 0;
  add(session) {
    if (this.count >= this.sessions.length) {
      this.evictLRU();
    }
    const index = this.nextIndex;
    this.sessions[index] = session;
    this.idToIndex.set(session.id, index);
    this.updateIndex(session.type, index);
    this.updateIndex(session.status, index);
    this.updateIndex(session.workspace, index);
    this.nextIndex = (this.nextIndex + 1) % this.sessions.length;
    this.count++;
  }
  get(id) {
    const index = this.idToIndex.get(id);
    return index !== undefined ? this.sessions[index] : undefined;
  }
  update(id, updates) {
    const index = this.idToIndex.get(id);
    if (index === undefined)
      return false;
    const session = this.sessions[index];
    if (updates.type !== undefined && updates.type !== session.type) {
      this.removeFromIndex(session.type, index);
      this.updateIndex(updates.type, index);
    }
    if (updates.status !== undefined && updates.status !== session.status) {
      this.removeFromIndex(session.status, index);
      this.updateIndex(updates.status, index);
    }
    if (updates.workspace !== undefined && updates.workspace !== session.workspace) {
      this.removeFromIndex(session.workspace, index);
      this.updateIndex(updates.workspace, index);
    }
    if (updates.name !== undefined)
      session.name = updates.name;
    if (updates.config !== undefined)
      session.config = updates.config;
    if (updates.status !== undefined)
      session.status = updates.status;
    session.updatedAt = new Date;
    return true;
  }
  delete(id) {
    const index = this.idToIndex.get(id);
    if (index === undefined)
      return false;
    const session = this.sessions[index];
    this.removeFromIndex(session.type, index);
    this.removeFromIndex(session.status, index);
    this.removeFromIndex(session.workspace, index);
    this.sessions[index] = null;
    this.idToIndex.delete(id);
    this.count--;
    return true;
  }
  getByType(type) {
    const indices = this.typeIndices.get(type);
    if (!indices)
      return [];
    const result = new Array(indices.length);
    for (let i = 0;i < indices.length; i++) {
      const session = this.sessions[indices[i]];
      if (session) {
        result[i] = session;
      }
    }
    return result;
  }
  getByStatus(status) {
    const indices = this.statusIndices.get(status);
    if (!indices)
      return [];
    const result = new Array(indices.length);
    for (let i = 0;i < indices.length; i++) {
      const session = this.sessions[indices[i]];
      if (session) {
        result[i] = session;
      }
    }
    return result;
  }
  getByWorkspace(workspace) {
    const indices = this.workspaceIndices.get(workspace);
    if (!indices)
      return [];
    const result = new Array(indices.length);
    for (let i = 0;i < indices.length; i++) {
      const session = this.sessions[indices[i]];
      if (session) {
        result[i] = session;
      }
    }
    return result;
  }
  getAll() {
    const result = new Array(this.count);
    let actualCount = 0;
    for (let i = 0;i < this.count; i++) {
      const session = this.sessions[i];
      if (session !== null) {
        result[actualCount++] = session;
      }
    }
    return result.slice(0, actualCount);
  }
  updateIndex(key, index) {
    let indices;
    if (key === "agent") {
      indices = this.typeIndices.get("agent") || [];
    } else if (key === "active") {
      indices = this.statusIndices.get("active") || [];
    } else if (key.startsWith("/workspace/")) {
      indices = this.workspaceIndices.get(key) || [];
    } else {
      indices = this.typeIndices.get(key) || [];
    }
    if (!indices.length) {
      indices = [];
      if (key === "agent") {
        this.typeIndices.set(key, indices);
      } else if (key === "active") {
        this.statusIndices.set(key, indices);
      } else if (key.startsWith("/workspace/")) {
        this.workspaceIndices.set(key, indices);
      } else {
        this.typeIndices.set(key, indices);
      }
    }
    indices[indices.length] = index;
  }
  removeFromIndex(key, index) {
    let indices;
    if (key === "agent") {
      indices = this.typeIndices.get("agent");
    } else if (key === "active") {
      indices = this.statusIndices.get("active");
    } else if (key.startsWith("/workspace/")) {
      indices = this.workspaceIndices.get(key);
    } else {
      indices = this.typeIndices.get(key);
    }
    if (indices) {
      for (let i = 0;i < indices.length; i++) {
        if (indices[i] === index) {
          indices[i] = -1;
          break;
        }
      }
    }
  }
  evictLRU() {
    const entries = Array.from(this.idToIndex.entries());
    if (entries.length > 0) {
      const [oldestId] = entries[0];
      this.delete(oldestId);
    }
  }
}

class JitOrchestrator {
  sessionStorage = new JitSessionStorage;
  contexts = new Map;
  messages = [];
  events = new Map;
  metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    jitOptimized: true
  };
  createSession(config) {
    const sessionId = this.generateJitUUID();
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
    this.sessionStorage.add(session);
    this.emit("session", session);
    this.metrics.totalSessions++;
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
    }
    return success;
  }
  setContext(sessionId, context) {
    this.contexts.set(sessionId, context);
  }
  getContext(sessionId) {
    return this.contexts.get(sessionId);
  }
  sendMessage(sessionId, message) {
    if (!this.sessionStorage.get(sessionId))
      return false;
    const messageWithTimestamp = {
      content: message.content || "",
      role: message.role || "user",
      timestamp: new Date,
      metadata: message.metadata || {}
    };
    this.messages.push(messageWithTimestamp);
    this.emit("message", messageWithTimestamp);
    this.metrics.totalMessages++;
    return true;
  }
  processMessages() {
    const count = this.messages.length;
    this.messages = [];
    return count;
  }
  getAllSessions() {
    return this.sessionStorage.getAll();
  }
  getSessionsByType(type) {
    return this.sessionStorage.getByType(type);
  }
  getSessionsByStatus(status) {
    return this.sessionStorage.getByStatus(status);
  }
  getWorkspaceSessions(workspace) {
    return this.sessionStorage.getByWorkspace(workspace);
  }
  getMetrics() {
    const sessionCount = this.sessionStorage.getAll().length;
    const contextCount = this.contexts.size;
    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500;
    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messages.length,
      jitOptimized: true
    };
  }
  getSessionCount() {
    return this.sessionStorage.getAll().length;
  }
  clearAll() {
    this.sessionStorage = new JitSessionStorage;
    this.contexts.clear();
    this.messages = [];
    this.metrics.totalSessions = 0;
    this.metrics.totalMessages = 0;
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
    for (let i = 0;i < sessions.length; i++) {
      this.createSession({
        type: sessions[i].type,
        name: sessions[i].name,
        workspace: sessions[i].workspace,
        config: sessions[i].config
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
  generateJitUUID() {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2);
    return time + random;
  }
}
function createJitOrchestrator() {
  return new JitOrchestrator;
}
var jitOrchestrator = createJitOrchestrator();
export {
  jitOrchestrator,
  createJitOrchestrator,
  JitOrchestrator
};

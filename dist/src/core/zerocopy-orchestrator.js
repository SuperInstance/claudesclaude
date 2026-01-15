// src/core/zerocopy-orchestrator.ts
class ZeroCopySessionStorage {
  sessions = new Array(1000);
  idToIndex = new Map;
  typeIndices = new Map;
  statusIndices = new Map;
  workspaceIndices = new Map;
  count = 0;
  nextIndex = 0;
  freeIndices = [];
  add(session) {
    let index;
    if (this.freeIndices.length > 0) {
      index = this.freeIndices.pop();
    } else if (this.count >= this.sessions.length) {
      this.evictLRU();
      index = this.nextIndex;
    } else {
      index = this.nextIndex;
      this.nextIndex = (this.nextIndex + 1) % this.sessions.length;
      this.count++;
    }
    this.sessions[index] = session;
    this.idToIndex.set(session.id, index);
    this.updateIndex(session.type, index);
    this.updateIndex(session.status, index);
    this.updateIndex(session.workspace, index);
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
    this.freeIndices.push(index);
    this.count--;
    return true;
  }
  getByType(type) {
    const indexArray = this.typeIndices.get(type);
    if (!indexArray)
      return [];
    const result = [];
    for (let i = 0;i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }
  getByStatus(status) {
    const indexArray = this.statusIndices.get(status);
    if (!indexArray)
      return [];
    const result = [];
    for (let i = 0;i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }
  getByWorkspace(workspace) {
    const indexArray = this.workspaceIndices.get(workspace);
    if (!indexArray)
      return [];
    const result = [];
    for (let i = 0;i < indexArray.length; i++) {
      const index = indexArray[i];
      if (index !== 0) {
        const session = this.sessions[index];
        if (session) {
          result.push(session);
        }
      }
    }
    return result;
  }
  getAll() {
    const result = new Array(this.count);
    let actualCount = 0;
    for (let i = 0;i < this.sessions.length; i++) {
      const session = this.sessions[i];
      if (session !== null) {
        result[actualCount++] = session;
      }
    }
    return result.slice(0, actualCount);
  }
  updateIndex(key, index) {
    if (!this.typeIndices.has(key)) {
      this.typeIndices.set(key, new Uint32Array(100));
      this.statusIndices.set(key, new Uint32Array(100));
      this.workspaceIndices.set(key, new Uint32Array(100));
    }
    const typeArray = this.typeIndices.get(key);
    const statusArray = this.statusIndices.get(key);
    const workspaceArray = this.workspaceIndices.get(key);
    let typeIndex = 0;
    while (typeIndex < typeArray.length && typeArray[typeIndex] !== 0) {
      typeIndex++;
    }
    let statusIndex = 0;
    while (statusIndex < statusArray.length && statusArray[statusIndex] !== 0) {
      statusIndex++;
    }
    let workspaceIndex = 0;
    while (workspaceIndex < workspaceArray.length && workspaceArray[workspaceIndex] !== 0) {
      workspaceIndex++;
    }
    typeArray[typeIndex] = index;
    statusArray[statusIndex] = index;
    workspaceArray[workspaceIndex] = index;
  }
  removeFromIndex(key, index) {
    const typeArray = this.typeIndices.get(key);
    const statusArray = this.statusIndices.get(key);
    const workspaceArray = this.workspaceIndices.get(key);
    if (typeArray) {
      for (let i = 0;i < typeArray.length; i++) {
        if (typeArray[i] === index) {
          typeArray[i] = 0;
          break;
        }
      }
    }
    if (statusArray) {
      for (let i = 0;i < statusArray.length; i++) {
        if (statusArray[i] === index) {
          statusArray[i] = 0;
          break;
        }
      }
    }
    if (workspaceArray) {
      for (let i = 0;i < workspaceArray.length; i++) {
        if (workspaceArray[i] === index) {
          workspaceArray[i] = 0;
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

class ZeroCopyOrchestrator {
  sessionStorage = new ZeroCopySessionStorage;
  contexts = new Map;
  messages = [];
  events = new Map;
  transferableObjects = [];
  metrics = {
    totalSessions: 0,
    totalMessages: 0,
    memoryUsage: 0,
    zeroCopyOptimized: true
  };
  createSession(config) {
    const sessionId = this.generateZeroCopyUUID();
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
    if (context && typeof context === "object" && "transfer" in context) {
      this.transferableObjects.push(context.transfer);
    }
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
    const transferableCount = this.transferableObjects.length;
    this.metrics.memoryUsage = sessionCount * 1000 + contextCount * 500 + transferableCount * 100;
    return {
      ...this.metrics,
      activeSessions: sessionCount,
      cachedContexts: contextCount,
      pendingMessages: this.messages.length,
      transferableObjects: transferableCount,
      zeroCopyOptimized: true
    };
  }
  getSessionCount() {
    return this.sessionStorage.getAll().length;
  }
  clearAll() {
    this.sessionStorage = new ZeroCopySessionStorage;
    this.contexts.clear();
    this.messages = [];
    this.transferableObjects = [];
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
  getTransferableObjects() {
    return this.transferableObjects.slice();
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
  generateZeroCopyUUID() {
    const time = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2);
    return time + random;
  }
}
function createZeroCopyOrchestrator() {
  return new ZeroCopyOrchestrator;
}
var zeroCopyOrchestrator = createZeroCopyOrchestrator();
export {
  zeroCopyOrchestrator,
  createZeroCopyOrchestrator,
  ZeroCopyOrchestrator
};

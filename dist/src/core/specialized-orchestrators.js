// src/core/specialized-orchestrators.ts
class ReadOnlyOrchestrator {
  sessions = new Map;
  contexts = new Map;
  messages = [];
  events = new Map;
  sessionIndex = new Map;
  typeIndex = new Map;
  statusIndex = new Map;
  createSession(config) {
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
    this.sessions.set(sessionId, session);
    this.updateIndex(sessionId, session, "add");
    this.emit("session", session);
    return session;
  }
  getSession(id) {
    return this.sessions.get(id);
  }
  updateSession(id, updates) {
    const session = this.sessions.get(id);
    if (!session)
      return;
    const oldType = session.type;
    const oldWorkspace = session.workspace;
    const oldStatus = session.status;
    if (updates.name !== undefined)
      session.name = updates.name;
    if (updates.type !== undefined)
      session.type = updates.type;
    if (updates.workspace !== undefined)
      session.workspace = updates.workspace;
    if (updates.config !== undefined)
      session.config = updates.config;
    if (updates.status !== undefined)
      session.status = updates.status;
    session.updatedAt = new Date;
    if (updates.type !== undefined && oldType !== updates.type) {
      this.updateIndex(id, session, "update", oldType);
    }
    if (updates.workspace !== undefined && oldWorkspace !== updates.workspace) {
      this.updateIndex(id, session, "update", undefined, oldWorkspace);
    }
    if (updates.status !== undefined && oldStatus !== updates.status) {
      this.updateIndex(id, session, "update", undefined, undefined, oldStatus);
    }
    this.emit("session:updated", session);
    return session;
  }
  deleteSession(id) {
    const session = this.sessions.get(id);
    if (!session)
      return false;
    this.sessions.delete(id);
    this.updateIndex(id, session, "delete");
    this.emit("session:deleted", session);
    return true;
  }
  getSessionsByType(type) {
    const sessionIds = this.typeIndex.get(type);
    if (!sessionIds)
      return [];
    const result = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session)
        result.push(session);
    }
    return result;
  }
  getSessionsByStatus(status) {
    const sessionIds = this.statusIndex.get(status);
    if (!sessionIds)
      return [];
    const result = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session)
        result.push(session);
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const sessionIds = this.sessionIndex.get(workspace);
    if (!sessionIds)
      return [];
    const result = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session)
        result.push(session);
    }
    return result;
  }
  updateIndex(sessionId, session, operation, oldType, oldWorkspace, oldStatus) {
    if (operation === "add" || operation === "update") {
      if (!this.sessionIndex.has(session.workspace)) {
        this.sessionIndex.set(session.workspace, new Set);
      }
      this.sessionIndex.get(session.workspace).add(sessionId);
      if (!this.typeIndex.has(session.type)) {
        this.typeIndex.set(session.type, new Set);
      }
      this.typeIndex.get(session.type).add(sessionId);
      if (!this.statusIndex.has(session.status)) {
        this.statusIndex.set(session.status, new Set);
      }
      this.statusIndex.get(session.status).add(sessionId);
    }
    if (operation === "update") {
      if (oldType && oldType !== session.type) {
        const oldTypeSet = this.typeIndex.get(oldType);
        if (oldTypeSet)
          oldTypeSet.delete(sessionId);
      }
      if (oldWorkspace && oldWorkspace !== session.workspace) {
        const oldWorkspaceSet = this.sessionIndex.get(oldWorkspace);
        if (oldWorkspaceSet)
          oldWorkspaceSet.delete(sessionId);
      }
      if (oldStatus && oldStatus !== session.status) {
        const oldStatusSet = this.statusIndex.get(oldStatus);
        if (oldStatusSet)
          oldStatusSet.delete(sessionId);
      }
    }
    if (operation === "delete") {
      this.sessionIndex.get(session.workspace)?.delete(sessionId);
      this.typeIndex.get(session.type)?.delete(sessionId);
      this.statusIndex.get(session.status)?.delete(sessionId);
    }
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
    return true;
  }
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
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
  getSessionCount() {
    return this.sessions.size;
  }
  clearAll() {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.sessionIndex.clear();
    this.typeIndex.clear();
    this.statusIndex.clear();
  }
  healthCheck() {
    return { status: "healthy", details: this.getMetrics() };
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
}

class WriteHeavyOrchestrator {
  sessions = new Map;
  contexts = new Map;
  messages = [];
  events = new Map;
  sessionPool = [];
  messagePool = [];
  poolSize = 100;
  constructor() {
    for (let i = 0;i < this.poolSize; i++) {
      this.sessionPool.push({
        id: "",
        type: "agent",
        name: "",
        workspace: "",
        config: {},
        status: "active",
        createdAt: new Date,
        updatedAt: new Date
      });
      this.messagePool.push({
        id: "",
        type: "",
        content: "",
        metadata: undefined,
        timestamp: new Date
      });
    }
  }
  createSession(config) {
    const session = this.sessionPool.pop() || {
      id: "",
      type: "agent",
      name: "",
      workspace: "",
      config: {},
      status: "active",
      createdAt: new Date,
      updatedAt: new Date
    };
    session.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    session.type = config.type;
    session.name = config.name;
    session.workspace = config.workspace;
    session.config = config.config || {};
    session.status = "active";
    this.sessions.set(session.id, session);
    this.emit("session", session);
    return session;
  }
  getSession(id) {
    return this.sessions.get(id);
  }
  updateSession(id, updates) {
    const session = this.sessions.get(id);
    if (!session)
      return;
    Object.assign(session, updates, { updatedAt: new Date });
    this.emit("session:updated", session);
    return session;
  }
  deleteSession(id) {
    const session = this.sessions.get(id);
    if (!session)
      return false;
    this.sessions.delete(id);
    if (this.sessionPool.length < this.poolSize * 2) {
      session.id = "";
      session.name = "";
      session.workspace = "";
      session.config = {};
      this.sessionPool.push(session);
    }
    this.emit("session:deleted", session);
    return true;
  }
  sendMessage(sessionId, message) {
    if (!this.sessions.has(sessionId))
      return false;
    const pooledMessage = this.messagePool.pop() || {
      id: "",
      type: "",
      content: "",
      metadata: undefined,
      timestamp: new Date
    };
    pooledMessage.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    pooledMessage.type = message.type;
    pooledMessage.content = message.content;
    pooledMessage.metadata = message.metadata;
    pooledMessage.timestamp = new Date;
    this.messages.push(pooledMessage);
    this.emit("message", pooledMessage);
    return true;
  }
  createSessionsBatch(sessions) {
    const results = [];
    for (const config of sessions) {
      results.push(this.createSession(config));
    }
    return results;
  }
  sendMessagesBatch(sessionId, messages) {
    if (!this.sessions.has(sessionId))
      return false;
    for (const message of messages) {
      this.sendMessage(sessionId, message);
    }
    return true;
  }
  setContext(sessionId, context) {
    this.contexts.set(sessionId, context);
  }
  getContext(sessionId) {
    return this.contexts.get(sessionId);
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
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      poolUtilization: this.sessionPool.length / this.poolSize
    };
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
  getSessionCount() {
    return this.sessions.size;
  }
  clearAll() {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.sessionPool = [];
    this.messagePool = [];
  }
  healthCheck() {
    return { status: "healthy", details: this.getMetrics() };
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
}

class LowLatencyOrchestrator {
  sessions = new Map;
  contexts = new Map;
  messages = [];
  events = new Map;
  criticalPathCache = new Map;
  createSession(config) {
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
    this.sessions.set(sessionId, session);
    this.criticalPathCache.set(sessionId, session);
    this.emit("session", session);
    return session;
  }
  getSession(id) {
    const session = this.criticalPathCache.get(id);
    if (session) {
      return session;
    }
    const session2 = this.sessions.get(id);
    if (session2) {
      this.criticalPathCache.set(id, session2);
      return session2;
    }
    return;
  }
  updateSession(id, updates) {
    const session = this.getSession(id);
    if (!session)
      return;
    Object.assign(session, updates, { updatedAt: new Date });
    this.sessions.set(id, session);
    this.criticalPathCache.set(id, session);
    this.emit("session:updated", session);
    return session;
  }
  deleteSession(id) {
    const session = this.getSession(id);
    if (!session)
      return false;
    this.sessions.delete(id);
    this.criticalPathCache.delete(id);
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
    if (!this.getSession(sessionId))
      return false;
    this.messages.push({ ...message, timestamp: new Date });
    this.emit("message", message);
    return true;
  }
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
  getSessionsByType(type) {
    const result = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.type === type)
        result.push(session);
    }
    return result;
  }
  getSessionsByStatus(status) {
    const result = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.status === status)
        result.push(session);
    }
    return result;
  }
  getWorkspaceSessions(workspace) {
    const result = [];
    for (const session of this.criticalPathCache.values()) {
      if (session.workspace === workspace)
        result.push(session);
    }
    return result;
  }
  getMetrics() {
    return {
      activeSessions: this.sessions.size,
      cachedContexts: this.contexts.size,
      pendingMessages: this.messages.length,
      hotPathCacheSize: this.criticalPathCache.size,
      memoryUsage: this.sessions.size * 1000 + this.contexts.size * 500
    };
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
  getSessionCount() {
    return this.sessions.size;
  }
  clearAll() {
    this.sessions.clear();
    this.contexts.clear();
    this.messages = [];
    this.criticalPathCache.clear();
  }
  healthCheck() {
    return { status: "healthy", details: this.getMetrics() };
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
}
function createReadOnlyOrchestrator() {
  return new ReadOnlyOrchestrator;
}
function createWriteHeavyOrchestrator() {
  return new WriteHeavyOrchestrator;
}
function createLowLatencyOrchestrator() {
  return new LowLatencyOrchestrator;
}
var readOnlyOrchestrator = createReadOnlyOrchestrator();
var writeHeavyOrchestrator = createWriteHeavyOrchestrator();
var lowLatencyOrchestrator = createLowLatencyOrchestrator();
export {
  writeHeavyOrchestrator,
  readOnlyOrchestrator,
  lowLatencyOrchestrator,
  createWriteHeavyOrchestrator,
  createReadOnlyOrchestrator,
  createLowLatencyOrchestrator,
  WriteHeavyOrchestrator,
  ReadOnlyOrchestrator,
  LowLatencyOrchestrator
};

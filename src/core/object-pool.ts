/**
 * Object Pool Implementation for Extreme Performance
 * Eliminates garbage collection overhead through object reuse
 */

// Pre-allocated object pools
const sessionPool: Session[] = [];
const messagePool: Message[] = [];
const contextPool: Map<any, any> = new Map();

// Pool size configuration
const MAX_POOL_SIZE = 1000;
const SESSION_POOL_SIZE = 500;
const MESSAGE_POOL_SIZE = 1000;

// Fast pre-allocation
for (let i = 0; i < SESSION_POOL_SIZE; i++) {
  sessionPool.push({
    id: '',
    type: 'agent',
    name: '',
    workspace: '',
    config: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

for (let i = 0; i < MESSAGE_POOL_SIZE; i++) {
  messagePool.push({
    id: '',
    type: '',
    content: '',
    metadata: undefined,
    timestamp: new Date()
  });
}

// Session pooling
export function acquireSession(type: string, name: string, workspace: string): Session {
  const session = sessionPool.pop() || {
    id: '',
    type: 'agent',
    name: '',
    workspace: '',
    config: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  session.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  session.type = type;
  session.name = name;
  session.workspace = workspace;
  session.config = {};
  session.status = 'active';
  session.createdAt = new Date();
  session.updatedAt = new Date();

  return session;
}

export function releaseSession(session: Session): void {
  if (sessionPool.length < MAX_POOL_SIZE) {
    // Reset session for reuse
    session.id = '';
    session.type = 'agent';
    session.name = '';
    session.workspace = '';
    session.config = {};
    sessionPool.push(session);
  }
}

// Message pooling
export function acquireMessage(type: string, content: string, metadata?: any): Message {
  const message = messagePool.pop() || {
    id: '',
    type: '',
    content: '',
    metadata: undefined,
    timestamp: new Date()
  };

  message.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  message.type = type;
  message.content = content;
  message.metadata = metadata;
  message.timestamp = new Date();

  return message;
}

export function releaseMessage(message: Message): void {
  if (messagePool.length < MAX_POOL_SIZE) {
    // Reset message for reuse
    message.id = '';
    message.type = '';
    message.content = '';
    message.metadata = undefined;
    messagePool.push(message);
  }
}

// Context pooling
export function acquireContext(): Map<any, any> {
  return contextPool.size > 0 ? contextPool : new Map();
}

export function releaseContext(context: Map<any, any>): void {
  if (context.size === 0) {
    context.clear();
    contextPool.set(context, true);
  }
}

// Pool statistics
export function getPoolStats() {
  return {
    sessionPool: sessionPool.length,
    messagePool: messagePool.length,
    contextPool: contextPool.size,
    maxPoolSize: MAX_POOL_SIZE
  };
}

// Bulk pooling utilities
export function bulkAcquireSessions(count: number, type: string, name: string, workspace: string): Session[] {
  const sessions: Session[] = [];
  for (let i = 0; i < count; i++) {
    sessions.push(acquireSession(type, name + '-' + i, workspace));
  }
  return sessions;
}

export function bulkReleaseSessions(sessions: Session[]): void {
  sessions.forEach(session => releaseSession(session));
}

export function bulkAcquireMessages(count: number, type: string, content: string): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(acquireMessage(type, content + '-' + i));
  }
  return messages;
}

export function bulkReleaseMessages(messages: Message[]): void {
  messages.forEach(message => releaseMessage(message));
}
import type { Session, SessionType, Message } from './types.js';

export class UnifiedOrchestrator {
  private sessions = new Map<string, Session>();
  private contexts = new Map<string, any>();
  private events = new Map<string, Function[]>();

  // Core session management
  async createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    this.sessions.set(session.id, session);
    this.emit('session', session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  updateSession(id: string, updates: Partial<Session>): void {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates);
      session.updatedAt = new Date();
    }
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  // Context management
  getContext(id: string) {
    return this.contexts.get(id);
  }

  setContext(id: string, context: any) {
    this.contexts.set(id, context);
  }

  getAllContexts() {
    return Array.from(this.contexts.values());
  }

  // Event system
  on(event: string, handler: Function): void {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event)!.push(handler);
  }

  emit(event: string, data: any): void {
    const handlers = this.events.get(event);
    if (handlers) handlers.forEach(h => h(data));
  }

  // Metrics
  getMetrics() {
    const sessions = this.getAllSessions();
    return {
      sessionCount: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      averageResponseTime: 0
    };
  }

  // Simple messaging
  publish(message: Omit<Message, 'id' | 'timestamp'>) {
    const full = { ...message, id: crypto.randomUUID(), timestamp: new Date() };
    this.emit('message', full);
    return full;
  }

  subscribe(callback: (message: Message) => void): void {
    this.on('message', callback);
  }

  // Lifecycle
  shutdown(): void {
    this.sessions.clear();
    this.contexts.clear();
    this.events.clear();
  }
}

// Factory function
export function createUnifiedOrchestrator() {
  return new UnifiedOrchestrator();
}
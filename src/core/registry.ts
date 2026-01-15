import type { Session, SessionType } from './types.js';
import { MessageBus } from './message-bus.js';

export class OrchestrationSystem {
  private sessions = new Map<string, Session>();
  private messageBus = new MessageBus();

  async createSession(config: { type: SessionType; name: string; workspace: string; config?: Record<string, any> }): Promise<Session> {
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

  loadRegistry(): Promise<void> {
    return Promise.resolve();
  }

  getAllCheckpoints(): any[] {
    return [];
  }

  shutdown(): void {
    this.sessions.clear();
  }
}

export function createRegistry() {
  return new OrchestrationSystem();
}
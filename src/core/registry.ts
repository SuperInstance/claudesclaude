import type { Session, SessionType } from './types.js';
import { MessageBus } from './message-bus.js';

export class OrchestrationSystem {
  private sessions: Map<string, Session> = new Map();
  private messageBusInstance: MessageBus;

  constructor() {
    this.messageBusInstance = new MessageBus();
  }

  get messageBus() {
    return this.messageBusInstance;
  }

  async createSession(config: {
    type: SessionType;
    name: string;
    workspace: string;
    config?: Record<string, any>;
  }): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
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

  // Additional registry methods
  loadRegistry(): Promise<void> {
    // Implementation would load registry from storage
    return Promise.resolve();
  }

  getAllCheckpoints(): any[] {
    // Implementation would return all checkpoints from checkpoint manager
    return [];
  }

  shutdown(): void {
    this.sessions.clear();
  }
}

export function createRegistry(): OrchestrationSystem {
  return new OrchestrationSystem();
}
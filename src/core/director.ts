import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';

export class Director {
  private config: { maxConcurrentSessions: number };
  private orchestration: OrchestrationSystem;

  constructor(config: { maxConcurrentSessions: number }, orchestration?: OrchestrationSystem) {
    this.config = config;
    this.orchestration = orchestration || new OrchestrationSystem();
  }

  async createSession(config: {
    type: any;
    name: string;
    workspace: string;
    config?: any;
  }): Promise<Session> {
    return this.orchestration.createSession(config);
  }

  getSession(id: string): Session | undefined {
    return this.orchestration.getSession(id);
  }

  getAllSessions(): Session[] {
    return this.orchestration.getAllSessions();
  }

  async start(): Promise<void> {
    // Simple implementation
  }

  async stop(): Promise<void> {
    // Simple implementation
  }
}
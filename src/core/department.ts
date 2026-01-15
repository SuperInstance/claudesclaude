import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';

export class Department {
  private orchestration: OrchestrationSystem;

  constructor(config: { orchestration?: OrchestrationSystem } = {}) {
    this.orchestration = config.orchestration || new OrchestrationSystem();
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

  getDepartmentMetrics() {
    const sessions = this.getAllSessions();
    return {
      sessionCount: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      averageResponseTime: 0
    };
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
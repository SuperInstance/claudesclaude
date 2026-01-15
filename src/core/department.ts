import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';

export class Department {
  private config: any;
  private orchestration: OrchestrationSystem;

  constructor(config: any) {
    this.config = config;
    // If orchestration is provided in config, use it
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

  // Additional department methods
  getDepartmentMetrics(): {
    sessionCount: number;
    activeSessions: number;
    averageResponseTime: number;
  } {
    const sessions = this.getAllSessions();
    const activeSessions = sessions.filter(s => s.status === 'active').length;

    return {
      sessionCount: sessions.length,
      activeSessions,
      averageResponseTime: 0 // Would calculate actual metrics
    };
  }

  shutdown(): Promise<void> {
    // Implementation would clean up department resources
    return Promise.resolve();
  }
}
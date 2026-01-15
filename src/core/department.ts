import { OrchestrationSystem } from './registry.js';
import type { DepartmentConfig, Session } from './types.js';

export class Department {
  private config: DepartmentConfig;
  private orchestration: OrchestrationSystem;

  constructor(config: DepartmentConfig) {
    this.config = config;
    this.orchestration = new OrchestrationSystem();
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
}
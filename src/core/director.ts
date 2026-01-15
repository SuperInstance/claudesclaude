import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';

export class Director {
  private config: { maxConcurrentSessions: number };
  private orchestration: OrchestrationSystem;
  private workflows: Map<string, any> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();

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

  // Workflow management methods
  createWorkflow(workflow: {
    id: string;
    name: string;
    steps: any[];
    config?: any;
  }): void {
    this.workflows.set(workflow.id, workflow);
  }

  getWorkflow(id: string): any | undefined {
    return this.workflows.get(id);
  }

  registerQualityGate(gate: {
    name: string;
    check: (session: Session) => Promise<boolean>;
  }): void {
    // Implementation would register quality gate validation
  }

  // Event emitter functionality
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }

  async start(): Promise<void> {
    this.emit('started', { timestamp: new Date() });
  }

  async stop(): Promise<void> {
    this.workflows.clear();
    this.eventHandlers.clear();
    this.emit('stopped', { timestamp: new Date() });
  }
}
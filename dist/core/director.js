import { OrchestrationSystem } from './registry.js';
export class Director {
    config;
    orchestration;
    workflows = new Map();
    eventHandlers = new Map();
    constructor(config, orchestration) {
        this.config = config;
        this.orchestration = orchestration || new OrchestrationSystem();
    }
    async createSession(config) {
        return this.orchestration.createSession(config);
    }
    getSession(id) {
        return this.orchestration.getSession(id);
    }
    getAllSessions() {
        return this.orchestration.getAllSessions();
    }
    createWorkflow(workflow) {
        this.workflows.set(workflow.id, workflow);
    }
    getWorkflow(id) {
        return this.workflows.get(id);
    }
    registerQualityGate(gate) {
    }
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error('Event handler error:', error);
                }
            });
        }
    }
    async start() {
        this.emit('started', { timestamp: new Date() });
    }
    async stop() {
        this.workflows.clear();
        this.eventHandlers.clear();
        this.emit('stopped', { timestamp: new Date() });
    }
}
//# sourceMappingURL=director.js.map
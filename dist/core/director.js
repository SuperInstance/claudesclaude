import { OrchestrationSystem } from './registry.js';
export class Director {
    config;
    orchestration;
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
    async start() {
    }
    async stop() {
    }
}
//# sourceMappingURL=director.js.map
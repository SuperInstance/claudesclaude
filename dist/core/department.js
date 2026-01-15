import { OrchestrationSystem } from './registry.js';
export class Department {
    config;
    orchestration;
    constructor(config) {
        this.config = config;
        this.orchestration = new OrchestrationSystem();
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
}
//# sourceMappingURL=department.js.map
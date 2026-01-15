import { OrchestrationSystem } from './registry.js';
export class Department {
    orchestration;
    constructor(config = {}) {
        this.orchestration = config.orchestration || new OrchestrationSystem();
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
    getDepartmentMetrics() {
        const sessions = this.getAllSessions();
        return {
            sessionCount: sessions.length,
            activeSessions: sessions.filter(s => s.status === 'active').length,
            averageResponseTime: 0
        };
    }
    shutdown() {
        return Promise.resolve();
    }
}
//# sourceMappingURL=department.js.map
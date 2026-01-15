import { OrchestrationSystem } from './registry.js';
export class Department {
    config;
    orchestration;
    constructor(config) {
        this.config = config;
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
        const activeSessions = sessions.filter(s => s.status === 'active').length;
        return {
            sessionCount: sessions.length,
            activeSessions,
            averageResponseTime: 0
        };
    }
    shutdown() {
        return Promise.resolve();
    }
}
//# sourceMappingURL=department.js.map
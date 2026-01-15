import type { Session } from './types.js';
export declare class Department {
    private config;
    private orchestration;
    constructor(config: any);
    createSession(config: {
        type: any;
        name: string;
        workspace: string;
        config?: any;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    getDepartmentMetrics(): {
        sessionCount: number;
        activeSessions: number;
        averageResponseTime: number;
    };
    shutdown(): Promise<void>;
}

import type { DepartmentConfig, Session } from './types.js';
export declare class Department {
    private config;
    private orchestration;
    constructor(config: DepartmentConfig);
    createSession(config: {
        type: any;
        name: string;
        workspace: string;
        config?: any;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
}

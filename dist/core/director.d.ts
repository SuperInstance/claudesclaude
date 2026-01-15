import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';
export interface DirectorConfig {
    maxConcurrentSessions: number;
}
export declare class Director {
    private config;
    private orchestration;
    constructor(config: DirectorConfig, orchestration?: OrchestrationSystem);
    createSession(config: {
        type: any;
        name: string;
        workspace: string;
        config?: any;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    start(): Promise<void>;
    stop(): Promise<void>;
}

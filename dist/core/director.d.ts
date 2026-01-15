import { OrchestrationSystem } from './registry.js';
import type { Session } from './types.js';
export declare class Director {
    private config;
    private orchestration;
    private workflows;
    private eventHandlers;
    constructor(config: {
        maxConcurrentSessions: number;
    }, orchestration?: OrchestrationSystem);
    createSession(config: {
        type: any;
        name: string;
        workspace: string;
        config?: any;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    createWorkflow(workflow: {
        id: string;
        name: string;
        steps: any[];
        config?: any;
    }): void;
    getWorkflow(id: string): any | undefined;
    registerQualityGate(gate: {
        name: string;
        check: (session: Session) => Promise<boolean>;
    }): void;
    on(event: string, handler: Function): void;
    emit(event: string, data: any): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}

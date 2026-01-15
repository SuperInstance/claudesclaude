import type { Session, SessionType } from './types.js';
export declare class OrchestrationSystem {
    private sessions;
    private messageBus;
    createSession(config: {
        type: SessionType;
        name: string;
        workspace: string;
        config?: Record<string, any>;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    updateSession(id: string, updates: Partial<Session>): void;
    deleteSession(id: string): void;
    loadRegistry(): Promise<void>;
    getAllCheckpoints(): any[];
    shutdown(): void;
}
export declare function createRegistry(): OrchestrationSystem;

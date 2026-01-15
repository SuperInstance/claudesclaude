import type { Session, SessionType, Message } from './types.js';
export declare class UnifiedOrchestrator {
    private sessions;
    private contexts;
    private events;
    createSession(config: {
        type: SessionType;
        name: string;
        workspace: string;
        config?: any;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    updateSession(id: string, updates: Partial<Session>): void;
    deleteSession(id: string): void;
    getContext(id: string): any;
    setContext(id: string, context: any): void;
    getAllContexts(): any[];
    on(event: string, handler: Function): void;
    emit(event: string, data: any): void;
    getMetrics(): {
        sessionCount: number;
        activeSessions: number;
        averageResponseTime: number;
    };
    publish(message: Omit<Message, 'id' | 'timestamp'>): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        timestamp: Date;
        type: string;
        source: string;
        target?: string | undefined;
        data: any;
    };
    subscribe(callback: (message: Message) => void): void;
    shutdown(): void;
}
export declare function createUnifiedOrchestrator(): UnifiedOrchestrator;

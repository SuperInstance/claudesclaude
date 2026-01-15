import type { Session, SessionType, Message } from './types.js';
export declare class UltimateOrchestrator {
    private sessionStore;
    private contextStore;
    private messageBuffer;
    private eventHandler;
    private performanceStats;
    createSession(config: {
        type: SessionType;
        name: string;
        workspace: string;
        config?: any;
    }): Session;
    getSession(id: string): Session | undefined;
    updateSession(id: string, updates: Partial<Session>): Session | undefined;
    deleteSession(id: string): boolean;
    setContext(sessionId: string, context: any): void;
    getContext(sessionId: string): any;
    sendMessage(sessionId: string, message: Message): boolean;
    processMessages(): number;
    getAllSessions(): Session[];
    getSessionsByType(type: SessionType): Session[];
    getSessionsByStatus(status: string): Session[];
    getWorkspaceSessions(workspace: string): Session[];
    getMetrics(): {
        activeSessions: number;
        cachedContexts: number;
        pendingMessages: number;
        totalSessions: number;
        totalMessages: number;
        memoryUsage: number;
    };
    getSessionCount(): number;
    clearAll(): void;
    healthCheck(): {
        status: string;
        details: {
            memoryUsage: number;
            limit: number;
            activeSessions?: undefined;
        };
    } | {
        status: string;
        details: {
            activeSessions: number;
            memoryUsage?: undefined;
            limit?: undefined;
        };
    } | {
        status: string;
        details: {
            activeSessions: number;
            cachedContexts: number;
            pendingMessages: number;
            totalSessions: number;
            totalMessages: number;
            memoryUsage: number;
        };
    };
    exportSessions(): any[];
    importSessions(sessions: any[]): void;
    onSessionCreated(callback: (session: Session) => void): void;
    onSessionUpdated(callback: (session: Session) => void): void;
    onSessionDeleted(callback: (session: Session) => void): void;
    onMessage(callback: (message: Message) => void): void;
}
export declare function createUltimateOrchestrator(): UltimateOrchestrator;
export declare const ultimateOrchestrator: UltimateOrchestrator;

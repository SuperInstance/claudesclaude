export type SessionType = 'ai-assistant' | 'development' | 'testing' | 'deployment';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';
export type MessageType = 'system' | 'user' | 'agent' | 'task' | 'command' | 'query' | 'response';
export interface Session {
    id: string;
    type: SessionType;
    name: string;
    workspace: string;
    config: Record<string, any>;
    status: SessionStatus;
    createdAt: Date;
    updatedAt: Date;
}
export interface Message {
    id: string;
    type: string;
    source: string;
    target?: string;
    data: any;
    timestamp: Date;
}
export type SessionId = string;
export declare function createSession(type: SessionType, name: string, workspace: string): Session;
export declare function createMessage(type: string, data: any, source: string): Message;
export declare class SessionNotFoundError extends Error {
    constructor(sessionId: SessionId);
}

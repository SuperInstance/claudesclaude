export type SessionType = 'agent' | 'task' | 'workflow' | 'session' | 'ai-assistant' | 'development' | 'testing' | 'deployment';
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
    content: string;
    metadata?: Record<string, any>;
    timestamp: Date;
}
export type SessionId = string;
export declare function createSession(type: SessionType, name: string, workspace: string): Session;
export declare function createMessage(type: string, content: string, metadata?: Record<string, any>): Message;
export declare class SessionNotFoundError extends Error {
    constructor(sessionId: SessionId);
}

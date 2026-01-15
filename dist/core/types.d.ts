export type SessionType = 'ai-assistant' | 'development' | 'testing' | 'deployment';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';
export type MessageType = 'system' | 'user' | 'agent' | 'task';
export type WorkflowStepType = 'initialize' | 'execute' | 'validate' | 'complete';
export type CheckpointType = 'auto' | 'manual' | 'scheduled';
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
    payload: any;
    timestamp: Date;
    source: string;
    target?: string;
}
export interface Task {
    id: string;
    name: string;
    type: string;
    priority: number;
    payload: Record<string, any>;
    timeoutMs: number;
    retries: number;
    maxRetries: number;
}

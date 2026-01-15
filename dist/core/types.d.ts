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
export interface Checkpoint {
    id: string;
    sessionId: string;
    type: CheckpointType;
    name: string;
    data: any;
    createdAt: Date;
    expiresAt?: Date;
}
export interface DepartmentConfig {
    id: string;
    name: string;
    domain: string;
    maxConcurrentTasks: number;
    taskTimeoutMs: number;
    enableAutoScaling: boolean;
    resourceLimits: {
        memory: number;
        cpu: number;
        disk: number;
    };
    capabilities: string[];
    constraints: string[];
}
export interface Department {
    id: string;
    name: string;
    type: SessionType;
    config: DepartmentConfig;
    sessions: Set<string>;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrchestrationError extends Error {
    code: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    sessionId?: string;
}
export interface ValidationError extends Error {
    field: string;
    value: any;
    message: string;
    code: string;
}
export interface SecurityConfig {
    enableInputValidation: boolean;
    enableOutputSanitization: boolean;
    maxKeyLength: number;
    maxWorkspacePathLength: number;
    blockedKeyPatterns: string[];
    sensitiveDataFields: string[];
}
export type SessionId = string;
export declare function createSession(type: SessionType, name: string, workspace: string): Session;
export declare function createMessage(type: string, payload: any, source: string): Message;
export declare class SessionNotFoundError extends Error {
    constructor(sessionId: SessionId);
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

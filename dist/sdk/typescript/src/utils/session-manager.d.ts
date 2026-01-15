import { EventEmitter } from 'events';
import { Session, SessionData, SessionStatus, SessionFilter, SessionType } from '../types';
import { Logger } from './simple-logger';
import { MemoryMetrics } from './simple-lru-cache';
export interface SessionManagerOptions {
    logger?: Logger;
    maxSessions?: number;
    sessionTTL?: number;
    maxSize?: number;
    enableAutoCleanup?: boolean;
    cleanupIntervalMs?: number;
    enableWeakReferences?: boolean;
}
export interface SessionManagerMetrics {
    totalSessions: number;
    activeSessions: number;
    memoryUsage: number;
    cacheHits: number;
    cacheMisses: number;
    sessionsCreated: number;
    sessionsDeleted: number;
    sessionsExpired: number;
    averageSessionSize: number;
    lastCleanup?: Date;
}
export declare class OptimizedSessionManager extends EventEmitter {
    private sessionCache;
    private logger;
    private metrics;
    private options;
    private cleanupInterval;
    private weakReferenceSessions;
    constructor(options?: SessionManagerOptions);
    createSession(sessionData: SessionData): Promise<Session>;
    getSession(sessionId: string): Promise<Session | null>;
    updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean>;
    deleteSession(sessionId: string): Promise<boolean>;
    getSessionsByStatus(status: SessionStatus, options?: SessionFilter): Promise<Session[]>;
    getActiveSessions(): Promise<Session[]>;
    getSessionsByType(type: SessionType, options?: SessionFilter): Promise<Session[]>;
    searchSessions(searchTerm: string, limit?: number): Promise<Session[]>;
    countSessionsByStatus(): Promise<Record<SessionStatus, number>>;
    cleanupExpiredSessions(): Promise<number>;
    getMetrics(): SessionManagerMetrics;
    getCacheStats(): any;
    getMemoryMetrics(): MemoryMetrics;
    updateSessionCacheSettings(options: Partial<SessionManagerOptions>): void;
    cleanupWeakReferences(): number;
    get cacheSize(): number;
    clearAllSessions(): Promise<void>;
    private setupEventHandlers;
    private startAutoCleanup;
    private stopAutoCleanup;
    private calculateSessionSize;
    private applySessionFilters;
    shutdown(): Promise<void>;
}
export default OptimizedSessionManager;

import { EventEmitter } from 'events';
import { Logger } from './simple-logger';
import { MemoryMetrics as CacheMetrics } from './simple-lru-cache';
import { OptimizedSessionManager, SessionManagerMetrics } from './session-manager';
import { OptimizedEventManager, EventManagerMetrics } from './event-manager';
export interface MemoryManagerMetrics {
    totalMemoryUsage: number;
    heapUsage: number;
    heapLimit: number;
    heapUsagePercentage: number;
    sessionCache: CacheMetrics;
    contextCache: CacheMetrics;
    eventCache: CacheMetrics;
    sessionManager: SessionManagerMetrics;
    eventManager: EventManagerMetrics;
    evictions: number;
    cleanups: number;
    lastMemoryCheck?: Date;
    memoryPressureEvents: number;
}
export interface MemoryManagerOptions {
    logger?: Logger;
    enableMemoryMonitoring?: boolean;
    memoryCheckIntervalMs?: number;
    memoryPressureThreshold?: number;
    enableAutoOptimization?: boolean;
    enableWeakReferences?: boolean;
    maxSessions?: number;
    maxContexts?: number;
    maxEvents?: number;
}
export declare class UnifiedMemoryManager extends EventEmitter {
    private logger;
    private options;
    private sessionCache;
    private contextCache;
    private sessionManager;
    private eventManager;
    private memoryMetrics;
    private memoryCheckInterval;
    private weakReferenceCleanupInterval;
    constructor(options?: MemoryManagerOptions);
    getMetrics(): MemoryManagerMetrics;
    checkMemoryPressure(): boolean;
    optimizeMemory(): void;
    getSessionContext(key: string): any | undefined;
    setSessionContext(key: string, value: any, ttl?: number): void;
    deleteSessionContext(key: string): boolean;
    getContext(key: string): any | undefined;
    setContext(key: string, value: any, ttl?: number): void;
    deleteContext(key: string): boolean;
    getSessionManager(): OptimizedSessionManager;
    getEventManager(): OptimizedEventManager;
    updateMemorySettings(settings: Partial<MemoryManagerOptions>): void;
    cleanupAllWeakReferences(): Promise<{
        sessions: number;
        contexts: number;
        events: number;
    }>;
    forceCleanup(): Promise<void>;
    getMemorySummary(): {
        totalMemory: number;
        heapUsage: number;
        heapLimit: number;
        heapUsagePercentage: number;
        cacheSizes: {
            sessions: number;
            contexts: number;
            events: number;
        };
        memoryPressure: boolean;
    };
    getCacheStatistics(): {
        sessionCache: any;
        contextCache: any;
        eventManager: any;
    };
    shutdown(): Promise<void>;
    private setupEventHandlers;
    private initializeMemoryMonitoring;
    private optimizeSessionCache;
    private optimizeContextCache;
    private cleanupWeakReferences;
    private calculateObjectSize;
}
export default UnifiedMemoryManager;

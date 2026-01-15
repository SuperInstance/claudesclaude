import { EventEmitter } from 'events';
import { OrchestrationConfig } from '../types';
import { MessageBusClient } from './message-bus-client';
import { Logger } from '../utils/logger';
import { UnifiedMemoryManager } from '../utils/memory-manager';
import { MemoryManagerOptions } from '../utils/memory-manager';
export interface OrchestrationClientOptions {
    config?: Partial<OrchestrationConfig>;
    configPath?: string;
    logger?: Logger;
    enableMetrics?: boolean;
    traceId?: string;
    memoryManagerOptions?: MemoryManagerOptions;
}
export interface ClientMetrics {
    uptime: number;
    messagesProcessed: number;
    sessionsCreated: number;
    tasksExecuted: number;
    errors: number;
    memoryUsage: number;
    memoryPressureEvents: number;
    cacheStats: {
        sessionCache: any;
        contextCache: any;
        eventManager: any;
    };
    lastActivity: Date;
}
export declare class OrchestrationClient extends EventEmitter {
    private config;
    private logger;
    private messageBus?;
    private database?;
    private workerManager?;
    private sessionManager?;
    private checkpointManager?;
    private memoryManager?;
    private startTime;
    private metrics;
    private isShuttingDown;
    private traceId?;
    constructor(options?: OrchestrationClientOptions);
    private initializeClients;
    private setupErrorHandling;
    private handleError;
    private startMetricsCollection;
    private updateMetrics;
    getConfig(): OrchestrationConfig;
    private setupMemoryMonitoring;
    updateConfig(updates: Partial<OrchestrationConfig>): Promise<void>;
    getMetrics(): ClientMetrics;
    updateMemorySettings(settings: any): void;
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
    } | undefined;
    forceMemoryCleanup(): Promise<void>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: Record<string, any>;
        timestamp: Date;
    }>;
    private checkDatabaseHealth;
    private checkMessageBusHealth;
    private checkWorkerHealth;
    private checkMemoryHealth;
    shutdown(): Promise<void>;
    get messageBus(): MessageBusClient | undefined;
    get database(): any;
    get workerManager(): any;
    get sessions(): any;
    get checkpoints(): any;
    get memory(): UnifiedMemoryManager | undefined;
    get uptime(): number;
    static create(options?: OrchestrationClientOptions): Promise<OrchestrationClient>;
    private waitForReady;
}
export default OrchestrationClient;
export type { OrchestrationClientOptions, ClientMetrics };
export { MessageBusClient, DatabaseClient, WorkerClient, SessionClient, CheckpointClient } from './index';

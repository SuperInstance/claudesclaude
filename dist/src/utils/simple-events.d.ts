export interface BatchedEvent<T = any> {
    event: string;
    data: T;
    timestamp: number;
    priority?: number;
    source?: string;
}
export interface BatchConfig {
    maxSize: number;
    maxWaitMs: number;
    enablePriority: boolean;
    enableDeduplication: boolean;
    dedupKey?: (event: BatchedEvent) => string;
}
export interface EventMetrics {
    totalEvents: number;
    totalProcessed: number;
    averageProcessingTime: number;
    memoryUsage: number;
}
export declare class SimpleEventManager {
    private events;
    private batchQueue;
    private batchConfig;
    private metrics;
    private batchTimeout?;
    private processingTimes;
    private lastFlush;
    constructor(config?: BatchConfig);
    private initializeMetrics;
    emit<T>(event: string, data: T, priority?: number, source?: string): void;
    private flush;
    on<T>(event: string, listener: (data: T) => void): void;
    off<T>(event: string, listener: (data: T) => void): void;
    getMetrics(): EventMetrics;
    private updateMetrics;
    forceFlush(): void;
    clear(): void;
}
export declare const eventManager: SimpleEventManager;

import { EventEmitter } from 'events';
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
    maxMemoryBytes?: number;
    enablePriority: boolean;
    enableDeduplication: boolean;
    dedupKey?: (event: BatchedEvent) => string;
}
export interface BatchStats {
    batchSize: number;
    waitTime: number;
    memoryUsage: number;
    duplicatesRemoved: number;
    batchesFlushed: number;
    totalEvents: number;
}
export declare class EventBatcher extends EventEmitter {
    private config;
    private eventQueue;
    private pendingTimers;
    private stats;
    private totalMemoryUsage;
    private eventCounts;
    private lastFlushTime;
    constructor(config?: Partial<BatchConfig>);
    emit<T>(event: string, data: T, options?: {
        priority?: number;
        source?: string;
        immediate?: boolean;
    }): boolean;
    flush(events?: BatchedEvent[]): void;
    flushImmediately(): void;
    getStatus(): {
        queueSize: number;
        memoryUsage: number;
        memoryPercentage: number;
        avgWaitTime: number;
        eventsByType: Record<string, number>;
    };
    getStats(): BatchStats;
    resetStats(): void;
    pause(): void;
    resume(): void;
    updateConfig(newConfig: Partial<BatchConfig>): void;
    dispose(): void;
    private setupAutoFlush;
    private checkFlushConditions;
    private findInsertIndex;
    private calculateEventSize;
    private calculateTotalMemoryUsage;
}
export declare function createEventBatcher(config?: Partial<BatchConfig>): EventBatcher;
export declare class SessionEventBatcher extends EventBatcher {
    constructor();
}
export declare class MetricEventBatcher extends EventBatcher {
    constructor();
}
export declare class HighFrequencyEventBatcher extends EventBatcher {
    constructor();
}

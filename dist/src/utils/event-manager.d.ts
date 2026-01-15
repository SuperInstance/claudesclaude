export interface EventManagerOptions {
    enableWeakReferences?: boolean;
    enableBatching?: boolean;
    maxListeners?: number;
}
export interface EventManagerMetrics {
    totalEventsEmitted: number;
    totalEventsProcessed: number;
    averageProcessingTime: number;
    memoryUsage: number;
    activeListeners: number;
}
export declare class OptimizedEventManager {
    private events;
    private options;
    private metrics;
    private processingTimes;
    constructor(options?: EventManagerOptions);
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): boolean;
    emit(event: string, data: any): void;
    removeAllListeners(event?: string): void;
    listenerCount(event: string): number;
    getAllEvents(): string[];
    getMetrics(): EventManagerMetrics;
    private updateMetrics;
    private calculateMemoryUsage;
    private initializeMetrics;
    cleanup(): void;
    shutdown(): void;
    getEventStats(): {
        uniqueEvents: number;
        events: Record<string, number>;
        totalListeners: number;
    };
}

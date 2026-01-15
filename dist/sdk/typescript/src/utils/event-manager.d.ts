import { EventEmitter } from 'events';
import { Logger } from './simple-logger';
export interface EventSubscription {
    id: string;
    event: string;
    handler: Function;
    once: boolean;
    weakReference: boolean;
    createdAt: Date;
    lastCalled: Date;
    callCount: number;
}
export interface EventBatch {
    id: string;
    events: Array<{
        event: string;
        data: any;
        timestamp: number;
    }>;
    maxDelay: number;
    maxSize: number;
}
export interface EventManagerMetrics {
    totalSubscriptions: number;
    activeSubscriptions: number;
    weakReferences: number;
    eventsProcessed: number;
    batchedEvents: number;
    memoryUsage: number;
    cleanupCount: number;
    lastCleanup?: Date;
}
export interface EventManagerOptions {
    logger?: Logger;
    enableWeakReferences?: boolean;
    enableBatching?: boolean;
    batchSize?: number;
    batchDelayMs?: number;
    enableAutoCleanup?: boolean;
    cleanupIntervalMs?: number;
    maxSubscriptions?: number;
}
export declare class OptimizedEventManager extends EventEmitter {
    private subscriptions;
    private eventCache;
    private logger;
    private metrics;
    private options;
    private cleanupInterval;
    private pendingBatch;
    private batchTimer;
    private weakRefSubscriptions;
    constructor(options?: EventManagerOptions);
    on(event: string, handler: Function, options?: {
        weakReference?: boolean;
        trackMetrics?: boolean;
    }): string;
    once(event: string, handler: Function, options?: {
        weakReference?: boolean;
        trackMetrics?: boolean;
    }): string;
    off(event: string, handler?: Function): boolean;
    unsubscribe(subscriptionId: string): boolean;
    emit(event: string, data: any): boolean;
    private processEvent;
    private addToBatch;
    private flushBatch;
    private isSubscriptionValid;
    private removeSubscription;
    private wrapHandler;
    getMetrics(): EventManagerMetrics;
    getCacheStats(): any;
    cleanupWeakReferences(): number;
    flushPendingBatch(): void;
    getMemoryUsage(): number;
    getSubscriptionCount(event?: string): number;
    listSubscriptions(): EventSubscription[];
    clearAllSubscriptions(): void;
    private setupEventHandlers;
    private startAutoCleanup;
    private stopAutoCleanup;
    shutdown(): void;
}
export default OptimizedEventManager;

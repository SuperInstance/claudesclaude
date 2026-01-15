export declare const uuid: {
    fast: () => string;
    secure: () => string;
    generate: (secure?: boolean) => string;
};
export declare const time: {
    now: () => number;
    format: (timestamp: number, options?: {
        includeTimezone?: boolean;
        includeMilliseconds?: boolean;
    }) => string;
    diff: (start: number, end: number) => {
        hours: number;
        minutes: number;
        seconds: number;
    };
    range: (start: number, duration: number) => {
        start: number;
        end: number;
        duration: number;
    };
    inRange: (timestamp: number, start: number, end: number) => boolean;
};
export declare class ObjectPool<T> {
    private pool;
    private createFn;
    private resetFn;
    private maxSize;
    constructor(options: {
        create: () => T;
        reset?: (obj: T) => void;
        maxSize?: number;
    });
    acquire(): T;
    release(obj: T): void;
    clear(): void;
    size(): number;
}
export declare class EventBatcher<T> {
    private batch;
    private callbacks;
    private batchSize;
    private batchTime;
    constructor(options?: {
        batchSize?: number;
        batchTime?: number;
    });
    add(item: T): void;
    addAll(items: T[]): void;
    subscribe(callback: (items: T[]) => void): void;
    unsubscribe(callback: (items: T[]) => void): void;
    private flush;
    private startBatchTimer;
    size(): number;
}
export declare class MetricsCollector {
    private metrics;
    private timers;
    private counters;
    startTimer(name: string): void;
    endTimer(name: string): number;
    increment(name: string, value?: number): void;
    recordMetric(name: string, value: number): void;
    getMetrics(): Record<string, number>;
    reset(): void;
    private incrementCounter;
    private incrementMetric;
}
export declare const metrics: MetricsCollector;
export declare const eventBatcher: EventBatcher<any>;
export declare const sessionPool: ObjectPool<any>;
export declare const generateUUID: (secure?: boolean) => string;
export declare const generateFastUUID: () => string;
export declare const generateSecureUUID: () => string;
export declare const now: () => number;
export declare const formatTime: (timestamp: number, options?: {
    includeTimezone?: boolean;
    includeMilliseconds?: boolean;
}) => string;
export declare const timeDiff: (start: number, end: number) => {
    hours: number;
    minutes: number;
    seconds: number;
};
export declare const createTimeRange: (start: number, duration: number) => {
    start: number;
    end: number;
    duration: number;
};
export declare const isTimeInRange: (timestamp: number, start: number, end: number) => boolean;
declare const _default: {
    uuid: {
        fast: () => string;
        secure: () => string;
        generate: (secure?: boolean) => string;
    };
    time: {
        now: () => number;
        format: (timestamp: number, options?: {
            includeTimezone?: boolean;
            includeMilliseconds?: boolean;
        }) => string;
        diff: (start: number, end: number) => {
            hours: number;
            minutes: number;
            seconds: number;
        };
        range: (start: number, duration: number) => {
            start: number;
            end: number;
            duration: number;
        };
        inRange: (timestamp: number, start: number, end: number) => boolean;
    };
    ObjectPool: typeof ObjectPool;
    EventBatcher: typeof EventBatcher;
    MetricsCollector: typeof MetricsCollector;
    metrics: MetricsCollector;
    eventBatcher: EventBatcher<any>;
    sessionPool: ObjectPool<any>;
    generateUUID: (secure?: boolean) => string;
    generateFastUUID: () => string;
    generateSecureUUID: () => string;
    now: () => number;
    formatTime: (timestamp: number, options?: {
        includeTimezone?: boolean;
        includeMilliseconds?: boolean;
    }) => string;
    timeDiff: (start: number, end: number) => {
        hours: number;
        minutes: number;
        seconds: number;
    };
    createTimeRange: (start: number, duration: number) => {
        start: number;
        end: number;
        duration: number;
    };
    isTimeInRange: (timestamp: number, start: number, end: number) => boolean;
};
export default _default;

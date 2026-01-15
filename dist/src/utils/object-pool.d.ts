import type { Session } from '../core/types.js';
export interface PoolConfig<T> {
    initialSize: number;
    maxPoolSize: number;
    minPoolSize: number;
    resetObject: (obj: T) => T;
    createObject: () => T;
    enableDynamicSizing: boolean;
    growthFactor: number;
    shrinkThreshold: number;
    shrinkIntervalMs: number;
}
export interface PoolStats {
    totalCreated: number;
    totalAcquired: number;
    totalReleased: number;
    currentPoolSize: number;
    activeObjects: number;
    peakPoolSize: number;
    poolHits: number;
    poolMisses: number;
    lastShrinkTime?: Date;
}
export declare class ObjectPool<T> {
    private config;
    private pool;
    private activeObjects;
    private stats;
    private shrinkTimer;
    private isGrowing;
    constructor(config: PoolConfig<T>);
    acquire(): T;
    release(obj: T): void;
    warmup(count?: number): void;
    shrink(): number;
    getStats(): PoolStats;
    clear(): void;
    dispose(): void;
    setDynamicSizing(enabled: boolean): void;
    updateConfig(newConfig: Partial<PoolConfig<T>>): void;
    private initializePool;
    private setupShrinking;
    private growPool;
    private createObject;
    private checkShrinkCondition;
    private updatePeakPoolSize;
}
export declare class SessionPool extends ObjectPool<Session> {
    private static nextId;
    constructor(config?: Partial<PoolConfig<Session>>);
    acquireSession(type: string, name: string, workspace: string): Session;
}
export declare function createPool<T>(config: PoolConfig<T>): ObjectPool<T>;
export declare const sessionPool: SessionPool;
export declare class HighFrequencyPool<T> extends ObjectPool<T> {
    constructor(createObject: () => T, resetObject: (obj: T) => T, config?: Partial<PoolConfig<T>>);
}
export declare class SimplePool<T> {
    private pool;
    private createObject;
    private resetObject;
    constructor(createObject: () => T, resetObject: (obj: T) => T);
    acquire(): T;
    release(obj: T): void;
    clear(): void;
}
export interface PoolBenchmark {
    operations: number;
    totalTime: number;
    avgAcquireTime: number;
    avgReleaseTime: number;
    poolUtilization: number;
    hitRate: number;
}
export declare function benchmarkPool<T>(pool: ObjectPool<T>, operations?: number): PoolBenchmark;

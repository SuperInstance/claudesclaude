export interface PoolConfig<T> {
    initialSize: number;
    maxSize: number;
    minSize: number;
    createObject: () => T;
    resetObject?: (obj: T) => T;
    destroyObject?: (obj: T) => void;
}
export interface PoolMetrics {
    totalAcquired: number;
    totalReleased: number;
    currentSize: number;
    maxSize: number;
    averageAcquireTime: number;
    averageReleaseTime: number;
}
export declare class SimplePool<T> {
    private pool;
    private inUse;
    private config;
    private metrics;
    private acquireTimes;
    private releaseTimes;
    constructor(config: PoolConfig<T>);
    acquire(): T;
    release(obj: T): void;
    getMetrics(): PoolMetrics;
    private updateMetrics;
    clear(): void;
    size(): number;
    inUseCount(): number;
}
export declare class StringPool extends SimplePool<string> {
    constructor(config?: Partial<PoolConfig<string>>);
}
export declare class SessionPool extends SimplePool<any> {
    constructor(config?: Partial<PoolConfig<any>>);
    acquireSession(type?: string, name?: string, workspace?: string): any;
}
export declare class TCPConnectionPool extends SimplePool<any> {
    private host;
    private port;
    private connectionConfig;
    constructor(host: string, port: number, config?: Partial<PoolConfig<any>>);
    getConnection(): Promise<any>;
    releaseConnection(conn: any): void;
}

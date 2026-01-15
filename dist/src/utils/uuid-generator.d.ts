export interface UUIDGenerationStrategy {
    generate(): string;
    isCryptographicallySecure(): boolean;
    throughput: number;
}
export declare class FastUUIDGenerator implements UUIDGenerationStrategy {
    private useCryptoRandom;
    constructor(useSecureRandom?: boolean);
    generate(): string;
    isCryptographicallySecure(): boolean;
    get throughput(): number;
    private generateSecure;
    private generateFast;
}
export declare class HybridUUIDGenerator implements UUIDGenerationStrategy {
    private cryptoGenerator;
    private fastGenerator;
    private useFastForHighThroughput;
    constructor();
    generate(): string;
    isCryptographicallySecure(): boolean;
    get throughput(): number;
    setUseFastMode(useFast: boolean): void;
}
export declare class ThreadSafeUUIDGenerator implements UUIDGenerationStrategy {
    private generators;
    private currentIndex;
    constructor(strategies?: UUIDGenerationStrategy[]);
    generate(): string;
    isCryptographicallySecure(): boolean;
    get throughput(): number;
    addStrategy(generator: UUIDGenerationStrategy): void;
}
export declare const uuidGenerator: HybridUUIDGenerator;
export declare function generateUUID(): string;
export declare function generateSecureUUID(): string;
export declare function generateFastUUID(): string;
export declare function benchmarkUUIDGeneration(generator: UUIDGenerationStrategy, iterations?: number): {
    time: number;
    throughput: number;
    uuid: string;
};
export declare function resetPerformanceCounter(): void;

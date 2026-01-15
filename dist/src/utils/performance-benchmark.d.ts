interface BenchmarkResult {
    name: string;
    time: number;
    operations: number;
    opsPerSecond: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
}
interface BenchmarkSuite {
    name: string;
    results: BenchmarkResult[];
}
export declare class PerformanceBenchmark {
    private suites;
    benchmarkSessionCreation(orchestrator: any, iterations?: number): BenchmarkResult;
    benchmarkSessionRetrieval(orchestrator: any, iterations?: number): BenchmarkResult;
    benchmarkMessageSending(orchestrator: any, iterations?: number): BenchmarkResult;
    benchmarkContextManagement(orchestrator: any, iterations?: number): BenchmarkResult;
    benchmarkQueryOperations(orchestrator: any, iterations?: number): BenchmarkResult;
    benchmarkMemoryUsage(orchestrator: any, iterations?: number): BenchmarkResult;
    runFullBenchmark(): Promise<BenchmarkSuite[]>;
    generateReport(): string;
    exportResults(): string;
}
export declare function quickBenchmark(): Promise<void>;
export {};

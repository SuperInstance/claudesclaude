interface MemoryStats {
    totalSessions: number;
    totalMessages: number;
    totalContexts: number;
    estimatedMemoryUsage: number;
    overhead: number;
}
export declare class MemoryOptimizer {
    private strategies;
    calculateMemoryStats(orchestrator: any): MemoryStats;
    optimizeMemory(orchestrator: any): void;
    getRecommendations(orchestrator: any): string[];
    generateMemoryReport(orchestrator: any): string;
    startMemoryMonitoring(orchestrator: any, intervalMs?: number): void;
}
export declare const memoryOptimizer: MemoryOptimizer;
export {};

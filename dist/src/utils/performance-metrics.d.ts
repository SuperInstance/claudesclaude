import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    operation: string;
    duration: number;
    timestamp: number;
    tags?: Record<string, any>;
    memory?: {
        used: number;
        total: number;
        delta: number;
    };
}
export interface MetricAggregation {
    totalOperations: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
    throughput: number;
    memoryStats?: {
        averageMemory: number;
        peakMemory: number;
        totalMemoryDelta: number;
    };
}
export interface PerformanceObserver {
    start(): void;
    end(): PerformanceMetrics;
    addTag(key: string, value: any): void;
}
export declare class PerformanceCollector extends EventEmitter {
    private enableMemoryMonitoring;
    private maxMetrics;
    private metrics;
    private activeOperations;
    private aggregations;
    private memorySamplingInterval;
    private memorySamples;
    private maxMemorySamples;
    constructor(enableMemoryMonitoring?: boolean, maxMetrics?: number);
    startOperation(operation: string, tags?: Record<string, any>): PerformanceObserver;
    endOperation(operationId: string, operation: string): PerformanceMetrics;
    recordMetric(metric: PerformanceMetrics): void;
    getOperationMetrics(operation: string, timeWindow?: number): MetricAggregation | null;
    getOperations(): string[];
    getAllMetrics(): PerformanceMetrics[];
    getMetrics(operation?: string, timeWindow?: number): PerformanceMetrics[];
    clearMetrics(): void;
    exportMetrics(format?: 'json' | 'csv' | 'summary', operation?: string): string;
    private aggregateMetrics;
    private calculatePercentile;
    private updateAggregation;
    private createNewAggregation;
    private startMemoryMonitoring;
    private stopMemoryMonitoring;
    private getMemoryInfo;
    private exportToCSV;
    private exportSummary;
    dispose(): void;
}

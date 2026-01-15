/**
 * High-Performance Metrics Collection System
 *
 * Provides efficient timing and performance measurement capabilities
 * with minimal overhead and support for hierarchical metrics.
 */

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
  throughput: number; // ops per second
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

export class PerformanceCollector extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, { startTime: number; tags: Record<string, any> }>();
  private aggregations = new Map<string, MetricAggregation>();
  private memorySamplingInterval: NodeJS.Timeout | null = null;
  private memorySamples: number[] = [];
  private maxMemorySamples = 1000;

  constructor(private enableMemoryMonitoring = false, private maxMetrics = 10000) {
    super();
    if (enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Start timing an operation
   */
  startOperation(operation: string, tags?: Record<string, any>): PerformanceObserver {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const startTime = performance.now();

    this.activeOperations.set(operationId, {
      startTime,
      tags: tags || {}
    });

    return {
      start: () => {}, // No-op for this implementation
      end: () => this.endOperation(operationId, operation),
      addTag: (key: string, value: any) => {
        const operationData = this.activeOperations.get(operationId);
        if (operationData) {
          operationData.tags[key] = value;
        }
      }
    };
  }

  /**
   * End timing an operation and record metrics
   */
  endOperation(operationId: string, operation: string): PerformanceMetrics {
    const operationData = this.activeOperations.get(operationId);
    if (!operationData) {
      throw new Error(`No active operation found for ID: ${operationId}`);
    }

    const endTime = performance.now();
    const duration = endTime - operationData.startTime;
    const timestamp = Date.now();

    const memoryInfo = this.getMemoryInfo();

    const metric: PerformanceMetrics = {
      operation,
      duration,
      timestamp,
      tags: operationData.tags,
      memory: memoryInfo
    };

    this.recordMetric(metric);
    this.activeOperations.delete(operationId);

    // Emit for real-time monitoring
    this.emit('metric', metric);

    return metric;
  }

  /**
   * Record a metric directly
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Maintain maximum metrics limit
    if (this.metrics.length > this.maxMetrics) {
      const excess = this.metrics.length - this.maxMetrics;
      this.metrics.splice(0, excess);
    }

    // Update aggregation
    this.updateAggregation(metric.operation, metric);
  }

  /**
   * Get aggregated metrics for an operation
   */
  getOperationMetrics(operation: string, timeWindow?: number): MetricAggregation | null {
    const operationMetrics = this.metrics.filter(m =>
      m.operation === operation &&
      (!timeWindow || (Date.now() - m.timestamp) < timeWindow)
    );

    if (operationMetrics.length === 0) {
      return null;
    }

    return this.aggregateMetrics(operationMetrics);
  }

  /**
   * Get all operation names
   */
  getOperations(): string[] {
    const operations = new Set(this.metrics.map(m => m.operation));
    return Array.from(operations);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics filtered by operation and time window
   */
  getMetrics(operation?: string, timeWindow?: number): PerformanceMetrics[] {
    let filtered = this.metrics;

    if (operation) {
      filtered = filtered.filter(m => m.operation === operation);
    }

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filtered = filtered.filter(m => m.timestamp >= cutoff);
    }

    return filtered;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.aggregations.clear();
    this.memorySamples = [];
  }

  /**
   * Export metrics in various formats
   */
  exportMetrics(format: 'json' | 'csv' | 'summary' = 'json', operation?: string): string {
    const metrics = operation ? this.getMetrics(operation) : this.metrics;

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      case 'csv':
        return this.exportToCSV(metrics);
      case 'summary':
        return this.exportSummary();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private aggregateMetrics(metrics: PerformanceMetrics[]): MetricAggregation {
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const memoryDeltas = metrics.map(m => m.memory?.delta || 0);

    const totalOperations = metrics.length;
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / totalOperations;
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];

    // Calculate percentiles
    const p95Duration = this.calculatePercentile(durations, 0.95);
    const p99Duration = this.calculatePercentile(durations, 0.99);

    const timeRange = Math.max(...metrics.map(m => m.timestamp)) - Math.min(...metrics.map(m => m.timestamp));
    const throughput = timeRange > 0 ? totalOperations / (timeRange / 1000) : 0;

    const memoryStats = {
      averageMemory: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
      peakMemory: Math.max(...memoryDeltas),
      totalMemoryDelta: memoryDeltas.reduce((sum, d) => sum + d, 0)
    };

    return {
      totalOperations,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      p95Duration,
      p99Duration,
      throughput,
      memoryStats
    };
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private updateAggregation(operation: string, metric: PerformanceMetrics): void {
    let aggregation = this.aggregations.get(operation);

    if (!aggregation) {
      aggregation = this.createNewAggregation();
      this.aggregations.set(operation, aggregation);
    }

    // Update aggregation with new metric
    aggregation.totalOperations++;
    aggregation.totalDuration += metric.duration;
    aggregation.averageDuration = aggregation.totalDuration / aggregation.totalOperations;

    if (metric.duration < aggregation.minDuration) {
      aggregation.minDuration = metric.duration;
    }
    if (metric.duration > aggregation.maxDuration) {
      aggregation.maxDuration = metric.duration;
    }

    if (metric.memory) {
      if (!aggregation.memoryStats) {
        aggregation.memoryStats = {
          averageMemory: 0,
          peakMemory: 0,
          totalMemoryDelta: 0
        };
      }
      aggregation.memoryStats.averageMemory =
        (aggregation.memoryStats.averageMemory * (aggregation.totalOperations - 1) + metric.memory.used) / aggregation.totalOperations;
      if (metric.memory.used > aggregation.memoryStats.peakMemory) {
        aggregation.memoryStats.peakMemory = metric.memory.used;
      }
      aggregation.memoryStats.totalMemoryDelta += metric.memory.delta;
    }

    // Recalculate throughput
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    const timeRange = Math.max(...operationMetrics.map(m => m.timestamp)) - Math.min(...operationMetrics.map(m => m.timestamp));
    aggregation.throughput = timeRange > 0 ? operationMetrics.length / (timeRange / 1000) : 0;
  }

  private createNewAggregation(): MetricAggregation {
    return {
      totalOperations: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      throughput: 0
    };
  }

  private startMemoryMonitoring(): void {
    this.memorySamplingInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.memorySamples.push(memoryUsage.heapUsed);

      if (this.memorySamples.length > this.maxMemorySamples) {
        this.memorySamples.shift();
      }
    }, 100); // Sample every 100ms
  }

  private stopMemoryMonitoring(): void {
    if (this.memorySamplingInterval) {
      clearInterval(this.memorySamplingInterval);
      this.memorySamplingInterval = null;
    }
  }

  private getMemoryInfo(): { used: number; total: number; delta: number } | undefined {
    if (!this.enableMemoryMonitoring) {
      return undefined;
    }

    const currentUsage = process.memoryUsage();
    const lastSample = this.memorySamples[this.memorySamples.length - 1] || 0;

    return {
      used: currentUsage.heapUsed,
      total: currentUsage.heapTotal,
      delta: currentUsage.heapUsed - lastSample
    };
  }

  private exportToCSV(metrics: PerformanceMetrics[]): string {
    const headers = ['operation', 'duration', 'timestamp', 'tags'];
    const rows = [headers.join(',')];

    for (const metric of metrics) {
      const tags = metric.tags ? JSON.stringify(metric.tags).replace(/"/g, '""') : '';
      rows.push([
        metric.operation,
        metric.duration.toString(),
        metric.timestamp.toString(),
        `"${tags}"`
      ].join(','));
    }

    return rows.join('\n');
  }

  private exportSummary(): string {
    const operationNames = this.getOperations();
    let summary = 'Performance Summary\n';
    summary += '===================\n\n';

    for (const operation of operationNames) {
      const agg = this.getOperationMetrics(operation);
      if (agg) {
        summary += `${operation}:\n`;
        summary += `  Operations: ${agg.totalOperations}\n`;
        summary += `  Avg Duration: ${agg.averageDuration.toFixed(2)}ms\n`;
        summary += `  Min Duration: ${agg.minDuration.toFixed(2)}ms\n`;
        summary += `  Max Duration: ${agg.maxDuration.toFixed(2)}ms\n`;
        summary += `  P95 Duration: ${agg.p95Duration.toFixed(2)}ms\n`;
        summary += `  Throughput: ${agg.throughput.toFixed(2)} ops/sec\n`;
        if (agg.memoryStats) {
          summary += `  Avg Memory: ${(agg.memoryStats.averageMemory / 1024 / 1024).toFixed(2)} MB\n`;
        }
        summary += '\n';
      }
    }

    return summary;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopMemoryMonitoring();
    this.removeAllListeners();
    this.clearMetrics();
  }
}
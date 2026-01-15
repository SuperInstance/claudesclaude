/**
 * Benchmark-Driven Orchestrator - Auto-Optimizing Performance
 * Continuously benchmarks and optimizes based on real workload data
 */

import type { Session, SessionType, Message } from './types.js';
import { NanoOrchestrator } from './nano-orchestrator.js';
import { JitOrchestrator } from './jit-orchestrator.js';
import { ZeroCopyOrchestrator } from './zerocopy-orchestrator.js';
import { SimdOrchestrator } from './simd-orchestrator.js';
import { TieredOrchestrator } from './tiered-orchestrator.js';

// Benchmark configuration
interface BenchmarkConfig {
  warmupRuns: number;
  measurementRuns: number;
  operationMix: {
    sessionCreation: number;
    sessionRetrieval: number;
    sessionUpdate: number;
    sessionDeletion: number;
    messageSending: number;
    queries: number;
  };
  memoryBudget: number;
  latencyTarget: number;
  throughputTarget: number;
}

// Benchmark results
interface BenchmarkResults {
  orchestrator: string;
  opsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsage: number;
  memoryEfficiency: number;
  score: number;
}

// Optimization recommendations
interface OptimizationRecommendation {
  action: 'switch' | 'tune' | 'monitor' | 'revert';
  target: string;
  reason: string;
  confidence: number;
  expectedImprovement: number;
}

// Benchmark-driven auto-optimizing orchestrator
export class BenchmarkOrchestrator {
  private nanoOrchestrator = new NanoOrchestrator();
  private jitOrchestrator = new JitOrchestrator();
  private zeroCopyOrchestrator = new ZeroCopyOrchestrator();
  private simdOrchestrator = new SimdOrchestrator();
  private tieredOrchestrator = new TieredOrchestrator();

  private orchestrators = {
    nano: this.nanoOrchestrator,
    jit: this.jitOrchestrator,
    zeroCopy: this.zeroCopyOrchestrator,
    simd: this.simdOrchestrator,
    tiered: this.tieredOrchestrator
  };

  private currentBest: keyof typeof this.orchestrators = 'nano';
  private benchmarkHistory: BenchmarkResults[] = [];
  private performanceHistory: Map<string, number[]> = new Map();
  private lastBenchmark = 0;
  private benchmarkInterval = 60000; // 1 minute
  private config: BenchmarkConfig;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      warmupRuns: 100,
      measurementRuns: 1000,
      operationMix: {
        sessionCreation: 0.1,
        sessionRetrieval: 0.3,
        sessionUpdate: 0.1,
        sessionDeletion: 0.05,
        messageSending: 0.2,
        queries: 0.25
      },
      memoryBudget: 100 * 1024 * 1024, // 100MB
      latencyTarget: 10, // ms
      throughputTarget: 1000, // ops/sec
      ...config
    };
  }

  // Run comprehensive benchmark
  async benchmarkOrchestrator(name: keyof typeof this.orchestrators): Promise<BenchmarkResults> {
    const orchestrator = this.orchestrators[name];
    const startTime = performance.now();

    // Warmup phase
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await this.benchmarkOperation(orchestrator, 'warmup');
    }

    // Measurement phase
    const measurements = {
      latencies: [] as number[],
      memorySamples: [] as number[],
      timestamps: [] as number[]
    };

    for (let i = 0; i < this.config.measurementRuns; i++) {
      const operation = this.selectOperation();
      const result = await this.benchmarkOperation(orchestrator, operation);

      if (result !== null) {
        measurements.latencies.push(result.latency);
        measurements.memorySamples.push(result.memory);
        measurements.timestamps.push(result.timestamp);
      }
    }

    const endTime = performance.now();
    const totalTime = (endTime - startTime) / 1000;

    // Calculate metrics
    const opsPerSecond = this.config.measurementRuns / totalTime;
    const avgLatency = measurements.latencies.reduce((a, b) => a + b, 0) / measurements.latencies.length;
    const sortedLatencies = [...measurements.latencies].sort((a, b) => a - b);
    const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
    const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];
    const avgMemory = measurements.memorySamples.reduce((a, b) => a + b, 0) / measurements.memorySamples.length;
    const memoryEfficiency = Math.min(1.0, avgMemory / this.config.memoryBudget);

    // Calculate composite score
    const latencyScore = Math.max(0, 100 - (avgLatency / this.config.latencyTarget) * 100);
    const throughputScore = Math.min(100, (opsPerSecond / this.config.throughputTarget) * 100);
    const memoryScore = memoryEfficiency * 100;
    const score = (latencyScore * 0.4 + throughputScore * 0.4 + memoryScore * 0.2);

    const result: BenchmarkResults = {
      orchestrator: name,
      opsPerSecond,
      averageLatency: avgLatency,
      p95Latency,
      p99Latency,
      memoryUsage: avgMemory,
      memoryEfficiency,
      score
    };

    // Store in history
    this.benchmarkHistory.push(result);
    this.performanceHistory.set(name, [
      ...(this.performanceHistory.get(name) || []),
      score
    ]);

    return result;
  }

  // Benchmark individual operation
  private async benchmarkOperation(
    orchestrator: any,
    operation: string
  ): Promise<{ latency: number; memory: number; timestamp: number } | null> {
    const startTime = performance.now();
    const memoryBefore = performance.memory?.usedJSHeapSize || 0;

    try {
      switch (operation) {
        case 'warmup':
          // Simple warmup operations
          orchestrator.createSession({
            type: 'agent',
            name: 'warmup',
            workspace: '/workspace/warmup'
          });
          orchestrator.clearAll();
          break;

        case 'sessionCreation':
          orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          break;

        case 'sessionRetrieval':
          const session = orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          orchestrator.getSession(session.id);
          break;

        case 'sessionUpdate':
          const updateSession = orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          orchestrator.updateSession(updateSession.id, { name: 'updated' });
          break;

        case 'sessionDeletion':
          const deleteSession = orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          orchestrator.deleteSession(deleteSession.id);
          break;

        case 'messageSending':
          const msgSession = orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          orchestrator.sendMessage(msgSession.id, {
            role: 'user',
            content: 'benchmark message'
          });
          break;

        case 'queries':
          const querySession = orchestrator.createSession({
            type: 'agent' as SessionType,
            name: 'benchmark',
            workspace: '/workspace/benchmark'
          });
          orchestrator.getSessionsByType('agent');
          orchestrator.getSessionsByStatus('active');
          orchestrator.getWorkspaceSessions('/workspace/benchmark');
          break;

        default:
          return null;
      }

      const endTime = performance.now();
      const memoryAfter = performance.memory?.usedJSHeapSize || 0;
      const latency = endTime - startTime;
      const memory = memoryAfter - memoryBefore;

      return {
        latency,
        memory: Math.max(0, memory),
        timestamp: Date.now()
      };
    } catch (error) {
      return null;
    }
  }

  // Select operation based on configured mix
  private selectOperation(): string {
    const mix = this.config.operationMix;
    const operations = [
      'sessionCreation',
      'sessionRetrieval',
      'sessionUpdate',
      'sessionDeletion',
      'messageSending',
      'queries'
    ];

    const weights = [
      mix.sessionCreation,
      mix.sessionRetrieval,
      mix.sessionUpdate,
      mix.sessionDeletion,
      mix.messageSending,
      mix.queries
    ];

    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return operations[i];
      }
    }

    return operations[operations.length - 1];
  }

  // Auto-optimize based on benchmarks
  async optimize(): Promise<OptimizationRecommendation> {
    if (Date.now() - this.lastBenchmark < this.benchmarkInterval) {
      return {
        action: 'monitor',
        target: 'all',
        reason: 'Benchmark interval not reached',
        confidence: 1.0,
        expectedImprovement: 0
      };
    }

    // Benchmark all orchestrators
    const results: BenchmarkResults[] = [];
    for (const name of Object.keys(this.orchestrators)) {
      const result = await this.benchmarkOrchestrator(name as keyof typeof this.orchestrators);
      results.push(result);
    }

    // Find best orchestrator
    const bestResult = results.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // Generate recommendation
    const currentScore = this.benchmarkHistory
      .filter(r => r.orchestrator === this.currentBest)
      .reduce((sum, r, _, arr) => sum + r.score / arr.length, 0);

    if (bestResult.score > currentScore * 1.1) {
      this.currentBest = bestResult.orchestrator as keyof typeof this.orchestrators;
      this.lastBenchmark = Date.now();

      return {
        action: 'switch',
        target: bestResult.orchestrator,
        reason: `Performance improved by ${((bestResult.score - currentScore) / currentScore * 100).toFixed(1)}%`,
        confidence: 0.9,
        expectedImprovement: bestResult.score - currentScore
      };
    }

    return {
      action: 'monitor',
      target: 'all',
      reason: 'Current orchestrator performing optimally',
      confidence: 0.95,
      expectedImprovement: 0
    };
  }

  // Public session operations using best orchestrator
  createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Session {
    return this.orchestrators[this.currentBest].createSession(config);
  }

  getSession(id: string): Session | undefined {
    return this.orchestrators[this.currentBest].getSession(id);
  }

  updateSession(id: string, updates: Partial<Session>): Session | undefined {
    return this.orchestrators[this.currentBest].updateSession(id, updates);
  }

  deleteSession(id: string): boolean {
    return this.orchestrators[this.currentBest].deleteSession(id);
  }

  setContext(sessionId: string, context: any): void {
    this.orchestrators[this.currentBest].setContext(sessionId, context);
  }

  getContext(sessionId: string): any {
    return this.orchestrators[this.currentBest].getContext(sessionId);
  }

  sendMessage(sessionId: string, message: Message): boolean {
    return this.orchestrators[this.currentBest].sendMessage(sessionId, message);
  }

  processMessages(): number {
    return this.orchestrators[this.currentBest].processMessages();
  }

  getAllSessions(): Session[] {
    return this.orchestrators[this.currentBest].getAllSessions();
  }

  getSessionsByType(type: SessionType): Session[] {
    return this.orchestrators[this.currentBest].getSessionsByType(type);
  }

  getSessionsByStatus(status: string): Session[] {
    return this.orchestrators[this.currentBest].getSessionsByStatus(status);
  }

  getWorkspaceSessions(workspace: string): Session[] {
    return this.orchestrators[this.currentBest].getWorkspaceSessions(workspace);
  }

  // Enhanced metrics
  getMetrics() {
    const currentMetrics = this.orchestrators[this.currentBest].getMetrics();
    const currentScore = this.benchmarkHistory
      .filter(r => r.orchestrator === this.currentBest)
      .reduce((sum, r, _, arr) => sum + r.score / arr.length, 0);

    return {
      ...currentMetrics,
      autoOptimized: true,
      currentBest: this.currentBest,
      currentScore,
      benchmarksRun: this.benchmarkHistory.length,
      lastBenchmark: this.lastBenchmark,
      benchmarkInterval: this.benchmarkInterval,
      optimizationConfidence: this.getOptimizationConfidence()
    };
  }

  // Calculate optimization confidence based on history
  private getOptimizationConfidence(): number {
    if (this.benchmarkHistory.length < 3) return 0.5;

    const recent = this.benchmarkHistory.slice(-10);
    const consistency = recent.filter(r => r.orchestrator === this.currentBest).length / recent.length;
    return Math.min(0.95, consistency);
  }

  // Utility methods
  getSessionCount(): number {
    return this.orchestrators[this.currentBest].getSessionCount();
  }

  clearAll(): void {
    this.orchestrators[this.currentBest].clearAll();
  }

  healthCheck() {
    return this.orchestrators[this.currentBest].healthCheck();
  }

  exportSessions(): any[] {
    return this.orchestrators[this.currentBest].exportSessions();
  }

  importSessions(sessions: any[]): void {
    sessions.forEach(s => {
      this.createSession({
        type: s.type,
        name: s.name,
        workspace: s.workspace,
        config: s.config
      });
    });
  }

  // Event methods
  onSessionCreated(callback: (session: Session) => void) {
    this.orchestrators[this.currentBest].onSessionCreated(callback);
  }
  onSessionUpdated(callback: (session: Session) => void) {
    this.orchestrators[this.currentBest].onSessionUpdated(callback);
  }
  onSessionDeleted(callback: (session: Session) => void) {
    this.orchestrators[this.currentBest].onSessionDeleted(callback);
  }
  onMessage(callback: (message: Message) => void) {
    this.orchestrators[this.currentBest].onMessage(callback);
  }

  // Manual control
  setCurrentOrchestrator(name: keyof typeof this.orchestrators): void {
    if (this.orchestrators[name]) {
      this.currentBest = name;
      console.log(`Set orchestrator to ${name}`);
    }
  }

  getBenchmarkHistory(): BenchmarkResults[] {
    return [...this.benchmarkHistory];
  }

  async forceBenchmark(): Promise<BenchmarkResults[]> {
    this.lastBenchmark = 0; // Force immediate benchmark
    const results: BenchmarkResults[] = [];
    for (const name of Object.keys(this.orchestrators)) {
      const result = await this.benchmarkOrchestrator(name as keyof typeof this.orchestrators);
      results.push(result);
    }
    return results;
  }
}

// Factory function
export function createBenchmarkOrchestrator(config?: Partial<BenchmarkConfig>): BenchmarkOrchestrator {
  return new BenchmarkOrchestrator(config);
}

// Default instance
export const benchmarkOrchestrator = createBenchmarkOrchestrator();
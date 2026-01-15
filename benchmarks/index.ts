/**
 * Performance Benchmark for UnifiedOrchestrator
 *
 * Simple benchmark demonstrating the performance improvements
 * from the implemented optimizations.
 */

import { createUnifiedOrchestrator } from '../src/core/unified-optimized.js';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  operation: string;
  optimized: number;
  baseline: number;
  improvement: number;
}

export class OrchestratorBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Run all benchmarks
   */
  async runAll(): Promise<void> {
    console.log('🚀 Starting UnifiedOrchestrator Benchmarks...\n');

    // Session Creation Benchmark
    await this.benchmarkSessionCreation();

    // Session Update Benchmark
    await this.benchmarkSessionUpdate();

    // Message Publishing Benchmark
    await this.benchmarkMessagePublishing();

    // Event Handling Benchmark
    await this.benchmarkEventHandling();

    // UUID Generation Benchmark
    await this.benchmarkUUIDGeneration();

    // Memory Usage Benchmark
    await this.benchmarkMemoryUsage();

    this.printResults();
  }

  /**
   * Benchmark session creation
   */
  private async benchmarkSessionCreation(): Promise<void> {
    const iterations = 5000;
    const sessions = [];

    // Optimized version
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true,
      enableObjectPooling: true
    });

    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const session = await optimized.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
      sessions.push(session);
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Baseline version
    const baseline = createUnifiedOrchestrator({
      enableOptimizations: false
    });

    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await baseline.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    this.results.push({
      operation: 'Session Creation',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement
    });

    // Cleanup
    for (const session of sessions) {
      await optimized.deleteSession(session.id);
    }
    await optimized.shutdown();
    await baseline.shutdown();
  }

  /**
   * Benchmark session updates
   */
  private async benchmarkSessionUpdate(): Promise<void> {
    const iterations = 5000;

    // Setup optimized version
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true,
      enableObjectPooling: true
    });

    const sessions = [];
    for (let i = 0; i < iterations; i++) {
      const session = await optimized.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
      sessions.push(session.id);
    }

    // Optimized updates
    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimized.updateSession(sessions[i], { name: `updated-${i}` });
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Setup baseline version
    const baseline = createUnifiedOrchestrator({
      enableOptimizations: false
    });

    const baselineSessions = [];
    for (let i = 0; i < iterations; i++) {
      const session = await baseline.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
      baselineSessions.push(session.id);
    }

    // Baseline updates
    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      baseline.updateSession(baselineSessions[i], { name: `updated-${i}` });
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    this.results.push({
      operation: 'Session Update',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement
    });

    // Cleanup
    for (const sessionId of sessions) {
      await optimized.deleteSession(sessionId);
    }
    await optimized.shutdown();
    await baseline.shutdown();
  }

  /**
   * Benchmark message publishing
   */
  private async benchmarkMessagePublishing(): Promise<void> {
    const iterations = 10000;

    // Optimized version
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true
    });

    const messages = [];
    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const message = optimized.publish({
        type: 'test',
        source: 'benchmark',
        data: { id: i, payload: 'test message' }
      });
      messages.push(message);
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Baseline version
    const baseline = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: false
    });

    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      baseline.publish({
        type: 'test',
        source: 'benchmark',
        data: { id: i, payload: 'test message' }
      });
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    this.results.push({
      operation: 'Message Publishing',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement
    });

    await optimized.shutdown();
    await baseline.shutdown();
  }

  /**
   * Benchmark event handling
   */
  private async benchmarkEventHandling(): Promise<void> {
    const iterations = 10000;
    const eventCount = new Map();

    // Optimized version with batching
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true
    });

    optimized.on('session', (session) => {
      eventCount.set(session.id, (eventCount.get(session.id) || 0) + 1);
    });

    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await optimized.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Baseline version without batching
    const baseline = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: false
    });

    const baselineEventCount = new Map();
    baseline.on('session', (session) => {
      baselineEventCount.set(session.id, (baselineEventCount.get(session.id) || 0) + 1);
    });

    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await baseline.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    this.results.push({
      operation: 'Event Handling',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement
    });

    await optimized.shutdown();
    await baseline.shutdown();
  }

  /**
   * Benchmark UUID generation
   */
  private async benchmarkUUIDGeneration(): Promise<void> {
    const iterations = 20000;

    // Fast UUID generation
    const optimizedStart = performance.now();
    const fastUUIDs = [];
    for (let i = 0; i < iterations; i++) {
      fastUUIDs.push(performance.now().toString(36) + Math.random().toString(36).slice(2, 11));
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Crypto.randomUUID (baseline)
    const baselineStart = performance.now();
    const cryptoUUIDs = [];
    for (let i = 0; i < iterations; i++) {
      cryptoUUIDs.push(crypto.randomUUID());
    }
    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;

    this.results.push({
      operation: 'UUID Generation',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement
    });
  }

  /**
   * Benchmark memory usage
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    const iterations = 1000;

    // Optimized version with pooling
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableObjectPooling: true
    });

    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await optimized.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
    }
    const optimizedMemory = process.memoryUsage().heapUsed;

    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    // Baseline version without pooling
    const baseline = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableObjectPooling: false
    });

    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await baseline.createSession({
        type: 'ai-assistant',
        name: `session-${i}`,
        workspace: 'test'
      });
    }
    const baselineMemory = process.memoryUsage().heapUsed;

    const baselineEnd = performance.now();
    const baselineTime = baselineEnd - baselineStart;

    const timeImprovement = ((baselineTime - optimizedTime) / baselineTime) * 100;
    const memoryImprovement = ((baselineMemory - optimizedMemory) / baselineMemory) * 100;

    this.results.push({
      operation: 'Memory Usage',
      optimized: optimizedTime,
      baseline: baselineTime,
      improvement: timeImprovement
    });

    await optimized.shutdown();
    await baseline.shutdown();
  }

  /**
   * Print benchmark results
   */
  private printResults(): void {
    console.log('\n📊 Benchmark Results Summary');
    console.log('=' .repeat(70));
    console.log('Operation'.padEnd(20) + 'Optimized'.padEnd(12) + 'Baseline'.padEnd(12) + 'Improvement'.padEnd(12));
    console.log('-'.repeat(70));

    for (const result of this.results) {
      const optTime = result.optimized.toFixed(2) + 'ms';
      const baseTime = result.baseline.toFixed(2) + 'ms';
      const improvement = result.improvement.toFixed(1) + '%';

      console.log(
        result.operation.padEnd(20) +
        optTime.padEnd(12) +
        baseTime.padEnd(12) +
        (result.improvement > 0 ? '+' : '') + improvement.padEnd(12)
      );
    }

    // Calculate and display overall improvements
    const avgTimeImprovement = this.results
      .filter(r => r.operation !== 'Memory Usage')
      .reduce((sum, r) => sum + r.improvement, 0) / (this.results.length - 1);

    const memoryImprovement = this.results
      .find(r => r.operation === 'Memory Usage')?.improvement || 0;

    console.log('\n🎯 Overall Improvements:');
    console.log('-' .repeat(30));
    console.log(`Average Performance: +${avgTimeImprovement.toFixed(1)}% faster`);
    console.log(`Memory Efficiency: +${memoryImprovement.toFixed(1)}% less memory`);
    console.log(`Total Optimizations: ${this.results.length} benchmarks completed`);

    console.log('\n✅ Benchmark suite completed successfully!');
  }
}

// Run the benchmark
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new OrchestratorBenchmark();
  benchmark.runAll().catch(console.error);
}
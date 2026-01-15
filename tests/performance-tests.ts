/**
 * Performance Tests for UnifiedOrchestrator Optimizations
 *
 * Comprehensive benchmark suite comparing the performance of
 * the original vs optimized implementations.
 */

import { createUnifiedOrchestrator } from '../src/core/unified-optimized.js';
import { uuidGenerator, benchmarkUUIDGeneration } from '../src/utils/uuid-generator.js';
import { benchmarkPool } from '../src/utils/object-pool.js';
import { PerformanceCollector } from '../src/utils/performance-metrics.js';

// Test configuration
const TEST_ITERATIONS = 10000;
const WARMUP_ITERATIONS = 1000;

// Performance test suite
export class PerformanceTestSuite {
  private results: Map<string, any> = new Map();
  private performanceCollector = new PerformanceCollector(true);

  /**
   * Run all performance tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Performance Test Suite...\n');

    // Warm-up phase
    console.log('🔥 Warming up...');
    await this.warmup();

    // UUID Generation Tests
    console.log('📊 Testing UUID Generation Performance...');
    await this.testUUIDGeneration();

    // Object Pool Tests
    console.log('📊 Testing Object Pool Performance...');
    await this.testObjectPool();

    // Session Manager Tests
    console.log('📊 Testing Session Manager Performance...');
    await this.testSessionManager();

    // Event Batching Tests
    console.log('📊 Testing Event Batching Performance...');
    await this.testEventBatching();

    // Memory Usage Tests
    console.log('📊 Testing Memory Usage...');
    await this.testMemoryUsage();

    // Report Results
    this.reportResults();
  }

  /**
   * Warm-up phase to avoid JIT compiler effects
   */
  private async warmup(): Promise<void> {
    const orchestrator = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true,
      enableObjectPooling: true
    });

    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      await orchestrator.createSession({
        type: 'ai-assistant',
        name: `warmup-${i}`,
        workspace: 'test'
      });
      orchestrator.deleteSession(`warmup-${i}`);
    }

    await orchestrator.shutdown();
  }

  /**
   * Test UUID Generation Performance
   */
  private async testUUIDGeneration(): Promise<void> {
    const strategies = ['fast', 'secure', 'hybrid'];
    const results = {};

    for (const strategy of strategies) {
      const { time, throughput, uuid } = benchmarkUUIDGeneration(
        strategy === 'secure'
          ? new (class { generate() { return crypto.randomUUID(); } isCryptographicallySecure() { return true; } get throughput() { return 50; } })()
          : uuidGenerator,
        TEST_ITERATIONS
      );

      results[strategy] = {
        time: time.toFixed(2),
        throughput: throughput.toFixed(0),
        uuid: uuid
      };
    }

    this.results.set('uuid-generation', results);
  }

  /**
   * Test Object Pool Performance
   */
  private async testObjectPool(): Promise<void> {
    const { sessionPool } = await import('../src/utils/object-pool.js');

    // Test with pooling enabled
    sessionPool.warmup(100);
    const pooledResults = benchmarkPool(sessionPool, TEST_ITERATIONS);

    // Test without pooling
    const directResults = this.testDirectAllocation(TEST_ITERATIONS);

    this.results.set('object-pool', {
      pooled: {
        avgAcquireTime: pooledResults.avgAcquireTime.toFixed(4),
        avgReleaseTime: pooledResults.avgReleaseTime.toFixed(4),
        hitRate: (pooledResults.hitRate * 100).toFixed(2),
        utilization: (pooledResults.poolUtilization * 100).toFixed(2)
      },
      direct: {
        avgTime: directResults.avgTime.toFixed(4)
      },
      improvement: ((directResults.avgTime - pooledResults.avgAcquireTime) / directResults.avgTime * 100).toFixed(2)
    });
  }

  /**
   * Test Session Manager Performance
   */
  private async testSessionManager(): Promise<void> {
    // Test optimized orchestrator
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true,
      enableObjectPooling: true
    });

    const optimizedResults = await this.testOrchestratorPerformance(optimized, 'optimized');

    // Test unoptimized orchestrator
    const unoptimized = createUnifiedOrchestrator({
      enableOptimizations: false
    });

    const unoptimizedResults = await this.testOrchestratorPerformance(unoptimized, 'unoptimized');

    this.results.set('session-manager', {
      optimized: optimizedResults,
      unoptimized: unoptimizedResults,
      improvements: {
        sessionCreation: ((unoptimizedResults.sessionCreation - optimizedResults.sessionCreation) / unoptimizedResults.sessionCreation * 100).toFixed(2),
        sessionUpdate: ((unoptimizedResults.sessionUpdate - optimizedResults.sessionUpdate) / unoptimizedResults.sessionUpdate * 100).toFixed(2),
        memoryUsage: ((unoptimizedResults.memoryUsage - optimizedResults.memoryUsage) / unoptimizedResults.memoryUsage * 100).toFixed(2)
      }
    });

    await optimized.shutdown();
    await unoptimized.shutdown();
  }

  /**
   * Test Event Batching Performance
   */
  private async testEventBatching(): Promise<void> {
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: true
    });

    const unoptimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableEventBatching: false
    });

    const optimizedResults = await this.testEventPerformance(optimized, 'optimized');
    const unoptimizedResults = await this.testEventPerformance(unoptimized, 'unoptimized');

    this.results.set('event-batching', {
      optimized: optimizedResults,
      unoptimized: unoptimizedResults,
      improvement: ((unoptimizedResults.time - optimizedResults.time) / unoptimizedResults.time * 100).toFixed(2)
    });

    await optimized.shutdown();
    await unoptimized.shutdown();
  }

  /**
   * Test Memory Usage
   */
  private async testMemoryUsage(): Promise<void> {
    // Test memory usage with optimizations
    const optimized = createUnifiedOrchestrator({
      enableOptimizations: true,
      enableObjectPooling: true
    });

    await this.createSessions(optimized, 1000);
    const optimizedMemory = process.memoryUsage().heapUsed;

    // Test memory usage without optimizations
    const unoptimized = createUnifiedOrchestrator({
      enableOptimizations: false
    });

    await this.createSessions(unoptimized, 1000);
    const unoptimizedMemory = process.memoryUsage().heapUsed;

    // Cleanup
    await optimized.shutdown();
    await unoptimized.shutdown();

    this.results.set('memory-usage', {
      optimized: optimizedMemory,
      unoptimized: unoptimizedMemory,
      improvement: ((unoptimizedMemory - optimizedMemory) / unoptimizedMemory * 100).toFixed(2)
    });
  }

  /**
   * Test orchestrator performance
   */
  private async testOrchestratorPerformance(orchestrator: any, type: string): Promise<any> {
    const sessionResults = this.measureOperation(async () => {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        await orchestrator.createSession({
          type: 'ai-assistant',
          name: `test-${i}`,
          workspace: 'test'
        });
      }
    });

    const updateResults = this.measureOperation(async () => {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        orchestrator.updateSession(`test-${i}`, { name: `updated-${i}` });
      }
    });

    return {
      sessionCreation: sessionResults.avgTime,
      sessionUpdate: updateResults.avgTime,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Test event performance
   */
  private async testEventPerformance(orchestrator: any, type: string): Promise<any> {
    let eventCount = 0;
    orchestrator.on('message', () => eventCount++);

    const time = this.measureOperation(() => {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        orchestrator.publish({
          type: 'test',
          source: 'test',
          data: { id: i }
        });
      }
    }).totalTime;

    return {
      time,
      eventsProcessed: eventCount
    };
  }

  /**
   * Test direct object allocation (without pooling)
   */
  private testDirectAllocation(iterations: number): any {
    const createSession = () => ({
      id: crypto.randomUUID(),
      type: 'ai-assistant' as const,
      name: `session-${Math.random()}`,
      workspace: 'test',
      config: {},
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return this.measureOperation(() => {
      const sessions = [];
      for (let i = 0; i < iterations; i++) {
        const session = createSession();
        sessions.push(session);
      }
    });
  }

  /**
   * Create multiple sessions for memory testing
   */
  private async createSessions(orchestrator: any, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await orchestrator.createSession({
        type: 'ai-assistant',
        name: `memory-test-${i}`,
        workspace: 'test'
      });
    }
  }

  /**
   * Measure operation performance
   */
  private measureOperation<T>(operation: () => T | Promise<T>): { totalTime: number; avgTime: number } {
    const start = performance.now();
    const result = operation();
    const end = performance.now();
    const totalTime = end - start;
    return {
      totalTime,
      avgTime: totalTime
    };
  }

  /**
   * Generate performance report
   */
  private reportResults(): void {
    console.log('\n📈 Performance Test Results\n');
    console.log('=' .repeat(50));

    // UUID Generation Results
    const uuidResults = this.results.get('uuid-generation');
    console.log('\n🔑 UUID Generation Performance:');
    console.log('-'.repeat(30));
    for (const [strategy, results] of Object.entries(uuidResults as any)) {
      console.log(`${strategy.padEnd(10)}: ${results.time.padEnd(8)}ms, ${results.throughput.padEnd(8)} UUIDs/sec`);
    }

    // Object Pool Results
    const poolResults = this.results.get('object-pool');
    console.log('\n🏊 Object Pool Performance:');
    console.log('-'.repeat(30));
    console.log(`Pooled    : ${poolResults.pooled.avgAcquireTime.padEnd(8)}ms (acquire), ${poolResults.pooled.avgReleaseTime.padEnd(8)}ms (release)`);
    console.log(`Direct    : ${poolResults.direct.avgTime.padEnd(8)}ms`);
    console.log(`Improvement: ${poolResults.improvement.padEnd(6)}% faster`);

    // Session Manager Results
    const sessionResults = this.results.get('session-manager');
    console.log('\n🎯 Session Manager Performance:');
    console.log('-'.repeat(30));
    console.log(`Session Creation:`);
    console.log(`  Optimized  : ${sessionResults.optimized.sessionCreation.toFixed(4)}ms`);
    console.log(`  Unoptimized: ${sessionResults.unoptimized.sessionCreation.toFixed(4)}ms`);
    console.log(`  Improvement: ${sessionResults.improvements.sessionCreation}% faster`);
    console.log(`\nSession Update:`);
    console.log(`  Optimized  : ${sessionResults.optimized.sessionUpdate.toFixed(4)}ms`);
    console.log(`  Unoptimized: ${sessionResults.unoptimized.sessionUpdate.toFixed(4)}ms`);
    console.log(`  Improvement: ${sessionResults.improvements.sessionUpdate}% faster`);

    // Event Batching Results
    const eventResults = this.results.get('event-batching');
    console.log('\n📨 Event Batching Performance:');
    console.log('-'.repeat(30));
    console.log(`Optimized  : ${eventResults.optimized.time.toFixed(4)}ms`);
    console.log(`Unoptimized: ${eventResults.unoptimized.time.toFixed(4)}ms`);
    console.log(`Improvement: ${eventResults.improvement}% faster`);

    // Memory Usage Results
    const memoryResults = this.results.get('memory-usage');
    console.log('\n💾 Memory Usage:');
    console.log('-'.repeat(30));
    console.log(`Optimized  : ${(memoryResults.optimized / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Unoptimized: ${(memoryResults.unoptimized / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Improvement: ${memoryResults.improvement}% less memory usage`);

    console.log('\n🎉 Performance Test Suite Complete!');
    console.log('=' .repeat(50));
  }
}

// Run the performance tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new PerformanceTestSuite();
  testSuite.runAllTests().catch(console.error);
}
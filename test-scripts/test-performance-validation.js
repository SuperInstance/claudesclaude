// Comprehensive performance validation test
import { NanoOrchestrator } from './dist/src/core/nano-orchestrator.js';
import { AdaptiveOrchestrator } from './dist/src/core/adaptive-orchestrator.js';
import { JitOrchestrator } from './dist/src/core/jit-orchestrator.js';
import { ZeroCopyOrchestrator } from './dist/src/core/zerocopy-orchestrator.js';
import { SimdOrchestrator } from './dist/src/core/simd-orchestrator.js';
import { TieredOrchestrator } from './dist/src/core/tiered-orchestrator.js';
import { BenchmarkOrchestrator } from './dist/src/core/benchmark-orchestrator.js';

// Performance test suite
const orchestrators = {
  nano: new NanoOrchestrator(),
  adaptive: new AdaptiveOrchestrator(),
  jit: new JitOrchestrator(),
  zeroCopy: new ZeroCopyOrchestrator(),
  simd: new SimdOrchestrator(),
  tiered: new TieredOrchestrator(),
  benchmark: new BenchmarkOrchestrator()
};

// Test configuration
const testConfig = {
  sessionCount: 1000,
  messageCount: 5000,
  queryCount: 2000,
  repeatRuns: 3
};

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.results = new Map();
  }

  async runTest(name, testFunc) {
    console.log(`Running ${name}...`);
    const runTimes = [];
    const memorySamples = [];

    for (let i = 0; i < testConfig.repeatRuns; i++) {
      const startMemory = performance.memory?.usedJSHeapSize || 0;
      const startTime = performance.now();

      await testFunc();

      const endTime = performance.now();
      const endMemory = performance.memory?.usedJSHeapSize || 0;

      runTimes.push(endTime - startTime);
      memorySamples.push(endMemory - startMemory);
    }

    const avgTime = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
    const avgMemory = memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length;

    this.results.set(name, {
      avgTime,
      avgMemory,
      opsPerSecond: (testConfig.sessionCount + testConfig.messageCount + testConfig.queryCount) / avgTime * 1000,
      memoryEfficiency: 1 - (avgMemory / (100 * 1024 * 1024))
    });

    console.log(`${name} - Average time: ${avgTime.toFixed(2)}ms, Memory: ${(avgMemory / 1024).toFixed(2)}KB, Ops/sec: ${((testConfig.sessionCount + testConfig.messageCount + testConfig.queryCount) / avgTime * 1000).toFixed(2)}`);
  }

  getResults() {
    return this.results;
  }
}

// Test runner
async function runPerformanceTests() {
  const collector = new PerformanceCollector();

  // Test session creation performance
  for (const [name, orchestrator] of Object.entries(orchestrators)) {
    await collector.runTest(`${name}_session_creation`, async () => {
      for (let i = 0; i < testConfig.sessionCount; i++) {
        orchestrator.createSession({
          type: 'agent',
          name: `Test Session ${i}`,
          workspace: `/workspace/test/${i}`,
          config: { id: i, data: `test-data-${i}` }
        });
      }
    });
  }

  // Reset orchestrators for next test
  for (const orchestrator of Object.values(orchestrators)) {
    orchestrator.clearAll();
  }

  // Test message handling performance
  for (const [name, orchestrator] of Object.entries(orchestrators)) {
    // First create sessions
    for (let i = 0; i < 100; i++) {
      orchestrator.createSession({
        type: 'agent',
        name: `Test Session ${i}`,
        workspace: `/workspace/test/${i}`
      });
    }

    await collector.runTest(`${name}_message_handling`, async () => {
      const sessions = orchestrator.getAllSessions();
      for (let i = 0; i < testConfig.messageCount; i++) {
        const session = sessions[i % sessions.length];
        orchestrator.sendMessage(session.id, {
          role: 'user',
          content: `Test message ${i}`,
          metadata: { id: i }
        });
      }
    });
  }

  // Reset orchestrators
  for (const orchestrator of Object.values(orchestrators)) {
    orchestrator.clearAll();
  }

  // Test query performance
  for (const [name, orchestrator] of Object.entries(orchestrators)) {
    // Create test data
    for (let i = 0; i < 500; i++) {
      orchestrator.createSession({
        type: i < 250 ? 'agent' : 'user',
        name: `Test Session ${i}`,
        workspace: i < 100 ? '/workspace/alpha' : i < 200 ? '/workspace/beta' : '/workspace/gamma',
        config: { priority: i % 5 }
      });
    }

    await collector.runTest(`${name}_query_performance`, async () => {
      for (let i = 0; i < testConfig.queryCount; i++) {
        if (i % 4 === 0) {
          orchestrator.getSessionsByType('agent');
        } else if (i % 4 === 1) {
          orchestrator.getSessionsByStatus('active');
        } else if (i % 4 === 2) {
          orchestrator.getWorkspaceSessions('/workspace/alpha');
        } else {
          orchestrator.getAllSessions();
        }
      }
    });
  }

  // Generate performance report
  console.log('\n=== PERFORMANCE VALIDATION REPORT ===');
  const results = collector.getResults();

  // Find best performers
  const bestCreation = Array.from(results.entries())
    .filter(([key]) => key.includes('session_creation'))
    .sort((a, b) => b[1].avgTime - a[1].avgTime)[0];

  const bestMessaging = Array.from(results.entries())
    .filter(([key]) => key.includes('message_handling'))
    .sort((a, b) => b[1].avgTime - a[1].avgTime)[0];

  const bestQuery = Array.from(results.entries())
    .filter(([key]) => key.includes('query_performance'))
    .sort((a, b) => b[1].avgTime - a[1].avgTime)[0];

  console.log('\nBest Performers by Category:');
  console.log(`Session Creation: ${bestCreation[0]} (${bestCreation[1].avgTime.toFixed(2)}ms)`);
  console.log(`Message Handling: ${bestMessaging[0]} (${bestMessaging[1].avgTime.toFixed(2)}ms)`);
  console.log(`Query Performance: ${bestQuery[0]} (${bestQuery[1].avgTime.toFixed(2)}ms)`);

  // Overall ranking
  console.log('\n=== OVERALL PERFORMANCE RANKING ===');
  const overallScores = new Map();

  for (const [name, metrics] of results) {
    const score = metrics.opsPerSecond * metrics.memoryEfficiency;
    overallScores.set(name, score);
  }

  Array.from(overallScores.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, score]) => {
      console.log(`${name}: ${score.toFixed(2)} points`);
    });

  // Test functionality
  console.log('\n=== FUNCTIONALITY VALIDATION ===');
  for (const [name, orchestrator] of Object.entries(orchestrators)) {
    try {
      const testSession = orchestrator.createSession({
        type: 'agent',
        name: 'Functionality Test',
        workspace: '/workspace/test'
      });

      const retrieved = orchestrator.getSession(testSession.id);
      const updated = orchestrator.updateSession(testSession.id, { name: 'Updated Name' });
      const deleted = orchestrator.deleteSession(testSession.id);

      console.log(`${name}: ${retrieved && updated && deleted ? '✓ PASS' : '✗ FAIL'}`);
    } catch (error) {
      console.log(`${name}: ✗ ERROR - ${error.message}`);
    }
  }

  // Test memory management
  console.log('\n=== MEMORY MANAGEMENT VALIDATION ===');
  const initialMemory = performance.memory?.usedJSHeapSize || 0;

  // Create and destroy sessions
  for (const [name, orchestrator] of Object.entries(orchestrators)) {
    for (let i = 0; i < 100; i++) {
      orchestrator.createSession({
        type: 'agent',
        name: `Memory Test ${i}`,
        workspace: '/workspace/memory'
      });
    }
    orchestrator.clearAll();
  }

  const finalMemory = performance.memory?.usedJSHeapSize || 0;
  const memoryLeak = finalMemory - initialMemory;

  console.log(`Memory leak after cleanup: ${(memoryLeak / 1024).toFixed(2)}KB`);
  console.log(`Memory leak test: ${memoryLeak < 1024 * 1024 ? '✓ PASS' : '✗ FAIL'}`);

  console.log('\n=== PERFORMANCE VALIDATION COMPLETE ===');
}

// Run the tests
runPerformanceTests().catch(console.error);
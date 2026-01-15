/**
 * Comprehensive Test - All Orchestrator Versions
 * Validates performance, functionality, and memory usage
 */

import {
  ultimateOrchestrator,
  hyperOrchestrator,
  microOrchestrator,
  ultraOrchestrator,
  orchestrator
} from './dist/src/index.js';

import { PerformanceBenchmark } from './dist/src/utils/performance-benchmark.js';
import { MemoryOptimizer } from './dist/src/utils/memory-optimizer.js';

// Test all orchestrator versions
const orchestrators = [
  { name: 'Ultimate Orchestrator', instance: ultimateOrchestrator },
  { name: 'Hyper-Optimized Orchestrator', instance: hyperOrchestrator },
  { name: 'Micro Orchestrator', instance: microOrchestrator },
  { name: 'Ultra-Streamlined Orchestrator', instance: ultraOrchestrator },
  { name: 'Streamlined Orchestrator', instance: orchestrator }
];

function testBasicFunctionality(orchestrator, name) {
  console.log(`\n🧪 Testing Basic Functionality - ${name}`);

  // Test session creation
  const session = orchestrator.createSession({
    type: 'agent',
    name: 'Test Agent',
    workspace: 'test'
  });

  console.log(`✅ Session created: ${session.id}`);

  // Test context management
  orchestrator.setContext(session.id, { data: 'test context' });
  const context = orchestrator.getContext(session.id);
  console.log(`✅ Context set: ${context.data}`);

  // Test messaging
  orchestrator.sendMessage(session.id, {
    id: 'msg-1',
    type: 'text',
    content: 'Hello World',
    timestamp: new Date()
  });
  console.log(`✅ Message sent`);

  // Test queries
  const allSessions = orchestrator.getAllSessions();
  console.log(`✅ All sessions: ${allSessions.length}`);

  // Test health check
  const health = orchestrator.healthCheck();
  console.log(`✅ Health check: ${health.status}`);

  // Test metrics
  const metrics = orchestrator.getMetrics();
  console.log(`✅ Metrics: ${metrics.activeSessions} active sessions, ${metrics.totalMessages} messages`);

  return true;
}

function testPerformanceComparison() {
  console.log('\n🚀 Performance Benchmark Comparison');
  console.log('='.repeat(50));

  const benchmark = new PerformanceBenchmark();

  // Run benchmark for all orchestrators
  orchestrators.forEach(({ name, instance }) => {
    console.log(`\n📊 Benchmarking ${name}...`);

    // Clear previous state
    instance.clearAll();

    // Run individual benchmarks
    const sessionCreation = benchmark.benchmarkSessionCreation(instance, 1000);
    const sessionRetrieval = benchmark.benchmarkSessionRetrieval(instance, 1000);
    const messageSending = benchmark.benchmarkMessageSending(instance, 1000);

    console.log(`  Session Creation: ${sessionCreation.opsPerSecond.toFixed(0)} ops/sec`);
    console.log(`  Session Retrieval: ${sessionRetrieval.opsPerSecond.toFixed(0)} ops/sec`);
    console.log(`  Message Sending: ${messageSending.opsPerSecond.toFixed(0)} ops/sec`);

    // Clear state for next test
    instance.clearAll();
  });
}

function testMemoryOptimization() {
  console.log('\n💾 Memory Optimization Test');
  console.log('='.repeat(50));

  const memoryOptimizer = new MemoryOptimizer();

  orchestrators.forEach(({ name, instance }) => {
    console.log(`\n🧠 Testing Memory Optimization - ${name}`);

    // Create some data
    for (let i = 0; i < 100; i++) {
      const session = instance.createSession({
        type: 'agent',
        name: `Agent ${i}`,
        workspace: 'test'
      });

      instance.setContext(session.id, { data: `context-${i}`, timestamp: Date.now() });
      instance.sendMessage(session.id, {
        id: `msg-${i}`,
        type: 'text',
        content: `Test message ${i}`,
        timestamp: new Date()
      });
    }

    // Generate memory report
    const report = memoryOptimizer.generateMemoryReport(instance);
    console.log(report);

    // Apply optimizations
    memoryOptimizer.optimizeMemory(instance);

    // Clear state
    instance.clearAll();
  });
}

function testScalability() {
  console.log('\n📈 Scalability Test');
  console.log('='.repeat(50));

  orchestrators.forEach(({ name, instance }) => {
    console.log(`\n📊 Testing Scalability - ${name}`);

    const startTime = performance.now();
    const sessionIds = [];

    // Create 1000 sessions
    for (let i = 0; i < 1000; i++) {
      const session = instance.createSession({
        type: 'agent',
        name: `Scalability Test ${i}`,
        workspace: 'scalability'
      });
      sessionIds.push(session.id);
    }

    const creationTime = performance.now() - startTime;
    console.log(`  Created 1000 sessions in ${creationTime.toFixed(2)}ms`);
    console.log(`  Average: ${(creationTime / 1000).toFixed(3)}ms per session`);

    // Test session retrieval
    const retrievalStart = performance.now();
    sessionIds.forEach(id => instance.getSession(id));
    const retrievalTime = performance.now() - retrievalStart;
    console.log(`  Retrieved 1000 sessions in ${retrievalTime.toFixed(2)}ms`);
    console.log(`  Average: ${(retrievalTime / 1000).toFixed(3)}ms per retrieval`);

    // Test memory usage
    const metrics = instance.getMetrics();
    console.log(`  Final memory usage: ${metrics.memoryUsage} bytes`);
    console.log(`  Memory per session: ${(metrics.memoryUsage / 1000).toFixed(1)} bytes`);

    // Clear state
    instance.clearAll();
  });
}

function testEdgeCases() {
  console.log('\n🔬 Edge Cases Test');
  console.log('='.repeat(50));

  orchestrators.forEach(({ name, instance }) => {
    console.log(`\n🧪 Testing Edge Cases - ${name}`);

    // Test duplicate session creation
    const session1 = instance.createSession({
      type: 'agent',
      name: 'Duplicate Test',
      workspace: 'test'
    });

    const session2 = instance.createSession({
      type: 'agent',
      name: 'Duplicate Test',
      workspace: 'test'
    });

    console.log(`  Duplicate sessions created: ${session1.id !== session2.id}`);

    // Test non-existent session operations
    const nonExistent = instance.getSession('non-existent');
    console.log(`  Non-existent session returns: ${nonExistent === undefined}`);

    // Test message to non-existent session
    const messageResult = instance.sendMessage('non-existent', {
      id: 'test',
      type: 'text',
      content: 'test',
      timestamp: new Date()
    });
    console.log(`  Message to non-existent session: ${messageResult === false}`);

    // Test session updates
    const updated = instance.updateSession(session1.id, { name: 'Updated Name' });
    console.log(`  Session update successful: ${updated.name === 'Updated Name'}`);

    // Test session deletion
    const deleted = instance.deleteSession(session1.id);
    console.log(`  Session deletion successful: ${deleted === true}`);

    // Clear state
    instance.clearAll();
  });
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Test Suite');
  console.log('='.repeat(60));

  try {
    // Test basic functionality
    console.log('\n🧪 Phase 1: Basic Functionality Test');
    orchestrators.forEach(({ name, instance }) => {
      testBasicFunctionality(instance, name);
    });

    // Test performance comparison
    testPerformanceComparison();

    // Test memory optimization
    testMemoryOptimization();

    // Test scalability
    testScalability();

    // Test edge cases
    testEdgeCases();

    console.log('\n🎉 Comprehensive Test Suite Completed Successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run the comprehensive test
runComprehensiveTest();
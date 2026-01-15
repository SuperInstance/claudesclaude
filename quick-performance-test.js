/**
 * Quick Performance Test - Compare All Orchestrator Versions
 */

import {
  ultimateOrchestrator,
  hyperOrchestrator,
  microOrchestrator,
  ultraOrchestrator,
  orchestrator
} from './dist/src/index.js';

const orchestrators = [
  { name: 'Ultimate Orchestrator', instance: ultimateOrchestrator },
  { name: 'Hyper-Optimized Orchestrator', instance: hyperOrchestrator },
  { name: 'Micro Orchestrator', instance: microOrchestrator },
  { name: 'Ultra-Streamlined Orchestrator', instance: ultraOrchestrator },
  { name: 'Streamlined Orchestrator', instance: orchestrator }
];

function benchmarkSessionCreation(orchestrator, iterations = 5000) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    orchestrator.createSession({
      type: 'agent',
      name: `Test ${i}`,
      workspace: 'test'
    });
  }

  const end = performance.now();
  const duration = end - start;
  const opsPerSecond = (iterations / duration) * 1000;

  return {
    duration,
    opsPerSecond: Math.round(opsPerSecond)
  };
}

function benchmarkSessionRetrieval(orchestrator, iterations = 5000) {
  // Create sessions first
  const sessionIds = [];
  for (let i = 0; i < iterations; i++) {
    const session = orchestrator.createSession({
      type: 'agent',
      name: `Test ${i}`,
      workspace: 'test'
    });
    sessionIds.push(session.id);
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const randomIndex = Math.floor(Math.random() * sessionIds.length);
    orchestrator.getSession(sessionIds[randomIndex]);
  }

  const end = performance.now();
  const duration = end - start;
  const opsPerSecond = (iterations / duration) * 1000;

  return {
    duration,
    opsPerSecond: Math.round(opsPerSecond)
  };
}

function benchmarkMessageSending(orchestrator, iterations = 5000) {
  const session = orchestrator.createSession({
    type: 'agent',
    name: 'Test Session',
    workspace: 'test'
  });

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    orchestrator.sendMessage(session.id, {
      id: `msg-${i}`,
      type: 'text',
      content: `Test message ${i}`,
      timestamp: new Date()
    });
  }

  const end = performance.now();
  const duration = end - start;
  const opsPerSecond = (iterations / duration) * 1000;

  return {
    duration,
    opsPerSecond: Math.round(opsPerSecond)
  };
}

console.log('🚀 Performance Benchmark Comparison');
console.log('='.repeat(60));

const results = [];

for (const { name, instance } of orchestrators) {
  console.log(`\n📊 Benchmarking ${name}...`);

  // Clear state
  instance.clearAll();

  // Session Creation Benchmark
  const creation = benchmarkSessionCreation(instance);
  console.log(`  Session Creation: ${creation.opsPerSecond.toLocaleString()} ops/sec (${creation.duration.toFixed(2)}ms)`);

  // Session Retrieval Benchmark
  const retrieval = benchmarkSessionRetrieval(instance);
  console.log(`  Session Retrieval: ${retrieval.opsPerSecond.toLocaleString()} ops/sec (${retrieval.duration.toFixed(2)}ms)`);

  // Message Sending Benchmark
  const messaging = benchmarkMessageSending(instance);
  console.log(`  Message Sending: ${messaging.opsPerSecond.toLocaleString()} ops/sec (${messaging.duration.toFixed(2)}ms)`);

  // Memory Usage
  const metrics = instance.getMetrics();
  console.log(`  Memory Usage: ${metrics.memoryUsage.toLocaleString()} bytes`);

  results.push({
    name,
    creation: creation.opsPerSecond,
    retrieval: retrieval.opsPerSecond,
    messaging: messaging.opsPerSecond,
    memory: metrics.memoryUsage
  });

  // Clear state
  instance.clearAll();
}

// Performance Summary
console.log('\n🏆 Performance Rankings');
console.log('='.repeat(40));

const rankings = results.sort((a, b) => {
  const avgA = (a.creation + a.retrieval + a.messaging) / 3;
  const avgB = (b.creation + b.retrieval + b.messaging) / 3;
  return b.memory !== a.memory ? b.memory - a.memory : avgB - avgA;
});

rankings.forEach((result, index) => {
  const average = Math.round((result.creation + result.retrieval + result.messaging) / 3);
  console.log(`${index + 1}. ${result.name}: ${average.toLocaleString()} avg ops/sec, ${result.memory} bytes`);
});

console.log('\n🎉 Performance Benchmark Complete!');
// Simple functionality and performance validation
import { NanoOrchestrator } from './dist/src/core/nano-orchestrator.js';
import { AdaptiveOrchestrator } from './dist/src/core/adaptive-orchestrator.js';
import { JitOrchestrator } from './dist/src/core/jit-orchestrator.js';
import { ZeroCopyOrchestrator } from './dist/src/core/zerocopy-orchestrator.js';
import { SimdOrchestrator } from './dist/src/core/simd-orchestrator.js';
import { TieredOrchestrator } from './dist/src/core/tiered-orchestrator.js';
import { BenchmarkOrchestrator } from './dist/src/core/benchmark-orchestrator.js';

// Test orchestrators
const orchestrators = {
  nano: new NanoOrchestrator(),
  adaptive: new AdaptiveOrchestrator(),
  jit: new JitOrchestrator(),
  zeroCopy: new ZeroCopyOrchestrator(),
  simd: new SimdOrchestrator(),
  tiered: new TieredOrchestrator(),
  benchmark: new BenchmarkOrchestrator()
};

// Basic functionality test
console.log('=== BASIC FUNCTIONALITY TEST ===');
for (const [name, orchestrator] of Object.entries(orchestrators)) {
  try {
    // Create session
    const session = orchestrator.createSession({
      type: 'agent',
      name: `Test Session ${name}`,
      workspace: '/workspace/test'
    });

    // Get session
    const retrieved = orchestrator.getSession(session.id);
    if (!retrieved) {
      console.log(`${name}: ✗ FAIL - Session not retrieved`);
      continue;
    }

    // Update session
    const updated = orchestrator.updateSession(session.id, { name: 'Updated Name' });
    if (!updated) {
      console.log(`${name}: ✗ FAIL - Session not updated`);
      continue;
    }

    // Send message
    const msgSent = orchestrator.sendMessage(session.id, {
      role: 'user',
      content: 'Hello world'
    });
    if (!msgSent) {
      console.log(`${name}: ✗ FAIL - Message not sent`);
      continue;
    }

    // Query
    const byType = orchestrator.getSessionsByType('agent');
    const byWorkspace = orchestrator.getWorkspaceSessions('/workspace/test');

    console.log(`${name}: ✓ PASS (${byType.length} sessions by type, ${byWorkspace.length} by workspace)`);
  } catch (error) {
    console.log(`${name}: ✗ ERROR - ${error.message}`);
  }
}

// Performance test
console.log('\n=== PERFORMANCE TEST ===');
const sessionCount = 100;
const operations = [];

for (const [name, orchestrator] of Object.entries(orchestrators)) {
  const start = performance.now();

  // Create sessions
  const sessions = [];
  for (let i = 0; i < sessionCount; i++) {
    sessions.push(orchestrator.createSession({
      type: 'agent',
      name: `Session ${i}`,
      workspace: '/workspace/test'
    }));
  }

  // Get all sessions
  orchestrator.getAllSessions();

  // Send messages
  for (const session of sessions) {
    orchestrator.sendMessage(session.id, {
      role: 'user',
      content: `Message ${session.id}`
    });
  }

  // Process messages
  orchestrator.processMessages();

  const end = performance.now();
  const totalTime = end - start;
  const opsPerSecond = (sessionCount * 3) / totalTime * 1000;

  operations.push({ name, time: totalTime, opsPerSecond });
  console.log(`${name}: ${totalTime.toFixed(2)}ms, ${opsPerSecond.toFixed(0)} ops/sec`);
}

// Sort by performance
operations.sort((a, b) => b.opsPerSecond - a.opsPerSecond);

console.log('\n=== PERFORMANCE RANKING ===');
operations.forEach((op, index) => {
  console.log(`${index + 1}. ${op.name}: ${op.opsPerSecond.toFixed(0)} ops/sec`);
});

// Memory efficiency test
console.log('\n=== MEMORY EFFICIENCY TEST ===');
const memoryResults = [];

for (const [name, orchestrator] of Object.entries(orchestrators)) {
  const before = performance.memory?.usedJSHeapSize || 0;

  // Create and clear sessions
  for (let i = 0; i < 100; i++) {
    orchestrator.createSession({
      type: 'agent',
      name: `Memory Test ${i}`,
      workspace: '/workspace/memory'
    });
  }
  orchestrator.clearAll();

  const after = performance.memory?.usedJSHeapSize || 0;
  const memoryDiff = after - before;

  memoryResults.push({ name, memoryDiff });
  console.log(`${name}: ${(memoryDiff / 1024).toFixed(2)}KB`);
}

// Health check
console.log('\n=== HEALTH CHECK TEST ===');
for (const [name, orchestrator] of Object.entries(orchestrators)) {
  const health = orchestrator.healthCheck();
  console.log(`${name}: ${health.status} (${JSON.stringify(health.details).slice(0, 50)}...)`);
}

// Metrics
console.log('\n=== METRICS SUMMARY ===');
for (const [name, orchestrator] of Object.entries(orchestrators)) {
  const metrics = orchestrator.getMetrics();
  console.log(`${name}: ${metrics.activeSessions} sessions, ${metrics.memoryUsage} bytes`);
}

console.log('\n=== VALIDATION COMPLETE ===');
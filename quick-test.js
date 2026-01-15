/**
 * Quick Test - Test New Orchestrators
 */

import {
  nanoOrchestrator,
  ultimateOrchestrator,
  hyperOrchestrator,
  microOrchestrator,
  ultraOrchestrator,
  pooledOrchestrator,
  memoryOptimizedOrchestrator,
  hotPathOrchestrator,
  adaptiveOrchestrator,
  orchestrator
} from './dist/src/index.js';

console.log('🚀 Quick Test - New Orchestrators');
console.log('='.repeat(50));

const orchestrators = [
  { name: 'Nano Orchestrator', instance: nanoOrchestrator },
  { name: 'Ultimate Orchestrator', instance: ultimateOrchestrator },
  { name: 'Hyper-Optimized Orchestrator', instance: hyperOrchestrator },
  { name: 'Micro Orchestrator', instance: microOrchestrator },
  { name: 'Ultra-Streamlined Orchestrator', instance: ultraOrchestrator },
  { name: 'Pooled Orchestrator', instance: pooledOrchestrator },
  { name: 'Memory-Optimized Orchestrator', instance: memoryOptimizedOrchestrator },
  { name: 'Hot-Path Orchestrator', instance: hotPathOrchestrator },
  { name: 'Adaptive Orchestrator', instance: adaptiveOrchestrator },
  { name: 'Streamlined Orchestrator', instance: orchestrator }
];

function quickTest(orchestrator, name) {
  console.log(`\n🧪 Testing ${name}...`);

  try {
    const session = orchestrator.createSession({
      type: 'agent',
      name: 'Test Session',
      workspace: '/workspace/test'
    });

    console.log(`✅ Session Created: ${session.id}`);

    orchestrator.setContext(session.id, { test: 'context' });
    const context = orchestrator.getContext(session.id);
    console.log(`✅ Context Set: ${Object.keys(context).length} properties`);

    orchestrator.sendMessage(session.id, {
      id: 'msg-1',
      type: 'text',
      content: 'Test message',
      timestamp: new Date()
    });

    const metrics = orchestrator.getMetrics();
    console.log(`✅ Metrics: ${metrics.totalSessions} sessions, ${metrics.totalMessages} messages`);

    console.log(`🟢 ${name}: PASSED`);
    return true;
  } catch (error) {
    console.log(`🔴 ${name}: FAILED - ${error.message}`);
    return false;
  }
}

let passed = 0;
let total = orchestrators.length;

orchestrators.forEach(({ name, instance }) => {
  if (quickTest(instance, name)) {
    passed++;
  }
  instance.clearAll();
});

console.log(`\n📊 Results: ${passed}/${total} tests passed`);
console.log('🎉 Quick test complete!');
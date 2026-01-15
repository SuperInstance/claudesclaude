#!/usr/bin/env node

// Performance test for streamlined orchestrator
import { orchestrator } from './dist/index.js';

console.log('🚀 Testing Streamlined Orchestrator Performance...\n');

// Test 1: Session Creation Performance
console.log('📊 Test 1: Session Creation Performance');
const startTime = performance.now();
const sessionCount = 1000;

for (let i = 0; i < sessionCount; i++) {
  orchestrator.createSession({
    type: 'development',
    name: `Test Session ${i}`,
    workspace: `/workspace/${i}`,
    config: { test: true }
  });
}

const endTime = performance.now();
const totalTime = endTime - startTime;
const avgTime = totalTime / sessionCount;

console.log(`  Created ${sessionCount} sessions in ${totalTime.toFixed(2)}ms`);
console.log(`  Average time per session: ${avgTime.toFixed(4)}ms`);
console.log(`  Sessions per second: ${(sessionCount / totalTime * 1000).toFixed(0)}\n`);

// Test 2: Context Operations Performance
console.log('📊 Test 2: Context Operations Performance');
const testSession = orchestrator.createSession({
  type: 'test',
  name: 'Performance Test',
  workspace: '/test'
});

const contextData = {
  largeData: new Array(1000).fill('test').join(''),
  nested: {
    level1: {
      level2: {
        level3: {
          data: 'performance test data'
        }
      }
    }
  }
};

const contextStart = performance.now();
for (let i = 0; i < 1000; i++) {
  orchestrator.setContext(testSession.id, { ...contextData, iteration: i });
  const context = orchestrator.getContext(testSession.id);
}
const contextEnd = performance.now();
const contextTime = contextEnd - contextStart;

console.log(`  1000 context operations in ${contextTime.toFixed(2)}ms`);
console.log(`  Average time per operation: ${(contextTime / 1000).toFixed(4)}ms`);
console.log(`  Operations per second: ${(1000 / contextTime * 1000).toFixed(0)}\n`);

// Test 3: Message Processing Performance
console.log('📊 Test 3: Message Processing Performance');
const messageStart = performance.now();
for (let i = 0; i < 5000; i++) {
  orchestrator.sendMessage(testSession.id, {
    type: 'test',
    content: `Test message ${i}`,
    timestamp: new Date()
  });
}
const processedCount = orchestrator.processMessages();
const messageEnd = performance.now();
const messageTime = messageEnd - messageStart;

console.log(`  Sent ${processedCount} messages in ${messageTime.toFixed(2)}ms`);
console.log(`  Average time per message: ${(messageTime / processedCount).toFixed(4)}ms`);
console.log(`  Messages per second: ${(processedCount / messageTime * 1000).toFixed(0)}\n`);

// Test 4: Overall Metrics
console.log('📊 Test 4: Overall System Metrics');
const metrics = orchestrator.getMetrics();
const health = orchestrator.healthCheck();

console.log('  Current Metrics:');
console.log(`    Total Sessions Created: ${metrics.totalSessions}`);
console.log(`    Total Messages: ${metrics.totalMessages}`);
console.log(`    Active Sessions: ${metrics.activeSessions}`);
console.log(`    Cached Contexts: ${metrics.cachedContexts}`);
console.log(`    Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
console.log(`    System Health: ${health.status}\n`);

// Test 5: Query Performance
console.log('📊 Test 5: Query Performance');
const queryStart = performance.now();

const allSessions = orchestrator.getAllSessions();
const typeSessions = orchestrator.getSessionsByType('development');
const workspaceSessions = orchestrator.getWorkspaceSessions('/workspace');
const activeSessions = orchestrator.getSessionsByStatus('active');

const queryEnd = performance.now();
const queryTime = queryEnd - queryStart;

console.log(`  Query results:`);
console.log(`    All sessions: ${allSessions.length}`);
console.log(`    Development sessions: ${typeSessions.length}`);
console.log(`    Workspace sessions: ${workspaceSessions.length}`);
console.log(`    Active sessions: ${activeSessions.length}`);
console.log(`  All queries completed in ${queryTime.toFixed(2)}ms\n`);

console.log('🎉 Streamlined Orchestrator Performance Test Complete!');
console.log('\n💡 Key Optimizations Achieved:');
console.log('   • Consolidated event management system');
console.log('   • Simplified UUID and timestamp utilities');
console.log('   • Unified pool management');
console.log('   • Reduced memory overhead');
console.log('   • Minimized method calls and complexity');
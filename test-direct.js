#!/usr/bin/env node

// Direct test of streamlined orchestrator
import { createStreamlinedOrchestrator } from './dist/src/core/streamlined-orchestrator.js';

console.log('🚀 Testing Streamlined Orchestrator Direct...\n');

// Create orchestrator instance
const orchestrator = createStreamlinedOrchestrator();

// Test basic functionality
const session = orchestrator.createSession({
  type: 'development',
  name: 'Test Session',
  workspace: '/workspace/test'
});

console.log('✅ Session created:', session.id);

// Test context
orchestrator.setContext(session.id, {
  test: 'data',
  number: 42,
  nested: { value: 'deep' }
});

const context = orchestrator.getContext(session.id);
console.log('✅ Context set and retrieved:', context.test);

// Test metrics
const metrics = orchestrator.getMetrics();
console.log('📊 Metrics:', {
  totalSessions: metrics.totalSessions,
  activeSessions: metrics.activeSessions,
  memoryUsage: `${(metrics.memoryUsage / 1024).toFixed(2)}KB`
});

// Test health check
const health = orchestrator.healthCheck();
console.log('🏥 Health check:', health.status);

// Test queries
const allSessions = orchestrator.getAllSessions();
console.log(`📋 Found ${allSessions.length} sessions total`);

const devSessions = orchestrator.getSessionsByType('development');
console.log(`📋 Found ${devSessions.length} development sessions`);

// Test message sending
orchestrator.sendMessage(session.id, {
  type: 'test',
  content: 'Hello World'
});

const processed = orchestrator.processMessages();
console.log(`📨 Processed ${processed} messages`);

console.log('\n🎉 Streamlined orchestrator test complete!');
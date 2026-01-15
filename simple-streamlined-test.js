#!/usr/bin/env node

// Simple test for streamlined orchestrator
import { orchestrator } from './dist/index.js';

console.log('🚀 Testing Streamlined Orchestrator...\n');

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

console.log('\n🎉 Streamlined orchestrator test complete!');
// Test SIMD orchestrator directly
import { SimdOrchestrator } from './dist/src/core/simd-orchestrator.js';

const orch = new SimdOrchestrator();

console.log('Creating session...');
const session = orch.createSession({
  type: 'agent',
  name: 'Test SIMD Session',
  workspace: '/workspace/test'
});

console.log('Session created:', session.id);

console.log('Getting session...');
const retrieved = orch.getSession(session.id);
console.log('Session retrieved:', retrieved?.name);

console.log('Getting sessions by type...');
const byType = orch.getSessionsByType('agent');
console.log('Sessions by type:', byType.length);

console.log('Getting sessions by workspace...');
const byWorkspace = orch.getWorkspaceSessions('/workspace/test');
console.log('Sessions by workspace:', byWorkspace.length);

console.log('Metrics:', orch.getMetrics());
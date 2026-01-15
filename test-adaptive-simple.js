// Test adaptive orchestrator step by step
import { AdaptiveOrchestrator } from './dist/src/core/adaptive-orchestrator.js';

const orch = new AdaptiveOrchestrator();

console.log('Creating session...');
const session = orch.createSession({
  type: 'agent',
  name: 'Test Session',
  workspace: '/workspace/test'
});

console.log('Session created:', session.id);

console.log('Getting session...');
const retrieved = orch.getSession(session.id);
console.log('Session retrieved:', retrieved);

console.log('Updating session...');
const updated = orch.updateSession(session.id, {
  name: 'Updated Name'
});
console.log('Session updated:', updated);
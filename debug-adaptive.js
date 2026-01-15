import { adaptiveOrchestrator } from './dist/src/core/adaptive-orchestrator.js';

console.log('Debugging Adaptive Orchestrator');

const session = adaptiveOrchestrator.createSession({
  type: 'agent',
  name: 'Test Session',
  workspace: '/workspace/test'
});

console.log('Session created:', session);

// Check if session is in cache
const cachedSession = adaptiveOrchestrator['sessionCache'].get(session.id);
console.log('Session in cache:', cachedSession);

const updated = adaptiveOrchestrator.updateSession(session.id, {
  name: 'Updated Name'
});

console.log('Session updated:', updated);
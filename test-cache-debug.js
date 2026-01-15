// Test AdaptiveCache directly
import { AdaptiveCache } from './dist/src/core/adaptive-orchestrator.js';

const cache = new AdaptiveCache(10);

console.log('Setting key...');
cache.set('test-key', { id: 'test', name: 'test' });

console.log('Getting key...');
const value = cache.get('test-key');
console.log('Value retrieved:', value);

console.log('Cache size:', cache.size());
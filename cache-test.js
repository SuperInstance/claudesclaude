// Simple cache test
const cache = new Map();

console.log('Setting key...');
cache.set('test-key', { id: 'test', name: 'test' });

console.log('Getting key...');
const value = cache.get('test-key');
console.log('Value retrieved:', value);

console.log('Cache size:', cache.size);
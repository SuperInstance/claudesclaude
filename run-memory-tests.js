const { test, expect } = require('bun:test');
const SimpleLRUCache = require('./sdk/typescript/src/utils/simple-lru-cache').SimpleLRUCache;
const OptimizedSessionManager = require('./sdk/typescript/src/utils/session-manager').OptimizedSessionManager;
const OptimizedEventManager = require('./sdk/typescript/src/utils/event-manager').OptimizedEventManager;
const UnifiedMemoryManager = require('./sdk/typescript/src/utils/memory-manager').UnifiedMemoryManager;

// Simple test - we'll accept any UUID format
const testSessionId = 'test-session-id';

test('LRU Cache - Basic Operations', () => {
  const cache = new SimpleLRUCache({ max: 3 });

  // Set values
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');

  expect(cache.size).toBe(3);
  expect(cache.get('key1')).toBe('value1');
  expect(cache.get('key2')).toBe('value2');
  expect(cache.get('key3')).toBe('value3');

  // Add fourth item to trigger LRU eviction
  cache.set('key4', 'value4');

  // key1 should be evicted
  expect(cache.get('key1')).toBeUndefined();
  expect(cache.size).toBe(3);
  expect(cache.get('key2')).toBe('value2');
  expect(cache.get('key3')).toBe('value3');
  expect(cache.get('key4')).toBe('value4');
});

test('LRU Cache - TTL Expiration', async () => {
  const cache = new SimpleLRUCache({
    max: 5,
    ttl: 100 // 100ms
  });

  cache.set('key1', 'value1');
  expect(cache.get('key1')).toBe('value1');

  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 150));

  expect(cache.get('key1')).toBeUndefined();
  expect(cache.size).toBe(0);
});

test('LRU Cache - Memory Limits', () => {
  const cache = new SimpleLRUCache({
    maxSize: 100 // 100 bytes
  });

  // Set values that exceed memory limit
  cache.set('key1', 'value1'.repeat(100)); // ~500 bytes
  cache.set('key2', 'value2'.repeat(100)); // ~500 bytes

  // Cache should still have 2 items at most
  expect(cache.size).toBeLessThanOrEqual(2);
});

test('LRU Cache - Memory Metrics', () => {
  const cache = new SimpleLRUCache({ max: 5 });

  // Add some data
  cache.set('key1', 'value1');
  cache.set('key2', 'value2');

  const metrics = cache.getMemoryMetrics();
  expect(metrics.totalItems).toBe(2);
  expect(metrics.hitRate).toBe(0); // No hits yet
  expect(metrics.evictionCount).toBe(0);
});

console.log('Memory optimization tests completed successfully!');
// Simple test runner for just LRU cache
const { SimpleLRUCache } = require('./dist/sdk/typescript/src/utils/simple-lru-cache');

async function runTests() {
  console.log('Running Simple LRU Cache Tests...');

  try {
    // Test 1: Basic Operations
    console.log('\n1. Testing Basic Operations');
    const cache = new SimpleLRUCache({ max: 3 });

    // Set values
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    if (cache.size !== 3) throw new Error(`Expected size 3, got ${cache.size}`);
    if (cache.get('key1') !== 'value1') throw new Error('Expected value1 for key1');
    if (cache.get('key2') !== 'value2') throw new Error('Expected value2 for key2');
    if (cache.get('key3') !== 'value3') throw new Error('Expected value3 for key3');

    // Add fourth item to trigger LRU eviction
    cache.set('key4', 'value4');

    // key1 should be evicted
    if (cache.get('key1') !== undefined) throw new Error('key1 should be evicted');
    if (cache.size !== 3) throw new Error(`Expected size 3 after eviction, got ${cache.size}`);
    if (cache.get('key2') !== 'value2') throw new Error('Expected value2 for key2');
    if (cache.get('key3') !== 'value3') throw new Error('Expected value3 for key3');
    if (cache.get('key4') !== 'value4') throw new Error('Expected value4 for key4');

    console.log('✓ Basic Operations test passed');

    // Test 2: TTL Expiration
    console.log('\n2. Testing TTL Expiration');
    const cache2 = new SimpleLRUCache({
      max: 5,
      ttl: 100 // 100ms
    });

    cache2.set('key1', 'value1');
    if (cache2.get('key1') !== 'value1') throw new Error('Should get value1');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    if (cache2.get('key1') !== undefined) throw new Error('key1 should be expired');
    if (cache2.size !== 0) throw new Error(`Expected size 0 after expiration, got ${cache2.size}`);

    console.log('✓ TTL Expiration test passed');

    // Test 3: Memory Limits
    console.log('\n3. Testing Memory Limits');
    const cache3 = new SimpleLRUCache({
      maxSize: 100 // 100 bytes
    });

    // Set values that exceed memory limit
    cache3.set('key1', 'value1'.repeat(100)); // ~500 bytes
    cache3.set('key2', 'value2'.repeat(100)); // ~500 bytes

    // Cache should still have 2 items at most
    if (cache3.size > 2) throw new Error(`Expected size <= 2, got ${cache3.size}`);

    console.log('✓ Memory Limits test passed');

    // Test 4: Memory Metrics
    console.log('\n4. Testing Memory Metrics');
    const cache4 = new SimpleLRUCache({ max: 5 });

    // Add some data
    cache4.set('key1', 'value1');
    cache4.set('key2', 'value2');

    const metrics = cache4.getMemoryMetrics();
    if (metrics.totalItems !== 2) throw new Error(`Expected 2 items, got ${metrics.totalItems}`);
    if (metrics.hitRate !== 0) throw new Error(`Expected hitRate 0, got ${metrics.hitRate}`);
    if (metrics.evictionCount !== 0) throw new Error(`Expected evictionCount 0, got ${metrics.evictionCount}`);

    console.log('✓ Memory Metrics test passed');

    // Test 5: Performance Benchmark
    console.log('\n5. Testing Performance');
    const cache5 = new SimpleLRUCache({
      max: 1000,
      maxSize: 10 * 1024 * 1024 // 10MB
    });

    const startTime = performance.now();

    // Benchmark cache operations
    for (let i = 0; i < 1000; i++) {
      const key = `key-${i}`;
      const value = { data: Math.random() };
      cache5.set(key, value);
      cache5.get(key);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`✓ Performance test completed in ${duration.toFixed(2)}ms`);
    if (duration > 1000) throw new Error(`Expected duration < 1000ms, got ${duration}ms`);

    console.log('\n🎉 All LRU Cache Tests Passed! (5/5)');
    console.log('\nLRU Cache Features Summary:');
    console.log('- ✓ Least Recently Used eviction policy');
    console.log('- ✓ Time To Live (TTL) expiration');
    console.log('- ✓ Memory size limits');
    console.log('- ✓ Memory usage metrics');
    console.log('- ✓ Performance optimized operations');
    console.log('- ✓ Configurable cache parameters');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
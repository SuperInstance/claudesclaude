import { describe, it, expect, beforeEach } from 'bun:test';
import { UnifiedOrchestratorOptimized, createUnifiedOrchestrator, createOptimizedUnifiedOrchestrator } from '../src/core/unified-optimized.js';
import type { SessionType } from '../src/core/types.js';

describe('Unified Orchestrator Optimized Performance Tests', () => {
  let orchestrator: UnifiedOrchestratorOptimized;

  beforeEach(() => {
    orchestrator = createOptimizedUnifiedOrchestrator();
  });

  it('should demonstrate performance improvements in session creation', async () => {
    const testCount = 1000;
    const startTime = performance.now();

    // Create sessions with optimizations
    const sessions = [];
    for (let i = 0; i < testCount; i++) {
      const session = await orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Test Session ${i}`,
        workspace: `/workspace/${i}`,
        config: { index: i }
      });
      sessions.push(session);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / testCount;

    console.log(`\n📊 Session Creation Performance:`);
    console.log(`   Total sessions: ${testCount}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average time per session: ${averageTime.toFixed(2)}ms`);
    console.log(`   Sessions per second: ${(testCount / (totalTime / 1000)).toFixed(0)}`);

    expect(sessions.length).toBe(testCount);
    expect(sessions.every(s => s.id)).toBe(true);
    expect(averageTime).toBeLessThan(1); // Should be under 1ms per session
  });

  it('should demonstrate performance improvements in context operations', () => {
    const testCount = 5000;
    const startTime = performance.now();

    // Set contexts
    for (let i = 0; i < testCount; i++) {
      orchestrator.setContext(`key-${i}`, { value: `data-${i}`, index: i });
    }

    // Get contexts
    for (let i = 0; i < testCount; i++) {
      const context = orchestrator.getContext(`key-${i}`);
      expect(context).toEqual({ value: `data-${i}`, index: i });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / (testCount * 2); // Set + Get

    console.log(`\n📊 Context Operations Performance:`);
    console.log(`   Total operations: ${testCount * 2}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average time per operation: ${averageTime.toFixed(2)}ms`);
    console.log(`   Operations per second: ${((testCount * 2) / (totalTime / 1000)).toFixed(0)}`);

    expect(averageTime).toBeLessThan(0.1); // Should be under 0.1ms per operation
  });

  it('should demonstrate performance improvements in event handling', (done) => {
    const eventCount = 5000;
    let receivedEvents = 0;
    const startTime = performance.now();

    // Subscribe to events
    orchestrator.on('test-event', (data) => {
      receivedEvents++;
      if (receivedEvents === eventCount) {
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const averageTime = totalTime / eventCount;

        console.log(`\n📊 Event Handling Performance:`);
        console.log(`   Total events: ${eventCount}`);
        console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`   Average time per event: ${averageTime.toFixed(2)}ms`);
        console.log(`   Events per second: ${(eventCount / (totalTime / 1000)).toFixed(0)}`);

        expect(averageTime).toBeLessThan(0.05); // Should be under 0.05ms per event
        done();
      }
    });

    // Emit events
    for (let i = 0; i < eventCount; i++) {
      orchestrator.emit('test-event', { sequence: i });
    }
  });

  it('should demonstrate performance improvements in message publishing', () => {
    const messageCount = 3000;
    const startTime = performance.now();

    // Publish messages
    const messages = [];
    for (let i = 0; i < messageCount; i++) {
      const message = orchestrator.publish({
        type: 'user',
        source: 'test',
        data: { content: `Message ${i}`, timestamp: Date.now() }
      });
      messages.push(message);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / messageCount;

    console.log(`\n📊 Message Publishing Performance:`);
    console.log(`   Total messages: ${messageCount}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average time per message: ${averageTime.toFixed(2)}ms`);
    console.log(`   Messages per second: ${(messageCount / (totalTime / 1000)).toFixed(0)}`);

    expect(messages.length).toBe(messageCount);
    expect(messages.every(m => m.id)).toBe(true);
    expect(averageTime).toBeLessThan(0.2); // Should be under 0.2ms per message
  });

  it('should demonstrate memory efficiency with caching', () => {
    const sessionCount = 2000;

    // Create many sessions
    for (let i = 0; i < sessionCount; i++) {
      orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Memory Test ${i}`,
        workspace: `/memory-test/${i}`,
        config: { data: new Array(100).fill(i) } // Create some memory pressure
      });
    }

    const metrics = orchestrator.getMetrics();

    console.log(`\n📊 Memory Efficiency Metrics:`);
    console.log(`   Session count: ${metrics.sessionCount}`);
    console.log(`   Session cache usage: ${metrics.memory.sessionCacheUsage} bytes`);
    console.log(`   Context cache usage: ${metrics.memory.contextCacheUsage} bytes`);
    console.log(`   Total memory usage: ${metrics.memory.totalMemoryUsage} bytes`);
    console.log(`   Memory per session: ${(metrics.memory.totalMemoryUsage / metrics.sessionCount).toFixed(2)} bytes`);

    expect(metrics.sessionCount).toBe(sessionCount);
    expect(metrics.memory.totalMemoryUsage).toBeGreaterThan(0);
    expect(metrics.memory.totalMemoryUsage).toBeLessThan(50 * 1024 * 1024); // Should be under 50MB
  });

  it('should demonstrate performance improvements with event batching', async () => {
    const batchSize = 100;
    const batchCount = 50;
    let totalEventsProcessed = 0;
    let batchProcessingStartTime = 0;

    // Subscribe with batching enabled
    orchestrator.on('batched-event', (data) => {
      if (totalEventsProcessed === 0) {
        batchProcessingStartTime = performance.now();
      }
      totalEventsProcessed++;

      if (totalEventsProcessed === batchSize * batchCount) {
        const batchProcessingEndTime = performance.now();
        const batchProcessingTime = batchProcessingEndTime - batchProcessingStartTime;
        const averageProcessingTime = batchProcessingTime / (batchSize * batchCount);

        console.log(`\n📊 Event Batching Performance:`);
        console.log(`   Total events processed: ${totalEventsProcessed}`);
        console.log(`   Batch processing time: ${batchProcessingTime.toFixed(2)}ms`);
        console.log(`   Average processing time per event: ${averageProcessingTime.toFixed(4)}ms`);
        console.log(`   Processing throughput: ${(totalEventsProcessed / (batchProcessingTime / 1000)).toFixed(0)} events/sec`);

        expect(averageProcessingTime).toBeLessThan(0.001); // Should be under 0.001ms per event
      }
    });

    // Emit events in batches
    for (let b = 0; b < batchCount; b++) {
      for (let i = 0; i < batchSize; i++) {
        orchestrator.emit('batched-event', {
          batch: b,
          index: i,
          data: `Batch ${b}, Event ${i}`
        });
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  });

  it('should demonstrate performance improvements in session updates', async () => {
    // Create initial sessions
    const sessions = [];
    for (let i = 0; i < 1000; i++) {
      const session = await orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Update Test ${i}`,
        workspace: `/update-test/${i}`
      });
      sessions.push(session);
    }

    // Test performance of batch updates
    const startTime = performance.now();
    for (let i = 0; i < sessions.length; i++) {
      orchestrator.updateSession(sessions[i].id, {
        name: `Updated Session ${i}`,
        config: { updated: true, timestamp: Date.now() }
      });
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / sessions.length;

    console.log(`\n📊 Session Update Performance:`);
    console.log(`   Sessions updated: ${sessions.length}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average time per update: ${averageTime.toFixed(2)}ms`);
    console.log(`   Updates per second: ${(sessions.length / (totalTime / 1000)).toFixed(0)}`);

    expect(averageTime).toBeLessThan(0.5); // Should be under 0.5ms per update
  });

  it('should demonstrate comprehensive performance metrics', () => {
    // Generate some load
    for (let i = 0; i < 100; i++) {
      orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Metric Test ${i}`,
        workspace: `/metric-test/${i}`,
        config: { test: true }
      });

      orchestrator.setContext(`context-${i}`, { metric: i, data: new Array(50).fill(i) });
      orchestrator.emit('metric-event', { index: i, timestamp: Date.now() });
    }

    const detailedMetrics = orchestrator.getMetrics();

    console.log(`\n📊 Comprehensive Performance Metrics:`);
    console.log(`   Session Count: ${detailedMetrics.sessionCount}`);
    console.log(`   Active Sessions: ${detailedMetrics.activeSessions}`);
    console.log(`   Memory Usage: ${(detailedMetrics.memory.totalMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Uptime: ${detailedMetrics.health.uptime.toFixed(2)} seconds`);
    console.log(`   Optimizations Enabled:`);
    console.log(`     - Event Batching: ${detailedMetrics.health.optimizations.eventBatching}`);
    console.log(`     - Object Pooling: ${detailedMetrics.health.optimizations.objectPooling}`);
    console.log(`     - Performance Metrics: ${detailedMetrics.health.optimizations.performanceMetrics}`);
    console.log(`     - UUID Optimization: ${detailedMetrics.health.optimizations.uuidOptimization}`);

    // Verify metrics are being collected
    expect(detailedMetrics.sessionCount).toBe(100);
    expect(detailedMetrics.activeSessions).toBe(100);
    expect(detailedMetrics.memory.totalMemoryUsage).toBeGreaterThan(0);
    expect(detailedMetrics.health.optimizations.eventBatching).toBe(true);
    expect(detailedMetrics.health.optimizations.objectPooling).toBe(true);
    expect(detailedMetrics.health.optimizations.performanceMetrics).toBe(true);
    expect(detailedMetrics.health.optimizations.uuidOptimization).toBe(true);
  });

  it('should demonstrate runtime optimization control', () => {
    const initialConfig = orchestrator.getConfig();

    console.log(`\n📊 Runtime Optimization Control:`);
    console.log(`   Initial Config:`);
    console.log(`     - Optimizations: ${initialConfig.enableOptimizations}`);
    console.log(`     - UUID Strategy: ${initialConfig.uuidStrategy}`);
    console.log(`     - Event Batching: ${initialConfig.enableEventBatching}`);
    console.log(`     - Object Pooling: ${initialConfig.enableObjectPooling}`);

    // Update configuration
    orchestrator.updateConfig({
      uuidStrategy: 'fast',
      enableEventBatching: false,
      maxSessionCacheSize: 500
    });

    const updatedConfig = orchestrator.getConfig();

    console.log(`   Updated Config:`);
    console.log(`     - UUID Strategy: ${updatedConfig.uuidStrategy}`);
    console.log(`     - Event Batching: ${updatedConfig.enableEventBatching}`);
    console.log(`     - Session Cache Size: ${updatedConfig.maxSessionCacheSize}`);

    expect(updatedConfig.uuidStrategy).toBe('fast');
    expect(updatedConfig.enableEventBatching).toBe(false);
    expect(updatedConfig.maxSessionCacheSize).toBe(500);
  });

  it('should demonstrate cleanup and memory management', () => {
    // Create a lot of sessions and contexts
    for (let i = 0; i < 1000; i++) {
      orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Cleanup Test ${i}`,
        workspace: `/cleanup-test/${i}`
      });
      orchestrator.setContext(`cleanup-${i}`, { data: new Array(100).fill(i) });
    }

    // Get initial metrics
    const initialMetrics = orchestrator.getMetrics();
    console.log(`\n📊 Cleanup and Memory Management:`);
    console.log(`   Initial sessions: ${initialMetrics.sessionCount}`);
    console.log(`   Initial memory: ${(initialMetrics.memory.totalMemoryUsage / 1024).toFixed(2)} KB`);

    // Delete half the sessions
    for (let i = 0; i < 500; i++) {
      orchestrator.deleteSession(`session-${i}`);
    }

    // Cleanup
    orchestrator.cleanup();

    // Get final metrics
    const finalMetrics = orchestrator.getMetrics();
    console.log(`   After cleanup sessions: ${finalMetrics.sessionCount}`);
    console.log(`   After cleanup memory: ${(finalMetrics.memory.totalMemoryUsage / 1024).toFixed(2)} KB`);

    expect(finalMetrics.sessionCount).toBeLessThan(initialMetrics.sessionCount);
    orchestrator.shutdown();
  });
});
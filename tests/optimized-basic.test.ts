import { describe, it, expect, beforeEach } from 'bun:test';
import { createOptimizedUnifiedOrchestrator } from '../src/core/unified-optimized.js';
import type { SessionType } from '../src/core/types.js';

describe('Unified Orchestrator Optimized Basic Tests', () => {
  let orchestrator: any;

  beforeEach(() => {
    orchestrator = createOptimizedUnifiedOrchestrator();
  });

  it('should create and retrieve sessions with optimizations', async () => {
    const session = await orchestrator.createSession({
      type: 'development' as SessionType,
      name: 'Optimized Test Session',
      workspace: '/workspace/optimized'
    });

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.type).toBe('development');
    expect(session.name).toBe('Optimized Test Session');
    expect(session.workspace).toBe('/workspace/optimized');
    expect(session.status).toBe('active');

    const retrieved = orchestrator.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
  });

  it('should demonstrate memory efficiency with caching', async () => {
    // Create multiple sessions
    const sessions = [];
    for (let i = 0; i < 100; i++) {
      const session = await orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Memory Test ${i}`,
        workspace: `/memory-test/${i}`
      });
      sessions.push(session);
    }

    // Get metrics to verify memory efficiency
    const metrics = orchestrator.getMetrics();

    expect(metrics.sessionCount).toBe(100);
    expect(metrics.cache).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.memory.totalMemoryUsage).toBeGreaterThan(0);
  });

  it('should demonstrate event handling optimizations', (done) => {
    let eventsReceived = 0;

    orchestrator.on('test-event', (data) => {
      eventsReceived++;
      expect(data.message).toBe('Hello Optimized World!');

      if (eventsReceived === 5) {
        done();
      }
    });

    // Emit multiple events
    for (let i = 0; i < 5; i++) {
      orchestrator.emit('test-event', { message: 'Hello Optimized World!', sequence: i });
    }
  });

  it('should demonstrate performance metrics collection', () => {
    // Generate some operations
    orchestrator.createSession({
      type: 'development' as SessionType,
      name: 'Metric Test',
      workspace: '/metric-test'
    });

    orchestrator.setContext('test-key', { data: 'test-value' });

    const metrics = orchestrator.getMetrics();

    expect(metrics.sessionCount).toBe(1);
    expect(metrics.performance).toBeDefined();
    expect(metrics.health).toBeDefined();
    expect(metrics.health.optimizations).toBeDefined();
  });

  it('should demonstrate runtime configuration updates', () => {
    const initialConfig = orchestrator.getConfig();

    expect(initialConfig.enableOptimizations).toBe(true);
    expect(initialConfig.uuidStrategy).toBe('hybrid');
    expect(initialConfig.enableEventBatching).toBe(true);
    expect(initialConfig.enableObjectPooling).toBe(true);

    // Update configuration
    orchestrator.updateConfig({
      uuidStrategy: 'fast',
      enableEventBatching: false,
      maxSessionCacheSize: 500
    });

    const updatedConfig = orchestrator.getConfig();

    expect(updatedConfig.uuidStrategy).toBe('fast');
    expect(updatedConfig.enableEventBatching).toBe(false);
    expect(updatedConfig.maxSessionCacheSize).toBe(500);
  });

  it('should demonstrate proper cleanup', async () => {
    // Create sessions and contexts
    for (let i = 0; i < 10; i++) {
      await orchestrator.createSession({
        type: 'development' as SessionType,
        name: `Cleanup Test ${i}`,
        workspace: `/cleanup-test/${i}`
      });
      orchestrator.setContext(`context-${i}`, { data: `value-${i}` });
    }

    const beforeMetrics = orchestrator.getMetrics();
    expect(beforeMetrics.sessionCount).toBe(10);

    // Delete some sessions
    const sessions = orchestrator.getAllSessions();
    for (let i = 0; i < 5; i++) {
      orchestrator.deleteSession(sessions[i].id);
    }

    // Cleanup
    orchestrator.cleanup();

    const afterMetrics = orchestrator.getMetrics();
    expect(afterMetrics.sessionCount).toBe(5);

    // Shutdown
    orchestrator.shutdown();

    const shutdownMetrics = orchestrator.getMetrics();
    expect(shutdownMetrics.sessionCount).toBe(0);
  });

  it('should demonstrate messaging optimizations', async () => {
    let messageCount = 0;

    orchestrator.subscribe((message: any) => {
      messageCount++;
      expect(message.type).toBe('user');
      expect(message.source).toBe('test-source');
    });

    const message = orchestrator.publish({
      type: 'user',
      source: 'test-source',
      data: { content: 'Test message' }
    });

    expect(message.id).toBeDefined();
    expect(message.timestamp).toBeDefined();
    expect(message.type).toBe('user');
    expect(message.source).toBe('test-source');
    expect(message.data.content).toBe('Test message');

    // Small delay to allow message processing
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(messageCount).toBe(1);
  });

  it('should demonstrate comprehensive functionality', async () => {
    // Create session
    const session = await orchestrator.createSession({
      type: 'development' as SessionType,
      name: 'Comprehensive Test',
      workspace: '/comprehensive-test',
      config: { test: true }
    });

    // Update session
    orchestrator.updateSession(session.id, {
      name: 'Updated Comprehensive Test',
      config: { test: true, updated: true }
    });

    // Verify update
    const updated = orchestrator.getSession(session.id);
    expect(updated?.name).toBe('Updated Comprehensive Test');
    expect(updated?.config.updated).toBe(true);

    // Set and get context
    orchestrator.setContext('comprehensive-key', { test: 'data' });
    const context = orchestrator.getContext('comprehensive-key');
    expect(context).toEqual({ test: 'data' });

    // Get all contexts
    const allContexts = orchestrator.getAllContexts();
    expect(allContexts.length).toBe(1);

    // Get comprehensive metrics
    const metrics = orchestrator.getMetrics();
    expect(metrics.sessionCount).toBe(1);
    expect(metrics.activeSessions).toBe(1);
    expect(metrics.cache).toBeDefined();
    expect(metrics.managers).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.health).toBeDefined();

    // Verify system health
    expect(metrics.health.optimizations.eventBatching).toBe(true);
    expect(metrics.health.optimizations.objectPooling).toBe(true);
    expect(metrics.health.optimizations.performanceMetrics).toBe(true);
    expect(metrics.health.optimizations.uuidOptimization).toBe(true);
  });
});
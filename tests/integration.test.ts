import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { OrchestrationSystem } from '../src/core/registry.js';
import { Department } from '../src/core/department.js';
import { MessageBus } from '../src/core/message-bus.js';
import { ContextManager } from '../src/core/context.js';
import { CheckpointManager } from '../src/core/checkpoint.js';
import type { Session } from '../src/core/types.js';

describe('Integration Tests - Core Components', () => {
  let orchestration: OrchestrationSystem;
  let department: Department;
  let messageBus: MessageBus;
  let contextManager: ContextManager;
  let checkpointManager: CheckpointManager;

  beforeEach(() => {
    // Initialize all core components
    orchestration = new OrchestrationSystem();
    messageBus = new MessageBus();
    contextManager = new ContextManager();
    checkpointManager = new CheckpointManager({
      maxCheckpoints: 100,
      retentionPeriod: 86400000 // 24 hours
    });
    // Create department with orchestration reference
    department = new Department({ orchestration });
    // Patch the department to use the shared orchestration
    (department as any).orchestration = orchestration;
  });

  afterEach(() => {
    // Clean up all components
    orchestration.shutdown();
    checkpointManager.shutdown();
    messageBus.shutdown();
  });

  describe('Department and Orchestration Integration', () => {
    it('should create sessions through department and retrieve from orchestration', async () => {
      const sessionConfig = {
        type: 'test' as const,
        name: 'Test Session',
        workspace: 'test-workspace',
        config: { key: 'value' }
      };

      const session = await department.createSession(sessionConfig);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.type).toBe('test');
      expect(session.name).toBe('Test Session');
      expect(session.workspace).toBe('test-workspace');
      expect(session.config).toEqual({ key: 'value' });
      expect(session.status).toBe('active');

      // Retrieve from orchestration
      const retrievedSession = orchestration.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(session.id);
    });

    it('should track department metrics correctly', () => {
      // Create multiple sessions
      department.createSession({
        type: 'test',
        name: 'Session 1',
        workspace: 'workspace1'
      });

      department.createSession({
        type: 'test',
        name: 'Session 2',
        workspace: 'workspace2'
      });

      const metrics = department.getDepartmentMetrics();

      expect(metrics.sessionCount).toBe(2);
      expect(metrics.activeSessions).toBe(2);
      expect(typeof metrics.averageResponseTime).toBe('number');
    });
  });

  describe('Message Bus Integration', () => {
    it('should publish and subscribe messages correctly', () => {
      const testMessage = {
        type: 'test',
        source: 'integration-test',
        data: { content: 'Hello World' }
      };

      let receivedMessage: any = null;
      messageBus.subscribe((message) => {
        receivedMessage = message;
      });

      messageBus.publish(testMessage);

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.id).toBeDefined();
      expect(receivedMessage.type).toBe('test');
      expect(receivedMessage.source).toBe('integration-test');
      expect(receivedMessage.data).toEqual({ content: 'Hello World' });
    });

    it('should process message queue correctly', () => {
      const messages = [
        { type: 'test1', source: 'test', data: {} },
        { type: 'test2', source: 'test', data: {} },
        { type: 'test3', source: 'test', data: {} }
      ];

      messages.forEach(msg => messageBus.publish(msg));

      // Process queue should emit processed events for all messages
      let processedCount = 0;
      messageBus.on('processed', () => {
        processedCount++;
      });

      messageBus.processQueue();

      expect(processedCount).toBe(3);
    });
  });

  describe('Context Manager Integration', () => {
    it('should create and manage context windows', () => {
      contextManager.createContextWindow('test-window', 5);

      // Add items beyond the limit
      for (let i = 0; i < 7; i++) {
        contextManager.addContextItem('test-window', `item-${i}`);
      }

      const windowItems = contextManager.getContextWindow('test-window');

      expect(windowItems.length).toBe(5); // Should only keep last 5 items
      expect(windowItems[0]).toBe('item-2'); // First item should be item-2
      expect(windowItems[4]).toBe('item-6'); // Last item should be item-6
    });

    it('should provide context statistics correctly', () => {
      contextManager.setContext('context1', { data: 'test1' });
      contextManager.setContext('context2', { data: 'test2' });

      contextManager.createContextWindow('window1', 10);
      contextManager.addContextItem('window1', 'item1');

      const stats = contextManager.getContextStats();

      expect(stats.totalContexts).toBe(2);
      expect(stats.totalContextWindows).toBe(1);
      expect(stats.averageContextSize).toBe(0.5); // 1 item / 2 contexts = 0.5 average
    });
  });

  describe('Checkpoint Manager Integration', () => {
    it('should create and restore checkpoints', () => {
      const checkpoint = {
        id: 'checkpoint-1',
        sessionId: 'session-1',
        data: { state: 'completed', value: 42 },
        metadata: { createdAt: new Date().toISOString() }
      };

      checkpointManager.createCheckpoint(checkpoint);

      const restored = checkpointManager.restoreCheckpoint('checkpoint-1');
      expect(restored).toEqual({ state: 'completed', value: 42 });
    });

    it('should get checkpoints by session', () => {
      const checkpoint1 = {
        id: 'checkpoint-1',
        sessionId: 'session-1',
        data: { step: 1 }
      };

      const checkpoint2 = {
        id: 'checkpoint-2',
        sessionId: 'session-1',
        data: { step: 2 }
      };

      const checkpoint3 = {
        id: 'checkpoint-3',
        sessionId: 'session-2',
        data: { step: 1 }
      };

      checkpointManager.createCheckpoint(checkpoint1);
      checkpointManager.createCheckpoint(checkpoint2);
      checkpointManager.createCheckpoint(checkpoint3);

      const session1Checkpoints = checkpointManager.getCheckpointsBySession('session-1');
      const session2Checkpoints = checkpointManager.getCheckpointsBySession('session-2');

      expect(session1Checkpoints.length).toBe(2);
      expect(session2Checkpoints.length).toBe(1);
      expect(session1Checkpoints[0].id).toBe('checkpoint-1');
      expect(session2Checkpoints[0].id).toBe('checkpoint-3');
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete session lifecycle with all components', async () => {
      // Create a session
      const session = await orchestration.createSession({
        type: 'workflow',
        name: 'Integration Test Workflow',
        workspace: 'integration-workspace',
        config: { steps: ['init', 'process', 'complete'] }
      });

      // Create context window for the session
      contextManager.createContextWindow(`session-${session.id}`, 10);

      // Add context items throughout workflow
      contextManager.addContextItem(`session-${session.id}`, { step: 'init', timestamp: Date.now() });
      contextManager.addContextItem(`session-${session.id}`, { step: 'process', timestamp: Date.now() });

      // Create checkpoints at key points
      const checkpoint1 = {
        id: `checkpoint-${session.id}-1`,
        sessionId: session.id,
        data: { completedSteps: ['init'] },
        metadata: { timestamp: Date.now() }
      };

      const checkpoint2 = {
        id: `checkpoint-${session.id}-2`,
        sessionId: session.id,
        data: { completedSteps: ['init', 'process'] },
        metadata: { timestamp: Date.now() }
      };

      checkpointManager.createCheckpoint(checkpoint1);
      checkpointManager.createCheckpoint(checkpoint2);

      // Publish workflow events
      messageBus.publish({
        type: 'workflow:progress',
        source: `session-${session.id}`,
        data: { currentStep: 'process', completedSteps: ['init'] }
      });

      messageBus.publish({
        type: 'workflow:complete',
        source: `session-${session.id}`,
        data: { completedSteps: ['init', 'process', 'complete'] }
      });

      // Verify all components are integrated
      const sessionMetrics = department.getDepartmentMetrics();
      expect(sessionMetrics.sessionCount).toBe(1);

      const contextItems = contextManager.getContextItems(`session-${session.id}`);
      expect(contextItems.length).toBe(2);

      const checkpoints = checkpointManager.getCheckpointsBySession(session.id);
      expect(checkpoints.length).toBe(2);

      const messages = messageBus.getMessages();
      expect(messages.length).toBe(2);
      expect(messages.some(msg => msg.type === 'workflow:progress')).toBe(true);
      expect(messages.some(msg => msg.type === 'workflow:complete')).toBe(true);
    });

    it('should handle registry loading and checkpoint retrieval', async () => {
      // Create sessions and checkpoints
      const session1 = await orchestration.createSession({
        type: 'test',
        name: 'Session 1',
        workspace: 'workspace1'
      });

      const session2 = await orchestration.createSession({
        type: 'test',
        name: 'Session 2',
        workspace: 'workspace2'
      });

      // Simulate registry loading
      await orchestration.loadRegistry();

      // Verify all sessions are loaded
      const allSessions = orchestration.getAllSessions();
      expect(allSessions.length).toBe(2);
      expect(allSessions.some(s => s.id === session1.id)).toBe(true);
      expect(allSessions.some(s => s.id === session2.id)).toBe(true);

      // Verify checkpoint retrieval
      const allCheckpoints = orchestration.getAllCheckpoints();
      // Should return empty array as we haven't implemented persistence
      expect(Array.isArray(allCheckpoints)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing sessions gracefully', () => {
      const session = orchestration.getSession('nonexistent-id');
      expect(session).toBeUndefined();
    });

    it('should handle empty context windows', () => {
      contextManager.createContextWindow('empty-window', 10);
      const items = contextManager.getContextWindow('empty-window');
      expect(items).toEqual([]);
    });

    it('should handle missing checkpoints', () => {
      const checkpoint = checkpointManager.restoreCheckpoint('nonexistent-id');
      expect(checkpoint).toBeUndefined();
    });

    it('should handle message bus with no subscribers', () => {
      // Should not throw error when publishing with no subscribers
      expect(() => {
        messageBus.publish({
          type: 'test',
          source: 'no-subscribers',
          data: {}
        });
      }).not.toThrow();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple sessions efficiently', async () => {
      const sessionCount = 100;
      const sessions: Session[] = [];

      // Create multiple sessions
      for (let i = 0; i < sessionCount; i++) {
        const session = await orchestration.createSession({
          type: 'bulk-test',
          name: `Bulk Session ${i}`,
          workspace: 'bulk-workspace'
        });
        sessions.push(session);
      }

      // Verify all sessions were created
      const allSessions = orchestration.getAllSessions();
      expect(allSessions.length).toBe(sessionCount);

      // Verify department metrics
      const metrics = department.getDepartmentMetrics();
      expect(metrics.sessionCount).toBe(sessionCount);
    });

    it('should handle high-frequency messaging', () => {
      const messageCount = 1000;
      const messages: any[] = [];

      // Subscribe to messages
      messageBus.subscribe((message) => {
        messages.push(message);
      });

      // Publish messages rapidly
      for (let i = 0; i < messageCount; i++) {
        messageBus.publish({
          type: 'bulk-message',
          source: 'bulk-test',
          data: { sequence: i }
        });
      }

      // Verify all messages were received
      expect(messages.length).toBe(messageCount);
      expect(messages[0].data.sequence).toBe(0);
      expect(messages[messageCount - 1].data.sequence).toBe(messageCount - 1);
    });
  });
});

describe('Integration - Type Safety', () => {
  it('should maintain type safety across all components', async () => {
    const orchestration = new OrchestrationSystem();
    const department = new Department({});

    const session = await department.createSession({
      type: 'type-safety-test' as const,
      name: 'Type Safety Test',
      workspace: 'type-workspace',
      config: { strict: true }
    });

    // Verify session type is preserved
    expect(session.type).toBe('type-safety-test');
    expect(typeof session.name).toBe('string');
    expect(typeof session.workspace).toBe('string');
    expect(typeof session.config).toBe('object');
    expect(session.status).toBe('active');

    orchestration.shutdown();
  });
});
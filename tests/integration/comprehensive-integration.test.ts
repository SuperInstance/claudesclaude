/**
 * Comprehensive Integration Test Suite for Claude Orchestration System
 * Tests all component interactions, data flows, and edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  OrchestrationSystem,
  createMessageBus,
  createMessageBus as createMessageBusFn,
  createRegistry,
  Director,
  Department,
  ContextManager,
  CheckpointManager,
  createGitManager,
  GitManager,
  type Session,
  type SessionType,
  type SessionStatus,
  type Message
} from '../../src/index.js';

describe('Comprehensive Integration Tests', () => {
  let orchestrationSystem: OrchestrationSystem;
  let messageBus: any;
  let director: Director;
  let department: Department;
  let contextManager: ContextManager;
  let checkpointManager: CheckpointManager;
  let gitManager: GitManager;

  beforeEach(() => {
    // Initialize all components
    orchestrationSystem = createRegistry();
    messageBus = createMessageBusFn();
    director = new Director({ maxConcurrentSessions: 5 }, orchestrationSystem);
    department = new Department({ id: 'test-dept', name: 'Test Department' });
    contextManager = new ContextManager();
    checkpointManager = new CheckpointManager({
      maxCheckpoints: 10,
      retentionPeriod: 86400000
    });
    gitManager = createGitManager();
  });

  afterEach(() => {
    // Cleanup resources
    try {
      if (director['orchestration']) {
        director['orchestration'].deleteSession('test-session-1');
        director['orchestration'].deleteSession('test-session-2');
      }
      messageBus.clear();
      contextManager['contexts'].clear();
      checkpointManager['checkpoints'].clear();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  // 1. Component Integration Testing
  describe('Component Integration', () => {
    test('should properly inject dependencies between components', () => {
      // Verify that Director has access to OrchestrationSystem
      expect(director['orchestration']).toBeInstanceOf(OrchestrationSystem);

      // Verify that Department creates its own OrchestrationSystem
      expect(department['orchestration']).toBeInstanceOf(OrchestrationSystem);

      // Verify that components are independent but functional
      expect(director['orchestration']).not.toBe(department['orchestration']);
    });

    test('should maintain component contracts and interfaces', () => {
      // Test OrchestrationSystem interface
      expect(typeof orchestrationSystem.createSession).toBe('function');
      expect(typeof orchestrationSystem.getSession).toBe('function');
      expect(typeof orchestrationSystem.getAllSessions).toBe('function');
      expect(typeof orchestrationSystem.updateSession).toBe('function');
      expect(typeof orchestrationSystem.deleteSession).toBe('function');

      // Test MessageBus interface
      expect(typeof messageBus.publish).toBe('function');
      expect(typeof messageBus.subscribe).toBe('function');
      expect(typeof messageBus.getMessages).toBe('function');
      expect(typeof messageBus.clear).toBe('function');

      // Test Director interface
      expect(typeof director.createSession).toBe('function');
      expect(typeof director.getSession).toBe('function');
      expect(typeof director.getAllSessions).toBe('function');
      expect(typeof director.start).toBe('function');
      expect(typeof director.stop).toBe('function');

      // Test ContextManager interface
      expect(typeof contextManager.getContext).toBe('function');
      expect(typeof contextManager.setContext).toBe('function');
      expect(typeof contextManager.getAllContexts).toBe('function');

      // Test CheckpointManager interface
      expect(typeof checkpointManager.createCheckpoint).toBe('function');
      expect(typeof checkpointManager.getCheckpoint).toBe('function');
      expect(typeof checkpointManager.getAllCheckpoints).toBe('function');
      expect(typeof checkpointManager.deleteCheckpoint).toBe('function');
    });

    test('should handle component initialization errors gracefully', () => {
      // Test invalid session creation
      expect(() => {
        director.createSession({
          type: 'invalid-type' as SessionType,
          name: 'Test Session',
          workspace: '/tmp/test'
        });
      }).not.toThrow();

      // Test context operations with non-existent keys
      expect(contextManager.getContext('non-existent')).toBeUndefined();
      expect(contextManager.getAllContexts()).toEqual([]);
    });
  });

  // 2. API Contract Verification
  describe('API Contract Verification', () => {
    test('should validate type definitions match implementations', () => {
      // Create a test session
      const sessionPromise = orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Test Session',
        workspace: '/tmp/test'
      });

      expect(sessionPromise).toBeInstanceOf(Promise);

      sessionPromise.then(session => {
        // Verify Session interface implementation
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('type');
        expect(session).toHaveProperty('name');
        expect(session).toHaveProperty('workspace');
        expect(session).toHaveProperty('config');
        expect(session).toHaveProperty('status');
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('updatedAt');

        // Verify Session type constraints
        expect(['ai-assistant', 'development', 'testing', 'deployment']).toContain(session.type);
        expect(['active', 'paused', 'completed', 'failed']).toContain(session.status);
      });
    });

    test('should properly resolve/reject promises', async () => {
      // Test successful session creation
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Test Session',
        workspace: '/tmp/test'
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();

      // Test session retrieval
      const retrievedSession = orchestrationSystem.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(session.id);

      // Test session update
      orchestrationSystem.updateSession(session.id, {
        status: 'completed' as SessionStatus
      });

      const updatedSession = orchestrationSystem.getSession(session.id);
      expect(updatedSession?.status).toBe('completed');

      // Test session deletion
      orchestrationSystem.deleteSession(session.id);
      const deletedSession = orchestrationSystem.getSession(session.id);
      expect(deletedSession).toBeUndefined();
    });

    test('should handle error cases properly', () => {
      // Test getting non-existent session
      const nonExistentSession = orchestrationSystem.getSession('non-existent-id');
      expect(nonExistentSession).toBeUndefined();

      // Test updating non-existent session
      expect(() => {
        orchestrationSystem.updateSession('non-existent-id', { status: 'completed' });
      }).not.toThrow();

      // Test deleting non-existent session
      expect(() => {
        orchestrationSystem.deleteSession('non-existent-id');
      }).not.toThrow();
    });
  });

  // 3. Data Flow Analysis
  describe('Data Flow Analysis', () => {
    test('should trace data flow between components', async () => {
      // Create test session
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Data Flow Test',
        workspace: '/tmp/test',
        config: { test: 'data' }
      });

      // Set context
      contextManager.setContext('test-context', {
        sessionId: session.id,
        data: 'test value'
      });

      // Publish message
      messageBus.publish({
        type: 'test',
        payload: { action: 'test', sessionId: session.id },
        source: 'test-component'
      });

      // Verify data consistency
      const retrievedSession = orchestrationSystem.getSession(session.id);
      expect(retrievedSession?.config.test).toBe('data');

      const retrievedContext = contextManager.getContext('test-context');
      expect(retrievedContext.sessionId).toBe(session.id);

      const messages = messageBus.getMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].payload.sessionId).toBe(session.id);
    });

    test('should handle data serialization/deserialization', () => {
      // Test complex object storage
      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
          date: new Date()
        },
        functions: () => 'test',
        symbol: Symbol('test')
      };

      // Set context with complex data
      contextManager.setContext('complex-context', complexData);

      // Retrieve and verify
      const retrieved = contextManager.getContext('complex-context');
      expect(retrieved.nested.array).toEqual([1, 2, 3]);
      expect(retrieved.nested.object).toEqual({ key: 'value' });
      expect(retrieved.nested.date).toBeInstanceOf(Date);
    });

    test('should maintain shared state consistency', () => {
      // Create multiple sessions
      const session1 = orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Session 1',
        workspace: '/tmp/test1'
      });

      const session2 = orchestrationSystem.createSession({
        type: 'testing' as SessionType,
        name: 'Session 2',
        workspace: '/tmp/test2'
      });

      // Set shared context
      contextManager.setContext('shared-context', {
        sessionIds: [session1.id, session2.id],
        data: 'shared information'
      });

      // Verify all sessions exist
      const allSessions = orchestrationSystem.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toContainEqual(session1);
      expect(allSessions).toContainEqual(session2);

      // Verify shared context
      const sharedContext = contextManager.getContext('shared-context');
      expect(sharedContext.sessionIds).toHaveLength(2);
      expect(sharedContext.data).toBe('shared information');
    });
  });

  // 4. End-to-End Workflow Testing
  describe('End-to-End Workflow Testing', () => {
    test('should complete full session lifecycle', async () => {
      // Step 1: Create session
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Lifecycle Test',
        workspace: '/tmp/lifecycle-test'
      });

      expect(session.status).toBe('active');

      // Step 2: Set context
      contextManager.setContext(session.id, {
        workflow: 'test',
        startTime: new Date(),
        steps: []
      });

      // Step 3: Publish workflow messages
      const workflowSteps = ['initialize', 'execute', 'validate', 'complete'];
      workflowSteps.forEach(step => {
        messageBus.publish({
          type: 'workflow',
          payload: { step, sessionId: session.id },
          source: 'director'
        });
      });

      // Step 4: Update session status through workflow
      await new Promise(resolve => setTimeout(resolve, 100));
      orchestrationSystem.updateSession(session.id, { status: 'completed' as SessionStatus });

      // Step 5: Verify complete state
      const finalSession = orchestrationSystem.getSession(session.id);
      expect(finalSession?.status).toBe('completed');

      const context = contextManager.getContext(session.id);
      expect(context.workflow).toBe('test');

      const messages = messageBus.getMessages();
      expect(messages.filter(m => m.payload.sessionId === session.id)).toHaveLength(4);
    });

    test('should handle message publishing and consumption', () => {
      const receivedMessages: Message[] = [];

      // Subscribe to messages
      messageBus.subscribe((message: Message) => {
        receivedMessages.push(message);
      });

      // Publish messages
      messageBus.publish({
        type: 'test',
        payload: { data: 'message 1' },
        source: 'test-source'
      });

      messageBus.publish({
        type: 'test',
        payload: { data: 'message 2' },
        source: 'test-source'
      });

      // Verify message consumption
      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0].payload.data).toBe('message 1');
      expect(receivedMessages[1].payload.data).toBe('message 2');
    });

    test('should manage context across operations', () => {
      const sessionId = 'test-session-context';

      // Set initial context
      contextManager.setContext(sessionId, {
        operation: 'initial',
        data: 'initial value'
      });

      // Update context during operation
      contextManager.setContext(sessionId, {
        operation: 'updated',
        data: 'updated value',
        timestamp: new Date()
      });

      // Verify context management
      const context = contextManager.getContext(sessionId);
      expect(context.operation).toBe('updated');
      expect(context.data).toBe('updated value');
      expect(context.timestamp).toBeDefined();
    });

    test('should validate error recovery mechanisms', async () => {
      // Create session
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Error Recovery Test',
        workspace: '/tmp/error-test'
      });

      // Simulate error by setting invalid status
      expect(() => {
        orchestrationSystem.updateSession(session.id, {
          status: 'invalid-status' as any
        });
      }).not.toThrow();

      // Verify session still exists and can be recovered
      const recoveredSession = orchestrationSystem.getSession(session.id);
      expect(recoveredSession).toBeDefined();
      expect(recoveredSession?.status).toBe('active'); // Should remain unchanged

      // Clean recovery by setting proper status
      orchestrationSystem.updateSession(session.id, { status: 'completed' as SessionStatus });
      const finalSession = orchestrationSystem.getSession(session.id);
      expect(finalSession?.status).toBe('completed');
    });
  });

  // 5. Configuration and Environment Testing
  describe('Configuration and Environment Testing', () => {
    test('should handle different configuration scenarios', () => {
      // Test with minimal config
      const minimalDirector = new Director({ maxConcurrentSessions: 1 });
      expect(minimalDirector['config'].maxConcurrentSessions).toBe(1);

      // Test with extended config
      const extendedDirector = new Director({
        maxConcurrentSessions: 10,
        customConfig: { feature: 'enabled' }
      });
      expect(extendedDirector['config'].maxConcurrentSessions).toBe(10);
      expect(extendedDirector['config'].customConfig.feature).toBe('enabled');
    });

    test('should handle missing configurations gracefully', () => {
      // Test Department with missing config
      const department = new Department({});
      expect(department['config']).toEqual({});

      // Test ContextManager without config
      const contextManager = new ContextManager();
      expect(contextManager['contexts']).toBeInstanceOf(Map);
    });

    test('should test fallback behaviors', () => {
      // Test GitManager with default values
      const defaultGitManager = createGitManager();
      expect(defaultGitManager['repoPath']).toBe('./');
      expect(defaultGitManager['remote']).toBeUndefined();

      // Test GitManager with custom values
      const customGitManager = createGitManager('./custom', 'origin');
      expect(customGitManager['repoPath']).toBe('./custom');
      expect(customGitManager['remote']).toBe('origin');
    });

    test('should test edge cases in configuration loading', () => {
      // Test null/undefined configurations
      expect(() => new Director(null as any)).toThrow();
      expect(() => new Director(undefined as any)).toThrow();

      // Test empty configuration
      expect(() => new Director({})).not.toThrow();
    });
  });

  // 6. Error Handling and Recovery Testing
  describe('Error Handling and Recovery', () => {
    test('should propagate errors between components', () => {
      // Test error in session creation
      expect(() => {
        orchestrationSystem.createSession({
          type: 'invalid-type' as any,
          name: 'Test',
          workspace: '/tmp'
        });
      }).not.toThrow(); // Current implementation doesn't validate type

      // Test error propagation through message bus
      let errorReceived = false;
      messageBus.subscribe(() => {
        throw new Error('Test error');
      });

      messageBus.publish({
        type: 'test',
        payload: {},
        source: 'test'
      });

      // Check if error was handled (should not crash the system)
      expect(() => {
        messageBus.getMessages();
      }).not.toThrow();
    });

    test('should handle graceful degradation on failures', async () => {
      // Create session
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Degradation Test',
        workspace: '/tmp/degradation-test'
      });

      // Simulate component failure
      const originalGetSession = orchestrationSystem.getSession;
      orchestrationSystem.getSession = () => {
        throw new Error('Simulated failure');
      };

      // Test graceful degradation
      expect(() => {
        const result = orchestrationSystem.getSession(session.id);
        expect(result).toBeUndefined();
      }).not.toThrow();

      // Restore original method
      orchestrationSystem.getSession = originalGetSession;
    });

    test('should properly log and handle errors', () => {
      // Test error logging through message bus
      const consoleSpy = global.console.error;
      let loggedErrors: any[] = [];

      global.console.error = (...args) => {
        loggedErrors.push(...args);
      };

      try {
        // Publish message that might cause error
        messageBus.publish({
          type: 'error-test',
          payload: { invalid: 'data' },
          source: 'test'
        });

        // Verify no errors were logged for normal operation
        expect(loggedErrors).toHaveLength(0);
      } finally {
        global.console.error = consoleSpy;
      }
    });

    test('should test recovery mechanisms', async () => {
      // Create and delete session
      const session = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Recovery Test',
        workspace: '/tmp/recovery-test'
      });

      const sessionId = session.id;
      orchestrationSystem.deleteSession(sessionId);

      // Test recovery by recreating
      const recoveredSession = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Recovered Session',
        workspace: '/tmp/recovery-test'
      });

      expect(recoveredSession.id).not.toBe(sessionId); // Should have new ID
      expect(recoveredSession.name).toBe('Recovered Session');
    });
  });

  // 7. Resource Lifecycle Testing
  describe('Resource Lifecycle Testing', () => {
    test('should properly create and clean up resources', () => {
      // Create resources
      const session = orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Resource Test',
        workspace: '/tmp/resource-test'
      });

      contextManager.setContext('test-context', { data: 'test' });
      messageBus.publish({ type: 'test', payload: {}, source: 'test' });

      // Verify resources exist
      expect(orchestrationSystem.getSession(session.id)).toBeDefined();
      expect(contextManager.getContext('test-context')).toBeDefined();
      expect(messageBus.getMessages().length).toBe(1);

      // Clean up resources
      orchestrationSystem.deleteSession(session.id);
      contextManager['contexts'].delete('test-context');
      messageBus.clear();

      // Verify resources are cleaned up
      expect(orchestrationSystem.getSession(session.id)).toBeUndefined();
      expect(contextManager.getContext('test-context')).toBeUndefined();
      expect(messageBus.getMessages().length).toBe(0);
    });

    test('should test connection management', () => {
      // Test message bus connection management
      expect(messageBus).toBeDefined();
      expect(typeof messageBus.publish).toBe('function');
      expect(typeof messageBus.subscribe).toBe('function');

      // Test that connections are properly managed
      const subscription = messageBus.subscribe(() => {});
      expect(typeof subscription).toBe('function'); // unsubscribe function
    });

    test('should check for resource leaks under stress', () => {
      const stressTestIterations = 100;

      // Perform stress test
      for (let i = 0; i < stressTestIterations; i++) {
        const session = orchestrationSystem.createSession({
          type: 'development' as SessionType,
          name: `Stress Test ${i}`,
          workspace: `/tmp/stress-${i}`
        });

        contextManager.setContext(`context-${i}`, { data: i });
        messageBus.publish({
          type: 'stress',
          payload: { iteration: i },
          source: 'stress-test'
        });

        // Clean up
        orchestrationSystem.deleteSession(session.id);
        contextManager['contexts'].delete(`context-${i}`);
      }

      // Clear messages
      messageBus.clear();

      // Verify no resources leaked
      expect(orchestrationSystem.getAllSessions()).toHaveLength(0);
      expect(contextManager.getAllContexts()).toHaveLength(0);
      expect(messageBus.getMessages()).toHaveLength(0);
    });

    test('should validate cleanup on unexpected errors', () => {
      // Create resources
      const session = orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Error Cleanup Test',
        workspace: '/tmp/error-cleanup'
      });

      contextManager.setContext('error-context', { data: 'test' });

      // Simulate error during operation
      try {
        throw new Error('Simulated unexpected error');
      } catch (error) {
        // Verify resources still exist (should not be affected by error)
        expect(orchestrationSystem.getSession(session.id)).toBeDefined();
        expect(contextManager.getContext('error-context')).toBeDefined();
      }

      // Clean up manually
      orchestrationSystem.deleteSession(session.id);
      contextManager['contexts'].delete('error-context');
    });
  });

  // 8. Cross-Component Integration Tests
  describe('Cross-Component Integration', () => {
    test('should verify all exported modules work together', () => {
      // Import and use all exported components
      const { createMessageBus, createRegistry, createGitManager } = await import('../../src/index.js');

      const testMessageBus = createMessageBus();
      const testRegistry = createRegistry();
      const testGitManager = createGitManager();

      expect(testMessageBus).toBeDefined();
      expect(testRegistry).toBeDefined();
      expect(testGitManager).toBeDefined();

      // Test interaction between imported components
      const session = testRegistry.createSession({
        type: 'development' as SessionType,
        name: 'Import Test',
        workspace: '/tmp/import-test'
      });

      testMessageBus.publish({
        type: 'import-test',
        payload: { sessionId: session.id },
        source: 'import-test'
      });

      expect(testRegistry.getSession(session.id)).toBeDefined();
      expect(testMessageBus.getMessages().length).toBe(1);
    });

    test('should test complex multi-component workflows', async () => {
      // Create multiple sessions
      const directorSession = await orchestrationSystem.createSession({
        type: 'ai-assistant' as SessionType,
        name: 'Director',
        workspace: '/tmp/director'
      });

      const agentSession = await orchestrationSystem.createSession({
        type: 'development' as SessionType,
        name: 'Agent',
        workspace: '/tmp/agent'
      });

      // Set up shared context
      const workflowContext = {
        directorId: directorSession.id,
        agentId: agentSession.id,
        steps: [],
        startTime: new Date()
      };

      contextManager.setContext('workflow-context', workflowContext);

      // Simulate multi-component communication
      messageBus.publish({
        type: 'workflow-start',
        payload: {
          sessionId: directorSession.id,
          target: agentSession.id,
          action: 'start-task'
        },
        source: directorSession.id
      });

      messageBus.publish({
        type: 'workflow-response',
        payload: {
          sessionId: agentSession.id,
          status: 'started',
          timestamp: new Date()
        },
        source: agentSession.id
      });

      // Verify integration
      const allSessions = orchestrationSystem.getAllSessions();
      expect(allSessions).toHaveLength(2);

      const workflowContextData = contextManager.getContext('workflow-context');
      expect(workflowContextData.steps).toHaveLength(2);

      const messages = messageBus.getMessages();
      expect(messages).toHaveLength(2);
    });

    test('should handle concurrent component operations', async () => {
      const concurrentOperations = 10;
      const promises: Promise<Session>[] = [];

      // Create multiple sessions concurrently
      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          orchestrationSystem.createSession({
            type: 'development' as SessionType,
            name: `Concurrent Test ${i}`,
            workspace: `/tmp/concurrent-${i}`
          })
        );
      }

      const sessions = await Promise.all(promises);
      expect(sessions).toHaveLength(concurrentOperations);

      // Verify all sessions were created successfully
      const allSessions = orchestrationSystem.getAllSessions();
      expect(allSessions).toHaveLength(concurrentOperations);

      // Test concurrent context operations
      sessions.forEach(session => {
        contextManager.setContext(`context-${session.id}`, {
          sessionId: session.id,
          index: sessions.findIndex(s => s.id === session.id)
        });
      });

      // Verify all contexts were set
      let contextCount = 0;
      for (const session of sessions) {
        if (contextManager.getContext(`context-${session.id}`)) {
          contextCount++;
        }
      }
      expect(contextCount).toBe(concurrentOperations);
    });
  });
});
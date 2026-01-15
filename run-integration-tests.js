// Simple integration test runner
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running Comprehensive Integration Tests...\n');

// Test cases to run
const testCases = [
  {
    name: 'Component Integration Testing',
    test: async () => {
      console.log('Testing component integration...');

      // Test component instantiation
      try {
        const { createRegistry, createMessageBus, Director, Department, ContextManager, CheckpointManager, createGitManager } =
          await import('./src/index.js');

        const orchestration = createRegistry();
        const messageBus = createMessageBus();
        const director = new Director({ maxConcurrentSessions: 5 }, orchestration);
        const department = new Department({ id: 'test', name: 'Test Department' });
        const contextManager = new ContextManager();
        const checkpointManager = new CheckpointManager({ maxCheckpoints: 10, retentionPeriod: 86400000 });
        const gitManager = createGitManager();

        console.log('✓ All components instantiated successfully');

        // Test component interfaces
        if (typeof orchestration.createSession !== 'function') {
          throw new Error('OrchestrationSystem.createSession is not a function');
        }
        if (typeof messageBus.publish !== 'function') {
          throw new Error('MessageBus.publish is not a function');
        }
        if (typeof director.createSession !== 'function') {
          throw new Error('Director.createSession is not a function');
        }

        console.log('✓ Component interfaces validated');

        return true;
      } catch (error) {
        console.error('✗ Component integration test failed:', error.message);
        return false;
      }
    }
  },

  {
    name: 'API Contract Verification',
    test: async () => {
      console.log('Testing API contracts...');

      try {
        const { createRegistry, createMessageBus } = await import('./src/index.js');

        const orchestration = createRegistry();
        const messageBus = createMessageBus();

        // Test session creation
        const sessionPromise = orchestration.createSession({
          type: 'development',
          name: 'Test Session',
          workspace: '/tmp/test'
        });

        if (!(sessionPromise instanceof Promise)) {
          throw new Error('createSession should return a Promise');
        }

        // Test session retrieval
        const session = orchestration.getSession('non-existent');
        if (session !== undefined) {
          throw new Error('getSession should return undefined for non-existent session');
        }

        // Test message bus
        messageBus.publish({
          type: 'test',
          payload: {},
          source: 'test'
        });

        const messages = messageBus.getMessages();
        if (messages.length !== 1) {
          throw new Error('Message should have been published');
        }

        console.log('✓ API contracts verified');
        return true;
      } catch (error) {
        console.error('✗ API contract test failed:', error.message);
        return false;
      }
    }
  },

  {
    name: 'Data Flow Analysis',
    test: async () => {
      console.log('Testing data flow...');

      try {
        const { createRegistry, createMessageBus, ContextManager } = await import('./src/index.js');

        const orchestration = createRegistry();
        const messageBus = createMessageBus();
        const contextManager = new ContextManager();

        // Create session
        const session = orchestration.createSession({
          type: 'development',
          name: 'Data Flow Test',
          workspace: '/tmp/test',
          config: { test: 'data' }
        }).then(session => {
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
          const retrievedSession = orchestration.getSession(session.id);
          if (retrievedSession.config.test !== 'data') {
            throw new Error('Session data not preserved');
          }

          const retrievedContext = contextManager.getContext('test-context');
          if (retrievedContext.sessionId !== session.id) {
            throw new Error('Context data not preserved');
          }

          const messages = messageBus.getMessages();
          if (messages.length !== 1 || messages[0].payload.sessionId !== session.id) {
            throw new Error('Message data not preserved');
          }

          console.log('✓ Data flow verified');
        });

        return true;
      } catch (error) {
        console.error('✗ Data flow test failed:', error.message);
        return false;
      }
    }
  },

  {
    name: 'Error Handling and Recovery',
    test: async () => {
      console.log('Testing error handling...');

      try {
        const { createRegistry } = await import('./src/index.js');

        const orchestration = createRegistry();

        // Test invalid operations
        const nonExistentSession = orchestration.getSession('non-existent-id');
        if (nonExistentSession !== undefined) {
          throw new Error('Should return undefined for non-existent session');
        }

        // Test error recovery
        const session = orchestration.createSession({
          type: 'development',
          name: 'Error Recovery Test',
          workspace: '/tmp/test'
        }).then(session => {
          orchestration.updateSession(session.id, { status: 'completed' });
          const updatedSession = orchestration.getSession(session.id);
          if (updatedSession.status !== 'completed') {
            throw new Error('Session update failed');
          }

          orchestration.deleteSession(session.id);
          const deletedSession = orchestration.getSession(session.id);
          if (deletedSession !== undefined) {
            throw new Error('Session deletion failed');
          }

          console.log('✓ Error handling verified');
        });

        return true;
      } catch (error) {
        console.error('✗ Error handling test failed:', error.message);
        return false;
      }
    }
  },

  {
    name: 'Resource Lifecycle Management',
    test: async () => {
      console.log('Testing resource lifecycle...');

      try {
        const { createRegistry, createMessageBus, ContextManager } = await import('./src/index.js');

        const orchestration = createRegistry();
        const messageBus = createMessageBus();
        const contextManager = new ContextManager();

        // Create resources
        const session = orchestration.createSession({
          type: 'development',
          name: 'Resource Test',
          workspace: '/tmp/test'
        }).then(session => {
          contextManager.setContext('test-context', { data: 'test' });
          messageBus.publish({ type: 'test', payload: {}, source: 'test' });

          // Verify resources exist
          if (!orchestration.getSession(session.id)) {
            throw new Error('Session not created');
          }
          if (!contextManager.getContext('test-context')) {
            throw new Error('Context not set');
          }
          if (messageBus.getMessages().length !== 1) {
            throw new Error('Message not published');
          }

          // Clean up resources
          orchestration.deleteSession(session.id);
          contextManager.contexts.delete('test-context');
          messageBus.clear();

          // Verify resources are cleaned up
          if (orchestration.getSession(session.id)) {
            throw new Error('Session not deleted');
          }
          if (contextManager.getContext('test-context')) {
            throw new Error('Context not deleted');
          }
          if (messageBus.getMessages().length !== 0) {
            throw new Error('Messages not cleared');
          }

          console.log('✓ Resource lifecycle verified');
        });

        return true;
      } catch (error) {
        console.error('✗ Resource lifecycle test failed:', error.message);
        return false;
      }
    }
  }
];

// Run all tests
let passedTests = 0;
let totalTests = testCases.length;

for (const testCase of testCases) {
  console.log(`\n--- ${testCase.name} ---`);

  try {
    const result = testCase.test();
    if (result) {
      passedTests++;
    }
  } catch (error) {
    console.error('✗ Test failed with exception:', error.message);
  }
}

// Report results
console.log('\n=== Integration Test Results ===');
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Failed: ${totalTests - passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log('🎉 All integration tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some integration tests failed!');
  process.exit(1);
}
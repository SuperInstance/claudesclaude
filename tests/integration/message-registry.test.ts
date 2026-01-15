/**
 * Integration Tests for Message Bus and Registry Integration
 * Verifies end-to-end workflow and cross-component communication
 */

import { createMessageBus } from '../../src/core/message-bus';
import { createRegistry } from '../../src/core/registry';
import { createGitManager } from '../../src/utils/git';
import {
  Session,
  SessionType,
  createSession,
  Message,
  MessageType,
  createMessage,
  SessionStatus
} from '../../src/core/types';

describe('Message Bus and Registry Integration', () => {
  let messageBus: any;
  let registry: any;
  let gitManager: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = '/tmp/orchestration-test';

    // Create temporary directories
    await Bun.$`mkdir -p ${tempDir}/queue ${tempDir}/registry/sessions ${tempDir}/registry/departments ${tempDir}/registry/checkpoints`;

    // Initialize components
    messageBus = createMessageBus({
      queuePath: `${tempDir}/queue`,
      maxQueueSize: 100,
      gcIntervalMs: 60000
    });

    registry = createRegistry({
      storageDir: `${tempDir}/registry`,
      autoSave: false
    });

    gitManager = createGitManager({
      repoPath: tempDir,
      branchPrefix: 'test-orchestration'
    });

    // Stop any intervals
    if (messageBus.gcInterval) {
      clearInterval(messageBus.gcInterval);
    }
  });

  afterEach(async () => {
    await messageBus.shutdown();
    await registry.shutdown();
    await Bun.$`rm -rf ${tempDir}`;
  });

  describe('Complete Session Lifecycle', () => {
    test('should handle complete session lifecycle with messaging', async () => {
      // 1. Create director session
      const director = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      const registeredDirector = await registry.registerSession(director);

      // 2. Create department session
      const department = createSession(SessionType.DEPARTMENT, 'test-department', `${tempDir}/department`);
      const registeredDepartment = await registry.registerSession(department);

      // 3. Subscribe department to messages
      const messagesReceived: Message[] = [];
      const subscription = messageBus.subscribe(async (message: Message) => {
        messagesReceived.push(message);
      }, { types: [MessageType.DIRECTION] });

      // 4. Send direction message from director
      const directionMessage = createMessage(
        MessageType.DIRECTION,
        registeredDirector.id,
        { action: 'create-feature', data: { feature: 'user-auth' } },
        registeredDepartment.id
      );

      await messageBus.publish(directionMessage);

      // 5. Process queue
      await messageBus['processQueue']();

      // 6. Verify message was received
      expect(messagesReceived).toHaveLength(1);
      expect(messagesReceived[0].content.action).toBe('create-feature');

      // 7. Update department based on message
      await registry.updateDepartment(
        'test-department', // This would normally be the department ID
        { isActive: true, currentTask: 'create-feature' }
      );

      // 8. Verify registry state
      const updatedDepartment = await registry.getSession(registeredDepartment.id);
      expect(updatedDepartment.metadata.currentTask).toBe('create-feature');

      // 9. Cleanup
      subscription();
    });

    test('should handle session termination cleanup', async () => {
      // Create and register session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Subscribe to messages
      const subscription = messageBus.subscribe(async () => {});

      // Send message
      const message = createMessage(
        MessageType.DIRECTION,
        session.id,
        { action: 'test' }
      );
      await messageBus.publish(message);

      // Terminate session
      await registry.terminateSession(session.id, 'Test termination');

      // Verify session is terminated
      const terminatedSession = await registry.getSession(session.id);
      expect(terminatedSession.status).toBe(SessionStatus.TERMINATED);

      // Verify message subscription is still active (messages should be processed)
      expect(messageBus['subscribers'].size).toBe(1);
    });
  });

  describe('Message-Registry-Git Integration', () => {
    test('should coordinate message flow with git operations', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'git-test', `${tempDir}/git-test`);
      await registry.registerSession(session);

      // Create git branch for session
      const { branchName, commitHash } = await gitManager.createIsolatedBranch('test-feature');
      await registry.updateSession(session.id, { branch: branchName });

      // Subscribe to git-related messages
      const gitMessages: Message[] = [];
      const subscription = messageBus.subscribe(
        async (message: Message) => {
          gitMessages.push(message);
        },
        { types: [MessageType.COMMAND] }
      );

      // Send git command message
      const gitCommand = createMessage(
        MessageType.COMMAND,
        session.id,
        {
          action: 'commit',
          data: { message: 'Initial commit', files: ['README.md'] }
        }
      );

      await messageBus.publish(gitCommand);
      await messageBus['processQueue']();

      // Verify message was received
      expect(gitMessages).toHaveLength(1);

      // Perform actual git operation
      const commitResult = await gitManager.commitWithMetadata(
        'Test commit',
        ['README.md'],
        { sessionId: session.id }
      );

      // Verify git integration
      expect(commitResult.commitHash).toBeDefined();
      expect(commitResult.branch).toBe(branchName);

      // Update registry with git state
      await registry.updateSession(session.id, {
        metadata: { lastCommit: commitResult.commitHash }
      });

      // Verify registry state
      const updatedSession = await registry.getSession(session.id);
      expect(updatedSession.metadata.lastCommit).toBe(commitResult.commitHash);

      subscription();
    });

    test('should create checkpoints with git state', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'checkpoint-test', `${tempDir}/checkpoint-test`);
      await registry.registerSession(session);

      // Create git branch and commit
      const { branchName } = await gitManager.createIsolatedBranch('checkpoint-test');
      const commitResult = await gitManager.commitWithMetadata(
        'Checkpoint test commit',
        ['test.txt'],
        { sessionId: session.id }
      );

      // Create checkpoint
      const checkpoint = {
        id: 'checkpoint-1',
        name: 'feature-checkpoint',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {
          messages: [],
          sessions: [session],
          departmentStates: {},
          gitState: {
            currentBranch: branchName,
            headCommit: commitResult.commitHash,
            untrackedFiles: [],
            modifiedFiles: [],
            stagedFiles: []
          },
          systemState: {
            memoryUsage: 100,
            cpuUsage: 50,
            diskUsage: 30,
            activeConnections: 10,
            uptime: 3600
          }
        },
        branches: [branchName],
        metadata: { feature: 'checkpoint-test' },
        createdBy: session.id
      };

      await registry.createCheckpoint(checkpoint);

      // Verify checkpoint was created
      const createdCheckpoint = await registry.getCheckpoint('checkpoint-1');
      expect(createdCheckpoint.branches).toContain(branchName);
      expect(createdCheckpoint.snapshot.gitState.headCommit).toBe(commitResult.commitHash);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle message processing failures gracefully', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'error-test', `${tempDir}/error-test`);
      await registry.registerSession(session);

      // Subscribe with error-throwing callback
      const subscription = messageBus.subscribe(async () => {
        throw new Error('Subscriber error');
      });

      // Send message
      const message = createMessage(
        MessageType.DIRECTION,
        session.id,
        { action: 'test' }
      );

      await messageBus.publish(message);

      // Create a mock message file
      const messageFile = `${tempDir}/queue/${message.id}.json`;
      await Bun.write(messageFile, JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        receivedAt: new Date().toISOString()
      }));

      // Process queue (should handle error gracefully)
      await messageBus['processQueue']();

      // Message should be moved to error queue
      const errorFile = `${tempDir}/queue/error/${message.id}.json`;
      const errorContent = await Bun.file(errorFile).text();
      expect(errorContent).toContain('Max retries exceeded');

      subscription();
    });

    test('should handle registry operation failures', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'registry-error-test', `${tempDir}/registry-error-test`);
      await registry.registerSession(session);

      // Mock registry failure
      const originalUpdate = registry.updateSession;
      registry.updateSession = jest.fn().mockRejectedValue(new Error('Registry error'));

      // Try to update session (should handle error)
      await expect(registry.updateSession(session.id, { status: SessionStatus.ACTIVE }))
        .rejects.toThrow('Registry error');

      // Registry should still be functional
      const retrievedSession = await registry.getSession(session.id);
      expect(retrievedSession.status).toBe(SessionStatus.INITIALIZING);

      // Restore original method
      registry.updateSession = originalUpdate;
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent sessions and messages', async () => {
      const sessionCount = 10;
      const messageCount = 5;

      // Create multiple sessions
      const sessions = Array.from({ length: sessionCount }, (_, i) =>
        createSession(SessionType.DEPARTMENT, `dept-${i}`, `${tempDir}/dept-${i}`)
      );

      const registeredSessions = await Promise.all(
        sessions.map(session => registry.registerSession(session))
      );

      // Subscribe all sessions to messages
      const subscriptions = registeredSessions.map(session =>
        messageBus.subscribe(async () => {}, { senders: [session.id] })
      );

      // Send messages from each session
      const messagePromises = registeredSessions.flatMap(session =>
        Array.from({ length: messageCount }, () =>
          messageBus.publish(createMessage(
            MessageType.STATUS_UPDATE,
            session.id,
            { action: 'heartbeat', data: { sessionId: session.id } }
          ))
        )
      );

      await Promise.all(messagePromises);

      // Process all messages
      await messageBus['processQueue']();

      // Verify all messages were processed
      const stats = messageBus.getStats();
      expect(stats.messagesPublished).toBe(sessionCount * messageCount);

      // Cleanup subscriptions
      subscriptions.forEach(sub => sub());
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();

      // Create 100 sessions
      const sessions = Array.from({ length: 100 }, (_, i) =>
        createSession(SessionType.DEPARTMENT, `dept-${i}`, `${tempDir}/dept-${i}`)
      );

      await Promise.all(sessions.map(session => registry.registerSession(session)));

      const registerTime = Date.now() - startTime;
      expect(registerTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Performance should degrade gracefully
      const health = await registry.healthCheck();
      expect(health.status).toBe('healthy');
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistency across component restarts', async () => {
      // Create initial state
      const session = createSession(SessionType.DIRECTOR, 'consistency-test', `${tempDir}/consistency-test`);
      await registry.registerSession(session);

      // Send some messages
      const message1 = createMessage(MessageType.DIRECTION, session.id, { action: 'test-1' });
      const message2 = createMessage(MessageType.DIRECTION, session.id, { action: 'test-2' });

      await messageBus.publish(message1);
      await messageBus.publish(message2);

      // Create some message files
      const messageFiles = [
        { id: message1.id, content: message1 },
        { id: message2.id, content: message2 }
      ];

      for (const { id, content } of messageFiles) {
        const filePath = `${tempDir}/queue/${id}.json`;
        await Bun.write(filePath, JSON.stringify({
          ...content,
          timestamp: content.timestamp.toISOString(),
          receivedAt: new Date().toISOString()
        }));
      }

      // Create checkpoint
      const checkpoint = {
        id: 'consistency-checkpoint',
        name: 'consistency-test',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {
          messages: [message1, message2],
          sessions: [session],
          departmentStates: {},
          gitState: {
            currentBranch: 'main',
            headCommit: 'abc123',
            untrackedFiles: [],
            modifiedFiles: [],
            stagedFiles: []
          },
          systemState: { memoryUsage: 100, cpuUsage: 50, diskUsage: 30, activeConnections: 10, uptime: 3600 }
        },
        branches: ['main'],
        metadata: {},
        createdBy: session.id
      };

      await registry.createCheckpoint(checkpoint);

      // Shutdown and restart components
      await messageBus.shutdown();
      await registry.shutdown();

      // Create new instances
      const newMessageBus = createMessageBus({
        queuePath: `${tempDir}/queue`,
        maxQueueSize: 100,
        gcIntervalMs: 60000
      });

      const newRegistry = createRegistry({
        storageDir: `${tempDir}/registry`,
        autoSave: false
      });

      // Load state
      await newRegistry.loadRegistry();

      // Verify state consistency
      const loadedSessions = await newRegistry.getAllSessions();
      expect(loadedSessions).toHaveLength(1);
      expect(loadedSessions[0].name).toBe('consistency-test');

      const loadedCheckpoints = await newRegistry.getAllCheckpoints();
      expect(loadedCheckpoints).toHaveLength(1);
      expect(loadedCheckpoints[0].id).toBe('consistency-checkpoint');

      // Cleanup
      await newMessageBus.shutdown();
      await newRegistry.shutdown();
    });
  });

  describe('Real-world Workflow Simulation', () => {
    test('should simulate complete feature development workflow', async () => {
      // 1. Initialize
      const director = createSession(SessionType.DIRECTOR, 'feature-director', `${tempDir}/director`);
      await registry.registerSession(director);

      const frontendDept = createSession(SessionType.DEPARTMENT, 'frontend', `${tempDir}/frontend`);
      const backendDept = createSession(SessionType.DEPARTMENT, 'backend', `${tempDir}/backend`);

      await registry.registerSession(frontendDept);
      await registry.registerSession(backendDept);

      // 2. Subscribe departments
      const frontendMessages: Message[] = [];
      const backendMessages: Message[] = [];

      const frontendSub = messageBus.subscribe(
        async (message: Message) => {
          frontendMessages.push(message);
        },
        { types: [MessageType.DIRECTION, MessageType.COMMAND] }
      );

      const backendSub = messageBus.subscribe(
        async (message: Message) => {
          backendMessages.push(message);
        },
        { types: [MessageType.DIRECTION, MessageType.COMMAND] }
      );

      // 3. Create branches
      const frontendBranch = await gitManager.createIsolatedBranch('frontend/user-auth');
      const backendBranch = await gitManager.createIsolatedBranch('backend/user-auth');

      await registry.updateSession(frontendDept.id, { branch: frontendBranch.branchName });
      await registry.updateSession(backendDept.id, { branch: backendBranch.branchName });

      // 4. Backend implements API first
      const backendCommand = createMessage(
        MessageType.COMMAND,
        director.id,
        {
          action: 'implement-api',
          data: { endpoints: ['/auth/login', '/auth/register'] }
        },
        backendDept.id
      );

      await messageBus.publish(backendCommand);
      await messageBus['processQueue']();

      // 5. Backend commits work
      const backendCommit = await gitManager.commitWithMetadata(
        'Implement authentication API',
        ['auth.controller.ts', 'auth.service.ts'],
        { sessionId: backendDept.id, departmentId: 'backend' }
      );

      // 6. Backend shares API contract
      const apiContractMessage = createMessage(
        MessageType.STATUS_UPDATE,
        backendDept.id,
        {
          action: 'api-contract-shared',
          data: { endpoints: ['/auth/login', '/auth/register'], commit: backendCommit.commitHash }
        },
        frontendDept.id
      );

      await messageBus.publish(apiContractMessage);
      await messageBus['processQueue']();

      // 7. Frontend implements UI
      const frontendCommand = createMessage(
        MessageType.COMMAND,
        director.id,
        {
          action: 'implement-ui',
          data: { components: ['LoginForm', 'RegisterForm'] }
        },
        frontendDept.id
      );

      await messageBus.publish(frontendCommand);
      await messageBus['processQueue']();

      // 8. Frontend commits work
      const frontendCommit = await gitManager.commitWithMetadata(
        'Implement authentication forms',
        ['LoginForm.tsx', 'RegisterForm.tsx'],
        { sessionId: frontendDept.id, departmentId: 'frontend' }
      );

      // 9. Create checkpoint
      const checkpoint = {
        id: 'auth-feature-checkpoint',
        name: 'User Authentication Feature',
        timestamp: new Date(),
        sessionId: director.id,
        snapshot: {
          messages: [backendCommand, apiContractMessage, frontendCommand],
          sessions: [director, frontendDept, backendDept],
          departmentStates: {
            frontend: { currentTask: 'implement-ui', completedTasks: [] },
            backend: { currentTask: 'implement-api', completedTasks: [] }
          },
          gitState: {
            currentBranch: frontendBranch.branchName,
            headCommit: frontendCommit.commitHash,
            untrackedFiles: [],
            modifiedFiles: ['LoginForm.tsx', 'RegisterForm.tsx', 'auth.controller.ts', 'auth.service.ts'],
            stagedFiles: []
          },
          systemState: { memoryUsage: 150, cpuUsage: 60, diskUsage: 40, activeConnections: 15, uptime: 7200 }
        },
        branches: [frontendBranch.branchName, backendBranch.branchName],
        metadata: { feature: 'user-auth', priority: 'high' },
        createdBy: director.id
      };

      await registry.createCheckpoint(checkpoint);

      // 10. Verify complete workflow
      expect(frontendMessages).toHaveLength(2); // command + contract
      expect(backendMessages).toHaveLength(1); // command only

      expect(backendCommit.commitHash).toBeDefined();
      expect(frontendCommit.commitHash).toBeDefined();

      const createdCheckpoint = await registry.getCheckpoint('auth-feature-checkpoint');
      expect(createdCheckpoint.branches).toHaveLength(2);
      expect(createdCheckpoint.metadata.feature).toBe('user-auth');

      // Cleanup
      frontendSub();
      backendSub();
    });
  });
});
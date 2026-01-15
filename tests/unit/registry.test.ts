/**
 * Unit Tests for SessionRegistryManager
 * 100% coverage requirement for all core functionality
 */

import fs from 'fs/promises';
import path from 'path';
import { createRegistry } from '../../src/core/registry';
import {
  Session,
  SessionId,
  Department,
  Checkpoint,
  SessionStatus,
  SessionType,
  createSession,
  createMessage,
  OrchestrationError,
  SessionNotFoundError,
  ValidationError
} from '../../src/core/types';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SessionRegistryManager', () => {
  let registry: any;
  let storageDir: string;
  let cleanup: () => void;

  beforeEach(async () => {
    // Create temporary directory
    storageDir = path.join(__dirname, '.test-registry');
    cleanup = jest.fn();

    // Mock fs operations
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);

    // Create registry
    registry = createRegistry({
      storageDir,
      autoSave: false // Disable auto-save for tests
    });
  });

  afterEach(async () => {
    await registry.shutdown();
    cleanup();
  });

  describe('Session Management', () => {
    test('should register a new session', async () => {
      const session = createSession(
        SessionType.DIRECTOR,
        'test-director',
        '/workspace/director'
      );

      const registeredSession = await registry.registerSession(session);

      expect(registeredSession.id).toBe(session.id);
      expect(registeredSession.name).toBe('test-director');
      expect(registeredSession.type).toBe(SessionType.DIRECTOR);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should reject duplicate session names', async () => {
      const session1 = createSession(
        SessionType.DIRECTOR,
        'test-session',
        '/workspace/director'
      );

      const session2 = createSession(
        SessionType.DIRECTOR,
        'test-session',
        '/workspace/director'
      );

      await registry.registerSession(session1);

      await expect(registry.registerSession(session2))
        .rejects.toThrow('Session with name \'test-session\' already exists');
    });

    test('should validate session data', async () => {
      const invalidSession = {
        id: '',
        name: 'test-session',
        type: 'invalid-type' as any,
        status: SessionStatus.ACTIVE,
        branch: 'test-branch',
        workspace: '/workspace',
        createdAt: new Date(),
        lastActivity: new Date(),
        capabilities: [],
        constraints: [],
        metadata: {}
      };

      await expect(registry.registerSession(invalidSession))
        .rejects.toThrow('Session ID is required');
    });

    test('should update session', async () => {
      const session = createSession(
        SessionType.DIRECTOR,
        'test-director',
        '/workspace/director'
      );
      await registry.registerSession(session);

      const updates = {
        status: SessionStatus.ACTIVE,
        metadata: { updated: true }
      };

      const updatedSession = await registry.updateSession(session.id, updates);

      expect(updatedSession.status).toBe(SessionStatus.ACTIVE);
      expect(updatedSession.metadata.updated).toBe(true);
      expect(updatedSession.lastActivity.getTime()).toBeGreaterThan(
        session.lastActivity.getTime()
      );
    });

    test('should get session by ID', async () => {
      const session = createSession(
        SessionType.DIRECTOR,
        'test-director',
        '/workspace/director'
      );
      await registry.registerSession(session);

      const retrievedSession = await registry.getSession(session.id);

      expect(retrievedSession.id).toBe(session.id);
      expect(retrievedSession.name).toBe('test-director');
    });

    test('should throw error for non-existent session', async () => {
      await expect(registry.getSession('non-existent-id'))
        .rejects.toThrow('Session not found: non-existent-id');
    });

    test('should get all sessions', async () => {
      const session1 = createSession(SessionType.DIRECTOR, 'director-1', '/workspace');
      const session2 = createSession(SessionType.DEPARTMENT, 'dept-1', '/workspace');

      await registry.registerSession(session1);
      await registry.registerSession(session2);

      const allSessions = await registry.getAllSessions();

      expect(allSessions).toHaveLength(2);
      expect(allSessions.some(s => s.name === 'director-1')).toBe(true);
      expect(allSessions.some(s => s.name === 'dept-1')).toBe(true);
    });

    test('should get sessions by type', async () => {
      const director = createSession(SessionType.DIRECTOR, 'director', '/workspace');
      const department = createSession(SessionType.DEPARTMENT, 'dept', '/workspace');

      await registry.registerSession(director);
      await registry.registerSession(department);

      const directorSessions = await registry.getSessionsByType(SessionType.DIRECTOR);
      const departmentSessions = await registry.getSessionsByType(SessionType.DEPARTMENT);

      expect(directorSessions).toHaveLength(1);
      expect(departmentSessions).toHaveLength(1);
      expect(directorSessions[0].name).toBe('director');
      expect(departmentSessions[0].name).toBe('dept');
    });

    test('should get active sessions', async () => {
      const activeSession = createSession(SessionType.DIRECTOR, 'active', '/workspace');
      const inactiveSession = createSession(SessionType.DEPARTMENT, 'inactive', '/workspace');

      activeSession.status = SessionStatus.ACTIVE;
      inactiveSession.status = SessionStatus.IDLE;

      await registry.registerSession(activeSession);
      await registry.registerSession(inactiveSession);

      const activeSessions = await registry.getActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].name).toBe('active');
    });

    test('should terminate session', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      await registry.terminateSession(session.id, 'Test termination');

      const terminatedSession = await registry.getSession(session.id);
      expect(terminatedSession.status).toBe(SessionStatus.TERMINATED);
      expect(terminatedSession.metadata.terminationReason).toBe('Test termination');
      expect(registry.stats.activeSessions).toBe(0);
    });

    test('should cleanup associated departments on session termination', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department = {
        id: 'dept-1',
        name: 'test-department',
        domain: 'frontend',
        session,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      await registry.registerDepartment(department);
      await registry.terminateSession(session.id);

      // Should not throw when trying to get non-existent department
      await expect(registry.getDepartment('dept-1'))
        .rejects.toThrow('Department not found: dept-1');
    });
  });

  describe('Department Management', () => {
    test('should register a department', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department = {
        id: 'dept-1',
        name: 'test-department',
        domain: 'frontend',
        session,
        isActive: true,
        currentTask: 'task-1',
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 5,
          averageResponseTime: 100,
          errorRate: 0.1,
          throughput: 2,
          lastActivity: new Date()
        }
      };

      const registeredDepartment = await registry.registerDepartment(department);

      expect(registeredDepartment.id).toBe('dept-1');
      expect(registeredDepartment.name).toBe('test-department');
      expect(registeredDepartment.isActive).toBe(true);
    });

    test('should reject duplicate department IDs', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department1 = {
        id: 'dept-1',
        name: 'dept-1',
        domain: 'frontend',
        session,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      const department2 = {
        ...department1,
        name: 'dept-2'
      };

      await registry.registerDepartment(department1);

      await expect(registry.registerDepartment(department2))
        .rejects.toThrow('Department with ID \'dept-1\' already exists');
    });

    test('should update department', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department = {
        id: 'dept-1',
        name: 'test-department',
        domain: 'frontend',
        session,
        isActive: false,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      await registry.registerDepartment(department);

      const updates = {
        isActive: true,
        currentTask: 'new-task',
        performance: {
          ...department.performance,
          messagesProcessed: 10,
          lastActivity: new Date()
        }
      };

      const updatedDepartment = await registry.updateDepartment('dept-1', updates);

      expect(updatedDepartment.isActive).toBe(true);
      expect(updatedDepartment.currentTask).toBe('new-task');
      expect(updatedDepartment.performance.messagesProcessed).toBe(10);
      expect(updatedDepartment.performance.lastActivity.getTime()).toBeGreaterThan(
        department.performance.lastActivity.getTime()
      );
    });

    test('should get department by ID', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department = {
        id: 'dept-1',
        name: 'test-department',
        domain: 'frontend',
        session,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      await registry.registerDepartment(department);

      const retrievedDepartment = await registry.getDepartment('dept-1');

      expect(retrievedDepartment.id).toBe('dept-1');
      expect(retrievedDepartment.name).toBe('test-department');
    });

    test('should get all departments', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department1 = {
        id: 'dept-1',
        name: 'frontend',
        domain: 'frontend',
        session,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      const department2 = {
        ...department1,
        id: 'dept-2',
        name: 'backend',
        domain: 'backend'
      };

      await registry.registerDepartment(department1);
      await registry.registerDepartment(department2);

      const allDepartments = await registry.getAllDepartments();

      expect(allDepartments).toHaveLength(2);
      expect(allDepartments.some(d => d.name === 'frontend')).toBe(true);
      expect(allDepartments.some(d => d.name === 'backend')).toBe(true);
    });

    test('should get departments by session', async () => {
      const session1 = createSession(SessionType.DIRECTOR, 'director-1', '/workspace');
      const session2 = createSession(SessionType.DIRECTOR, 'director-2', '/workspace');

      await registry.registerSession(session1);
      await registry.registerSession(session2);

      const department1 = {
        id: 'dept-1',
        name: 'frontend',
        domain: 'frontend',
        session: session1,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      const department2 = {
        ...department1,
        id: 'dept-2',
        name: 'backend',
        domain: 'backend',
        session: session2
      };

      await registry.registerDepartment(department1);
      await registry.registerDepartment(department2);

      const session1Departments = await registry.getDepartmentsBySession(session1.id);
      const session2Departments = await registry.getDepartmentsBySession(session2.id);

      expect(session1Departments).toHaveLength(1);
      expect(session2Departments).toHaveLength(1);
      expect(session1Departments[0].name).toBe('frontend');
      expect(session2Departments[0].name).toBe('backend');
    });

    test('should remove department', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const department = {
        id: 'dept-1',
        name: 'test-department',
        domain: 'frontend',
        session,
        isActive: true,
        completedTasks: [],
        pendingMessages: [],
        performance: {
          messagesProcessed: 0,
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          lastActivity: new Date()
        }
      };

      await registry.registerDepartment(department);

      await registry.removeDepartment('dept-1');

      await expect(registry.getDepartment('dept-1'))
        .rejects.toThrow('Department not found: dept-1');
    });
  });

  describe('Checkpoint Management', () => {
    test('should create a checkpoint', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const checkpoint: Checkpoint = {
        id: 'checkpoint-1',
        name: 'feature-checkpoint',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {
          messages: [],
          sessions: [session],
          departmentStates: {},
          gitState: {
            currentBranch: 'test-branch',
            headCommit: 'abc123',
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
        branches: ['feature-branch'],
        metadata: { feature: 'user-auth' },
        createdBy: session.id
      };

      const createdCheckpoint = await registry.createCheckpoint(checkpoint);

      expect(createdCheckpoint.id).toBe('checkpoint-1');
      expect(createdCheckpoint.name).toBe('feature-checkpoint');
      expect(registry.stats.totalCheckpoints).toBe(1);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should validate checkpoint data', async () => {
      const invalidCheckpoint = {
        id: '',
        name: 'test-checkpoint',
        timestamp: new Date(),
        sessionId: 'session-1',
        snapshot: {} as any,
        branches: [],
        metadata: {},
        createdBy: 'session-1'
      };

      await expect(registry.createCheckpoint(invalidCheckpoint))
        .rejects.toThrow('Checkpoint ID is required');
    });

    test('should get checkpoint by ID', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const checkpoint: Checkpoint = {
        id: 'checkpoint-1',
        name: 'test-checkpoint',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {} as any,
        branches: [],
        metadata: {},
        createdBy: session.id
      };

      await registry.createCheckpoint(checkpoint);

      const retrievedCheckpoint = await registry.getCheckpoint('checkpoint-1');

      expect(retrievedCheckpoint.id).toBe('checkpoint-1');
      expect(retrievedCheckpoint.name).toBe('test-checkpoint');
    });

    test('should get all checkpoints', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const checkpoint1: Checkpoint = {
        id: 'checkpoint-1',
        name: 'checkpoint-1',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {} as any,
        branches: [],
        metadata: {},
        createdBy: session.id
      };

      const checkpoint2: Checkpoint = {
        ...checkpoint1,
        id: 'checkpoint-2',
        name: 'checkpoint-2'
      };

      await registry.createCheckpoint(checkpoint1);
      await registry.createCheckpoint(checkpoint2);

      const allCheckpoints = await registry.getAllCheckpoints();

      expect(allCheckpoints).toHaveLength(2);
      expect(allCheckpoints.some(c => c.name === 'checkpoint-1')).toBe(true);
      expect(allCheckpoints.some(c => c.name === 'checkpoint-2')).toBe(true);
    });

    test('should get checkpoints by session', async () => {
      const session1 = createSession(SessionType.DIRECTOR, 'director-1', '/workspace');
      const session2 = createSession(SessionType.DIRECTOR, 'director-2', '/workspace');

      await registry.registerSession(session1);
      await registry.registerSession(session2);

      const checkpoint1: Checkpoint = {
        id: 'checkpoint-1',
        name: 'checkpoint-1',
        timestamp: new Date(),
        sessionId: session1.id,
        snapshot: {} as any,
        branches: [],
        metadata: {},
        createdBy: session1.id
      };

      const checkpoint2: Checkpoint = {
        ...checkpoint1,
        id: 'checkpoint-2',
        sessionId: session2.id
      };

      await registry.createCheckpoint(checkpoint1);
      await registry.createCheckpoint(checkpoint2);

      const session1Checkpoints = await registry.getCheckpointsBySession(session1.id);
      const session2Checkpoints = await registry.getCheckpointsBySession(session2.id);

      expect(session1Checkpoints).toHaveLength(1);
      expect(session2Checkpoints).toHaveLength(1);
      expect(session1Checkpoints[0].name).toBe('checkpoint-1');
      expect(session2Checkpoints[0].name).toBe('checkpoint-2');
    });

    test('should delete checkpoint', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const checkpoint: Checkpoint = {
        id: 'checkpoint-1',
        name: 'test-checkpoint',
        timestamp: new Date(),
        sessionId: session.id,
        snapshot: {} as any,
        branches: [],
        metadata: {},
        createdBy: session.id
      };

      await registry.createCheckpoint(checkpoint);

      await registry.deleteCheckpoint('checkpoint-1');

      await expect(registry.getCheckpoint('checkpoint-1'))
        .rejects.toThrow('Checkpoint not found: checkpoint-1');
      expect(registry.stats.totalCheckpoints).toBe(0);
    });
  });

  describe('Message Queue', () => {
    test('should enqueue message', async () => {
      const message = createMessage(
        MessageType.DIRECTION,
        'session-1',
        { action: 'test' }
      );

      await registry.enqueueMessage(message);

      expect(registry.messageQueue).toContain(message);
      expect(registry.stats.totalMessages).toBe(1);
    });

    test('should dequeue messages', async () => {
      const message1 = createMessage(MessageType.DIRECTION, 'session-1', { action: 'test-1' });
      const message2 = createMessage(MessageType.DIRECTION, 'session-2', { action: 'test-2' });

      await registry.enqueueMessage(message1);
      await registry.enqueueMessage(message2);

      const dequeued = await registry.dequeueMessages(2);

      expect(dequeued).toHaveLength(2);
      expect(dequeued).toContain(message1);
      expect(dequeued).toContain(message2);
      expect(registry.messageQueue).toHaveLength(0);
    });

    test('should dequeue limited number of messages', async () => {
      const message1 = createMessage(MessageType.DIRECTION, 'session-1', { action: 'test-1' });
      const message2 = createMessage(MessageType.DIRECTION, 'session-2', { action: 'test-2' });

      await registry.enqueueMessage(message1);
      await registry.enqueueMessage(message2);

      const dequeued = await registry.dequeueMessages(1);

      expect(dequeued).toHaveLength(1);
      expect(dequeued[0]).toBe(message1);
      expect(registry.messageQueue).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('should track session statistics', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      expect(registry.stats.totalSessions).toBe(1);
      expect(registry.stats.activeSessions).toBe(1);

      await registry.terminateSession(session.id);

      expect(registry.stats.totalSessions).toBe(1);
      expect(registry.stats.activeSessions).toBe(0);
    });

    test('should include message queue statistics', async () => {
      const message = createMessage(MessageType.DIRECTION, 'session-1', { action: 'test' });

      await registry.enqueueMessage(message);

      const stats = registry.getStats();

      expect(stats.totalMessages).toBe(1);
      expect(stats.messageQueue).toContain(message);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status for normal operation', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const health = await registry.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.stats.activeSessions).toBe(1);
    });

    test('should return degraded status for high session utilization', async () => {
      // Create many sessions
      for (let i = 0; i < 18; i++) {
        const session = createSession(SessionType.DIRECTOR, `test-${i}`, '/workspace');
        session.status = SessionStatus.ACTIVE;
        await registry.registerSession(session);
      }

      const health = await registry.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.details.warnings).toContain('High session utilization');
    });

    test('should return unhealthy status for very high session utilization', async () => {
      // Create many sessions (90%+ utilization)
      for (let i = 0; i < 27; i++) {
        const session = createSession(SessionType.DIRECTOR, `test-${i}`, '/workspace');
        session.status = SessionStatus.ACTIVE;
        await registry.registerSession(session);
      }

      const health = await registry.healthCheck();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Loading and Persistence', () => {
    test('should load sessions from storage', async () => {
      const sessionData = {
        id: 'session-1',
        name: 'test-session',
        type: SessionType.DIRECTOR,
        status: SessionStatus.ACTIVE,
        branch: 'test-branch',
        workspace: '/workspace',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastActivity: '2023-01-01T00:00:00.000Z',
        capabilities: [],
        constraints: [],
        metadata: {}
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));

      await registry.loadRegistry();

      const loadedSession = await registry.getSession('session-1');
      expect(loadedSession.name).toBe('test-session');
      expect(loadedSession.createdAt).toBeInstanceOf(Date);
      expect(loadedSession.lastActivity).toBeInstanceOf(Date);
    });

    test('should handle load errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Load failed'));

      await expect(registry.loadRegistry())
        .rejects.toThrow('Failed to load registry');
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors during registration', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');

      await expect(registry.registerSession(session))
        .rejects.toThrow('Failed to load registry');
    });

    test('should handle errors during session termination', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      mockFs.unlink.mockRejectedValue(new Error('Delete failed'));

      // Should not throw, but log the error
      await expect(registry.terminateSession(session.id))
        .resolves.not.toThrow();
    });
  });

  describe('Concurrency and Performance', () => {
    test('should handle concurrent session registration', async () => {
      const sessions = Array.from({ length: 5 }, (_, i) =>
        createSession(SessionType.DEPARTMENT, `dept-${i}`, '/workspace')
      );

      const registrationPromises = sessions.map(session =>
        registry.registerSession(session)
      );

      const results = await Promise.all(registrationPromises);

      expect(results).toHaveLength(5);
      expect(registry.stats.totalSessions).toBe(5);
    });

    test('should maintain consistency during concurrent updates', async () => {
      const session = createSession(SessionType.DIRECTOR, 'test', '/workspace');
      await registry.registerSession(session);

      const updatePromises = Array.from({ length: 3 }, (_, i) =>
        registry.updateSession(session.id, {
          metadata: { updateId: i }
        })
      );

      const results = await Promise.all(updatePromises);

      // All updates should succeed
      expect(results).toHaveLength(3);
      expect(results.every(r => r.id === session.id)).toBe(true);
    });
  });
});
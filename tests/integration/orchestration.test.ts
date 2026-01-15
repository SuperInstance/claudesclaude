/**
 * Integration Tests for Orchestration Workflows
 * Verifies end-to-end coordination between Director, Departments, and Context management
 */

import { createMessage, MessageType, MessagePriority, SessionType, SessionStatus } from '../../src/core/types';
import { createMessageBus } from '../../src/core/message-bus';
import { createRegistry } from '../../src/core/registry';
import { Director, DirectorConfig } from '../../src/core/director';
import { Department, DepartmentConfig } from '../../src/core/department';
import { ContextManager } from '../../src/core/context';
import { CheckpointManager, CheckpointConfig } from '../../src/core/checkpoint';
import { createGitManager } from '../../src/utils/git';

describe('Orchestration Workflow Integration', () => {
  let messageBus: any;
  let registry: any;
  let gitManager: any;
  let director: Director;
  let department: Department;
  let contextManager: ContextManager;
  let checkpointManager: CheckpointManager;
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

    // Initialize director
    const directorConfig: DirectorConfig = {
      maxConcurrentSessions: 5,
      decisionTimeoutMs: 30000,
      qualityGateTimeoutMs: 10000,
      autoRetryFailedDecisions: true,
      enableRollbackOnFailure: true,
      checkpointInterval: 300000,
      maxRetries: 3
    };
    director = new Director(directorConfig, messageBus, registry, gitManager);

    // Initialize department
    const departmentConfig: DepartmentConfig = {
      id: 'test-department',
      name: 'Test Department',
      domain: 'backend',
      maxConcurrentTasks: 3,
      taskTimeoutMs: 15000,
      enableAutoScaling: false,
      resourceLimits: {
        memory: 512,
        cpu: 50,
        disk: 10
      },
      capabilities: ['code_analysis', 'test_execution', 'deployment'],
      constraints: ['no_production_access', 'require_review']
    };
    department = new Department(departmentConfig, messageBus, registry);

    // Initialize context manager
    contextManager = new ContextManager(registry);

    // Initialize checkpoint manager
    const checkpointConfig: CheckpointConfig = {
      maxCheckpoints: 10,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      autoCheckpointInterval: 60000, // 1 minute
      compressionEnabled: false,
      encryptionEnabled: false,
      backupOnRemote: false
    };
    checkpointManager = new CheckpointManager(checkpointConfig, registry, gitManager);

    // Stop any intervals
    if (messageBus.gcInterval) {
      clearInterval(messageBus.gcInterval);
    }
  });

  afterEach(async () => {
    await director.shutdown();
    await department.shutdown();
    await contextManager.shutdown();
    await checkpointManager.shutdown();
    await messageBus.shutdown();
    await registry.shutdown();
    await Bun.$`rm -rf ${tempDir}`;
  });

  describe('Director-Department Coordination', () => {
    test('should coordinate workflow execution between director and department', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Subscribe department to director messages
      const messagesReceived: any[] = [];
      const subscription = messageBus.subscribe(async (message: any) => {
        messagesReceived.push(message);
      }, { types: [MessageType.COMMAND], senders: [session.id] });

      // Create workflow
      const workflow = {
        id: 'test-workflow',
        name: 'Test Feature Development',
        sessionId: session.id,
        steps: [
          {
            id: 'step-1',
            name: 'Code Analysis',
            type: 'execute',
            target: 'test-department',
            action: 'code_analysis',
            parameters: { files: ['src/index.ts'] },
            dependencies: [],
            timeoutMs: 10000,
            qualityGates: ['code_quality', 'performance']
          },
          {
            id: 'step-2',
            name: 'Test Execution',
            type: 'execute',
            target: 'test-department',
            action: 'test_execution',
            parameters: { tests: ['unit', 'integration'] },
            dependencies: ['step-1'],
            timeoutMs: 15000,
            qualityGates: ['test_coverage']
          }
        ]
      };

      // Start workflow
      const workflowId = await director.createWorkflow(workflow);

      // Process messages
      await messageBus['processQueue']();

      // Verify workflow progressed
      const workflowStatus = director.getWorkflow(workflowId);
      expect(workflowStatus).toBeDefined();
      expect(workflowStatus?.currentStep).toBeGreaterThan(0);

      // Verify department received and processed messages
      expect(messagesReceived.length).toBeGreaterThan(0);

      // Cleanup
      subscription();
    });

    test('should handle quality gate failures and retries', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Mock quality gate to fail
      let qualityGateCallCount = 0;
      director.registerQualityGate('failing_gate', async () => {
        qualityGateCallCount++;
        return {
          name: 'failing_gate',
          passed: qualityGateCallCount < 2, // Pass on second attempt
          score: 30,
          details: 'Quality gate failed initially, passed on retry',
          timestamp: new Date(),
          retryable: true
        };
      });

      // Create workflow with quality gate
      const workflow = {
        id: 'test-quality-workflow',
        name: 'Quality Gate Test',
        sessionId: session.id,
        steps: [
          {
            id: 'quality-step',
            name: 'Quality Check',
            type: 'verify',
            target: 'test-department',
            action: 'verify_quality',
            parameters: {},
            dependencies: [],
            timeoutMs: 5000,
            qualityGates: ['failing_gate']
          }
        ]
      };

      // Start workflow
      const workflowId = await director.createWorkflow(workflow);

      // Allow time for workflow execution
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify quality gate was retried
      expect(qualityGateCallCount).toBe(2);

      // Cleanup
    });
  });

  describe('Context Management Integration', () => {
    test('should maintain context across workflow steps', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Create context window
      const contextWindowId = await contextManager.createContextWindow(session.id, 'Workflow Context');

      // Add initial context
      await contextManager.addContextItem(contextWindowId, {
        type: 'message',
        content: { action: 'start_workflow', feature: 'user-auth' },
        metadata: {
          timestamp: new Date(),
          importance: 0.8,
          tags: ['workflow', 'initialization']
        },
        confidence: 0.9,
        source: 'direct'
      });

      // Create workflow that uses context
      const workflow = {
        id: 'context-workflow',
        name: 'Context-Aware Workflow',
        sessionId: session.id,
        steps: [
          {
            id: 'context-step-1',
            name: 'Read Context',
            type: 'execute',
            target: 'test-department',
            action: 'read_context',
            parameters: { contextQuery: 'workflow initialization' },
            dependencies: [],
            timeoutMs: 5000,
            qualityGates: []
          },
          {
            id: 'context-step-2',
            name: 'Update Context',
            type: 'execute',
            target: 'test-department',
            action: 'update_context',
            parameters: { contextUpdate: 'feature implementation started' },
            dependencies: ['context-step-1'],
            timeoutMs: 5000,
            qualityGates: []
          }
        ]
      };

      // Start workflow
      const workflowId = await director.createWorkflow(workflow);

      // Process messages
      await messageBus['processQueue']();

      // Verify context was maintained
      const contextItems = await contextManager.getContextItems({
        sessionId: session.id,
        tags: ['workflow']
      });

      expect(contextItems.length).toBeGreaterThan(0);

      // Cleanup
    });

    test('should detect and resolve context conflicts', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Create context window
      const contextWindowId = await contextManager.createContextWindow(session.id, 'Conflict Test Context');

      // Add first context item
      await contextManager.addContextItem(contextWindowId, {
        type: 'decision',
        content: { feature: 'user-auth', status: 'approved' },
        metadata: {
          timestamp: new Date(),
          importance: 0.9,
          tags: ['decision', 'feature-approval']
        },
        confidence: 0.95,
        source: 'direct'
      });

      // Add conflicting context item
      await contextManager.addContextItem(contextWindowId, {
        type: 'decision',
        content: { feature: 'user-auth', status: 'rejected' },
        metadata: {
          timestamp: new Date(Date.now() + 1000), // 1 second later
          importance: 0.9,
          tags: ['decision', 'feature-approval']
        },
        confidence: 0.95,
        source: 'direct'
      });

      // Check for conflicts
      const contextStats = contextManager.getContextStats();
      expect(contextStats.totalConflicts).toBeGreaterThan(0);

      // Cleanup
    });
  });

  describe('Checkpoint Management Integration', () => {
    test('should create checkpoints during workflow execution', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Create checkpoint
      const checkpointId = await checkpointManager.createCheckpoint({
        name: 'workflow-checkpoint',
        sessionId: session.id,
        branches: ['main'],
        metadata: {
          feature: 'checkpoint-test',
          priority: 'high',
          description: 'Test checkpoint during workflow',
          tags: ['workflow', 'checkpoint']
        },
        createdBy: session.id
      });

      expect(checkpointId).toBeDefined();

      // Verify checkpoint was created
      const checkpoint = checkpointManager.getCheckpoint(checkpointId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.name).toBe('workflow-checkpoint');

      // Cleanup
    });

    test('should restore workflow from checkpoint', async () => {
      // Create session
      const session = createSession(SessionType.DIRECTOR, 'test-director', `${tempDir}/director`);
      await registry.registerSession(session);

      // Create initial checkpoint
      const checkpointId = await checkpointManager.createCheckpoint({
        name: 'initial-state',
        sessionId: session.id,
        branches: ['main'],
        metadata: {
          feature: 'restore-test',
          tags: ['initial-state']
        },
        createdBy: session.id
      });

      // Create workflow
      const workflow = {
        id: 'restore-workflow',
        name: 'Restore Test Workflow',
        sessionId: session.id,
        steps: [
          {
            id: 'step-1',
            name: 'Initial Step',
            type: 'execute',
            target: 'test-department',
            action: 'initial_task',
            parameters: {},
            dependencies: [],
            timeoutMs: 5000,
            qualityGates: []
          }
        ]
      };

      // Start workflow
      const workflowId = await director.createWorkflow(workflow);

      // Allow workflow to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create second checkpoint
      const secondCheckpointId = await checkpointManager.createCheckpoint({
        name: 'mid-workflow',
        sessionId: session.id,
        branches: ['main'],
        metadata: {
          feature: 'restore-test',
          tags: ['mid-workflow']
        },
        createdBy: session.id
      });

      // Restore from second checkpoint
      const restoreOptions = {
        restoreType: 'full' as const,
        includeSessions: [],
        excludeSessions: [],
        includeContext: true,
        includeGitState: true,
        includeSystemState: true,
        validationMode: 'strict' as const,
        backupCurrentState: true
      };

      const restoreResult = await checkpointManager.restoreCheckpoint(secondCheckpointId, restoreOptions);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredSessions.length).toBeGreaterThan(0);

      // Cleanup
    });
  });

  describe('Complete End-to-End Workflow', () => {
    test('should execute complete feature development workflow', async () => {
      // Setup
      const directorSession = createSession(SessionType.DIRECTOR, 'feature-director', `${tempDir}/director`);
      await registry.registerSession(directorSession);

      const frontendDeptSession = createSession(SessionType.DEPARTMENT, 'frontend', `${tempDir}/frontend`);
      const backendDeptSession = createSession(SessionType.DEPARTMENT, 'backend', `${tempDir}/backend`);
      await registry.registerSession(frontendDeptSession);
      await registry.registerSession(backendDeptSession);

      // Create context window
      const contextWindowId = await contextManager.createContextWindow(directorSession.id, 'Feature Development Context');

      // Add initial context
      await contextManager.addContextItem(contextWindowId, {
        type: 'message',
        content: { action: 'start_feature', feature: 'user-authentication' },
        metadata: {
          timestamp: new Date(),
          importance: 0.9,
          tags: ['feature', 'initialization']
        },
        confidence: 1.0,
        source: 'director'
      });

      // Create branches
      const frontendBranch = await gitManager.createIsolatedBranch('feature/user-auth-frontend');
      const backendBranch = await gitManager.createIsolatedBranch('feature/user-auth-backend');

      await registry.updateSession(frontendDeptSession.id, { branch: frontendBranch.branchName });
      await registry.updateSession(backendDeptSession.id, { branch: backendBranch.branchName });

      // Create complete workflow
      const workflow = {
        id: 'complete-feature-workflow',
        name: 'Complete User Authentication Feature',
        sessionId: directorSession.id,
        steps: [
          {
            id: 'backend-api',
            name: 'Implement Backend API',
            type: 'execute',
            target: backendDeptSession.id,
            action: 'execute_task',
            parameters: {
              name: 'Implement Authentication API',
              type: 'code_analysis',
              payload: { endpoints: ['/auth/login', '/auth/register'] }
            },
            dependencies: [],
            timeoutMs: 10000,
            qualityGates: ['code_quality', 'security']
          },
          {
            id: 'backend-commit',
            name: 'Backend Commit',
            type: 'checkpoint',
            target: directorSession.id,
            action: 'create_checkpoint',
            parameters: { name: 'Backend API Complete' },
            dependencies: ['backend-api'],
            timeoutMs: 5000,
            qualityGates: []
          },
          {
            id: 'frontend-ui',
            name: 'Implement Frontend UI',
            type: 'execute',
            target: frontendDeptSession.id,
            action: 'execute_task',
            parameters: {
              name: 'Create Authentication Forms',
              type: 'documentation_generation',
              payload: { components: ['LoginForm', 'RegisterForm'] }
            },
            dependencies: ['backend-commit'],
            timeoutMs: 10000,
            qualityGates: ['code_quality', 'performance']
          },
          {
            id: 'integration-test',
            name: 'Run Integration Tests',
            type: 'execute',
            target: backendDeptSession.id,
            action: 'execute_task',
            parameters: {
              name: 'Integration Testing',
              type: 'test_execution',
              payload: { tests: ['auth-flow', 'user-management'] }
            },
            dependencies: ['frontend-ui'],
            timeoutMs: 15000,
            qualityGates: ['test_coverage', 'performance']
          },
          {
            id: 'final-deployment',
            name: 'Deploy to Production',
            type: 'execute',
            target: frontendDeptSession.id,
            action: 'execute_task',
            parameters: {
              name: 'Production Deployment',
              type: 'deploy_service',
              payload: { service: 'auth-service' }
            },
            dependencies: ['integration-test'],
            timeoutMs: 20000,
            qualityGates: ['security', 'performance']
          }
        ]
      };

      // Start workflow
      const workflowId = await director.createWorkflow(workflow);

      // Process messages and wait for completion
      let workflowCompleted = false;
      const workflowTimeout = setTimeout(() => {
        workflowCompleted = true;
      }, 30000); // 30 second timeout

      director.on('workflow_completed', (completedWorkflow) => {
        if (completedWorkflow.id === workflowId) {
          workflowCompleted = true;
          clearTimeout(workflowTimeout);
        }
      });

      // Process queue periodically
      const processInterval = setInterval(async () => {
        await messageBus['processQueue']();
      }, 1000);

      // Wait for completion
      await new Promise((resolve) => {
        const checkCompletion = () => {
          if (workflowCompleted) {
            clearInterval(processInterval);
            resolve(true);
          } else {
            setTimeout(checkCompletion, 500);
          }
        };
        checkCompletion();
      });

      // Verify workflow completed successfully
      const finalWorkflow = director.getWorkflow(workflowId);
      expect(finalWorkflow?.status).toBe('completed');

      // Verify context was maintained
      const contextItems = await contextManager.getContextItems({
        sessionId: directorSession.id,
        tags: ['feature']
      });
      expect(contextItems.length).toBeGreaterThan(0);

      // Verify checkpoints were created
      const checkpoints = checkpointManager.getCheckpointsBySession(directorSession.id);
      expect(checkpoints.length).toBeGreaterThan(0);

      // Verify department metrics
      const deptMetrics = department.getDepartmentMetrics();
      expect(deptMetrics.totalTasks).toBeGreaterThan(0);

      // Cleanup
    }, 35000); // Extended timeout for complex workflow
  });

  // Helper function to create session
  function createSession(type: SessionType, name: string, workspace: string) {
    const { createSession } = require('../../src/core/types');
    return createSession(type, name, workspace);
  }
});
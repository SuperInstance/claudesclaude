/**
 * Director Orchestration Logic
 * Central decision-making engine for multi-agent coordination
 * Implements the Director Protocol with quality gates and workflow management
 */

import { EventEmitter } from 'events';
import { createMessage, MessageType, MessagePriority, SessionType, SessionStatus } from './types';
import { MessageBus } from './message-bus';
import { SessionRegistryManager } from './registry';
import { GitManager } from '../utils/git';
import {
  OrchestrationError,
  ValidationError,
  SessionNotFoundError,
  DepartmentNotFoundError,
  CheckpointNotFoundError
} from './types';

export interface DirectorConfig {
  maxConcurrentSessions: number;
  decisionTimeoutMs: number;
  qualityGateTimeoutMs: number;
  autoRetryFailedDecisions: boolean;
  enableRollbackOnFailure: boolean;
  checkpointInterval: number;
  maxRetries: number;
}

export interface DecisionContext {
  sessionId: string;
  decisionPoints: DecisionPoint[];
  currentPhase: string;
  qualityGateResults: QualityGateResult[];
  metadata: Record<string, any>;
}

export interface DecisionPoint {
  id: string;
  name: string;
  type: 'automated' | 'manual' | 'review';
  required: boolean;
  timeoutMs: number;
  dependencies: string[];
  criteria: DecisionCriteria;
}

export interface DecisionCriteria {
  type: 'code_quality' | 'test_coverage' | 'performance' | 'security' | 'business_logic';
  threshold: number;
  weight: number;
}

export interface QualityGateResult {
  name: string;
  passed: boolean;
  score: number;
  details: string;
  timestamp: Date;
  retryable: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'execute' | 'verify' | 'checkpoint' | 'rollback';
  target: string; // session ID or department ID
  action: string;
  parameters: Record<string, any>;
  dependencies: string[];
  timeoutMs: number;
  qualityGates: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  sessionId: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  currentStep: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

/**
 * Director Orchestration Engine
 * Coordinates multi-agent workflows with decision points and quality gates
 */
export class Director extends EventEmitter {
  private config: DirectorConfig;
  private messageBus: MessageBus;
  private registry: SessionRegistryManager;
  private gitManager: GitManager;
  private activeWorkflows: Map<string, Workflow> = new Map();
  private decisionContexts: Map<string, DecisionContext> = new Map();
  private qualityGateHandlers: Map<string, QualityGateHandler> = new Map();
  private workflowStepHandlers: Map<string, WorkflowStepHandler> = new Map();

  constructor(
    config: DirectorConfig,
    messageBus: MessageBus,
    registry: SessionRegistryManager,
    gitManager: GitManager
  ) {
    super();
    this.config = config;
    this.messageBus = messageBus;
    this.registry = registry;
    this.gitManager = gitManager;

    // Initialize default quality gate handlers
    this.initializeQualityGates();

    // Initialize workflow step handlers
    this.initializeWorkflowStepHandlers();

    // Subscribe to relevant messages
    this.setupMessageSubscriptions();
  }

  /**
   * Initialize default quality gate handlers
   */
  private initializeQualityGates(): void {
    // Code Quality Gate
    this.registerQualityGate('code_quality', async (context) => {
      const session = await this.registry.getSession(context.sessionId);
      if (!session) {
        return {
          passed: false,
          score: 0,
          details: 'Session not found',
          retryable: false
        };
      }

      // Simulate code quality assessment
      const qualityScore = Math.random() * 100; // In real implementation, this would analyze actual code
      return {
        passed: qualityScore >= 80,
        score: qualityScore,
        details: `Code quality score: ${qualityScore.toFixed(1)}%`,
        retryable: true
      };
    });

    // Test Coverage Gate
    this.registerQualityGate('test_coverage', async (context) => {
      const session = await this.registry.getSession(context.sessionId);
      if (!session) {
        return {
          passed: false,
          score: 0,
          details: 'Session not found',
          retryable: false
        };
      }

      // Simulate test coverage assessment
      const coverageScore = Math.random() * 100; // In real implementation, this would analyze test coverage
      return {
        passed: coverageScore >= 90,
        score: coverageScore,
        details: `Test coverage: ${coverageScore.toFixed(1)}%`,
        retryable: true
      };
    });

    // Performance Gate
    this.registerQualityGate('performance', async (context) => {
      const session = await this.registry.getSession(context.sessionId);
      if (!session) {
        return {
          passed: false,
          score: 0,
          details: 'Session not found',
          retryable: false
        };
      }

      // Simulate performance assessment
      const performanceScore = Math.random() * 100; // In real implementation, this would measure actual performance
      return {
        passed: performanceScore >= 85,
        score: performanceScore,
        details: `Performance score: ${performanceScore.toFixed(1)}%`,
        retryable: true
      };
    });

    // Security Gate
    this.registerQualityGate('security', async (context) => {
      const session = await this.registry.getSession(context.sessionId);
      if (!session) {
        return {
          passed: false,
          score: 0,
          details: 'Session not found',
          retryable: false
        };
      }

      // Simulate security assessment
      const securityScore = Math.random() * 100; // In real implementation, this would run security scans
      return {
        passed: securityScore >= 95,
        score: securityScore,
        details: `Security scan result: ${securityScore.toFixed(1)}%`,
        retryable: false // Security issues should not be retried automatically
      };
    });
  }

  /**
   * Initialize workflow step handlers
   */
  private initializeWorkflowStepHandlers(): void {
    // Execute step handler
    this.registerWorkflowStepHandler('execute', async (step, workflow) => {
      const message = createMessage(
        MessageType.COMMAND,
        workflow.sessionId,
        {
          action: step.action,
          parameters: step.parameters,
          workflowStep: step.id
        },
        step.target
      );

      await this.messageBus.publish(message);

      // Wait for acknowledgment or timeout
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, message: 'Step execution timeout' });
        }, step.timeoutMs);

        this.once(`step_${step.id}_completed`, () => {
          clearTimeout(timeout);
          resolve({ success: true, message: 'Step completed successfully' });
        });

        this.once(`step_${step.id}_failed`, () => {
          clearTimeout(timeout);
          resolve({ success: false, message: 'Step execution failed' });
        });
      });
    });

    // Verify step handler
    this.registerWorkflowStepHandler('verify', async (step, workflow) => {
      // Implement verification logic
      const verificationResult = await this.runQualityGates(step.qualityGates, workflow.sessionId);

      return {
        success: verificationResult.every(gate => gate.passed),
        message: verificationResult.map(gate =>
          `${gate.name}: ${gate.passed ? 'PASS' : 'FAIL'} (${gate.score.toFixed(1)}%)`
        ).join(', ')
      };
    });

    // Checkpoint step handler
    this.registerWorkflowStepHandler('checkpoint', async (step, workflow) => {
      const checkpointData = {
        workflowId: workflow.id,
        sessionId: workflow.sessionId,
        stepId: step.id,
        timestamp: new Date(),
        metadata: step.parameters
      };

      await this.registry.createCheckpoint({
        id: `checkpoint-${workflow.id}-${step.id}`,
        name: `${workflow.name} - Checkpoint ${step.id}`,
        timestamp: new Date(),
        sessionId: workflow.sessionId,
        snapshot: {
          messages: [],
          sessions: [await this.registry.getSession(workflow.sessionId)],
          departmentStates: {},
          gitState: {
            currentBranch: 'main',
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
        }},
        branches: ['main'],
        metadata: { workflowId: workflow.id, stepId: step.id },
        createdBy: workflow.sessionId
      });

      return { success: true, message: 'Checkpoint created successfully' };
    });

    // Rollback step handler
    this.registerWorkflowStepHandler('rollback', async (step, workflow) => {
      if (this.config.enableRollbackOnFailure) {
        await this.rollbackWorkflow(workflow.id);
        return { success: true, message: 'Rollback completed successfully' };
      }
      return { success: false, message: 'Rollback is disabled' };
    });
  }

  /**
   * Set up message subscriptions
   */
  private setupMessageSubscriptions(): void {
    this.messageBus.subscribe(async (message) => {
      if (message.type === MessageType.STATUS_UPDATE && message.content.workflowStep) {
        await this.handleWorkflowStepUpdate(message);
      }
    }, { types: [MessageType.STATUS_UPDATE, MessageType.COMMAND] });
  }

  /**
   * Register a quality gate handler
   */
  registerQualityGate(name: string, handler: QualityGateHandler): void {
    this.qualityGateHandlers.set(name, handler);
  }

  /**
   * Register a workflow step handler
   */
  registerWorkflowStepHandler(type: string, handler: WorkflowStepHandler): void {
    this.workflowStepHandlers.set(type, handler);
  }

  /**
   * Create and start a new workflow
   */
  async createWorkflow(
    workflow: Omit<Workflow, 'id' | 'status' | 'currentStep' | 'createdAt' | 'metadata'>,
    decisionPoints?: DecisionPoint[]
  ): Promise<string> {
    if (this.activeWorkflows.size >= this.config.maxConcurrentSessions) {
      throw new OrchestrationError(
        'Maximum concurrent sessions reached',
        'MAX_SESSIONS_EXCEEDED',
        'high',
        false
      );
    }

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullWorkflow: Workflow = {
      ...workflow,
      id: workflowId,
      status: 'pending',
      currentStep: 0,
      createdAt: new Date(),
      metadata: workflow.metadata || {}
    };

    this.activeWorkflows.set(workflowId, fullWorkflow);

    // Create decision context if provided
    if (decisionPoints) {
      this.decisionContexts.set(workflowId, {
        sessionId: workflow.sessionId,
        decisionPoints,
        currentPhase: 'initialization',
        qualityGateResults: [],
        metadata: {}
      });
    }

    // Publish workflow start event
    const startMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'workflow_started',
        workflowId,
        name: workflow.name,
        stepCount: workflow.steps.length
      }
    );

    await this.messageBus.publish(startMessage);

    this.emit('workflow_created', fullWorkflow);
    this.startWorkflow(workflowId);

    return workflowId;
  }

  /**
   * Start a workflow execution
   */
  async startWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new OrchestrationError(
        `Workflow not found: ${workflowId}`,
        'WORKFLOW_NOT_FOUND',
        'high',
        false
      );
    }

    if (workflow.status !== 'pending') {
      throw new OrchestrationError(
        `Workflow is not in pending state: ${workflow.status}`,
        'INVALID_WORKFLOW_STATE',
        'medium',
        false
      );
    }

    workflow.status = 'running';
    workflow.startedAt = new Date();

    const startMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'workflow_started',
        workflowId,
        name: workflow.name,
        currentStep: workflow.currentStep,
        totalSteps: workflow.steps.length
      }
    );

    await this.messageBus.publish(startMessage);

    this.emit('workflow_started', workflow);
    this.executeNextStep(workflowId);
  }

  /**
   * Execute the next step in a workflow
   */
  async executeNextStep(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    if (workflow.currentStep >= workflow.steps.length) {
      // Workflow completed
      await this.completeWorkflow(workflowId);
      return;
    }

    const step = workflow.steps[workflow.currentStep];

    try {
      // Check dependencies
      const dependenciesMet = await this.checkStepDependencies(workflow, step);
      if (!dependenciesMet) {
        throw new OrchestrationError(
          `Dependencies not met for step ${step.id}`,
          'DEPENDENCY_NOT_MET',
          'medium',
          true
        );
      }

      // Execute the step
      const handler = this.workflowStepHandlers.get(step.type);
      if (!handler) {
        throw new OrchestrationError(
          `No handler found for step type: ${step.type}`,
          'STEP_HANDLER_NOT_FOUND',
          'high',
          false
        );
      }

      const result = await handler(step, workflow);

      if (result.success) {
        // Step completed successfully
        workflow.currentStep++;

        const updateMessage = createMessage(
          MessageType.PROGRESS_REPORT,
          workflow.sessionId,
          {
            action: 'step_completed',
            workflowId,
            stepId: step.id,
            stepName: step.name,
            currentStep: workflow.currentStep,
            totalSteps: workflow.steps.length
          }
        );

        await this.messageBus.publish(updateMessage);
        this.emit('step_completed', { workflow, step, result });

        // Execute next step
        await this.executeNextStep(workflowId);
      } else {
        // Step failed
        await this.handleStepFailure(workflowId, step, result.message);
      }
    } catch (error) {
      await this.handleStepFailure(workflowId, step, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if step dependencies are met
   */
  private async checkStepDependencies(workflow: Workflow, step: WorkflowStep): Promise<boolean> {
    for (const depId of step.dependencies) {
      const depStep = workflow.steps.find(s => s.id === depId);
      if (!depStep || workflow.currentStep <= workflow.steps.indexOf(depStep)) {
        return false;
      }

      // In a real implementation, we might check actual results of dependent steps
    }
    return true;
  }

  /**
   * Handle step failure
   */
  private async handleStepFailure(workflowId: string, step: WorkflowStep, error: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const failureMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'step_failed',
        workflowId,
        stepId: step.id,
        stepName: step.name,
        error,
        retryCount: workflow.metadata[step.id]?.retryCount || 0
      }
    );

    await this.messageBus.publish(failureMessage);
    this.emit('step_failed', { workflow, step, error });

    // Check if we should retry
    const retryCount = (workflow.metadata[step.id]?.retryCount || 0) + 1;

    if (retryCount <= this.config.maxRetries && step.timeoutMs > 0) {
      // Retry with exponential backoff
      workflow.metadata[step.id] = { retryCount };

      setTimeout(() => {
        this.executeNextStep(workflowId);
      }, Math.min(step.timeoutMs * 2, 30000)); // Max 30 second delay
    } else {
      // Workflow failed
      await this.failWorkflow(workflowId, `Step ${step.name} failed: ${error}`);
    }
  }

  /**
   * Complete a workflow successfully
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = new Date();

    const completionMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'workflow_completed',
        workflowId,
        name: workflow.name,
        duration: workflow.completedAt.getTime() - workflow.startedAt!.getTime(),
        stepsCompleted: workflow.steps.length
      }
    );

    await this.messageBus.publish(completionMessage);
    this.emit('workflow_completed', workflow);

    // Clean up
    this.activeWorkflows.delete(workflowId);
    this.decisionContexts.delete(workflowId);
  }

  /**
   * Fail a workflow
   */
  private async failWorkflow(workflowId: string, error: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'failed';

    const failureMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'workflow_failed',
        workflowId,
        name: workflow.name,
        error,
        failedStep: workflow.currentStep
      }
    );

    await this.messageBus.publish(failureMessage);
    this.emit('workflow_failed', { workflow, error });

    // Clean up
    this.activeWorkflows.delete(workflowId);
    this.decisionContexts.delete(workflowId);
  }

  /**
   * Rollback a workflow
   */
  private async rollbackWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    // Implement rollback logic
    // This would typically involve restoring checkpoints or reverting git commits

    workflow.status = 'rolled_back';
    workflow.completedAt = new Date();

    const rollbackMessage = createMessage(
      MessageType.PROGRESS_REPORT,
      workflow.sessionId,
      {
        action: 'workflow_rolled_back',
        workflowId,
        name: workflow.name,
        rollbackTo: workflow.currentStep > 0 ? workflow.steps[workflow.currentStep - 1].id : 'start'
      }
    );

    await this.messageBus.publish(rollbackMessage);
    this.emit('workflow_rolled_back', workflow);

    // Clean up
    this.activeWorkflows.delete(workflowId);
    this.decisionContexts.delete(workflowId);
  }

  /**
   * Handle workflow step updates from message bus
   */
  private async handleWorkflowStepUpdate(message: any): Promise<void> {
    const { workflowId, stepId, status } = message.content;

    if (!workflowId || !stepId) return;

    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    if (status === 'completed') {
      this.emit(`step_${stepId}_completed`, { workflow, stepId });
    } else if (status === 'failed') {
      this.emit(`step_${stepId}_failed`, { workflow, stepId });
    }
  }

  /**
   * Run quality gates for a workflow
   */
  private async runQualityGates(gateNames: string[], sessionId: string): Promise<QualityGateResult[]> {
    const results: QualityGateResult[] = [];

    for (const gateName of gateNames) {
      const handler = this.qualityGateHandlers.get(gateName);
      if (!handler) {
        results.push({
          name: gateName,
          passed: false,
          score: 0,
          details: `Quality gate not found: ${gateName}`,
          timestamp: new Date(),
          retryable: true
        });
        continue;
      }

      try {
        const result = await handler({ sessionId });
        results.push(result);
      } catch (error) {
        results.push({
          name: gateName,
          passed: false,
          score: 0,
          details: `Error running quality gate: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          retryable: true
        });
      }
    }

    return results;
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get workflow stats
   */
  getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values()).filter(w => w.status === 'running');
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats() {
    const workflows = Array.from(this.activeWorkflows.values());
    return {
      total: workflows.length,
      running: workflows.filter(w => w.status === 'running').length,
      completed: workflows.filter(w => w.status === 'completed').length,
      failed: workflows.filter(w => w.status === 'failed').length,
      averageDuration: workflows
        .filter(w => w.startedAt && w.completedAt)
        .reduce((acc, w) => acc + (w.completedAt!.getTime() - w.startedAt!.getTime()), 0) /
        workflows.filter(w => w.startedAt && w.completedAt).length || 0
    };
  }

  /**
   * Shutdown the director
   */
  async shutdown(): Promise<void> {
    // Cancel all running workflows
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.status === 'running') {
        await this.failWorkflow(workflowId, 'Director shutdown');
      }
    }

    this.removeAllListeners();
  }
}

// Type definitions for handlers
export type QualityGateHandler = (context: { sessionId: string }) => Promise<QualityGateResult>;
export type WorkflowStepHandler = (step: WorkflowStep, workflow: Workflow) => Promise<{ success: boolean; message: string }>;
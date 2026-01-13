/**
 * Checkpoint Management System
 * Manages system state snapshots, version control integration, and rollback capabilities
 * Provides reliable recovery and point-in-time restoration for orchestration sessions
 */

import { EventEmitter } from 'events';
import { createMessage, MessageType, MessagePriority } from './types';
import { SessionRegistryManager } from './registry';
import { GitManager } from '../utils/git';
import {
  OrchestrationError,
  ValidationError,
  CheckpointNotFoundError,
  RestoreError
} from './types';

export interface CheckpointConfig {
  maxCheckpoints: number;
  retentionPeriod: number; // milliseconds
  autoCheckpointInterval: number; // milliseconds
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backupOnRemote: boolean;
}

export interface SystemSnapshot {
  timestamp: Date;
  sessions: SessionSnapshot[];
  messages: MessageSnapshot[];
  gitState: GitSnapshot;
  systemState: SystemStateSnapshot;
  context: ContextSnapshot;
}

export interface SessionSnapshot {
  id: string;
  name: string;
  type: string;
  status: string;
  branch: string | null;
  workspace: string;
  metadata: Record<string, any>;
  departments: DepartmentSnapshot[];
  lastActivity: Date;
  createdAt: Date;
}

export interface DepartmentSnapshot {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  currentTask: string | null;
  completedTasks: string[];
  pendingMessages: string[];
  performance: PerformanceSnapshot;
}

export interface PerformanceSnapshot {
  messagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastActivity: Date;
}

export interface MessageSnapshot {
  id: string;
  type: string;
  sender: string;
  receiver: string | null;
  content: any;
  timestamp: Date;
  priority: string;
  retryCount: number;
  status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
}

export interface GitSnapshot {
  currentBranch: string;
  headCommit: string;
  branches: string[];
  tags: string[];
  untrackedFiles: string[];
  modifiedFiles: string[];
  stagedFiles: string[];
  remotes: RemoteSnapshot[];
}

export interface RemoteSnapshot {
  name: string;
  url: string;
  connected: boolean;
  lastSync: Date | null;
}

export interface SystemStateSnapshot {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  activeConnections: number;
  uptime: number; // seconds
  loadAverage: number[];
  environment: string;
  version: string;
}

export interface ContextSnapshot {
  totalItems: number;
  windows: number;
  averageImportance: number;
  itemsByType: Record<string, number>;
  conflicts: number;
  knowledgeGraph: {
    nodes: number;
    edges: number;
    version: number;
  };
}

export interface Checkpoint {
  id: string;
  name: string;
  sessionId: string;
  timestamp: Date;
  snapshot: SystemSnapshot;
  branches: string[];
  metadata: {
    feature?: string;
    priority?: string;
    author?: string;
    description?: string;
    tags: string[];
  };
  createdBy: string;
  size: number;
  checksum: string;
  compressed: boolean;
  encrypted: boolean;
  retentionExpiresAt?: Date;
  restoredFrom?: string; // ID of checkpoint this was restored from
}

export interface RestoreOptions {
  restoreType: 'full' | 'partial' | 'selective';
  targetBranch?: string;
  restorePoint: Date;
  includeContext: boolean;
  includeGitState: boolean;
  includeSystemState: boolean;
  includeSessions: string[]; // session IDs to restore (empty means all)
  excludeSessions: string[]; // session IDs to exclude
  validationMode: 'strict' | 'lenient';
  backupCurrentState: boolean;
}

export interface RestoreResult {
  success: boolean;
  restoredSessions: string[];
  restoredBranches: string[];
  restoredCheckpoints: string[];
  conflicts: RestoreConflict[];
  warnings: string[];
  duration: number;
  newHeadCommit?: string;
  errors: string[];
}

export interface RestoreConflict {
  type: 'session_exists' | 'branch_exists' | 'file_conflict' | 'metadata_conflict';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution: 'skip' | 'overwrite' | 'rename' | 'manual';
  affectedItems: string[];
}

/**
 * Checkpoint Management System
 * Handles system state snapshots and restoration with version control integration
 */
export class CheckpointManager extends EventEmitter {
  private config: CheckpointConfig;
  private registry: SessionRegistryManager;
  private gitManager: GitManager;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private checkpointHistory: string[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    config: CheckpointConfig,
    registry: SessionRegistryManager,
    gitManager: GitManager
  ) {
    super();
    this.config = config;
    this.registry = registry;
    this.gitManager = gitManager;

    // Start auto-checkpoint interval
    if (this.config.autoCheckpointInterval > 0) {
      this.cleanupInterval = setInterval(
        () => this.createAutoCheckpoint(),
        this.config.autoCheckpointInterval
      );
    }

    // Load existing checkpoints
    this.loadExistingCheckpoints();
  }

  /**
   * Load existing checkpoints from registry
   */
  private async loadExistingCheckpoints(): Promise<void> {
    try {
      const checkpoints = await this.registry.getAllCheckpoints();
      for (const checkpoint of checkpoints) {
        this.checkpoints.set(checkpoint.id, checkpoint);
        this.checkpointHistory.push(checkpoint.id);
      }

      // Maintain history size
      if (this.checkpointHistory.length > this.config.maxCheckpoints) {
        const toRemove = this.checkpointHistory.splice(0, this.checkpointHistory.length - this.config.maxCheckpoints);
        for (const id of toRemove) {
          this.checkpoints.delete(id);
        }
      }
    } catch (error) {
      console.warn('Failed to load existing checkpoints:', error);
    }
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(
    checkpointData: Omit<Checkpoint, 'id' | 'timestamp' | 'size' | 'checksum' | 'compressed' | 'encrypted'>,
    autoSave: boolean = false
  ): Promise<string> {
    const checkpointId = checkpointData.id || `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create system snapshot
    const snapshot = await this.createSystemSnapshot();

    // Calculate checksum
    const checksum = this.calculateChecksum(snapshot);

    // Calculate size
    const serialized = JSON.stringify(snapshot);
    const size = Buffer.byteLength(serialized, 'utf8');

    const checkpoint: Checkpoint = {
      ...checkpointData,
      id: checkpointId,
      timestamp: new Date(),
      snapshot,
      size,
      checksum,
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled,
      retentionExpiresAt: new Date(Date.now() + this.config.retentionPeriod)
    };

    // Store checkpoint
    this.checkpoints.set(checkpointId, checkpoint);
    this.checkpointHistory.push(checkpointId);

    // Maintain history size
    if (this.checkpointHistory.length > this.config.maxCheckpoints) {
      const oldestId = this.checkpointHistory.shift()!;
      this.checkpoints.delete(oldestId);
    }

    // Save to registry
    await this.registry.createCheckpoint(checkpoint);

    // Create git tag
    await this.gitManager.createCheckpointTag(checkpointId, checkpoint.name);

    // Emit event
    this.emit('checkpoint_created', checkpoint);

    // Send notification
    const notification = createMessage(
      MessageType.PROGRESS_REPORT,
      checkpoint.sessionId,
      {
        action: 'checkpoint_created',
        checkpointId,
        name: checkpoint.name,
        size,
        timestamp: checkpoint.timestamp
      }
    );

    await this.registry.publishMessageToSession(checkpoint.sessionId, notification);

    return checkpointId;
  }

  /**
   * Create system snapshot
   */
  private async createSystemSnapshot(): Promise<SystemSnapshot> {
    // Get all sessions
    const sessions = await this.registry.getAllSessions();
    const sessionSnapshots: SessionSnapshot[] = [];

    for (const session of sessions) {
      const departments = await this.registry.getDepartmentsBySession(session.id);
      const departmentSnapshots = departments.map(dept => ({
        id: dept.id,
        name: dept.name,
        domain: dept.domain,
        isActive: dept.isActive,
        currentTask: dept.currentTask,
        completedTasks: dept.completedTasks,
        pendingMessages: dept.pendingMessages,
        performance: dept.performance
      }));

      sessionSnapshots.push({
        id: session.id,
        name: session.name,
        type: session.type,
        status: session.status,
        branch: session.branch,
        workspace: session.workspace,
        metadata: session.metadata,
        departments: departmentSnapshots,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt
      });
    }

    // Get messages (simplified - in practice would query message bus)
    const messages: MessageSnapshot[] = [];

    // Get git state
    const gitState = await this.gitManager.getCurrentState();

    // Get system state (simplified)
    const systemState: SystemStateSnapshot = {
      memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0,
      cpuUsage: process.cpuUsage ? process.cpuUsage().user / 1000000 : 0,
      diskUsage: 0, // Would need to calculate actual disk usage
      activeConnections: 10, // Would need to track actual connections
      uptime: process.uptime ? process.uptime() : 0,
      loadAverage: [0, 0, 0], // Would need to get actual load average
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Get context state (simplified)
    const context: ContextSnapshot = {
      totalItems: 0,
      windows: 0,
      averageImportance: 0,
      itemsByType: {},
      conflicts: 0,
      knowledgeGraph: {
        nodes: 0,
        edges: 0,
        version: 1
      }
    };

    return {
      timestamp: new Date(),
      sessions: sessionSnapshots,
      messages,
      gitState,
      systemState,
      context
    };
  }

  /**
   * Calculate checksum for snapshot
   */
  private calculateChecksum(snapshot: SystemSnapshot): string {
    const data = JSON.stringify(snapshot);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * List all checkpoints
   */
  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * List checkpoints for a session
   */
  getCheckpointsBySession(sessionId: string): Checkpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Restore system to a checkpoint
   */
  async restoreCheckpoint(
    checkpointId: string,
    options: Partial<RestoreOptions> = {}
  ): Promise<RestoreResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new CheckpointNotFoundError(`Checkpoint not found: ${checkpointId}`);
    }

    const restoreOptions: RestoreOptions = {
      restoreType: 'full',
      targetBranch: `restore-${checkpointId}`,
      restorePoint: checkpoint.timestamp,
      includeContext: true,
      includeGitState: true,
      includeSystemState: true,
      includeSessions: [],
      excludeSessions: [],
      validationMode: 'strict',
      backupCurrentState: true,
      ...options
    };

    const startTime = Date.now();
    const result: RestoreResult = {
      success: false,
      restoredSessions: [],
      restoredBranches: [],
      restoredCheckpoints: [],
      conflicts: [],
      warnings: [],
      duration: 0,
      errors: []
    };

    try {
      // Backup current state if requested
      if (restoreOptions.backupCurrentState) {
        const backupId = await this.createCheckpoint({
          name: `pre-restore-backup-${checkpointId}`,
          sessionId: checkpoint.sessionId,
          branches: [],
          metadata: {
            tags: ['backup', 'pre-restore'],
            originalCheckpoint: checkpointId
          },
          createdBy: 'system'
        }, true);

        result.warnings.push(`Created backup checkpoint: ${backupId}`);
      }

      // Create restore branch
      const restoreBranch = await this.gitManager.createIsolatedBranch(restoreOptions.targetBranch || `restore-${checkpointId}`);

      // Restore git state first
      if (restoreOptions.includeGitState) {
        await this.restoreGitState(checkpoint.snapshot.gitState, restoreBranch.branchName);
        result.restoredBranches.push(restoreBranch.branchName);
      }

      // Restore sessions
      if (restoreOptions.includeSessions.length === 0 ||
          restoreOptions.includeSessions.includes(checkpoint.sessionId)) {
        await this.restoreSessions(checkpoint.snapshot.sessions, checkpoint, result);
      }

      // Restore context if available and requested
      if (restoreOptions.includeContext && checkpoint.snapshot.context) {
        await this.restoreContext(checkpoint.snapshot.context);
      }

      // Update checkpoint metadata
      checkpoint.restoredFrom = checkpointId;
      this.checkpoints.set(checkpointId, checkpoint);

      result.success = true;
      result.duration = Date.now() - startTime;
      result.newHeadCommit = restoreBranch.commitHash;

      // Emit event
      this.emit('checkpoint_restored', { checkpoint, result, options });

      // Send notification
      const notification = createMessage(
        MessageType.PROGRESS_REPORT,
        checkpoint.sessionId,
        {
          action: 'checkpoint_restored',
          checkpointId,
          result,
          duration: result.duration
        }
      );

      await this.registry.publishMessageToSession(checkpoint.sessionId, notification);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;

      // Emit error event
      this.emit('checkpoint_restore_failed', { checkpoint, error, result });
    }

    return result;
  }

  /**
   * Restore git state
   */
  private async restoreGitState(gitState: GitSnapshot, targetBranch: string): Promise<void> {
    // Switch to target branch
    await this.gitManager.switchBranch(targetBranch);

    // Reset to commit if specified
    if (gitState.headCommit) {
      await this.gitManager.resetToCommit(gitState.headCommit);
    }

    // Restore branches (simplified - in practice would recreate branches)
    for (const branch of gitState.branches) {
      if (branch !== targetBranch) {
        // Recreate branch from current HEAD
        await this.gitManager.createBranch(branch);
      }
    }

    // Restore tags
    for (const tag of gitState.tags) {
      await this.gitManager.createTag(tag, gitState.headCommit);
    }
  }

  /**
   * Restore sessions
   */
  private async restoreSessions(
    sessions: SessionSnapshot[],
    checkpoint: Checkpoint,
    result: RestoreResult
  ): Promise<void> {
    for (const sessionSnapshot of sessions) {
      try {
        // Check if session already exists
        const existingSession = await this.registry.getSession(sessionSnapshot.id);

        if (existingSession) {
          // Session exists, decide what to do
          const conflict: RestoreConflict = {
            type: 'session_exists',
            description: `Session ${sessionSnapshot.id} already exists`,
            severity: 'medium',
            resolution: 'overwrite',
            affectedItems: [sessionSnapshot.id]
          };

          if (checkpoint.metadata.tags.includes('auto-restore')) {
            // Auto-restore mode, overwrite existing session
            await this.registry.updateSession(sessionSnapshot.id, {
              name: sessionSnapshot.name,
              type: sessionSnapshot.type,
              status: sessionSnapshot.status,
              branch: sessionSnapshot.branch,
              workspace: sessionSnapshot.workspace,
              metadata: sessionSnapshot.metadata,
              lastActivity: sessionSnapshot.lastActivity,
              createdAt: sessionSnapshot.createdAt
            });

            result.restoredSessions.push(sessionSnapshot.id);
            result.conflicts.push(conflict);
          } else {
            // Manual restore mode, skip conflicting session
            result.warnings.push(`Skipped existing session: ${sessionSnapshot.id}`);
            conflict.resolution = 'skip';
            result.conflicts.push(conflict);
          }
        } else {
          // Create new session
          await this.registry.registerSession({
            id: sessionSnapshot.id,
            name: sessionSnapshot.name,
            type: sessionSnapshot.type,
            status: sessionSnapshot.status,
            branch: sessionSnapshot.branch,
            workspace: sessionSnapshot.workspace,
            createdAt: sessionSnapshot.createdAt,
            lastActivity: sessionSnapshot.lastActivity,
            capabilities: [],
            constraints: [],
            metadata: sessionSnapshot.metadata
          });

          // Restore departments
          for (const dept of sessionSnapshot.departments) {
            await this.registry.registerDepartment({
              id: dept.id,
              name: dept.name,
              domain: dept.domain,
              session: { id: sessionSnapshot.id } as any, // Simplified
              isActive: dept.isActive,
              currentTask: dept.currentTask,
              completedTasks: dept.completedTasks,
              pendingMessages: dept.pendingMessages,
              performance: dept.performance
            });
          }

          result.restoredSessions.push(sessionSnapshot.id);
        }
      } catch (error) {
        result.errors.push(`Failed to restore session ${sessionSnapshot.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Restore context
   */
  private async restoreContext(context: ContextSnapshot): Promise<void> {
    // In practice, this would restore the context manager state
    // For now, just log the operation
    console.log(`Restoring context with ${context.totalItems} items`);
  }

  /**
   * Create auto checkpoint
   */
  private async createAutoCheckpoint(): Promise<void> {
    try {
      const sessions = await this.registry.getAllSessions();

      // Only create auto checkpoint if there are active sessions
      const activeSessions = sessions.filter(s =>
        s.status === 'active' || s.status === 'running'
      );

      if (activeSessions.length === 0) return;

      // Create checkpoint for the most recently active session
      const latestSession = activeSessions.sort((a, b) =>
        b.lastActivity.getTime() - a.lastActivity.getTime()
      )[0];

      await this.createCheckpoint({
        name: `auto-checkpoint-${latestSession.name}`,
        sessionId: latestSession.id,
        branches: [],
        metadata: {
          feature: 'auto-checkpoint',
          priority: 'normal',
          description: 'Automated system checkpoint',
          tags: ['auto', 'checkpoint']
        },
        createdBy: 'system'
      }, true);
    } catch (error) {
      console.warn('Failed to create auto checkpoint:', error);
    }
  }

  /**
   * Compare checkpoints
   */
  async compareCheckpoints(checkpoint1Id: string, checkpoint2Id: string): Promise<any> {
    const checkpoint1 = this.checkpoints.get(checkpoint1Id);
    const checkpoint2 = this.checkpoints.get(checkpoint2Id);

    if (!checkpoint1 || !checkpoint2) {
      throw new CheckpointNotFoundError('One or both checkpoints not found');
    }

    return {
      checkpoint1: {
        id: checkpoint1.id,
        timestamp: checkpoint1.timestamp,
        name: checkpoint1.name
      },
      checkpoint2: {
        id: checkpoint2.id,
        timestamp: checkpoint2.timestamp,
        name: checkpoint2.name
      },
      differences: {
        sessions: this.compareSessions(checkpoint1.snapshot.sessions, checkpoint2.snapshot.sessions),
        git: this.compareGitState(checkpoint1.snapshot.gitState, checkpoint2.snapshot.gitState),
        systemState: this.compareSystemState(checkpoint1.snapshot.systemState, checkpoint2.snapshot.systemState)
      }
    };
  }

  /**
   * Compare sessions
   */
  private compareSessions(sessions1: SessionSnapshot[], sessions2: SessionSnapshot[]): any {
    const differences = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    const sessions1Map = new Map(sessions1.map(s => [s.id, s]));
    const sessions2Map = new Map(sessions2.map(s => [s.id, s]));

    // Find added sessions
    for (const [id, session2] of sessions2Map) {
      if (!sessions1Map.has(id)) {
        differences.added.push(session2);
      }
    }

    // Find removed sessions
    for (const [id, session1] of sessions1Map) {
      if (!sessions2Map.has(id)) {
        differences.removed.push(session1);
      }
    }

    // Find modified and unchanged sessions
    for (const [id, session1] of sessions1Map) {
      const session2 = sessions2Map.get(id);
      if (session2) {
        if (this.isSessionModified(session1, session2)) {
          differences.modified.push({ before: session1, after: session2 });
        } else {
          differences.unchanged.push(session1);
        }
      }
    }

    return differences;
  }

  /**
   * Check if session is modified
   */
  private isSessionModified(session1: SessionSnapshot, session2: SessionSnapshot): boolean {
    return (
      session1.status !== session2.status ||
      session1.branch !== session2.branch ||
      session1.lastActivity.getTime() !== session2.lastActivity.getTime() ||
      JSON.stringify(session1.metadata) !== JSON.stringify(session2.metadata)
    );
  }

  /**
   * Compare git state
   */
  private compareGitState(git1: GitSnapshot, git2: GitSnapshot): any {
    return {
      currentBranch: git1.currentBranch !== git2.currentBranch,
      headCommit: git1.headCommit !== git2.headCommit,
      branchesAdded: git2.branches.filter(b => !git1.branches.includes(b)),
      branchesRemoved: git1.branches.filter(b => !git2.branches.includes(b)),
      modifiedFiles: git2.modifiedFiles.filter(f => !git1.modifiedFiles.includes(f)),
      untrackedFiles: git2.untrackedFiles.filter(f => !git1.untrackedFiles.includes(f))
    };
  }

  /**
   * Compare system state
   */
  private compareSystemState(state1: SystemStateSnapshot, state2: SystemStateSnapshot): any {
    return {
      memoryUsageChange: state2.memoryUsage - state1.memoryUsage,
      cpuUsageChange: state2.cpuUsage - state1.cpuUsage,
      uptimeChange: state2.uptime - state1.uptime,
      environmentChanged: state1.environment !== state2.environment
    };
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(checkpointId: string, force: boolean = false): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new CheckpointNotFoundError(`Checkpoint not found: ${checkpointId}`);
    }

    // Check if checkpoint is too recent to delete (unless forced)
    const age = Date.now() - checkpoint.timestamp.getTime();
    if (!force && age < 60 * 60 * 1000) { // Less than 1 hour old
      throw new OrchestrationError(
        'Checkpoint is too recent to delete (less than 1 hour old)',
        'CHECKPOINT_TOO_RECENT',
        'high',
        false
      );
    }

    // Remove from registry
    await this.registry.deleteCheckpoint(checkpointId);

    // Remove from memory
    this.checkpoints.delete(checkpointId);
    const index = this.checkpointHistory.indexOf(checkpointId);
    if (index > -1) {
      this.checkpointHistory.splice(index, 1);
    }

    // Remove git tag
    await this.gitManager.deleteTag(`checkpoint-${checkpointId}`);

    // Emit event
    this.emit('checkpoint_deleted', checkpoint);

    return true;
  }

  /**
   * Prune old checkpoints
   */
  async pruneOldCheckpoints(): Promise<number> {
    const now = Date.now();
    let prunedCount = 0;

    for (const [checkpointId, checkpoint] of this.checkpoints) {
      if (checkpoint.retentionExpiresAt && checkpoint.retentionExpiresAt < now) {
        await this.deleteCheckpoint(checkpointId, true);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      this.emit('checkpoints_pruned', { count: prunedCount, timestamp: now });
    }

    return prunedCount;
  }

  /**
   * Get checkpoint statistics
   */
  getCheckpointStats() {
    const checkpoints = Array.from(this.checkpoints.values());
    const totalSize = checkpoints.reduce((sum, cp) => sum + cp.size, 0);
    const averageSize = checkpoints.length > 0 ? totalSize / checkpoints.length : 0;

    return {
      totalCheckpoints: checkpoints.length,
      totalSize,
      averageSize,
      oldestCheckpoint: checkpoints.length > 0 ?
        checkpoints.reduce((oldest, cp) => cp.timestamp < oldest.timestamp ? cp : oldest).timestamp :
        null,
      newestCheckpoint: checkpoints.length > 0 ?
        checkpoints.reduce((newest, cp) => cp.timestamp > newest.timestamp ? cp : newest).timestamp :
        null,
      bySession: checkpoints.reduce((acc, cp) => {
        acc[cp.sessionId] = (acc[cp.sessionId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Cleanup expired checkpoints
   */
  async cleanup(): Promise<void> {
    await this.pruneOldCheckpoints();

    // Also clean up auto-checkpoint interval if it's been running too long
    if (this.cleanupInterval) {
      const checkpoints = Array.from(this.checkpoints.values());
      const autoCheckpoints = checkpoints.filter(cp => cp.metadata.tags.includes('auto'));

      // Remove old auto-checkpoints, keep only the most recent 5
      if (autoCheckpoints.length > 5) {
        const sorted = autoCheckpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const toRemove = sorted.slice(5);

        for (const checkpoint of toRemove) {
          await this.deleteCheckpoint(checkpoint.id, true);
        }
      }
    }
  }

  /**
   * Shutdown checkpoint manager
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Save remaining checkpoints
    for (const checkpoint of this.checkpoints.values()) {
      await this.registry.updateCheckpoint(checkpoint.id, checkpoint);
    }

    this.removeAllListeners();
  }
}
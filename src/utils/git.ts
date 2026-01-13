/**
 * Git Utilities for Multi-Session Orchestration
 * Provides isolated branch management, commit operations, and integration
 * with the orchestration system
 */

import simpleGit, { SimpleGit, ResetMode } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  GitOperation,
  Session,
  Department,
  Checkpoint
} from '../core/types';
import {
  OrchestrationError,
  ValidationError
} from '../core/types';

export class GitManager {
  private git: SimpleGit;
  private readonly branchPrefix = 'orchestration';
  private readonly protectedBranches = ['main', 'master', 'develop'];
  private readonly maxCommitMessageLength = 72;

  constructor(
    private repoPath: string = './',
    private remote?: string,
    private branchPrefixOverride?: string
  ) {
    this.git = simpleGit(repoPath);
    this.validateRepository();
  }

  /**
   * Validate that the repository is properly initialized
   */
  private async validateRepository(): Promise<void> {
    try {
      await this.git.raw(['rev-parse', '--is-inside-work-tree']);
    } catch (error) {
      throw new OrchestrationError(
        'Not a git repository. Initialize with `git init` first.',
        'NOT_GIT_REPO',
        'high',
        false
      );
    }
  }

  /**
   * Create an isolated branch for a session or department
   */
  async createIsolatedBranch(
    name: string,
    baseBranch: string = 'main',
    parentBranch?: string
  ): Promise<{ branchName: string; commitHash: string }> {
    this.validateBranchName(name);

    try {
      // Ensure base branch exists
      await this.ensureBranchExists(baseBranch);

      // Checkout base branch
      await this.git.checkout(baseBranch);

      // Pull latest changes if remote exists
      if (this.remote) {
        await this.git.pull(this.remote, baseBranch);
      }

      // Create new branch
      const branchName = `${this.branchPrefixOverride || this.branchPrefix}/${name}`;
      await this.git.checkout(['-b', branchName]);

      // Get current commit hash
      const log = await this.git.log(['-1', '--pretty=%H']);
      const commitHash = log.latest?.hash || '';

      return { branchName, commitHash };
    } catch (error) {
      throw new OrchestrationError(
        `Failed to create isolated branch: ${error}`,
        'BRANCH_CREATE_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Commit changes with agent metadata
   */
  async commitWithMetadata(
    message: string,
    files: string[] = [],
    metadata: {
      sessionId?: string;
      departmentId?: string;
      checkpointId?: string;
      agentType?: 'director' | 'department';
      [key: string]: any;
    } = {}
  ): Promise<{ commitHash: string; branch: string }> {
    this.validateCommitMessage(message);

    try {
      // Stage specified files
      if (files.length > 0) {
        for (const file of files) {
          try {
            await this.git.add(file);
          } catch (addError) {
            // File might not exist, continue with others
            console.warn(`File not found for staging: ${file}`);
          }
        }
      }

      // Format message with metadata
      const fullMessage = this.formatCommitMessage(message, metadata);

      // Commit changes
      const commitResult = await this.git.commit(fullMessage);

      // Get current branch
      const branch = await this.getCurrentBranch();

      return {
        commitHash: commitResult.hash,
        branch
      };
    } catch (error) {
      throw new OrchestrationError(
        `Failed to commit: ${error}`,
        'COMMIT_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Create a tagged checkpoint
   */
  async createCheckpointTag(
    checkpoint: Checkpoint,
    branch: string
  ): Promise<string> {
    const tag = `checkpoint-${checkpoint.id}`;
    const tagMessage = this.formatCheckpointMessage(checkpoint);

    try {
      // Ensure we're on the correct branch
      await this.git.checkout(branch);

      // Create annotated tag
      await this.git.addTag([tag, '-m', tagMessage]);

      return tag;
    } catch (error) {
      throw new OrchestrationError(
        `Failed to create checkpoint tag: ${error}`,
        'CHECKPOINT_TAG_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Restore to a checkpoint
   */
  async restoreToCheckpoint(
    checkpointId: string,
    branch: string,
    reason?: string
  ): Promise<{ commitHash: string; message: string }> {
    const tag = `checkpoint-${checkpointId}`;
    const rollbackMessage = this.formatRollbackMessage(checkpointId, reason);

    try {
      // Ensure we're on the correct branch
      await this.git.checkout(branch);

      // Reset to checkpoint
      await this.git.reset([ResetMode.HARD, tag]);

      // Create rollback commit
      const commitResult = await this.git.commit(rollbackMessage);

      // Update checkpoint metadata
      await this.updateCheckpointMetadata(checkpointId, 'rolled_back', reason);

      return {
        commitHash: commitResult.hash,
        message: rollbackMessage
      };
    } catch (error) {
      throw new OrchestrationError(
        `Failed to restore checkpoint: ${error}`,
        'CHECKPOINT_RESTORE_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Merge branches with conflict resolution
   */
  async mergeBranches(
    source: string,
    target: string,
    message: string,
    strategy: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<{ commitHash?: string; conflicts: string[] }> {
    this.validateBranchName(source);
    this.validateBranchName(target);

    try {
      // Checkout target branch
      await this.git.checkout(target);

      // Set merge strategy
      const mergeArgs = [source];
      if (strategy === 'squash') {
        mergeArgs.push('--squash');
      } else if (strategy === 'rebase') {
        // Rebase source onto target
        await this.git.rebase([target, source]);
        return { commitHash: await this.getCurrentCommit(), conflicts: [] };
      }

      // Attempt merge
      const mergeResult = await this.git.merge(mergeArgs);

      // Check for conflicts
      const conflicts = this.parseMergeConflicts(mergeResult);

      if (conflicts.length > 0) {
        // Stash changes and return conflicts
        await this.git.stash(['push', '-m', 'merge-conflicts']);
        return { conflicts };
      }

      // Merge successful, create commit
      const commitResult = await this.git.commit(message);

      return {
        commitHash: commitResult.hash,
        conflicts: []
      };
    } catch (error) {
      throw new OrchestrationError(
        `Failed to merge branches: ${error}`,
        'MERGE_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const result = await this.git.branch(['--show-current']);
      return result.trim();
    } catch (error) {
      throw new OrchestrationError(
        `Failed to get current branch: ${error}`,
        'GET_BRANCH_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit(): Promise<string> {
    try {
      const log = await this.git.log(['-1', '--pretty=%H']);
      return log.latest?.hash || '';
    } catch (error) {
      throw new OrchestrationError(
        `Failed to get current commit: ${error}`,
        'GET_COMMIT_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Get branch status
   */
  async getBranchStatus(branch: string): Promise<{
    ahead: number;
    behind: number;
    clean: boolean;
    diverged: boolean;
  }> {
    this.validateBranchName(branch);

    try {
      const status = await this.git.status();
      const currentBranch = await this.getCurrentBranch();

      let ahead = 0;
      let behind = 0;
      let diverged = false;

      if (currentBranch === branch) {
        ahead = status.ahead || 0;
        behind = status.behind || 0;
        diverged = ahead > 0 && behind > 0;
      } else {
        const comparison = await this.git.raw(['rev-list', '--left-right', '--count', `${branch}...${currentBranch}`]);
        const [left, right] = comparison.trim().split('\t');
        behind = parseInt(left) || 0;
        ahead = parseInt(right) || 0;
        diverged = ahead > 0 && behind > 0;
      }

      return {
        ahead,
        behind,
        clean: status.isClean(),
        diverged
      };
    } catch (error) {
      throw new OrchestrationError(
        `Failed to get branch status: ${error}`,
        'GET_BRANCH_STATUS_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Get diff between branches
   */
  async getBranchDiff(branch1: string, branch2?: string): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
    files: { path: string; change: 'added' | 'modified' | 'deleted' }[];
  }> {
    const targetBranch = branch2 || 'main';

    try {
      const diff = await this.git.diff([`${targetBranch}...${branch1}`]);
      return this.parseDiffOutput(diff);
    } catch (error) {
      throw new OrchestrationError(
        `Failed to get branch diff: ${error}`,
        'GET_DIFF_FAILED',
        'high',
        false
      );
    }
  }

  /**
   * Cleanup old orchestration branches
   */
  async cleanupOldBranches(maxAge: number = 7): Promise<string[]> {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

    try {
      const branches = await this.git.branch(['--list', `${this.branchPrefix}/*`]);
      const branchList = branches.all || [];

      const branchesToDelete: string[] = [];

      for (const branch of branchList) {
        const branchName = branch.replace('*/', '');

        try {
          // Get last commit date for this branch
          const log = await this.git.log([branch, '--pretty=%ai', '-1']);
          const lastCommitDate = new Date(log.latest?.date || '');

          if (lastCommitDate < cutoffDate) {
            branchesToDelete.push(branch);
          }
        } catch {
          // If we can't get branch info, skip it
          continue;
        }
      }

      // Delete branches
      for (const branch of branchesToDelete) {
        try {
          await this.git.branch(['-D', branch]);
        } catch (deleteError) {
          console.warn(`Failed to delete branch ${branch}: ${deleteError}`);
        }
      }

      return branchesToDelete;
    } catch (error) {
      throw new OrchestrationError(
        `Failed to cleanup old branches: ${error}`,
        'CLEANUP_BRANCHES_FAILED',
        'medium',
        true
      );
    }
  }

  /**
   * Ensure a branch exists
   */
  private async ensureBranchExists(branch: string): Promise<void> {
    try {
      const branches = await this.git.branch();
      const branchExists = branches.all.includes(branch);

      if (!branchExists) {
        throw new OrchestrationError(
          `Branch '${branch}' does not exist`,
          'BRANCH_NOT_FOUND',
          'high',
          false
        );
      }
    } catch (error) {
      if (error instanceof OrchestrationError && error.code === 'BRANCH_NOT_FOUND') {
        // Try to create the branch from main
        await this.git.checkout(['-b', branch, 'main']);
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate branch name
   */
  private validateBranchName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Branch name is required', 'name');
    }

    // Check for invalid characters
    const invalidChars = /[^a-zA-Z0-9\-_\/]/;
    if (invalidChars.test(name)) {
      throw new ValidationError(
        `Branch name contains invalid characters: ${name}`,
        'name'
      );
    }

    // Check for protected branches
    const isProtected = this.protectedBranches.some(
      protectedBranch => name === protectedBranch || name.startsWith(`${protectedBranch}/`)
    );

    if (isProtected) {
      throw new ValidationError(
        `Cannot use protected branch name: ${name}`,
        'name'
      );
    }

    // Check length
    if (name.length > 255) {
      throw new ValidationError(
        'Branch name too long (max 255 characters)',
        'name'
      );
    }
  }

  /**
   * Validate commit message
   */
  private validateCommitMessage(message: string): void {
    if (!message || typeof message !== 'string') {
      throw new ValidationError('Commit message is required', 'message');
    }

    if (message.length > this.maxCommitMessageLength) {
      throw new ValidationError(
        `Commit message too long (max ${this.maxCommitMessageLength} characters)`,
        'message'
      );
    }

    // Check for empty message
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      throw new ValidationError('Commit message cannot be empty', 'message');
    }
  }

  /**
   * Format commit message with metadata
   */
  private formatCommitMessage(message: string, metadata: any): string {
    const metadataLines: string[] = [];

    if (metadata.sessionId) {
      metadataLines.push(`Session-ID: ${metadata.sessionId}`);
    }

    if (metadata.departmentId) {
      metadataLines.push(`Department-ID: ${metadata.departmentId}`);
    }

    if (metadata.checkpointId) {
      metadataLines.push(`Checkpoint-ID: ${metadata.checkpointId}`);
    }

    if (metadata.agentType) {
      metadataLines.push(`Agent-Type: ${metadata.agentType}`);
    }

    // Add any additional metadata
    Object.entries(metadata).forEach(([key, value]) => {
      if (!['sessionId', 'departmentId', 'checkpointId', 'agentType'].includes(key)) {
        metadataLines.push(`${key}: ${value}`);
      }
    });

    const fullMessage = metadataLines.length > 0
      ? `${message}\n\n[Orchestration Metadata]\n${metadataLines.join('\n')}`
      : message;

    return fullMessage;
  }

  /**
   * Format checkpoint message
   */
  private formatCheckpointMessage(checkpoint: Checkpoint): string {
    return `Checkpoint: ${checkpoint.name}\n\nCreated: ${checkpoint.timestamp.toISOString()}\nSession: ${checkpoint.sessionId}\nBranches: ${checkpoint.branches.join(', ')}`;
  }

  /**
   * Format rollback message
   */
  private formatRollbackMessage(checkpointId: string, reason?: string): string {
    const message = `Rollback to checkpoint: ${checkpointId}`;
    const details = reason ? `\n\nReason: ${reason}` : '';
    return `${message}${details}`;
  }

  /**
   * Parse merge result for conflicts
   */
  private parseMergeConflicts(result: string): string[] {
    const conflicts: string[] = [];
    const lines = result.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for conflict markers
      if (line.includes('<<<<<<<') || line.includes('=======') || line.includes('>>>>>>>')) {
        // Extract filename from context
        const contextLines = lines.slice(Math.max(0, i - 3), i);
        const filenameLine = contextLines.find(l => l.includes('+++ b/'));

        if (filenameLine) {
          const filename = filenameLine.replace('+++ b/', '');
          conflicts.push(filename);
        }
      }
    }

    return conflicts;
  }

  /**
   * Parse diff output
   */
  private parseDiffOutput(diff: string): {
    added: string[];
    modified: string[];
    deleted: string[];
    files: { path: string; change: 'added' | 'modified' | 'deleted' }[];
  } {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const files: { path: string; change: 'added' | 'modified' | 'deleted' }[] = [];

    const lines = diff.split('\n');
    let currentFile: string | null = null;
    let currentChangeType: 'added' | 'modified' | 'deleted' | null = null;

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6);
        currentChangeType = null;
        continue;
      }

      if (line.startsWith('diff --git')) {
        currentFile = null;
        currentChangeType = null;
        continue;
      }

      if (line.startsWith('@@')) {
        // Hunks header - skip for now
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('++')) {
        currentChangeType = 'added';
        if (currentFile) {
          added.push(currentFile);
          files.push({ path: currentFile, change: 'added' });
        }
      } else if (line.startsWith('-') && !line.startsWith('--')) {
        currentChangeType = 'deleted';
        if (currentFile) {
          deleted.push(currentFile);
          files.push({ path: currentFile, change: 'deleted' });
        }
      } else if (line.startsWith(' ')) {
        currentChangeType = 'modified';
        if (currentFile && currentChangeType) {
          modified.push(currentFile);
          files.push({ path: currentFile, change: 'modified' });
        }
      }
    }

    // Remove duplicates
    return {
      added: [...new Set(added)],
      modified: [...new Set(modified)],
      deleted: [...new Set(deleted)],
      files: [...new Set(files.map(f => `${f.path}:${f.change}`))].map(item => {
        const [path, change] = item.split(':');
        return { path: path || '', change: change as 'added' | 'modified' | 'deleted' };
      }).filter(f => f.path)
    };
  }

  /**
   * Update checkpoint metadata
   */
  private async updateCheckpointMetadata(
    checkpointId: string,
    action: string,
    reason?: string
  ): Promise<void> {
    try {
      const metadataPath = path.join(this.repoPath, '.orchestration', 'checkpoint-metadata.json');
      let metadata: Record<string, any> = {};

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch {
        // File doesn't exist, create new
      }

      metadata[checkpointId] = {
        action,
        reason,
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      // Metadata update is non-critical, log but don't throw
      console.warn(`Failed to update checkpoint metadata: ${error}`);
    }
  }
}

// Factory function for creating GitManager
export const createGitManager = (config?: {
  repoPath?: string;
  remote?: string;
  branchPrefix?: string;
}): GitManager => {
  return new GitManager(
    config?.repoPath,
    config?.remote,
    config?.branchPrefix
  );
};
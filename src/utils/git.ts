export class GitError extends Error {
  constructor(operation: string, originalError?: Error) {
    super(`Git operation '${operation}' failed${originalError ? `: ${originalError.message}` : ''}`);
    this.name = 'GitError';
    this.cause = originalError;
  }

  cause?: Error;
}

export class GitManager {
  constructor(
    private repoPath: string = './',
    private remote?: string
  ) {}

  async commit(message: string): Promise<void> {
    if (!message || message.trim().length === 0) {
      throw new Error('Commit message cannot be empty');
    }

    try {
      // Simple implementation - in production would use child_process to call git
      console.log(`[Git] Commit: ${message}`);
    } catch (error) {
      throw new GitError('commit', error as Error);
    }
  }

  async push(): Promise<void> {
    try {
      console.log(`[Git] Pushing to ${this.remote || 'origin'}`);
    } catch (error) {
      throw new GitError('push', error as Error);
    }
  }

  async pull(): Promise<void> {
    try {
      console.log(`[Git] Pulling from ${this.remote || 'origin'}`);
    } catch (error) {
      throw new GitError('pull', error as Error);
    }
  }

  async createBranch(branchName: string): Promise<void> {
    if (!branchName || branchName.trim().length === 0) {
      throw new Error('Branch name cannot be empty');
    }

    try {
      console.log(`[Git] Creating branch: ${branchName}`);
    } catch (error) {
      throw new GitError('createBranch', error as Error);
    }
  }

  async merge(branchName: string): Promise<void> {
    if (!branchName || branchName.trim().length === 0) {
      throw new Error('Branch name cannot be empty');
    }

    try {
      console.log(`[Git] Merging branch: ${branchName}`);
    } catch (error) {
      throw new GitError('merge', error as Error);
    }
  }
}

export function createGitManager(): GitManager {
  return new GitManager();
}
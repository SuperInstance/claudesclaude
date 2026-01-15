export class GitManager {
  constructor(
    private repoPath: string = './',
    private remote?: string
  ) {}

  async commit(message: string): Promise<void> {
    // Simple implementation
  }

  async push(): Promise<void> {
    // Simple implementation
  }

  async pull(): Promise<void> {
    // Simple implementation
  }

  async createBranch(branchName: string): Promise<void> {
    // Simple implementation
  }

  async merge(branchName: string): Promise<void> {
    // Simple implementation
  }
}

export function createGitManager(): GitManager {
  return new GitManager();
}
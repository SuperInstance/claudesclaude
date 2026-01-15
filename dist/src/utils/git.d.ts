export declare class GitManager {
    private repoPath;
    private remote?;
    constructor(repoPath?: string, remote?: string | undefined);
    commit(message: string): Promise<void>;
    push(): Promise<void>;
    pull(): Promise<void>;
    createBranch(branchName: string): Promise<void>;
    merge(branchName: string): Promise<void>;
}
export declare function createGitManager(): GitManager;

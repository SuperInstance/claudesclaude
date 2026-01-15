export class GitManager {
    repoPath;
    remote;
    constructor(repoPath = './', remote) {
        this.repoPath = repoPath;
        this.remote = remote;
    }
    async commit(message) {
    }
    async push() {
    }
    async pull() {
    }
    async createBranch(branchName) {
    }
    async merge(branchName) {
    }
}
export function createGitManager() {
    return new GitManager();
}
//# sourceMappingURL=git.js.map
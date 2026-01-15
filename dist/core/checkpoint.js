export class CheckpointManager {
    checkpoints = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    createCheckpoint(checkpoint) {
        this.checkpoints.set(checkpoint.id, checkpoint);
    }
    getCheckpoint(id) {
        return this.checkpoints.get(id);
    }
    getAllCheckpoints() {
        return Array.from(this.checkpoints.values());
    }
    deleteCheckpoint(id) {
        this.checkpoints.delete(id);
    }
    restoreCheckpoint(id) {
        const checkpoint = this.getCheckpoint(id);
        if (checkpoint) {
            return checkpoint.data;
        }
        return undefined;
    }
    getCheckpointsBySession(sessionId) {
        return Array.from(this.checkpoints.values()).filter(checkpoint => checkpoint.sessionId === sessionId);
    }
    shutdown() {
        this.checkpoints.clear();
    }
}
//# sourceMappingURL=checkpoint.js.map
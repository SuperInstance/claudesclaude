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
}
//# sourceMappingURL=checkpoint.js.map
export interface CheckpointConfig {
    maxCheckpoints: number;
    retentionPeriod: number;
}
export declare class CheckpointManager {
    private checkpoints;
    private config;
    constructor(config: CheckpointConfig);
    createCheckpoint(checkpoint: any): void;
    getCheckpoint(id: string): any | undefined;
    getAllCheckpoints(): any[];
    deleteCheckpoint(id: string): void;
    restoreCheckpoint(id: string): any | undefined;
    getCheckpointsBySession(sessionId: string): any[];
    shutdown(): void;
}

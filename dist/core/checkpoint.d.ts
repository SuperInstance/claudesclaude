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
}

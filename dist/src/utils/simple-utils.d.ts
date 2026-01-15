export declare class SimpleUUID {
    generateFast(): string;
    generateSecure(): string;
    generate(secure?: boolean): string;
}
export declare class SimpleTimestamp {
    now(): number;
    format(timestamp: number, options?: {
        includeTimezone?: boolean;
        includeMilliseconds?: boolean;
    }): string;
    diff(start: number, end: number): {
        hours: number;
        minutes: number;
        seconds: number;
    };
    createRange(start: number, duration: number): {
        start: number;
        end: number;
        duration: number;
    };
    isInRange(timestamp: number, start: number, end: number): boolean;
}
export declare const uuidGenerator: SimpleUUID;
export declare const timestampOps: SimpleTimestamp;
export declare const generateUUID: (secure?: boolean) => string;
export declare const generateFastUUID: () => string;
export declare const generateSecureUUID: () => string;
export declare const now: () => number;
export declare const formatTime: (timestamp: number, options?: any) => string;
export declare const timeDiff: (start: number, end: number) => {
    hours: number;
    minutes: number;
    seconds: number;
};
export declare const createTimeRange: (start: number, duration: number) => {
    start: number;
    end: number;
    duration: number;
};

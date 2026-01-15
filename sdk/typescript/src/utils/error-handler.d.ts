import { OrchestrationError } from '../../claudesclaude/dist/src/core/types';
export declare class ErrorHandler {
    private static instance;
    private errorListeners;
    private constructor();
    static getInstance(): ErrorHandler;
    static classifyError(error: any): {
        type: 'network' | 'database' | 'validation' | 'authentication' | 'authorization' | 'system' | 'unknown';
        severity: 'low' | 'medium' | 'high' | 'critical';
        recoverable: boolean;
    };
    static wrapError(error: any, context: string, code?: string, severity?: 'low' | 'medium' | 'high' | 'critical'): OrchestrationError;
    static withRetry<T>(operation: () => Promise<T>, options?: {
        maxRetries?: number;
        delay?: number;
        backoff?: boolean;
        predicate?: (error: any) => boolean;
    }): Promise<T>;
    static createCircuitBreaker<T extends any[], R>(operation: (...args: T) => Promise<R>, options?: {
        failureThreshold?: number;
        resetTimeout?: number;
        monitoringPeriod?: number;
    }): (...args: T) => Promise<R>;
    static aggregateErrors(errors: any[], context: string): OrchestrationError;
    static notifyError(error: any, context: string, options?: {
        webhookUrl?: string;
        email?: string;
        slackWebhook?: string;
        tags?: string[];
    }): Promise<void>;
    addErrorListener(listener: (error: any) => void): void;
    removeErrorListener(listener: (error: any) => void): void;
    private emitError;
    static createGlobalHandler(): (error: any, context?: string) => void;
}
export declare const wrapError: typeof ErrorHandler.wrapError;
export declare const classifyError: typeof ErrorHandler.classifyError;
export declare const withRetry: typeof ErrorHandler.withRetry;
export declare const createCircuitBreaker: typeof ErrorHandler.createCircuitBreaker;
export declare const aggregateErrors: typeof ErrorHandler.aggregateErrors;
export declare const notifyError: typeof ErrorHandler.notifyError;
export declare const createGlobalHandler: typeof ErrorHandler.createGlobalHandler;
export declare const globalErrorHandler: (error: any, context?: string) => void;

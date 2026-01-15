export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare const LogLevel: {
    DEBUG: "debug";
    INFO: "info";
    WARN: "warn";
    ERROR: "error";
};
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    traceId?: string;
    error?: Error;
}
export interface LoggerConfig {
    level?: LogLevel;
    enableConsole?: boolean;
    enableFile?: boolean;
    filePath?: string;
    enableStructured?: boolean;
    enableMetrics?: boolean;
}
export declare class Logger {
    private config;
    private metrics;
    private listeners;
    constructor(config?: LoggerConfig);
    private createLogEntry;
    private shouldLog;
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: any, context?: Record<string, any>): void;
    private logEntry;
    private logToConsole;
    createChildLogger(childContext: Record<string, any>): Logger;
    onLogEntry(listener: (entry: LogEntry) => void): void;
    offLogEntry(listener: (entry: LogEntry) => void): void;
    getLogMetrics(): Map<LogLevel, number>;
    clearMetrics(): void;
}

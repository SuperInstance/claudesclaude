export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
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
    debug(message: string, context?: Record<string, any>, traceId?: string): void;
    info(message: string, context?: Record<string, any>, traceId?: string): void;
    warn(message: string, context?: Record<string, any>, traceId?: string): void;
    error(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void;
    private log;
    private shouldLog;
    private incrementMetric;
    private emit;
    private outputToConsole;
    private outputToFile;
    private formatMessage;
    private ensureLogDirectory;
    getMetrics(): Map<LogLevel, number>;
    getTotalLogs(): number;
    addListener(listener: (entry: LogEntry) => void): void;
    removeListener(listener: (entry: LogEntry) => void): void;
    updateConfig(config: Partial<LoggerConfig>): void;
    setLevel(level: LogLevel): void;
    createChildLogger(context: Record<string, any>): Logger;
}
export declare const logger: Logger;
export { logger as default };

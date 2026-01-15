/**
 * Simple Logger utility for testing
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LogLevel = {
  DEBUG: 'debug' as const,
  INFO: 'info' as const,
  WARN: 'warn' as const,
  ERROR: 'error' as const
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

export class Logger {
  private config: Required<LoggerConfig>;
  private metrics: Map<LogLevel, number> = new Map();
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      filePath: './logs/orchestration.log',
      enableStructured: true,
      enableMetrics: true,
      ...config
    };

    // Initialize metrics
    Object.values(LogLevel).forEach(level => {
      this.metrics.set(level, 0);
    });
  }

  private createLogEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };

    this.metrics.set(level, (this.metrics.get(level) || 0) + 1);

    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;

    const entry = this.createLogEntry('debug', message, context);
    this.logEntry(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;

    const entry = this.createLogEntry('info', message, context);
    this.logEntry(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;

    const entry = this.createLogEntry('warn', message, context);
    this.logEntry(entry);
  }

  error(message: string, error?: any, context?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;

    const entry = this.createLogEntry('error', message, context, error instanceof Error ? error : new Error(String(error)));
    this.logEntry(entry);
  }

  private logEntry(entry: LogEntry): void {
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (error) {
        // Ignore listener errors
      }
    });
  }

  private logToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context, error } = entry;
    const timestampStr = timestamp.toISOString();

    if (this.config.enableStructured) {
      const logObject = {
        timestamp: timestampStr,
        level,
        message,
        ...(context && { context }),
        ...(error && { error: error.message }),
        ...(entry.traceId && { traceId: entry.traceId })
      };

      console[level](JSON.stringify(logObject));
    } else {
      const prefix = `[${timestampStr}] [${level.toUpperCase()}]`;
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      const errorStr = error ? ` ERROR: ${error.message}` : '';
      console.log(`${prefix}${contextStr}: ${message}${errorStr}`);
    }
  }

  // Child logger factory
  createChildLogger(childContext: Record<string, any>): Logger {
    return new Logger({
      ...this.config,
      enableMetrics: false // Disable metrics for child loggers
    });
  }

  // Event listeners
  onLogEntry(listener: (entry: LogEntry) => void): void {
    this.listeners.push(listener);
  }

  offLogEntry(listener: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Metrics
  getLogMetrics(): Map<LogLevel, number> {
    return new Map(this.metrics);
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics.clear();
    Object.values(LogLevel).forEach(level => {
      this.metrics.set(level, 0);
    });
  }
}
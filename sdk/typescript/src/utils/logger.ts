/**
 * Logger utility for the Orchestration SDK
 */

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

    // Create log directory if file logging is enabled
    if (this.config.enableFile && this.config.filePath) {
      this.ensureLogDirectory(this.config.filePath);
    }
  }

  debug(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('debug', message, context, traceId);
  }

  info(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('info', message, context, traceId);
  }

  warn(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('warn', message, context, traceId);
  }

  error(message: string, error?: Error, context?: Record<string, any>, traceId?: string): void {
    this.log('error', message, context, traceId, error);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    traceId?: string,
    error?: Error
  ): void {
    // Check if level is enabled
    if (this.shouldLog(level)) {
      const entry: LogEntry = {
        timestamp: new Date(),
        level,
        message,
        context,
        traceId,
        error
      };

      // Update metrics
      if (this.config.enableMetrics) {
        this.incrementMetric(level);
      }

      // Emit to listeners
      this.emit(entry);

      // Output to console
      if (this.config.enableConsole) {
        this.outputToConsole(entry);
      }

      // Output to file
      if (this.config.enableFile) {
        this.outputToFile(entry);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(level);
    const configIndex = levels.indexOf(this.config.level);

    return currentIndex >= configIndex;
  }

  private incrementMetric(level: LogLevel): void {
    const current = this.metrics.get(level) || 0;
    this.metrics.set(level, current + 1);
  }

  private emit(entry: LogEntry): void {
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (error) {
        // Prevent logger error from causing cascading failures
        console.error('Logger listener error:', error);
      }
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const logMessage = this.formatMessage(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  private outputToFile(entry: LogEntry): Promise<void> {
    if (!this.config.filePath) {
      return Promise.resolve();
    }

    const logMessage = this.formatMessage(entry);
    const fs = require('fs/promises');
    const path = require('path');

    return fs.appendFile(
      this.config.filePath,
      logMessage + '\n',
      'utf8'
    ).catch(error => {
      console.error('Failed to write to log file:', error);
    });
  }

  private formatMessage(entry: LogEntry): string {
    if (this.config.enableStructured) {
      // JSON format for structured logging
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        traceId: entry.traceId,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined,
        context: entry.context
      });
    } else {
      // Human-readable format
      const timestamp = entry.timestamp.toISOString();
      const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
      const message = entry.message;
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const error = entry.error ? ` Error: ${entry.error.message}` : '';

      return `${prefix}${context}: ${message}${error}`;
    }
  }

  private ensureLogDirectory(filePath: string): void {
    const fs = require('fs/promises');
    const path = require('path');

    const dir = path.dirname(filePath);

    fs.mkdir(dir, { recursive: true }).catch(error => {
      console.error('Failed to create log directory:', error);
    });
  }

  // Metrics
  getMetrics(): Map<LogLevel, number> {
    return new Map(this.metrics);
  }

  getTotalLogs(): number {
    let total = 0;
    this.metrics.forEach(count => {
      total += count;
    });
    return total;
  }

  // Event listeners
  addListener(listener: (entry: LogEntry) => void): void {
    this.listeners.push(listener);
  }

  removeListener(listener: (entry: LogEntry) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Configuration
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  createChildLogger(context: Record<string, any>): Logger {
    const childConfig: LoggerConfig = { ...this.config };
    const childLogger = new Logger(childConfig);

    // Add parent context to all log messages
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = function(level, message, childContext, traceId, error) {
      const mergedContext = { ...context, ...(childContext || {}) };
      originalLog(level, message, mergedContext, traceId, error);
    };

    return childLogger;
  }
}

// Create default logger instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL as LogLevel || 'info',
  enableConsole: process.env.NODE_ENV !== 'test',
  enableFile: process.env.LOG_TO_FILE === 'true',
  enableStructured: process.env.LOG_STRUCTURED !== 'false'
});

// Export for convenience
export { logger as default };
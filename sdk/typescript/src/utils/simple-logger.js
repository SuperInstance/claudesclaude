export const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
};
export class Logger {
    config;
    metrics = new Map();
    listeners = [];
    constructor(config = {}) {
        this.config = {
            level: 'info',
            enableConsole: true,
            enableFile: false,
            filePath: './logs/orchestration.log',
            enableStructured: true,
            enableMetrics: true,
            ...config
        };
        Object.values(LogLevel).forEach(level => {
            this.metrics.set(level, 0);
        });
    }
    createLogEntry(level, message, context, error) {
        const entry = {
            timestamp: new Date(),
            level,
            message,
            context,
            error
        };
        this.metrics.set(level, (this.metrics.get(level) || 0) + 1);
        return entry;
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
    debug(message, context) {
        if (!this.shouldLog('debug'))
            return;
        const entry = this.createLogEntry('debug', message, context);
        this.logEntry(entry);
    }
    info(message, context) {
        if (!this.shouldLog('info'))
            return;
        const entry = this.createLogEntry('info', message, context);
        this.logEntry(entry);
    }
    warn(message, context) {
        if (!this.shouldLog('warn'))
            return;
        const entry = this.createLogEntry('warn', message, context);
        this.logEntry(entry);
    }
    error(message, error, context) {
        if (!this.shouldLog('error'))
            return;
        const entry = this.createLogEntry('error', message, context, error instanceof Error ? error : new Error(String(error)));
        this.logEntry(entry);
    }
    logEntry(entry) {
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            }
            catch (error) {
            }
        });
    }
    logToConsole(entry) {
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
        }
        else {
            const prefix = `[${timestampStr}] [${level.toUpperCase()}]`;
            const contextStr = context ? ` ${JSON.stringify(context)}` : '';
            const errorStr = error ? ` ERROR: ${error.message}` : '';
            console.log(`${prefix}${contextStr}: ${message}${errorStr}`);
        }
    }
    createChildLogger(childContext) {
        return new Logger({
            ...this.config,
            enableMetrics: false
        });
    }
    onLogEntry(listener) {
        this.listeners.push(listener);
    }
    offLogEntry(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    getLogMetrics() {
        return new Map(this.metrics);
    }
    clearMetrics() {
        this.metrics.clear();
        Object.values(LogLevel).forEach(level => {
            this.metrics.set(level, 0);
        });
    }
}
//# sourceMappingURL=simple-logger.js.map
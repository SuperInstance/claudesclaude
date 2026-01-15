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
        if (this.config.enableFile && this.config.filePath) {
            this.ensureLogDirectory(this.config.filePath);
        }
    }
    debug(message, context, traceId) {
        this.log('debug', message, context, traceId);
    }
    info(message, context, traceId) {
        this.log('info', message, context, traceId);
    }
    warn(message, context, traceId) {
        this.log('warn', message, context, traceId);
    }
    error(message, error, context, traceId) {
        this.log('error', message, context, traceId, error);
    }
    log(level, message, context, traceId, error) {
        if (this.shouldLog(level)) {
            const entry = {
                timestamp: new Date(),
                level,
                message,
                context,
                traceId,
                error
            };
            if (this.config.enableMetrics) {
                this.incrementMetric(level);
            }
            this.emit(entry);
            if (this.config.enableConsole) {
                this.outputToConsole(entry);
            }
            if (this.config.enableFile) {
                this.outputToFile(entry);
            }
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(level);
        const configIndex = levels.indexOf(this.config.level);
        return currentIndex >= configIndex;
    }
    incrementMetric(level) {
        const current = this.metrics.get(level) || 0;
        this.metrics.set(level, current + 1);
    }
    emit(entry) {
        for (const listener of this.listeners) {
            try {
                listener(entry);
            }
            catch (error) {
                console.error('Logger listener error:', error);
            }
        }
    }
    outputToConsole(entry) {
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
    outputToFile(entry) {
        if (!this.config.filePath) {
            return Promise.resolve();
        }
        const logMessage = this.formatMessage(entry);
        const fs = require('fs/promises');
        const path = require('path');
        return fs.appendFile(this.config.filePath, logMessage + '\n', 'utf8').catch(error => {
            console.error('Failed to write to log file:', error);
        });
    }
    formatMessage(entry) {
        if (this.config.enableStructured) {
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
        }
        else {
            const timestamp = entry.timestamp.toISOString();
            const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
            const message = entry.message;
            const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
            const error = entry.error ? ` Error: ${entry.error.message}` : '';
            return `${prefix}${context}: ${message}${error}`;
        }
    }
    ensureLogDirectory(filePath) {
        const fs = require('fs/promises');
        const path = require('path');
        const dir = path.dirname(filePath);
        fs.mkdir(dir, { recursive: true }).catch(error => {
            console.error('Failed to create log directory:', error);
        });
    }
    getMetrics() {
        return new Map(this.metrics);
    }
    getTotalLogs() {
        let total = 0;
        this.metrics.forEach(count => {
            total += count;
        });
        return total;
    }
    addListener(listener) {
        this.listeners.push(listener);
    }
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    setLevel(level) {
        this.config.level = level;
    }
    createChildLogger(context) {
        const childConfig = { ...this.config };
        const childLogger = new Logger(childConfig);
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = function (level, message, childContext, traceId, error) {
            const mergedContext = { ...context, ...(childContext || {}) };
            originalLog(level, message, mergedContext, traceId, error);
        };
        return childLogger;
    }
}
export const logger = new Logger({
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.NODE_ENV !== 'test',
    enableFile: process.env.LOG_TO_FILE === 'true',
    enableStructured: process.env.LOG_STRUCTURED !== 'false'
});
export { logger as default };
//# sourceMappingURL=logger.js.map
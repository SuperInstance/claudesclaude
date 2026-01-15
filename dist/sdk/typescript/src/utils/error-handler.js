import { OrchestrationError, ValidationError } from '../../claudesclaude/dist/src/core/types';
export class ErrorHandler {
    static instance;
    errorListeners = [];
    constructor() { }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    static classifyError(error) {
        if (error instanceof ValidationError) {
            return {
                type: 'validation',
                severity: 'medium',
                recoverable: true
            };
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            return {
                type: 'network',
                severity: 'high',
                recoverable: true
            };
        }
        if (error.code && error.code.startsWith('DB_')) {
            return {
                type: 'database',
                severity: 'high',
                recoverable: false
            };
        }
        if (error.code === 'AUTH_REQUIRED' || error.code === 'INVALID_TOKEN') {
            return {
                type: 'authentication',
                severity: 'high',
                recoverable: false
            };
        }
        if (error.code === 'FORBIDDEN' || error.code === 'ACCESS_DENIED') {
            return {
                type: 'authorization',
                severity: 'high',
                recoverable: false
            };
        }
        if (error.code === 'INTERNAL_ERROR' || error.code === 'CRASH') {
            return {
                type: 'system',
                severity: 'critical',
                recoverable: false
            };
        }
        return {
            type: 'unknown',
            severity: 'medium',
            recoverable: true
        };
    }
    static wrapError(error, context, code, severity) {
        if (error instanceof OrchestrationError) {
            return error;
        }
        const message = error.message || 'An unknown error occurred';
        const errorCode = code || 'WRAPPED_ERROR';
        const errorSeverity = severity || this.classifyError(error).severity;
        return new OrchestrationError(`[${context}] ${message}`, errorCode, errorSeverity, this.classifyError(error).recoverable, {
            originalError: {
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context
        });
    }
    static async withRetry(operation, options = {}) {
        const { maxRetries = 3, delay = 1000, backoff = true, predicate = () => true } = options;
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === maxRetries || !predicate(error)) {
                    throw error;
                }
                const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        throw lastError;
    }
    static createCircuitBreaker(operation, options = {}) {
        const { failureThreshold = 5, resetTimeout = 60000, monitoringPeriod = 60000 } = options;
        let state = 'closed';
        let failures = 0;
        let lastFailureTime = 0;
        let nextAttempt = 0;
        let successCount = 0;
        return async (...args) => {
            const now = Date.now();
            if (state === 'open' && now - lastFailureTime > resetTimeout) {
                state = 'half-open';
                successCount = 0;
                failures = 0;
            }
            if (state === 'open') {
                throw new OrchestrationError('Circuit breaker is open', 'CIRCUIT_OPEN', 'high', false);
            }
            try {
                const result = await operation(...args);
                if (state === 'half-open') {
                    successCount++;
                    if (successCount >= 3) {
                        state = 'closed';
                        failures = 0;
                    }
                }
                return result;
            }
            catch (error) {
                failures++;
                lastFailureTime = now;
                if (failures >= failureThreshold) {
                    state = 'open';
                }
                throw error;
            }
        };
    }
    static aggregateErrors(errors, context) {
        if (errors.length === 0) {
            throw new ValidationError('No errors to aggregate', 'errors');
        }
        if (errors.length === 1) {
            return this.wrapError(errors[0], context);
        }
        const errorGroups = new Map();
        errors.forEach(error => {
            const type = this.classifyError(error).type;
            if (!errorGroups.has(type)) {
                errorGroups.set(type, []);
            }
            errorGroups.get(type).push(error);
        });
        const summary = Array.from(errorGroups.entries()).map(([type, group]) => ({
            type,
            count: group.length,
            examples: group.slice(0, 3).map(e => e.message)
        }));
        return new OrchestrationError(`Aggregate error in ${context}: ${errors.length} errors occurred`, 'AGGREGATED_ERROR', 'high', false, {
            errorCount: errors.length,
            summary,
            context
        });
    }
    static async notifyError(error, context, options = {}) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            context,
            error: {
                message: error.message,
                code: error.code,
                stack: error.stack,
                classification: this.classifyError(error)
            },
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || 'unknown'
        };
        if (options.webhookUrl) {
            try {
                const fetch = require('node-fetch');
                await fetch(options.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorInfo)
                });
            }
            catch (webhookError) {
                console.error('Failed to send error notification:', webhookError);
            }
        }
        if (options.slackWebhook) {
            try {
                const fetch = require('node-fetch');
                const slackMessage = {
                    text: `🚨 Error in ${context}`,
                    attachments: [{
                            color: 'danger',
                            fields: [
                                { title: 'Error', value: error.message, short: false },
                                { title: 'Code', value: error.code, short: true },
                                { title: 'Time', value: new Date().toISOString(), short: true }
                            ]
                        }]
                };
                await fetch(options.slackWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slackMessage)
                });
            }
            catch (slackError) {
                console.error('Failed to send Slack notification:', slackError);
            }
        }
    }
    addErrorListener(listener) {
        this.errorListeners.push(listener);
    }
    removeErrorListener(listener) {
        const index = this.errorListeners.indexOf(listener);
        if (index > -1) {
            this.errorListeners.splice(index, 1);
        }
    }
    emitError(error) {
        for (const listener of this.errorListeners) {
            try {
                listener(error);
            }
            catch (listenerError) {
                console.error('Error listener failed:', listenerError);
            }
        }
    }
    static createGlobalHandler() {
        const handler = (error, context) => {
            const wrappedError = ErrorHandler.wrapError(error, context || 'global');
            const errorHandler = ErrorHandler.getInstance();
            errorHandler.emitError(wrappedError);
            if (wrappedError.severity === 'critical') {
                console.error('Critical error:', wrappedError);
            }
            else {
                console.warn('Error occurred:', wrappedError);
            }
            if (process.env.NODE_ENV === 'production') {
                ErrorHandler.notifyError(wrappedError, context || 'global', {
                    webhookUrl: process.env.ERROR_WEBHOOK_URL
                });
            }
        };
        return handler;
    }
}
export const wrapError = ErrorHandler.wrapError.bind(ErrorHandler);
export const classifyError = ErrorHandler.classifyError.bind(ErrorHandler);
export const withRetry = ErrorHandler.withRetry.bind(ErrorHandler);
export const createCircuitBreaker = ErrorHandler.createCircuitBreaker.bind(ErrorHandler);
export const aggregateErrors = ErrorHandler.aggregateErrors.bind(ErrorHandler);
export const notifyError = ErrorHandler.notifyError.bind(ErrorHandler);
export const createGlobalHandler = ErrorHandler.createGlobalHandler.bind(ErrorHandler);
export const globalErrorHandler = ErrorHandler.createGlobalHandler();
//# sourceMappingURL=error-handler.js.map
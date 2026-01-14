/**
 * Comprehensive Error Handling System
 * Provides structured error handling, logging, and recovery mechanisms
 */
import { createLogger, format, transports } from 'winston';
// Error severity levels
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
// Error categories
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["SYSTEM"] = "system";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["SECURITY"] = "security";
    ErrorCategory["RESOURCE"] = "resource";
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["BUSINESS_LOGIC"] = "business_logic";
    ErrorCategory["INFRASTRUCTURE"] = "infrastructure";
})(ErrorCategory || (ErrorCategory = {}));
// Enhanced error class
export class DirectorError extends Error {
    constructor(message, code, severity, category, context = {}, retryable = false, recoverySuggestions = []) {
        super(message);
        this.name = 'DirectorError';
        this.code = code;
        this.severity = severity;
        this.category = category;
        this.context = {
            timestamp: new Date(),
            category,
            severity,
            component: context.component || 'unknown',
            operation: context.operation || 'unknown',
            ...context
        };
        this.retryable = retryable;
        this.recoverySuggestions = recoverySuggestions;
        this.stackTrace = context.stackTrace || this.stack;
        // Ensure proper prototype chain
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, DirectorError.prototype);
        }
        else {
            this.__proto__ = DirectorError.prototype;
        }
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            severity: this.severity,
            category: this.category,
            context: this.context,
            retryable: this.retryable,
            recoverySuggestions: this.recoverySuggestions,
            stackTrace: this.stackTrace
        };
    }
}
// Network error types
export class NetworkError extends DirectorError {
    constructor(message, context = {}) {
        super(message, 'NETWORK_ERROR', ErrorSeverity.MEDIUM, ErrorCategory.NETWORK, context, true, [
            'Check network connectivity',
            'Verify service availability',
            'Check firewall settings',
            'Retry the operation'
        ]);
    }
}
// Security error types
export class SecurityError extends DirectorError {
    constructor(message, context = {}) {
        super(message, 'SECURITY_ERROR', ErrorSeverity.HIGH, ErrorCategory.SECURITY, context, false, [
            'Review security policies',
            'Check authentication credentials',
            'Verify permissions',
            'Contact security team'
        ]);
    }
}
// Resource error types
export class ResourceError extends DirectorError {
    constructor(message, context = {}) {
        super(message, 'RESOURCE_ERROR', ErrorSeverity.HIGH, ErrorCategory.RESOURCE, context, true, [
            'Check resource availability',
            'Increase resource limits',
            'Optimize resource usage',
            'Scale up infrastructure'
        ]);
    }
}
// Validation error types
export class ValidationError extends DirectorError {
    constructor(message, context = {}) {
        super(message, 'VALIDATION_ERROR', ErrorSeverity.LOW, ErrorCategory.VALIDATION, context, false, [
            'Check input data',
            'Validate required fields',
            'Verify data types',
            'Review business rules'
        ]);
    }
}
// System error types
export class SystemError extends DirectorError {
    constructor(message, context = {}) {
        super(message, 'SYSTEM_ERROR', ErrorSeverity.CRITICAL, ErrorCategory.SYSTEM, context, false, [
            'Check system status',
            'Restart services',
            'Check logs for details',
            'Contact system administrator'
        ]);
    }
}
/**
 * Error Handler Class
 * Manages error processing, logging, and recovery
 */
export class ErrorHandler {
    constructor() {
        this.errorMetrics = new Map();
        this.recentErrors = [];
        this.maxRecentErrors = 100;
        this.logger = createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json(), format.metadata()),
            transports: [
                new transports.Console({
                    format: format.combine(format.colorize(), format.simple())
                }),
                new transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                }),
                new transports.File({
                    filename: 'logs/combined.log',
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                })
            ]
        });
        // Ensure logs directory exists
        this.ensureLogsDirectory();
    }
    /**
     * Handle an error
     */
    handleError(error, context) {
        const directorError = this.normalizeError(error, context);
        // Log the error
        this.logError(directorError);
        // Update metrics
        this.updateErrorMetrics(directorError);
        // Store recent errors
        this.storeRecentError(directorError);
        // Handle error based on severity
        this.handleErrorBasedOnSeverity(directorError);
        // Re-throw the error
        throw directorError;
    }
    /**
     * Handle error without throwing
     */
    handleNonCritical(error, context) {
        const directorError = this.normalizeError(error, context);
        // Log but don't throw for non-critical errors
        this.logError(directorError);
        this.updateErrorMetrics(directorError);
        this.storeRecentError(directorError);
        return directorError;
    }
    /**
     * Normalize various error types to DirectorError
     */
    normalizeError(error, context) {
        if (error instanceof DirectorError) {
            return error;
        }
        if (error instanceof ValidationError) {
            // Convert validation errors to appropriate DirectorError
            const errorContext = {
                ...context,
                stackTrace: error.stack,
                metadata: { field: error.field, ...context?.metadata }
            };
            return new ValidationError(error.message, errorContext);
        }
        if (error instanceof z.ZodError) {
            // Convert Zod validation errors
            const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            const errorContext = {
                ...context,
                metadata: { validationErrors: error.issues, ...context?.metadata }
            };
            return new ValidationError(`Validation failed: ${errors}`, errorContext);
        }
        if (error instanceof Error) {
            const errorContext = {
                ...context,
                stackTrace: error.stack
            };
            // Determine error type based on error message or type
            if (error.message.includes('ECONNREFUSED') ||
                error.message.includes('ENOTFOUND') ||
                error.message.includes('timeout')) {
                return new NetworkError(error.message, errorContext);
            }
            if (error.message.includes('permission') ||
                error.message.includes('unauthorized') ||
                error.message.includes('access denied')) {
                return new SecurityError(error.message, errorContext);
            }
            if (error.message.includes('memory') ||
                error.message.includes('resource') ||
                error.message.includes('quota') ||
                error.message.includes('limit')) {
                return new ResourceError(error.message, errorContext);
            }
            // Default to system error
            return new SystemError(error.message, errorContext);
        }
        // Handle non-Error objects
        return new SystemError(typeof error === 'string' ? error : 'Unknown error occurred', context);
    }
    /**
     * Log error with appropriate severity
     */
    logError(error) {
        const logData = {
            timestamp: error.context.timestamp,
            code: error.code,
            severity: error.severity,
            category: error.category,
            message: error.message,
            component: error.context.component,
            operation: error.context.operation,
            metadata: error.context.metadata,
            sessionId: error.context.sessionId,
            sandboxId: error.context.sandboxId
        };
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                this.logger.error('CRITICAL ERROR', logData);
                break;
            case ErrorSeverity.HIGH:
                this.logger.error('HIGH SEVERITY ERROR', logData);
                break;
            case ErrorSeverity.MEDIUM:
                this.logger.warn('MEDIUM SEVERITY ERROR', logData);
                break;
            case ErrorSeverity.LOW:
                this.logger.info('LOW SEVERITY ERROR', logData);
                break;
        }
    }
    /**
     * Update error metrics
     */
    updateErrorMetrics(error) {
        const key = `${error.category}:${error.code}`;
        const current = this.errorMetrics.get(key) || 0;
        this.errorMetrics.set(key, current + 1);
    }
    /**
     * Store recent errors for analysis
     */
    storeRecentError(error) {
        this.recentErrors.unshift(error);
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
        }
    }
    /**
     * Handle error based on severity
     */
    handleErrorBasedOnSeverity(error) {
        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                this.handleCriticalError(error);
                break;
            case ErrorSeverity.HIGH:
                this.handleHighSeverityError(error);
                break;
            case ErrorSeverity.MEDIUM:
                this.handleMediumSeverityError(error);
                break;
            case ErrorSeverity.LOW:
                // Low severity errors don't require special handling
                break;
        }
    }
    /**
     * Handle critical errors
     */
    handleCriticalError(error) {
        // Critical errors may require immediate action
        this.logger.error('CRITICAL ERROR REQUIRES IMMEDIATE ATTENTION', {
            error: error.toJSON(),
            actions: ['System administrator notified', 'Service health check initiated']
        });
        // Could implement additional critical error handling here
        // Such as: sending alerts, triggering failover, etc.
    }
    /**
     * Handle high severity errors
     */
    handleHighSeverityError(error) {
        this.logger.warn('HIGH SEVERITY ERROR REQUIRES ATTENTION', {
            error: error.toJSON(),
            suggestions: error.recoverySuggestions
        });
    }
    /**
     * Handle medium severity errors
     */
    handleMediumSeverityError(error) {
        if (error.retryable) {
            this.logger.info('MEDIUM SEVERITY ERROR - RETRYABLE', {
                error: error.toJSON(),
                retrySuggestion: 'Consider retrying the operation'
            });
        }
    }
    /**
     * Ensure logs directory exists
     */
    async ensureLogsDirectory() {
        const fs = await import('fs/promises');
        const path = await import('path');
        const logsDir = path.join(process.cwd(), 'logs');
        try {
            await fs.access(logsDir);
        }
        catch {
            await fs.mkdir(logsDir, { recursive: true });
        }
    }
    /**
     * Get error metrics
     */
    getErrorMetrics() {
        return new Map(this.errorMetrics);
    }
    /**
     * Get recent errors
     */
    getRecentErrors(count = 10) {
        return this.recentErrors.slice(0, count);
    }
    /**
     * Get error summary
     */
    getErrorSummary() {
        const byCategory = new Map();
        const bySeverity = new Map();
        this.recentErrors.forEach(error => {
            // By category
            const catCount = byCategory.get(error.category) || 0;
            byCategory.set(error.category, catCount + 1);
            // By severity
            const sevCount = bySeverity.get(error.severity) || 0;
            bySeverity.set(error.severity, sevCount + 1);
        });
        // Top errors
        const topErrors = Array.from(this.errorMetrics.entries())
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return {
            totalErrors: this.recentErrors.length,
            byCategory,
            bySeverity,
            topErrors
        };
    }
    /**
     * Clear error metrics
     */
    clearErrorMetrics() {
        this.errorMetrics.clear();
        this.recentErrors = [];
    }
    /**
     * Create error with context
     */
    createError(message, code, severity, category, context) {
        return new DirectorError(message, code, severity, category, context);
    }
}
// Global error handler instance
export const globalErrorHandler = new ErrorHandler();
// Process-level error handling
process.on('uncaughtException', (error) => {
    globalErrorHandler.handleError(error, {
        component: 'process',
        operation: 'uncaughtException'
    });
});
process.on('unhandledRejection', (reason, promise) => {
    globalErrorHandler.handleError(reason, {
        component: 'process',
        operation: 'unhandledRejection',
        metadata: { promise: promise.toString() }
    });
});

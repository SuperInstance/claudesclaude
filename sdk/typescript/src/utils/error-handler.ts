/**
 * Error handling utilities for the Orchestration SDK
 */

import { OrchestrationError, ValidationError } from '../../claudesclaude/dist/src/core/types';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Array<(error: any) => void> = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Error classification
  static classifyError(error: any): {
    type: 'network' | 'database' | 'validation' | 'authentication' | 'authorization' | 'system' | 'unknown';
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
  } {
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

  // Error wrapping
  static wrapError(
    error: any,
    context: string,
    code?: string,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): OrchestrationError {
    if (error instanceof OrchestrationError) {
      return error;
    }

    const message = error.message || 'An unknown error occurred';
    const errorCode = code || 'WRAPPED_ERROR';
    const errorSeverity = severity || this.classifyError(error).severity;

    return new OrchestrationError(
      `[${context}] ${message}`,
      errorCode,
      errorSeverity,
      this.classifyError(error).recoverable,
      {
        originalError: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        context
      }
    );
  }

  // Error recovery strategies
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      predicate?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = true,
      predicate = () => true
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !predicate(error)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }

  // Circuit breaker pattern
  static createCircuitBreaker<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    } = {}
  ) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 60000
    } = options;

    let state: 'closed' | 'open' | 'half-open' = 'closed';
    let failures = 0;
    let lastFailureTime = 0;
    let nextAttempt = 0;
    let successCount = 0;

    return async (...args: T): Promise<R> => {
      const now = Date.now();

      // Reset circuit breaker after timeout
      if (state === 'open' && now - lastFailureTime > resetTimeout) {
        state = 'half-open';
        successCount = 0;
        failures = 0;
      }

      // Check if circuit is open
      if (state === 'open') {
        throw new OrchestrationError(
          'Circuit breaker is open',
          'CIRCUIT_OPEN',
          'high',
          false
        );
      }

      try {
        const result = await operation(...args);

        // On success in half-open state, reset
        if (state === 'half-open') {
          successCount++;
          if (successCount >= 3) {
            state = 'closed';
            failures = 0;
          }
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        // Open circuit if threshold reached
        if (failures >= failureThreshold) {
          state = 'open';
        }

        throw error;
      }
    };
  }

  // Error aggregation
  static aggregateErrors(
    errors: any[],
    context: string
  ): OrchestrationError {
    if (errors.length === 0) {
      throw new ValidationError('No errors to aggregate', 'errors');
    }

    if (errors.length === 1) {
      return this.wrapError(errors[0], context);
    }

    // Group errors by type
    const errorGroups = new Map<string, any[]>();
    errors.forEach(error => {
      const type = this.classifyError(error).type;
      if (!errorGroups.has(type)) {
        errorGroups.set(type, []);
      }
      errorGroups.get(type)!.push(error);
    });

    // Create summary
    const summary = Array.from(errorGroups.entries()).map(([type, group]) => ({
      type,
      count: group.length,
      examples: group.slice(0, 3).map(e => e.message)
    }));

    return new OrchestrationError(
      `Aggregate error in ${context}: ${errors.length} errors occurred`,
      'AGGREGATED_ERROR',
      'high',
      false,
      {
        errorCount: errors.length,
        summary,
        context
      }
    );
  }

  // Error notification
  static async notifyError(
    error: any,
    context: string,
    options: {
      webhookUrl?: string;
      email?: string;
      slackWebhook?: string;
      tags?: string[];
    } = {}
  ): Promise<void> {
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

    // Send to webhook if configured
    if (options.webhookUrl) {
      try {
        const fetch = require('node-fetch');
        await fetch(options.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorInfo)
        });
      } catch (webhookError) {
        console.error('Failed to send error notification:', webhookError);
      }
    }

    // Send to Slack if configured
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
      } catch (slackError) {
        console.error('Failed to send Slack notification:', slackError);
      }
    }
  }

  // Event listeners
  addErrorListener(listener: (error: any) => void): void {
    this.errorListeners.push(listener);
  }

  removeErrorListener(listener: (error: any) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  private emitError(error: any): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    }
  }

  // Global error handler
  static createGlobalHandler(): (error: any, context?: string) => void {
    const handler = (error: any, context?: string) => {
      const wrappedError = ErrorHandler.wrapError(error, context || 'global');

      // Notify listeners
      const errorHandler = ErrorHandler.getInstance();
      errorHandler.emitError(wrappedError);

      // Log error
      if (wrappedError.severity === 'critical') {
        console.error('Critical error:', wrappedError);
      } else {
        console.warn('Error occurred:', wrappedError);
      }

      // In production, you might want to send this to an error tracking service
      if (process.env.NODE_ENV === 'production') {
        ErrorHandler.notifyError(wrappedError, context || 'global', {
          webhookUrl: process.env.ERROR_WEBHOOK_URL
        });
      }
    };

    return handler;
  }
}

// Export convenience functions
export const wrapError = ErrorHandler.wrapError.bind(ErrorHandler);
export const classifyError = ErrorHandler.classifyError.bind(ErrorHandler);
export const withRetry = ErrorHandler.withRetry.bind(ErrorHandler);
export const createCircuitBreaker = ErrorHandler.createCircuitBreaker.bind(ErrorHandler);
export const aggregateErrors = ErrorHandler.aggregateErrors.bind(ErrorHandler);
export const notifyError = ErrorHandler.notifyError.bind(ErrorHandler);
export const createGlobalHandler = ErrorHandler.createGlobalHandler.bind(ErrorHandler);

// Global error handler instance
export const globalErrorHandler = ErrorHandler.createGlobalHandler();
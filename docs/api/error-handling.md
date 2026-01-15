# Error Handling API

The Error Handling API provides comprehensive error management, logging, and recovery mechanisms for the orchestration system.

## Overview

The Error Handling API supports:
- Centralized error management
- Error classification and categorization
- Automatic retry mechanisms
- Error recovery strategies
- Comprehensive logging
- Error analytics and monitoring
- User-friendly error responses

## Error Types

### Base Error Classes

```typescript
// Base orchestration error
export class OrchestrationError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    recoverable: boolean = true,
    details?: any
  ) {
    super(message);
    this.name = 'OrchestrationError';
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.timestamp = new Date();
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrchestrationError);
    }
  }
}

// Validation error
export class ValidationError extends OrchestrationError {
  public readonly field: string;
  public readonly value: any;

  constructor(message: string, field: string, value?: any) {
    super(message, 'VALIDATION_ERROR', 'medium', true);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

// Authentication error
export class AuthenticationError extends OrchestrationError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 'high', false);
    this.name = 'AuthenticationError';
  }
}

// Authorization error
export class AuthorizationError extends OrchestrationError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR', 'high', false);
    this.name = 'AuthorizationError';
  }
}

// Database error
export class DatabaseError extends OrchestrationError {
  public readonly sql?: string;
  public readonly params?: any[];

  constructor(message: string, code: string, sql?: string, params?: any[]) {
    super(message, code, 'high', false);
    this.name = 'DatabaseError';
    this.sql = sql;
    this.params = params;
  }
}

// Message bus error
export class MessageBusError extends OrchestrationError {
  constructor(message: string, code: string) {
    super(message, code, 'medium', true);
    this.name = 'MessageBusError';
  }
}

// Worker error
export class WorkerError extends OrchestrationError {
  public readonly workerId?: string;
  public readonly taskId?: string;

  constructor(message: string, code: string, workerId?: string, taskId?: string) {
    super(message, code, 'high', false);
    this.name = 'WorkerError';
    this.workerId = workerId;
    this.taskId = taskId;
  }
}
```

### Common Error Codes

| Category | Code | Description | Severity | Recoverable |
|----------|------|-------------|----------|-------------|
| Authentication | `AUTH_REQUIRED` | Authentication required | High | False |
| Authentication | `INVALID_TOKEN` | Invalid or expired token | High | False |
| Authentication | `2FA_REQUIRED` | Two-factor authentication required | High | True |
| Authorization | `FORBIDDEN` | Insufficient permissions | High | False |
| Authorization | `ACCESS_DENIED` | Access denied to resource | High | False |
| Validation | `INVALID_INPUT` | Invalid input data | Medium | True |
| Validation | `MISSING_FIELD` | Required field missing | Medium | True |
| Validation | `INVALID_FORMAT` | Invalid format | Medium | True |
| Database | `DB_CONNECTION_FAILED` | Database connection failed | Critical | False |
| Database | `QUERY_FAILED` | Database query failed | High | False |
| Database | `DUPLICATE_ENTRY` | Duplicate entry violation | Medium | True |
| Message Bus | `QUEUE_FULL` | Message queue full | Medium | True |
| Message Bus | `MESSAGE_TIMEOUT` | Message processing timeout | Medium | True |
| Message Bus | `INVALID_MESSAGE` | Invalid message format | Medium | True |
| Worker | `WORKER_UNAVAILABLE` | No available workers | High | True |
| Worker | `TASK_TIMEOUT` | Task execution timeout | Medium | True |
| Worker | `WORKER_HEALTH_FAILED` | Worker health check failed | Critical | True |
| System | `INTERNAL_ERROR` | Internal server error | Critical | False |
| System | `SERVICE_UNAVAILABLE` | Service temporarily unavailable | High | True |
| System | `RATE_LIMITED` | Rate limit exceeded | Medium | True |
| System | `MAINTENANCE_MODE` | System in maintenance mode | High | True |

## Error Handling Patterns

### Basic Error Handling

```typescript
try {
  const result = await database.query('SELECT * FROM sessions WHERE id = ?', [sessionId]);

  if (!result || result.length === 0) {
    throw new SessionNotFoundError(sessionId);
  }

  return result[0];
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.warn('Session not found:', sessionId);
    throw error; // Re-throw specific error
  }

  if (error instanceof DatabaseError) {
    console.error('Database error:', error.message);
    // Retry logic could go here
    throw new OrchestrationError('Failed to retrieve session', 'SESSION_RETRIEVAL_FAILED', 'high');
  }

  console.error('Unexpected error:', error);
  throw new OrchestrationError('An unexpected error occurred', 'INTERNAL_ERROR', 'critical');
}
```

### Error Wrapping

```typescript
async function createSession(sessionData: SessionData): Promise<Session> {
  try {
    // Validate input
    validateSessionData(sessionData);

    // Create session in database
    const session = await database.createSession(sessionData);

    // Register with message bus
    await messageBus.registerSession(session.id);

    return session;

  } catch (error) {
    // Wrap and enhance the error
    if (error instanceof ValidationError) {
      throw new ValidationError(
        `Failed to create session: ${error.message}`,
        error.field,
        sessionData
      );
    }

    if (error instanceof DatabaseError) {
      throw new DatabaseError(
        `Failed to create session in database: ${error.message}`,
        'SESSION_CREATE_FAILED',
        error.sql,
        error.params
      );
    }

    throw new OrchestrationError(
      `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SESSION_CREATE_ERROR',
      'critical'
    );
  }
}
```

### Error Recovery

```typescript
class ErrorRecoveryManager {
  private retryStrategies = new Map<string, (error: any) => boolean>();

  constructor() {
    this.registerRetryStrategy('DATABASE_CONNECTION', this.retryDatabaseConnection);
    this.registerRetryStrategy('MESSAGE_TIMEOUT', this.retryMessageTimeout);
    this.registerRetryStrategy('WORKER_UNAVAILABLE', this.retryWorkerUnavailable);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        const shouldRetry = this.shouldRetry(error, context, attempt);

        if (!shouldRetry) {
          break;
        }

        // Log retry attempt
        logger.warn(`Retry attempt ${attempt}/${maxRetries} for ${context}: ${error.message}`);

        // Wait before retry
        await this.delay(delayMs * attempt);
      }
    }

    // All retries failed
    throw new OrchestrationError(
      `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
      `${context.toUpperCase()}_FAILED`,
      'high',
      false,
      { lastError, attempts: maxRetries }
    );
  }

  private shouldRetry(error: any, context: string, attempt: number): boolean {
    if (attempt >= 3) return false;

    // Check if we have a specific retry strategy
    const strategy = this.retryStrategies.get(context);
    if (strategy) {
      return strategy(error);
    }

    // Default retry logic
    return error.recoverable &&
           !(error instanceof ValidationError) &&
           !(error instanceof AuthenticationError) &&
           !(error instanceof AuthorizationError);
  }

  private async retryDatabaseConnection(error: any): Promise<boolean> {
    // Try to reconnect to database
    try {
      await database.testConnection();
      return true;
    } catch {
      return false;
    }
  }

  private async retryMessageTimeout(error: any): Promise<boolean> {
    // Message timeouts are often temporary
    return true;
  }

  private async retryWorkerUnavailable(error: any): Promise<boolean> {
    // Try to scale up workers
    try {
      await workerManager.scaleUp();
      return true;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Error Logging

### Structured Error Logging

```typescript
class ErrorLogger {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({
      level: 'error',
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
      transports: [
        new transports.File({ filename: 'errors.log' }),
        new transports.Console()
      ]
    });
  }

  async logError(error: any, context: ErrorContext): Promise<void> {
    const errorLog = {
      timestamp: new Date().toISOString(),
      level: error.severity || 'error',
      message: error.message,
      code: error.code,
      stack: error.stack,
      recoverable: error.recoverable,
      context: {
        service: context.service,
        operation: context.operation,
        userId: context.userId,
        sessionId: context.sessionId,
        traceId: context.traceId,
        metadata: context.metadata
      },
      details: error.details,
      tags: this.generateErrorTags(error)
    };

    // Log to file
    await this.logger.error(errorLog);

    // Send to error tracking service if configured
    if (process.env.ERROR_TRACKING_ENABLED) {
      await this.sendToErrorTracking(errorLog);
    }

    // Send to monitoring system
    await this.sendToMonitoring(errorLog);
  }

  private generateErrorTags(error: any): string[] {
    const tags = ['orchestration-error'];

    if (error.recoverable) {
      tags.push('recoverable');
    }

    if (error.severity === 'critical') {
      tags.push('critical');
    }

    switch (error.code.split('_')[0]) {
      case 'AUTH':
        tags.push('authentication');
        break;
      case 'DB':
        tags.push('database');
        break;
      case 'MESSAGE':
        tags.push('message-bus');
        break;
      case 'WORKER':
        tags.push('worker');
        break;
    }

    return tags;
  }

  private async sendToErrorTracking(errorLog: any): Promise<void> {
    // Send to Sentry, Rollbar, or similar service
    try {
      await fetch(process.env.ERROR_TRACKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorLog)
      });
    } catch (error) {
      console.error('Failed to send error to tracking service:', error);
    }
  }

  private async sendToMonitoring(errorLog: any): Promise<void> {
    // Send to monitoring system
    try {
      await monitoringClient.increment('errors.total', 1, {
        tags: errorLog.tags,
        type: errorLog.code
      });

      await monitoringClient.gauge('errors.severity', errorLog.severity === 'critical' ? 4 :
        errorLog.severity === 'high' ? 3 : errorLog.severity === 'medium' ? 2 : 1);
    } catch (error) {
      console.error('Failed to send error to monitoring:', error);
    }
  }
}

// Usage
const errorLogger = new ErrorLogger();

try {
  // Some operation that might fail
  await operation();
} catch (error) {
  await errorLogger.logError(error, {
    service: 'session-manager',
    operation: 'create-session',
    userId: 'user-123',
    sessionId: 'session-456',
    traceId: 'trace-789',
    metadata: { input: sessionData }
  });
}
```

### Error Aggregation and Analytics

```typescript
class ErrorAnalytics {
  private errorStore: ErrorStore;

  constructor() {
    this.errorStore = new ErrorStore();
  }

  async recordError(error: any, context: ErrorContext): Promise<void> {
    // Store error for analytics
    await this.errorStore.store({
      error,
      context,
      timestamp: new Date()
    });
  }

  async getErrorStatistics(timeRange: DateRange): Promise<ErrorStatistics> {
    const errors = await this.errorStore.findByTimeRange(timeRange);

    const stats: ErrorStatistics = {
      totalErrors: errors.length,
      bySeverity: this.groupBySeverity(errors),
      byCode: this.groupByCode(errors),
      byService: this.groupByService(errors),
      byHour: this.groupByHour(errors),
      recoveryRate: this.calculateRecoveryRate(errors),
      topErrors: this.getTopErrors(errors, 10)
    };

    return stats;
  }

  async generateErrorReport(timeRange: DateRange): Promise<ErrorReport> {
    const stats = await this.getErrorStatistics(timeRange);
    const trends = await this.getErrorTrends(timeRange);
    const recommendations = await this.generateRecommendations(stats, trends);

    return {
      summary: stats,
      trends,
      recommendations,
      generatedAt: new Date()
    };
  }

  private groupBySeverity(errors: ErrorRecord[]): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const error of errors) {
      const severity = error.error.severity || 'unknown';
      groups[severity] = (groups[severity] || 0) + 1;
    }

    return groups;
  }

  private groupByCode(errors: ErrorRecord[]): Record<string, number> {
    const groups: Record<string, number> = {};

    for (const error of errors) {
      const code = error.error.code;
      groups[code] = (groups[code] || 0) + 1;
    }

    return groups;
  }

  private calculateRecoveryRate(errors: ErrorRecord[]): number {
    const recoverable = errors.filter(e => e.error.recoverable).length;
    return errors.length > 0 ? (recoverable / errors.length) * 100 : 0;
  }

  private async generateRecommendations(
    stats: ErrorStatistics,
    trends: ErrorTrends
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Check for high error rates
    if (stats.recoveryRate < 50) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        title: 'Improve Error Recovery',
        description: `${stats.recoveryRate.toFixed(1)}% of errors are not recoverable. Consider implementing better error handling strategies.`,
        actions: [
          'Review error handling logic',
          'Implement circuit breakers',
          'Add retry mechanisms'
        ]
      });
    }

    // Check for critical errors
    if (stats.bySeverity.critical > 0) {
      recommendations.push({
        type: 'critical',
        priority: 'critical',
        title: 'Critical Errors Detected',
        description: `${stats.bySeverity.critical} critical errors found. Immediate attention required.`,
        actions: [
          'Investigate all critical errors',
          'Implement alerting',
          'Consider system rollback'
        ]
      });
    }

    return recommendations;
  }
}
```

## User-Friendly Error Responses

### API Error Response Format

```typescript
class ErrorResponseBuilder {
  build(error: any, request?: Request): APIErrorResponse {
    const response: APIErrorResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: this.getUserFriendlyMessage(error),
        details: error.details
      },
      timestamp: new Date().toISOString()
    };

    // Add request context if available
    if (request) {
      response.request = {
        method: request.method,
        url: request.url,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      };
    }

    // Add debug information in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        stack: error.stack,
        originalError: error.originalError
      };
    }

    return response;
  }

  private getUserFriendlyMessage(error: any): string {
    // Map internal error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      'SESSION_NOT_FOUND': 'The requested session could not be found.',
      'INVALID_INPUT': 'The provided input contains errors. Please check your data.',
      'AUTH_REQUIRED': 'Authentication is required to access this resource.',
      'FORBIDDEN': 'You do not have permission to perform this action.',
      'DATABASE_CONNECTION_FAILED': 'Temporary database connection issue. Please try again.',
      'RATE_LIMITED': 'Too many requests. Please wait before trying again.',
      'SERVICE_UNAVAILABLE': 'The service is temporarily unavailable. Please try again later.',
      'MAINTENANCE_MODE': 'The system is currently under maintenance.'
    };

    return errorMessages[error.code] ||
           'An unexpected error occurred. Please try again or contact support.';
  }
}
```

### Error Response Middleware

```typescript
// Express.js error handling middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errorResponse = new ErrorResponseBuilder().build(error, req);

  // Set appropriate status code
  let statusCode = 500;
  if (error instanceof ValidationError) {
    statusCode = 400;
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
  } else if (error instanceof AuthorizationError) {
    statusCode = 403;
  } else if (error instanceof SessionNotFoundError) {
    statusCode = 404;
  }

  res.status(statusCode).json(errorResponse);
};

// Usage in Express app
app.use('/api', apiRoutes);
app.use(errorHandler);
```

## Complete Error Handling Example

```typescript
import {
  OrchestrationError,
  ValidationError,
  DatabaseError,
  MessageBusError,
  ErrorRecoveryManager,
  ErrorLogger,
  ErrorResponseBuilder
} from '@claudesclaude/orchestration-sdk';

class SessionService {
  private recoveryManager: ErrorRecoveryManager;
  private errorLogger: ErrorLogger;
  private errorResponseBuilder: ErrorResponseBuilder;

  constructor() {
    this.recoveryManager = new ErrorRecoveryManager();
    this.errorLogger = new ErrorLogger();
    this.errorResponseBuilder = new ErrorResponseBuilder();
  }

  async createSession(sessionData: SessionData): Promise<Session> {
    const traceId = generateTraceId();

    try {
      // Validate input with error recovery
      const validatedSession = await this.recoveryManager.executeWithRetry(
        () => this.validateSessionData(sessionData),
        'validation',
        2
      );

      // Create session with full error handling
      const session = await this.recoveryManager.executeWithRetry(
        async () => {
          // Create in database
          const dbSession = await this.createSessionInDatabase(validatedSession);

          // Register with message bus
          await this.registerWithMessageBus(dbSession.id);

          return dbSession;
        },
        'session-creation',
        3,
        2000
      );

      return session;

    } catch (error) {
      // Log comprehensive error
      await this.errorLogger.logError(error, {
        service: 'session-service',
        operation: 'create-session',
        userId: sessionData.userId,
        traceId,
        metadata: { sessionData }
      });

      // Build user-friendly response
      const errorResponse = this.errorResponseBuilder.build(error);

      // Add trace ID for debugging
      errorResponse.traceId = traceId;

      throw errorResponse;
    }
  }

  private async validateSessionData(sessionData: SessionData): Promise<ValidatedSessionData> {
    const validationErrors: ValidationError[] = [];

    if (!sessionData.name) {
      validationErrors.push(new ValidationError('Name is required', 'name'));
    }

    if (!sessionData.type) {
      validationErrors.push(new ValidationError('Type is required', 'type'));
    }

    if (sessionData.name && sessionData.name.length > 50) {
      validationErrors.push(new ValidationError('Name must be less than 50 characters', 'name'));
    }

    if (validationErrors.length > 0) {
      throw new ValidationError(
        'Session data validation failed',
        'validation',
        { errors: validationErrors }
      );
    }

    return sessionData;
  }

  private async createSessionInDatabase(sessionData: ValidatedSessionData): Promise<Session> {
    try {
      return await database.createSession(sessionData);
    } catch (error) {
      if (error.code === 'UNIQUE_VIOLATION') {
        throw new ValidationError('A session with this name already exists', 'name');
      }

      throw new DatabaseError(
        `Failed to create session: ${error.message}`,
        'SESSION_CREATE_FAILED',
        error.sql,
        error.params
      );
    }
  }

  private async registerWithMessageBus(sessionId: string): Promise<void> {
    try {
      await messageBus.registerSession(sessionId);
    } catch (error) {
      throw new MessageBusError(
        `Failed to register session with message bus: ${error.message}`,
        'SESSION_REGISTRATION_FAILED'
      );
    }
  }
}

// Global error handler
export const globalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof OrchestrationError) {
    // Known orchestration error
    const response = new ErrorResponseBuilder().build(error, req);

    if (error.severity === 'critical') {
      // Critical errors should trigger alerts
      alertingService.alert('Critical error occurred', {
        error: error.message,
        code: error.code,
        traceId: response.traceId
      });
    }

    res.status(500).json(response);
  } else {
    // Unknown error
    console.error('Unhandled error:', error);

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        traceId: generateTraceId()
      },
      timestamp: new Date().toISOString()
    });
  }
};
```

## Error Testing

### Unit Testing for Errors

```typescript
// Session service tests
describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
  });

  describe('createSession', () => {
    it('should throw validation error for invalid session data', async () => {
      const invalidSessionData = {
        name: '',
        type: 'invalid-type'
      };

      await expect(
        sessionService.createSession(invalidSessionData)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle database errors gracefully', async () => {
      const sessionData = {
        name: 'test-session',
        type: 'director'
      };

      // Mock database to throw error
      database.createSession = jest.fn().mockRejectedValue({
        code: 'DB_CONNECTION_FAILED',
        message: 'Database connection failed'
      });

      await expect(
        sessionService.createSession(sessionData)
      ).rejects.toThrow(OrchestrationError);
    });

    it('should retry on transient errors', async () => {
      const sessionData = {
        name: 'test-session',
        type: 'director'
      };

      // Mock database to fail first, then succeed
      let callCount = 0;
      database.createSession = jest.fn()
        .mockImplementationOnce(() => {
          callCount++;
          if (callCount === 1) {
            throw new DatabaseError('Temporary failure', 'DB_TEMPORARY_ERROR');
          }
          return Promise.resolve({ id: 'session-123', ...sessionData });
        });

      await sessionService.createSession(sessionData);

      expect(database.createSession).toHaveBeenCalledTimes(2);
    });
  });
});
```

### Error Scenarios Testing

```typescript
describe('Error Scenarios', () => {
  it('should handle complete system failure gracefully', async () => {
    // Simulate multiple service failures
    database.testConnection = jest.fn().mockRejectedValue(new Error('DB down'));
    messageBus.registerSession = jest.fn().mockRejectedValue(new Error('Message bus down'));

    const sessionService = new SessionService();

    const sessionData = {
      name: 'test-session',
      type: 'director'
    };

    await expect(
      sessionService.createSession(sessionData)
    ).rejects.toThrow(/Failed after 3 attempts/);

    // Verify error was logged
    expect(errorLogger.logError).toHaveBeenCalled();
  });

  it('should provide helpful error messages to users', () => {
    const errorResponseBuilder = new ErrorResponseBuilder();

    const validationError = new ValidationError('Invalid email', 'email', 'invalid-email');
    const response = errorResponseBuilder.build(validationError);

    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('The provided input contains errors. Please check your data.');
    expect(response.error.details).toEqual({
      field: 'email',
      value: 'invalid-email'
    });
  });
});
```

## Error Handling Best Practices

### 1. Consistent Error Types
- Use the base error classes for consistency
- Extend with specific error types when needed
- Always include error code and severity

### 2. Comprehensive Logging
- Log all errors with sufficient context
- Include trace IDs for error correlation
- Log both structured and unstructured data

### 3. User-Friendly Messages
- Map internal error codes to user-friendly messages
- Never expose internal system details
- Provide actionable guidance when possible

### 4. Error Recovery
- Implement retry mechanisms for transient errors
- Use circuit breakers for cascading failures
- Provide fallback options when possible

### 5. Monitoring and Alerts
- Set up alerts for critical errors
- Monitor error rates and patterns
- Generate reports for error analysis

### 6. Testing
- Write tests for error scenarios
- Test error recovery mechanisms
- Verify error responses are user-friendly

### 7. Documentation
- Document all error codes
- Provide examples of error handling
- Include error handling in API documentation
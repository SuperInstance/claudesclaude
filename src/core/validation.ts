/**
 * Enhanced Validation System
 * Provides comprehensive input validation, sanitization, and error handling
 */

import { z } from 'zod';
import { DirectorError, ValidationError, ErrorCategory, ErrorSeverity } from './error-handler';

// Zod schemas for common validation patterns
const commonSchemas = {
  // Message validation
  message: z.object({
    id: z.string().uuid(),
    type: z.enum(['direction', 'command', 'verification_request', 'merge_request', 'status_update', 'progress_report', 'completion_notification', 'blocked_notification', 'heartbeat', 'error', 'acknowledgment', 'session_register', 'session_deregister', 'checkpoint_create', 'checkpoint_restore']),
    priority: z.enum(['low', 'normal', 'high', 'critical']).transform(p => ({ low: 1, normal: 2, high: 3, critical: 4 }[p])),
    sender: z.string().uuid(),
    receiver: z.string().uuid().optional(),
    timestamp: z.date(),
    content: z.object({}).passthrough(), // Allow any content structure
    metadata: z.object({}).passthrough(),
    requiresResponse: z.boolean(),
    responseDeadline: z.date().optional(),
    retryCount: z.number().min(0),
    maxRetries: z.number().min(0)
  }),

  // Session validation
  session: z.object({
    id: z.string().uuid(),
    type: z.enum(['director', 'department', 'observer', 'active']),
    name: z.string().min(1).max(100),
    status: z.enum(['initializing', 'active', 'idle', 'completed', 'error', 'terminated']),
    branch: z.string().min(1).max(200),
    workspace: z.string().min(1).max(500),
    createdAt: z.date(),
    lastActivity: z.date(),
    capabilities: z.array(z.string()),
    constraints: z.array(z.string()),
    metadata: z.object({}).passthrough()
  }),

  // Checkpoint validation
  checkpoint: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    sessionId: z.string().uuid(),
    timestamp: z.date(),
    snapshot: z.object({}).passthrough(),
    branches: z.array(z.string()),
    metadata: z.object({
      feature: z.string().optional(),
      priority: z.string().optional(),
      author: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string())
    }),
    createdBy: z.string().uuid(),
    size: z.number().min(0),
    checksum: z.string().min(1),
    compressed: z.boolean(),
    encrypted: z.boolean(),
    retentionExpiresAt: z.date().optional(),
    restoredFrom: z.string().optional()
  }),

  // Environment variables
  environment: z.object({
    NODE_ENV: z.enum(['development', 'staging', 'production']),
    PORT: z.string().regex(/^\d+$/).transform(v => parseInt(v)),
    WORKERS: z.string().regex(/^\d+$/).transform(v => parseInt(v)),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
    MONITORING_ENABLED: z.string().transform(v => v !== 'false')
  }),

  // Database configuration
  database: z.object({
    host: z.string().min(1).max(255),
    port: z.string().regex(/^\d+$/).transform(v => parseInt(v)),
    name: z.string().min(1).max(100),
    username: z.string().min(1).max(100),
    password: z.string().min(8).max(255),
    pool: z.object({
      min: z.number().min(0),
      max: z.number().min(1),
      idle: z.number().min(1000),
      acquire: z.number().min(1000)
    })
  }),

  // Redis configuration
  redis: z.object({
    host: z.string().min(1).max(255),
    port: z.string().regex(/^\d+$/).transform(v => parseInt(v)),
    password: z.string().optional(),
    db: z.string().regex(/^\d+$/).transform(v => parseInt(v)),
    keyPrefix: z.string().min(1).max(100),
    maxRetries: z.number().min(0)
  })
};

/**
 * Sanitizer utilities
 */
export class Sanitizer {
  /**
   * Remove potentially dangerous characters from strings
   */
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return '';

    // Remove control characters except whitespace
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Prevent string injection attacks
    sanitized = sanitized.replace(/['"\\]/g, '');

    // Limit length
    sanitized = sanitized.slice(0, maxLength);

    return sanitized.trim();
  }

  /**
   * Sanitize file paths
   */
  static sanitizePath(path: string): string {
    if (typeof path !== 'string') return '';

    // Remove path traversal attempts
    let sanitized = path.replace(/\.\./g, '').replace(/\/+/g, '/');

    // Remove leading slash for safety
    sanitized = sanitized.replace(/^\/+/, '');

    return sanitized;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input: any, min: number = -Infinity, max: number = Infinity): number {
    const num = Number(input);
    if (isNaN(num)) throw new ValidationError('Invalid number input');
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Sanitize array input
   */
  static sanitizeArray<T>(input: any, validator: (item: any) => T): T[] {
    if (!Array.isArray(input)) throw new ValidationError('Input must be an array');

    const result: T[] = [];
    for (let i = 0; i < input.length && i < 10000; i++) {
      try {
        result.push(validator(input[i]));
      } catch (error) {
        throw new ValidationError(`Array item ${i} is invalid`);
      }
    }

    return result;
  }

  /**
   * Sanitize object keys
   */
  static sanitizeObjectKeys(obj: any): Record<string, any> {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};

    const result: Record<string, any> = {};

    for (const key in obj) {
      // Skip prototype properties
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

      // Sanitize key
      const safeKey = this.sanitizeString(key, 100);
      if (safeKey) {
        result[safeKey] = obj[key];
      }
    }

    return result;
  }

  /**
   * Sanitize email addresses
   */
  static sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeString(email, 254);

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      throw new ValidationError('Invalid email format');
    }

    return sanitized.toLowerCase();
  }

  /**
   * Sanitize UUIDs
   */
  static sanitizeUUID(uuid: string): string {
    const sanitized = this.sanitizeString(uuid, 36);

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sanitized)) {
      throw new ValidationError('Invalid UUID format');
    }

    return sanitized;
  }
}

/**
 * Enhanced validator class
 */
export class Validator {
  private schemas = commonSchemas;

  /**
   * Validate data against a schema
   */
  public validate<T>(schema: z.ZodSchema<T>, data: any, context?: string): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        throw new ValidationError(
          `Validation failed${context ? ` for ${context}` : ''}: ${errors.join(', ')}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate a message
   */
  public validateMessage(data: any): z.infer<typeof commonSchemas.message> {
    return this.validate(commonSchemas.message, data, 'message');
  }

  /**
   * Validate a session
   */
  public validateSession(data: any): z.infer<typeof commonSchemas.session> {
    return this.validate(commonSchemas.session, data, 'session');
  }

  /**
   * Validate a checkpoint
   */
  public validateCheckpoint(data: any): z.infer<typeof commonSchemas.checkpoint> {
    return this.validate(commonSchemas.checkpoint, data, 'checkpoint');
  }

  /**
   * Validate environment configuration
   */
  public validateEnvironment(data: any): z.infer<typeof commonSchemas.environment> {
    return this.validate(commonSchemas.environment, data, 'environment');
  }

  /**
   * Validate database configuration
   */
  public validateDatabase(data: any): z.infer<typeof commonSchemas.database> {
    return this.validate(commonSchemas.database, data, 'database');
  }

  /**
   * Validate Redis configuration
   */
  public validateRedis(data: any): z.infer<typeof commonSchemas.redis> {
    return this.validate(commonSchemas.redis, data, 'redis');
  }

  /**
   * Safe validation with sanitization
   */
  public validateAndSanitize<T>(
    schema: z.ZodSchema<T>,
    data: any,
    sanitizer: (data: any) => any,
    context?: string
  ): T {
    const sanitized = sanitizer(data);
    return this.validate(schema, sanitized, context);
  }

  /**
   * Create a custom schema validator
   */
  public createSchema<T>(definition: {
    parse: (input: any) => T;
    safeParse?: (input: any) => { success: true; data: T } | { success: false; error: z.ZodError };
  }): z.ZodSchema<T> {
    return z.custom(definition.parse) as z.ZodSchema<T>;
  }

  /**
   * Validate that a value is within expected bounds
   */
  public validateBounds(
    value: number,
    min: number,
    max: number,
    fieldName: string
  ): number {
    if (value < min || value > max) {
      throw new ValidationError(
        `${fieldName} must be between ${min} and ${max}, got ${value}`,
        {
          component: 'validation',
          operation: 'validateBounds',
          metadata: { fieldName, value, min, max }
        }
      );
    }
    return value;
  }

  /**
   * Validate that a value is not empty
   */
  public validateNotEmpty(value: any, fieldName: string): any {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} cannot be empty`);
    }
    return value;
  }

  /**
   * Validate array length
   */
  public validateArrayLength(
    array: any[],
    min: number,
    max: number,
    fieldName: string
  ): any[] {
    this.validateBounds(array.length, min, max, `${fieldName} length`);
    return array;
  }
}

/**
 * Rate limiter for validation
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60000; // 1 minute

  /**
   * Check if a request is allowed
   */
  public allow(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Clean old attempts
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    this.attempts.set(key, validAttempts);

    const remaining = Math.max(0, this.maxAttempts - validAttempts.length);

    if (validAttempts.length >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: (validAttempts[0] || 0) + this.windowMs
      };
    }

    // Record this attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);

    return {
      allowed: true,
      remaining,
      resetTime: now + this.windowMs
    };
  }

  /**
   * Reset attempts for a key
   */
  public reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Get remaining attempts for a key
   */
  public getRemaining(key: string): number {
    const attempts = this.attempts.get(key) || [];
    const now = Date.now();
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }
}

// Global instances
export const validator = new Validator();
export const sanitizer = new Sanitizer();
export const rateLimiter = new RateLimiter();

/**
 * Validation middleware for Express-like applications
 */
export const validateRequest = (schema: z.ZodSchema, sanitize?: (data: any) => any) => {
  return (req: any, res: any, next: any) => {
    try {
      const data = sanitize ? sanitize(req.body || req.query || req.params) : req.body || req.query || req.params;
      const validated = validator.validate(schema, data);

      // Replace the request data with validated data
      if (req.body) req.body = validated;
      if (req.query) req.query = validated;
      if (req.params) req.params = validated;

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.message,
          ...(error as any).field ? { field: (error as any).field } : {}
        });
      } else {
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Validation failed'
        });
      }
    }
  };
};
/**
 * Enhanced Validation System
 * Provides comprehensive input validation, sanitization, and error handling
 */
import { z } from 'zod';
import { ValidationError } from './error-handler';
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
    static sanitizeString(input, maxLength = 1000) {
        if (typeof input !== 'string')
            return '';
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
    static sanitizePath(path) {
        if (typeof path !== 'string')
            return '';
        // Remove path traversal attempts
        let sanitized = path.replace(/\.\./g, '').replace(/\/+/g, '/');
        // Remove leading slash for safety
        sanitized = sanitized.replace(/^\/+/, '');
        return sanitized;
    }
    /**
     * Sanitize numeric input
     */
    static sanitizeNumber(input, min = -Infinity, max = Infinity) {
        const num = Number(input);
        if (isNaN(num))
            throw new ValidationError('Invalid number input');
        return Math.max(min, Math.min(max, num));
    }
    /**
     * Sanitize array input
     */
    static sanitizeArray(input, validator) {
        if (!Array.isArray(input))
            throw new ValidationError('Input must be an array');
        const result = [];
        for (let i = 0; i < input.length && i < 10000; i++) {
            try {
                result.push(validator(input[i]));
            }
            catch (error) {
                throw new ValidationError(`Array item ${i} is invalid`);
            }
        }
        return result;
    }
    /**
     * Sanitize object keys
     */
    static sanitizeObjectKeys(obj) {
        if (typeof obj !== 'object' || obj === null)
            return {};
        const result = {};
        for (const key in obj) {
            // Skip prototype properties
            if (!Object.prototype.hasOwnProperty.call(obj, key))
                continue;
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
    static sanitizeEmail(email) {
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
    static sanitizeUUID(uuid) {
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
    constructor() {
        this.schemas = commonSchemas;
    }
    /**
     * Validate data against a schema
     */
    validate(schema, data, context) {
        try {
            return schema.parse(data);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
                throw new ValidationError(`Validation failed${context ? ` for ${context}` : ''}: ${errors.join(', ')}`, 'VALIDATION_ERROR');
            }
            throw error;
        }
    }
    /**
     * Validate a message
     */
    validateMessage(data) {
        return this.validate(commonSchemas.message, data, 'message');
    }
    /**
     * Validate a session
     */
    validateSession(data) {
        return this.validate(commonSchemas.session, data, 'session');
    }
    /**
     * Validate a checkpoint
     */
    validateCheckpoint(data) {
        return this.validate(commonSchemas.checkpoint, data, 'checkpoint');
    }
    /**
     * Validate environment configuration
     */
    validateEnvironment(data) {
        return this.validate(commonSchemas.environment, data, 'environment');
    }
    /**
     * Validate database configuration
     */
    validateDatabase(data) {
        return this.validate(commonSchemas.database, data, 'database');
    }
    /**
     * Validate Redis configuration
     */
    validateRedis(data) {
        return this.validate(commonSchemas.redis, data, 'redis');
    }
    /**
     * Safe validation with sanitization
     */
    validateAndSanitize(schema, data, sanitizer, context) {
        const sanitized = sanitizer(data);
        return this.validate(schema, sanitized, context);
    }
    /**
     * Create a custom schema validator
     */
    createSchema(definition) {
        return z.custom(definition.parse);
    }
    /**
     * Validate that a value is within expected bounds
     */
    validateBounds(value, min, max, fieldName) {
        if (value < min || value > max) {
            throw new ValidationError(`${fieldName} must be between ${min} and ${max}, got ${value}`, 'VALIDATION_ERROR');
        }
        return value;
    }
    /**
     * Validate that a value is not empty
     */
    validateNotEmpty(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            throw new ValidationError(`${fieldName} cannot be empty`, 'VALIDATION_ERROR');
        }
        return value;
    }
    /**
     * Validate array length
     */
    validateArrayLength(array, min, max, fieldName) {
        this.validateBounds(array.length, min, max, `${fieldName} length`);
        return array;
    }
}
/**
 * Rate limiter for validation
 */
export class RateLimiter {
    constructor() {
        this.attempts = new Map();
        this.maxAttempts = 5;
        this.windowMs = 60000; // 1 minute
    }
    /**
     * Check if a request is allowed
     */
    allow(key) {
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
                resetTime: validAttempts[0] + this.windowMs
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
    reset(key) {
        this.attempts.delete(key);
    }
    /**
     * Get remaining attempts for a key
     */
    getRemaining(key) {
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
export const validateRequest = (schema, sanitize) => {
    return (req, res, next) => {
        try {
            const data = sanitize ? sanitize(req.body || req.query || req.params) : req.body || req.query || req.params;
            const validated = validator.validate(schema, data);
            // Replace the request data with validated data
            if (req.body)
                req.body = validated;
            if (req.query)
                req.query = validated;
            if (req.params)
                req.params = validated;
            next();
        }
        catch (error) {
            if (error instanceof ValidationError) {
                res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: error.message,
                    field: error.field
                });
            }
            else {
                res.status(500).json({
                    error: 'INTERNAL_ERROR',
                    message: 'Validation failed'
                });
            }
        }
    };
};

import { ValidationError } from '../../claudesclaude/dist/src/core/types';
import { logger } from './logger';
export class Validator {
    static instance;
    constructor() { }
    static getInstance() {
        if (!Validator.instance) {
            Validator.instance = new Validator();
        }
        return Validator.instance;
    }
    static validate(data, rules) {
        const errors = [];
        const warnings = [];
        for (const rule of rules) {
            const value = data[rule.field];
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(new ValidationError(rule.message || `Field '${rule.field}' is required`, rule.field));
                continue;
            }
            if (!rule.required && (value === undefined || value === null || value === '')) {
                continue;
            }
            if (rule.type && !this.validateType(value, rule.type)) {
                errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be of type ${rule.type}`, rule.field, value));
                continue;
            }
            if (rule.type === 'string' && (rule.min !== undefined || rule.max !== undefined)) {
                const length = value.length;
                if (rule.min !== undefined && length < rule.min) {
                    errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be at least ${rule.min} characters long`, rule.field, value));
                }
                if (rule.max !== undefined && length > rule.max) {
                    errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be at most ${rule.max} characters long`, rule.field, value));
                }
            }
            if (rule.type === 'number' && (rule.min !== undefined || rule.max !== undefined)) {
                const numValue = Number(value);
                if (rule.min !== undefined && numValue < rule.min) {
                    errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be at least ${rule.min}`, rule.field, value));
                }
                if (rule.max !== undefined && numValue > rule.max) {
                    errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be at most ${rule.max}`, rule.field, value));
                }
            }
            if (rule.pattern) {
                const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
                if (!pattern.test(value)) {
                    errors.push(new ValidationError(rule.message || `Field '${rule.field}' format is invalid`, rule.field, value));
                }
            }
            if (rule.enum && !rule.enum.includes(value)) {
                errors.push(new ValidationError(rule.message || `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`, rule.field, value));
            }
            if (rule.validator && !rule.validator(value)) {
                errors.push(new ValidationError(rule.message || `Field '${rule.field}' failed validation`, rule.field, value));
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    static validateType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            case 'email':
                return typeof value === 'string' && this.isValidEmail(value);
            case 'url':
                return typeof value === 'string' && this.isValidUrl(value);
            case 'uuid':
                return typeof value === 'string' && this.isValidUUID(value);
            case 'date':
                return value instanceof Date || !isNaN(Date.parse(value));
            default:
                return true;
        }
    }
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    static get commonRules() {
        return {
            session: [
                { field: 'type', required: true, enum: ['director', 'department', 'observer', 'active'] },
                { field: 'name', required: true, type: 'string', min: 1, max: 50 },
                { field: 'workspace', required: true, type: 'string', min: 1 }
            ],
            message: [
                { field: 'id', required: true, type: 'string', pattern: /^[0-9a-f-]+$/ },
                { field: 'type', required: true, enum: Object.values(require('../../claudesclaude/dist/src/core/types').MessageType) },
                { field: 'priority', required: true, type: 'number', min: 1, max: 4 },
                { field: 'sender', required: true, type: 'string' },
                { field: 'timestamp', required: true, type: 'date' },
                { field: 'content', required: true }
            ],
            checkpoint: [
                { field: 'name', required: true, type: 'string', min: 1, max: 100 },
                { field: 'sessionId', required: true, type: 'string', pattern: /^[0-9a-f-]+$/ },
                { field: 'timestamp', required: true, type: 'date' },
                { field: 'snapshot', required: true, type: 'object' },
                { field: 'branches', required: true, type: 'array', validator: (arr) => arr.length > 0 },
                { field: 'createdBy', required: true, type: 'string' }
            ],
            task: [
                { field: 'type', required: true, enum: Object.values(require('../../claudesclaude/dist/src/core/types').WorkerTaskType) },
                { field: 'payload', required: true },
                { field: 'priority', required: true, type: 'number', min: 1, max: 4 },
                { field: 'timeout', required: true, type: 'number', min: 1000 },
                { field: 'maxRetries', required: true, type: 'number', min: 0, max: 10 }
            ]
        };
    }
    static validateSession(session) {
        return this.validate(session, this.commonRules.session);
    }
    static validateMessage(message) {
        return this.validate(message, this.commonRules.message);
    }
    static validateCheckpoint(checkpoint) {
        return this.validate(checkpoint, this.commonRules.checkpoint);
    }
    static validateTask(task) {
        return this.validate(task, this.commonRules.task);
    }
    static cloneWithValidation(data, rules) {
        const validationResult = this.validate(data, rules);
        if (!validationResult.valid) {
            const errorMessages = validationResult.errors.map(e => e.message).join(', ');
            logger.warn('Validation failed during clone', { errors: errorMessages });
            return JSON.parse(JSON.stringify(data));
        }
        return JSON.parse(JSON.stringify(data));
    }
    static sanitize(data, allowedFields) {
        const sanitized = {};
        for (const field of allowedFields) {
            if (data.hasOwnProperty(field)) {
                sanitized[field] = data[field];
            }
        }
        return sanitized;
    }
    static validateAndSanitize(data, rules, allowedFields) {
        const validation = this.validate(data, rules);
        if (!validation.valid) {
            throw new ValidationError('Data validation failed', 'validation', { errors: validation.errors });
        }
        return this.sanitize(data, allowedFields);
    }
}
export const validate = Validator.validate.bind(Validator);
export const validateSession = Validator.validateSession.bind(Validator);
export const validateMessage = Validator.validateMessage.bind(Validator);
export const validateCheckpoint = Validator.validateCheckpoint.bind(Validator);
export const validateTask = Validator.validateTask.bind(Validator);
export const cloneWithValidation = Validator.cloneWithValidation.bind(Validator);
export const sanitize = Validator.sanitize.bind(Validator);
export const validateAndSanitize = Validator.validateAndSanitize.bind(Validator);
export class SchemaValidator {
    static validate(schema, data) {
        const errors = [];
        const warnings = [];
        try {
            this.validateSchema(schema, data, '$', errors, warnings);
        }
        catch (error) {
            errors.push(new ValidationError(`Schema validation error: ${error.message}`, 'schema'));
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    static validateSchema(schema, data, path, errors, warnings) {
        if (!this.isValidType(data, schema.type)) {
            errors.push(new ValidationError(`Expected type ${schema.type} at ${path}`, path, data));
            return;
        }
        if (schema.min !== undefined && this.getValueSize(data) < schema.min) {
            errors.push(new ValidationError(`Value at ${path} must be at least ${schema.min}`, path, data));
        }
        if (schema.max !== undefined && this.getValueSize(data) > schema.max) {
            errors.push(new ValidationError(`Value at ${path} must be at most ${schema.max}`, path, data));
        }
        if (schema.pattern && typeof data === 'string') {
            const regex = new RegExp(schema.pattern);
            if (!regex.test(data)) {
                errors.push(new ValidationError(`Value at ${path} does not match pattern`, path, data));
            }
        }
        if (schema.enum && !schema.enum.includes(data)) {
            errors.push(new ValidationError(`Value at ${path} must be one of: ${schema.enum.join(', ')}`, path, data));
        }
        if (schema.validator && !schema.validator(data)) {
            errors.push(new ValidationError(`Custom validation failed at ${path}`, path, data));
        }
        if (schema.type === 'object' && schema.properties) {
            for (const [key, propertySchema] of Object.entries(schema.properties)) {
                const valuePath = `${path}.${key}`;
                const value = data[key];
                if (schema.required?.includes(key) && (value === undefined || value === null)) {
                    errors.push(new ValidationError(`Required property ${key} is missing`, valuePath));
                    continue;
                }
                if (value !== undefined && value !== null) {
                    this.validateSchema(propertySchema, value, valuePath, errors, warnings);
                }
            }
        }
        if (schema.type === 'array' && schema.items && Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                const itemPath = `${path}[${i}]`;
                this.validateSchema(schema.items, data[i], itemPath, errors, warnings);
            }
        }
    }
    static isValidType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            default:
                return true;
        }
    }
    static getValueSize(value) {
        if (typeof value === 'string') {
            return value.length;
        }
        if (Array.isArray(value)) {
            return value.length;
        }
        if (typeof value === 'object' && value !== null) {
            return Object.keys(value).length;
        }
        return 0;
    }
}
export const validateSchema = SchemaValidator.validate.bind(SchemaValidator);
//# sourceMappingURL=validation.js.map
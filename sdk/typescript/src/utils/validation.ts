/**
 * Input validation utilities for the Orchestration SDK
 */

import { ValidationError } from '../../claudesclaude/dist/src/core/types';
import { logger } from './logger';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'email' | 'url' | 'uuid' | 'date';
  min?: number;
  max?: number;
  pattern?: RegExp | string;
  enum?: any[];
  validator?: (value: any) => boolean;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export class Validator {
  private static instance: Validator;

  private constructor() {}

  public static getInstance(): Validator {
    if (!Validator.instance) {
      Validator.instance = new Validator();
    }
    return Validator.instance;
  }

  // Validate an object against rules
  static validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    for (const rule of rules) {
      const value = data[rule.field];

      // Check if required field is missing
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(new ValidationError(
          rule.message || `Field '${rule.field}' is required`,
          rule.field
        ));
        continue;
      }

      // Skip validation if field is not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type && !this.validateType(value, rule.type)) {
        errors.push(new ValidationError(
          rule.message || `Field '${rule.field}' must be of type ${rule.type}`,
          rule.field,
          value
        ));
        continue;
      }

      // Length validation
      if (rule.type === 'string' && (rule.min !== undefined || rule.max !== undefined)) {
        const length = value.length;
        if (rule.min !== undefined && length < rule.min) {
          errors.push(new ValidationError(
            rule.message || `Field '${rule.field}' must be at least ${rule.min} characters long`,
            rule.field,
            value
          ));
        }
        if (rule.max !== undefined && length > rule.max) {
          errors.push(new ValidationError(
            rule.message || `Field '${rule.field}' must be at most ${rule.max} characters long`,
            rule.field,
            value
          ));
        }
      }

      // Number range validation
      if (rule.type === 'number' && (rule.min !== undefined || rule.max !== undefined)) {
        const numValue = Number(value);
        if (rule.min !== undefined && numValue < rule.min) {
          errors.push(new ValidationError(
            rule.message || `Field '${rule.field}' must be at least ${rule.min}`,
            rule.field,
            value
          ));
        }
        if (rule.max !== undefined && numValue > rule.max) {
          errors.push(new ValidationError(
            rule.message || `Field '${rule.field}' must be at most ${rule.max}`,
            rule.field,
            value
          ));
        }
      }

      // Pattern validation
      if (rule.pattern) {
        const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
        if (!pattern.test(value)) {
          errors.push(new ValidationError(
            rule.message || `Field '${rule.field}' format is invalid`,
            rule.field,
            value
          ));
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(new ValidationError(
          rule.message || `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
          rule.field,
          value
        ));
      }

      // Custom validator
      if (rule.validator && !rule.validator(value)) {
        errors.push(new ValidationError(
          rule.message || `Field '${rule.field}' failed validation`,
          rule.field,
          value
        ));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateType(value: any, type: string): boolean {
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

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Common validation rules
  static get commonRules(): Record<string, ValidationRule[]> {
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

  // Validate session data
  static validateSession(session: any): ValidationResult {
    return this.validate(session, this.commonRules.session);
  }

  // Validate message data
  static validateMessage(message: any): ValidationResult {
    return this.validate(message, this.commonRules.message);
  }

  // Validate checkpoint data
  static validateCheckpoint(checkpoint: any): ValidationResult {
    return this.validate(checkpoint, this.commonRules.checkpoint);
  }

  // Validate task data
  static validateTask(task: any): ValidationResult {
    return this.validate(task, this.commonRules.task);
  }

  // Safe deep clone with validation
  static cloneWithValidation<T>(data: T, rules: ValidationRule[]): T {
    const validationResult = this.validate(data, rules);

    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message).join(', ');
      logger.warn('Validation failed during clone', { errors: errorMessages });

      // Clone anyway but log warnings
      return JSON.parse(JSON.stringify(data));
    }

    return JSON.parse(JSON.stringify(data));
  }

  // Sanitize data by removing fields not in allowed fields
  static sanitize<T>(data: T, allowedFields: string[]): Partial<T> {
    const sanitized: any = {};

    for (const field of allowedFields) {
      if (data.hasOwnProperty(field)) {
        sanitized[field] = data[field];
      }
    }

    return sanitized;
  }

  // Validate and sanitize
  static validateAndSanitize<T>(data: T, rules: ValidationRule[], allowedFields: string[]): Partial<T> {
    const validation = this.validate(data, rules);

    if (!validation.valid) {
      throw new ValidationError(
        'Data validation failed',
        'validation',
        { errors: validation.errors }
      );
    }

    return this.sanitize(data, allowedFields);
  }
}

// Export convenience functions
export const validate = Validator.validate.bind(Validator);
export const validateSession = Validator.validateSession.bind(Validator);
export const validateMessage = Validator.validateMessage.bind(Validator);
export const validateCheckpoint = Validator.validateCheckpoint.bind(Validator);
export const validateTask = Validator.validateTask.bind(Validator);
export const cloneWithValidation = Validator.cloneWithValidation.bind(Validator);
export const sanitize = Validator.sanitize.bind(Validator);
export const validateAndSanitize = Validator.validateAndSanitize.bind(Validator);

// Schema validation
export interface Schema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  enum?: any[];
  validator?: (value: any) => boolean;
}

export class SchemaValidator {
  static validate(schema: Schema, data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      this.validateSchema(schema, data, '$', errors, warnings);
    } catch (error) {
      errors.push(new ValidationError(
        `Schema validation error: ${error.message}`,
        'schema'
      ));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static validateSchema(
    schema: Schema,
    data: any,
    path: string,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    // Type validation
    if (!this.isValidType(data, schema.type)) {
      errors.push(new ValidationError(
        `Expected type ${schema.type} at ${path}`,
        path,
        data
      ));
      return;
    }

    // Min/max validation
    if (schema.min !== undefined && this.getValueSize(data) < schema.min) {
      errors.push(new ValidationError(
        `Value at ${path} must be at least ${schema.min}`,
        path,
        data
      ));
    }

    if (schema.max !== undefined && this.getValueSize(data) > schema.max) {
      errors.push(new ValidationError(
        `Value at ${path} must be at most ${schema.max}`,
        path,
        data
      ));
    }

    // Pattern validation
    if (schema.pattern && typeof data === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push(new ValidationError(
          `Value at ${path} does not match pattern`,
          path,
          data
        ));
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(new ValidationError(
        `Value at ${path} must be one of: ${schema.enum.join(', ')}`,
        path,
        data
      ));
    }

    // Custom validator
    if (schema.validator && !schema.validator(data)) {
      errors.push(new ValidationError(
        `Custom validation failed at ${path}`,
        path,
        data
      ));
    }

    // Object validation
    if (schema.type === 'object' && schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        const valuePath = `${path}.${key}`;
        const value = data[key];

        if (schema.required?.includes(key) && (value === undefined || value === null)) {
          errors.push(new ValidationError(
            `Required property ${key} is missing`,
            valuePath
          ));
          continue;
        }

        if (value !== undefined && value !== null) {
          this.validateSchema(propertySchema, value, valuePath, errors, warnings);
        }
      }
    }

    // Array validation
    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const itemPath = `${path}[${i}]`;
        this.validateSchema(schema.items, data[i], itemPath, errors, warnings);
      }
    }
  }

  private static isValidType(value: any, type: string): boolean {
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

  private static getValueSize(value: any): number {
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

// Export schema validation
export const validateSchema = SchemaValidator.validate.bind(SchemaValidator);
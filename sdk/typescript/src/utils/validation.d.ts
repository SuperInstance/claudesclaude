import { ValidationError } from '../../claudesclaude/dist/src/core/types';
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
export declare class Validator {
    private static instance;
    private constructor();
    static getInstance(): Validator;
    static validate(data: any, rules: ValidationRule[]): ValidationResult;
    private static validateType;
    private static isValidEmail;
    private static isValidUrl;
    private static isValidUUID;
    static get commonRules(): Record<string, ValidationRule[]>;
    static validateSession(session: any): ValidationResult;
    static validateMessage(message: any): ValidationResult;
    static validateCheckpoint(checkpoint: any): ValidationResult;
    static validateTask(task: any): ValidationResult;
    static cloneWithValidation<T>(data: T, rules: ValidationRule[]): T;
    static sanitize<T>(data: T, allowedFields: string[]): Partial<T>;
    static validateAndSanitize<T>(data: T, rules: ValidationRule[], allowedFields: string[]): Partial<T>;
}
export declare const validate: typeof Validator.validate;
export declare const validateSession: typeof Validator.validateSession;
export declare const validateMessage: typeof Validator.validateMessage;
export declare const validateCheckpoint: typeof Validator.validateCheckpoint;
export declare const validateTask: typeof Validator.validateTask;
export declare const cloneWithValidation: typeof Validator.cloneWithValidation;
export declare const sanitize: typeof Validator.sanitize;
export declare const validateAndSanitize: typeof Validator.validateAndSanitize;
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
export declare class SchemaValidator {
    static validate(schema: Schema, data: any): ValidationResult;
    private static validateSchema;
    private static isValidType;
    private static getValueSize;
}
export declare const validateSchema: typeof SchemaValidator.validate;

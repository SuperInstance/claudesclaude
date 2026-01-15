/**
 * Security utilities for input validation and sanitization
 */

/**
 * Validates and sanitizes a context key
 */
export function validateContextKey(key: string): void {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Key must be a non-empty string');
  }

  // Prevent key injection attacks
  if (key.includes('.') || key.includes('$') || key.includes('[') || key.includes(']')) {
    throw new Error('Invalid key format: Keys cannot contain ., $, [, or ]');
  }

  // Prevent path traversal
  if (key.includes('..') || key.includes('//') || key.includes('\\')) {
    throw new Error('Invalid key format: Path traversal characters not allowed');
  }

  // Length limit
  if (key.length > 100) {
    throw new Error('Key too long: Maximum 100 characters allowed');
  }
}

/**
 * Validates and sanitizes JSON input
 */
export function validateJsonInput(input: string): any {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Value must be a non-empty string');
  }

  // Basic JSON structure validation
  if (!/^[{[]/.test(input) || !/[}\]]$/.test(input)) {
    throw new Error('Invalid JSON format');
  }

  try {
    const parsed = JSON.parse(input);

    // Check for prototype pollution
    if (typeof parsed === 'object' && parsed !== null) {
      // Check for prototype pollution constructor
      const constructor = parsed.constructor;
      if (constructor && constructor.prototype !== Object.prototype) {
        throw new Error('Invalid JSON: Prototype pollution detected');
      }

      // Check if __proto__ property is directly set
      if (Object.prototype.hasOwnProperty.call(parsed, '__proto__')) {
        throw new Error('Invalid JSON: Prototype pollution detected');
      }
    }

    return parsed;
  } catch (error) {
    throw new Error('Invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Validates a workspace path to prevent path traversal
 */
export function validateWorkspacePath(path: string): void {
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw new Error('Workspace path must be a non-empty string');
  }

  // Prevent path traversal
  if (path.includes('..') || path.includes('\\') || path.includes('//')) {
    throw new Error('Invalid workspace path: Path traversal not allowed');
  }

  // Prevent absolute paths (optional, depending on requirements)
  if (path.startsWith('/') || path.match(/^[a-zA-Z]:\\/)) {
    throw new Error('Absolute paths are not allowed for workspace');
  }

  // Length limit
  if (path.length > 200) {
    throw new Error('Workspace path too long: Maximum 200 characters allowed');
  }
}

/**
 * Sanitizes object to remove potentially sensitive data
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveKeys = [
    'password', 'secret', 'token', 'key', 'api_key', 'auth_token',
    'credential', 'private_key', 'access_token', 'refresh_token'
  ];

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive keys
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validates session type
 */
export function validateSessionType(type: string): void {
  const validTypes = ['ai-assistant', 'development', 'testing', 'deployment'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid session type: ${type}. Valid types are: ${validTypes.join(', ')}`);
  }
}

/**
 * Creates a secure error message that doesn't leak sensitive information
 */
export function createSecureError(message: string, code?: string): Error {
  const sanitizedMessage = message.replace(/password|secret|token|key/gi, '[REDACTED]');
  const error = new Error(sanitizedMessage);
  if (code) {
    (error as any).code = code;
  }
  return error;
}
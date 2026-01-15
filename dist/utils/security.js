export function validateContextKey(key) {
    if (typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Key must be a non-empty string');
    }
    if (key.includes('.') || key.includes('$') || key.includes('[') || key.includes(']')) {
        throw new Error('Invalid key format: Keys cannot contain ., $, [, or ]');
    }
    if (key.includes('..') || key.includes('//') || key.includes('\\')) {
        throw new Error('Invalid key format: Path traversal characters not allowed');
    }
    if (key.length > 100) {
        throw new Error('Key too long: Maximum 100 characters allowed');
    }
}
export function validateJsonInput(input) {
    if (typeof input !== 'string' || input.trim().length === 0) {
        throw new Error('Value must be a non-empty string');
    }
    if (!/^[{[]/.test(input) || !/[}\]]$/.test(input)) {
        throw new Error('Invalid JSON format');
    }
    try {
        const parsed = JSON.parse(input);
        if (typeof parsed === 'object' && parsed !== null) {
            const constructor = parsed.constructor;
            if (constructor && constructor.prototype !== Object.prototype) {
                throw new Error('Invalid JSON: Prototype pollution detected');
            }
            if (Object.prototype.hasOwnProperty.call(parsed, '__proto__')) {
                throw new Error('Invalid JSON: Prototype pollution detected');
            }
        }
        return parsed;
    }
    catch (error) {
        throw new Error('Invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
    }
}
export function validateWorkspacePath(path) {
    if (typeof path !== 'string' || path.trim().length === 0) {
        throw new Error('Workspace path must be a non-empty string');
    }
    if (path.includes('..') || path.includes('\\') || path.includes('//')) {
        throw new Error('Invalid workspace path: Path traversal not allowed');
    }
    if (path.startsWith('/') || path.match(/^[a-zA-Z]:\\/)) {
        throw new Error('Absolute paths are not allowed for workspace');
    }
    if (path.length > 200) {
        throw new Error('Workspace path too long: Maximum 200 characters allowed');
    }
}
export function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const sensitiveKeys = [
        'password', 'secret', 'token', 'key', 'api_key', 'auth_token',
        'credential', 'private_key', 'access_token', 'refresh_token'
    ];
    const sanitized = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            continue;
        }
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
export function validateSessionType(type) {
    const validTypes = ['ai-assistant', 'development', 'testing', 'deployment'];
    if (!validTypes.includes(type)) {
        throw new Error(`Invalid session type: ${type}. Valid types are: ${validTypes.join(', ')}`);
    }
}
export function createSecureError(message, code) {
    const sanitizedMessage = message.replace(/password|secret|token|key/gi, '[REDACTED]');
    const error = new Error(sanitizedMessage);
    if (code) {
        error.code = code;
    }
    return error;
}
//# sourceMappingURL=security.js.map
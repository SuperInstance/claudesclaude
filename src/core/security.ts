/**
 * Security Hardening Module
 * Provides comprehensive security features including headers, CSP, secrets management, and input validation
 */

import { z } from 'zod';
import { globalErrorHandler, DirectorError, ValidationError, ErrorCategory, ErrorSeverity } from './error-handler';

// Security configuration schema
const SecurityConfigSchema = z.object({
  // Content Security Policy
  csp: z.object({
    enabled: z.boolean().default(true),
    defaultSrc: z.array(z.string()).default(["'self'"]),
    scriptSrc: z.array(z.string()).default(["'self'", "'unsafe-inline'"]),
    styleSrc: z.array(z.string()).default(["'self'", "'unsafe-inline'"]),
    imgSrc: z.array(z.string()).default(["'self'", "data:", "https:"]),
    connectSrc: z.array(z.string()).default(["'self'"]),
    fontSrc: z.array(z.string()).default(["'self'"]),
    objectSrc: z.array(z.string()).default(["'none'"]),
    mediaSrc: z.array(z.string()).default(["'self'"]),
    frameSrc: z.array(z.string()).default(["'none'"]),
    sandbox: z.array(z.string()).default(["allow-scripts", "allow-forms"]),
    reportUri: z.string().optional()
  }),

  // Security headers
  headers: z.object({
    strictTransportSecurity: z.object({
      enabled: z.boolean().default(true),
      maxAge: z.number().default(31536000),
      includeSubDomains: z.boolean().default(true),
      preload: z.boolean().default(true)
    }).optional(),
    xContentTypeOptions: z.object({
      enabled: z.boolean().default(true),
      value: z.string().default("nosniff")
    }).optional(),
    xFrameOptions: z.object({
      enabled: z.boolean().default(true),
      value: z.enum(["DENY", "SAMEORIGIN"]).default("DENY")
    }).optional(),
    xXssProtection: z.object({
      enabled: z.boolean().default(true),
      value: z.string().default("1; mode=block")
    }).optional(),
    referrerPolicy: z.object({
      enabled: z.boolean().default(true),
      value: z.enum(["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"]).default("no-referrer")
    }).optional(),
    permissionsPolicy: z.object({
      enabled: z.boolean().default(true),
      value: z.string().default("geolocation=(), microphone=(), camera=()")
    }).optional(),
    cacheControl: z.object({
      enabled: z.boolean().default(true),
      value: z.string().default("no-cache, no-store, must-revalidate")
    }).optional()
  }),

  // CORS configuration
  cors: z.object({
    enabled: z.boolean().default(true),
    origin: z.union([z.string(), z.array(z.string())]).default(["http://localhost:3000"]),
    methods: z.array(z.string()).default(["GET", "POST", "PUT", "DELETE", "OPTIONS"]),
    allowedHeaders: z.array(z.string()).default(["Content-Type", "Authorization", "X-Requested-With"]),
    exposedHeaders: z.array(z.string()).default(["X-Total-Count", "X-Request-ID"]),
    credentials: z.boolean().default(false),
    maxAge: z.number().default(86400)
  }),

  // Rate limiting
  rateLimiting: z.object({
    enabled: z.boolean().default(true),
    windowMs: z.number().default(60000), // 1 minute
    max: z.number().default(100), // requests per window
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false),
    onLimitReached: z.function().optional()
  }),

  // Input sanitization
  inputSanitization: z.object({
    enabled: z.boolean().default(true),
    stripTags: z.boolean().default(true),
    encodeHtml: z.boolean().default(true),
    maxLength: z.number().default(1000),
    disallowedPatterns: z.array(z.string()).default(["<script", "javascript:", "data:", "vbscript:"])
  }),

  // Session security
  session: z.object({
    secure: z.boolean().default(true),
    httpOnly: z.boolean().default(true),
    sameSite: z.enum(["strict", "lax", "none"]).default("strict"),
    maxAge: z.number().default(3600000), // 1 hour
    renewAge: z.number().default(1800000), // 30 minutes
    rolling: z.boolean().default(true)
  }),

  // CSRF protection
  csrf: z.object({
    enabled: z.boolean().default(true),
    secret: z.string().min(32),
    cookieName: z.string().default("csrf-token"),
    headerName: z.string().default("x-csrf-token"),
    tokenLength: z.number().default(32),
    expiresIn: z.number().default(3600000)
  }),

  // Authentication security
  auth: z.object({
    bcryptRounds: z.number().min(10).max(12).default(12),
    jwtAlgorithm: z.string().default("HS256"),
    jwtExpiresIn: z.string().default("1h"),
    jwtRefreshExpiresIn: z.string().default("7d"),
    maxLoginAttempts: z.number().default(5),
    lockoutDuration: z.number().default(900000), // 15 minutes
    passwordPolicy: z.object({
      minLength: z.number().default(8),
      requireUppercase: z.boolean().default(true),
      requireLowercase: z.boolean().default(true),
      requireNumbers: z.boolean().default(true),
      requireSpecialChars: z.boolean().default(false),
      preventCommonPasswords: z.boolean().default(true)
    })
  })
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

/**
 * Security Headers Manager
 */
export class SecurityHeaders {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = SecurityConfigSchema.parse({
      csp: {
        enabled: true,
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        sandbox: ["allow-scripts", "allow-forms"]
      },
      headers: {
        strictTransportSecurity: { enabled: true, maxAge: 31536000, includeSubDomains: true, preload: true },
        xContentTypeOptions: { enabled: true, value: "nosniff" },
        xFrameOptions: { enabled: true, value: "DENY" },
        xXssProtection: { enabled: true, value: "1; mode=block" },
        referrerPolicy: { enabled: true, value: "no-referrer" },
        permissionsPolicy: { enabled: true, value: "geolocation=(), microphone=(), camera=()" },
        cacheControl: { enabled: true, value: "no-cache, no-store, must-revalidate" }
      },
      cors: {
        enabled: true,
        origin: ["http://localhost:3000"],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposedHeaders: ["X-Total-Count", "X-Request-ID"],
        credentials: false,
        maxAge: 86400
      },
      rateLimiting: { enabled: true, windowMs: 60000, max: 100 },
      inputSanitization: { enabled: true, stripTags: true, encodeHtml: true, maxLength: 1000 },
      session: { secure: true, httpOnly: true, sameSite: "strict", maxAge: 3600000, renewAge: 1800000, rolling: true },
      csrf: { enabled: true, secret: this.generateSecret(32), cookieName: "csrf-token", headerName: "x-csrf-token", tokenLength: 32, expiresIn: 3600000 },
      auth: {
        bcryptRounds: 12,
        jwtAlgorithm: "HS256",
        jwtExpiresIn: "1h",
        jwtRefreshExpiresIn: "7d",
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          preventCommonPasswords: true
        }
      },
      ...config
    });
  }

  /**
   * Generate security headers
   */
  public getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (this.config.csp.enabled) {
      const cspDirectives: string[] = [];

      if (this.config.csp.defaultSrc.length > 0) {
        cspDirectives.push(`default-src ${this.config.csp.defaultSrc.join(' ')}`);
      }
      if (this.config.csp.scriptSrc.length > 0) {
        cspDirectives.push(`script-src ${this.config.csp.scriptSrc.join(' ')}`);
      }
      if (this.config.csp.styleSrc.length > 0) {
        cspDirectives.push(`style-src ${this.config.csp.styleSrc.join(' ')}`);
      }
      if (this.config.csp.imgSrc.length > 0) {
        cspDirectives.push(`img-src ${this.config.csp.imgSrc.join(' ')}`);
      }
      if (this.config.csp.connectSrc.length > 0) {
        cspDirectives.push(`connect-src ${this.config.csp.connectSrc.join(' ')}`);
      }
      if (this.config.csp.fontSrc.length > 0) {
        cspDirectives.push(`font-src ${this.config.csp.fontSrc.join(' ')}`);
      }
      if (this.config.csp.objectSrc.length > 0) {
        cspDirectives.push(`object-src ${this.config.csp.objectSrc.join(' ')}`);
      }
      if (this.config.csp.mediaSrc.length > 0) {
        cspDirectives.push(`media-src ${this.config.csp.mediaSrc.join(' ')}`);
      }
      if (this.config.csp.frameSrc.length > 0) {
        cspDirectives.push(`frame-src ${this.config.csp.frameSrc.join(' ')}`);
      }
      if (this.config.csp.sandbox.length > 0) {
        cspDirectives.push(`sandbox ${this.config.csp.sandbox.join(' ')}`);
      }

      headers['Content-Security-Policy'] = cspDirectives.join('; ');

      if (this.config.csp.reportUri) {
        headers['Content-Security-Policy-Report-Only'] = cspDirectives.join('; ') + `; report-uri ${this.config.csp.reportUri}`;
      }
    }

    // Strict Transport Security
    if (this.config.headers.strictTransportSecurity?.enabled) {
      const hsts = this.config.headers.strictTransportSecurity!;
      const directives = [`max-age=${hsts.maxAge}`];
      if (hsts.includeSubDomains) directives.push('includeSubDomains');
      if (hsts.preload) directives.push('preload');
      headers['Strict-Transport-Security'] = directives.join('; ');
    }

    // X-Content-Type-Options
    if (this.config.headers.xContentTypeOptions?.enabled) {
      headers['X-Content-Type-Options'] = this.config.headers.xContentTypeOptions!.value;
    }

    // X-Frame-Options
    if (this.config.headers.xFrameOptions?.enabled) {
      headers['X-Frame-Options'] = this.config.headers.xFrameOptions!.value;
    }

    // X-XSS-Protection
    if (this.config.headers.xXssProtection?.enabled) {
      headers['X-XSS-Protection'] = this.config.headers.xXssProtection!.value;
    }

    // Referrer Policy
    if (this.config.headers.referrerPolicy?.enabled) {
      headers['Referrer-Policy'] = this.config.headers.referrerPolicy!.value;
    }

    // Permissions Policy
    if (this.config.headers.permissionsPolicy?.enabled) {
      headers['Permissions-Policy'] = this.config.headers.permissionsPolicy!.value;
    }

    // Cache Control
    if (this.config.headers.cacheControl?.enabled) {
      headers['Cache-Control'] = this.config.headers.cacheControl!.value;
    }

    // Additional security headers
    headers['X-Powered-By'] = 'Director Protocol';
    headers['Server'] = 'Director';

    return headers;
  }

  /**
   * Generate CORS headers
   */
  public getCorsHeaders(origin: string): Record<string, string> {
    if (!this.config.cors.enabled) return {};

    const corsHeaders: Record<string, string> = {};

    if (Array.isArray(this.config.cors.origin) && this.config.cors.origin.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Methods'] = this.config.cors.methods.join(', ');
      corsHeaders['Access-Control-Allow-Headers'] = this.config.cors.allowedHeaders.join(', ');
      corsHeaders['Access-Control-Expose-Headers'] = this.config.cors.exposedHeaders.join(', ');
      corsHeaders['Access-Control-Max-Age'] = this.config.cors.maxAge.toString();

      if (this.config.cors.credentials) {
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      }
    }

    return corsHeaders;
  }

  /**
   * Check if origin is allowed
   */
  public isOriginAllowed(origin: string): boolean {
    if (!this.config.cors.enabled) return false;

    if (typeof this.config.cors.origin === 'string') {
      return this.config.cors.origin === origin;
    }

    return this.config.cors.origin.includes(origin);
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = SecurityConfigSchema.parse({ ...this.config, ...updates });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  private generateSecret(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * Secret Manager
 * Handles secure storage and retrieval of secrets
 */
export class SecretManager {
  private secrets: Map<string, string> = new Map();
  private encryptedSecrets: Map<string, string> = new Map();

  /**
   * Store a secret
   */
  public setSecret(key: string, value: string, encrypt: boolean = false): void {
    if (encrypt) {
      // In a real implementation, you would use proper encryption
      // For now, we'll just base64 encode as a placeholder
      this.encryptedSecrets.set(key, Buffer.from(value).toString('base64'));
    } else {
      this.secrets.set(key, value);
    }
  }

  /**
   * Retrieve a secret
   */
  public getSecret(key: string, decrypt: boolean = false): string | undefined {
    if (decrypt) {
      const encrypted = this.encryptedSecrets.get(key);
      if (encrypted) {
        // In a real implementation, you would use proper decryption
        return Buffer.from(encrypted, 'base64').toString();
      }
    }
    return this.secrets.get(key);
  }

  /**
   * Remove a secret
   */
  public deleteSecret(key: string, decrypt: boolean = false): void {
    if (decrypt) {
      this.encryptedSecrets.delete(key);
    } else {
      this.secrets.delete(key);
    }
  }

  /**
   * Check if a secret exists
   */
  public hasSecret(key: string, decrypt: boolean = false): boolean {
    if (decrypt) {
      return this.encryptedSecrets.has(key);
    }
    return this.secrets.has(key);
  }

  /**
   * Get all secret keys
   */
  public getSecretKeys(decrypt: boolean = false): string[] {
    if (decrypt) {
      return Array.from(this.encryptedSecrets.keys());
    }
    return Array.from(this.secrets.keys());
  }

  /**
   * Clear all secrets
   */
  public clearAll(decrypt: boolean = false): void {
    if (decrypt) {
      this.encryptedSecrets.clear();
    } else {
      this.secrets.clear();
    }
  }

  /**
   * Check for common weak secrets
   */
  public checkWeakSecrets(): { key: string; isWeak: boolean; reason?: string }[] {
    const results: { key: string; isWeak: boolean; reason?: string }[] = [];

    for (const [key, value] of this.secrets.entries()) {
      const issues: string[] = [];

      // Check length
      if (value.length < 8) {
        issues.push('Too short');
      }

      // Check for common patterns
      if (/password|1234|admin|root|test|guest/.test(value.toLowerCase())) {
        issues.push('Contains common weak password');
      }

      // Check for sequential characters
      if (/(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/.test(value.toLowerCase())) {
        issues.push('Contains sequential characters');
      }

      // Check for repeated characters
      if (/(.)\1{2,}/.test(value)) {
        issues.push('Contains repeated characters');
      }

      results.push({
        key,
        isWeak: issues.length > 0,
        reason: issues.length > 0 ? issues.join(', ') : undefined
      });
    }

    return results;
  }
}

/**
 * Security utilities
 */
export class SecurityUtils {
  /**
   * Generate a secure random token
   */
  public static generateToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      const randomValue = randomValues[i];
      if (randomValue !== undefined) {
        const randomIndex = randomValue % chars.length;
        result += chars[randomIndex];
      }
    }

    return result;
  }

  /**
   * Generate a secure random ID
   */
  public static generateId(prefix: string = 'id'): string {
    return `${prefix}_${this.generateToken(16)}`;
  }

  /**
   * Hash a password using bcrypt (placeholder implementation)
   */
  public static async hashPassword(password: string, rounds: number = 12): Promise<string> {
    // In a real implementation, use bcrypt: const bcrypt = require('bcrypt');
    // return bcrypt.hashSync(password, bcrypt.genSaltSync(rounds));

    // Placeholder implementation - always returns the same hash
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password + rounds).digest('hex');
  }

  /**
   * Verify a password against a hash (placeholder implementation)
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    // In a real implementation, use bcrypt: return bcrypt.compareSync(password, hash);

    // Placeholder implementation
    const crypto = require('crypto');
    const testHash = crypto.createHash('sha256').update(password + 12).digest('hex');
    return testHash === hash;
  }

  /**
   * Sanitize input to prevent XSS attacks
   */
  public static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove potentially dangerous characters
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '');
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          sanitized[key] = this.sanitizeInput(input[key]);
        }
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate email format
   */
  public static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  public static validatePassword(password: string, policy: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (policy.preventCommonPasswords) {
      const commonPasswords = ['password', '123456', '12345678', 'qwerty', 'abc123', 'letmein'];
      if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for SQL injection attempts
   */
  public static detectSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(select|insert|update|delete|drop|alter|create|exec|union|truncate)\b)/gi,
      /('|--|;|\/\*|\*\/|xp_|sp_)/gi,
      /(\b(or|and)\s+\w+\s*=\s*['"]?\w+['"]?)/gi,
      /(\bwaitfor\s+delay\s+'[0-9]+:[0-9]+:[0-9+'\s]+)/gi
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for XSS attempts
   */
  public static detectXss(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<applet[^>]*>.*?<\/applet>/gi,
      /<meta[^>]*>/gi,
      /<link[^>]*>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }
}

// Global instances
export const securityHeaders = new SecurityHeaders();
export const secretManager = new SecretManager();
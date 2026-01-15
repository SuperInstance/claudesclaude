/**
 * Security Middleware
 * Integrates security features into the request/response cycle
 */

import type { Request, Response, NextFunction } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; token: string };
    }
  }
}
import { securityHeaders, secretManager, SecurityUtils } from './security';
import { validator } from './validation';
import { globalErrorHandler, ValidationError, DirectorError, ErrorCategory, ErrorSeverity } from './error-handler';
import { rateLimiter } from './validation';

/**
 * Security middleware for Express applications
 */
export class SecurityMiddleware {
  private securityHeaders = securityHeaders;

  /**
   * Apply security headers to responses
   */
  public applySecurityHeaders(req: Request, res: Response, next: NextFunction): void {
    // Add security headers
    const headers = this.securityHeaders.getHeaders();
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    // Add CORS headers if applicable
    const origin = req.headers.origin;
    if (origin && this.securityHeaders.isOriginAllowed(origin)) {
      const corsHeaders = this.securityHeaders.getCorsHeaders(origin);
      for (const [key, value] of Object.entries(corsHeaders)) {
        res.setHeader(key, value);
      }
    }

    // Request ID for tracking
    const requestId = SecurityUtils.generateId('req');
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;

    next();
  }

  /**
   * Rate limiting middleware
   */
  public rateLimit(keyGenerator: (req: Request) => string = (req) => req.ip || 'unknown') {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = keyGenerator(req);
        const result = rateLimiter.allow(key);

        if (!result.allowed) {
          res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            remaining: 0,
            resetTime: result.resetTime
          });
          return;
        }

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', '5');
        res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
        res.setHeader('X-RateLimit-Reset', result.resetTime.toString());

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * CSRF protection middleware
   */
  public csrfProtection(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method)) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const storedToken = secretManager.getSecret('csrf-token');

    if (!csrfToken || csrfToken !== storedToken) {
      const error = new ValidationError('Invalid CSRF token', {
        component: 'security',
        operation: 'csrf_validation',
        metadata: { field: 'csrf_token' }
      });
      return next(globalErrorHandler.handleNonCritical(error, {
        component: 'security',
        operation: 'csrf_validation'
      }));
    }

    next();
  }

  /**
   * Input validation middleware
   */
  public validateInput(schema: any, field: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = req[field];
        const validated = validator.validate(schema, data);

        // Replace the request data with validated data
        req[field] = validated;

        // Additional security checks
        this.checkForMaliciousInput(validated);

        next();
      } catch (error) {
        if (error instanceof ValidationError) {
          return next(globalErrorHandler.handleNonCritical(error, {
            component: 'security',
            operation: 'input_validation'
          }));
        }
        next(error);
      }
    };
  }

  /**
   * Check for malicious input
   */
  private checkForMaliciousInput(data: any): void {
    if (typeof data === 'string') {
      if (SecurityUtils.detectSqlInjection(data)) {
        throw new ValidationError('Potential SQL injection detected', {
          component: 'security',
          operation: 'input_validation',
          metadata: { field: 'input_security' }
        });
      }

      if (SecurityUtils.detectXss(data)) {
        throw new ValidationError('Potential XSS attack detected', {
          component: 'security',
          operation: 'input_validation',
          metadata: { field: 'input_security' }
        });
      }
    } else if (Array.isArray(data)) {
      for (const item of data) {
        this.checkForMaliciousInput(item);
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const value of Object.values(data)) {
        this.checkForMaliciousInput(value);
      }
    }
  }

  /**
   * Authentication middleware
   */
  public authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      const error = new ValidationError('Authorization header required', {
        component: 'security',
        operation: 'authentication',
        metadata: { field: 'authorization' }
      });
      return next(globalErrorHandler.handleNonCritical(error, {
        component: 'security',
        operation: 'authentication'
      }));
    }

    // Bearer token validation
    if (!authHeader.startsWith('Bearer ')) {
      const error = new ValidationError('Invalid authorization format', {
        component: 'security',
        operation: 'authentication',
        metadata: { field: 'authorization' }
      });
      return next(globalErrorHandler.handleNonCritical(error, {
        component: 'security',
        operation: 'authentication'
      }));
    }

    const token = authHeader.substring(7);

    // In a real implementation, you would validate the JWT token here
    // For now, we'll just check if it exists in our secret manager
    if (!secretManager.hasSecret(`token_${token}`)) {
      const error = new ValidationError('Invalid or expired token', {
        component: 'security',
        operation: 'authentication',
        metadata: { field: 'token' }
      });
      return next(globalErrorHandler.handleNonCritical(error, {
        component: 'security',
        operation: 'authentication'
      }));
    }

    // Add user info to request
    req.user = { id: 'user_id', token }; // Placeholder

    next();
  }

  /**
   * Authorization middleware
   */
  public authorize(roles: string[] = []) {
    return (req: Request, res: Response, next: NextFunction) => {
      // In a real implementation, you would check user roles here
      // For now, we'll just check if user exists
      if (!req.user) {
        const error = new ValidationError('Authentication required', {
        component: 'security',
        operation: 'authorization',
        metadata: { field: 'authentication' }
      });
        return next(globalErrorHandler.handleNonCritical(error, {
          component: 'security',
          operation: 'authorization'
        }));
      }

      // If roles are specified, check if user has required role
      if (roles.length > 0) {
        // Placeholder role check
        if (!roles.includes('admin')) { // Replace with actual role check
          const error = new ValidationError('Insufficient permissions', {
        component: 'security',
        operation: 'authorization',
        metadata: { field: 'roles' }
      });
          return next(globalErrorHandler.handleNonCritical(error, {
            component: 'security',
            operation: 'authorization'
          }));
        }
      }

      next();
    };
  }

  /**
   * Request logging middleware
   */
  public logRequests(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // Log request details
    console.log({
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });

    // Override end method to log response time
    const originalEnd = res.end;
    res.end = function(chunk: any, encoding?: any) {
      const duration = Date.now() - start;

      console.log({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        requestId: req.headers['x-request-id']
      });

      originalEnd.call(res, chunk, encoding);
    } as any;

    next();
  }

  /**
   * Error handling middleware
   */
  public errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    // Sanitize error details for security
    const sanitizedError = {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: (error as any).code,
      status: (error as any).status || 500
    };

    // Log error with security context
    console.error({
      error: sanitizedError,
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      url: req.url,
      userAgent: req.headers['user-agent']
    });

    // Send error response
    res.status(sanitizedError.status).json({
      error: (error as any).code || 'INTERNAL_ERROR',
      message: sanitizedError.message,
      requestId: req.headers['x-request-id']
    });
  }

  /**
   * Health check with security headers
   */
  public healthCheck(req: Request, res: Response): void {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      security: {
        headersApplied: true,
        csrfEnabled: true,
        rateLimiting: true
      }
    };

    res.json(health);
  }

  /**
   * Security metrics endpoint
   */
  public securityMetrics(req: Request, res: Response): void {
    const metrics = {
      secrets: {
        total: secretManager.getSecretKeys().length,
        encrypted: secretManager.getSecretKeys(true).length,
        weakSecrets: secretManager.checkWeakSecrets().filter(s => s.isWeak).length
      },
      rateLimit: {
        windowMs: 60000,
        max: 100,
        remaining: rateLimiter.getRemaining(req.ip || 'unknown')
      },
      headers: Object.keys(securityHeaders.getHeaders()).length
    };

    res.json(metrics);
  }
}

// Export middleware instance
export const securityMiddleware = new SecurityMiddleware();

// Export individual middleware functions for easier use
export const applySecurityHeaders = securityMiddleware.applySecurityHeaders.bind(securityMiddleware);
export const rateLimit = securityMiddleware.rateLimit.bind(securityMiddleware);
export const csrfProtection = securityMiddleware.csrfProtection.bind(securityMiddleware);
export const validateInput = securityMiddleware.validateInput.bind(securityMiddleware);
export const authenticate = securityMiddleware.authenticate.bind(securityMiddleware);
export const authorize = securityMiddleware.authorize.bind(securityMiddleware);
export const logRequests = securityMiddleware.logRequests.bind(securityMiddleware);
export const errorHandler = securityMiddleware.errorHandler.bind(securityMiddleware);
export const healthCheck = securityMiddleware.healthCheck.bind(securityMiddleware);
export const securityMetrics = securityMiddleware.securityMetrics.bind(securityMiddleware);
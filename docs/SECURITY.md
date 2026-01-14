# Security Implementation

## Overview

This document describes the security implementation in the Director Protocol, including headers, CSP (Content Security Policy), and overall security hardening measures.

## Security Headers

### Content Security Policy (CSP)

The Director Protocol implements a comprehensive Content Security Policy to prevent XSS attacks and other security vulnerabilities.

**CSP Configuration:**
- `default-src 'self'` - Only allow resources from the same origin
- `script-src 'self' 'unsafe-inline'` - Allow scripts from same origin and inline scripts
- `style-src 'self' 'unsafe-inline'` - Allow styles from same origin and inline styles
- `img-src 'self' data: https:` - Allow images from same origin, data URLs, and HTTPS
- `connect-src 'self'` - Only connect to same origin
- `font-src 'self'` - Only load fonts from same origin
- `object-src 'none'` - Block all plugins and embedded objects
- `media-src 'self'` - Only load media from same origin
- `frame-src 'none'` - Block all iframes
- `sandbox allow-scripts allow-forms` - Apply sandbox restrictions to iframes

### Security Headers

The following security headers are applied to all responses:

1. **Strict-Transport-Security (HSTS)**
   - Enforces HTTPS connections
   - Max age: 1 year
   - Includes subdomains
   - Preload enabled

2. **X-Content-Type-Options: nosniff**
   - Prevents MIME type sniffing

3. **X-Frame-Options: DENY**
   - Prevents clickjacking attacks

4. **X-XSS-Protection: 1; mode=block**
   - Enables XSS protection in browsers

5. **Referrer-Policy: no-referrer**
   - Controls referrer information

6. **Permissions-Policy**
   - Restricts access to browser APIs (geolocation, microphone, camera)

7. **Cache-Control: no-cache, no-store, must-revalidate**
   - Prevents caching of sensitive data

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured with strict defaults:

```typescript
cors: {
  enabled: true,
  origin: ["http://localhost:3000"], // Whitelist specific origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["X-Total-Count", "X-Request-ID"],
  credentials: false,
  maxAge: 86400
}
```

## Input Sanitization

All user input is sanitized to prevent injection attacks:

### XSS Prevention
- Removal of script tags
- Removal of javascript: and data: URI schemes
- Removal of vbscript: schemes
- Removal of potentially dangerous event handlers

### SQL Injection Prevention
- Detection of SQL keywords and patterns
- Parameterized query enforcement
- Input validation

### Input Validation
- Type checking
- Length validation
- Format validation (email, UUID, etc.)
- Range validation for numbers

## Authentication & Authorization

### Authentication Flow
1. Bearer token validation
2. JWT token verification
3. Session management with secure cookies

### Security Features
- bcrypt password hashing (12 rounds)
- JWT with configurable expiration
- Refresh token support
- Rate limiting on authentication attempts
- Account lockout after failed attempts

### Password Policy
- Minimum length: 8 characters
- Uppercase required
- Lowercase required
- Numbers required
- Special characters optional
- Common password prevention

## CSRF Protection

- CSRF token validation for state-changing operations
- Secure cookie with HttpOnly and SameSite attributes
- Token-based protection for forms

## Rate Limiting

### Implementation
- Window-based rate limiting (default: 1 minute)
- Configurable maximum requests per window
- Per-client IP tracking
- Skip options for successful/failed requests

### Configuration
```typescript
rateLimiting: {
  enabled: true,
  windowMs: 60000, // 1 minute
  max: 100, // requests per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false
}
```

## Security Utilities

### Secret Management
- Secure storage of sensitive data
- Encryption support for secrets
- Secret validation and rotation
- Weak secret detection

### Security Monitoring
- Security metrics endpoint
- Real-time security alerts
- Performance monitoring
- Memory usage tracking

### Response Security
- Sanitized error responses
- No sensitive data in logs
- Secure error handling
- Request ID tracking

## Security Middleware

The security middleware provides comprehensive protection:

1. **SecurityHeadersMiddleware** - Applies security headers
2. **RateLimitingMiddleware** - Enforces rate limits
3. **CSRFProtectionMiddleware** - Validates CSRF tokens
4. **InputValidationMiddleware** - Sanitizes and validates input
5. **AuthenticationMiddleware** - Handles authentication
6. **AuthorizationMiddleware** - Manages permissions
7. **RequestLoggingMiddleware** - Logs requests for auditing

## Configuration

### Security Configuration Example

```typescript
const securityConfig: SecurityConfig = {
  csp: {
    enabled: true,
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    sandbox: ["allow-scripts", "allow-forms"]
  },
  headers: {
    strictTransportSecurity: {
      enabled: true,
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    xContentTypeOptions: { enabled: true, value: "nosniff" },
    xFrameOptions: { enabled: true, value: "DENY" },
    xXssProtection: { enabled: true, value: "1; mode=block" }
  },
  cors: {
    enabled: true,
    origin: ["https://yourdomain.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: false
  },
  session: {
    secure: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: 3600000
  }
};
```

## Best Practices

### For Development
- Enable verbose logging
- Use development-friendly CORS settings
- Disable some security features for local testing

### For Production
- Enable all security features
- Use HTTPS exclusively
- Monitor security metrics
- Regular security audits
- Keep dependencies updated

### Testing
- Run security tests regularly
- Perform penetration testing
- Test edge cases and malformed input
- Verify header compliance

## Security Endpoints

### Security Metrics
- `GET /api/security/metrics` - Get security metrics
- Provides cache statistics, rate limiting info, and security metrics

### Health Check
- `GET /health` - Health check with security info
- Returns security status and configuration

## Monitoring & Alerting

### Security Events Tracked
- Authentication failures
- Rate limit violations
- CSRF token validation failures
- Input validation failures
- Security header violations
- Memory usage warnings

### Alerting Thresholds
- Memory usage > 80%
- High error rates
- Multiple failed authentication attempts
- Suspicious request patterns

## Implementation Notes

### Security Headers Order
Security headers should be applied in a specific order to ensure proper protection:
1. HSTS
2. Content Security Policy
3. X-Content-Type-Options
4. X-Frame-Options
5. X-XSS-Protection
6. Referrer Policy
7. Permissions Policy
8. Cache Control

### Performance Considerations
- Security features are designed to be performant
- Caching reduces overhead of repeated checks
- Validation is lazy and only when needed
- Rate limiting uses efficient data structures

### Future Enhancements
- Support for additional security standards
- Integration with external security services
- Advanced threat detection
- Automated security updates

## References

- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)
- [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Rate Limiting](https://kubernetes.io/docs/concepts/cluster-administration/logging/#rate-limiting)
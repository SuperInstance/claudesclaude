# Authentication & Security API

The Security API provides comprehensive authentication, authorization, and security features for protecting orchestration system resources and communications.

## Overview

The Security API supports:
- Multi-factor authentication
- Role-based access control (RBAC)
- Session management and validation
- Secure communication encryption
- Audit logging and monitoring
- Rate limiting and DDoS protection
- Input validation and sanitization

## Authentication

### Authentication Methods

| Method | Description | Security Level |
|--------|-------------|----------------|
| `API_KEY` | Simple API key authentication | Medium |
| `JWT` | JSON Web Token authentication | High |
| `OAUTH2` | OAuth 2.0 flow integration | Very High |
| `SESSION` | Session-based authentication | Medium |
| `CERTIFICATE` | X.509 certificate authentication | Very High |

### Basic Authentication Setup

```typescript
import { SecurityManager, AuthMethod } from '@claudesclaude/orchestration-sdk';

const securityManager = new SecurityManager({
  authMethod: AuthMethod.API_KEY,
  apiKeyHeader: 'X-API-Key',
  jwtSecret: 'your-secret-key',
  sessionTimeout: 3600000, // 1 hour
  enableMultiFactor: true
});

// API Key Authentication
const authenticateWithApiKey = async (apiKey: string) => {
  try {
    const user = await securityManager.authenticate({
      method: AuthMethod.API_KEY,
      apiKey: apiKey
    });

    console.log('User authenticated:', user.id);
    return user;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw new AuthenticationError('Invalid API key');
  }
};

// JWT Authentication
const authenticateWithJWT = async (token: string) => {
  try {
    const payload = await securityManager.verifyJWT(token);

    // Validate token claims
    if (payload.exp < Date.now() / 1000) {
      throw new TokenExpiredError();
    }

    if (!payload.scope?.includes('api:access')) {
      throw new InsufficientScopeError();
    }

    return payload;
  } catch (error) {
    console.error('JWT validation failed:', error);
    throw new AuthenticationError('Invalid or expired token');
  }
};
```

### Multi-Factor Authentication

```typescript
// Setup 2FA
const setup2FA = async (userId: string) => {
  // Generate TOTP secret
  const totpSecret = await securityManager.generateTOTPSecret();

  // Generate backup codes
  const backupCodes = await securityManager.generateBackupCodes(10);

  // Store 2FA configuration
  await securityManager.enable2FA(userId, {
    type: 'totp',
    secret: totpSecret,
    backupCodes: backupCodes
  });

  return { totpSecret, backupCodes };
};

// Verify 2FA
const verify2FA = async (userId: string, token: string) => {
  try {
    // Verify TOTP
    const isValid = await securityManager.verifyTOTP(userId, token);

    if (!isValid) {
      // Try backup codes
      const backupValid = await securityManager.verifyBackupCode(userId, token);
      return backupValid;
    }

    return isValid;
  } catch (error) {
    console.error('2FA verification failed:', error);
    return false;
  }
};
```

## Authorization

### Role-Based Access Control

```typescript
// Define roles and permissions
const roles = {
  admin: {
    permissions: [
      'session:create',
      'session:read',
      'session:update',
      'session:delete',
      'user:manage',
      'system:config'
    ]
  },
  developer: {
    permissions: [
      'session:read',
      'session:create',
      'session:update',
      'message:send'
    ]
  },
  observer: {
    permissions: [
      'session:read',
      'message:read'
    ]
  }
};

// Create RBAC policy
const rbac = new RBAC(roles);

// Check user permissions
const authorize = async (userId: string, permission: string) => {
  const user = await securityManager.getUser(userId);
  const hasPermission = rbac.hasPermission(user.role, permission);

  if (!hasPermission) {
    throw new AuthorizationError(`Insufficient permissions for ${permission}`);
  }

  return hasPermission;
};

// Example usage
try {
  await authorize(userId, 'session:create');
  // User can create sessions
} catch (error) {
  console.error('Authorization failed:', error);
}
```

### Resource-Level Authorization

```typescript
// Check access to specific resource
const checkResourceAccess = async (userId: string, resourceId: string, action: string) => {
  const resource = await securityManager.getResource(resourceId);
  const user = await securityManager.getUser(userId);

  // Check role permissions
  if (!rbac.hasPermission(user.role, `${resource.type}:${action}`)) {
    return false;
  }

  // Check ownership
  if (resource.owner !== userId && !user.roles.includes('admin')) {
    return false;
  }

  // Check team access if applicable
  if (resource.team && !user.teams.includes(resource.team)) {
    return false;
  }

  return true;
};
```

## Session Security

### Session Management

```typescript
// Create secure session
const createSecureSession = async (userId: string) => {
  const session = await securityManager.createSession({
    userId: userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceFingerprint: await generateFingerprint(req),
    timeout: 3600000, // 1 hour
    renewable: true,
    maxRenewals: 5
  });

  // Set secure cookie
  res.cookie('session_token', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: session.timeout
  });

  return session;
};

// Validate session
const validateSession = async (token: string) => {
  try {
    const session = await securityManager.getSession(token);

    if (!session || session.expired) {
      throw new InvalidSessionError();
    }

    // Check IP address change
    if (session.ip !== req.ip) {
      await securityManager.invalidateSession(token);
      throw new SuspiciousActivityError('IP address changed');
    }

    // Check user agent
    if (session.userAgent !== req.headers['user-agent']) {
      await securityManager.flagSuspiciousActivity(session.userId, 'user_agent_change');
    }

    // Renew session if needed
    if (session.shouldRenew()) {
      await securityManager.renewSession(token);
    }

    return session;
  } catch (error) {
    console.error('Session validation failed:', error);
    throw new AuthenticationError('Invalid session');
  }
};
```

### Session Monitoring

```typescript
// Monitor active sessions
const monitorSessions = async () => {
  const sessions = await securityManager.getActiveSessions();

  for (const session of sessions) {
    // Check for suspicious activity
    if (session.locationChanged) {
      await securityManager.flagSuspiciousActivity(session.userId, 'location_change');
    }

    if (session.deviceChanged) {
      await securityManager.flagSuspiciousActivity(session.userId, 'device_change');
    }

    if (session.abnormalActivity) {
      await securityManager.flagSuspiciousActivity(session.userId, 'abnormal_activity');
    }
  }
};

// Cleanup expired sessions
const cleanupSessions = async () => {
  const expiredCount = await securityManager.cleanupExpiredSessions();
  console.log(`Cleaned up ${expiredCount} expired sessions`);
};
```

## Communication Security

### Message Encryption

```typescript
// Encrypt messages
const encryptMessage = async (message: Message) => {
  const encryptionKey = await securityManager.getEncryptionKey('messages');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

  let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'aes-256-gcm'
  };
};

// Decrypt messages
const decryptMessage = async (encryptedMessage: EncryptedMessage) => {
  const encryptionKey = await securityManager.getEncryptionKey('messages');
  const iv = Buffer.from(encryptedMessage.iv, 'hex');
  const authTag = Buffer.from(encryptedMessage.authTag, 'hex');

  const decipher = crypto.createDecipheriv(
    encryptedMessage.algorithm,
    encryptionKey,
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedMessage.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
};
```

### Message Signing

```typescript
// Sign messages
const signMessage = async (message: Message) => {
  const signatureKey = await securityManager.getSignatureKey('messages');
  const messageString = JSON.stringify(message);

  const signature = crypto.createSign('RSA-SHA256')
    .update(messageString)
    .sign(signatureKey, 'hex');

  return {
    ...message,
    signature: signature,
    signedAt: new Date().toISOString()
  };
};

// Verify message signature
const verifyMessage = async (signedMessage: SignedMessage) => {
  try {
    const signatureKey = await securityManager.getPublicKey('messages');
    const messageString = JSON.stringify({
      ...signedMessage,
      signature: undefined,
      signedAt: undefined
    });

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(messageString);

    return verifier.verify(signatureKey, signedMessage.signature, 'hex');
  } catch (error) {
    console.error('Message verification failed:', error);
    return false;
  }
};
```

## Audit Logging

### Security Events

```typescript
// Log security events
const securityLogger = new SecurityLogger({
  database: 'audit',
  retentionDays: 90,
  enableRealtime: true,
  webhookUrl: 'https://security-webhook.example.com'
});

// Log authentication attempt
await securityLogger.logEvent({
  type: 'authentication_attempt',
  userId: 'user-123',
  timestamp: new Date(),
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  result: 'success',
  method: 'api_key'
});

// Log authorization failure
await securityLogger.logEvent({
  type: 'authorization_failure',
  userId: 'user-123',
  timestamp: new Date(),
  resource: 'session-456',
  action: 'delete',
  reason: 'insufficient_permissions'
});

// Log suspicious activity
await securityLogger.logEvent({
  type: 'suspicious_activity',
  userId: 'user-123',
  timestamp: new Date(),
  activity: 'multiple_failed_logins',
  details: {
    failures: 5,
    timeWindow: '15 minutes'
  },
  severity: 'high'
});
```

### Audit Queries

```typescript
// Query audit logs
const queryAuditLogs = async (filters: AuditFilters) => {
  const logs = await securityLogger.query({
    eventType: filters.eventType,
    userId: filters.userId,
    dateRange: filters.dateRange,
    ip: filters.ip,
    severity: filters.severity,
    limit: filters.limit || 100
  });

  return logs.map(log => ({
    id: log.id,
    type: log.type,
    timestamp: log.timestamp,
    userId: log.userId,
    details: log.details,
    severity: log.severity
  }));
};

// Generate security report
const generateSecurityReport = async (dateRange: DateRange) => {
  const logs = await queryAuditLogs({ dateRange });

  const report = {
    totalEvents: logs.length,
    byType: groupBy(logs, 'type'),
    bySeverity: groupBy(logs, 'severity'),
    topUsers: getTopUsers(logs),
    suspiciousIPs: getSuspiciousIPs(logs),
    recommendations: generateRecommendations(logs)
  };

  return report;
};
```

## Rate Limiting and DDoS Protection

### Rate Limiting

```typescript
// Configure rate limiting
const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Apply rate limiting
app.use('/api/', rateLimiter);

// Custom rate limiting by user
const userRateLimiter = new RateLimiter({
  store: new RedisStore(),
  windowMs: 3600000, // 1 hour
  max: 1000, // per user
  keyGenerator: (req) => req.user?.id || req.ip
});
```

### DDoS Protection

```typescript
// Setup DDoS protection
const ddosProtection = new DDoSProtection({
  maxRequests: 1000, // per second
  maxConcurrent: 100, // concurrent connections
  whitelist: ['trusted-network.example.com'],
  blacklist: ['malicious-ip.com'],
  enableGeoBlocking: true,
  enableCAPTCHA: true
});

// Check request validity
const checkRequest = async (req: Request) => {
  // Check IP reputation
  const ipReputation = await ddosProtection.checkIPReputation(req.ip);
  if (ipReputation.blocked) {
    throw new BlockedIPError();
  }

  // Check request frequency
  if (await ddosProtection.isRateLimited(req.ip)) {
    throw new RateLimitExceededError();
  }

  // Check for bots
  if (await ddosProtection.isBot(req)) {
    throw new BotDetectedError();
  }

  return true;
};
```

## Input Validation and Sanitization

### Input Validation

```typescript
// Validate input schema
const inputSchema = {
  type: 'object',
  required: ['username', 'email', 'password'],
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$'
    },
    email: {
      type: 'string',
      format: 'email'
    },
    password: {
      type: 'string',
      minLength: 8,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$'
    }
  }
};

// Validate input
const validateInput = (input: unknown) => {
  const result = validate(inputSchema, input);

  if (!result.valid) {
    throw new ValidationError(result.errors);
  }

  return result.value;
};
```

### Input Sanitization

```typescript
// Sanitize user input
const sanitizeInput = (input: string) => {
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>\"'&]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
};

// Sanitize object
const sanitizeObject = (obj: Record<string, any>) => {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};
```

## Complete Security Example

```typescript
import {
  SecurityManager,
  AuthMethod,
  RBAC,
  SecurityLogger,
  DDoSProtection
} from '@claudesclaude/orchestration-sdk';

class SecureOrchestrationAPI {
  constructor() {
    this.securityManager = new SecurityManager({
      authMethod: AuthMethod.JWT,
      jwtSecret: process.env.JWT_SECRET,
      sessionTimeout: 3600000,
      enableMultiFactor: true
    });

    this.rbac = new RBAC(roles);
    this.securityLogger = new SecurityLogger({
      database: 'audit',
      retentionDays: 90
    });

    this.ddosProtection = new DDoSProtection({
      maxRequests: 1000,
      enableGeoBlocking: true
    });
  }

  async handleRequest(req: Request) {
    try {
      // Step 1: DDoS Protection
      await this.ddosProtection.checkRequest(req);

      // Step 2: Authentication
      const token = this.extractToken(req);
      const user = await this.authenticate(token);

      // Step 3: Authorization
      await this.authorize(user, req);

      // Step 4: Input Validation
      const sanitizedInput = this.sanitizeInput(req.body);

      // Step 5: Process Request
      const result = await this.processRequest(user, sanitizedInput);

      // Step 6: Log Success
      await this.securityLogger.logEvent({
        type: 'api_success',
        userId: user.id,
        endpoint: req.url,
        method: req.method
      });

      return result;

    } catch (error) {
      // Log Security Event
      await this.securityLogger.logEvent({
        type: 'api_failure',
        userId: error.userId,
        endpoint: req.url,
        method: req.method,
        error: error.message,
        severity: error.severity || 'medium'
      });

      throw error;
    }
  }

  async authenticate(token: string) {
    try {
      // Verify JWT
      const payload = await this.securityManager.verifyJWT(token);

      // Check if user exists
      const user = await this.securityManager.getUser(payload.userId);

      if (!user || user.disabled) {
        throw new AuthenticationError('User not found or disabled');
      }

      // Validate 2FA if enabled
      if (user.twoFactorEnabled) {
        const token2FA = req.headers['x-2fa-token'];
        const isValid2FA = await this.verify2FA(user.id, token2FA);

        if (!isValid2FA) {
          throw new AuthenticationError('2FA verification failed');
        }
      }

      return user;
    } catch (error) {
      throw new AuthenticationError('Authentication failed');
    }
  }

  async authorize(user: User, req: Request) {
    const permission = `${req.route}:${req.method.toLowerCase()}`;

    if (!this.rbac.hasPermission(user.role, permission)) {
      throw new AuthorizationError(`Insufficient permissions for ${permission}`);
    }

    // Check resource ownership if applicable
    if (req.params.id) {
      const hasAccess = await this.checkResourceAccess(user.id, req.params.id, 'read');
      if (!hasAccess) {
        throw new AuthorizationError('Access denied to this resource');
      }
    }
  }

  sanitizeInput(input: any) {
    if (typeof input === 'string') {
      return sanitizeInput(input);
    }

    if (typeof input === 'object' && input !== null) {
      return sanitizeObject(input);
    }

    return input;
  }

  extractToken(req: Request) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    return authHeader.substring(7);
  }
}

// Usage
const secureAPI = new SecureOrchestrationAPI();

// Middleware for Express
const secureMiddleware = async (req, res, next) => {
  try {
    await secureAPI.handleRequest(req);
    next();
  } catch (error) {
    res.status(401).json({
      error: error.message,
      code: error.code
    });
  }
};
```

## Security Best Practices

### Authentication
1. **Use Strong Authentication**: Implement JWT with proper expiration
2. **Multi-Factor Authentication**: Enable 2FA for all users
3. **Secure Token Storage**: Store tokens securely, use HTTP-only cookies
4. **Regular Rotation**: Rotate secrets and tokens regularly

### Authorization
1. **Principle of Least Privilege**: Grant minimum required permissions
2. **Regular Reviews**: Audit user permissions regularly
3. **Separation of Duties**: Implement proper role separation
4. **Access Logs**: Monitor all authorization decisions

### Communication Security
1. **Always Use HTTPS**: Encrypt all communications
2. **Validate All Input**: Sanitize and validate all user inputs
3. **Message Signing**: Sign all important messages
4. **Rate Limiting**: Protect against brute force attacks

### Monitoring
1. **Security Logging**: Log all security-related events
2. **Real-time Alerts**: Set up alerts for suspicious activities
3. **Regular Audits**: Conduct regular security audits
4. **Incident Response**: Have incident response procedures ready

### Configuration
1. **Secure Defaults**: Use secure configuration by default
2. **Environment Variables**: Store sensitive data in environment variables
3. **Regular Updates**: Keep all dependencies updated
4. **Backup and Recovery**: Implement proper backup and recovery procedures
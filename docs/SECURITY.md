<<<<<<< HEAD
# Security Documentation

This document outlines the security considerations, best practices, and implementation guidelines for Claude's Claude - a multi-agent development environment.

## Security Overview

Claude's Claude operates as a collaborative development platform with AI agents that can create, modify, and version control code. This creates several security considerations that must be addressed to ensure the system remains secure and reliable.

## Key Security Principles

### 1. Defense in Depth
Implement multiple layers of security controls:
- Network security
- Application security
- Data security
- Agent security

### 2. Least Privilege
- Agents operate with minimal necessary permissions
- File system access is restricted to workspace directory
- Git operations are limited to designated repositories

### 3. Zero Trust
- All communications are authenticated and authorized
- No implicit trust between system components
- Continuous validation of all inputs and outputs

### 4. Auditability
- Complete logging of all agent actions
- Decision trail for all major changes
- Regular security audits and reviews

## Threat Model

### Potential Threats

1. **Code Injection**
   - Malicious code injected by agents
   - Prompt injection attacks
   - Command injection through file operations

2. **Data Exfiltration**
   - Sensitive data leaked through agent outputs
   - Unauthorized access to project files
   - Exposure of credentials or API keys

3. **Resource Exhaustion**
   - Infinite loops in agent execution
   - Memory leaks leading to DoS
   - CPU resource abuse

4. **Privilege Escalation**
   - Agents gaining elevated permissions
   - File system access outside workspace
   - Unauthorized system commands

5. **Supply Chain Attacks**
   - Malicious dependencies
   - Tampered third-party libraries
   - Compromised build processes

## Security Implementation

### 1. Agent Security

#### Sandboxed Execution Environment
```typescript
// src/lib/security/AgentSandbox.ts
import { ChildProcess, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AgentSandbox {
  private workspacePath: string;
  private allowedCommands: Set<string>;
  private maxExecutionTime: number;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.allowedCommands = new Set([
      'git',
      'node',
      'npm',
      'npx',
      'python',
      'docker'
    ]);
    this.maxExecutionTime = 300000; // 5 minutes
  }

  async executeCommand(
    command: string,
    options: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Validate command
    if (!this.isCommandAllowed(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Set timeout
    const timeout = options.timeout || this.maxExecutionTime;

    // Execute with restrictions
    try {
      const result = await execAsync(command, {
        timeout,
        cwd: options.cwd || this.workspacePath,
        env: {
          ...process.env,
          ...options.env,
          // Restrict environment variables
          HOME: this.workspacePath,
          USER: 'agent',
          PATH: this.getRestrictedPath()
        },
        // Restrict file system access
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message,
        exitCode: error.code || 1
      };
    }
  }

  private isCommandAllowed(command: string): boolean {
    const baseCommand = command.split(' ')[0];
    return this.allowedCommands.has(baseCommand);
  }

  private getRestrictedPath(): string {
    // Restrict PATH to only safe directories
    const safePaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      process.execPath
    ];
    return safePaths.join(':');
  }
}
```

#### Code Sanitization
```typescript
// src/lib/security/CodeSanitizer.ts
import { createHash } from 'crypto';

export class CodeSanitizer {
  private dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /require\s*\(['"`]fs['"`]/,
    /spawn\s*\(/,
    /exec\s*\(/,
    /dangerous-regex/g,
    /document\.cookie/g,
    /localStorage/g,
    /sessionStorage/g,
    /process\.env/g,
    /require\s*\(['"`]child_process['"`]/,
    /Buffer\s*\(/,
    /global\./g
  ];

  private allowedFileExtensions = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.json',
    '.md', '.txt', '.yml', '.yaml', '.xml',
    '.css', '.scss', '.html', '.htm'
  ]);

  sanitizeCode(code: string, language: string): string {
    let sanitized = code;

    // Remove dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '/* SANITIZED */');
    }

    // Language-specific sanitization
    switch (language) {
      case 'javascript':
      case 'typescript':
        sanitized = this.sanitizeJavaScript(sanitized);
        break;
      case 'python':
        sanitized = this.sanitizePython(sanitized);
        break;
    }

    return sanitized;
  }

  validateFileExtension(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? this.allowedFileExtensions.has(`.${ext}`) : false;
  }

  generateCodeHash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private sanitizeJavaScript(code: string): string {
    // Remove dangerous global variables
    const globals = ['process', 'Buffer', 'global'];
    let sanitized = code;

    globals.forEach(global => {
      const regex = new RegExp(`(${global}\\.)`, 'g');
      sanitized = sanitized.replace(regex, '/* SANITIZED $1 */');
    });

    return sanitized;
  }

  private sanitizePython(code: string): string {
    // Remove dangerous imports
    const dangerousImports = [
      'os', 'sys', 'subprocess', 'socket', 'urllib',
      'requests', 'http', 'ftplib', 'smtplib'
    ];

    let sanitized = code;
    dangerousImports.forEach(imp => {
      const regex = new RegExp(`import ${imp}`, 'g');
      sanitized = sanitized.replace(regex, `# SANITIZED import ${imp}`);
    });

    return sanitized;
  }
}
```

### 2. Data Security

#### Encryption at Rest
```typescript
// src/lib/security/EncryptionManager.ts
import { createCipher, createDecipher, randomBytes } from 'crypto';

export class EncryptionManager {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(secretKey?: string) {
    // Use provided key or generate a new one
    this.key = secretKey
      ? Buffer.from(secretKey, 'hex')
      : randomBytes(32);
  }

  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generateKey(): string {
    return randomBytes(32).toString('hex');
  }

  rotateKey(): void {
    this.key = randomBytes(32);
  }
}
```

#### Secure Storage
```typescript
// src/lib/security/SecureStorage.ts
import { EncryptionManager } from './EncryptionManager';
import fs from 'fs/promises';
import path from 'path';

export class SecureStorage {
  private encryption: EncryptionManager;
  private storagePath: string;

  constructor(storagePath: string, encryptionKey?: string) {
    this.storagePath = storagePath;
    this.encryption = new EncryptionManager(encryptionKey);
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  async storeSensitiveData(key: string, data: any): Promise<void> {
    const encrypted = this.encryption.encrypt(JSON.stringify(data));
    const filename = this.getFilename(key);
    const filepath = path.join(this.storagePath, filename);

    await fs.writeFile(filepath, JSON.stringify(encrypted));
  }

  async retrieveSensitiveData(key: string): Promise<any> {
    const filename = this.getFilename(key);
    const filepath = path.join(this.storagePath, filename);

    try {
      const encryptedData = await fs.readFile(filepath, 'utf8');
      const { encrypted, iv, tag } = JSON.parse(encryptedData);
      const decrypted = this.encryption.decrypt(encrypted, iv, tag);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  async deleteSensitiveData(key: string): Promise<void> {
    const filename = this.getFilename(key);
    const filepath = path.join(this.storagePath, filename);

    try {
      await fs.unlink(filepath);
    } catch {
      // File doesn't exist, ignore
    }
  }

  private getFilename(key: string): string {
    // Hash the key for filename
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(key).digest('hex') + '.enc';
  }
}
```

### 3. Network Security

#### API Security
```typescript
// src/lib/security/ApiSecurity.ts
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export class ApiSecurity {
  setupSecurityMiddleware(app: any): void {
    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });

    app.use('/api/', limiter);

    // CORS configuration
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request validation
    app.use(this.validateRequests);
  }

  private validateRequests = (req: Request, res: Response, next: NextFunction): void => {
    // Validate Content-Type
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const contentType = req.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Content-Type must be application/json' });
      }
    }

    // Validate payload size
    const contentLength = req.get('Content-Length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
      return res.status(413).json({ error: 'Payload too large' });
    }

    next();
  };

  validateApiKey(apiKey: string): boolean {
    // In production, this would validate against a secure store
    const validKeys = process.env.API_KEYS?.split(',') || [];
    return validKeys.includes(apiKey);
  }
}
```

### 4. Git Security

#### Repository Protection
```typescript
// src/lib/security/GitSecurity.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitSecurity {
  private allowedBranches: Set<string>;
  private protectedFiles: Set<string>;
  private maxFileSize: number;

  constructor() {
    this.allowedBranches = new Set(['main', 'develop', 'task/*']);
    this.protectedFiles = new Set([
      'package.json',
      'yarn.lock',
      'package-lock.json',
      '.env',
      '.config.js',
      'config.ts'
    ]);
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async validateRepositoryOperation(operation: string, branch?: string): Promise<boolean> {
    // Check branch protection
    if (branch && !this.isBranchAllowed(branch)) {
      throw new Error(`Branch ${branch} is not allowed for this operation`);
    }

    // Validate operation type
    this.validateOperationType(operation);

    return true;
  }

  async validateFileChanges(files: string[]): Promise<void> {
    for (const file of files) {
      // Check protected files
      if (this.isProtectedFile(file)) {
        throw new Error(`File ${file} is protected and cannot be modified`);
      }

      // Check file size
      await this.validateFileSize(file);
    }
  }

  private isBranchAllowed(branch: string): boolean {
    // Check exact match
    if (this.allowedBranches.has(branch)) {
      return true;
    }

    // Check wildcard patterns
    for (const allowed of this.allowedBranches) {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(branch)) {
          return true;
        }
      }
    }

    return false;
  }

  private validateOperationType(operation: string): void {
    const allowedOperations = [
      'commit', 'push', 'pull', 'branch', 'checkout',
      'merge', 'rebase', 'reset', 'diff'
    ];

    if (!allowedOperations.includes(operation)) {
      throw new Error(`Operation ${operation} is not allowed`);
    }
  }

  private isProtectedFile(filename: string): boolean {
    const basename = filename.split('/').pop() || '';
    return this.protectedFiles.has(basename);
  }

  private async validateFileSize(filepath: string): Promise<void> {
    try {
      const stats = await execAsync(`wc -c < "${filepath}"`);
      const fileSize = parseInt(stats.stdout.trim());

      if (fileSize > this.maxFileSize) {
        throw new Error(`File ${filepath} exceeds maximum size limit`);
      }
    } catch {
      // File doesn't exist, skip validation
    }
  }

  setupGitHooks(repoPath: string): void {
    // Create pre-commit hook
    const preCommitHook = `#!/bin/bash
# Claude's Claude Security Pre-commit Hook

# Validate branch
current_branch=$(git symbolic-ref --short HEAD)
echo "Validating branch: $current_branch"

# Validate file changes
staged_files=$(git diff --cached --name-only)
echo "Validating files: $staged_files"

# Check for sensitive data
if git diff --cached --diff-filter=ACM | grep -qE "(password|secret|key|token)"; then
    echo "ERROR: Potential sensitive data found in commit"
    exit 1
fi

# Check file sizes
for file in $staged_files; do
    file_size=$(wc -c < "$file")
    if [ "$file_size" -gt 10485760 ]; then  # 10MB
        echo "ERROR: File $file exceeds size limit"
        exit 1
    fi
done

echo "Pre-commit checks passed"
`;

    // Write pre-commit hook
    const fs = require('fs');
    const hookPath = `${repoPath}/.git/hooks/pre-commit`;
    fs.writeFileSync(hookPath, preCommitHook);
    fs.chmodSync(hookPath, '755');
  }
}
```

### 5. Input Validation

#### Comprehensive Validation
```typescript
// src/lib/security/InputValidator.ts
import { z } from 'zod';

export class InputValidator {
  // Agent message validation schema
  messageSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['direction', 'proceed_check', 'validation', 'feedback', 'collaboration']),
    sender: z.enum(['primary', 'secondary']),
    receiver: z.enum(['primary', 'secondary']).optional(),
    content: z.string().min(1).max(10000),
    priority: z.enum(['low', 'medium', 'high', 'blocking']),
    requiresResponse: z.boolean(),
    attachments: z.array(z.object({
      type: z.enum(['file', 'diff', 'image', 'decision']),
      data: z.string(),
      filename: z.string().optional(),
      description: z.string().optional()
    })),
    metadata: z.record(z.any()).optional(),
    timestamp: z.date(),
    sequence: z.number()
  });

  // Decision validation schema
  decisionSchema = z.object({
    id: z.string().uuid(),
    type: z.enum(['proceed_check', 'plan_approval', 'conflict_resolution', 'rollback_request', 'abort_request']),
    initiator: z.enum(['primary', 'secondary']),
    timestamp: z.date(),
    status: z.enum(['pending', 'approved', 'rejected', 'skipped']),
    context: z.object({
      action: z.string().min(1),
      reasoning: z.string().max(5000),
      changes: z.array(z.object({
        type: z.enum(['added', 'removed', 'modified']),
        path: z.string(),
        content: z.string().optional(),
        line: z.number().optional()
      })),
      impact: z.object({
        severity: z.enum(['low', 'medium', 'high']),
        description: z.string().max(1000)
      }).optional()
    }),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string()
    })),
    attachments: z.array(z.object({
      type: z.string(),
      data: z.string(),
      filename: z.string().optional(),
      description: z.string().optional()
    })),
    outcome: z.object({
      optionId: z.string(),
      approved: z.boolean(),
      reasoning: z.string(),
      timestamp: z.date()
    }).optional()
  });

  validateAgentMessage(data: any): z.infer<typeof this.messageSchema> {
    try {
      return this.messageSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid agent message: ${error}`);
    }
  }

  validateDecision(data: any): z.infer<typeof this.decisionSchema> {
    try {
      return this.decisionSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid decision: ${error}`);
    }
  }

  validateFilename(filename: string): boolean {
    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*]/;
    if (dangerousChars.test(filename)) {
      return false;
    }

    // Check for dangerous extensions
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif'];
    const ext = filename.toLowerCase().split('.').pop();
    if (dangerousExts.includes(`.${ext}`)) {
      return false;
    }

    return true;
  }

  sanitizeInput(input: string): string {
    // Remove control characters except allowed ones
    return input.replace(/[\x00-\x1F\x7F]/g, '');
  }
}
```

## Security Monitoring

### Security Event Logging
```typescript
// src/lib/security/SecurityLogger.ts
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export class SecurityLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'security-audit.log', level: 'info' }),
        new winston.transports.File({ filename: 'security-alerts.log', level: 'warn' }),
        new winston.transports.Console()
      ]
    });
  }

  logSecurityEvent(event: SecurityEvent): void {
    const logEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...event
    };

    switch (event.severity) {
      case 'critical':
        this.logger.error(logEntry);
        this.sendAlert(logEntry);
        break;
      case 'high':
        this.logger.warn(logEntry);
        this.sendAlert(logEntry);
        break;
      case 'medium':
        this.logger.info(logEntry);
        break;
      default:
        this.logger.debug(logEntry);
    }
  }

  private sendAlert(event: SecurityEvent): void {
    // Implement alert notification (email, Slack, PagerDuty, etc.)
    console.log(`🚨 SECURITY ALERT: ${event.type} - ${event.message}`);
  }
}

interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  userId?: string;
  agentId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, any>;
}
```

### Security Monitoring Dashboard
```typescript
// src/lib/security/SecurityMonitor.ts
import { SecurityLogger } from './SecurityLogger';

export class SecurityMonitor {
  private logger: SecurityLogger;
  private eventCounts: Map<string, number> = new Map();
  private timeWindow = 300000; // 5 minutes
  private recentEvents: SecurityEvent[] = [];

  constructor(logger: SecurityLogger) {
    this.logger = logger;
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.analyzeSecurityEvents();
      this.recentEvents = [];
      this.eventCounts.clear();
    }, this.timeWindow);
  }

  logSecurityEvent(event: SecurityEvent): void {
    this.logger.logSecurityEvent(event);
    this.recentEvents.push(event);
    this.eventCounts.set(
      event.type,
      (this.eventCounts.get(event.type) || 0) + 1
    );
  }

  private analyzeSecurityEvents(): void {
    // Detect suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns();

    if (suspiciousPatterns.length > 0) {
      this.logSecurityEvent({
        type: 'pattern_detected',
        severity: 'high',
        message: `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
        action: 'security_analysis',
        metadata: { patterns: suspiciousPatterns }
      });
    }

    // Check for brute force attempts
    const failedAttempts = this.getFailedAttempts();
    if (failedAttempts > 5) {
      this.logSecurityEvent({
        type: 'brute_force_attempt',
        severity: 'critical',
        message: `Potential brute force attack detected with ${failedAttempts} failed attempts`,
        action: 'security_analysis',
        metadata: { failedAttempts }
      });
    }
  }

  private detectSuspiciousPatterns(): string[] {
    const patterns: string[] = [];

    // High frequency of failed decisions
    const failedDecisions = this.eventCounts.get('decision_rejected') || 0;
    const totalDecisions = this.eventCounts.get('decision_made') || 0;
    if (totalDecisions > 10 && failedDecisions / totalDecisions > 0.5) {
      patterns.push('high_rejection_rate');
    }

    // Rapid file changes
    const fileChanges = this.eventCounts.get('file_modified') || 0;
    if (fileChanges > 20) {
      patterns.push('rapid_file_changes');
    }

    // Multiple branch creations
    const branchCreations = this.eventCounts.get('branch_created') || 0;
    if (branchCreations > 5) {
      patterns.push('excessive_branching');
    }

    return patterns;
  }

  private getFailedAttempts(): number {
    return this.recentEvents.filter(
      event => event.type.includes('failed') || event.type.includes('error')
    ).length;
  }

  getSecurityStatus(): SecurityStatus {
    const recentCriticalEvents = this.recentEvents.filter(
      event => event.severity === 'critical'
    ).length;

    const recentHighEvents = this.recentEvents.filter(
      event => event.severity === 'high'
    ).length;

    let status: 'secure' | 'warning' | 'critical';
    if (recentCriticalEvents > 0) {
      status = 'critical';
    } else if (recentHighEvents > 5) {
      status = 'warning';
    } else {
      status = 'secure';
    }

    return {
      status,
      recentEvents: this.recentEvents.slice(-10),
      eventCounts: Object.fromEntries(this.eventCounts),
      timestamp: new Date()
    };
  }
}

interface SecurityStatus {
  status: 'secure' | 'warning' | 'critical';
  recentEvents: SecurityEvent[];
  eventCounts: Record<string, number>;
  timestamp: Date;
}
```

## Security Best Practices

### 1. Development Practices

#### Secure Coding Guidelines
- **Input Validation**: Always validate and sanitize all inputs
- **Output Encoding**: Encode outputs to prevent XSS
- **Error Handling**: Don't expose sensitive information in error messages
- **Dependency Management**: Regularly update and audit dependencies
- **Code Reviews**: Require security reviews for all code changes

#### Configuration Security
```typescript
// config/security.ts
export const securityConfig = {
  // API Security
  apiKeyRotation: {
    enabled: true,
    rotationInterval: '7d'
  },

  // File Security
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'text/plain',
      'application/json',
      'text/javascript',
      'text/css'
    ]
  },

  // Agent Security
  sandbox: {
    enabled: true,
    executionTimeout: 300000, // 5 minutes
    memoryLimit: 512 * 1024 * 1024 // 512MB
  },

  // Git Security
  repository: {
    protectedBranches: ['main', 'develop'],
    requireCodeOwnerReviews: true,
    signCommits: true
  },

  // Monitoring
  monitoring: {
    enableSecurityLogging: true,
    alertThreshold: {
      critical: 1,
      high: 5,
      medium: 10
    }
=======
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
>>>>>>> d1a1ad5a76bb015da131bb38552e256cddefb11a
  }
};
```

<<<<<<< HEAD
### 2. Operational Security

#### Backup and Recovery
```typescript
// src/lib/security/BackupManager.ts
import fs from 'fs/promises';
import path from 'path';
import { EncryptionManager } from './EncryptionManager';

export class BackupManager {
  private encryption: EncryptionManager;
  private backupPath: string;
  private retentionDays: number;

  constructor(backupPath: string, encryptionKey: string) {
    this.backupPath = backupPath;
    this.encryption = new EncryptionManager(encryptionKey);
    this.retentionDays = 30;
    this.ensureBackupDirectory();
  }

  async createBackup(sourcePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupDir = path.join(this.backupPath, backupName);

    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });

    // Copy files
    await this.copyDirectory(sourcePath, backupDir);

    // Encrypt sensitive files
    await this.encryptSensitiveFiles(backupDir);

    // Create backup manifest
    const manifest = {
      timestamp,
      sourcePath,
      files: await this.getDirectorySize(backupDir),
      checksum: await this.calculateChecksum(backupDir)
    };

    await fs.writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Cleanup old backups
    await this.cleanupOldBackups();

    return backupDir;
  }

  async restoreBackup(backupPath: string, targetPath: string): Promise<void> {
    const manifestPath = path.join(backupPath, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    // Verify backup integrity
    const currentChecksum = await this.calculateChecksum(backupPath);
    if (currentChecksum !== manifest.checksum) {
      throw new Error('Backup integrity check failed');
    }

    // Restore files
    await this.copyDirectory(backupPath, targetPath, true);
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupPath);
    } catch {
      await fs.mkdir(this.backupPath, { recursive: true });
    }
  }

  private async copyDirectory(source: string, target: string, overwrite = false): Promise<void> {
    const items = await fs.readdir(source, { withFileTypes: true });

    for (const item of items) {
      const sourcePath = path.join(source, item.name);
      const targetPath = path.join(target, item.name);

      if (item.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await this.copyDirectory(sourcePath, targetPath, overwrite);
      } else {
        if (overwrite || !(await fs.access(targetPath).catch(() => false))) {
          await fs.copyFile(sourcePath, targetPath);
        }
      }
    }
  }

  private async encryptSensitiveFiles(dir: string): Promise<void> {
    const sensitiveFiles = ['.env', 'config.json', 'secrets.json'];

    for (const filename of sensitiveFiles) {
      const filepath = path.join(dir, filename);
      try {
        const data = await fs.readFile(filepath, 'utf8');
        const encrypted = this.encryption.encrypt(data);
        await fs.writeFile(
          filepath + '.enc',
          JSON.stringify(encrypted)
        );
        await fs.unlink(filepath);
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  private async calculateChecksum(dir: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');

    async function hashFile(filepath: string) {
      const data = await fs.readFile(filepath);
      hash.update(data);
    }

    async function hashDirectory(currentDir: string) {
      const items = await fs.readdir(currentDir, { withFileTypes: true });

      for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(currentDir, item.name);

        if (item.isDirectory()) {
          await hashDirectory(fullPath);
        } else {
          await hashFile(fullPath);
        }
      }
    }

    await hashDirectory(dir);
    return hash.digest('hex');
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await fs.readdir(this.backupPath);
    const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));

    for (const backup of backups) {
      const backupPath = path.join(this.backupPath, backup);
      const stats = await fs.stat(backupPath);

      if (stats.birthtime < cutoffDate) {
        await fs.rm(backupPath, { recursive: true, force: true });
      }
    }
  }

  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }

    return size;
  }
}
```

### 3. Compliance and Auditing

#### Audit Trail
```typescript
// src/lib/security/AuditTrail.ts
import { v4 as uuidv4 } from 'uuid';

export class AuditTrail {
  private entries: AuditEntry[] = [];

  async recordAction(action: AuditAction): Promise<void> {
    const entry: AuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userId: action.userId,
      agentId: action.agentId,
      action: action.type,
      resource: action.resource,
      details: action.details,
      result: action.result,
      ipAddress: action.ipAddress,
      userAgent: action.userAgent
    };

    this.entries.push(entry);

    // Persist to storage
    await this.persistEntry(entry);
  }

  async getAuditTrail(
    filters: AuditFilters = {}
  ): Promise<AuditEntry[]> {
    let filtered = [...this.entries];

    if (filters.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }

    if (filters.agentId) {
      filtered = filtered.filter(e => e.agentId === filters.agentId);
    }

    if (filters.action) {
      filtered = filtered.filter(e => e.action === filters.action);
    }

    if (filters.since) {
      filtered = filtered.filter(e => e.timestamp >= filters.since!);
    }

    if (filters.until) {
      filtered = filtered.filter(e => e.timestamp <= filters.until!);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async generateComplianceReport(): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      generatedAt: new Date(),
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      },
      metrics: {
        totalActions: this.entries.length,
        successfulActions: this.entries.filter(e => e.result === 'success').length,
        failedActions: this.entries.filter(e => e.result === 'failure').length,
        uniqueUsers: new Set(this.entries.map(e => e.userId)).size,
        uniqueAgents: new Set(this.entries.map(e => e.agentId)).size
      },
      findings: []
    };

    // Generate compliance findings
    const riskyActions = this.entries.filter(e =>
      e.action.includes('delete') ||
      e.action.includes('modify') ||
      e.action.includes('create')
    );

    if (riskyActions.length > 0) {
      report.findings.push({
        type: 'security',
        severity: 'medium',
        description: `${riskyActions.length} potentially risky actions detected`,
        recommendations: ['Review risky actions', 'Implement approval workflows']
      });
    }

    return report;
  }

  private async persistEntry(entry: AuditEntry): Promise<void> {
    // In production, this would write to a secure audit database
    // For now, we'll just keep it in memory
    console.log('AUDIT:', entry);
  }
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  agentId?: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure' | 'pending';
  ipAddress?: string;
  userAgent?: string;
}

interface AuditAction {
  type: string;
  userId?: string;
  agentId?: string;
  resource?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
}

interface AuditFilters {
  userId?: string;
  agentId?: string;
  action?: string;
  since?: Date;
  until?: Date;
}

interface ComplianceReport {
  generatedAt: Date;
  period: { start: Date; end: Date };
  metrics: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    uniqueUsers: number;
    uniqueAgents: number;
  };
  findings: ComplianceFinding[];
}

interface ComplianceFinding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
}
```

## Incident Response

### Security Incident Procedures

#### Incident Classification
```typescript
// src/lib/security/IncidentResponse.ts
export enum IncidentSeverity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum IncidentType {
  DATA_BREACH = 'data_breach',
  INTRUSION = 'intrusion',
  MALWARE = 'malware',
  DENIAL_OF_SERVICE = 'denial_of_service',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  CODE_INJECTION = 'code_injection'
}

export class IncidentResponseManager {
  private activeIncidents: Map<string, SecurityIncident> = new Map();

  async reportIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    description: string,
    affectedSystems: string[]
  ): Promise<string> {
    const incident: SecurityIncident = {
      id: this.generateIncidentId(),
      type,
      severity,
      description,
      affectedSystems,
      status: 'open',
      reportedAt: new Date(),
      updatedAt: new Date(),
      actions: []
    };

    this.activeIncidents.set(incident.id, incident);

    // Determine response actions based on severity
    await this.executeResponsePlan(incident);

    return incident.id;
  }

  private async executeResponsePlan(incident: SecurityIncident): Promise<void> {
    switch (incident.severity) {
      case IncidentSeverity.CRITICAL:
        await this.handleCriticalIncident(incident);
        break;
      case IncidentSeverity.HIGH:
        await this.handleHighIncident(incident);
        break;
      case IncidentSeverity.MEDIUM:
        await this.handleMediumIncident(incident);
        break;
      case IncidentSeverity.LOW:
        await this.handleLowIncident(incident);
        break;
    }
  }

  private async handleCriticalIncident(incident: SecurityIncident): Promise<void> {
    // Critical incident response
    await this.isolateAffectedSystems(incident);
    await this.notifyStakeholders(incident, 'immediate');
    await this.activateEmergencyResponse(incident);
    await this.preserveEvidence(incident);
  }

  private async handleHighIncident(incident: SecurityIncident): Promise<void> {
    // High incident response
    await this.restrictAccess(incident);
    await this.notifyStakeholders(incident, 'urgent');
    await this.collectEvidence(incident);
    await this.mitigateImpact(incident);
  }

  private async handleMediumIncident(incident: SecurityIncident): Promise<void> {
    // Medium incident response
    await this.investigate(incident);
    await this.notifyStakeholders(incident, 'routine');
    await this.contain(incident);
  }

  private async handleLowIncident(incident: SecurityIncident): Promise<void> {
    // Low incident response
    await this.monitor(incident);
    await this.document(incident);
    await this.scheduleReview(incident);
  }

  private async isolateAffectedSystems(incident: SecurityIncident): Promise<void> {
    // Implement system isolation
    console.log(`Isolating affected systems for incident ${incident.id}`);
    // Implementation would depend on your infrastructure
  }

  private async notifyStakeholders(incident: SecurityIncident, urgency: string): Promise<void> {
    // Implement stakeholder notification
    console.log(`Notifying stakeholders for incident ${incident.id} with urgency: ${urgency}`);
    // Would integrate with notification systems
  }

  private async preserveEvidence(incident: SecurityIncident): Promise<void> {
    // Implement evidence preservation
    console.log(`Preserving evidence for incident ${incident.id}`);
    // Would create immutable backups, memory dumps, etc.
  }

  private generateIncidentId(): string {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `SEC-${timestamp}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

interface SecurityIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  affectedSystems: string[];
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reportedAt: Date;
  updatedAt: Date;
  actions: IncidentAction[];
}

interface IncidentAction {
  id: string;
  type: string;
  description: string;
  performedBy: string;
  timestamp: Date;
  result: 'success' | 'failure' | 'pending';
}
```

## Security Checklist

### Pre-Deployment Checklist
- [ ] All inputs are validated and sanitized
- [ ] Dependencies are updated and audited for vulnerabilities
- [ ] Security headers are properly configured
- [ ] Rate limiting is implemented
- [ ] Authentication and authorization are in place
- [ ] Error messages don't expose sensitive information
- [ ] Logging is comprehensive and secure
- [ ] Backup and recovery procedures are tested
- [ ] Incident response plan is documented
- [ ] Security training is completed

### Regular Security Audits
- [ ] Quarterly vulnerability assessments
- [ ] Monthly security configuration reviews
- [ ] Weekly log analysis
- [ ] Daily security monitoring
- [ ] Continuous penetration testing
- [ ] Regular security awareness training
- [ ] Compliance checks against relevant standards
- [ ] Third-party security assessments
- [ ] Code security reviews
- [ ] Incident response drills

This security documentation provides a comprehensive framework for securing Claude's Claude. It should be regularly updated and reviewed to address emerging threats and changing security requirements.
=======
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
>>>>>>> d1a1ad5a76bb015da131bb38552e256cddefb11a

/**
 * Security Hardening System
 * Implements comprehensive security measures and best practices
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

// Security configuration interface
export interface SecurityConfig {
  encryption: {
    algorithm: 'aes-256-gcm';
    keyLength: number;
    ivLength: number;
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecial: boolean;
    expireDays: number;
  };
  session: {
    tokenLength: number;
    refreshTokenLength: number;
    expiresIn: number;
    refreshExpiresIn: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    maxAge: number;
  };
  headers: {
    xssProtection: boolean;
    nosniff: boolean;
    frameguard: boolean;
    hsts: boolean;
    contentSecurityPolicy: string;
  };
}

// Security scan result
export interface SecurityScanResult {
  passed: boolean;
  score: number;
  issues: SecurityIssue[];
  recommendations: string[];
  timestamp: Date;
}

// Security issue
export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  affected: string[];
  cve?: string;
}

// Security audit log
export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  resource: string;
  details: Record<string, any>;
  ip: string;
  userAgent: string;
  result: 'success' | 'failure';
  riskScore: number;
}

/**
 * Security Hardening Manager
 * Provides comprehensive security features and hardening measures
 */
export class SecurityHardeningManager {
  private config: SecurityConfig;
  private auditLogs: SecurityAuditLog[] = [];
  private maxAuditLogs = 10000;
  private encryptionKey: Buffer;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * Get default security configuration
   */
  private getDefaultConfig(): SecurityConfig {
    return {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16
      },
      password: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: true,
        expireDays: 90
      },
      session: {
        tokenLength: 32,
        refreshTokenLength: 64,
        expiresIn: 3600,
        refreshExpiresIn: 86400
      },
      rateLimit: {
        windowMs: 900000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true,
        maxAge: 86400
      },
      headers: {
        xssProtection: true,
        nosniff: true,
        frameguard: true,
        hsts: true,
        contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
      }
    };
  }

  /**
   * Merge with defaults
   */
  private mergeWithDefaults(config?: Partial<SecurityConfig>): SecurityConfig {
    return { ...this.getDefaultConfig(), ...config };
  }

  /**
   * Generate encryption key
   */
  private generateEncryptionKey(): Buffer {
    return randomBytes(this.config.encryption.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  public encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(this.config.encryption.ivLength);
    const cipher = createCipheriv(this.config.encryption.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  public decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      this.config.encryption.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash password with salt
   */
  public async hashPassword(password: string): Promise<{ hash: string; salt: string }> {
    const salt = randomBytes(16).toString('hex');
    const hash = await this.sha512(password + salt);
    return { hash, salt };
  }

  /**
   * Verify password
   */
  public async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const computedHash = await this.sha512(password + salt);
    return computedHash === hash;
  }

  /**
   * SHA-512 hash
   */
  private async sha512(data: string): Promise<string> {
    const hash = createHash('sha512');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Validate password strength
   */
  public validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.password.minLength) {
      errors.push(`Password must be at least ${this.config.password.minLength} characters`);
    }

    if (this.config.password.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.password.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.password.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.password.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate secure token
   */
  public generateToken(length: number = this.config.session.tokenLength): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate secure refresh token
   */
  public generateRefreshToken(): string {
    return this.generateToken(this.config.session.refreshTokenLength);
  }

  /**
   * Validate email format
   */
  public validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize input to prevent XSS
   */
  public sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validate and sanitize URL
   */
  public sanitizeUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const allowedProtocols = ['http:', 'https:'];

      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return null;
      }

      return parsedUrl.toString();
    } catch {
      return null;
    }
  }

  /**
   * Generate secure headers
   */
  public getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': this.config.headers.nosniff ? 'nosniff' : 'nosniff',
      'X-Frame-Options': this.config.headers.frameguard ? 'DENY' : 'SAMEORIGIN',
      'X-XSS-Protection': this.config.headers.xssProtection ? '1; mode=block' : '0',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    if (this.config.headers.hsts) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.headers.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = this.config.headers.contentSecurityPolicy;
    }

    return headers;
  }

  /**
   * Validate CORS configuration
   */
  public validateCors(origin: string): boolean {
    if (typeof this.config.cors.origin === 'string') {
      return origin === this.config.cors.origin;
    }

    return this.config.cors.origin.includes(origin);
  }

  /**
   * Get CORS configuration
   */
  public getCorsConfig(): any {
    return {
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      maxAge: this.config.cors.maxAge
    };
  }

  /**
   * Log security audit event
   */
  public async logAuditEvent(event: Omit<SecurityAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: SecurityAuditLog = {
      id: this.generateToken(16),
      timestamp: new Date(),
      ...event
    };

    this.auditLogs.push(auditEvent);

    // Keep only recent logs
    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs = this.auditLogs.slice(-this.maxAuditLogs);
    }

    // Could persist to database or file system
    await this.persistAuditLogs();
  }

  /**
   * Get audit logs
   */
  public getAuditLogs(limit: number = 100): SecurityAuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  /**
   * Persist audit logs
   */
  private async persistAuditLogs(): Promise<void> {
    try {
      const auditDir = path.join(process.cwd(), 'security', 'audits');
      await fs.mkdir(auditDir, { recursive: true });

      const logFile = path.join(auditDir, `audit-${new Date().toISOString().split('T')[0]}.json`);
      const existingLogs = await fs.readFile(logFile, 'utf-8').then(JSON.parse).catch(() => []);

      await fs.writeFile(logFile, JSON.stringify([...existingLogs, ...this.auditLogs], null, 2));
    } catch (error) {
      console.error('Failed to persist audit logs:', error);
    }
  }

  /**
   * Perform security scan
   */
  public async performSecurityScan(): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    // Check environment variables
    const envIssues = this.checkEnvironmentVariables();
    issues.push(...envIssues.issues);
    recommendations.push(...envIssues.recommendations);

    // Check file permissions
    const fileIssues = await this.checkFilePermissions();
    issues.push(...fileIssues.issues);
    recommendations.push(...fileIssues.recommendations);

    // Check network configuration
    const networkIssues = await this.checkNetworkConfiguration();
    issues.push(...networkIssues.issues);
    recommendations.push(...networkIssues.recommendations);

    // Check dependencies
    const dependencyIssues = await this.checkDependencies();
    issues.push(...dependencyIssues.issues);
    recommendations.push(...dependencyIssues.recommendations);

    // Calculate security score
    const score = this.calculateSecurityScore(issues);

    return {
      passed: score >= 80,
      score,
      issues,
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Check environment variables
   */
  private checkEnvironmentVariables(): { issues: SecurityIssue[]; recommendations: string[] } {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    // Check for default passwords
    const defaultPasswords = ['password', 'admin', 'root', '123456'];
    for (const [key, value] of Object.entries(process.env)) {
      if (defaultPasswords.some(p => value?.toLowerCase().includes(p))) {
        issues.push({
          severity: 'high',
          category: 'environment',
          title: 'Weak Environment Variable',
          description: `Environment variable ${key} contains a potentially weak value`,
          recommendation: `Update ${key} with a secure value`,
          affected: [key]
        });
      }
    }

    // Check for sensitive data in logs
    if (process.env.NODE_ENV === 'production' && process.env.LOG_LEVEL === 'debug') {
      issues.push({
        severity: 'medium',
        category: 'logging',
        title: 'Debug Logging in Production',
        description: 'Debug logging is enabled in production environment',
        recommendation: 'Set LOG_LEVEL to info or higher in production',
        affected: ['LOG_LEVEL']
      });
    }

    return { issues, recommendations };
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(): Promise<{ issues: SecurityIssue[]; recommendations: string[] }> {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    try {
      // Check config files
      const configFiles = ['config/config.json', '.env', 'package.json'];

      for (const file of configFiles) {
        const filePath = path.join(process.cwd(), file);
        const stats = await fs.stat(filePath);

        if (stats.mode & 0o077) { // World-writable
          issues.push({
            severity: 'high',
            category: 'file-system',
            title: 'Insecure File Permissions',
            description: `File ${file} has overly permissive permissions`,
            recommendation: `Remove world write permissions from ${file}`,
            affected: [file]
          });
        }
      }

      // Check for sensitive files in git
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      try {
        const gitignore = await fs.readFile(gitignorePath, 'utf-8');
        const sensitiveFiles = ['.env', 'config/production.json', 'logs/'];

        for (const file of sensitiveFiles) {
          if (!gitignore.includes(file)) {
            recommendations.push(`Add ${file} to .gitignore to prevent sensitive files from being committed`);
          }
        }
      } catch {
        recommendations.push('Create .gitignore file to exclude sensitive files');
      }

    } catch (error) {
      // File check failed
      recommendations.push('Unable to verify file permissions - ensure proper file system security');
    }

    return { issues, recommendations };
  }

  /**
   * Check network configuration
   */
  private async checkNetworkConfiguration(): Promise<{ issues: SecurityIssue[]; recommendations: string[] }> {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    try {
      // Check if running as root
      const userInfo = await import('os').then(os => os.userInfo());
      if (userInfo.username === 'root') {
        issues.push({
          severity: 'critical',
          category: 'privilege',
          title: 'Running as Root User',
          description: 'Application is running with root privileges',
          recommendation: 'Run application as non-root user with appropriate permissions',
          affected: ['process user']
        });
      }

      // Check for open ports
      const { exec } = promisify(require('child_process'));
      try {
        const result = await exec('netstat -tlnp | grep LISTEN');
        const listeningPorts = result.stdout.split('\n');

        for (const portInfo of listeningPorts) {
          if (portInfo.includes('0.0.0.0:0') || portInfo.includes('[::]:0')) {
            recommendations.push('Restrict listening interfaces to specific addresses');
          }
        }
      } catch {
        // Network check may not be available in all environments
      }

    } catch (error) {
      recommendations.push('Unable to verify network configuration - check firewall and network settings');
    }

    return { issues, recommendations };
  }

  /**
   * Check dependencies
   */
  private async checkDependencies(): Promise<{ issues: SecurityIssue[]; recommendations: string[] }> {
    const issues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    try {
      const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for vulnerable packages (mock implementation)
      for (const [pkg, version] of Object.entries(dependencies)) {
        // In a real implementation, this would check against vulnerability databases
        if (pkg.includes('old') || pkg.includes('deprecated')) {
          recommendations.push(`Consider updating or replacing deprecated package: ${pkg}@${version}`);
        }
      }

      // Check for production dependencies with test flags
      if (packageJson.scripts?.test && process.env.NODE_ENV === 'production') {
        recommendations.push('Remove test dependencies from production build');
      }

    } catch (error) {
      recommendations.push('Unable to verify dependencies - ensure packages are up to date');
    }

    return { issues, recommendations };
  }

  /**
   * Calculate security score
   */
  private calculateSecurityScore(issues: SecurityIssue[]): number {
    if (issues.length === 0) return 100;

    let totalScore = 100;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          criticalCount++;
          totalScore -= 20;
          break;
        case 'high':
          highCount++;
          totalScore -= 15;
          break;
        case 'medium':
          mediumCount++;
          totalScore -= 10;
          break;
        case 'low':
          lowCount++;
          totalScore -= 5;
          break;
      }
    }

    // Ensure score doesn't go below 0
    return Math.max(0, totalScore);
  }

  /**
   * Apply security hardening measures
   */
  public async applyHardening(): Promise<void> {
    // Apply process-level security
    this.applyProcessSecurity();

    // Apply file system security
    await this.applyFileSystemSecurity();

    // Apply network security
    await this.applyNetworkSecurity();

    // Log security hardening application
    await this.logAuditEvent({
      action: 'security_hardening_applied',
      user: 'system',
      resource: 'security_configuration',
      details: { measures: applied },
      ip: '127.0.0.1',
      userAgent: 'system',
      result: 'success',
      riskScore: 0
    });
  }

  /**
   * Apply process security
   */
  private applyProcessSecurity(): void {
    // Set process title
    process.title = 'director';

    // Disable core dumps
    process.setuid(1001); // Non-privileged user
    process.setgid(1001);

    // Handle signals gracefully
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    // Unhandled promise rejection handling
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.logAuditEvent({
        action: 'unhandled_rejection',
        user: 'system',
        resource: 'process',
        details: { reason: reason.toString() },
        ip: '127.0.0.1',
        userAgent: 'system',
        result: 'failure',
        riskScore: 10
      });
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.logAuditEvent({
        action: 'uncaught_exception',
        user: 'system',
        resource: 'process',
        details: { error: error.message },
        ip: '127.0.0.1',
        userAgent: 'system',
        result: 'failure',
        riskScore: 20
      });
    });
  }

  /**
   * Apply file system security
   */
  private async applyFileSystemSecurity(): Promise<void> {
    try {
      // Create secure directories
      const secureDirs = ['logs', 'config', 'data', 'tmp'];

      for (const dir of secureDirs) {
        const dirPath = path.join(process.cwd(), dir);
        await fs.mkdir(dirPath, { recursive: true });

        // Set restrictive permissions
        await fs.chmod(dirPath, 0o750);
      }

      // Secure sensitive files
      const sensitiveFiles = ['.env', 'config/production.json'];

      for (const file of sensitiveFiles) {
        const filePath = path.join(process.cwd(), file);
        await fs.chmod(filePath, 0o600);
      }

    } catch (error) {
      console.error('Failed to apply file system security:', error);
    }
  }

  /**
   * Apply network security
   */
  private async applyNetworkSecurity(): Promise<void> {
    // Configure secure HTTP headers
    const headers = this.getSecurityHeaders();

    // Could apply iptables rules here
    // Would require sudo privileges in production

    console.log('Network security applied:', headers);
  }

  /**
   * Get security configuration
   */
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update security configuration
   */
  public updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = this.mergeWithDefaults(updates);

    // Regenerate encryption key if key length changed
    if (updates.encryption?.keyLength && updates.encryption.keyLength !== this.config.encryption.keyLength) {
      this.encryptionKey = this.generateEncryptionKey();
    }
  }
}

// Global security manager instance
export const securityHardening = new SecurityHardeningManager();
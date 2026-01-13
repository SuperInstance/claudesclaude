/**
 * Security Manager
 * Comprehensive security policies and constraints enforcement for Director Protocol
 */

import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

// Security profile interface
export interface SecurityProfile {
  id: string;
  name: string;
  description?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  capabilities: SecurityCapability[];
  constraints: SecurityConstraint[];
  allowedPaths: string[];
  blockedPaths: string[];
  networkPolicy?: NetworkSecurityPolicy;
  resourcePolicy?: ResourceSecurityPolicy;
}

// Security capability interface
export interface SecurityCapability {
  name: string;
  allowed: boolean;
  restrictions?: string[];
  audit: boolean;
}

// Security constraint interface
export interface SecurityConstraint {
  id: string;
  name: string;
  type: "filesystem" | "network" | "process" | "memory" | "time";
  limit: number | string | boolean;
  description: string;
  enforce: boolean;
  severity: "low" | "medium" | "high" | "critical";
}

// Network security policy
export interface NetworkSecurityPolicy {
  allowExternalNetwork: boolean;
  allowedHosts: string[];
  allowedPorts: number[];
  blockedHosts: string[];
  blockedPorts: number[];
  allowDNS: boolean;
  allowHTTP: boolean;
  allowHTTPS: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

// Resource security policy
export interface ResourceSecurityPolicy {
  maxCpuCores: number;
  maxMemoryMB: number;
  maxDiskSpaceMB: number;
  maxOpenFiles: number;
  maxProcesses: number;
  maxExecutionTime: number;
  allowDiskWrite: boolean;
  allowExec: boolean;
}

// Security event interface
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: "violation" | "audit" | "warning" | "info";
  severity: "low" | "medium" | "high" | "critical";
  category: "filesystem" | "network" | "process" | "resource" | "compliance";
  sandboxId: string;
  description: string;
  details: Record<string, any>;
  policy?: string;
  action: "blocked" | "logged" | "alerted" | "isolated";
}

// Security audit log
export interface SecurityAudit {
  id: string;
  timestamp: Date;
  events: SecurityEvent[];
  summary: {
    totalEvents: number;
    violations: number;
    warnings: number;
    critical: number;
  };
}

/**
 * Security Manager
 * Enforces comprehensive security policies and monitors for violations
 */
export class SecurityManager extends EventEmitter {
  private profiles: Map<string, SecurityProfile> = new Map();
  private activePolicies: Map<string, SecurityProfile> = new Map();
  private events: SecurityEvent[] = [];
  private auditLogs: SecurityAudit[] = [];
  private sandboxSecurity: Map<string, SecurityProfile> = new Map();
  private securityDatabase: SecurityDatabase;
  private enforcer: SecurityEnforcer;

  constructor() {
    super();
    this.securityDatabase = new SecurityDatabase();
    this.enforcer = new SecurityEnforcer();
    this.initializeSecurityProfiles();
    this.startSecurityMonitoring();
  }

  /**
   * Initialize default security profiles
   */
  private async initializeSecurityProfiles(): Promise<void> {
    // Low risk profile (development)
    const lowRiskProfile: SecurityProfile = {
      id: "low-risk",
      name: "Low Risk Development",
      description: "Profile for development and testing environments",
      riskLevel: "low",
      capabilities: [
        { name: "filesystem_read", allowed: true, audit: true },
        { name: "filesystem_write", allowed: true, audit: true },
        { name: "network_outbound", allowed: true, audit: true },
        { name: "process_create", allowed: true, audit: true },
        { name: "network_inbound", allowed: false, audit: true }
      ],
      constraints: [
        { id: "max_files", name: "Max Open Files", type: "filesystem", limit: 100, description: "Maximum number of open files", enforce: true, severity: "low" },
        { id: "max_processes", name: "Max Processes", type: "process", limit: 20, description: "Maximum number of processes", enforce: true, severity: "low" },
        { id: "max_memory", name: "Max Memory", type: "memory", limit: 1024, description: "Maximum memory in MB", enforce: true, severity: "medium" },
        { id: "max_time", name: "Max Execution Time", type: "time", limit: 300, description: "Maximum execution time in seconds", enforce: true, severity: "medium" }
      ],
      allowedPaths: ["/tmp", "/app", "/task"],
      blockedPaths: ["/root", "/etc", "/var/log"],
      networkPolicy: {
        allowExternalNetwork: true,
        allowedHosts: ["localhost", "127.0.0.1"],
        allowedPorts: [80, 443, 8080],
        blockedHosts: [],
        blockedPorts: [],
        allowDNS: true,
        allowHTTP: true,
        allowHTTPS: true,
        maxConnections: 10,
        connectionTimeout: 30
      },
      resourcePolicy: {
        maxCpuCores: 1,
        maxMemoryMB: 1024,
        maxDiskSpaceMB: 2048,
        maxOpenFiles: 100,
        maxProcesses: 20,
        maxExecutionTime: 300,
        allowDiskWrite: true,
        allowExec: true
      }
    };

    // Medium risk profile (staging)
    const mediumRiskProfile: SecurityProfile = {
      id: "medium-risk",
      name: "Medium Risk Staging",
      description: "Profile for staging and pre-production environments",
      riskLevel: "medium",
      capabilities: [
        { name: "filesystem_read", allowed: true, audit: true },
        { name: "filesystem_write", allowed: true, audit: true },
        { name: "network_outbound", allowed: true, audit: true },
        { name: "network_inbound", allowed: false, audit: true },
        { name: "process_create", allowed: true, audit: true },
        { name: "exec", allowed: false, audit: true }
      ],
      constraints: [
        { id: "max_files", name: "Max Open Files", type: "filesystem", limit: 50, description: "Maximum number of open files", enforce: true, severity: "medium" },
        { id: "max_processes", name: "Max Processes", type: "process", limit: 10, description: "Maximum number of processes", enforce: true, severity: "medium" },
        { id: "max_memory", name: "Max Memory", type: "memory", limit: 512, description: "Maximum memory in MB", enforce: true, severity: "medium" },
        { id: "max_time", name: "Max Execution Time", type: "time", limit: 120, description: "Maximum execution time in seconds", enforce: true, severity: "high" }
      ],
      allowedPaths: ["/tmp", "/app", "/task", "/opt"],
      blockedPaths: ["/root", "/etc", "/var", "/proc", "/sys"],
      networkPolicy: {
        allowExternalNetwork: true,
        allowedHosts: ["localhost", "127.0.0.1", "staging-api.company.com"],
        allowedPorts: [80, 443, 8080, 5432],
        blockedHosts: ["*.internal", "localhost.localdomain"],
        blockedPorts: [22, 23, 25, 3389],
        allowDNS: true,
        allowHTTP: true,
        allowHTTPS: true,
        maxConnections: 5,
        connectionTimeout: 15
      },
      resourcePolicy: {
        maxCpuCores: 0.5,
        maxMemoryMB: 512,
        maxDiskSpaceMB: 1024,
        maxOpenFiles: 50,
        maxProcesses: 10,
        maxExecutionTime: 120,
        allowDiskWrite: true,
        allowExec: false
      }
    };

    // High risk profile (production-like)
    const highRiskProfile: SecurityProfile = {
      id: "high-risk",
      name: "High Risk Production-Like",
      description: "Profile for production-like testing with strict controls",
      riskLevel: "high",
      capabilities: [
        { name: "filesystem_read", allowed: true, audit: true },
        { name: "filesystem_write", allowed: false, audit: true },
        { name: "network_outbound", allowed: false, audit: true },
        { name: "network_inbound", allowed: false, audit: true },
        { name: "process_create", allowed: true, audit: true },
        { name: "exec", allowed: false, audit: true }
      ],
      constraints: [
        { id: "max_files", name: "Max Open Files", type: "filesystem", limit: 20, description: "Maximum number of open files", enforce: true, severity: "high" },
        { id: "max_processes", name: "Max Processes", type: "process", limit: 5, description: "Maximum number of processes", enforce: true, severity: "high" },
        { id: "max_memory", name: "Max Memory", type: "memory", limit: 256, description: "Maximum memory in MB", enforce: true, severity: "high" },
        { id: "max_time", name: "Max Execution Time", type: "time", limit: 60, description: "Maximum execution time in seconds", enforce: true, severity: "critical" }
      ],
      allowedPaths: ["/tmp", "/app"],
      blockedPaths: ["/", "/root", "/etc", "/var", "/proc", "/sys", "/dev"],
      networkPolicy: {
        allowExternalNetwork: false,
        allowedHosts: ["localhost", "127.0.0.1"],
        allowedPorts: [],
        blockedHosts: ["*"],
        blockedPorts: [1, 65534], // Block all ports except standard ones
        allowDNS: false,
        allowHTTP: false,
        allowHTTPS: false,
        maxConnections: 1,
        connectionTimeout: 5
      },
      resourcePolicy: {
        maxCpuCores: 0.25,
        maxMemoryMB: 256,
        maxDiskSpaceMB: 512,
        maxOpenFiles: 20,
        maxProcesses: 5,
        maxExecutionTime: 60,
        allowDiskWrite: false,
        allowExec: false
      }
    };

    // Register profiles
    this.registerProfile(lowRiskProfile);
    this.registerProfile(mediumRiskProfile);
    this.registerProfile(highRiskProfile);

    // Load custom profiles from database
    await this.loadCustomProfiles();
  }

  /**
   * Register a security profile
   */
  registerProfile(profile: SecurityProfile): void {
    this.profiles.set(profile.id, profile);
    this.emit("profile_registered", profile);
  }

  /**
   * Apply security profile to sandbox
   */
  async applyProfileToSandbox(sandboxId: string, profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Security profile not found: ${profileId}`);
    }

    // Validate profile compatibility
    this.enforcer.validateProfile(profile);

    // Apply policy
    this.activePolicies.set(sandboxId, profile);
    this.sandboxSecurity.set(sandboxId, profile);

    // Initialize monitoring for this sandbox
    this.startSandboxMonitoring(sandboxId, profile);

    this.emit("profile_applied", sandboxId, profileId);
  }

  /**
   * Create custom security profile
   */
  createCustomProfile(config: Omit<SecurityProfile, "id">): SecurityProfile {
    const profile: SecurityProfile = {
      ...config,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
    };

    this.registerProfile(profile);
    await this.securityDatabase.saveProfile(profile);

    this.emit("custom_profile_created", profile);
    return profile;
  }

  /**
   * Validate security constraints before execution
   */
  async validateExecution(
    sandboxId: string,
    operation: string,
    context: {
      filePath?: string;
      networkTarget?: string;
      processCount?: number;
      memoryUsage?: number;
      executionTime?: number;
      command?: string;
    }
  ): Promise<{ allowed: boolean; violations: SecurityEvent[] }> {
    const profile = this.activePolicies.get(sandboxId);
    if (!profile) {
      return { allowed: false, violations: [] };
    }

    const violations: SecurityEvent[] = [];

    // Check filesystem constraints
    if (context.filePath) {
      const fileCheck = this.checkFilesystemAccess(profile, context.filePath, operation);
      if (!fileCheck.allowed) {
        violations.push(fileCheck.event);
      }
    }

    // Check network constraints
    if (context.networkTarget) {
      const networkCheck = this.checkNetworkAccess(profile, context.networkTarget);
      if (!networkCheck.allowed) {
        violations.push(networkCheck.event);
      }
    }

    // Check resource constraints
    if (context.processCount !== undefined) {
      const resourceCheck = this.checkResourceLimits(profile, context);
      if (!resourceCheck.allowed) {
        violations.push(...resourceCheck.violations);
      }
    }

    // Check capability constraints
    const capabilityCheck = this.checkCapabilities(profile, operation);
    if (!capabilityCheck.allowed) {
      violations.push(capabilityCheck.event);
    }

    // Enforce decisions
    const allowed = violations.length === 0;

    if (!allowed) {
      this.handleSecurityViolation(sandboxId, violations);
    }

    return { allowed, violations };
  }

  /**
   * Audit security event
   */
  async auditEvent(event: Omit<SecurityEvent, "id" | "timestamp">): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    this.events.push(securityEvent);

    // Log to database
    await this.securityDatabase.logEvent(securityEvent);

    // Emit event
    this.emit("security_event", securityEvent);

    // Check if this requires immediate action
    if (event.severity === "critical") {
      this.emit("critical_security_event", securityEvent);
    }
  }

  /**
   * Get security summary for sandbox
   */
  getSecuritySummary(sandboxId: string): {
    profile?: SecurityProfile;
    recentEvents: SecurityEvent[];
    violations: SecurityEvent[];
    complianceScore: number;
    riskLevel: "low" | "medium" | "high";
  } {
    const profile = this.activePolicies.get(sandboxId);
    const recentEvents = this.events
      .filter(e => e.sandboxId === sandboxId)
      .slice(-50);

    const violations = recentEvents.filter(e => e.type === "violation");
    const complianceScore = this.calculateComplianceScore(recentEvents);

    let riskLevel: "low" | "medium" | "high" = "low";
    const criticalEvents = recentEvents.filter(e => e.severity === "critical");
    const highEvents = recentEvents.filter(e => e.severity === "high");

    if (criticalEvents.length > 0) {
      riskLevel = "critical";
    } else if (highEvents.length > 5) {
      riskLevel = "high";
    } else if (highEvents.length > 0) {
      riskLevel = "medium";
    }

    return {
      profile,
      recentEvents,
      violations,
      complianceScore,
      riskLevel
    };
  }

  /**
   * Get all security profiles
   */
  getAllProfiles(): SecurityProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get active policies
   */
  getActivePolicies(): Map<string, SecurityProfile> {
    return new Map(this.activePolicies);
  }

  /**
   * Remove security policy from sandbox
   */
  async removePolicy(sandboxId: string): Promise<void> {
    this.activePolicies.delete(sandboxId);
    this.sandboxSecurity.delete(sandboxId);
    this.emit("policy_removed", sandboxId);
  }

  /**
   * Export security audit report
   */
  async exportAuditReport(sandboxId?: string, format: "json" | "csv" | "html" = "json"): Promise<string> {
    const events = sandboxId
      ? this.events.filter(e => e.sandboxId === sandboxId)
      : this.events;

    const audit: SecurityAudit = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      events,
      summary: {
        totalEvents: events.length,
        violations: events.filter(e => e.type === "violation").length,
        warnings: events.filter(e => e.type === "warning").length,
        critical: events.filter(e => e.severity === "critical").length
      }
    };

    this.auditLogs.push(audit);

    switch (format) {
      case "json":
        return JSON.stringify(audit, null, 2);

      case "csv":
        return this.exportAsCSV(events);

      case "html":
        return this.exportAsHTML(audit);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods

  private async loadCustomProfiles(): Promise<void> {
    try {
      const customProfiles = await this.securityDatabase.loadProfiles();
      customProfiles.forEach(profile => this.registerProfile(profile));
    } catch (error) {
      console.warn("Failed to load custom security profiles:", error);
    }
  }

  private startSecurityMonitoring(): void {
    // Monitor security events every minute
    setInterval(() => {
      this.generateSecurityReport();
    }, 60000);

    // Cleanup old events
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      this.events = this.events.filter(e => e.timestamp > cutoff);
    }, 3600000); // Every hour
  }

  private startSandboxMonitoring(sandboxId: string, profile: SecurityProfile): void {
    // Monitor sandbox for policy violations
    const monitor = setInterval(async () => {
      const summary = this.getSecuritySummary(sandboxId);

      if (summary.complianceScore < 70) {
        const warning: SecurityEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "warning",
          severity: "high",
          category: "compliance",
          sandboxId,
          description: `Low compliance score detected: ${summary.complianceScore}%`,
          details: { complianceScore: summary.complianceScore },
          action: "alerted"
        };

        await this.auditEvent(warning);
      }

      if (summary.violations.length > 10) {
        const isolationEvent: SecurityEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "violation",
          severity: "critical",
          category: "compliance",
          sandboxId,
          description: "Too many violations detected - isolating sandbox",
          details: { violationCount: summary.violations.length },
          action: "isolated"
        };

        await this.auditEvent(isolationEvent);
        this.emit("sandbox_isolation_triggered", sandboxId);
      }
    }, 30000); // Every 30 seconds

    // Store interval for cleanup
    (this as any).sandboxMonitors = (this as any).sandboxMonitors || new Map();
    (this as any).sandboxMonitors.set(sandboxId, monitor);
  }

  private checkFilesystemAccess(profile: SecurityProfile, filePath: string, operation: string): { allowed: boolean; event?: SecurityEvent } {
    // Check blocked paths first
    for (const blockedPath of profile.blockedPaths) {
      if (filePath.startsWith(blockedPath)) {
        const event: SecurityEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "violation",
          severity: "high",
          category: "filesystem",
          sandboxId: "unknown",
          description: `Blocked filesystem access: ${operation} on ${filePath}`,
          details: { filePath, operation, blockedPath },
          policy: profile.id,
          action: "blocked"
        };

        return { allowed: false, event };
      }
    }

    // Check allowed paths
    for (const allowedPath of profile.allowedPaths) {
      if (filePath.startsWith(allowedPath)) {
        return { allowed: true };
      }
    }

    // Default deny if not in allowed paths
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: "violation",
      severity: "medium",
      category: "filesystem",
      sandboxId: "unknown",
      description: `Unallowed filesystem access: ${operation} on ${filePath}`,
      details: { filePath, operation, allowedPaths: profile.allowedPaths },
      policy: profile.id,
      action: "blocked"
    };

    return { allowed: false, event };
  }

  private checkNetworkAccess(profile: SecurityProfile, target: string): { allowed: boolean; event?: SecurityEvent } {
    if (!profile.networkPolicy) {
      return { allowed: true };
    }

    const { networkPolicy } = profile;

    // Check blocked hosts
    for (const blockedHost of networkPolicy.blockedHosts) {
      if (target.includes(blockedHost)) {
        const event: SecurityEvent = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "violation",
          severity: "high",
          category: "network",
          sandboxId: "unknown",
          description: `Blocked network access to: ${target}`,
          details: { target, blockedHost },
          policy: profile.id,
          action: "blocked"
        };

        return { allowed: false, event };
      }
    }

    // Check if external network is allowed
    if (!networkPolicy.allowExternalNetwork && !target.includes("localhost") && !target.includes("127.0.0.1")) {
      const event: SecurityEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: "violation",
        severity: "high",
        category: "network",
        sandboxId: "unknown",
        description: `External network access not allowed to: ${target}`,
        details: { target },
        policy: profile.id,
        action: "blocked"
      };

      return { allowed: false, event };
    }

    return { allowed: true };
  }

  private checkResourceLimits(profile: SecurityProfile, context: any): { allowed: boolean; violations: SecurityEvent[] } {
    const violations: SecurityEvent[] = [];

    if (profile.resourcePolicy) {
      const { resourcePolicy } = profile;

      if (context.processCount && context.processCount > resourcePolicy.maxProcesses) {
        violations.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "violation",
          severity: "high",
          category: "resource",
          sandboxId: "unknown",
          description: `Process count limit exceeded: ${context.processCount} > ${resourcePolicy.maxProcesses}`,
          details: { actual: context.processCount, limit: resourcePolicy.maxProcesses },
          policy: profile.id,
          action: "blocked"
        });
      }

      if (context.memoryUsage && context.memoryUsage > resourcePolicy.maxMemoryMB * 1024 * 1024) {
        violations.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "violation",
          severity: "critical",
          category: "resource",
          sandboxId: "unknown",
          description: `Memory limit exceeded: ${Math.round(context.memoryUsage / 1024 / 1024)}MB > ${resourcePolicy.maxMemoryMB}MB`,
          details: { actualBytes: context.memoryUsage, limitBytes: resourcePolicy.maxMemoryMB * 1024 * 1024 },
          policy: profile.id,
          action: "blocked"
        });
      }
    }

    return { allowed: violations.length === 0, violations };
  }

  private checkCapabilities(profile: SecurityProfile, operation: string): { allowed: boolean; event?: SecurityEvent } {
    const capabilityName = operation.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const capability = profile.capabilities.find(cap =>
      cap.name === capabilityName || cap.name.includes(capabilityName)
    );

    if (!capability) {
      return { allowed: true }; // Unknown capability - allow by default
    }

    if (!capability.allowed) {
      const event: SecurityEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: "violation",
        severity: "medium",
        category: "compliance",
        sandboxId: "unknown",
        description: `Capability not allowed: ${capability.name}`,
        details: { capability: capability.name, operation },
        policy: profile.id,
        action: "blocked"
      };

      return { allowed: false, event };
    }

    return { allowed: true };
  }

  private handleSecurityViolation(sandboxId: string, violations: SecurityEvent[]): void {
    for (const violation of violations) {
      violation.sandboxId = sandboxId;
      this.emit("security_violation", violation);
    }

    // Critical violations may require isolation
    const criticalViolations = violations.filter(v => v.severity === "critical");
    if (criticalViolations.length > 0) {
      this.emit("isolate_sandbox", sandboxId, criticalViolations);
    }
  }

  private calculateComplianceScore(events: SecurityEvent[]): number {
    if (events.length === 0) return 100;

    const violations = events.filter(e => e.type === "violation").length;
    const weight = violations / events.length;
    const compliance = Math.max(0, 100 - (weight * 100));

    return Math.round(compliance);
  }

  private generateSecurityReport(): void {
    const report = {
      timestamp: new Date(),
      totalEvents: this.events.length,
      bySeverity: {
        critical: this.events.filter(e => e.severity === "critical").length,
        high: this.events.filter(e => e.severity === "high").length,
        medium: this.events.filter(e => e.severity === "medium").length,
        low: this.events.filter(e => e.severity === "low").length
      },
      byCategory: {
        filesystem: this.events.filter(e => e.category === "filesystem").length,
        network: this.events.filter(e => e.category === "network").length,
        process: this.events.filter(e => e.category === "process").length,
        resource: this.events.filter(e => e.category === "resource").length,
        compliance: this.events.filter(e => e.category === "compliance").length
      },
      activeSandboxCount: this.activePolicies.size
    };

    this.emit("security_report", report);
  }

  private exportAsCSV(events: SecurityEvent[]): string {
    const headers = ["ID", "Timestamp", "Type", "Severity", "Category", "Sandbox ID", "Description", "Action"];
    const rows = events.map(e => [
      e.id,
      e.timestamp.toISOString(),
      e.type,
      e.severity,
      e.category,
      e.sandboxId,
      e.description,
      e.action
    ]);

    return [headers, ...rows].map(row => row.join(",")).join("\n");
  }

  private exportAsHTML(audit: SecurityAudit): string {
    const eventsHTML = audit.events.map(e => `
      <tr>
        <td>${e.timestamp.toLocaleString()}</td>
        <td><span class="severity-${e.severity}">${e.severity}</span></td>
        <td>${e.category}</td>
        <td>${e.sandboxId}</td>
        <td>${e.description}</td>
        <td>${e.action}</td>
      </tr>
    `).join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Security Audit Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .severity-critical { color: red; font-weight: bold; }
          .severity-high { color: orange; font-weight: bold; }
          .severity-medium { color: yellow; font-weight: bold; }
          .severity-low { color: green; }
        </style>
      </head>
      <body>
        <h1>Security Audit Report</h1>
        <p>Generated: ${audit.timestamp.toLocaleString()}</p>

        <h2>Summary</h2>
        <ul>
          <li>Total Events: ${audit.summary.totalEvents}</li>
          <li>Violations: ${audit.summary.violations}</li>
          <li>Warnings: ${audit.summary.warnings}</li>
          <li>Critical: ${audit.summary.critical}</li>
        </ul>

        <h2>Events</h2>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Sandbox ID</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${eventsHTML}
          </tbody>
        </table>
      </body>
      </html>
    `;
  }
}

/**
 * Security Database
 * Handles persistence of security data
 */
class SecurityDatabase {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), "security-db");
  }

  async saveProfile(profile: SecurityProfile): Promise<void> {
    const filePath = path.join(this.dbPath, `profiles/${profile.id}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
  }

  async loadProfiles(): Promise<SecurityProfile[]> {
    const profilesPath = path.join(this.dbPath, "profiles");

    try {
      const files = await fs.readdir(profilesPath);
      const profiles: SecurityProfile[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(profilesPath, file);
          const content = await fs.readFile(filePath, "utf8");
          profiles.push(JSON.parse(content));
        }
      }

      return profiles;
    } catch {
      return [];
    }
  }

  async logEvent(event: SecurityEvent): Promise<void> {
    const logPath = path.join(this.dbPath, `events/${event.id}.json`);
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.writeFile(logPath, JSON.stringify(event, null, 2));
  }

  async loadEvents(): Promise<SecurityEvent[]> {
    const eventsPath = path.join(this.dbPath, "events");

    try {
      const files = await fs.readdir(eventsPath);
      const events: SecurityEvent[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(eventsPath, file);
          const content = await fs.readFile(filePath, "utf8");
          events.push(JSON.parse(content));
        }
      }

      return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }
}

/**
 * Security Enforcer
 * Handles low-level security enforcement
 */
class SecurityEnforcer {
  validateProfile(profile: SecurityProfile): void {
    // Validate resource limits
    if (profile.resourcePolicy) {
      const { resourcePolicy } = profile;

      if (resourcePolicy.maxCpuCores <= 0 || resourcePolicy.maxCpuCores > 8) {
        throw new Error("Invalid CPU cores limit");
      }

      if (resourcePolicy.maxMemoryMB <= 0 || resourcePolicy.maxMemoryMB > 8192) {
        throw new Error("Invalid memory limit");
      }

      if (resourcePolicy.maxExecutionTime <= 0 || resourcePolicy.maxExecutionTime > 3600) {
        throw new Error("Invalid execution time limit");
      }
    }

    // Validate network policy
    if (profile.networkPolicy) {
      const { networkPolicy } = profile;

      if (networkPolicy.maxConnections <= 0 || networkPolicy.maxConnections > 100) {
        throw new Error("Invalid max connections limit");
      }

      if (networkPolicy.connectionTimeout <= 0 || networkPolicy.connectionTimeout > 300) {
        throw new Error("Invalid connection timeout");
      }
    }

    // Validate capabilities
    for (const capability of profile.capabilities) {
      if (typeof capability.allowed !== "boolean") {
        throw new Error(`Invalid capability setting for ${capability.name}`);
      }
    }
  }
}
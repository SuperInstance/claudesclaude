/**
 * Container-based Sandbox System
 * Provides isolated execution environments for Director Protocol tasks
 */

import { EventEmitter } from "events";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

// Resource limit interfaces
export interface ResourceLimits {
  cpu: number; // CPU cores (1.0 = 1 core)
  memory: number; // Memory in MB
  disk: number; // Disk space in MB
  network: boolean; // Allow network access
  maxDuration: number; // Maximum execution time in seconds
}

// Security policy interface
export interface SecurityPolicy {
  allowFilesystem: boolean;
  allowNetwork: boolean;
  allowExec: boolean;
  allowedPaths: string[];
  blockedPaths: string[];
  maxProcesses: number;
  maxOpenFiles: number;
  readOnlyRoot: boolean;
  noPrivileges: boolean;
}

// Sandbox configuration
export interface SandboxConfig {
  id: string;
  name: string;
  image: string;
  command: string[];
  environment: Record<string, string>;
  resourceLimits: ResourceLimits;
  securityPolicy: SecurityPolicy;
  networkMode: "isolated" | "host" | "bridged";
  volumes: string[];
  workingDirectory: string;
  user: string;
  cleanupOnExit: boolean;
  restartPolicy: "never" | "on-failure" | "always";
}

// Sandbox state
export interface SandboxState {
  id: string;
  status: "creating" | "running" | "paused" | "stopped" | "failed" | "exited";
  containerId: string;
  pid: number;
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  resourceUsage: {
    cpuPercent: number;
    memoryBytes: number;
    networkBytesIn: number;
    networkBytesOut: number;
  };
  error?: string;
}

// Sandbox metrics
export interface SandboxMetrics {
  totalSandboxCount: number;
  activeSandboxCount: number;
  failedSandboxCount: number;
  averageExecutionTime: number;
  peakResourceUsage: {
    cpu: number;
    memory: number;
  };
  resourceUtilization: {
    totalAllocatedCpu: number;
    totalAllocatedMemory: number;
    availableCpu: number;
    availableMemory: number;
  };
}

/**
 * Container-based Sandbox Manager
 * Manages isolated execution environments for Director Protocol tasks
 */
export class SandboxManager extends EventEmitter {
  private sandboxes: Map<string, SandboxState> = new Map();
  private config: SandboxConfig;
  private dockerHost: string;
  private maxConcurrentSandbox: number;
  private resourceMonitor: ResourceMonitor;
  private securityEnforcer: SecurityEnforcer;

  constructor(config: Partial<SandboxConfig> = {}) {
    super();

    this.config = {
      id: uuidv4(),
      name: "default-sandbox",
      image: "director-sandbox",
      command: ["node"],
      environment: {},
      resourceLimits: {
        cpu: 1.0,
        memory: 512,
        disk: 1024,
        network: false,
        maxDuration: 300
      },
      securityPolicy: {
        allowFilesystem: true,
        allowNetwork: false,
        allowExec: false,
        allowedPaths: [],
        blockedPaths: [],
        maxProcesses: 10,
        maxOpenFiles: 100,
        readOnlyRoot: true,
        noPrivileges: true
      },
      networkMode: "isolated",
      volumes: [],
      workingDirectory: "/task",
      user: "sandboxuser",
      cleanupOnExit: true,
      restartPolicy: "never",
      ...config
    };

    this.dockerHost = process.env.DOCKER_HOST || "unix:///var/run/docker.sock";
    this.maxConcurrentSandbox = parseInt(process.env.MAX_CONCURRENT_SANDBOXES || "5");
    this.resourceMonitor = new ResourceMonitor();
    this.securityEnforcer = new SecurityEnforcer(this.config.securityPolicy);
  }

  /**
   * Create a new sandbox container
   */
  async createSandbox(sandboxConfig: Partial<SandboxConfig> = {}): Promise<string> {
    const config: SandboxConfig = {
      ...this.config,
      ...sandboxConfig,
      id: sandboxConfig.id || uuidv4()
    };

    // Check resource availability
    if (!this.resourceMonitor.canAllocate(config.resourceLimits)) {
      throw new Error(`Insufficient resources for sandbox ${config.id}`);
    }

    // Validate security policy
    this.securityEnforcer.validateConfig(config);

    const state: SandboxState = {
      id: config.id,
      status: "creating",
      containerId: "",
      pid: 0,
      startTime: new Date(),
      resourceUsage: {
        cpuPercent: 0,
        memoryBytes: 0,
        networkBytesIn: 0,
        networkBytesOut: 0
      }
    };

    this.sandboxes.set(config.id, state);
    this.emit("sandbox_creating", config);

    try {
      // Create Docker container
      const containerId = await this.createDockerContainer(config);
      state.containerId = containerId;

      // Start container
      await this.startDockerContainer(containerId);
      state.status = "running";

      // Start resource monitoring
      this.monitorSandbox(config.id);

      this.emit("sandbox_created", config);
      return config.id;

    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : "Unknown error";
      this.emit("sandbox_failed", config, state.error);
      throw error;
    }
  }

  /**
   * Execute a task in a sandbox
   */
  async executeInSandbox(
    taskId: string,
    command: string[],
    options: {
      environment?: Record<string, string>;
      timeout?: number;
      resourceLimits?: Partial<ResourceLimits>;
      securityPolicy?: Partial<SecurityPolicy>;
    } = {}
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const sandboxId = await this.createSandbox({
      command,
      environment: {
        ...options.environment,
        TASK_ID: taskId,
        TASK_COMMAND: command.join(" ")
      },
      resourceLimits: {
        ...this.config.resourceLimits,
        ...options.resourceLimits
      },
      securityPolicy: {
        ...this.config.securityPolicy,
        ...options.securityPolicy
      }
    });

    try {
      // Wait for container to be ready
      await this.waitForContainer(sandboxId, 10000);

      // Execute command
      const result = await this.executeCommand(sandboxId, command, {
        timeout: options.timeout || this.config.resourceLimits.maxDuration * 1000
      });

      return result;

    } finally {
      // Cleanup sandbox
      if (this.config.cleanupOnExit) {
        await this.cleanupSandbox(sandboxId);
      }
    }
  }

  /**
   * Get sandbox state
   */
  getSandboxState(sandboxId: string): SandboxState | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * List all sandboxes
   */
  getAllSandboxes(): SandboxState[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Get sandbox metrics
   */
  getMetrics(): SandboxMetrics {
    const sandboxes = this.getAllSandboxes();
    const activeSandboxes = sandboxes.filter(s => s.status === "running");
    const failedSandboxes = sandboxes.filter(s => s.status === "failed");

    const executionTimes = sandboxes
      .filter(s => s.endTime)
      .map(s => s.endTime!.getTime() - s.startTime.getTime());

    const totalCpu = sandboxes.reduce((sum, s) => sum + s.resourceUsage.cpuPercent, 0);
    const totalMemory = sandboxes.reduce((sum, s) => sum + s.resourceUsage.memoryBytes, 0);

    return {
      totalSandboxCount: sandboxes.length,
      activeSandboxCount: activeSandboxes.length,
      failedSandboxCount: failedSandboxes.length,
      averageExecutionTime: executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0,
      peakResourceUsage: {
        cpu: Math.max(...sandboxes.map(s => s.resourceUsage.cpuPercent), 0),
        memory: Math.max(...sandboxes.map(s => s.resourceUsage.memoryBytes), 0)
      },
      resourceUtilization: {
        totalAllocatedCpu: totalCpu,
        totalAllocatedMemory: totalMemory,
        availableCpu: this.resourceMonitor.getAvailableCpu(),
        availableMemory: this.resourceMonitor.getAvailableMemory()
      }
    };
  }

  /**
   * Cleanup a sandbox
   */
  async cleanupSandbox(sandboxId: string): Promise<void> {
    const state = this.sandboxes.get(sandboxId);
    if (!state) return;

    try {
      if (state.containerId) {
        await this.stopDockerContainer(state.containerId);
        await this.removeDockerContainer(state.containerId);
      }

      state.status = "stopped";
      state.endTime = new Date();
      this.sandboxes.delete(sandboxId);
      this.resourceMonitor.release(this.config.resourceLimits);

      this.emit("sandbox_cleanup", sandboxId);

    } catch (error) {
      this.emit("sandbox_cleanup_error", sandboxId, error);
    }
  }

  /**
   * Cleanup all sandboxes
   */
  async cleanupAll(): Promise<void> {
    const sandboxIds = Array.from(this.sandboxes.keys());
    await Promise.all(sandboxIds.map(id => this.cleanupSandbox(id)));
  }

  /**
   * Create Docker container
   */
  private async createDockerContainer(config: SandboxConfig): Promise<string> {
    const dockerCmd = [
      "docker", "create",
      "--name", config.id,
      "--user", config.user,
      "--workdir", config.workingDirectory,
      "--network", config.networkMode
    ];

    // Add resource limits
    if (config.resourceLimits.cpu > 0) {
      dockerCmd.push("--cpus", config.resourceLimits.cpu.toString());
    }
    if (config.resourceLimits.memory > 0) {
      dockerCmd.push("--memory", `${config.resourceLimits.memory}m`);
    }
    if (!config.resourceLimits.network) {
      dockerCmd.push("--network", "none");
    }

    // Add environment variables
    Object.entries(config.environment).forEach(([key, value]) => {
      dockerCmd.push("--env", `${key}=${value}`);
    });

    // Add volumes
    config.volumes.forEach(volume => {
      dockerCmd.push("--volume", volume);
    });

    // Add security options
    if (config.securityPolicy.readOnlyRoot) {
      dockerCmd.push("--read-only");
    }
    if (config.securityPolicy.noPrivileges) {
      dockerCmd.push("--user", "nobody:nogroup");
    }

    // Image and command
    dockerCmd.push(config.image, ...config.command);

    const result = await this.executeDockerCommand(dockerCmd);
    return result.stdout.trim();
  }

  /**
   * Start Docker container
   */
  private async startDockerContainer(containerId: string): Promise<void> {
    await this.executeDockerCommand(["docker", "start", containerId]);
  }

  /**
   * Stop Docker container
   */
  private async stopDockerContainer(containerId: string): Promise<void> {
    await this.executeDockerCommand(["docker", "stop", containerId]);
  }

  /**
   * Remove Docker container
   */
  private async removeDockerContainer(containerId: string): Promise<void> {
    await this.executeDockerCommand(["docker", "rm", "-f", containerId]);
  }

  /**
   * Execute Docker command
   */
  private async executeDockerCommand(command: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => stdout += data.toString());
      child.stderr.on("data", (data) => stderr += data.toString());

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Docker command failed with code ${code}: ${stderr}`));
        }
      });

      child.on("error", (error) => reject(error));
    });
  }

  /**
   * Execute command in sandbox
   */
  private async executeCommand(
    sandboxId: string,
    command: string[],
    options: { timeout?: number }
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const timeout = options.timeout || 30000;
    const execCmd = [
      "docker", "exec",
      sandboxId,
      ...command
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(execCmd[0], execCmd.slice(1), {
        stdio: ["pipe", "pipe", "pipe"],
        timeout
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => stdout += data.toString());
      child.stderr.on("data", (data) => stderr += data.toString());

      child.on("close", (code) => {
        resolve({ exitCode: code, stdout, stderr });
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("timeout", () => {
        child.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      });
    });
  }

  /**
   * Monitor sandbox resource usage
   */
  private monitorSandbox(sandboxId: string): void {
    const interval = setInterval(async () => {
      const state = this.sandboxes.get(sandboxId);
      if (!state || state.status !== "running") {
        clearInterval(interval);
        return;
      }

      try {
        const stats = await this.getContainerStats(sandboxId);
        state.resourceUsage = {
          cpuPercent: stats.cpuPercent || 0,
          memoryBytes: stats.memoryBytes || 0,
          networkBytesIn: stats.networkBytesIn || 0,
          networkBytesOut: stats.networkBytesOut || 0
        };

        // Check resource limits
        if (stats.cpuPercent && stats.cpuPercent > this.config.resourceLimits.cpu * 100) {
          this.emit("resource_limit_exceeded", sandboxId, "cpu");
        }

        if (stats.memoryBytes && stats.memoryBytes > this.config.resourceLimits.memory * 1024 * 1024) {
          this.emit("resource_limit_exceeded", sandboxId, "memory");
        }

        this.emit("sandbox_metrics_updated", sandboxId, state.resourceUsage);

      } catch (error) {
        // Container might have been stopped externally
        if (state.containerId) {
          state.status = "exited";
          state.exitCode = 1;
          state.endTime = new Date();
          state.error = error instanceof Error ? error.message : "Unknown error";
        }
        clearInterval(interval);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Get container stats
   */
  private async getContainerStats(sandboxId: string): Promise<{
    cpuPercent: number;
    memoryBytes: number;
    networkBytesIn: number;
    networkBytesOut: number;
  }> {
    try {
      const result = await this.executeDockerCommand([
        "docker", "stats", sandboxId, "--no-stream", "--format", "{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
      ]);

      const [cpuStr, memStr, netStr] = result.stdout.trim().split("\t");

      const cpuPercent = parseFloat(cpuStr.replace("%", ""));

      const memMatch = memStr.match(/(\d+\.\d+)[Bb]/);
      const memoryBytes = memMatch ? parseFloat(memMatch[1]) * 1024 * 1024 : 0;

      const netMatch = netStr.match(/(\d+\.\d+)[Bb]\s+(\d+\.\d+)[Bb]/);
      const networkBytesIn = netMatch ? parseFloat(netMatch[1]) * 1024 : 0;
      const networkBytesOut = netMatch ? parseFloat(netMatch[2]) * 1024 : 0;

      return { cpuPercent, memoryBytes, networkBytesIn, networkBytesOut };

    } catch {
      return { cpuPercent: 0, memoryBytes: 0, networkBytesIn: 0, networkBytesOut: 0 };
    }
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainer(sandboxId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const state = this.sandboxes.get(sandboxId);
      if (state && state.status === "running") {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Container ${sandboxId} not ready within ${timeoutMs}ms`);
  }
}

/**
 * Resource Monitor
 * Tracks and enforces system-wide resource limits
 */
class ResourceMonitor {
  private totalCpu: number;
  private totalMemory: number;
  private allocatedCpu: number = 0;
  private allocatedMemory: number = 0;

  constructor() {
    this.totalCpu = require('os').cpus().length;
    this.totalMemory = require('os').totalmem();
  }

  canAllocate(limits: ResourceLimits): boolean {
    return (
      this.allocatedCpu + limits.cpu <= this.totalCpu &&
      this.allocatedMemory + limits.memory * 1024 * 1024 <= this.totalMemory
    );
  }

  allocate(limits: ResourceLimits): void {
    if (this.canAllocate(limits)) {
      this.allocatedCpu += limits.cpu;
      this.allocatedMemory += limits.memory * 1024 * 1024;
    }
  }

  release(limits: ResourceLimits): void {
    this.allocatedCpu = Math.max(0, this.allocatedCpu - limits.cpu);
    this.allocatedMemory = Math.max(0, this.allocatedMemory - limits.memory * 1024 * 1024);
  }

  getAvailableCpu(): number {
    return this.totalCpu - this.allocatedCpu;
  }

  getAvailableMemory(): number {
    return this.totalMemory - this.allocatedMemory;
  }
}

/**
 * Security Enforcer
 * Validates and enforces security policies for sandboxes
 */
class SecurityEnforcer {
  private policy: SecurityPolicy;

  constructor(policy: SecurityPolicy) {
    this.policy = policy;
  }

  validateConfig(config: SandboxConfig): void {
    // Validate resource limits
    if (config.resourceLimits.cpu < 0 || config.resourceLimits.cpu > 8) {
      throw new Error("CPU limit must be between 0 and 8 cores");
    }

    if (config.resourceLimits.memory < 64 || config.resourceLimits.memory > 8192) {
      throw new Error("Memory limit must be between 64MB and 8GB");
    }

    // Validate security policy
    if (!this.policy.allowNetwork && config.networkMode !== "isolated") {
      throw new Error("Network access is disabled but sandbox requires network");
    }

    if (!this.policy.allowExec && config.command.length > 0) {
      throw new Error("Command execution is disabled");
    }

    // Validate volume mounts
    config.volumes.forEach(volume => {
      const [hostPath] = volume.split(":");
      if (this.policy.blockedPaths.some(path => hostPath.startsWith(path))) {
        throw new Error(`Blocked volume path: ${hostPath}`);
      }
    });
  }
}
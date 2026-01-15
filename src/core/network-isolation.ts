/**
 * Network Isolation System
 * Provides secure network isolation and traffic control for Director Protocol sandboxes
 */

import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";

// Network policy interface
export interface NetworkPolicy {
  id: string;
  name: string;
  description?: string;
  inbound: NetworkRule[];
  outbound: NetworkRule[];
  logging: boolean;
  metrics: boolean;
}

// Network rule interface
export interface NetworkRule {
  id: string;
  name?: string;
  action: "allow" | "deny" | "log";
  protocol: "tcp" | "udp" | "icmp" | "all";
  source?: string;
  sourcePort?: number | string;
  destination?: string;
  destinationPort?: number | string;
  description?: string;
  enabled: boolean;
}

// Network statistics
export interface NetworkStats {
  totalConnections: number;
  activeConnections: number;
  blockedConnections: number;
  allowedConnections: number;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  byProtocol: {
    tcp: number;
    udp: number;
    icmp: number;
  };
}

// Network interface information
export interface NetworkInterface {
  name: string;
  ip: string;
  subnet: string;
  mac: string;
  status: "up" | "down" | "unknown";
  type: "bridge" | "veth" | "loopback";
  sandboxId?: string;
}

/**
 * Network Isolation Manager
 * Manages network policies and traffic isolation for sandboxes
 */
export class NetworkIsolationManager extends EventEmitter {
  private policies: Map<string, NetworkPolicy> = new Map();
  private interfaces: Map<string, NetworkInterface> = new Map();
  private sandboxNetworks: Map<string, string> = new Map(); // sandboxId -> networkId
  private networkStats: Map<string, NetworkStats> = new Map();
  private iptablesEnabled: boolean = false;
  private dockerNetworks: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeNetworkStack();
  }

  /**
   * Initialize network infrastructure
   */
  private async initializeNetworkStack(): Promise<void> {
    try {
      // Check if iptables is available
      await this.executeCommand(["which", "iptables"]);
      this.iptablesEnabled = true;
      this.emit("iptables_available");

      // Initialize Docker networks
      await this.initializeDockerNetworks();

      // Set up base rules
      await this.setupBaseRules();

      // Start monitoring
      this.startNetworkMonitoring();

    } catch (error) {
      console.warn("Network isolation limited - iptables not available:", error);
      this.iptablesEnabled = false;
    }
  }

  /**
   * Create isolated network for sandbox
   */
  async createSandboxNetwork(sandboxId: string, options: {
    subnet?: string;
    gateway?: string;
    enableDNS?: boolean;
    internal?: boolean;
  } = {}): Promise<string> {
    const networkId = `sandbox-${sandboxId}`;
    const subnet = options.subnet || `172.30.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}/24`;
    const gateway = options.gateway || subnet.split('/')[0].replace(/\d+$/, '1');
    const enableDNS = options.enableDNS !== false;
    const internal = options.internal || true;

    const networkConfig = {
      name: networkId,
      driver: "bridge",
      internal,
      ipam: {
        driver: "default",
        config: [
          {
            subnet,
            gateway,
            ip_range: `${subnet.split('/')[0].replace(/\d+$/, '10')}/28`
          }
        ]
      },
      options: {
        "com.docker.network.bridge.enable_ip_masquerade": !internal.toString(),
        "com.docker.network.bridge.enable_icc": internal.toString()
      }
    };

    try {
      // Create Docker network
      const result = await this.executeDockerCommand([
        "docker", "network", "create",
        ...Object.entries(networkConfig.options).flatMap(([key, value]) => ["--opt", `${key}=${value}`]),
        "--subnet", subnet,
        "--gateway", gateway,
        networkId
      ]);

      const networkName = result.stdout.trim();
      this.dockerNetworks.set(networkId, { ...networkConfig, name: networkName });

      // Set up network isolation rules
      if (this.iptablesEnabled) {
        await this.setupNetworkIsolation(networkId, subnet, sandboxId);
      }

      // Create network interface
      const interfaceInfo: NetworkInterface = {
        name: networkId,
        ip: gateway,
        subnet,
        mac: "00:00:00:00:00:00", // Will be set when container connects
        status: "up",
        type: "bridge",
        sandboxId
      };

      this.interfaces.set(networkId, interfaceInfo);
      this.sandboxNetworks.set(sandboxId, networkId);
      this.networkStats.set(networkId, this.initializeNetworkStats());

      this.emit("network_created", networkId, sandboxId);
      return networkId;

    } catch (error) {
      throw new Error(`Failed to create network ${networkId}: ${error}`);
    }
  }

  /**
   * Connect sandbox to network
   */
  async connectSandboxToNetwork(sandboxId: string, networkId: string): Promise<void> {
    try {
      await this.executeDockerCommand([
        "docker", "network", "connect",
        networkId,
        sandboxId
      ]);

      // Update interface information
      const containerInfo = await this.getContainerInfo(sandboxId);
      const interfaceInfo = this.interfaces.get(networkId);
      if (interfaceInfo && containerInfo) {
        interfaceInfo.mac = containerInfo.mac_address || "00:00:00:00:00:00";
        this.interfaces.set(networkId, interfaceInfo);
      }

      this.emit("network_connected", sandboxId, networkId);

    } catch (error) {
      throw new Error(`Failed to connect sandbox ${sandboxId} to network ${networkId}: ${error}`);
    }
  }

  /**
   * Disconnect sandbox from network
   */
  async disconnectSandboxFromNetwork(sandboxId: string): Promise<void> {
    const networkId = this.sandboxNetworks.get(sandboxId);
    if (!networkId) return;

    try {
      await this.executeDockerCommand([
        "docker", "network", "disconnect",
        networkId,
        sandboxId
      ]);

      this.emit("network_disconnected", sandboxId, networkId);

    } catch (error) {
      // Network might already be disconnected
      console.warn(`Warning: failed to disconnect sandbox ${sandboxId}:`, error);
    }
  }

  /**
   * Apply network policy to sandbox
   */
  async applyNetworkPolicy(sandboxId: string, policy: NetworkPolicy): Promise<void> {
    const networkId = this.sandboxNetworks.get(sandboxId);
    if (!networkId) {
      throw new Error(`Sandbox ${sandboxId} is not connected to a network`);
    }

    this.policies.set(policy.id, policy);

    // Apply iptables rules
    if (this.iptablesEnabled) {
      await this.applyIptablesRules(networkId, policy);
    }

    this.emit("policy_applied", sandboxId, policy.id);
  }

  /**
   * Create network policy
   */
  createNetworkPolicy(config: Omit<NetworkPolicy, "id">): NetworkPolicy {
    const policy: NetworkPolicy = {
      ...config,
      id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
    };

    this.policies.set(policy.id, policy);
    this.emit("policy_created", policy);
    return policy;
  }

  /**
   * Get network policy
   */
  getNetworkPolicy(policyId: string): NetworkPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all network policies
   */
  getAllNetworkPolicies(): NetworkPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get sandbox network information
   */
  getSandboxNetwork(sandboxId: string): {
    networkId?: string;
    interface?: NetworkInterface;
    policy?: NetworkPolicy;
    stats?: NetworkStats;
  } {
    const networkId = this.sandboxNetworks.get(sandboxId);
    const interfaceInfo = networkId ? this.interfaces.get(networkId) : undefined;
    const policy = networkId ? this.getActivePolicyForNetwork(networkId) : undefined;
    const stats = networkId ? this.networkStats.get(networkId) : undefined;

    return {
      networkId,
      interface: interfaceInfo,
      policy,
      stats
    };
  }

  /**
   * Get all network interfaces
   */
  getNetworkInterfaces(): NetworkInterface[] {
    return Array.from(this.interfaces.values());
  }

  /**
   * Get network statistics
   */
  getNetworkStats(networkId?: string): NetworkStats | Map<string, NetworkStats> {
    if (networkId) {
      return this.networkStats.get(networkId) || this.initializeNetworkStats();
    }
    return new Map(this.networkStats);
  }

  /**
   * Block external network access for sandbox
   */
  async isolateSandbox(sandboxId: string): Promise<void> {
    const networkId = this.sandboxNetworks.get(sandboxId);
    if (!networkId) return;

    // Create strict isolation policy
    const isolationPolicy = this.createNetworkPolicy({
      name: "strict-isolation",
      description: "Complete network isolation for sandbox",
      inbound: [
        {
          id: "inbound-allow-loopback",
          action: "allow",
          protocol: "all",
          source: "127.0.0.1/32",
          description: "Allow loopback traffic",
          enabled: true
        }
      ],
      outbound: [
        {
          id: "outblock-all",
          action: "deny",
          protocol: "all",
          description: "Block all outbound traffic",
          enabled: true
        }
      ],
      logging: true,
      metrics: true
    });

    await this.applyNetworkPolicy(sandboxId, isolationPolicy);
    this.emit("sandbox_isolated", sandboxId);
  }

  /**
   * Allow specific network connections
   */
  async allowNetworkAccess(
    sandboxId: string,
    destinations: Array<{
      host: string;
      port?: number;
      protocol?: "tcp" | "udp";
      description?: string;
    }>
  ): Promise<void> {
    const networkId = this.sandboxNetworks.get(sandboxId);
    if (!networkId) return;

    const outboundRules = destinations.map(dest => ({
      id: `allow-${dest.host}-${dest.port || "any"}`,
      action: "allow" as const,
      protocol: dest.protocol || "tcp",
      destination: dest.host,
      destinationPort: dest.port || "any",
      description: dest.description || `Allow ${dest.protocol || "tcp"} to ${dest.host}:${dest.port || "any"}`,
      enabled: true
    }));

    const allowPolicy = this.createNetworkPolicy({
      name: "selective-allow",
      description: "Selective network access",
      inbound: [],
      outbound: outboundRules,
      logging: true,
      metrics: true
    });

    await this.applyNetworkPolicy(sandboxId, allowPolicy);
    this.emit("network_access_allowed", sandboxId, destinations);
  }

  /**
   * Clean up sandbox network
   */
  async cleanupSandboxNetwork(sandboxId: string): Promise<void> {
    const networkId = this.sandboxNetworks.get(sandboxId);
    if (!networkId) return;

    try {
      // Disconnect sandbox
      await this.disconnectSandboxFromNetwork(sandboxId);

      // Remove network
      await this.executeDockerCommand([
        "docker", "network", "rm", networkId
      ]);

      // Clean up iptables rules
      if (this.iptablesEnabled) {
        await this.cleanupIptablesRules(networkId);
      }

      // Remove from maps
      this.sandboxNetworks.delete(sandboxId);
      this.interfaces.delete(networkId);
      this.networkStats.delete(networkId);
      this.dockerNetworks.delete(networkId);

      this.emit("network_cleanup", sandboxId, networkId);

    } catch (error) {
      console.warn(`Warning: failed to cleanup network ${networkId}:`, error);
    }
  }

  /**
   * Get network topology
   */
  getNetworkTopology(): {
    sandboxes: Array<{
      id: string;
      network: string;
      interface: NetworkInterface;
    }>;
    policies: NetworkPolicy[];
    stats: Map<string, NetworkStats>;
  } {
    return {
      sandboxes: Array.from(this.sandboxNetworks.entries()).map(([sandboxId, networkId]) => ({
        id: sandboxId,
        network: networkId,
        interface: this.interfaces.get(networkId)!
      })),
      policies: this.getAllNetworkPolicies(),
      stats: this.networkStats
    };
  }

  // Private helper methods

  private async initializeDockerNetworks(): Promise<void> {
    try {
      const result = await this.executeDockerCommand(["docker", "network", "ls", "--format", "{{.Name}}\t{{.Driver}}"]);
      const networks = result.stdout.trim().split("\n").filter(line => line);

      for (const line of networks) {
        const [name, driver] = line.split("\t");
        this.dockerNetworks.set(name, { name, driver });
      }
    } catch (error) {
      console.warn("Failed to list Docker networks:", error);
    }
  }

  private async setupBaseRules(): Promise<void> {
    if (!this.iptablesEnabled) return;

    try {
      // Base rules for Docker networks
      await this.executeCommand([
        "sudo", "iptables", "-I", "DOCKER-USER", "1", "-j", "DROP"
      ]);

      // Allow established connections
      await this.executeCommand([
        "sudo", "iptables", "-A", "DOCKER-USER", "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"
      ]);

    } catch (error) {
      console.warn("Failed to setup base iptables rules:", error);
    }
  }

  private async setupNetworkIsolation(networkId: string, subnet: string, sandboxId: string): Promise<void> {
    try {
      // Create chains for network
      await this.executeCommand([
        "sudo", "iptables", "-N", `NETWORK-${networkId}`
      ]);

      // Jump to network chain
      await this.executeCommand([
        "sudo", "iptables", "-I", "DOCKER-USER", "-j", `NETWORK-${networkId}`
      ]);

      // Block all traffic by default
      await this.executeCommand([
        "sudo", "iptables", "-A", `NETWORK-${networkId}`, "-j", "DROP"
      ]);

    } catch (error) {
      console.warn(`Failed to setup network isolation for ${networkId}:`, error);
    }
  }

  private async applyIptablesRules(networkId: string, policy: NetworkPolicy): Promise<void> {
    const chainName = `NETWORK-${networkId}`;

    try {
      // Clear existing rules for this policy
      await this.executeCommand([
        "sudo", "iptables", "-F", chainName
      ]);

      // Apply inbound rules
      for (const rule of policy.inbound) {
        if (!rule.enabled) continue;

        const cmd = [
          "sudo", "iptables", "-A", chainName,
          "-p", rule.protocol,
          "-j", rule.action
        ];

        if (rule.source) {
          cmd.push("-s", rule.source);
        }

        if (rule.destination) {
          cmd.push("-d", rule.destination);
        }

        if (rule.sourcePort) {
          cmd.push("--sport", rule.sourcePort.toString());
        }

        if (rule.destinationPort) {
          cmd.push("--dport", rule.destinationPort.toString());
        }

        await this.executeCommand(cmd);
      }

      // Apply outbound rules
      for (const rule of policy.outbound) {
        if (!rule.enabled) continue;

        const cmd = [
          "sudo", "iptables", "-A", chainName,
          "-p", rule.protocol,
          "-j", rule.action
        ];

        if (rule.source) {
          cmd.push("-s", rule.source);
        }

        if (rule.destination) {
          cmd.push("-d", rule.destination);
        }

        if (rule.sourcePort) {
          cmd.push("--sport", rule.sourcePort.toString());
        }

        if (rule.destinationPort) {
          cmd.push("--dport", rule.destinationPort.toString());
        }

        await this.executeCommand(cmd);
      }

    } catch (error) {
      console.warn(`Failed to apply iptables rules for network ${networkId}:`, error);
    }
  }

  private async cleanupIptablesRules(networkId: string): Promise<void> {
    if (!this.iptablesEnabled) return;

    try {
      const chainName = `NETWORK-${networkId}`;
      await this.executeCommand([
        "sudo", "iptables", "-F", chainName
      ]);
      await this.executeCommand([
        "sudo", "iptables", "-X", chainName
      ]);
    } catch (error) {
      console.warn(`Failed to cleanup iptables rules for network ${networkId}:`, error);
    }
  }

  private async getContainerInfo(containerId: string): Promise<any> {
    try {
      const result = await this.executeDockerCommand([
        "docker", "inspect", "--format", "{{.NetworkSettings.Networks}}", containerId
      ]);
      return JSON.parse(result.stdout);
    } catch {
      return {};
    }
  }

  private getActivePolicyForNetwork(networkId: string): NetworkPolicy | undefined {
    // Find policies that are applied to this network
    return Array.from(this.policies.values()).find(policy => {
      return policy.id.includes(networkId) || policy.name.includes(networkId);
    });
  }

  private initializeNetworkStats(): NetworkStats {
    return {
      totalConnections: 0,
      activeConnections: 0,
      blockedConnections: 0,
      allowedConnections: 0,
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      byProtocol: {
        tcp: 0,
        udp: 0,
        icmp: 0
      }
    };
  }

  private startNetworkMonitoring(): void {
    // Monitor network stats every 30 seconds
    setInterval(async () => {
      for (const [networkId] of this.dockerNetworks) {
        try {
          const stats = await this.getNetworkInterfaceStats(networkId);
          this.networkStats.set(networkId, stats);
          this.emit("network_stats_updated", networkId, stats);
        } catch (error) {
          console.warn(`Failed to get stats for network ${networkId}:`, error);
        }
      }
    }, 30000);
  }

  private async getNetworkInterfaceStats(networkId: string): Promise<NetworkStats> {
    try {
      const result = await this.executeDockerCommand([
        "docker", "network", "inspect", networkId, "--format", "{{.Containers}}"
      ]);

      const containers = JSON.parse(result.stdout);
      let totalConnections = 0;
      let activeConnections = 0;

      for (const [containerId, info] of Object.entries(containers as any)) {
        totalConnections++;
        if (info.EndpointIP !== "") {
          activeConnections++;
        }
      }

      return {
        totalConnections,
        activeConnections,
        blockedConnections: 0,
        allowedConnections: activeConnections,
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        byProtocol: { tcp: 0, udp: 0, icmp: 0 }
      };

    } catch {
      return this.initializeNetworkStats();
    }
  }

  private async executeCommand(command: string[]): Promise<{ stdout: string; stderr: string }> {
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
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on("error", (error) => reject(error));
    });
  }

  private async executeDockerCommand(command: string[]): Promise<{ stdout: string; stderr: string }> {
    const fullCommand = ["docker", ...command.slice(1)];
    return this.executeCommand(fullCommand);
  }
}
import type { Session, SessionType, Message } from './types.js';
import type {
  NodeInfo,
  DistributedMessage,
  ShardingConfig,
  LoadBalancingStrategy,
  ClusterConfig
} from './distributed-types.js';
import { SimpleLRUCache } from '../utils/simple-lru-cache.js';
import { FastUUIDGenerator } from '../utils/uuid-generator.js';

export class DistributedOrchestrator {
  private config: ClusterConfig;
  private nodeCache = new SimpleLRUCache<string, NodeInfo>(100, 60 * 1000);
  private sessionCache = new SimpleLRUCache<string, Session>(2000, 30 * 60 * 1000);
  private messageQueue: DistributedMessage[] = [];
  private localSessions = new Map<string, Session>();
  private loadBalancer: LoadBalancingStrategy;
  private shardingConfig: ShardingConfig;
  private uuidGenerator = new FastUUIDGenerator();
  private isLeader = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ClusterConfig) {
    this.config = config;
    this.loadBalancer = {
      type: 'least-connections',
      healthCheckInterval: 5000
    };
    this.shardingConfig = {
      strategy: 'consistent-hashing',
      replication: config.replicationFactor,
      nodes: []
    };

    this.initializeNode();
  }

  private initializeNode(): void {
    // Register this node
    const localNode: NodeInfo = {
      id: this.config.nodeId,
      host: this.config.advertisedHost,
      port: this.config.port,
      status: 'healthy',
      sessions: 0,
      memoryUsage: 0,
      lastHeartbeat: new Date(),
      capabilities: ['session-management', 'event-handling', 'metrics']
    };

    this.nodeCache.set(this.config.nodeId, localNode);
    this.shardingConfig.nodes.push(this.config.nodeId);

    // Connect to seed nodes
    this.connectToSeeds();

    // Start health checks
    this.startHealthChecks();

    // Start message processing
    this.startMessageProcessing();
  }

  // Core distributed session management
  async createSession(config: { type: SessionType; name: string; workspace: string; config?: any }): Promise<Session> {
    const sessionId = this.uuidGenerator.generate();
    const now = new Date();

    const session: Session = {
      id: sessionId,
      type: config.type,
      name: config.name,
      workspace: config.workspace,
      config: config.config || {},
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    // Store locally
    this.localSessions.set(sessionId, session);
    this.sessionCache.set(sessionId, session);

    // Distribute to other nodes based on sharding strategy
    await this.replicateSession(session, 'create');

    // Update metrics
    this.updateNodeMetrics();

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    // Check local cache first
    let session = this.sessionCache.get(id);
    if (session) {
      return session;
    }

    // Check local storage
    session = this.localSessions.get(id);
    if (session) {
      this.sessionCache.set(id, session);
      return session;
    }

    // Query other nodes
    const targetNode = this.getShardForSession(id);
    if (targetNode && targetNode !== this.config.nodeId) {
      session = await this.queryRemoteSession(targetNode, id);
      if (session) {
        this.sessionCache.set(id, session);
      }
      return session;
    }

    return null;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const session = await this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    // Apply updates
    Object.assign(session, updates, { updatedAt: new Date() });
    this.localSessions.set(id, session);
    this.sessionCache.set(id, session);

    // Replicate to other nodes
    await this.replicateSession(session, 'update');
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.localSessions.get(id);
    if (session) {
      this.localSessions.delete(id);
      this.sessionCache.delete(id);

      // Replicate deletion
      await this.replicateSession(session, 'delete');
    }
  }

  // Sharding and load balancing
  private getShardForSession(sessionId: string): string | null {
    if (this.shardingConfig.strategy === 'consistent-hashing') {
      return this.getConsistentHashNode(sessionId);
    } else if (this.shardingConfig.strategy === 'round-robin') {
      return this.getRoundRobinNode();
    }
    return this.config.nodeId; // Default to local
  }

  private getConsistentHashNode(sessionId: string): string {
    // Simple consistent hashing implementation
    const nodes = this.getHealthyNodes();
    if (nodes.length === 0) return this.config.nodeId;

    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return nodes[Math.abs(hash) % nodes.length];
  }

  private getRoundRobinNode(): string {
    const nodes = this.getHealthyNodes();
    if (nodes.length === 0) return this.config.nodeId;

    const index = Date.now() % nodes.length;
    return nodes[index];
  }

  private getHealthyNodes(): string[] {
    const nodes: string[] = [];
    for (const [nodeId, nodeInfo] of this.nodeCache.cache.entries()) {
      if (nodeInfo.value.status === 'healthy') {
        nodes.push(nodeId);
      }
    }
    return nodes;
  }

  // Replication and synchronization
  private async replicateSession(session: Session, operation: 'create' | 'update' | 'delete'): Promise<void> {
    const nodes = this.getNodesForReplication(session.id);
    const message: DistributedMessage = {
      id: this.uuidGenerator.generate(),
      type: 'session',
      source: this.config.nodeId,
      data: { session, operation },
      timestamp: new Date()
    };

    // Send to replication nodes
    const promises = nodes
      .filter(nodeId => nodeId !== this.config.nodeId)
      .map(nodeId => this.sendMessage(nodeId, message));

    await Promise.allSettled(promises);
  }

  private getNodesForReplication(sessionId: string): string[] {
    const nodes = this.getHealthyNodes();
    if (nodes.length <= this.shardingConfig.replication) {
      return nodes;
    }

    // Select replication nodes based on consistent hashing
    const replicationNodes: string[] = [];
    const baseNode = this.getConsistentHashNode(sessionId);
    const baseIndex = nodes.indexOf(baseNode);

    for (let i = 0; i < this.shardingConfig.replication; i++) {
      const nodeIndex = (baseIndex + i) % nodes.length;
      replicationNodes.push(nodes[nodeIndex]);
    }

    return replicationNodes;
  }

  private async sendMessage(targetNode: string, message: DistributedMessage): Promise<void> {
    // Simulate network message sending
    // In a real implementation, this would use WebSocket, gRPC, or similar
    console.log(`Sending message to ${targetNode}: ${message.type}`);
  }

  private async queryRemoteSession(nodeId: string, sessionId: string): Promise<Session | null> {
    // Simulate remote query
    console.log(`Querying session ${sessionId} from node ${nodeId}`);
    return null;
  }

  // Node discovery and connection
  private async connectToSeeds(): Promise<void> {
    for (const seed of this.config.seeds) {
      try {
        const [host, port] = seed.split(':');
        const seedNodeId = `${host}:${port}`;

        if (seedNodeId !== this.config.nodeId) {
          const seedNode: NodeInfo = {
            id: seedNodeId,
            host,
            port: parseInt(port),
            status: 'healthy',
            sessions: 0,
            memoryUsage: 0,
            lastHeartbeat: new Date(),
            capabilities: ['session-management', 'event-handling', 'metrics']
          };

          this.nodeCache.set(seedNodeId, seedNode);
          this.shardingConfig.nodes.push(seedNodeId);

          // Send heartbeat to seed
          await this.sendMessage(seedNodeId, {
            id: this.uuidGenerator.generate(),
            type: 'heartbeat',
            source: this.config.nodeId,
            data: { timestamp: Date.now() },
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.warn(`Failed to connect to seed ${seed}:`, error);
      }
    }
  }

  // Health monitoring and failover
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
      this.cleanupDeadNodes();
    }, this.loadBalancer.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const nodes = this.getHealthyNodes();

    for (const nodeId of nodes) {
      if (nodeId === this.config.nodeId) continue;

      try {
        // Simulate health check
        await this.sendMessage(nodeId, {
          id: this.uuidGenerator.generate(),
          type: 'heartbeat',
          source: this.config.nodeId,
          data: { timestamp: Date.now() },
          timestamp: new Date()
        });
      } catch (error) {
        // Mark node as unhealthy
        const node = this.nodeCache.get(nodeId);
        if (node) {
          node.status = 'unhealthy';
          this.nodeCache.set(nodeId, node);
        }
      }
    }
  }

  private cleanupDeadNodes(): void {
    const now = Date.now();
    const heartbeatTimeout = this.config.heartbeatTimeout;

    for (const [nodeId, node] of this.nodeCache.cache.entries()) {
      if (now - node.value.lastHeartbeat.getTime() > heartbeatTimeout) {
        this.nodeCache.delete(nodeId);

        // Trigger rebalancing
        this.rebalanceSessions(nodeId);
      }
    }
  }

  private rebalanceSessions(deadNodeId: string): void {
    console.log(`Rebalancing sessions from dead node ${deadNodeId}`);
    // In a real implementation, this would migrate sessions to healthy nodes
  }

  // Message processing
  private startMessageProcessing(): void {
    // Process messages from queue periodically
    setInterval(() => {
      this.processMessageQueue();
    }, 16); // ~60 Hz processing
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    const batch = this.messageQueue.splice(0, 100); // Process in batches
    for (const message of batch) {
      this.handleIncomingMessage(message);
    }
  }

  private handleIncomingMessage(message: DistributedMessage): void {
    switch (message.type) {
      case 'session':
        this.handleSessionMessage(message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleSessionMessage(message: DistributedMessage): void {
    const { session, operation } = message.data;

    switch (operation) {
      case 'create':
      case 'update':
        this.sessionCache.set(session.id, session);
        if (operation === 'create') {
          this.localSessions.set(session.id, session);
        }
        break;
      case 'delete':
        this.sessionCache.delete(session.id);
        this.localSessions.delete(session.id);
        break;
    }
  }

  private handleHeartbeat(message: DistributedMessage): void {
    const { timestamp } = message.data;
    const nodeId = message.source;

    const node = this.nodeCache.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date(timestamp);
      node.status = 'healthy';
      this.nodeCache.set(nodeId, node);
    }
  }

  // Metrics and monitoring
  private updateNodeMetrics(): void {
    const localNode = this.nodeCache.get(this.config.nodeId);
    if (localNode) {
      localNode.sessions = this.localSessions.size;
      localNode.memoryUsage = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      this.nodeCache.set(this.config.nodeId, localNode);
    }
  }

  getClusterMetrics() {
    const nodes = Array.from(this.nodeCache.cache.values()).map(item => item.value);
    const totalSessions = nodes.reduce((sum, node) => sum + node.sessions, 0);
    const healthyNodes = nodes.filter(node => node.status === 'healthy').length;

    return {
      totalNodes: nodes.length,
      healthyNodes,
      totalSessions,
      averageSessionsPerNode: totalSessions / Math.max(1, healthyNodes),
      nodeDetails: nodes.map(node => ({
        id: node.id,
        status: node.status,
        sessions: node.sessions,
        memoryUsage: node.memoryUsage,
        lastHeartbeat: node.lastHeartbeat
      }))
    };
  }

  getLocalMetrics() {
    const localNode = this.nodeCache.get(this.config.nodeId);
    const sessionMetrics = {
      localSessions: this.localSessions.size,
      cachedSessions: this.sessionCache.size(),
      cacheHitRate: 0.95 // Estimated
    };

    return {
      node: localNode,
      sessions: sessionMetrics,
      cluster: this.getClusterMetrics()
    };
  }

  // Lifecycle
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Drain session to other nodes
    const sessions = Array.from(this.localSessions.values());
    for (const session of sessions) {
      await this.replicateSession(session, 'update');
    }

    this.localSessions.clear();
    this.sessionCache.clear();
    this.messageQueue = [];
  }

  // Public method for testing
  addNode(node: NodeInfo): void {
    this.nodeCache.set(node.id, node);
    if (!this.shardingConfig.nodes.includes(node.id)) {
      this.shardingConfig.nodes.push(node.id);
    }
  }
}

// Factory function
export function createDistributedOrchestrator(config: ClusterConfig) {
  return new DistributedOrchestrator(config);
}
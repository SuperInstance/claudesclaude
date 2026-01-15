import type { Session, SessionType } from './types.js';

export interface NodeInfo {
  id: string;
  host: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'draining';
  sessions: number;
  memoryUsage: number;
  lastHeartbeat: Date;
  capabilities: string[];
}

export interface ShardingConfig {
  strategy: 'hash' | 'round-robin' | 'consistent-hashing';
  replication: number;
  nodes: string[];
}

export interface DistributedMessage {
  id: string;
  type: 'session' | 'command' | 'query' | 'heartbeat' | 'sync';
  source: string;
  target?: string;
  data: any;
  timestamp: Date;
  ttl?: number;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-connections' | 'weighted' | 'consistent-hashing';
  weights?: Record<string, number>;
  healthCheckInterval: number;
}

export interface ClusterConfig {
  nodeId: string;
  advertisedHost: string;
  port: number;
  seeds: string[];
  maxSessions: number;
  replicationFactor: number;
  gossipInterval: number;
  heartbeatTimeout: number;
  syncInterval: number;
}
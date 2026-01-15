/**
 * Main Orchestration Client - The primary interface for the SDK
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { OrchestrationConfig } from '../types';
import { MessageBusClient } from './message-bus-client';
import { DatabaseClient } from './database-client';
import { WorkerClient } from './worker-client';
import { SessionClient } from './session-client';
import { CheckpointClient } from './checkpoint-client';
import { ConfigLoader, loadConfig } from '../utils/config-loader';
import { Logger } from '../utils/logger';
import { globalErrorHandler } from '../utils/error-handler';

export interface OrchestrationClientOptions {
  config?: Partial<OrchestrationConfig>;
  configPath?: string;
  logger?: Logger;
  enableMetrics?: boolean;
  traceId?: string;
}

export interface ClientMetrics {
  uptime: number;
  messagesProcessed: number;
  sessionsCreated: number;
  tasksExecuted: number;
  errors: number;
  memoryUsage: number;
  lastActivity: Date;
}

export class OrchestrationClient extends EventEmitter {
  private config: OrchestrationConfig;
  private logger: Logger;
  private messageBus?: MessageBusClient;
  private database?: DatabaseClient;
  private workerManager?: WorkerClient;
  private sessionManager?: SessionClient;
  private checkpointManager?: CheckpointClient;

  private startTime: Date;
  private metrics: ClientMetrics;
  private isShuttingDown: boolean;
  private traceId?: string;

  constructor(options: OrchestrationClientOptions = {}) {
    super();

    // Load configuration
    const configLoader = loadConfig({
      configPath: options.configPath,
      defaults: options.config
    });
    this.config = configLoader.getConfig();

    // Initialize logger
    this.logger = options.logger || new Logger(this.config.logging);

    // Initialize trace ID
    this.traceId = options.traceId || uuidv4();

    // Initialize metrics
    this.startTime = new Date();
    this.metrics = {
      uptime: 0,
      messagesProcessed: 0,
      sessionsCreated: 0,
      tasksExecuted: 0,
      errors: 0,
      memoryUsage: 0,
      lastActivity: new Date()
    };

    // Initialize clients
    this.initializeClients();

    // Set up error handling
    this.setupErrorHandling();

    // Set up metrics collection
    if (options.enableMetrics) {
      this.startMetricsCollection();
    }

    this.isShuttingDown = false;

    this.logger.info('Orchestration client initialized', { traceId: this.traceId });
  }

  private initializeClients(): void {
    try {
      // Initialize database client
      this.database = new DatabaseClient({
        config: this.config.database,
        logger: this.logger.createChildLogger({ client: 'database' })
      });

      // Initialize message bus client
      if (this.config.messageBus) {
        this.messageBus = new MessageBusClient({
          config: this.config.messageBus,
          logger: this.logger.createChildLogger({ client: 'message-bus' })
        });
      }

      // Initialize worker client
      if (this.config.workerManager) {
        this.workerManager = new WorkerClient({
          config: this.config.workerManager,
          logger: this.logger.createChildLogger({ client: 'worker' })
        });
      }

      // Initialize session client
      this.sessionManager = new SessionClient({
        database: this.database,
        logger: this.logger.createChildLogger({ client: 'session' })
      });

      // Initialize checkpoint client
      this.checkpointManager = new CheckpointClient({
        database: this.database,
        logger: this.logger.createChildLogger({ client: 'checkpoint' })
      });

      this.logger.info('All clients initialized', { traceId: this.traceId });

    } catch (error) {
      this.logger.error('Failed to initialize clients', error, { traceId: this.traceId });
      throw error;
    }
  }

  private setupErrorHandling(): void {
    // Listen for errors from all clients
    if (this.messageBus) {
      this.messageBus.on('error', (error) => {
        this.handleError(error, 'message-bus');
      });
    }

    if (this.workerManager) {
      this.workerManager.on('error', (error) => {
        this.handleError(error, 'worker');
      });
    }

    // Global error handler
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', error, { traceId: this.traceId });
      this.metrics.errors++;
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', reason, { traceId: this.traceId });
      this.metrics.errors++;
      this.emit('error', new Error(`Unhandled Promise rejection: ${reason}`));
    });
  }

  private handleError(error: any, source: string): void {
    this.logger.error(`Error from ${source}`, error, { traceId: this.traceId });
    this.metrics.errors++;
    this.emit('error', error);
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
      this.emit('metrics', this.metrics);
    }, this.config.monitoring?.metricsInterval || 10000);

    this.logger.debug('Metrics collection started', { traceId: this.traceId });
  }

  private updateMetrics(): void {
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;

    // Update last activity
    this.metrics.lastActivity = new Date();
  }

  // Public methods

  /**
   * Get the current configuration
   */
  getConfig(): OrchestrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<OrchestrationConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };

    // Update clients that can be updated dynamically
    if (this.messageBus && updates.messageBus) {
      await this.messageBus.updateConfig(updates.messageBus);
    }

    if (this.workerManager && updates.workerManager) {
      await this.workerManager.updateConfig(updates.workerManager);
    }

    this.logger.info('Configuration updated', { traceId: this.traceId });
  }

  /**
   * Get client metrics
   */
  getMetrics(): ClientMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
    timestamp: Date;
  }> {
    const results = {
      database: await this.checkDatabaseHealth(),
      messageBus: this.messageBus ? await this.checkMessageBusHealth() : { status: 'not-configured' },
      workerManager: this.workerManager ? await this.checkWorkerHealth() : { status: 'not-configured' },
      memory: this.checkMemoryHealth(),
      uptime: this.uptime
    };

    const healthyCount = Object.values(results).filter(r => r.status === 'healthy').length;
    const totalChecks = Object.keys(results).length;

    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
      healthyCount === totalChecks ? 'healthy' :
      healthyCount >= totalChecks * 0.7 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      details: results,
      timestamp: new Date()
    };
  }

  private async checkDatabaseHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
    try {
      await this.database?.ping();
      return { status: 'healthy' };
    } catch (error) {
      this.logger.warn('Database health check failed', error, { traceId: this.traceId });
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  private async checkMessageBusHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
    try {
      const stats = await this.messageBus?.getStats();
      return {
        status: stats?.queueSize > this.config.messageBus?.maxQueueSize! * 0.8 ? 'degraded' : 'healthy',
        details: stats
      };
    } catch (error) {
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  private async checkWorkerHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: any }> {
    try {
      const metrics = await this.workerManager?.getMetrics();
      return {
        status: metrics?.unhealthyWorkers && metrics.unhealthyWorkers > 0 ? 'degraded' : 'healthy',
        details: metrics
      };
    } catch (error) {
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  private checkMemoryHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; details?: any } {
    const memoryUsage = process.memoryUsage();
    const heapUsage = memoryUsage.heapUsed / memoryUsage.heapLimit;

    return {
      status: heapUsage > 0.9 ? 'unhealthy' : heapUsage > 0.7 ? 'degraded' : 'healthy',
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapLimit: memoryUsage.heapLimit,
        heapUsagePercentage: heapUsage
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress', { traceId: this.traceId });
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Starting graceful shutdown', { traceId: this.traceId });

    try {
      // Shutdown workers first
      if (this.workerManager) {
        await this.workerManager.shutdown();
        this.logger.info('Worker manager shutdown complete', { traceId: this.traceId });
      }

      // Shutdown message bus
      if (this.messageBus) {
        await this.messageBus.shutdown();
        this.logger.info('Message bus shutdown complete', { traceId: this.traceId });
      }

      // Close database connection
      if (this.database) {
        await this.database.close();
        this.logger.info('Database connection closed', { traceId: this.traceId });
      }

      this.logger.info('Graceful shutdown complete', { traceId: this.traceId });
      this.emit('shutdown');

    } catch (error) {
      this.logger.error('Error during shutdown', error, { traceId: this.traceId });
      throw error;
    }
  }

  // Delegated properties to make client usage convenient

  get messageBus() {
    return this.messageBus;
  }

  get database() {
    return this.database;
  }

  get workerManager() {
    return this.workerManager;
  }

  get sessions() {
    return this.sessionManager;
  }

  get checkpoints() {
    return this.checkpointManager;
  }

  get uptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  // Static factory methods

  static async create(options: OrchestrationClientOptions = {}): Promise<OrchestrationClient> {
    const client = new OrchestrationClient(options);

    // Wait for clients to be ready
    await client.waitForReady();

    return client;
  }

  private async waitForReady(): Promise<void> {
    const maxWaitTime = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const health = await this.healthCheck();
      if (health.status !== 'unhealthy') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Client failed to become ready within timeout');
  }
}

// Export default
export default OrchestrationClient;

// Export types and interfaces
export type { OrchestrationClientOptions, ClientMetrics };
export { MessageBusClient, DatabaseClient, WorkerClient, SessionClient, CheckpointClient } from './index';
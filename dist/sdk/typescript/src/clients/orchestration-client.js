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
import { UnifiedMemoryManager } from '../utils/memory-manager';
import { MemoryManagerOptions } from '../utils/memory-manager';
export class OrchestrationClient extends EventEmitter {
    config;
    logger;
    messageBus;
    database;
    workerManager;
    sessionManager;
    checkpointManager;
    memoryManager;
    startTime;
    metrics;
    isShuttingDown;
    traceId;
    constructor(options = {}) {
        super();
        const configLoader = loadConfig({
            configPath: options.configPath,
            defaults: options.config
        });
        this.config = configLoader.getConfig();
        this.logger = options.logger || new Logger(this.config.logging);
        this.traceId = options.traceId || uuidv4();
        this.startTime = new Date();
        this.metrics = {
            uptime: 0,
            messagesProcessed: 0,
            sessionsCreated: 0,
            tasksExecuted: 0,
            errors: 0,
            memoryUsage: 0,
            memoryPressureEvents: 0,
            cacheStats: {
                sessionCache: {},
                contextCache: {},
                eventManager: {}
            },
            lastActivity: new Date()
        };
        this.memoryManager = new UnifiedMemoryManager(options.memoryManagerOptions);
        this.setupMemoryMonitoring();
        this.initializeClients();
        this.setupErrorHandling();
        if (options.enableMetrics) {
            this.startMetricsCollection();
        }
        this.isShuttingDown = false;
        this.logger.info('Orchestration client initialized', { traceId: this.traceId });
    }
    initializeClients() {
        try {
            this.database = new DatabaseClient({
                config: this.config.database,
                logger: this.logger.createChildLogger({ client: 'database' })
            });
            if (this.config.messageBus) {
                this.messageBus = new MessageBusClient({
                    config: this.config.messageBus,
                    logger: this.logger.createChildLogger({ client: 'message-bus' })
                });
            }
            if (this.config.workerManager) {
                this.workerManager = new WorkerClient({
                    config: this.config.workerManager,
                    logger: this.logger.createChildLogger({ client: 'worker' })
                });
            }
            this.sessionManager = new SessionClient({
                database: this.database,
                logger: this.logger.createChildLogger({ client: 'session' })
            });
            this.checkpointManager = new CheckpointClient({
                database: this.database,
                logger: this.logger.createChildLogger({ client: 'checkpoint' })
            });
            this.logger.info('All clients initialized', { traceId: this.traceId });
        }
        catch (error) {
            this.logger.error('Failed to initialize clients', error, { traceId: this.traceId });
            throw error;
        }
    }
    setupErrorHandling() {
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
    handleError(error, source) {
        this.logger.error(`Error from ${source}`, error, { traceId: this.traceId });
        this.metrics.errors++;
        this.emit('error', error);
    }
    startMetricsCollection() {
        setInterval(() => {
            this.updateMetrics();
            this.emit('metrics', this.metrics);
        }, this.config.monitoring?.metricsInterval || 10000);
        this.logger.debug('Metrics collection started', { traceId: this.traceId });
    }
    updateMetrics() {
        this.metrics.uptime = Date.now() - this.startTime.getTime();
        if (this.memoryManager) {
            const memoryMetrics = this.memoryManager.getMetrics();
            this.metrics.memoryUsage = memoryMetrics.totalMemoryUsage;
            this.metrics.memoryPressureEvents = memoryMetrics.memoryPressureEvents;
        }
        else {
            this.metrics.memoryUsage = process.memoryUsage().heapUsed;
        }
        this.metrics.lastActivity = new Date();
    }
    getConfig() {
        return { ...this.config };
    }
    setupMemoryMonitoring() {
        if (!this.memoryManager)
            return;
        this.memoryManager.on('memoryPressure', (memorySummary) => {
            this.logger.warn('Memory pressure detected', memorySummary, { traceId: this.traceId });
            this.metrics.memoryPressureEvents++;
            this.emit('memoryPressure', memorySummary);
        });
        this.memoryManager.on('memoryUsage', (metrics) => {
            this.updateMetrics();
        });
        setInterval(() => {
            if (this.memoryManager) {
                this.memoryManager.optimizeMemory();
            }
        }, 300000);
    }
    async updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (this.messageBus && updates.messageBus) {
            await this.messageBus.updateConfig(updates.messageBus);
        }
        if (this.workerManager && updates.workerManager) {
            await this.workerManager.updateConfig(updates.workerManager);
        }
        this.logger.info('Configuration updated', { traceId: this.traceId });
    }
    getMetrics() {
        if (this.memoryManager) {
            const memoryMetrics = this.memoryManager.getMetrics();
            const memorySummary = this.memoryManager.getMemorySummary();
            const cacheStats = this.memoryManager.getCacheStatistics();
            this.metrics.memoryUsage = memoryMetrics.totalMemoryUsage;
            this.metrics.memoryPressureEvents = memoryMetrics.memoryPressureEvents;
            this.metrics.cacheStats = cacheStats;
        }
        this.metrics.lastActivity = new Date();
        return { ...this.metrics };
    }
    updateMemorySettings(settings) {
        if (this.memoryManager) {
            this.memoryManager.updateMemorySettings(settings);
            this.logger.info('Memory settings updated', { traceId: this.traceId });
        }
    }
    getMemorySummary() {
        return this.memoryManager?.getMemorySummary();
    }
    async forceMemoryCleanup() {
        if (this.memoryManager) {
            await this.memoryManager.forceCleanup();
            this.logger.info('Memory cleanup completed', { traceId: this.traceId });
        }
    }
    async healthCheck() {
        const results = {
            database: await this.checkDatabaseHealth(),
            messageBus: this.messageBus ? await this.checkMessageBusHealth() : { status: 'not-configured' },
            workerManager: this.workerManager ? await this.checkWorkerHealth() : { status: 'not-configured' },
            memory: this.checkMemoryHealth(),
            uptime: this.uptime
        };
        const healthyCount = Object.values(results).filter(r => r.status === 'healthy').length;
        const totalChecks = Object.keys(results).length;
        const overallStatus = healthyCount === totalChecks ? 'healthy' :
            healthyCount >= totalChecks * 0.7 ? 'degraded' : 'unhealthy';
        return {
            status: overallStatus,
            details: results,
            timestamp: new Date()
        };
    }
    async checkDatabaseHealth() {
        try {
            await this.database?.ping();
            return { status: 'healthy' };
        }
        catch (error) {
            this.logger.warn('Database health check failed', error, { traceId: this.traceId });
            return { status: 'unhealthy', details: { error: error.message } };
        }
    }
    async checkMessageBusHealth() {
        try {
            const stats = await this.messageBus?.getStats();
            return {
                status: stats?.queueSize > this.config.messageBus?.maxQueueSize * 0.8 ? 'degraded' : 'healthy',
                details: stats
            };
        }
        catch (error) {
            return { status: 'unhealthy', details: { error: error.message } };
        }
    }
    async checkWorkerHealth() {
        try {
            const metrics = await this.workerManager?.getMetrics();
            return {
                status: metrics?.unhealthyWorkers && metrics.unhealthyWorkers > 0 ? 'degraded' : 'healthy',
                details: metrics
            };
        }
        catch (error) {
            return { status: 'unhealthy', details: { error: error.message } };
        }
    }
    checkMemoryHealth() {
        if (!this.memoryManager) {
            const memoryUsage = process.memoryUsage();
            const heapUsage = memoryUsage.heapUsed / memoryUsage.heapLimit;
            return {
                status: heapUsage > 0.9 ? 'unhealthy' : heapUsage > 0.7 ? 'degraded' : 'healthy',
                details: {
                    heapUsed: memoryUsage.heapUsed,
                    heapLimit: memoryUsage.heapLimit,
                    heapUsagePercentage: heapUsage,
                    managerStatus: 'not-available'
                }
            };
        }
        const memorySummary = this.memoryManager.getMemorySummary();
        const heapUsage = memorySummary.heapUsagePercentage;
        let status = 'healthy';
        let details = {
            heapUsed: memorySummary.heapUsage,
            heapLimit: memorySummary.heapLimit,
            heapUsagePercentage: heapUsage,
            cacheSizes: memorySummary.cacheSizes,
            memoryPressure: memorySummary.memoryPressure,
            managerStatus: 'active'
        };
        if (heapUsage > 0.9) {
            status = 'unhealthy';
            details.alert = 'Critical memory pressure';
        }
        else if (heapUsage > 0.7) {
            status = 'degraded';
            details.alert = 'Elevated memory usage';
        }
        if (memorySummary.memoryPressure) {
            details.alert = 'Memory pressure detected';
            this.emit('memoryPressure', memorySummary);
        }
        return { status, details };
    }
    async shutdown() {
        if (this.isShuttingDown) {
            this.logger.warn('Shutdown already in progress', { traceId: this.traceId });
            return;
        }
        this.isShuttingDown = true;
        this.logger.info('Starting graceful shutdown', { traceId: this.traceId });
        try {
            if (this.memoryManager) {
                await this.memoryManager.shutdown();
                this.logger.info('Memory manager shutdown complete', { traceId: this.traceId });
            }
            if (this.workerManager) {
                await this.workerManager.shutdown();
                this.logger.info('Worker manager shutdown complete', { traceId: this.traceId });
            }
            if (this.messageBus) {
                await this.messageBus.shutdown();
                this.logger.info('Message bus shutdown complete', { traceId: this.traceId });
            }
            if (this.database) {
                await this.database.close();
                this.logger.info('Database connection closed', { traceId: this.traceId });
            }
            this.logger.info('Graceful shutdown complete', { traceId: this.traceId });
            this.emit('shutdown');
        }
        catch (error) {
            this.logger.error('Error during shutdown', error, { traceId: this.traceId });
            throw error;
        }
    }
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
    get memory() {
        return this.memoryManager;
    }
    get uptime() {
        return Date.now() - this.startTime.getTime();
    }
    static async create(options = {}) {
        const client = new OrchestrationClient(options);
        await client.waitForReady();
        return client;
    }
    async waitForReady() {
        const maxWaitTime = 10000;
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
export default OrchestrationClient;
export { MessageBusClient, DatabaseClient, WorkerClient, SessionClient, CheckpointClient } from './index';
//# sourceMappingURL=orchestration-client.js.map
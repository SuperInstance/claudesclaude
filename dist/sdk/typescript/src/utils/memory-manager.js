import { EventEmitter } from 'events';
import { Logger } from './simple-logger';
import { SimpleLRUCache, MemoryMetrics as CacheMetrics } from './simple-lru-cache';
import { OptimizedSessionManager, SessionManagerMetrics } from './session-manager';
import { OptimizedEventManager, EventManagerMetrics } from './event-manager';
export class UnifiedMemoryManager extends EventEmitter {
    logger;
    options;
    sessionCache;
    contextCache;
    sessionManager;
    eventManager;
    memoryMetrics;
    memoryCheckInterval = null;
    weakReferenceCleanupInterval = null;
    constructor(options = {}) {
        super();
        this.options = {
            logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
            enableMemoryMonitoring: options.enableMemoryMonitoring !== false,
            memoryCheckIntervalMs: options.memoryCheckIntervalMs || 30000,
            memoryPressureThreshold: options.memoryPressureThreshold || 0.8,
            enableAutoOptimization: options.enableAutoOptimization !== false,
            enableWeakReferences: options.enableWeakReferences !== false,
            maxSessions: options.maxSessions || 1000,
            maxContexts: options.maxContexts || 5000,
            maxEvents: options.maxEvents || 10000
        };
        this.logger = this.options.logger.createChildLogger({ component: 'memory-manager' });
        this.sessionCache = new SimpleLRUCache({
            max: this.options.maxSessions,
            ttl: 30 * 60 * 1000,
            maxMemoryBytes: 50 * 1024 * 1024,
            updateAgeOnGet: true
        });
        this.contextCache = new SimpleLRUCache({
            max: this.options.maxContexts,
            ttl: 15 * 60 * 1000,
            maxMemoryBytes: 100 * 1024 * 1024,
            updateAgeOnGet: true
        });
        this.sessionManager = new OptimizedSessionManager({
            logger: this.logger.createChildLogger({ component: 'session-manager' }),
            maxSessions: this.options.maxSessions,
            sessionTTL: 30 * 60 * 1000,
            enableWeakReferences: this.options.enableWeakReferences
        });
        this.eventManager = new OptimizedEventManager({
            logger: this.logger.createChildLogger({ component: 'event-manager' }),
            enableWeakReferences: this.options.enableWeakReferences,
            maxSubscriptions: this.options.maxEvents,
            enableAutoCleanup: true,
            cleanupIntervalMs: 300000
        });
        this.memoryMetrics = {
            totalMemoryUsage: 0,
            heapUsage: 0,
            heapLimit: 0,
            heapUsagePercentage: 0,
            sessionCache: this.sessionCache.getMemoryMetrics(),
            contextCache: this.contextCache.getMemoryMetrics(),
            sessionManager: this.sessionManager.getMetrics(),
            eventManager: this.eventManager.getMetrics(),
            evictions: 0,
            cleanups: 0,
            memoryPressureEvents: 0
        };
        this.setupEventHandlers();
        this.initializeMemoryMonitoring();
    }
    getMetrics() {
        const memoryUsage = process.memoryUsage();
        const now = Date.now();
        this.memoryMetrics = {
            totalMemoryUsage: memoryUsage.heapUsed,
            heapUsage: memoryUsage.heapUsed,
            heapLimit: memoryUsage.heapLimit,
            heapUsagePercentage: memoryUsage.heapUsed / memoryUsage.heapLimit,
            sessionCache: this.sessionCache.getMemoryMetrics(),
            contextCache: this.contextCache.getMemoryMetrics(),
            sessionManager: this.sessionManager.getMetrics(),
            eventManager: this.eventManager.getMetrics(),
            evictions: this.memoryMetrics.evictions,
            cleanups: this.memoryMetrics.cleanups,
            lastMemoryCheck: new Date(now),
            memoryPressureEvents: this.memoryMetrics.memoryPressureEvents
        };
        return { ...this.memoryMetrics };
    }
    checkMemoryPressure() {
        const heapUsage = this.memoryMetrics.heapUsagePercentage;
        return heapUsage > this.options.memoryPressureThreshold;
    }
    optimizeMemory() {
        this.logger.info('Starting memory optimization', {
            heapUsage: this.memoryMetrics.heapUsagePercentage,
            totalMemory: this.memoryMetrics.totalMemoryUsage
        });
        const optimizations = [];
        if (this.memoryMetrics.sessionCache.totalMemoryBytes > 30 * 1024 * 1024) {
            optimizations.push(this.optimizeSessionCache());
        }
        if (this.memoryMetrics.contextCache.totalMemoryBytes > 60 * 1024 * 1024) {
            optimizations.push(this.optimizeContextCache());
        }
        if (this.options.enableWeakReferences) {
            optimizations.push(this.cleanupWeakReferences());
        }
        if (global.gc) {
            global.gc();
            this.logger.debug('Garbage collection forced');
        }
        this.logger.info('Memory optimization completed', { optimizations });
    }
    getSessionContext(key) {
        return this.sessionCache.get(key);
    }
    setSessionContext(key, value, ttl) {
        this.sessionCache.set(key, value, {
            ttl,
            size: this.calculateObjectSize(value),
            weakReference: this.options.enableWeakReferences
        });
    }
    deleteSessionContext(key) {
        return this.sessionCache.delete(key);
    }
    getContext(key) {
        return this.contextCache.get(key);
    }
    setContext(key, value, ttl) {
        this.contextCache.set(key, value, {
            ttl,
            size: this.calculateObjectSize(value),
            weakReference: this.options.enableWeakReferences
        });
    }
    deleteContext(key) {
        return this.contextCache.delete(key);
    }
    getSessionManager() {
        return this.sessionManager;
    }
    getEventManager() {
        return this.eventManager;
    }
    updateMemorySettings(settings) {
        if (settings.maxSessions !== undefined) {
            this.sessionCache.resize(settings.maxSessions);
            this.sessionManager.updateSessionCacheSettings({ maxSessions: settings.maxSessions });
        }
        if (settings.maxContexts !== undefined) {
            this.contextCache.resize(settings.maxContexts);
        }
        if (settings.maxEvents !== undefined) {
            this.eventManager = new OptimizedEventManager({
                logger: this.logger.createChildLogger({ component: 'event-manager' }),
                enableWeakReferences: this.options.enableWeakReferences,
                maxSubscriptions: settings.maxEvents,
                enableAutoCleanup: true,
                cleanupIntervalMs: 300000
            });
        }
        if (settings.memoryPressureThreshold !== undefined) {
            this.options.memoryPressureThreshold = settings.memoryPressureThreshold;
        }
        this.logger.info('Memory settings updated', settings);
    }
    async cleanupAllWeakReferences() {
        const sessions = this.sessionManager.cleanupWeakReferences();
        const contexts = this.sessionCache.disposeWeakReferences();
        const events = this.eventManager.cleanupWeakReferences();
        this.memoryMetrics.cleanups++;
        this.logger.info('All weak references cleaned up', {
            sessions,
            contexts,
            events
        });
        return { sessions, contexts, events };
    }
    async forceCleanup() {
        await this.sessionManager.cleanupExpiredSessions();
        this.sessionCache.cleanup();
        this.contextCache.cleanup();
        this.eventManager.cleanupWeakReferences();
        this.memoryMetrics.cleanups++;
        this.logger.info('Force cleanup completed');
    }
    getMemorySummary() {
        const metrics = this.getMetrics();
        const cacheSizes = {
            sessions: metrics.sessionCache.totalItems,
            contexts: metrics.contextCache.totalItems,
            events: metrics.eventManager.activeSubscriptions
        };
        return {
            totalMemory: metrics.totalMemoryUsage,
            heapUsage: metrics.heapUsage,
            heapLimit: metrics.heapLimit,
            heapUsagePercentage: metrics.heapUsagePercentage,
            cacheSizes,
            memoryPressure: this.checkMemoryPressure()
        };
    }
    getCacheStatistics() {
        return {
            sessionCache: this.sessionCache.getStats(),
            contextCache: this.contextCache.getStats(),
            eventManager: this.eventManager.getCacheStats()
        };
    }
    async shutdown() {
        this.logger.info('Shutting down memory manager');
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
        if (this.weakReferenceCleanupInterval) {
            clearInterval(this.weakReferenceCleanupInterval);
            this.weakReferenceCleanupInterval = null;
        }
        await this.sessionManager.shutdown();
        this.eventManager.shutdown();
        this.sessionCache.clear();
        this.contextCache.clear();
        this.logger.info('Memory manager shutdown complete');
        this.emit('shutdown');
    }
    setupEventHandlers() {
        this.on('memoryPressure', () => {
            this.memoryMetrics.memoryPressureEvents++;
            this.logger.warn('Memory pressure detected', {
                heapUsage: this.memoryMetrics.heapUsagePercentage,
                threshold: this.options.memoryPressureThreshold
            });
            if (this.options.enableAutoOptimization) {
                this.optimizeMemory();
            }
        });
    }
    initializeMemoryMonitoring() {
        if (!this.options.enableMemoryMonitoring) {
            return;
        }
        this.memoryCheckInterval = setInterval(() => {
            const metrics = this.getMetrics();
            const wasUnderPressure = this.memoryMetrics.heapUsagePercentage <= this.options.memoryPressureThreshold;
            const isUnderPressure = metrics.heapUsagePercentage > this.options.memoryPressureThreshold;
            this.memoryMetrics = metrics;
            if (isUnderPressure && !wasUnderPressure) {
                this.emit('memoryPressure');
            }
        }, this.options.memoryCheckIntervalMs);
        if (this.options.enableWeakReferences) {
            this.weakReferenceCleanupInterval = setInterval(() => {
                this.cleanupAllWeakReferences().catch(error => {
                    this.logger.error('Weak reference cleanup failed', error);
                });
            }, 300000);
        }
        this.logger.info('Memory monitoring initialized');
    }
    optimizeSessionCache() {
        const currentSize = this.memoryMetrics.sessionCache.totalMemoryBytes;
        const targetSize = 20 * 1024 * 1024;
        while (this.memoryMetrics.sessionCache.totalMemoryBytes > targetSize) {
            this.sessionCache.delete(this.sessionCache.keys().next().value);
            this.memoryMetrics.evictions++;
        }
        this.logger.debug('Session cache optimized', {
            before: currentSize,
            after: this.memoryMetrics.sessionCache.totalMemoryBytes
        });
    }
    optimizeContextCache() {
        const currentSize = this.memoryMetrics.contextCache.totalMemoryBytes;
        const targetSize = 50 * 1024 * 1024;
        while (this.memoryMetrics.contextCache.totalMemoryBytes > targetSize) {
            this.contextCache.delete(this.contextCache.keys().next().value);
            this.memoryMetrics.evictions++;
        }
        this.logger.debug('Context cache optimized', {
            before: currentSize,
            after: this.memoryMetrics.contextCache.totalMemoryBytes
        });
    }
    cleanupWeakReferences() {
        const start = this.memoryMetrics.cleanups;
        this.sessionManager.cleanupWeakReferences();
        this.sessionCache.disposeWeakReferences();
        this.eventManager.cleanupWeakReferences();
        return this.memoryMetrics.cleanups - start;
    }
    calculateObjectSize(obj) {
        if (typeof obj === 'string') {
            return obj.length * 2;
        }
        else if (typeof obj === 'number') {
            return 8;
        }
        else if (typeof obj === 'boolean') {
            return 4;
        }
        else if (obj === null || obj === undefined) {
            return 0;
        }
        else if (Array.isArray(obj)) {
            return obj.reduce((acc, item) => acc + this.calculateObjectSize(item), 0);
        }
        else if (typeof obj === 'object') {
            return Object.keys(obj).reduce((acc, key) => {
                return acc + key.length * 2 + this.calculateObjectSize(obj[key]);
            }, 0);
        }
        return 0;
    }
}
export default UnifiedMemoryManager;
//# sourceMappingURL=memory-manager.js.map
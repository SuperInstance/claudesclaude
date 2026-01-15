import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './simple-logger';
import { SimpleLRUCache, createEventCache } from './simple-lru-cache';
export class OptimizedEventManager extends EventEmitter {
    subscriptions = new Map();
    eventCache;
    logger;
    metrics;
    options;
    cleanupInterval = null;
    pendingBatch = null;
    batchTimer = null;
    weakRefSubscriptions = new Set();
    constructor(options = {}) {
        super();
        this.options = {
            logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
            enableWeakReferences: options.enableWeakReferences !== false,
            enableBatching: options.enableBatching !== false,
            batchSize: options.batchSize || 100,
            batchDelayMs: options.batchDelayMs || 100,
            enableAutoCleanup: options.enableAutoCleanup !== false,
            cleanupIntervalMs: options.cleanupIntervalMs || 300000,
            maxSubscriptions: options.maxSubscriptions || 10000
        };
        this.logger = this.options.logger.createChildLogger({ component: 'event-manager' });
        this.eventCache = createEventCache({
            max: this.options.maxSubscriptions,
            ttl: 60 * 60 * 1000,
            maxSize: 25 * 1024 * 1024
        });
        this.metrics = {
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            weakReferences: 0,
            eventsProcessed: 0,
            batchedEvents: 0,
            memoryUsage: 0,
            cleanupCount: 0,
            lastCleanup: undefined
        };
        this.setupEventHandlers();
        this.startAutoCleanup();
    }
    on(event, handler, options = {}) {
        const subscriptionId = uuidv4();
        const weakReference = options.weakReference || this.options.enableWeakReferences;
        const trackMetrics = options.trackMetrics !== false;
        const subscription = {
            id: subscriptionId,
            event,
            handler,
            once: false,
            weakReference,
            createdAt: new Date(),
            lastCalled: new Date(0),
            callCount: 0
        };
        if (weakReference) {
            this.weakRefSubscriptions.add(subscriptionId);
            this.metrics.weakReferences++;
        }
        this.subscriptions.set(subscriptionId, subscription);
        this.metrics.totalSubscriptions++;
        this.metrics.activeSubscriptions++;
        const wrappedHandler = trackMetrics ? this.wrapHandler(handler, subscriptionId) : handler;
        if (weakReference) {
            this.eventCache.set(subscriptionId, wrappedHandler, {
                ttl: 30 * 60 * 1000,
                weakReference: true
            });
        }
        if (!weakReference) {
            super.on(event, wrappedHandler);
        }
        this.logger.debug('Event listener added', {
            subscriptionId,
            event,
            weakReference
        });
        return subscriptionId;
    }
    once(event, handler, options = {}) {
        const subscriptionId = this.on(event, handler, options);
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
            subscription.once = true;
        }
        return subscriptionId;
    }
    off(event, handler) {
        const removedSubscriptions = [];
        for (const [subId, subscription] of this.subscriptions) {
            if (subscription.event === event && (!handler || subscription.handler === handler)) {
                removedSubscriptions.push(subId);
            }
        }
        if (removedSubscriptions.length === 0) {
            return false;
        }
        for (const subId of removedSubscriptions) {
            this.removeSubscription(subId);
        }
        return true;
    }
    unsubscribe(subscriptionId) {
        return this.removeSubscription(subscriptionId);
    }
    emit(event, data) {
        const startTime = performance.now();
        if (this.options.enableBatching) {
            this.addToBatch(event, data);
            this.metrics.batchedEvents++;
        }
        else {
            this.processEvent(event, data);
        }
        this.metrics.eventsProcessed++;
        const duration = performance.now() - startTime;
        if (duration > 100) {
            this.logger.warn('Slow event processing', {
                event,
                duration: Math.round(duration),
                memoryUsage: this.getMemoryUsage()
            });
        }
        return true;
    }
    processEvent(event, data) {
        const activeSubscriptions = [];
        for (const [subId, subscription] of this.subscriptions) {
            if (subscription.event === event) {
                if (subscription.weakReference && !this.isSubscriptionValid(subscription)) {
                    continue;
                }
                activeSubscriptions.push(subscription);
            }
        }
        for (const subscription of activeSubscriptions) {
            try {
                subscription.handler(data);
                subscription.lastCalled = new Date();
                subscription.callCount++;
            }
            catch (error) {
                this.logger.error('Event handler error', error, {
                    event,
                    subscriptionId: subscription.id
                });
                this.emit('error', error);
            }
        }
    }
    addToBatch(event, data) {
        if (!this.pendingBatch) {
            this.pendingBatch = {
                id: uuidv4(),
                events: [],
                maxDelay: this.options.batchDelayMs,
                maxSize: this.options.batchSize
            };
        }
        this.pendingBatch.events.push({
            event,
            data,
            timestamp: Date.now()
        });
        if (this.pendingBatch.events.length >= this.pendingBatch.maxSize) {
            this.flushBatch();
            return;
        }
        if (!this.batchTimer) {
            this.batchTimer = setTimeout(() => {
                this.flushBatch();
            }, this.pendingBatch.maxDelay);
        }
    }
    flushBatch() {
        if (!this.pendingBatch || this.pendingBatch.events.length === 0) {
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
                this.batchTimer = null;
            }
            return;
        }
        const batch = this.pendingBatch;
        this.pendingBatch = null;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        for (const { event, data } of batch.events) {
            this.processEvent(event, data);
        }
        this.logger.debug('Batch processed', {
            batchId: batch.id,
            eventCount: batch.events.length
        });
    }
    isSubscriptionValid(subscription) {
        if (!subscription.weakReference) {
            return true;
        }
        try {
            return typeof subscription.handler === 'function';
        }
        catch {
            return false;
        }
    }
    removeSubscription(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            return false;
        }
        this.eventCache.delete(subscriptionId);
        this.weakRefSubscriptions.delete(subscriptionId);
        this.subscriptions.delete(subscriptionId);
        this.metrics.totalSubscriptions--;
        this.metrics.activeSubscriptions--;
        if (subscription.weakReference) {
            this.metrics.weakReferences--;
        }
        if (!subscription.weakReference) {
            super.off(subscription.event, subscription.handler);
        }
        this.logger.debug('Event listener removed', {
            subscriptionId,
            event: subscription.event
        });
        return true;
    }
    wrapHandler(handler, subscriptionId) {
        return (data) => {
            const start = performance.now();
            try {
                handler(data);
                const duration = performance.now() - start;
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription) {
                    subscription.lastCalled = new Date();
                    subscription.callCount++;
                }
                if (duration > 500) {
                    this.logger.warn('Slow event handler', {
                        subscriptionId,
                        duration: Math.round(duration)
                    });
                }
            }
            catch (error) {
                this.logger.error('Event handler error', error, { subscriptionId });
                this.emit('error', error);
            }
        };
    }
    getMetrics() {
        const cacheMetrics = this.eventCache.getMemoryMetrics();
        return {
            ...this.metrics,
            memoryUsage: cacheMetrics.totalMemoryBytes,
            totalSubscriptions: this.subscriptions.size,
            activeSubscriptions: this.subscriptions.size,
            weakReferences: this.weakRefSubscriptions.size
        };
    }
    getCacheStats() {
        return this.eventCache.getStats();
    }
    cleanupWeakReferences() {
        let cleaned = 0;
        for (const subId of this.weakRefSubscriptions) {
            const subscription = this.subscriptions.get(subId);
            if (subscription && !this.isSubscriptionValid(subscription)) {
                this.removeSubscription(subId);
                cleaned++;
            }
        }
        this.metrics.cleanupCount = cleaned;
        this.metrics.lastCleanup = new Date();
        this.logger.info('Weak reference subscriptions cleaned up', { count: cleaned });
        return cleaned;
    }
    flushPendingBatch() {
        this.flushBatch();
    }
    getMemoryUsage() {
        return process.memoryUsage().heapUsed;
    }
    getSubscriptionCount(event) {
        if (!event) {
            return this.subscriptions.size;
        }
        let count = 0;
        for (const subscription of this.subscriptions.values()) {
            if (subscription.event === event) {
                count++;
            }
        }
        return count;
    }
    listSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    clearAllSubscriptions() {
        const subscriptionIds = Array.from(this.subscriptions.keys());
        for (const subId of subscriptionIds) {
            this.removeSubscription(subId);
        }
        this.eventCache.clear();
        this.weakRefSubscriptions.clear();
        if (this.pendingBatch) {
            this.pendingBatch = null;
        }
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        this.logger.info('All event subscriptions cleared');
    }
    setupEventHandlers() {
    }
    startAutoCleanup() {
        if (this.options.enableAutoCleanup) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupWeakReferences();
            }, this.options.cleanupIntervalMs);
        }
    }
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    shutdown() {
        this.stopAutoCleanup();
        this.clearAllSubscriptions();
        this.logger.info('Event manager shutdown complete');
    }
}
export default OptimizedEventManager;
//# sourceMappingURL=event-manager.js.map
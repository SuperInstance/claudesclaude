export class SimpleEventManager {
    events = new Map();
    batchQueue = [];
    batchConfig;
    metrics;
    batchTimeout;
    processingTimes = [];
    lastFlush = 0;
    constructor(config = {
        maxSize: 100,
        maxWaitMs: 16,
        enablePriority: false,
        enableDeduplication: false
    }) {
        this.batchConfig = config;
        this.metrics = this.initializeMetrics();
    }
    initializeMetrics() {
        return {
            totalEvents: 0,
            totalProcessed: 0,
            averageProcessingTime: 0,
            memoryUsage: 0
        };
    }
    emit(event, data, priority, source) {
        const now = Date.now();
        this.metrics.totalEvents++;
        const eventData = { event, data, timestamp: now, priority, source };
        if (this.batchConfig.enableDeduplication && this.batchConfig.dedupKey) {
            const dedupKey = this.batchConfig.dedupKey(eventData);
            const existingIndex = this.batchQueue.findIndex(e => this.batchConfig.dedupKey?.(e) === dedupKey);
            if (existingIndex !== -1) {
                this.batchQueue[existingIndex] = eventData;
                return;
            }
        }
        this.batchQueue.push(eventData);
        if (this.batchConfig.enablePriority) {
            this.batchQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        }
        const shouldFlush = this.batchQueue.length >= this.batchConfig.maxSize ||
            (now - this.lastFlush) >= this.batchConfig.maxWaitMs;
        if (shouldFlush) {
            this.flush();
        }
        else if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this.flush(), this.batchConfig.maxWaitMs);
        }
    }
    flush() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = undefined;
        }
        const events = this.batchQueue;
        this.batchQueue = [];
        this.lastFlush = Date.now();
        events.forEach(event => {
            const startTime = performance.now();
            const listeners = this.events.get(event.event);
            if (listeners) {
                listeners.forEach(listener => {
                    try {
                        listener(event.data);
                    }
                    catch (error) {
                        console.warn('Event listener error:', error);
                    }
                });
            }
            const processingTime = performance.now() - startTime;
            this.processingTimes.push(processingTime);
            if (this.processingTimes.length > 100) {
                this.processingTimes.shift();
            }
            this.metrics.totalProcessed++;
        });
        this.updateMetrics();
    }
    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(listener);
    }
    off(event, listener) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.events.delete(event);
            }
        }
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    updateMetrics() {
        if (this.processingTimes.length > 0) {
            this.metrics.averageProcessingTime =
                this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
        }
        this.metrics.memoryUsage =
            this.batchQueue.length * 100 +
                this.processingTimes.length * 8;
    }
    forceFlush() {
        this.flush();
    }
    clear() {
        this.batchQueue = [];
        this.events.clear();
        this.processingTimes = [];
        this.updateMetrics();
    }
}
export const eventManager = new SimpleEventManager({
    maxSize: 50,
    maxWaitMs: 16,
    enablePriority: false,
    enableDeduplication: false
});
//# sourceMappingURL=simple-events.js.map
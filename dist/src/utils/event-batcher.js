import { EventEmitter } from 'events';
export class EventBatcher extends EventEmitter {
    config;
    eventQueue = [];
    pendingTimers = [];
    stats = {
        batchSize: 0,
        waitTime: 0,
        memoryUsage: 0,
        duplicatesRemoved: 0,
        batchesFlushed: 0,
        totalEvents: 0
    };
    totalMemoryUsage = 0;
    eventCounts = new Map();
    lastFlushTime = Date.now();
    constructor(config = {}) {
        super();
        this.config = {
            maxSize: config.maxSize ?? 100,
            maxWaitMs: config.maxWaitMs ?? 16,
            maxMemoryBytes: config.maxMemoryBytes ?? 10 * 1024 * 1024,
            enablePriority: config.enablePriority ?? true,
            enableDeduplication: config.enableDeduplication ?? false,
            dedupKey: config.dedupKey ?? ((event) => `${event.event}-${JSON.stringify(event.data)}`)
        };
        this.setupAutoFlush();
    }
    emit(event, data, options) {
        if (options?.immediate) {
            this.flush([{
                    event,
                    data,
                    timestamp: Date.now(),
                    priority: options.priority,
                    source: options.source
                }]);
            return true;
        }
        const batchedEvent = {
            event,
            data,
            timestamp: Date.now(),
            priority: options?.priority ?? 0,
            source: options?.source
        };
        const eventSize = this.calculateEventSize(batchedEvent);
        if (this.totalMemoryUsage + eventSize > this.config.maxMemoryBytes) {
            this.flush();
        }
        if (this.config.enableDeduplication) {
            const dedupKey = this.config.dedupKey(batchedEvent);
            const existingIndex = this.eventQueue.findIndex(e => this.config.dedupKey(e) === dedupKey);
            if (existingIndex >= 0) {
                this.eventQueue[existingIndex] = batchedEvent;
                this.stats.duplicatesRemoved++;
                this.totalMemoryUsage = this.calculateTotalMemoryUsage();
                return true;
            }
        }
        if (this.config.enablePriority) {
            const insertIndex = this.findInsertIndex(batchedEvent);
            this.eventQueue.splice(insertIndex, 0, batchedEvent);
        }
        else {
            this.eventQueue.push(batchedEvent);
        }
        this.totalMemoryUsage += eventSize;
        this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);
        this.stats.totalEvents++;
        this.checkFlushConditions();
        return true;
    }
    flush(events) {
        const eventsToFlush = events || this.eventQueue;
        const batchCount = eventsToFlush.length;
        if (batchCount === 0) {
            return;
        }
        const now = Date.now();
        const waitTime = now - this.lastFlushTime;
        this.lastFlushTime = now;
        this.stats.batchesFlushed++;
        this.stats.batchSize = batchCount;
        this.stats.waitTime = waitTime;
        this.stats.memoryUsage = this.totalMemoryUsage;
        const eventsByType = new Map();
        for (const event of eventsToFlush) {
            if (!eventsByType.has(event.event)) {
                eventsByType.set(event.event, []);
            }
            eventsByType.get(event.event).push(event);
        }
        for (const [eventType, batch] of eventsByType) {
            this.emit('batch', {
                eventType,
                events: batch,
                count: batch.length,
                timestamp: now,
                averageWaitTime: batch.reduce((sum, e) => sum + (now - e.timestamp), 0) / batch.length
            });
            this.emit('individual', batch);
        }
        if (!events) {
            this.eventQueue = [];
        }
        else {
            const flushedEvents = new Set(events);
            this.eventQueue = this.eventQueue.filter(e => !flushedEvents.has(e));
        }
        this.totalMemoryUsage = this.calculateTotalMemoryUsage();
    }
    flushImmediately() {
        this.pendingTimers.forEach(timer => clearTimeout(timer));
        this.pendingTimers = [];
        this.flush();
    }
    getStatus() {
        const avgWaitTime = this.stats.waitTime > 0 ? this.stats.waitTime : 16;
        const memoryPercentage = (this.totalMemoryUsage / this.config.maxMemoryBytes) * 100;
        const eventsByType = {};
        for (const [event, count] of this.eventCounts) {
            eventsByType[event] = count;
        }
        return {
            queueSize: this.eventQueue.length,
            memoryUsage: this.totalMemoryUsage,
            memoryPercentage,
            avgWaitTime,
            eventsByType
        };
    }
    getStats() {
        return { ...this.stats };
    }
    resetStats() {
        this.stats = {
            batchSize: 0,
            waitTime: 0,
            memoryUsage: 0,
            duplicatesRemoved: 0,
            batchesFlushed: 0,
            totalEvents: 0
        };
        this.eventCounts.clear();
    }
    pause() {
        this.flushImmediately();
        this.pendingTimers.forEach(timer => clearTimeout(timer));
        this.pendingTimers = [];
    }
    resume() {
        this.setupAutoFlush();
    }
    updateConfig(newConfig) {
        const oldMaxMemory = this.config.maxMemoryBytes;
        this.config = { ...this.config, ...newConfig };
        if (oldMaxMemory && this.config.maxMemoryBytes && oldMaxMemory > this.config.maxMemoryBytes) {
            if (this.totalMemoryUsage > this.config.maxMemoryBytes) {
                this.flushImmediately();
            }
        }
    }
    dispose() {
        this.flushImmediately();
        this.removeAllListeners();
        this.resetStats();
    }
    setupAutoFlush() {
        const timer = setTimeout(() => {
            this.flush();
        }, this.config.maxWaitMs);
        this.pendingTimers.push(timer);
    }
    checkFlushConditions() {
        if (this.eventQueue.length >= this.config.maxSize) {
            this.flushImmediately();
            return;
        }
        const nextEventSize = this.eventQueue.length > 0
            ? this.calculateEventSize(this.eventQueue[0])
            : 0;
        if (this.totalMemoryUsage + nextEventSize > this.config.maxMemoryBytes) {
            this.flushImmediately();
            return;
        }
        this.pendingTimers.forEach(timer => clearTimeout(timer));
        this.pendingTimers = [];
        this.setupAutoFlush();
    }
    findInsertIndex(event) {
        let low = 0;
        let high = this.eventQueue.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midEvent = this.eventQueue[mid];
            if (midEvent.priority < event.priority) {
                high = mid - 1;
            }
            else {
                low = mid + 1;
            }
        }
        return low;
    }
    calculateEventSize(event) {
        let dataStr = '';
        try {
            dataStr = JSON.stringify(event.data);
        }
        catch (e) {
            dataStr = JSON.stringify({ __error: 'Non-serializable object' });
        }
        return (event.event.length * 2 +
            dataStr.length * 2 +
            16 +
            (event.source?.length || 0) * 2);
    }
    calculateTotalMemoryUsage() {
        return this.eventQueue.reduce((total, event) => total + this.calculateEventSize(event), 0);
    }
}
export function createEventBatcher(config) {
    return new EventBatcher(config);
}
export class SessionEventBatcher extends EventBatcher {
    constructor() {
        super({
            maxSize: 50,
            maxWaitMs: 32,
            enablePriority: true,
            enableDeduplication: false
        });
    }
}
export class MetricEventBatcher extends EventBatcher {
    constructor() {
        super({
            maxSize: 200,
            maxWaitMs: 1000,
            enablePriority: false,
            enableDeduplication: true,
            dedupKey: (event) => `${event.event}-${event.timestamp}`
        });
    }
}
export class HighFrequencyEventBatcher extends EventBatcher {
    constructor() {
        super({
            maxSize: 1000,
            maxWaitMs: 4,
            maxMemoryBytes: 50 * 1024 * 1024,
            enablePriority: true,
            enableDeduplication: true
        });
    }
}
//# sourceMappingURL=event-batcher.js.map
export class OptimizedEventManager {
    events = new Map();
    options;
    metrics;
    processingTimes = [];
    constructor(options = {}) {
        this.options = {
            enableWeakReferences: false,
            enableBatching: false,
            maxListeners: 100,
            ...options
        };
        this.metrics = this.initializeMetrics();
    }
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        const listeners = this.events.get(event);
        if (listeners.size >= this.options.maxListeners) {
            console.warn(`Possible memory leak detected for event "${event}". ${listeners.size} listeners added.`);
        }
        if (this.options.enableWeakReferences) {
            listeners.add(handler);
        }
        else {
            listeners.add(handler);
        }
    }
    off(event, handler) {
        const listeners = this.events.get(event);
        if (listeners) {
            return listeners.delete(handler);
        }
        return false;
    }
    emit(event, data) {
        const startTime = performance.now();
        const listeners = this.events.get(event);
        if (listeners) {
            const handlers = Array.from(listeners);
            for (const handler of handlers) {
                try {
                    handler(data);
                    this.metrics.totalEventsProcessed++;
                }
                catch (error) {
                    console.error(`Error in event handler for "${event}":`, error);
                }
            }
        }
        this.metrics.totalEventsEmitted++;
        const processingTime = performance.now() - startTime;
        this.processingTimes.push(processingTime);
        if (this.processingTimes.length > 1000) {
            this.processingTimes.shift();
        }
        this.updateMetrics();
    }
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        }
        else {
            this.events.clear();
        }
    }
    listenerCount(event) {
        const listeners = this.events.get(event);
        return listeners ? listeners.size : 0;
    }
    getAllEvents() {
        return Array.from(this.events.keys());
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    updateMetrics() {
        this.metrics.activeListeners = Array.from(this.events.values())
            .reduce((total, listeners) => total + listeners.size, 0);
        this.metrics.averageProcessingTime = this.processingTimes.length > 0
            ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
            : 0;
        this.metrics.memoryUsage = this.calculateMemoryUsage();
    }
    calculateMemoryUsage() {
        const eventsMemory = this.events.size * 1024;
        const listenersMemory = this.metrics.activeListeners * 256;
        return eventsMemory + listenersMemory;
    }
    initializeMetrics() {
        return {
            totalEventsEmitted: 0,
            totalEventsProcessed: 0,
            averageProcessingTime: 0,
            memoryUsage: 0,
            activeListeners: 0
        };
    }
    cleanup() {
        for (const [event, listeners] of this.events.entries()) {
            if (listeners.size === 0) {
                this.events.delete(event);
            }
        }
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        this.processingTimes = this.processingTimes.filter(time => performance.now() - time < oneHourAgo);
    }
    shutdown() {
        this.events.clear();
        this.processingTimes = [];
        this.metrics = this.initializeMetrics();
    }
    getEventStats() {
        const stats = {};
        for (const [event, listeners] of this.events.entries()) {
            stats[event] = listeners.size;
        }
        return {
            uniqueEvents: this.events.size,
            events: stats,
            totalListeners: this.metrics.activeListeners
        };
    }
}
//# sourceMappingURL=event-manager.js.map
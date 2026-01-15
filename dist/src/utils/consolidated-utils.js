export const uuid = {
    fast: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    secure: () => crypto.randomUUID(),
    generate: (secure = false) => secure ? uuid.secure() : uuid.fast()
};
export const time = {
    now: () => Date.now(),
    format: (timestamp, options = {}) => {
        const date = new Date(timestamp);
        let result = date.toISOString().split('T')[0];
        const timePart = date.toTimeString().split(' ')[0];
        result += ' ' + timePart;
        if (options.includeMilliseconds) {
            result += '.' + date.getMilliseconds().toString().padStart(3, '0');
        }
        return result;
    },
    diff: (start, end) => {
        const diff = Math.abs(end - start);
        return {
            hours: Math.floor(diff / (1000 * 60 * 60)),
            minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((diff % (1000 * 60)) / 1000)
        };
    },
    range: (start, duration) => ({
        start,
        end: start + duration,
        duration
    }),
    inRange: (timestamp, start, end) => timestamp >= start && timestamp <= end
};
export class ObjectPool {
    pool = [];
    createFn;
    resetFn;
    maxSize;
    constructor(options) {
        this.createFn = options.create;
        this.resetFn = options.reset || (() => { });
        this.maxSize = options.maxSize || 100;
    }
    acquire() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.createFn();
    }
    release(obj) {
        this.resetFn(obj);
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        }
    }
    clear() {
        this.pool = [];
    }
    size() {
        return this.pool.length;
    }
}
export class EventBatcher {
    batch = [];
    callbacks = new Set();
    batchSize;
    batchTime;
    constructor(options = {}) {
        this.batchSize = options.batchSize || 10;
        this.batchTime = options.batchTime || 100;
        this.startBatchTimer();
    }
    add(item) {
        this.batch.push(item);
        if (this.batch.length >= this.batchSize) {
            this.flush();
        }
    }
    addAll(items) {
        this.batch.push(...items);
        if (this.batch.length >= this.batchSize) {
            this.flush();
        }
    }
    subscribe(callback) {
        this.callbacks.add(callback);
    }
    unsubscribe(callback) {
        this.callbacks.delete(callback);
    }
    flush() {
        if (this.batch.length === 0)
            return;
        const batch = [...this.batch];
        this.batch = [];
        this.callbacks.forEach(callback => {
            try {
                callback(batch);
            }
            catch (error) {
                console.error('Error in event batch callback:', error);
            }
        });
    }
    startBatchTimer() {
        setInterval(() => {
            this.flush();
        }, this.batchTime);
    }
    size() {
        return this.batch.length;
    }
}
export class MetricsCollector {
    metrics = new Map();
    timers = new Map();
    counters = new Map();
    startTimer(name) {
        this.timers.set(name, performance.now());
    }
    endTimer(name) {
        const start = this.timers.get(name);
        if (!start)
            return 0;
        const duration = performance.now() - start;
        this.timers.delete(name);
        this.incrementMetric(`${name}_duration`, duration);
        return duration;
    }
    increment(name, value = 1) {
        this.incrementCounter(name, value);
    }
    recordMetric(name, value) {
        this.metrics.set(name, value);
    }
    getMetrics() {
        const result = {};
        this.metrics.forEach((value, key) => {
            result[key] = value;
        });
        this.counters.forEach((value, key) => {
            result[`${key}_count`] = value;
        });
        return result;
    }
    reset() {
        this.metrics.clear();
        this.timers.clear();
        this.counters.clear();
    }
    incrementCounter(name, value) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
    }
    incrementMetric(name, value) {
        const current = this.metrics.get(name) || 0;
        this.metrics.set(name, current + value);
    }
}
export const metrics = new MetricsCollector();
export const eventBatcher = new EventBatcher();
export const sessionPool = new ObjectPool({
    create: () => ({}),
    reset: (obj) => Object.keys(obj).forEach(key => delete obj[key])
});
export const generateUUID = uuid.generate;
export const generateFastUUID = uuid.fast;
export const generateSecureUUID = uuid.secure;
export const now = time.now;
export const formatTime = time.format;
export const timeDiff = time.diff;
export const createTimeRange = time.range;
export const isTimeInRange = time.inRange;
export default {
    uuid,
    time,
    ObjectPool,
    EventBatcher,
    MetricsCollector,
    metrics,
    eventBatcher,
    sessionPool,
    generateUUID,
    generateFastUUID,
    generateSecureUUID,
    now,
    formatTime,
    timeDiff,
    createTimeRange,
    isTimeInRange
};
//# sourceMappingURL=consolidated-utils.js.map
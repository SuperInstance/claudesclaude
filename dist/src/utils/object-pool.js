export class ObjectPool {
    config;
    pool = [];
    activeObjects = new Set();
    stats;
    shrinkTimer = null;
    isGrowing = false;
    constructor(config) {
        this.config = {
            initialSize: config.initialSize,
            maxPoolSize: config.maxPoolSize,
            minPoolSize: config.minPoolSize,
            resetObject: config.resetObject,
            createObject: config.createObject,
            enableDynamicSizing: config.enableDynamicSizing ?? true,
            growthFactor: config.growthFactor ?? 1.5,
            shrinkThreshold: config.shrinkThreshold ?? 0.25,
            shrinkIntervalMs: config.shrinkIntervalMs ?? 30000
        };
        this.stats = {
            totalCreated: 0,
            totalAcquired: 0,
            totalReleased: 0,
            currentPoolSize: 0,
            activeObjects: 0,
            peakPoolSize: 0,
            poolHits: 0,
            poolMisses: 0
        };
        this.initializePool();
        this.setupShrinking();
    }
    acquire() {
        this.stats.totalAcquired++;
        let obj = this.pool.pop();
        if (obj) {
            this.stats.poolHits++;
            this.stats.currentPoolSize--;
        }
        else {
            this.stats.poolMisses++;
            obj = this.createObject();
            this.stats.totalCreated++;
            if (this.isGrowing && this.config.enableDynamicSizing) {
                this.growPool();
            }
        }
        this.activeObjects.add(obj);
        this.stats.activeObjects = this.activeObjects.size;
        this.updatePeakPoolSize();
        return obj;
    }
    release(obj) {
        if (!this.activeObjects.has(obj)) {
            return;
        }
        this.activeObjects.delete(obj);
        this.stats.activeObjects = this.activeObjects.size;
        this.stats.totalReleased++;
        const resetObj = this.config.resetObject(obj);
        if (this.pool.length < this.config.maxPoolSize) {
            this.pool.push(resetObj);
            this.stats.currentPoolSize++;
        }
        else {
        }
        this.checkShrinkCondition();
    }
    warmup(count = this.config.initialSize) {
        const toCreate = Math.min(count - this.pool.length, this.config.maxPoolSize - this.pool.length);
        for (let i = 0; i < toCreate; i++) {
            const obj = this.createObject();
            this.pool.push(obj);
            this.stats.totalCreated++;
            this.stats.currentPoolSize++;
        }
        this.updatePeakPoolSize();
    }
    shrink() {
        if (this.pool.length <= this.config.minPoolSize) {
            return 0;
        }
        const targetSize = Math.max(this.config.minPoolSize, Math.floor(this.pool.length * this.config.shrinkThreshold));
        const toRemove = this.pool.length - targetSize;
        const removed = this.pool.splice(targetSize, toRemove);
        this.stats.currentPoolSize = this.pool.length;
        this.stats.lastShrinkTime = new Date();
        return removed.length;
    }
    getStats() {
        return { ...this.stats };
    }
    clear() {
        this.pool = [];
        this.activeObjects.clear();
        this.stats.currentPoolSize = 0;
        this.stats.activeObjects = 0;
        if (this.shrinkTimer) {
            clearTimeout(this.shrinkTimer);
            this.shrinkTimer = null;
        }
    }
    dispose() {
        this.clear();
    }
    setDynamicSizing(enabled) {
        this.config.enableDynamicSizing = enabled;
        if (!enabled) {
            this.isGrowing = false;
        }
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.maxPoolSize !== undefined && this.pool.length > this.config.maxPoolSize) {
            this.shrink();
        }
    }
    initializePool() {
        for (let i = 0; i < this.config.initialSize; i++) {
            const obj = this.createObject();
            this.pool.push(obj);
            this.stats.totalCreated++;
        }
        this.stats.currentPoolSize = this.pool.length;
        this.updatePeakPoolSize();
    }
    setupShrinking() {
        if (this.config.enableDynamicSizing) {
            this.shrinkTimer = setInterval(() => {
                this.shrink();
            }, this.config.shrinkIntervalMs);
        }
    }
    growPool() {
        if (this.pool.length >= this.config.maxPoolSize) {
            this.isGrowing = false;
            return;
        }
        const toGrow = Math.min(Math.floor(this.pool.length * (this.config.growthFactor - 1)), this.config.maxPoolSize - this.pool.length);
        for (let i = 0; i < toGrow; i++) {
            const obj = this.createObject();
            this.pool.push(obj);
            this.stats.totalCreated++;
        }
        this.stats.currentPoolSize = this.pool.length;
        this.updatePeakPoolSize();
    }
    createObject() {
        return this.config.createObject();
    }
    checkShrinkCondition() {
        if (this.pool.length > this.config.minPoolSize &&
            this.activeObjects.size < this.pool.length * this.config.shrinkThreshold) {
            if (this.shrinkTimer) {
                clearTimeout(this.shrinkTimer);
            }
            this.shrinkTimer = setTimeout(() => {
                this.shrink();
            }, this.config.shrinkIntervalMs);
        }
    }
    updatePeakPoolSize() {
        if (this.stats.currentPoolSize > this.stats.peakPoolSize) {
            this.stats.peakPoolSize = this.stats.currentPoolSize;
        }
    }
}
export class SessionPool extends ObjectPool {
    static nextId = 0;
    constructor(config) {
        const defaultConfig = {
            initialSize: 50,
            maxPoolSize: 500,
            minPoolSize: 10,
            createObject: () => ({
                id: `session-${SessionPool.nextId++}`,
                type: 'ai-assistant',
                name: '',
                workspace: '',
                config: {},
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            resetObject: (session) => ({
                ...session,
                status: 'active',
                config: {},
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            enableDynamicSizing: true,
            growthFactor: 1.5,
            shrinkThreshold: 0.25,
            shrinkIntervalMs: 30000,
            ...config
        };
        super(defaultConfig);
    }
    acquireSession(type, name, workspace) {
        const session = this.acquire();
        session.id = `session-${SessionPool.nextId++}`;
        session.type = type;
        session.name = name;
        session.workspace = workspace;
        session.config = {};
        session.status = 'active';
        session.createdAt = new Date();
        session.updatedAt = new Date();
        return session;
    }
}
export function createPool(config) {
    return new ObjectPool(config);
}
export const sessionPool = new SessionPool();
export class HighFrequencyPool extends ObjectPool {
    constructor(createObject, resetObject, config) {
        super({
            initialSize: 100,
            maxPoolSize: 10000,
            minPoolSize: 50,
            createObject,
            resetObject,
            enableDynamicSizing: true,
            growthFactor: 2,
            shrinkThreshold: 0.1,
            shrinkIntervalMs: 60000,
            ...config
        });
    }
}
export class SimplePool {
    pool = [];
    createObject;
    resetObject;
    constructor(createObject, resetObject) {
        this.createObject = createObject;
        this.resetObject = resetObject;
    }
    acquire() {
        return this.pool.pop() || this.createObject();
    }
    release(obj) {
        this.pool.push(this.resetObject(obj));
    }
    clear() {
        this.pool = [];
    }
}
export function benchmarkPool(pool, operations = 10000) {
    const start = performance.now();
    const results = [];
    const acquireStart = performance.now();
    for (let i = 0; i < operations; i++) {
        results.push(pool.acquire());
    }
    const acquireEnd = performance.now();
    const releaseStart = performance.now();
    for (const obj of results) {
        pool.release(obj);
    }
    const releaseEnd = performance.now();
    const totalTime = releaseEnd - start;
    const avgAcquireTime = (acquireEnd - acquireStart) / operations;
    const avgReleaseTime = (releaseEnd - releaseStart) / operations;
    const poolUtilization = pool.getStats().activeObjects / operations;
    const hitRate = pool.getStats().poolHits / operations;
    return {
        operations,
        totalTime,
        avgAcquireTime,
        avgReleaseTime,
        poolUtilization,
        hitRate
    };
}
//# sourceMappingURL=object-pool.js.map
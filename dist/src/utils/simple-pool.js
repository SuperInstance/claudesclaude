import { uuidGenerator } from './simple-utils.js';
export class SimplePool {
    pool = [];
    inUse = new Set();
    config;
    metrics;
    acquireTimes = [];
    releaseTimes = [];
    constructor(config) {
        this.config = {
            resetObject: (obj) => obj,
            destroyObject: () => { },
            ...config
        };
        for (let i = 0; i < config.initialSize; i++) {
            this.pool.push(this.config.createObject());
        }
        this.metrics = {
            totalAcquired: 0,
            totalReleased: 0,
            currentSize: this.pool.length,
            maxSize: config.maxSize,
            averageAcquireTime: 0,
            averageReleaseTime: 0
        };
    }
    acquire() {
        const startTime = performance.now();
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        }
        else if (this.inUse.size + this.pool.length < this.config.maxSize) {
            obj = this.config.createObject();
        }
        else {
            throw new Error('Pool at maximum capacity');
        }
        if (this.config.resetObject) {
            obj = this.config.resetObject(obj);
        }
        this.inUse.add(obj);
        this.metrics.totalAcquired++;
        const acquireTime = performance.now() - startTime;
        this.acquireTimes.push(acquireTime);
        if (this.acquireTimes.length > 100) {
            this.acquireTimes.shift();
        }
        this.updateMetrics();
        return obj;
    }
    release(obj) {
        const startTime = performance.now();
        if (!this.inUse.has(obj)) {
            throw new Error('Object not in use');
        }
        this.inUse.delete(obj);
        if (this.pool.length < this.config.minSize) {
            this.pool.push(obj);
        }
        else if (this.pool.length < this.config.maxSize) {
            obj = this.config.resetObject(obj);
            this.pool.push(obj);
        }
        else {
            this.config.destroyObject(obj);
        }
        this.metrics.totalReleased++;
        const releaseTime = performance.now() - startTime;
        this.releaseTimes.push(releaseTime);
        if (this.releaseTimes.length > 100) {
            this.releaseTimes.shift();
        }
        this.updateMetrics();
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    updateMetrics() {
        this.metrics.currentSize = this.pool.length + this.inUse.size;
        if (this.acquireTimes.length > 0) {
            this.metrics.averageAcquireTime =
                this.acquireTimes.reduce((a, b) => a + b, 0) / this.acquireTimes.length;
        }
        if (this.releaseTimes.length > 0) {
            this.metrics.averageReleaseTime =
                this.releaseTimes.reduce((a, b) => a + b, 0) / this.releaseTimes.length;
        }
    }
    clear() {
        this.pool.forEach(obj => this.config.destroyObject(obj));
        this.inUse.forEach(obj => this.config.destroyObject(obj));
        this.pool = [];
        this.inUse.clear();
        this.acquireTimes = [];
        this.releaseTimes = [];
        this.updateMetrics();
    }
    size() {
        return this.pool.length + this.inUse.size;
    }
    inUseCount() {
        return this.inUse.size;
    }
}
export class StringPool extends SimplePool {
    constructor(config = {}) {
        super({
            initialSize: 10,
            maxSize: 100,
            minSize: 5,
            createObject: () => '',
            resetObject: (str) => str.trim(),
            ...config
        });
    }
}
export class SessionPool extends SimplePool {
    constructor(config = {}) {
        super({
            initialSize: 5,
            maxSize: 50,
            minSize: 2,
            createObject: () => ({
                id: '',
                type: 'default',
                name: '',
                workspace: '',
                config: {},
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            resetObject: (session) => ({
                ...session,
                id: '',
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
            }),
            ...config
        });
    }
    acquireSession(type = 'default', name = '', workspace = '') {
        const session = this.acquire();
        session.id = uuidGenerator.generateFast();
        session.type = type;
        session.name = name;
        session.workspace = workspace;
        session.createdAt = new Date();
        session.updatedAt = new Date();
        return session;
    }
}
export class TCPConnectionPool extends SimplePool {
    host;
    port;
    connectionConfig;
    constructor(host, port, config = {}) {
        const baseConfig = {
            initialSize: 2,
            maxSize: 10,
            minSize: 1,
            createObject: () => ({ connected: false, lastUsed: 0 }),
            resetObject: (conn) => ({ connected: false, lastUsed: 0 }),
            destroyObject: (conn) => { },
            ...config
        };
        super(baseConfig);
        this.host = host;
        this.port = port;
        this.connectionConfig = config;
    }
    async getConnection() {
        let conn = this.acquire();
        if (!conn.connected) {
            conn.connected = true;
            conn.lastUsed = Date.now();
        }
        return conn;
    }
    releaseConnection(conn) {
        conn.lastUsed = Date.now();
        this.release(conn);
    }
}
//# sourceMappingURL=simple-pool.js.map
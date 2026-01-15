export class SimpleLRUCache {
    cache = new Map();
    maxSize;
    constructor(maxSize) {
        this.maxSize = maxSize;
    }
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            for (const firstKey of this.cache.keys()) {
                this.cache.delete(firstKey);
                break;
            }
        }
        this.cache.set(key, value);
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    values() {
        return Array.from(this.cache.values());
    }
    size() {
        return this.cache.size;
    }
}
//# sourceMappingURL=simple-lru-cache.js.map
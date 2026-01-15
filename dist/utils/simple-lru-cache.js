"use strict";
/**
 * Simplified LRU Cache - Basic LRU functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleLRUCache = void 0;
var SimpleLRUCache = /** @class */ (function () {
    function SimpleLRUCache(maxSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    SimpleLRUCache.prototype.set = function (key, value) {
        if (this.cache.size >= this.maxSize) {
            for (var _i = 0, _a = this.cache.keys(); _i < _a.length; _i++) {
                var firstKey = _a[_i];
                this.cache.delete(firstKey);
                break;
            }
        }
        this.cache.set(key, value);
    };
    SimpleLRUCache.prototype.get = function (key) {
        var value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (LRU)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    };
    SimpleLRUCache.prototype.delete = function (key) {
        return this.cache.delete(key);
    };
    SimpleLRUCache.prototype.clear = function () {
        this.cache.clear();
    };
    SimpleLRUCache.prototype.values = function () {
        return Array.from(this.cache.values());
    };
    SimpleLRUCache.prototype.size = function () {
        return this.cache.size;
    };
    return SimpleLRUCache;
}());
exports.SimpleLRUCache = SimpleLRUCache;

"use strict";
/**
 * Simplified Utilities - Essential utilities in one file
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimeRange = exports.timeDiff = exports.formatTime = exports.now = exports.generateSecureUUID = exports.generateFastUUID = exports.generateUUID = exports.timestampOps = exports.uuidGenerator = exports.SimpleTimestamp = exports.SimpleUUID = void 0;
// UUID generation
var SimpleUUID = /** @class */ (function () {
    function SimpleUUID() {
    }
    SimpleUUID.prototype.generateFast = function () {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };
    SimpleUUID.prototype.generateSecure = function () {
        return crypto.randomUUID();
    };
    SimpleUUID.prototype.generate = function (secure) {
        if (secure === void 0) { secure = false; }
        return secure ? this.generateSecure() : this.generateFast();
    };
    return SimpleUUID;
}());
exports.SimpleUUID = SimpleUUID;
// Timestamp operations
var SimpleTimestamp = /** @class */ (function () {
    function SimpleTimestamp() {
    }
    SimpleTimestamp.prototype.now = function () {
        return Date.now();
    };
    SimpleTimestamp.prototype.format = function (timestamp, options) {
        if (options === void 0) { options = {}; }
        var date = new Date(timestamp);
        var result = date.toISOString().split('T')[0];
        var timePart = date.toTimeString().split(' ')[0];
        result += ' ' + timePart;
        if (options.includeMilliseconds) {
            result += '.' + date.getMilliseconds().toString().padStart(3, '0');
        }
        return result;
    };
    SimpleTimestamp.prototype.diff = function (start, end) {
        var diff = Math.abs(end - start);
        var hours = Math.floor(diff / (1000 * 60 * 60));
        var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return { hours: hours, minutes: minutes, seconds: seconds };
    };
    SimpleTimestamp.prototype.createRange = function (start, duration) {
        return {
            start: start,
            end: start + duration,
            duration: duration
        };
    };
    SimpleTimestamp.prototype.isInRange = function (timestamp, start, end) {
        return timestamp >= start && timestamp <= end;
    };
    return SimpleTimestamp;
}());
exports.SimpleTimestamp = SimpleTimestamp;
// Singleton instances
exports.uuidGenerator = new SimpleUUID();
exports.timestampOps = new SimpleTimestamp();
// Convenience functions
var generateUUID = function (secure) {
    if (secure === void 0) { secure = false; }
    return exports.uuidGenerator.generate(secure);
};
exports.generateUUID = generateUUID;
var generateFastUUID = function () { return exports.uuidGenerator.generateFast(); };
exports.generateFastUUID = generateFastUUID;
var generateSecureUUID = function () { return exports.uuidGenerator.generateSecure(); };
exports.generateSecureUUID = generateSecureUUID;
var now = function () { return exports.timestampOps.now(); };
exports.now = now;
var formatTime = function (timestamp, options) { return exports.timestampOps.format(timestamp, options); };
exports.formatTime = formatTime;
var timeDiff = function (start, end) { return exports.timestampOps.diff(start, end); };
exports.timeDiff = timeDiff;
var createTimeRange = function (start, duration) { return exports.timestampOps.createRange(start, duration); };
exports.createTimeRange = createTimeRange;

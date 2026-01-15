export class SimpleUUID {
    generateFast() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    generateSecure() {
        return crypto.randomUUID();
    }
    generate(secure = false) {
        return secure ? this.generateSecure() : this.generateFast();
    }
}
export class SimpleTimestamp {
    now() {
        return Date.now();
    }
    format(timestamp, options = {}) {
        const date = new Date(timestamp);
        let result = date.toISOString().split('T')[0];
        const timePart = date.toTimeString().split(' ')[0];
        result += ' ' + timePart;
        if (options.includeMilliseconds) {
            result += '.' + date.getMilliseconds().toString().padStart(3, '0');
        }
        return result;
    }
    diff(start, end) {
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return { hours, minutes, seconds };
    }
    createRange(start, duration) {
        return {
            start,
            end: start + duration,
            duration
        };
    }
    isInRange(timestamp, start, end) {
        return timestamp >= start && timestamp <= end;
    }
}
export const uuidGenerator = new SimpleUUID();
export const timestampOps = new SimpleTimestamp();
export const generateUUID = (secure = false) => uuidGenerator.generate(secure);
export const generateFastUUID = () => uuidGenerator.generateFast();
export const generateSecureUUID = () => uuidGenerator.generateSecure();
export const now = () => timestampOps.now();
export const formatTime = (timestamp, options) => timestampOps.format(timestamp, options);
export const timeDiff = (start, end) => timestampOps.diff(start, end);
export const createTimeRange = (start, duration) => timestampOps.createRange(start, duration);
//# sourceMappingURL=simple-utils.js.map
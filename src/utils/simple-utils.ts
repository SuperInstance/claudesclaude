/**
 * Simplified Utilities - Essential utilities in one file
 */

// UUID generation
export class SimpleUUID {
  generateFast(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateSecure(): string {
    return crypto.randomUUID();
  }

  generate(secure = false): string {
    return secure ? this.generateSecure() : this.generateFast();
  }
}

// Timestamp operations
export class SimpleTimestamp {
  now(): number {
    return Date.now();
  }

  format(timestamp: number, options: { includeTimezone?: boolean; includeMilliseconds?: boolean } = {}): string {
    const date = new Date(timestamp);
    let result = date.toISOString().split('T')[0];

    const timePart = date.toTimeString().split(' ')[0];
    result += ' ' + timePart;

    if (options.includeMilliseconds) {
      result += '.' + date.getMilliseconds().toString().padStart(3, '0');
    }

    return result;
  }

  diff(start: number, end: number): { hours: number; minutes: number; seconds: number } {
    const diff = Math.abs(end - start);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds };
  }

  createRange(start: number, duration: number): { start: number; end: number; duration: number } {
    return {
      start,
      end: start + duration,
      duration
    };
  }

  isInRange(timestamp: number, start: number, end: number): boolean {
    return timestamp >= start && timestamp <= end;
  }
}

// Singleton instances
export const uuidGenerator = new SimpleUUID();
export const timestampOps = new SimpleTimestamp();

// Convenience functions
export const generateUUID = (secure = false) => uuidGenerator.generate(secure);
export const generateFastUUID = () => uuidGenerator.generateFast();
export const generateSecureUUID = () => uuidGenerator.generateSecure();

export const now = () => timestampOps.now();
export const formatTime = (timestamp: number, options?: any) => timestampOps.format(timestamp, options);
export const timeDiff = (start: number, end: number) => timestampOps.diff(start, end);
export const createTimeRange = (start: number, duration: number) => timestampOps.createRange(start, duration);
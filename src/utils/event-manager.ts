export interface EventManagerOptions {
  enableWeakReferences?: boolean;
  enableBatching?: boolean;
  maxListeners?: number;
}

export interface EventManagerMetrics {
  totalEventsEmitted: number;
  totalEventsProcessed: number;
  averageProcessingTime: number;
  memoryUsage: number;
  activeListeners: number;
}

export class OptimizedEventManager {
  private events = new Map<string, Set<Function>>();
  private options: Required<EventManagerOptions>;
  private metrics: EventManagerMetrics;
  private processingTimes: number[] = [];

  constructor(options: EventManagerOptions = {}) {
    this.options = {
      enableWeakReferences: false,
      enableBatching: false,
      maxListeners: 100,
      ...options
    };

    this.metrics = this.initializeMetrics();
  }

  on(event: string, handler: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }

    const listeners = this.events.get(event)!;

    // Check max listeners limit
    if (listeners.size >= this.options.maxListeners) {
      console.warn(`Possible memory leak detected for event "${event}". ${listeners.size} listeners added.`);
    }

    if (this.options.enableWeakReferences) {
      // Use WeakMap for weak references (requires more complex implementation)
      // For simplicity, we'll just use regular references
      listeners.add(handler);
    } else {
      listeners.add(handler);
    }
  }

  off(event: string, handler: Function): boolean {
    const listeners = this.events.get(event);
    if (listeners) {
      return listeners.delete(handler);
    }
    return false;
  }

  emit(event: string, data: any): void {
    const startTime = performance.now();
    const listeners = this.events.get(event);

    if (listeners) {
      // Convert to array to avoid modification during iteration
      const handlers = Array.from(listeners);

      for (const handler of handlers) {
        try {
          handler(data);
          this.metrics.totalEventsProcessed++;
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      }
    }

    this.metrics.totalEventsEmitted++;

    const processingTime = performance.now() - startTime;
    this.processingTimes.push(processingTime);

    // Keep only last 1000 processing times for average calculation
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }

    this.updateMetrics();
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.size : 0;
  }

  getAllEvents(): string[] {
    return Array.from(this.events.keys());
  }

  getMetrics(): EventManagerMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    this.metrics.activeListeners = Array.from(this.events.values())
      .reduce((total, listeners) => total + listeners.size, 0);

    this.metrics.averageProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;

    this.metrics.memoryUsage = this.calculateMemoryUsage();
  }

  private calculateMemoryUsage(): number {
    // Simple memory estimation
    const eventsMemory = this.events.size * 1024; // 1KB per event
    const listenersMemory = this.metrics.activeListeners * 256; // 256B per listener
    return eventsMemory + listenersMemory;
  }

  private initializeMetrics(): EventManagerMetrics {
    return {
      totalEventsEmitted: 0,
      totalEventsProcessed: 0,
      averageProcessingTime: 0,
      memoryUsage: 0,
      activeListeners: 0
    };
  }

  cleanup(): void {
    // Remove empty event sets
    for (const [event, listeners] of this.events.entries()) {
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }

    // Clean up old processing times
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.processingTimes = this.processingTimes.filter(time =>
      performance.now() - time < oneHourAgo
    );
  }

  shutdown(): void {
    this.events.clear();
    this.processingTimes = [];
    this.metrics = this.initializeMetrics();
  }

  // Utility method to get event statistics
  getEventStats() {
    const stats: Record<string, number> = {};

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
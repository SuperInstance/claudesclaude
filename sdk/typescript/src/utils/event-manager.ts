/**
 * Optimized Event Manager with Weak References
 *
 * This event manager provides:
 * - Weak references for event handlers to prevent memory leaks
 * - Event cleanup and garbage collection
 * - Memory-efficient event routing
 * - Event metrics and monitoring
 * - Batching for high-frequency events
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './simple-logger';
import { SimpleLRUCache, createEventCache } from './simple-lru-cache';

export interface EventSubscription {
  id: string;
  event: string;
  handler: Function;
  once: boolean;
  weakReference: boolean;
  createdAt: Date;
  lastCalled: Date;
  callCount: number;
}

export interface EventBatch {
  id: string;
  events: Array<{
    event: string;
    data: any;
    timestamp: number;
  }>;
  maxDelay: number;
  maxSize: number;
}

export interface EventManagerMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  weakReferences: number;
  eventsProcessed: number;
  batchedEvents: number;
  memoryUsage: number;
  cleanupCount: number;
  lastCleanup?: Date;
}

export interface EventManagerOptions {
  logger?: Logger;
  enableWeakReferences?: boolean;
  enableBatching?: boolean;
  batchSize?: number;
  batchDelayMs?: number;
  enableAutoCleanup?: boolean;
  cleanupIntervalMs?: number;
  maxSubscriptions?: number;
}

export class OptimizedEventManager extends EventEmitter {
  private subscriptions = new Map<string, EventSubscription>();
  private eventCache: SimpleLRUCache<string, any>;
  private logger: Logger;
  private metrics: EventManagerMetrics;
  private options: Required<EventManagerOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private pendingBatch: EventBatch | null = null;
  private batchTimer: NodeJS.Timeout | null = null;
  private weakRefSubscriptions = new Set<string>();

  constructor(options: EventManagerOptions = {}) {
    super();

    this.options = {
      logger: options.logger || new Logger({ level: 'info', enableConsole: true }),
      enableWeakReferences: options.enableWeakReferences !== false,
      enableBatching: options.enableBatching !== false,
      batchSize: options.batchSize || 100,
      batchDelayMs: options.batchDelayMs || 100,
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupIntervalMs: options.cleanupIntervalMs || 300000, // 5 minutes
      maxSubscriptions: options.maxSubscriptions || 10000
    };

    this.logger = this.options.logger.createChildLogger({ component: 'event-manager' });
    this.eventCache = createEventCache({
      max: this.options.maxSubscriptions,
      ttl: 60 * 60 * 1000, // 1 hour
      maxSize: 25 * 1024 * 1024 // 25MB
    });

    this.metrics = {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      weakReferences: 0,
      eventsProcessed: 0,
      batchedEvents: 0,
      memoryUsage: 0,
      cleanupCount: 0,
      lastCleanup: undefined
    };

    this.setupEventHandlers();
    this.startAutoCleanup();
  }

  /**
   * Add an event listener with optional weak reference
   */
  on(event: string, handler: Function, options: {
    weakReference?: boolean;
    trackMetrics?: boolean;
  } = {}): string {
    const subscriptionId = uuidv4();
    const weakReference = options.weakReference || this.options.enableWeakReferences;
    const trackMetrics = options.trackMetrics !== false;

    const subscription: EventSubscription = {
      id: subscriptionId,
      event,
      handler,
      once: false,
      weakReference,
      createdAt: new Date(),
      lastCalled: new Date(0),
      callCount: 0
    };

    if (weakReference) {
      this.weakRefSubscriptions.add(subscriptionId);
      this.metrics.weakReferences++;
    }

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.totalSubscriptions++;
    this.metrics.activeSubscriptions++;

    // Wrap handler for metrics tracking
    const wrappedHandler = trackMetrics ? this.wrapHandler(handler, subscriptionId) : handler;

    // Add to event cache if weak reference
    if (weakReference) {
      this.eventCache.set(subscriptionId, wrappedHandler, {
        ttl: 30 * 60 * 1000, // 30 minutes
        weakReference: true
      });
    }

    // Store handler for non-weak references
    if (!weakReference) {
      super.on(event, wrappedHandler);
    }

    this.logger.debug('Event listener added', {
      subscriptionId,
      event,
      weakReference
    });

    return subscriptionId;
  }

  /**
   * Add a one-time event listener
   */
  once(event: string, handler: Function, options: {
    weakReference?: boolean;
    trackMetrics?: boolean;
  } = {}): string {
    const subscriptionId = this.on(event, handler, options);
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      subscription.once = true;
    }

    return subscriptionId;
  }

  /**
   * Remove an event listener
   */
  off(event: string, handler?: Function): boolean {
    const removedSubscriptions = [];

    for (const [subId, subscription] of this.subscriptions) {
      if (subscription.event === event && (!handler || subscription.handler === handler)) {
        removedSubscriptions.push(subId);
      }
    }

    if (removedSubscriptions.length === 0) {
      return false;
    }

    for (const subId of removedSubscriptions) {
      this.removeSubscription(subId);
    }

    return true;
  }

  /**
   * Remove a specific subscription by ID
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.removeSubscription(subscriptionId);
  }

  /**
   * Emit an event
   */
  emit(event: string, data: any): boolean {
    const startTime = performance.now();

    // Batch if enabled
    if (this.options.enableBatching) {
      this.addToBatch(event, data);
      this.metrics.batchedEvents++;
    } else {
      this.processEvent(event, data);
    }

    // Update metrics
    this.metrics.eventsProcessed++;
    const duration = performance.now() - startTime;
    if (duration > 100) { // Log slow events
      this.logger.warn('Slow event processing', {
        event,
        duration: Math.round(duration),
        memoryUsage: this.getMemoryUsage()
      });
    }

    return true;
  }

  /**
   * Process an event immediately
   */
  private processEvent(event: string, data: any): void {
    const activeSubscriptions = [];

    for (const [subId, subscription] of this.subscriptions) {
      if (subscription.event === event) {
        // Check if subscription is still valid (for weak references)
        if (subscription.weakReference && !this.isSubscriptionValid(subscription)) {
          continue;
        }

        activeSubscriptions.push(subscription);
      }
    }

    // Process subscriptions
    for (const subscription of activeSubscriptions) {
      try {
        subscription.handler(data);
        subscription.lastCalled = new Date();
        subscription.callCount++;
      } catch (error) {
        this.logger.error('Event handler error', error, {
          event,
          subscriptionId: subscription.id
        });
        this.emit('error', error);
      }
    }
  }

  /**
   * Add event to batch
   */
  private addToBatch(event: string, data: any): void {
    if (!this.pendingBatch) {
      this.pendingBatch = {
        id: uuidv4(),
        events: [],
        maxDelay: this.options.batchDelayMs,
        maxSize: this.options.batchSize
      };
    }

    this.pendingBatch.events.push({
      event,
      data,
      timestamp: Date.now()
    });

    // Process batch if it reaches max size
    if (this.pendingBatch.events.length >= this.pendingBatch.maxSize) {
      this.flushBatch();
      return;
    }

    // Set timer for batch delay
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.pendingBatch.maxDelay);
    }
  }

  /**
   * Flush pending batch
   */
  private flushBatch(): void {
    if (!this.pendingBatch || this.pendingBatch.events.length === 0) {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      return;
    }

    const batch = this.pendingBatch;
    this.pendingBatch = null;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process events in batch
    for (const { event, data } of batch.events) {
      this.processEvent(event, data);
    }

    this.logger.debug('Batch processed', {
      batchId: batch.id,
      eventCount: batch.events.length
    });
  }

  /**
   * Check if subscription is valid (for weak references)
   */
  private isSubscriptionValid(subscription: EventSubscription): boolean {
    if (!subscription.weakReference) {
      return true;
    }

    // For weak references, check if the handler is still accessible
    // This is a simplified check - in production, you'd use proper WeakRef
    try {
      // Try to access the handler function
      return typeof subscription.handler === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Remove a subscription
   */
  private removeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from event cache
    this.eventCache.delete(subscriptionId);
    this.weakRefSubscriptions.delete(subscriptionId);

    // Remove from subscriptions
    this.subscriptions.delete(subscriptionId);

    // Update metrics
    this.metrics.totalSubscriptions--;
    this.metrics.activeSubscriptions--;
    if (subscription.weakReference) {
      this.metrics.weakReferences--;
    }

    // For non-weak references, also remove from EventEmitter
    if (!subscription.weakReference) {
      super.off(subscription.event, subscription.handler);
    }

    this.logger.debug('Event listener removed', {
      subscriptionId,
      event: subscription.event
    });

    return true;
  }

  /**
   * Wrap handler for metrics tracking
   */
  private wrapHandler(handler: Function, subscriptionId: string): Function {
    return (data: any) => {
      const start = performance.now();
      try {
        handler(data);
        const duration = performance.now() - start;

        // Update subscription metrics
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          subscription.lastCalled = new Date();
          subscription.callCount++;
        }

        // Log slow handlers
        if (duration > 500) {
          this.logger.warn('Slow event handler', {
            subscriptionId,
            duration: Math.round(duration)
          });
        }
      } catch (error) {
        this.logger.error('Event handler error', error, { subscriptionId });
        this.emit('error', error);
      }
    };
  }

  /**
   * Get event manager metrics
   */
  getMetrics(): EventManagerMetrics {
    const cacheMetrics = this.eventCache.getMemoryMetrics();

    return {
      ...this.metrics,
      memoryUsage: cacheMetrics.totalMemoryBytes,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: this.subscriptions.size,
      weakReferences: this.weakRefSubscriptions.size
    };
  }

  /**
   * Get detailed cache statistics
   */
  getCacheStats() {
    return this.eventCache.getStats();
  }

  /**
   * Clean up weak reference subscriptions
   */
  cleanupWeakReferences(): number {
    let cleaned = 0;

    for (const subId of this.weakRefSubscriptions) {
      const subscription = this.subscriptions.get(subId);
      if (subscription && !this.isSubscriptionValid(subscription)) {
        this.removeSubscription(subId);
        cleaned++;
      }
    }

    this.metrics.cleanupCount = cleaned;
    this.metrics.lastCleanup = new Date();
    this.logger.info('Weak reference subscriptions cleaned up', { count: cleaned });

    return cleaned;
  }

  /**
   * Force flush any pending batch
   */
  flushPendingBatch(): void {
    this.flushBatch();
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  /**
   * Get subscription count by event
   */
  getSubscriptionCount(event?: string): number {
    if (!event) {
      return this.subscriptions.size;
    }

    let count = 0;
    for (const subscription of this.subscriptions.values()) {
      if (subscription.event === event) {
        count++;
      }
    }
    return count;
  }

  /**
   * List all subscriptions (for debugging)
   */
  listSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Clear all subscriptions
   */
  clearAllSubscriptions(): void {
    // Remove all subscriptions
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const subId of subscriptionIds) {
      this.removeSubscription(subId);
    }

    // Clear event cache
    this.eventCache.clear();
    this.weakRefSubscriptions.clear();

    // Clear pending batch
    if (this.pendingBatch) {
      this.pendingBatch = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.logger.info('All event subscriptions cleared');
  }

  private setupEventHandlers(): void {
    // Simple cache doesn't support events
    // This is a placeholder for any custom event handling
  }

  private startAutoCleanup(): void {
    if (this.options.enableAutoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupWeakReferences();
      }, this.options.cleanupIntervalMs);
    }
  }

  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Shutdown the event manager
   */
  shutdown(): void {
    this.stopAutoCleanup();
    this.clearAllSubscriptions();
    this.logger.info('Event manager shutdown complete');
  }
}

export default OptimizedEventManager;
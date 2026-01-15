/**
 * Message Bus Client for the Orchestration SDK
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageFilter, MessageBusStats, APIResponse, MessagePriority, MessageType } from '../types';
import { Logger } from '../utils/logger';
import { ValidationError, MessageTimeoutError } from '../../claudesclaude/dist/src/core/types';

export interface MessageBusConfig {
  queuePath?: string;
  maxQueueSize?: number;
  gcIntervalMs?: number;
}

export interface MessageBusOptions {
  config?: Partial<MessageBusConfig>;
  logger?: Logger;
}

export interface Subscription {
  id: string;
  filter?: MessageFilter;
  unsubscribe: () => void;
}

export class MessageBusClient extends EventEmitter {
  private config: Required<MessageBusConfig>;
  private logger: Logger;
  private subscribers: Map<string, { callback: (message: Message) => Promise<void>; filter?: MessageFilter }> = new Map();
  private stats: MessageBusStats;
  private processing = false;
  private gcInterval: NodeJS.Timeout | null = null;
  private pendingBatch: Message[] = [];
  private batching = false;

  constructor(options: MessageBusOptions = {}) {
    super();

    this.config = {
      queuePath: './.orchestration/queue',
      maxQueueSize: 10000,
      gcIntervalMs: 60000,
      ...options.config
    };

    this.logger = options.logger || new Logger({
      level: 'info',
      enableConsole: true,
      enableFile: false
    });

    this.stats = {
      messagesPublished: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      averageLatency: 0,
      subscribers: 0,
      queueSize: 0
    };

    // Initialize directories
    this.initializeDirectories().catch(error => {
      this.logger.error('Failed to initialize message bus directories', error);
    });

    // Start garbage collection
    this.startGarbageCollection();

    this.logger.info('Message bus client initialized', { config: this.config });
  }

  private async initializeDirectories(): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    const dirs = [
      path.join(this.config.queuePath, 'pending'),
      path.join(this.config.queuePath, 'processed'),
      path.join(this.config.queuePath, 'error')
    ];

    await Promise.all(dirs.map(dir => fs.mkdir(dir, { recursive: true })));
  }

  private startGarbageCollection(): void {
    this.gcInterval = setInterval(() => {
      this.cleanupExpiredMessages().catch(error => {
        this.logger.error('Garbage collection failed', error);
      });
    }, this.gcIntervalMs);
  }

  /**
   * Publish a message to the message bus
   */
  async publish(message: Omit<Message, 'id' | 'timestamp'>): Promise<string> {
    this.validateMessage(message);

    const fullMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    await this.writeMessageFile(fullMessage);
    this.stats.messagesPublished++;
    this.stats.queueSize++;
    this.emit('messagePublished', fullMessage);

    // Start processing if not already running
    if (!this.processing) {
      setImmediate(() => this.processQueue());
    }

    return fullMessage.id;
  }

  /**
   * Publish multiple messages in a batch
   */
  async publishBatch(messages: Omit<Message, 'id' | 'timestamp'>[]): Promise<string[]> {
    if (messages.length === 0) {
      return [];
    }

    if (messages.length > this.config.maxQueueSize) {
      throw new ValidationError('Batch size exceeds maximum queue size', 'batchSize', messages.length);
    }

    const messageIds: string[] = [];

    for (const message of messages) {
      const messageId = await this.publish(message);
      messageIds.push(messageId);
    }

    this.emit('batchPublished', { batchId: uuidv4(), messageCount: messages.length });
    return messageIds;
  }

  /**
   * Add message to batch for delayed processing
   */
  async publishToBatch(message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    this.validateMessage(message);

    const fullMessage: Message = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    this.pendingBatch.push(fullMessage);

    // Start batching timer if not already running
    if (!this.batching) {
      this.batching = true;
      setTimeout(() => {
        this.flushBatch();
      }, 100);
    }

    // Process batch immediately if it reaches batch size
    if (this.pendingBatch.length >= 10) {
      await this.flushBatch();
    }
  }

  /**
   * Flush pending batch to disk
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingBatch.length === 0) {
      this.batching = false;
      return;
    }

    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    this.batching = false;

    await this.publishBatch(batch);
  }

  /**
   * Subscribe to messages with optional filtering
   */
  subscribe(callback: (message: Message) => Promise<void>, filter?: MessageFilter): Subscription {
    const subscriptionId = `sub-${uuidv4()}`;
    const wrappedSubscriber = {
      id: subscriptionId,
      callback,
      filter
    };

    this.subscribers.set(subscriptionId, wrappedSubscriber);
    this.stats.subscribers = this.subscribers.size;

    // Return unsubscribe function
    return {
      id: subscriptionId,
      unsubscribe: () => {
        this.subscribers.delete(subscriptionId);
        this.stats.subscribers = this.subscribers.size;
      }
    };
  }

  /**
   * Send a request and wait for response
   */
  async request(
    request: Omit<Message, 'id' | 'timestamp' | 'requiresResponse'>,
    timeout: number = 30000
  ): Promise<Message> {
    const requestId = `req-${request.id}`;
    const responsePromise = new Promise<Message>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(responseEvent, handler);
        reject(new MessageTimeoutError(request.id, timeout));
      }, timeout);

      const handler = (response: Message) => {
        if (response.metadata?.correlationId === requestId) {
          clearTimeout(timer);
          this.off(responseEvent, handler);
          resolve(response);
        }
      };

      const responseEvent = `response:${requestId}`;
      this.on(responseEvent, handler);
    });

    // Add correlation ID for response matching
    const fullRequest: Message = {
      ...request,
      id: uuidv4(),
      timestamp: new Date(),
      requiresResponse: true,
      metadata: {
        ...request.metadata,
        correlationId: requestId
      },
      retryCount: 0,
      maxRetries: 3
    };

    await this.publish(fullRequest);
    return responsePromise;
  }

  /**
   * Acknowledge a message has been processed
   */
  async acknowledge(messageId: string): Promise<void> {
    try {
      await this.moveMessage(messageId, 'pending', 'processed');
      this.stats.queueSize--;
      this.stats.messagesDelivered++;
      await this.updateLatencyStats(messageId);
    } catch (error) {
      throw new Error(`Failed to acknowledge message: ${error}`);
    }
  }

  /**
   * Reject a message (move to error queue)
   */
  async reject(messageId: string, reason: string): Promise<void> {
    try {
      const messageFile = `${this.config.queuePath}/pending/${messageId}.json`;
      const fs = require('fs/promises');

      const messageData = await fs.readFile(messageFile, 'utf8');
      const message = JSON.parse(messageData);

      // Add rejection metadata
      message.metadata.rejectionReason = reason;
      message.metadata.rejectedAt = new Date().toISOString();

      const errorFile = `${this.config.queuePath}/error/${messageId}.json`;
      await fs.writeFile(errorFile, JSON.stringify(message, null, 2));
      await fs.unlink(messageFile);

      this.stats.queueSize--;
      this.stats.messagesFailed++;
    } catch (error) {
      throw new Error(`Failed to reject message: ${error}`);
    }
  }

  /**
   * Process messages in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.stats.queueSize > 0) {
        await this.processNextMessage();
      }
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.processing = false;
    }
  }

  private async processNextMessage(): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    try {
      const pendingDir = path.join(this.config.queuePath, 'pending');
      const files = await fs.readdir(pendingDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const messageId = file.replace('.json', '');
        await this.processMessage(messageId);
        break; // Process one message at a time
      }
    } catch (error) {
      this.logger.error('Failed to process queue', error);
    }
  }

  private async processMessage(messageId: string): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    const messageFile = path.join(this.config.queuePath, 'pending', `${messageId}.json`);

    try {
      const messageData = await fs.readFile(messageFile, 'utf8');
      const parsedData = JSON.parse(messageData);
      const message: Message = {
        ...parsedData,
        timestamp: new Date(parsedData.timestamp)
      };

      // Filter subscribers
      const matchingSubscribers = this.getMatchingSubscribers(message);
      if (matchingSubscribers.length === 0) {
        await this.acknowledge(messageId);
        return;
      }

      // Process message with each subscriber
      const processingPromises = matchingSubscribers.map(async (subscriber) => {
        try {
          await subscriber.callback(message);
          await this.acknowledge(messageId);
        } catch (error) {
          await this.handleSubscriberError(messageId, error);
        }
      });

      await Promise.all(processingPromises);
    } catch (error) {
      await this.reject(messageId, `Processing error: ${error}`);
    }
  }

  private getMatchingSubscribers(message: Message): Array<{ callback: (message: Message) => Promise<void> }> {
    const matching = [];

    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.filter) {
        matching.push(subscriber);
        continue;
      }

      const filter = subscriber.filter;
      let matches = true;

      // Check type filter
      if (filter.types && !filter.types.includes(message.type)) {
        matches = false;
      }

      // Check priority filter
      if (filter.priorities && !filter.priorities.includes(message.priority)) {
        matches = false;
      }

      // Check sender filter
      if (filter.senders && !filter.senders.includes(message.sender)) {
        matches = false;
      }

      // Check receiver filter
      if (filter.receivers && message.receiver && !filter.receivers.includes(message.receiver)) {
        matches = false;
      }

      // Check tags filter
      if (filter.tags && filter.tags.length > 0) {
        const hasTag = filter.tags.some(tag =>
          message.metadata?.tags?.includes(tag) ||
          Object.keys(message.metadata || {}).some(key =>
            key.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasTag) matches = false;
      }

      if (matches) {
        matching.push(subscriber);
      }
    }

    return matching;
  }

  private async handleSubscriberError(messageId: string, error: any): Promise<void> {
    this.stats.messagesFailed++;
    this.logger.error('Subscriber processing error', error, { messageId });

    // Retry logic
    const messageFile = `${this.config.queuePath}/pending/${messageId}.json`;
    const fs = require('fs/promises');

    try {
      const messageData = await fs.readFile(messageFile, 'utf8');
      const message = JSON.parse(messageData);
      message.retryCount++;

      if (message.retryCount >= message.maxRetries) {
        await this.reject(messageId, `Max retries exceeded: ${error}`);
      } else {
        // Update retry count and put back in queue
        message.retryCount++;
        await fs.writeFile(messageFile, JSON.stringify(message, null, 2));
      }
    } catch (fileError) {
      this.logger.error('Failed to handle subscriber error', fileError);
    }
  }

  private async updateLatencyStats(messageId: string): Promise<void> {
    try {
      const processedFile = `${this.config.queuePath}/processed/${messageId}.json`;
      const fs = require('fs/promises');

      const messageData = await fs.readFile(processedFile, 'utf8');
      const message = JSON.parse(messageData);
      const latency = Date.now() - new Date(message.timestamp).getTime();

      // Update average latency (exponential moving average)
      const alpha = 0.1;
      this.stats.averageLatency = alpha * latency + (1 - alpha) * this.stats.averageLatency;
    } catch {
      // Ignore latency calculation errors
    }
  }

  private async writeMessageFile(message: Message): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    const messageFile = path.join(this.config.queuePath, 'pending', `${message.id}.json`);
    const messageData = {
      ...message,
      timestamp: message.timestamp.toISOString()
    };

    await fs.writeFile(messageFile, JSON.stringify(messageData, null, 2));
  }

  private async moveMessage(messageId: string, fromDir: string, toDir: string): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    const sourceFile = path.join(this.config.queuePath, fromDir, `${messageId}.json`);
    const destFile = path.join(this.config.queuePath, toDir, `${messageId}.json`);

    await fs.rename(sourceFile, destFile);
  }

  private async cleanupExpiredMessages(): Promise<void> {
    try {
      const fs = require('fs/promises');
      const path = require('path');

      const now = Date.now();
      const dirs = ['pending', 'processed'];

      for (const dir of dirs) {
        const dirPath = path.join(this.config.queuePath, dir);
        const files = await fs.readdir(dirPath);

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = path.join(dirPath, file);
          const stat = await fs.stat(filePath);

          if (now - stat.mtime.getTime() > 24 * 60 * 60 * 1000) { // 24 hours
            await fs.unlink(filePath);
            this.stats.queueSize--;
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired messages', error);
    }
  }

  private validateMessage(message: Omit<Message, 'id' | 'timestamp'>): void {
    if (!message.type) {
      throw new ValidationError('Message type is required', 'type');
    }

    if (!Object.values(MessageType).includes(message.type)) {
      throw new ValidationError(`Invalid message type: ${message.type}`, 'type');
    }

    if (!message.sender) {
      throw new ValidationError('Message sender is required', 'sender');
    }

    if (typeof message.content === 'undefined') {
      throw new ValidationError('Message content is required', 'content');
    }

    if (!Object.values(MessagePriority).includes(message.priority)) {
      throw new ValidationError(`Invalid message priority: ${message.priority}`, 'priority');
    }
  }

  /**
   * Get message bus statistics
   */
  getStats(): MessageBusStats {
    return { ...this.stats };
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    try {
      const fs = require('fs/promises');
      const path = require('path');

      const pendingDir = path.join(this.config.queuePath, 'pending');
      const files = await fs.readdir(pendingDir);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const queueSize = await this.getQueueSize();

    if (queueSize > this.config.maxQueueSize * 0.9) {
      return {
        status: 'unhealthy',
        details: {
          queueSize,
          maxQueueSize: this.config.maxQueueSize,
          message: 'Queue approaching maximum capacity'
        }
      };
    }

    if (queueSize > this.config.maxQueueSize * 0.7) {
      return {
        status: 'degraded',
        details: {
          queueSize,
          maxQueueSize: this.config.maxQueueSize,
          message: 'Queue size elevated'
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        queueSize,
        maxQueueSize: this.config.maxQueueSize,
        subscribers: this.subscribers.size,
        stats: this.stats
      }
    };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MessageBusConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.logger.info('Message bus configuration updated', { config });
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }

    // Process any remaining messages
    await this.processQueue();
    this.emit('shutdown');

    this.logger.info('Message bus shutdown complete');
  }
}
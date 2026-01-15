import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageFilter, MessageBusStats, APIResponse, MessagePriority, MessageType } from '../types';
import { Logger } from '../utils/logger';
import { ValidationError, MessageTimeoutError } from '../../claudesclaude/dist/src/core/types';
export class MessageBusClient extends EventEmitter {
    config;
    logger;
    subscribers = new Map();
    stats;
    processing = false;
    gcInterval = null;
    pendingBatch = [];
    batching = false;
    constructor(options = {}) {
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
        this.initializeDirectories().catch(error => {
            this.logger.error('Failed to initialize message bus directories', error);
        });
        this.startGarbageCollection();
        this.logger.info('Message bus client initialized', { config: this.config });
    }
    async initializeDirectories() {
        const fs = require('fs/promises');
        const path = require('path');
        const dirs = [
            path.join(this.config.queuePath, 'pending'),
            path.join(this.config.queuePath, 'processed'),
            path.join(this.config.queuePath, 'error')
        ];
        await Promise.all(dirs.map(dir => fs.mkdir(dir, { recursive: true })));
    }
    startGarbageCollection() {
        this.gcInterval = setInterval(() => {
            this.cleanupExpiredMessages().catch(error => {
                this.logger.error('Garbage collection failed', error);
            });
        }, this.gcIntervalMs);
    }
    async publish(message) {
        this.validateMessage(message);
        const fullMessage = {
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
        if (!this.processing) {
            setImmediate(() => this.processQueue());
        }
        return fullMessage.id;
    }
    async publishBatch(messages) {
        if (messages.length === 0) {
            return [];
        }
        if (messages.length > this.config.maxQueueSize) {
            throw new ValidationError('Batch size exceeds maximum queue size', 'batchSize', messages.length);
        }
        const messageIds = [];
        for (const message of messages) {
            const messageId = await this.publish(message);
            messageIds.push(messageId);
        }
        this.emit('batchPublished', { batchId: uuidv4(), messageCount: messages.length });
        return messageIds;
    }
    async publishToBatch(message) {
        this.validateMessage(message);
        const fullMessage = {
            ...message,
            id: uuidv4(),
            timestamp: new Date(),
            retryCount: 0,
            maxRetries: 3
        };
        this.pendingBatch.push(fullMessage);
        if (!this.batching) {
            this.batching = true;
            setTimeout(() => {
                this.flushBatch();
            }, 100);
        }
        if (this.pendingBatch.length >= 10) {
            await this.flushBatch();
        }
    }
    async flushBatch() {
        if (this.pendingBatch.length === 0) {
            this.batching = false;
            return;
        }
        const batch = [...this.pendingBatch];
        this.pendingBatch = [];
        this.batching = false;
        await this.publishBatch(batch);
    }
    subscribe(callback, filter) {
        const subscriptionId = `sub-${uuidv4()}`;
        const wrappedSubscriber = {
            id: subscriptionId,
            callback,
            filter
        };
        this.subscribers.set(subscriptionId, wrappedSubscriber);
        this.stats.subscribers = this.subscribers.size;
        return {
            id: subscriptionId,
            unsubscribe: () => {
                this.subscribers.delete(subscriptionId);
                this.stats.subscribers = this.subscribers.size;
            }
        };
    }
    async request(request, timeout = 30000) {
        const requestId = `req-${request.id}`;
        const responsePromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(responseEvent, handler);
                reject(new MessageTimeoutError(request.id, timeout));
            }, timeout);
            const handler = (response) => {
                if (response.metadata?.correlationId === requestId) {
                    clearTimeout(timer);
                    this.off(responseEvent, handler);
                    resolve(response);
                }
            };
            const responseEvent = `response:${requestId}`;
            this.on(responseEvent, handler);
        });
        const fullRequest = {
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
    async acknowledge(messageId) {
        try {
            await this.moveMessage(messageId, 'pending', 'processed');
            this.stats.queueSize--;
            this.stats.messagesDelivered++;
            await this.updateLatencyStats(messageId);
        }
        catch (error) {
            throw new Error(`Failed to acknowledge message: ${error}`);
        }
    }
    async reject(messageId, reason) {
        try {
            const messageFile = `${this.config.queuePath}/pending/${messageId}.json`;
            const fs = require('fs/promises');
            const messageData = await fs.readFile(messageFile, 'utf8');
            const message = JSON.parse(messageData);
            message.metadata.rejectionReason = reason;
            message.metadata.rejectedAt = new Date().toISOString();
            const errorFile = `${this.config.queuePath}/error/${messageId}.json`;
            await fs.writeFile(errorFile, JSON.stringify(message, null, 2));
            await fs.unlink(messageFile);
            this.stats.queueSize--;
            this.stats.messagesFailed++;
        }
        catch (error) {
            throw new Error(`Failed to reject message: ${error}`);
        }
    }
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        try {
            while (this.stats.queueSize > 0) {
                await this.processNextMessage();
            }
        }
        catch (error) {
            this.emit('error', error);
        }
        finally {
            this.processing = false;
        }
    }
    async processNextMessage() {
        const fs = require('fs/promises');
        const path = require('path');
        try {
            const pendingDir = path.join(this.config.queuePath, 'pending');
            const files = await fs.readdir(pendingDir);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const messageId = file.replace('.json', '');
                await this.processMessage(messageId);
                break;
            }
        }
        catch (error) {
            this.logger.error('Failed to process queue', error);
        }
    }
    async processMessage(messageId) {
        const fs = require('fs/promises');
        const path = require('path');
        const messageFile = path.join(this.config.queuePath, 'pending', `${messageId}.json`);
        try {
            const messageData = await fs.readFile(messageFile, 'utf8');
            const parsedData = JSON.parse(messageData);
            const message = {
                ...parsedData,
                timestamp: new Date(parsedData.timestamp)
            };
            const matchingSubscribers = this.getMatchingSubscribers(message);
            if (matchingSubscribers.length === 0) {
                await this.acknowledge(messageId);
                return;
            }
            const processingPromises = matchingSubscribers.map(async (subscriber) => {
                try {
                    await subscriber.callback(message);
                    await this.acknowledge(messageId);
                }
                catch (error) {
                    await this.handleSubscriberError(messageId, error);
                }
            });
            await Promise.all(processingPromises);
        }
        catch (error) {
            await this.reject(messageId, `Processing error: ${error}`);
        }
    }
    getMatchingSubscribers(message) {
        const matching = [];
        for (const subscriber of this.subscribers.values()) {
            if (!subscriber.filter) {
                matching.push(subscriber);
                continue;
            }
            const filter = subscriber.filter;
            let matches = true;
            if (filter.types && !filter.types.includes(message.type)) {
                matches = false;
            }
            if (filter.priorities && !filter.priorities.includes(message.priority)) {
                matches = false;
            }
            if (filter.senders && !filter.senders.includes(message.sender)) {
                matches = false;
            }
            if (filter.receivers && message.receiver && !filter.receivers.includes(message.receiver)) {
                matches = false;
            }
            if (filter.tags && filter.tags.length > 0) {
                const hasTag = filter.tags.some(tag => message.metadata?.tags?.includes(tag) ||
                    Object.keys(message.metadata || {}).some(key => key.toLowerCase().includes(tag.toLowerCase())));
                if (!hasTag)
                    matches = false;
            }
            if (matches) {
                matching.push(subscriber);
            }
        }
        return matching;
    }
    async handleSubscriberError(messageId, error) {
        this.stats.messagesFailed++;
        this.logger.error('Subscriber processing error', error, { messageId });
        const messageFile = `${this.config.queuePath}/pending/${messageId}.json`;
        const fs = require('fs/promises');
        try {
            const messageData = await fs.readFile(messageFile, 'utf8');
            const message = JSON.parse(messageData);
            message.retryCount++;
            if (message.retryCount >= message.maxRetries) {
                await this.reject(messageId, `Max retries exceeded: ${error}`);
            }
            else {
                message.retryCount++;
                await fs.writeFile(messageFile, JSON.stringify(message, null, 2));
            }
        }
        catch (fileError) {
            this.logger.error('Failed to handle subscriber error', fileError);
        }
    }
    async updateLatencyStats(messageId) {
        try {
            const processedFile = `${this.config.queuePath}/processed/${messageId}.json`;
            const fs = require('fs/promises');
            const messageData = await fs.readFile(processedFile, 'utf8');
            const message = JSON.parse(messageData);
            const latency = Date.now() - new Date(message.timestamp).getTime();
            const alpha = 0.1;
            this.stats.averageLatency = alpha * latency + (1 - alpha) * this.stats.averageLatency;
        }
        catch {
        }
    }
    async writeMessageFile(message) {
        const fs = require('fs/promises');
        const path = require('path');
        const messageFile = path.join(this.config.queuePath, 'pending', `${message.id}.json`);
        const messageData = {
            ...message,
            timestamp: message.timestamp.toISOString()
        };
        await fs.writeFile(messageFile, JSON.stringify(messageData, null, 2));
    }
    async moveMessage(messageId, fromDir, toDir) {
        const fs = require('fs/promises');
        const path = require('path');
        const sourceFile = path.join(this.config.queuePath, fromDir, `${messageId}.json`);
        const destFile = path.join(this.config.queuePath, toDir, `${messageId}.json`);
        await fs.rename(sourceFile, destFile);
    }
    async cleanupExpiredMessages() {
        try {
            const fs = require('fs/promises');
            const path = require('path');
            const now = Date.now();
            const dirs = ['pending', 'processed'];
            for (const dir of dirs) {
                const dirPath = path.join(this.config.queuePath, dir);
                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    if (!file.endsWith('.json'))
                        continue;
                    const filePath = path.join(dirPath, file);
                    const stat = await fs.stat(filePath);
                    if (now - stat.mtime.getTime() > 24 * 60 * 60 * 1000) {
                        await fs.unlink(filePath);
                        this.stats.queueSize--;
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Failed to cleanup expired messages', error);
        }
    }
    validateMessage(message) {
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
    getStats() {
        return { ...this.stats };
    }
    async getQueueSize() {
        try {
            const fs = require('fs/promises');
            const path = require('path');
            const pendingDir = path.join(this.config.queuePath, 'pending');
            const files = await fs.readdir(pendingDir);
            return files.filter(f => f.endsWith('.json')).length;
        }
        catch {
            return 0;
        }
    }
    async healthCheck() {
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
    async updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.logger.info('Message bus configuration updated', { config });
    }
    async shutdown() {
        if (this.gcInterval) {
            clearInterval(this.gcInterval);
        }
        await this.processQueue();
        this.emit('shutdown');
        this.logger.info('Message bus shutdown complete');
    }
}
//# sourceMappingURL=message-bus-client.js.map
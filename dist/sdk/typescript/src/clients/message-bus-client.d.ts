import { EventEmitter } from 'events';
import { Message, MessageFilter, MessageBusStats } from '../types';
import { Logger } from '../utils/logger';
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
export declare class MessageBusClient extends EventEmitter {
    private config;
    private logger;
    private subscribers;
    private stats;
    private processing;
    private gcInterval;
    private pendingBatch;
    private batching;
    constructor(options?: MessageBusOptions);
    private initializeDirectories;
    private startGarbageCollection;
    publish(message: Omit<Message, 'id' | 'timestamp'>): Promise<string>;
    publishBatch(messages: Omit<Message, 'id' | 'timestamp'>[]): Promise<string[]>;
    publishToBatch(message: Omit<Message, 'id' | 'timestamp'>): Promise<void>;
    private flushBatch;
    subscribe(callback: (message: Message) => Promise<void>, filter?: MessageFilter): Subscription;
    request(request: Omit<Message, 'id' | 'timestamp' | 'requiresResponse'>, timeout?: number): Promise<Message>;
    acknowledge(messageId: string): Promise<void>;
    reject(messageId: string, reason: string): Promise<void>;
    private processQueue;
    private processNextMessage;
    private processMessage;
    private getMatchingSubscribers;
    private handleSubscriberError;
    private updateLatencyStats;
    private writeMessageFile;
    private moveMessage;
    private cleanupExpiredMessages;
    private validateMessage;
    getStats(): MessageBusStats;
    getQueueSize(): Promise<number>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: any;
    }>;
    updateConfig(config: Partial<MessageBusConfig>): Promise<void>;
    shutdown(): Promise<void>;
}

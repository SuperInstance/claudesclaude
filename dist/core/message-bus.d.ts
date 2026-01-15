import { EventEmitter } from 'events';
import type { Message } from './types.js';
export declare class MessageBus extends EventEmitter {
    private messages;
    publish(message: Omit<Message, 'id' | 'timestamp'>): void;
    subscribe(callback: (message: Message) => void): void;
    getMessages(): Message[];
    clear(): void;
    processQueue(): void;
    get gcInterval(): any;
    shutdown(): void;
}
export declare function createMessageBus(config?: any): MessageBus;

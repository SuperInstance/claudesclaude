import { EventEmitter } from 'events';
export class MessageBus extends EventEmitter {
    messages = new Map();
    publish(message) {
        const fullMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date()
        };
        this.messages.set(fullMessage.id, fullMessage);
        this.emit('message', fullMessage);
    }
    subscribe(callback) {
        this.on('message', callback);
    }
    getMessages() {
        return Array.from(this.messages.values());
    }
    clear() {
        this.messages.clear();
    }
    processQueue() {
        const messages = this.getMessages();
        messages.forEach(message => {
            this.emit('processed', message);
        });
    }
    get gcInterval() {
        return null;
    }
    shutdown() {
        this.clear();
        this.removeAllListeners();
    }
}
export function createMessageBus(config) {
    const messageBus = new MessageBus();
    if (config && config.enableQueueProcessing) {
        setInterval(() => {
            messageBus.processQueue();
        }, config.queueProcessingInterval || 5000);
    }
    return messageBus;
}
//# sourceMappingURL=message-bus.js.map
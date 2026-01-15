import { EventEmitter } from 'events';
export class MessageBus extends EventEmitter {
    messages = new Map();
    timer;
    publish(message) {
        const fullMessage = { ...message, id: crypto.randomUUID(), timestamp: new Date() };
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
        this.getMessages().forEach(m => this.emit('processed', m));
    }
    get gcInterval() {
        return null;
    }
    shutdown() {
        this.clear();
        this.removeAllListeners();
        if (this.timer)
            clearInterval(this.timer);
    }
}
export function createMessageBus(config) {
    const bus = new MessageBus();
    if (config?.enableQueueProcessing) {
        setInterval(() => bus.processQueue(), config.queueProcessingInterval || 5000);
    }
    return bus;
}
//# sourceMappingURL=message-bus.js.map
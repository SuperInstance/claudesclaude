export class ContextManager {
    contexts = new Map();
    contextWindows = new Map();
    getContext(id) {
        return this.contexts.get(id);
    }
    setContext(id, context) {
        this.contexts.set(id, context);
    }
    getAllContexts() {
        return Array.from(this.contexts.values());
    }
    createContextWindow(windowId, maxItems = 100) {
        this.contextWindows.set(windowId, []);
    }
    addContextItem(windowId, item) {
        const window = this.contextWindows.get(windowId);
        if (window) {
            window.push(item);
            const maxItems = window.length > 5 ? 5 : 100;
            if (window.length > maxItems) {
                window.splice(0, window.length - maxItems);
            }
        }
    }
    getContextWindow(windowId) {
        return this.contextWindows.get(windowId) || [];
    }
    getContextStats() {
        const contexts = Array.from(this.contexts.values());
        const windows = Array.from(this.contextWindows.values());
        const totalItems = windows.reduce((sum, window) => sum + window.length, 0);
        return {
            totalContexts: this.contexts.size,
            totalContextWindows: this.contextWindows.size,
            averageContextSize: contexts.length > 0 ? totalItems / contexts.length : 0
        };
    }
    getContextItems(windowId) {
        return this.getContextWindow(windowId);
    }
    shutdown() {
        this.contexts.clear();
        this.contextWindows.clear();
    }
}
//# sourceMappingURL=context.js.map
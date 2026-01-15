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
        if (!window)
            return;
        window.push(item);
        const max = window.length > 5 ? 5 : 100;
        if (window.length > max)
            window.splice(0, window.length - max);
    }
    getContextWindow(windowId) {
        return this.contextWindows.get(windowId) || [];
    }
    getContextStats() {
        let totalItems = 0;
        this.contextWindows.forEach(w => totalItems += w.length);
        return {
            totalContexts: this.contexts.size,
            totalContextWindows: this.contextWindows.size,
            averageContextSize: this.contexts.size ? totalItems / this.contexts.size : 0
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
export class ContextManager {
    contexts = new Map();
    getContext(id) {
        return this.contexts.get(id);
    }
    setContext(id, context) {
        this.contexts.set(id, context);
    }
    getAllContexts() {
        return Array.from(this.contexts.values());
    }
}
//# sourceMappingURL=context.js.map
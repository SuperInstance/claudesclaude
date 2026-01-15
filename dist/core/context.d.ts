export declare class ContextManager {
    private contexts;
    private contextWindows;
    getContext(id: string): any;
    setContext(id: string, context: any): void;
    getAllContexts(): any[];
    createContextWindow(windowId: string, maxItems?: number): void;
    addContextItem(windowId: string, item: any): void;
    getContextWindow(windowId: string): any[];
    getContextStats(): {
        totalContexts: number;
        totalContextWindows: number;
        averageContextSize: number;
    };
    getContextItems(windowId: string): any[];
    shutdown(): void;
}

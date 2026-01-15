export declare class ContextManager {
    private contexts;
    getContext(id: string): any | undefined;
    setContext(id: string, context: any): void;
    getAllContexts(): any[];
}

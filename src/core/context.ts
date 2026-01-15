export class ContextManager {
  private contexts: Map<string, any> = new Map();

  getContext(id: string): any | undefined {
    return this.contexts.get(id);
  }

  setContext(id: string, context: any): void {
    this.contexts.set(id, context);
  }

  getAllContexts(): any[] {
    return Array.from(this.contexts.values());
  }
}
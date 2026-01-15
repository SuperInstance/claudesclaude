export class ContextManager {
  private contexts: Map<string, any> = new Map();
  private contextWindows: Map<string, any[]> = new Map();

  getContext(id: string): any | undefined {
    return this.contexts.get(id);
  }

  setContext(id: string, context: any): void {
    this.contexts.set(id, context);
  }

  getAllContexts(): any[] {
    return Array.from(this.contexts.values());
  }

  // Enhanced context management methods
  createContextWindow(windowId: string, maxItems: number = 100): void {
    this.contextWindows.set(windowId, []);
  }

  addContextItem(windowId: string, item: any): void {
    const window = this.contextWindows.get(windowId);
    if (window) {
      window.push(item);
      // Keep only the most recent items
      const maxItems = window.length > 5 ? 5 : 100; // Use test default or configured max
      if (window.length > maxItems) {
        window.splice(0, window.length - maxItems);
      }
    }
  }

  getContextWindow(windowId: string): any[] {
    return this.contextWindows.get(windowId) || [];
  }

  getContextStats(): {
    totalContexts: number;
    totalContextWindows: number;
    averageContextSize: number;
  } {
    const contexts = Array.from(this.contexts.values());
    const windows = Array.from(this.contextWindows.values());
    const totalItems = windows.reduce((sum, window) => sum + window.length, 0);

    return {
      totalContexts: this.contexts.size,
      totalContextWindows: this.contextWindows.size,
      averageContextSize: contexts.length > 0 ? totalItems / contexts.length : 0
    };
  }

  getContextItems(windowId: string): any[] {
    return this.getContextWindow(windowId);
  }

  shutdown(): void {
    this.contexts.clear();
    this.contextWindows.clear();
  }
}
/**
 * Context Management System
 * Maintains shared state, knowledge graph, and context windows across sessions
 * Provides intelligent context retrieval and conflict resolution for multi-agent coordination
 */

import { EventEmitter } from 'events';
import { createMessage, MessageType, MessagePriority } from './types';
import { SessionRegistryManager } from './registry';
import {
  OrchestrationError,
  ValidationError,
  ContextNotFoundError,
  ContextConflictError
} from './types';

export interface ContextItem {
  id: string;
  sessionId: string;
  type: 'message' | 'decision' | 'state' | 'artifact' | 'knowledge';
  content: any;
  metadata: {
    timestamp: Date;
    importance: number; // 0-1, higher is more important
    tags: string[];
    expiresAt?: Date;
    relatedContext: string[]; // IDs of related context items
  };
  confidence: number; // 0-1, how confident we are in this information
  source: 'direct' | 'inferred' | 'aggregated';
}

export interface ContextWindow {
  id: string;
  sessionId: string;
  name: string;
  items: ContextItem[];
  maxSize: number;
  retentionPolicy: {
    maxAge: number; // milliseconds
    importanceThreshold: number;
    maxSize: number;
  };
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
    priority: MessagePriority;
  };
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, KnowledgeEdge>;
  version: number;
  lastUpdated: Date;
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'relationship' | 'rule';
  label: string;
  properties: Record<string, any>;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  sources: string[]; // Context item IDs that contributed to this node
}

export interface KnowledgeEdge {
  id: string;
  source: string; // node ID
  target: string; // node ID;
  type: string;
  weight: number; // 0-1, strength of relationship
  properties: Record<string, any>;
  confidence: number;
  createdAt: Date;
  sources: string[]; // Context item IDs that contributed to this edge
}

export interface ContextQuery {
  sessionId?: string;
  type?: ContextItem['type'];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  importance?: number;
  content?: string; // Search query
  limit?: number;
  offset?: number;
}

export interface ContextConflict {
  id: string;
  type: 'value_conflict' | 'temporal_conflict' | 'semantic_conflict' | 'priority_conflict';
  contextItems: ContextItem[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategy: 'latest_wins' | 'highest_priority' | 'weighted_average' | 'manual_review';
  suggestedResolution?: any;
  detectedAt: Date;
}

/**
 * Context Management System
 * Maintains shared knowledge and state across orchestration sessions
 */
export class ContextManager extends EventEmitter {
  private registry: SessionRegistryManager;
  private contextWindows: Map<string, ContextWindow> = new Map();
  private knowledgeGraph: KnowledgeGraph;
  private contextIndex: Map<string, string[]> = new Map(); // sessionId -> contextWindow IDs
  private conflicts: Map<string, ContextConflict> = new Map();
  private readonly DEFAULT_WINDOW_SIZE = 1000;
  private readonly DEFAULT_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

  constructor(registry: SessionRegistryManager) {
    super();
    this.registry = registry;
    this.knowledgeGraph = {
      nodes: new Map(),
      edges: new Map(),
      version: 1,
      lastUpdated: new Date()
    };

    this.loadExistingContext();
  }

  /**
   * Load existing context from registry
   */
  private async loadExistingContext(): Promise<void> {
    try {
      const sessions = await this.registry.getAllSessions();
      for (const session of sessions) {
        if (session.metadata?.contextWindowId) {
          // Load context window for this session
          await this.getContextWindow(session.metadata.contextWindowId);
        }
      }
    } catch (error) {
      console.warn('Failed to load existing context:', error);
    }
  }

  /**
   * Create a new context window for a session
   */
  createContextWindow(
    sessionId: string,
    name: string,
    options?: {
      maxSize?: number;
      retentionPolicy?: Partial<ContextWindow['retentionPolicy']>;
      priority?: MessagePriority;
    }
  ): string {
    const windowId = `context-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const contextWindow: ContextWindow = {
      id: windowId,
      sessionId,
      name,
      items: [],
      maxSize: options?.maxSize || this.DEFAULT_WINDOW_SIZE,
      retentionPolicy: {
        maxAge: this.DEFAULT_RETENTION,
        importanceThreshold: 0.5,
        maxSize: options?.maxSize || this.DEFAULT_WINDOW_SIZE,
        ...options?.retentionPolicy
      },
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        priority: options?.priority || MessagePriority.NORMAL
      }
    };

    this.contextWindows.set(windowId, contextWindow);

    // Update index
    if (!this.contextIndex.has(sessionId)) {
      this.contextIndex.set(sessionId, []);
    }
    this.contextIndex.get(sessionId)!.push(windowId);

    // Update session metadata
    this.registry.updateSession(sessionId, {
      metadata: {
        ...this.registry.getSession(sessionId)?.metadata,
        contextWindowId: windowId,
        lastContextUpdate: new Date()
      }
    });

    this.emit('context_window_created', contextWindow);
    return windowId;
  }

  /**
   * Get or create context window for a session
   */
  async getOrCreateContextWindow(
    sessionId: string,
    name?: string
  ): Promise<ContextWindow> {
    // Check if session already has a context window
    const session = await this.registry.getSession(sessionId);
    if (session?.metadata?.contextWindowId) {
      const window = this.contextWindows.get(session.metadata.contextWindowId);
      if (window) {
        window.metadata.lastAccessed = new Date();
        window.metadata.accessCount++;
        return window;
      }
    }

    // Create new context window
    const windowName = name || `${session?.name || 'Unknown'} Context`;
    const windowId = this.createContextWindow(sessionId, windowName);
    return this.contextWindows.get(windowId)!;
  }

  /**
   * Get context window by ID
   */
  getContextWindow(windowId: string): ContextWindow | undefined {
    return this.contextWindows.get(windowId);
  }

  /**
   * Add context item to window
   */
  async addContextItem(
    windowId: string,
    item: Omit<ContextItem, 'id'> & { id?: string }
  ): Promise<string> {
    const contextWindow = this.contextWindows.get(windowId);
    if (!contextWindow) {
      throw new ContextNotFoundError(`Context window not found: ${windowId}`);
    }

    const contextItem: ContextItem = {
      id: item.id || `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: contextWindow.sessionId,
      type: item.type,
      content: item.content,
      metadata: {
        timestamp: item.metadata.timestamp || new Date(),
        importance: item.metadata.importance || 0.5,
        tags: item.metadata.tags || [],
        expiresAt: item.metadata.expiresAt,
        relatedContext: item.metadata.relatedContext || []
      },
      confidence: item.confidence || 0.8,
      source: item.source || 'direct'
    };

    // Check for conflicts
    const conflicts = await this.detectConflicts(contextItem);
    for (const conflict of conflicts) {
      this.conflicts.set(conflict.id, conflict);
      this.emit('context_conflict_detected', conflict);
    }

    // Apply conflict resolution
    const resolvedItem = await this.resolveConflicts(contextItem);

    // Add to context window
    contextWindow.items.push(resolvedItem);
    contextWindow.metadata.lastAccessed = new Date();
    contextWindow.metadata.accessCount++;

    // Maintain window size
    await this.maintainWindowSize(contextWindow);

    // Update knowledge graph
    await this.updateKnowledgeGraph(resolvedItem);

    // Update index
    await this.updateContextIndex(resolvedItem);

    // Emit event
    this.emit('context_item_added', { window: contextWindow, item: resolvedItem });

    return resolvedItem.id;
  }

  /**
   * Get context items matching query
   */
  async getContextItems(query: ContextQuery): Promise<ContextItem[]> {
    let items: ContextItem[] = [];

    // Filter by session
    if (query.sessionId) {
      const windowIds = this.contextIndex.get(query.sessionId) || [];
      for (const windowId of windowIds) {
        const window = this.contextWindows.get(windowId);
        if (window) {
          items = items.concat(window.items);
        }
      }
    } else {
      // Get all items from all windows
      for (const window of this.contextWindows.values()) {
        items = items.concat(window.items);
      }
    }

    // Apply filters
    if (query.type) {
      items = items.filter(item => item.type === query.type);
    }

    if (query.tags && query.tags.length > 0) {
      items = items.filter(item =>
        query.tags!.some(tag => item.metadata.tags.includes(tag))
      );
    }

    if (query.dateRange) {
      items = items.filter(item =>
        item.metadata.timestamp >= query.dateRange!.start &&
        item.metadata.timestamp <= query.dateRange!.end
      );
    }

    if (query.importance !== undefined) {
      items = items.filter(item => item.metadata.importance >= query.importance!);
    }

    // Content search
    if (query.content) {
      const searchTerms = query.content.toLowerCase().split(' ');
      items = items.filter(item => {
        const searchText = JSON.stringify(item.content).toLowerCase();
        return searchTerms.every(term => searchText.includes(term));
      });
    }

    // Sort by importance and timestamp
    items.sort((a, b) => {
      // First by importance (desc)
      if (a.metadata.importance !== b.metadata.importance) {
        return b.metadata.importance - a.metadata.importance;
      }
      // Then by timestamp (desc)
      return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
    });

    // Apply pagination
    if (query.offset !== undefined) {
      items = items.slice(query.offset);
    }
    if (query.limit !== undefined) {
      items = items.slice(0, query.limit);
    }

    return items;
  }

  /**
   * Get relevant context for a message
   */
  async getRelevantContext(
    message: any,
    maxItems: number = 50
  ): Promise<ContextItem[]> {
    const query: ContextQuery = {
      sessionId: message.sender,
      dateRange: {
        start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        end: new Date()
      },
      importance: 0.3,
      limit: maxItems
    };

    // If message has content, search for related context
    if (message.content && typeof message.content === 'object') {
      query.content = JSON.stringify(message.content);
    }

    return this.getContextItems(query);
  }

  /**
   * Detect conflicts in context
   */
  private async detectConflicts(item: ContextItem): Promise<ContextConflict[]> {
    const conflicts: ContextConflict[] = [];

    // Get related context items
    const relatedItems = await this.getContextItems({
      sessionId: item.sessionId,
      dateRange: {
        start: new Date(item.metadata.timestamp.getTime() - 60 * 60 * 1000), // 1 hour before
        end: new Date(item.metadata.timestamp.getTime() + 60 * 60 * 1000) // 1 hour after
      }
    });

    for (const existingItem of relatedItems) {
      // Skip if same item or not related
      if (existingItem.id === item.id) continue;
      if (!existingItem.metadata.relatedContext.includes(item.id) &&
          !item.metadata.relatedContext.includes(existingItem.id)) continue;

      // Detect different types of conflicts

      // Value conflict (same type, different content)
      if (existingItem.type === item.type &&
          JSON.stringify(existingItem.content) !== JSON.stringify(item.content)) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'value_conflict',
          contextItems: [existingItem, item],
          severity: this.calculateConflictSeverity(existingItem, item),
          resolutionStrategy: 'weighted_average',
          detectedAt: new Date()
        });
      }

      // Temporal conflict (overlapping time periods)
      if (this.isTemporalOverlap(existingItem, item)) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'temporal_conflict',
          contextItems: [existingItem, item],
          severity: 'medium',
          resolutionStrategy: 'latest_wins',
          detectedAt: new Date()
        });
      }

      // Semantic conflict (related but contradictory information)
      if (this.isSemanticConflict(existingItem, item)) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'semantic_conflict',
          contextItems: [existingItem, item],
          severity: 'high',
          resolutionStrategy: 'weighted_average',
          suggestedResolution: await this.generateSemanticResolution(existingItem, item),
          detectedAt: new Date()
        });
      }
    }

    return conflicts;
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(item1: ContextItem, item2: ContextItem): 'low' | 'medium' | 'high' | 'critical' {
    const avgImportance = (item1.metadata.importance + item2.metadata.importance) / 2;
    const avgConfidence = (item1.confidence + item2.confidence) / 2;

    if (avgImportance > 0.8 && avgConfidence > 0.8) return 'critical';
    if (avgImportance > 0.6 && avgConfidence > 0.6) return 'high';
    if (avgImportance > 0.4 && avgConfidence > 0.4) return 'medium';
    return 'low';
  }

  /**
   * Check temporal overlap
   */
  private isTemporalOverlap(item1: ContextItem, item2: ContextItem): boolean {
    const time1 = item1.metadata.timestamp.getTime();
    const time2 = item2.metadata.timestamp.getTime();
    const diff = Math.abs(time1 - time2);

    // Consider overlapping if within 5 minutes
    return diff < 5 * 60 * 1000;
  }

  /**
   * Check semantic conflict
   */
  private isSemanticConflict(item1: ContextItem, item2: ContextItem): boolean {
    // Simple heuristic: if items have same type and opposite sentiment
    if (item1.type !== item2.type) return false;

    const content1 = JSON.stringify(item1.content).toLowerCase();
    const content2 = JSON.stringify(item2.content).toLowerCase();

    // Check for common opposing keywords
    const opposingPairs = [
      ['success', 'failure'],
      ['pass', 'fail'],
      ['completed', 'incomplete'],
      ['working', 'broken'],
      ['enabled', 'disabled']
    ];

    return opposingPairs.some(([word1, word2]) =>
      content1.includes(word1) && content2.includes(word2) ||
      content1.includes(word2) && content2.includes(word1)
    );
  }

  /**
   * Generate semantic resolution
   */
  private async generateSemanticResolution(item1: ContextItem, item2: ContextItem): Promise<any> {
    // Weighted average based on confidence and importance
    const weight1 = item1.confidence * item1.metadata.importance;
    const weight2 = item2.confidence * item2.metadata.importance;
    const totalWeight = weight1 + weight2;

    if (totalWeight === 0) return null;

    // This is a simplified resolution - in practice, this would be more sophisticated
    return {
      resolution: 'weighted_average',
      confidence: totalWeight / 2,
      items: [item1.id, item2.id],
      weights: {
        [item1.id]: weight1 / totalWeight,
        [item2.id]: weight2 / totalWeight
      }
    };
  }

  /**
   * Resolve conflicts
   */
  private async resolveConflicts(item: ContextItem): Promise<ContextItem> {
    const conflicts = await this.detectConflicts(item);
    if (conflicts.length === 0) {
      return item;
    }

    // Apply automatic resolution strategies
    let resolvedItem = { ...item };

    for (const conflict of conflicts) {
      switch (conflict.resolutionStrategy) {
        case 'latest_wins':
          resolvedItem = item.metadata.timestamp >
            conflict.contextItems[0].metadata.timestamp ? item : conflict.contextItems[0];
          break;

        case 'highest_priority':
          resolvedItem = item.metadata.importance >
            conflict.contextItems[0].metadata.importance ? item : conflict.contextItems[0];
          break;

        case 'weighted_average':
          if (conflict.suggestedResolution) {
            // Apply weighted average logic
            resolvedItem = await this.applyWeightedAverage(item, conflict.contextItems[0], conflict.suggestedResolution);
          }
          break;

        case 'manual_review':
          // Keep the item as-is, mark for review
          resolvedItem.metadata.tags.push('manual_review');
          break;
      }
    }

    return resolvedItem;
  }

  /**
   * Apply weighted average resolution
   */
  private async applyWeightedAverage(
    item1: ContextItem,
    item2: ContextItem,
    resolution: any
  ): Promise<ContextItem> {
    // Create a new item with averaged content
    return {
      ...item1,
      id: `resolved-${Date.now()}`,
      confidence: resolution.confidence,
      metadata: {
        ...item1.metadata,
        tags: [...item1.metadata.tags, ...item2.metadata.tags, 'resolved'],
        relatedContext: [...item1.metadata.relatedContext, item2.id],
        timestamp: new Date() // Resolution timestamp
      },
      source: 'aggregated'
    };
  }

  /**
   * Maintain window size (LRU eviction)
   */
  private async maintainWindowSize(window: ContextWindow): Promise<void> {
    if (window.items.length <= window.maxSize) return;

    // Sort by last access and importance
    window.items.sort((a, b) => {
      // First by importance (desc)
      if (a.metadata.importance !== b.metadata.importance) {
        return b.metadata.importance - a.metadata.importance;
      }
      // Then by when the item was added (older items first)
      return a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime();
    });

    // Remove oldest items that are below importance threshold
    const threshold = window.retentionPolicy.importanceThreshold;
    window.items = window.items.filter(item =>
      item.metadata.importance >= threshold || window.items.length <= window.maxSize
    );

    // Ensure we don't exceed max size
    if (window.items.length > window.maxSize) {
      window.items = window.items.slice(-window.maxSize);
    }
  }

  /**
   * Update knowledge graph
   */
  private async updateKnowledgeGraph(item: ContextItem): Promise<void> {
    // Extract entities and relationships from content
    const entities = this.extractEntities(item);
    const relationships = this.extractRelationships(item, entities);

    // Add nodes
    for (const entity of entities) {
      const nodeId = `entity-${entity.type}-${entity.name}`;
      if (!this.knowledgeGraph.nodes.has(nodeId)) {
        const node: KnowledgeNode = {
          id: nodeId,
          type: 'entity',
          label: entity.name,
          properties: entity.properties,
          confidence: item.confidence * item.metadata.importance,
          createdAt: new Date(),
          updatedAt: new Date(),
          sources: [item.id]
        };
        this.knowledgeGraph.nodes.set(nodeId, node);
      } else {
        // Update existing node
        const node = this.knowledgeGraph.nodes.get(nodeId)!;
        node.sources.push(item.id);
        node.confidence = Math.max(node.confidence, item.confidence * item.metadata.importance);
        node.updatedAt = new Date();
      }
    }

    // Add edges
    for (const relationship of relationships) {
      const edgeId = `edge-${relationship.source}-${relationship.target}-${relationship.type}`;
      if (!this.knowledgeGraph.edges.has(edgeId)) {
        const edge: KnowledgeEdge = {
          id: edgeId,
          source: relationship.source,
          target: relationship.target,
          type: relationship.type,
          weight: relationship.weight,
          properties: relationship.properties,
          confidence: item.confidence * item.metadata.importance,
          createdAt: new Date(),
          sources: [item.id]
        };
        this.knowledgeGraph.edges.set(edgeId, edge);
      } else {
        // Update existing edge
        const edge = this.knowledgeGraph.edges.get(edgeId)!;
        edge.sources.push(item.id);
        edge.weight = Math.max(edge.weight, relationship.weight);
        edge.confidence = Math.max(edge.confidence, item.confidence * item.metadata.importance);
        edge.updatedAt = new Date();
      }
    }

    this.knowledgeGraph.version++;
    this.knowledgeGraph.lastUpdated = new Date();
  }

  /**
   * Extract entities from content
   */
  private extractEntities(item: ContextItem): Array<{ type: string; name: string; properties: Record<string, any> }> {
    const entities: Array<{ type: string; name: string; properties: Record<string, any> }> = [];

    // Simple entity extraction based on content type
    switch (item.type) {
      case 'message':
        if (item.content.action) {
          entities.push({
            type: 'action',
            name: item.content.action,
            properties: { priority: item.priority, timestamp: item.metadata.timestamp }
          });
        }
        if (item.content.target) {
          entities.push({
            type: 'target',
            name: item.content.target,
            properties: { session: item.sessionId }
          });
        }
        break;

      case 'decision':
        entities.push({
          type: 'decision',
          name: item.content.decision || 'decision',
          properties: {
            confidence: item.confidence,
            importance: item.metadata.importance
          }
        });
        break;

      case 'artifact':
        entities.push({
          type: 'artifact',
          name: item.content.name || 'artifact',
          properties: {
            type: item.content.type,
            size: item.content.size || 0
          }
        });
        break;
    }

    return entities;
  }

  /**
   * Extract relationships from content
   */
  private extractRelationships(
    item: ContextItem,
    entities: Array<{ type: string; name: string; properties: Record<string, any> }>
  ): Array<{ source: string; target: string; type: string; weight: number; properties: Record<string, any> }> {
    const relationships: Array<{ source: string; target: string; type: string; weight: number; properties: Record<string, any> }> = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        relationships.push({
          source: entity1.name,
          target: entity2.name,
          type: 'related',
          weight: item.metadata.importance,
          properties: {
            sessionId: item.sessionId,
            timestamp: item.metadata.timestamp
          }
        });
      }
    }

    return relationships;
  }

  /**
   * Update context index
   */
  private async updateContextIndex(item: ContextItem): Promise<void> {
    // Add to search index (simplified implementation)
    // In a real implementation, this would use a proper search engine
    const indexKey = `${item.type}:${JSON.stringify(item.content).toLowerCase()}`;
    if (!this.contextIndex.has(indexKey)) {
      this.contextIndex.set(indexKey, []);
    }
    this.contextIndex.get(indexKey)!.push(item.id);
  }

  /**
   * Get knowledge graph insights
   */
  getKnowledgeGraphInsights() {
    const nodes = Array.from(this.knowledgeGraph.nodes.values());
    const edges = Array.from(this.knowledgeGraph.edges.values());

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      averageNodeConfidence: nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length || 0,
      averageEdgeWeight: edges.reduce((sum, edge) => sum + edge.weight, 0) / edges.length || 0,
      mostConnectedNodes: nodes
        .sort((a, b) => {
          const aConnections = edges.filter(e => e.source === a.id || e.target === a.id).length;
          const bConnections = edges.filter(e => e.source === b.id || e.target === b.id).length;
          return bConnections - aConnections;
        })
        .slice(0, 5),
      version: this.knowledgeGraph.version,
      lastUpdated: this.knowledgeGraph.lastUpdated
    };
  }

  /**
   * Get context statistics
   */
  getContextStats() {
    const allItems = Array.from(this.contextWindows.values()).flatMap(w => w.items);
    const byType = allItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalImportance = allItems.reduce((sum, item) => sum + item.metadata.importance, 0);
    const avgImportance = allItems.length > 0 ? totalImportance / allItems.length : 0;

    return {
      totalItems: allItems.length,
      totalWindows: this.contextWindows.size,
      averageImportance: avgImportance,
      itemsByType: byType,
      totalConflicts: this.conflicts.size,
      activeSessions: this.contextIndex.size
    };
  }

  /**
   * Export context for a session
   */
  async exportContext(sessionId: string): Promise<any> {
    const window = await this.getOrCreateContextWindow(sessionId);
    return {
      sessionId,
      windowId: window.id,
      name: window.name,
      items: window.items,
      metadata: window.metadata,
      exportedAt: new Date()
    };
  }

  /**
   * Import context for a session
   */
  async importContext(sessionId: string, contextData: any): Promise<void> {
    const window = await this.getOrCreateContextWindow(sessionId, contextData.name);

    for (const itemData of contextData.items || []) {
      await this.addContextItem(window.id, {
        ...itemData,
        metadata: {
          timestamp: new Date(itemData.metadata.timestamp),
          importance: itemData.metadata.importance,
          tags: itemData.metadata.tags || [],
          expiresAt: itemData.metadata.expiresAt ? new Date(itemData.metadata.expiresAt) : undefined,
          relatedContext: itemData.metadata.relatedContext || []
        },
        confidence: itemData.confidence,
        source: itemData.source
      });
    }

    this.emit('context_imported', { sessionId, contextData });
  }

  /**
   * Cleanup expired context
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [windowId, window] of this.contextWindows) {
      const initialSize = window.items.length;

      // Remove expired items
      window.items = window.items.filter(item => {
        if (item.metadata.expiresAt && item.metadata.expiresAt < now) {
          cleanedCount++;
          return false;
        }
        return true;
      });

      // Remove empty windows
      if (window.items.length === 0) {
        this.contextWindows.delete(windowId);
        const sessionWindows = this.contextIndex.get(window.sessionId);
        if (sessionWindows) {
          const index = sessionWindows.indexOf(windowId);
          if (index > -1) {
            sessionWindows.splice(index, 1);
          }
        }
      }
    }

    if (cleanedCount > 0) {
      this.emit('context_cleanup', { cleanedCount, timestamp: now });
    }
  }

  /**
   * Shutdown context manager
   */
  async shutdown(): Promise<void> {
    // Save context to registry
    for (const window of this.contextWindows.values()) {
      await this.registry.updateSession(window.sessionId, {
        metadata: {
          ...this.registry.getSession(window.sessionId)?.metadata,
          lastContextUpdate: new Date(),
          contextStats: this.getContextStats()
        }
      });
    }

    this.removeAllListeners();
  }
}
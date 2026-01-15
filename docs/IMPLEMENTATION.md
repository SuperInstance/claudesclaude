# Implementation Guide

This document provides detailed implementation guidance for building Claude's Claude, following the architectural specifications.

## Project Setup

### 1. Initial Repository Setup

```bash
# Fork and clone the repository
git clone https://github.com/dvdsgl/claude-canvas.git claudesclaude
cd claudesclaude

# Create a clean starting point
git checkout -b main-branch
git branch -D master main  # Remove original branches if needed

# Initialize git repository
git init
git add .
git commit -m "Initial Claude's Claude setup"
```

### 2. Dependencies Installation

```bash
# Remove canvas dependencies
npm uninstall canvas konva react-konva react-resizable

# Install core dependencies
npm install
redis simple-git diff2html react-diff-viewer @types/simple-git
uuid @types/uuid moment @types/moment

# Development dependencies
npm install --save-dev
@types/react @types/node @types/jest
typescript ts-node jest @types/jest
prettier eslint eslint-config-prettier

# Optional: For enhanced performance
npm install --save
winston @types/winston chokidar @types/chokidar
```

### 3. TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  },
  "include": [
    "src",
    "public",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules",
    "build",
    "dist"
  ]
}
```

## Phase 1: Foundation (Week 1-2)

### 1.1. Project Structure

```
src/
├── components/           # React components
│   ├── Layout/
│   │   ├── DualPanelLayout.tsx
│   │   ├── ClaudePanel.tsx
│   │   └── DecisionModal.tsx
│   ├── Shared/
│   │   ├── ContextDisplay.tsx
│   │   ├── MessageList.tsx
│   │   └── AgentStatus.tsx
│   └── UI/
│       ├── Buttons/
│       ├── Modals/
│       └── Theme/
├── lib/                  # Core libraries
│   ├── sharedMemory/
│   ├── gitManager/
│   ├── communication/
│   └── agents/
├── types/                # TypeScript definitions
│   ├── agents.ts
│   ├── messaging.ts
│   ├── git.ts
│   └── decisions.ts
├── prompts/              # Agent prompts
│   ├── primary.ts
│   ├── secondary.ts
│   └── system.ts
├── utils/                # Utility functions
│   ├── logger.ts
│   ├── helpers.ts
│   └── validation.ts
├── hooks/                # Custom React hooks
│   ├── useSharedMemory.ts
│   ├── useGitManager.ts
│   └── useAgentCommunication.ts
├── services/             # External service integrations
│   ├── claudeApi.ts
│   ├── redis.ts
│   └── git.ts
└── App.tsx
```

### 1.2. Dual Panel Implementation

#### DualPanelLayout.tsx

```typescript
// src/components/Layout/DualPanelLayout.tsx
import React, { useState } from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import ClaudePanel from './ClaudePanel';
import { SharedMemoryProvider } from '@/hooks/useSharedMemory';

const DualPanelLayout: React.FC = () => {
  const [activeDecision, setActiveDecision] = useState<Decision | null>(null);

  const handleDecisionRequest = async (decision: Decision) => {
    setActiveDecision(decision);
  };

  const handleProceedCheck = async (context: ProceedContext) => {
    // Implementation for proceed check logic
  };

  return (
    <SharedMemoryProvider>
      <Grid container spacing={2} sx={{ height: '100vh', p: 2 }}>
        <Grid item xs={6}>
          <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ p: 2 }}>
              Director Claude
            </Typography>
            <ClaudePanel
              id="primary"
              role="director"
              onDecisionRequest={handleDecisionRequest}
              isActive={true}
            />
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ p: 2 }}>
              Executor Claude
            </Typography>
            <ClaudePanel
              id="secondary"
              role="executor"
              onProceedCheck={handleProceedCheck}
              isActive={true}
            />
          </Paper>
        </Grid>

        {/* Decision Modal (conditionally rendered) */}
        {activeDecision && (
          <DecisionModal
            decision={activeDecision}
            onClose={() => setActiveDecision(null)}
            onApprove={/* ... */}
            onReject={/* ... */}
          />
        )}
      </Grid>
    </SharedMemoryProvider>
  );
};

export default DualPanelLayout;
```

#### ClaudePanel.tsx

```typescript
// src/components/Layout/ClaudePanel.tsx
import React, { useEffect, useRef } from 'react';
import { Box, TextField, Button, Paper, List, ListItem, Typography } from '@mui/material';
import { useAgentCommunication } from '@/hooks/useAgentCommunication';
import { AgentMessage } from '@/types/messaging';

interface ClaudePanelProps {
  id: string;
  role: 'director' | 'executor';
  onDecisionRequest: (decision: Decision) => void;
  onProceedCheck: (context: ProceedContext) => void;
  isActive: boolean;
}

const ClaudePanel: React.FC<ClaudePanelProps> = ({
  id,
  role,
  onDecisionRequest,
  onProceedCheck,
  isActive
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, subscribeToMessages } = useAgentCommunication(id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to messages
  useEffect(() => {
    const subscription = subscribeToMessages((message) => {
      if (message.receiver === id || !message.receiver) {
        setMessages(prev => [...prev, message]);
      }
    });

    return () => subscription.unsubscribe();
  }, [id, subscribeToMessages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const message: AgentMessage = {
      id: uuidv4(),
      type: 'COLLABORATION',
      sender: role as 'primary' | 'secondary',
      content: inputValue,
      priority: 'medium',
      requiresResponse: false,
      metadata: {},
      timestamp: new Date(),
      sequence: messages.length + 1
    };

    await sendMessage(message);
    setInputValue('');
  };

  const handleProceed = async () => {
    const proceedContext: ProceedContext = {
      proposedAction: 'Implementation requested',
      reasoning: 'Ready to proceed with task execution',
      changes: []
    };
    onProceedCheck(proceedContext);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <List>
          {messages.map((message) => (
            <ListItem key={message.id}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: message.sender === role ? 'primary.light' : 'grey.100',
                  color: 'inherit',
                  width: '100%'
                }}
              >
                <Typography variant="body2" component="div">
                  <strong>{message.sender}:</strong> {message.content}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </Typography>
              </Paper>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Type message as ${role}...`}
            disabled={!isActive}
          />
          <Button onClick={handleSend} disabled={!isActive || !inputValue.trim()}>
            Send
          </Button>
          {role === 'executor' && (
            <Button onClick={handleProceed} variant="contained" color="primary">
              Proceed?
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ClaudePanel;
```

### 1.3. Core Type Definitions

Create comprehensive type definitions:

```typescript
// src/types/agents.ts
export enum AgentType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary'
}

export interface AgentConfig {
  type: AgentType;
  name: string;
  systemPrompt: string;
  capabilities: string[];
  constraints: string[];
}

export interface AgentState {
  id: string;
  type: AgentType;
  status: 'idle' | 'working' | 'waiting' | 'error';
  currentTask?: string;
  lastActivity: Date;
  performance: AgentPerformance;
}

export interface AgentPerformance {
  messagesSent: number;
  decisionsMade: number;
  commitsCreated: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
}
```

```typescript
// src/types/messaging.ts
export enum MessageType {
  DIRECTION = 'direction',
  PROCEED_CHECK = 'proceed_check',
  VALIDATION = 'validation',
  FEEDBACK = 'feedback',
  COLLABORATION = 'collaboration',
  CONFLICT_RESOLUTION = 'conflict_resolution'
}

export enum MessagePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  BLOCKING = 'blocking'
}

export interface AgentMessage {
  id: string;
  type: MessageType;
  sender: 'primary' | 'secondary';
  receiver?: 'primary' | 'secondary';
  content: string;
  priority: MessagePriority;
  requiresResponse: boolean;
  responseDeadline?: Date;
  attachments: MessageAttachment[];
  metadata: Record<string, any>;
  timestamp: Date;
  sequence: number;
}

export interface MessageAttachment {
  type: 'file' | 'diff' | 'image' | 'decision';
  data: string;
  filename?: string;
  description?: string;
}
```

```typescript
// src/types/decisions.ts
export enum DecisionType {
  PROCEED_CHECK = 'proceed_check',
  PLAN_APPROVAL = 'plan_approval',
  CONFLICT_RESOLUTION = 'conflict_resolution',
  ROLLBACK_REQUEST = 'rollback_request',
  ABORT_REQUEST = 'abort_request'
}

export enum DecisionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped'
}

export interface Decision {
  id: string;
  type: DecisionType;
  initiator: 'primary' | 'secondary';
  timestamp: Date;
  status: DecisionStatus;
  context: DecisionContext;
  options: DecisionOption[];
  outcome?: DecisionOutcome;
  reasoning?: string;
  attachments: DecisionAttachment[];
}

export interface ProceedContext {
  proposedAction: string;
  reasoning: string;
  changes: FileChange[];
  estimatedImpact: ImpactAssessment;
}
```

## Phase 2: Communication Layer (Week 3-4)

### 2.1. Shared Memory Implementation

```typescript
// src/lib/sharedMemory/SharedMemoryManager.ts
import Redis from 'ioredis';
import { SharedMemory, ProjectContext, DecisionHistory } from '@/types/sharedMemory';

export class SharedMemoryManager {
  private redis: Redis | null = null;
  private memory: SharedMemory;
  private subscribers: Map<string, Set<(memory: SharedMemory) => void>> = new Map();

  constructor(redisUrl?: string) {
    this.memory = this.initializeEmptyMemory();

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
      this.setupRedisSync();
    }
  }

  private initializeEmptyMemory(): SharedMemory {
    return {
      context: {
        projectName: '',
        mainBranch: 'main',
        constraints: [],
        goals: [],
        timeline: {
          startDate: new Date(),
          estimatedCompletion: null,
          milestones: []
        }
      },
      decisions: {
        active: [],
        archived: [],
        patterns: [],
        conflicts: []
      },
      state: {
        currentPhase: 'initialization',
        currentTask: null,
        lastCheckpoint: null,
        rollbackPoint: null
      },
      artifacts: {
        codeFiles: new Map(),
        plans: [],
        validations: []
      },
      metrics: {
        systemLoad: 0,
        responseTimes: [],
        errorRates: [],
        agentMetrics: []
      }
    };
  }

  async setProjectContext(context: Partial<ProjectContext>): Promise<void> {
    this.memory.context = { ...this.memory.context, ...context };
    await this.persist();
    this.notifySubscribers();
  }

  async addDecision(decision: Decision): Promise<void> {
    this.memory.decisions.active.push(decision);
    await this.persist();
    this.notifySubscribers();
  }

  async archiveDecision(decisionId: string): Promise<void> {
    const index = this.memory.decisions.active.findIndex(d => d.id === decisionId);
    if (index !== -1) {
      const decision = this.memory.decisions.active.splice(index, 1)[0];
      decision.status = DecisionStatus.ARCHIVED;
      this.memory.decisions.archived.push(decision);
      await this.persist();
      this.notifySubscribers();
    }
  }

  async updateArtifact(type: 'code' | 'plan' | 'validation', artifact: any): Promise<void> {
    switch (type) {
      case 'code':
        this.memory.artifacts.codeFiles.set(artifact.path, artifact.content);
        break;
      case 'plan':
        this.memory.artifacts.plans.push(artifact);
        break;
      case 'validation':
        this.memory.artifacts.validations.push(artifact);
        break;
    }
    await this.persist();
    this.notifySubscribers();
  }

  private async persist(): Promise<void> {
    if (this.redis) {
      await this.redis.set('claudesclaude:memory', JSON.stringify(this.memory));
    }
  }

  private async setupRedisSync(): Promise<void> {
    if (!this.redis) return;

    // Subscribe to memory updates from other instances
    this.redis.on('message', (channel, message) => {
      if (channel === 'claudesclaude:memory:update') {
        const updatedMemory = JSON.parse(message);
        this.memory = updatedMemory;
        this.notifySubscribers();
      }
    });

    this.redis.subscribe('claudesclaude:memory:update');
  }

  subscribe(key: string, callback: (memory: SharedMemory) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callbacks) => {
      callbacks.forEach(callback => callback(this.memory));
    });
  }

  getSnapshot(): SharedMemory {
    return { ...this.memory };
  }

  async createCheckpoint(label: string): Promise<string> {
    const checkpoint = {
      id: uuidv4(),
      label,
      timestamp: new Date(),
      memorySnapshot: this.getSnapshot()
    };

    if (this.redis) {
      await this.redis.lpush('claudesclaude:checkpoints', JSON.stringify(checkpoint));
    }

    return checkpoint.id;
  }

  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    if (!this.redis) return false;

    const checkpoints = await this.redis.lrange('claudesclaude:checkpoints', 0, -1);
    const checkpoint = checkpoints.find(c =>
      JSON.parse(c).id === checkpointId
    );

    if (checkpoint) {
      this.memory = JSON.parse(checkpoint).memorySnapshot;
      await this.persist();
      this.notifySubscribers();
      return true;
    }

    return false;
  }
}
```

### 2.2. Communication Channel Implementation

```typescript
// src/lib/communication/CommunicationManager.ts
import { EventEmitter } from 'events';
import { AgentMessage, MessageType, MessagePriority } from '@/types/messaging';
import { SharedMemoryManager } from '@/lib/sharedMemory/SharedMemoryManager';

export class CommunicationManager extends EventEmitter {
  private sharedMemory: SharedMemoryManager;
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private pendingResponses: Map<string, { resolve: (message: AgentMessage) => void; reject: (error: Error) => void }> = new Map();

  constructor(sharedMemory: SharedMemoryManager) {
    super();
    this.sharedMemory = sharedMemory;
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // Listen for shared memory updates that contain messages
    this.sharedMemory.subscribe('messages', (memory) => {
      // Process any new messages from shared memory
      this.processQueuedMessages();
    });
  }

  async sendMessage(
    message: Omit<AgentMessage, 'id' | 'timestamp' | 'sequence'>
  ): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      sequence: Date.now() // Use timestamp as sequence for simplicity
    };

    // Store in shared memory for cross-instance communication
    await this.storeMessage(fullMessage);

    // Emit local event for immediate processing
    this.emit('message', fullMessage);

    // Handle immediate responses if required
    if (message.requiresResponse && message.responseDeadline) {
      return this.waitForResponse(fullMessage.id, message.responseDeadline);
    }
  }

  async requestResponse(
    message: Omit<AgentMessage, 'id' | 'timestamp' | 'sequence'>,
    timeout: number = 30000
  ): Promise<AgentMessage> {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
      sequence: Date.now()
    };

    await this.storeMessage(fullMessage);

    return new Promise((resolve, reject) => {
      this.pendingResponses.set(fullMessage.id, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        this.pendingResponses.delete(fullMessage.id);
        reject(new Error(`Response timeout for message ${fullMessage.id}`));
      }, timeout);
    });
  }

  private async storeMessage(message: AgentMessage): Promise<void> {
    // Store in shared memory for persistence and cross-instance access
    const currentMemory = this.sharedMemory.getSnapshot();

    // Add to message history in shared memory
    if (!currentMemory.messages) {
      currentMemory.messages = [];
    }
    currentMemory.messages.push(message);

    await this.sharedMemory.setProjectContext({ messages: currentMemory.messages });
  }

  private processQueuedMessages(): void {
    // Process any messages that were queued while waiting for shared memory
    this.messageQueue.forEach((messages, agentId) => {
      messages.forEach(message => {
        this.emit('message', message);
      });
      this.messageQueue.delete(agentId);
    });
  }

  handleResponse(response: AgentMessage): void {
    const pending = this.pendingResponses.get(response.id);
    if (pending) {
      pending.resolve(response);
      this.pendingResponses.delete(response.id);
    }
  }

  subscribe(
    messageType: MessageType | MessageType[],
    handler: (message: AgentMessage) => void
  ): () => void {
    const types = Array.isArray(messageType) ? messageType : [messageType];

    const listener = (message: AgentMessage) => {
      if (types.includes(message.type)) {
        handler(message);
      }
    };

    this.on('message', listener);

    return () => {
      this.off('message', listener);
    };
  }

  // Helper methods for common message patterns
  async sendDirection(
    content: string,
    receiver: 'primary' | 'secondary',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.sendMessage({
      type: MessageType.DIRECTION,
      sender: receiver === 'primary' ? 'secondary' : 'primary',
      receiver,
      content,
      priority: MessagePriority.HIGH,
      requiresResponse: false,
      attachments: [],
      metadata: metadata || {}
    });
  }

  async requestProceedCheck(
    context: string,
    receiver: 'primary' | 'secondary'
  ): Promise<boolean> {
    const response = await this.requestResponse({
      type: MessageType.PROCEED_CHECK,
      sender: receiver === 'primary' ? 'secondary' : 'primary',
      receiver,
      content: context,
      priority: MessagePriority.HIGH,
      requiresResponse: true,
      attachments: [],
      metadata: {}
    });

    return response.metadata?.approved || false;
  }
}
```

## Phase 3: Decision System (Week 5-6)

### 3.1. Decision Engine Implementation

```typescript
// src/lib/decisions/DecisionEngine.ts
import { v4 as uuidv4 } from 'uuid';
import {
  Decision,
  DecisionType,
  DecisionStatus,
  DecisionOption,
  ProceedContext,
  FileChange,
  ImpactAssessment
} from '@/types/decisions';
import { SharedMemoryManager } from '@/lib/sharedMemory/SharedMemoryManager';
import { CommunicationManager } from '@/lib/communication/CommunicationManager';

export class DecisionEngine {
  private sharedMemory: SharedMemoryManager;
  private communication: CommunicationManager;
  private decisionTimeout: number = 60000; // 1 minute default timeout

  constructor(
    sharedMemory: SharedMemoryManager,
    communication: CommunicationManager
  ) {
    this.sharedMemory = sharedMemory;
    this.communication = communication;
  }

  async createProceedCheck(
    context: ProceedContext,
    initiator: 'primary' | 'secondary'
  ): Promise<Decision> {
    const decision: Decision = {
      id: uuidv4(),
      type: DecisionType.PROCEED_CHECK,
      initiator,
      timestamp: new Date(),
      status: DecisionStatus.PENDING,
      context: {
        action: context.proposedAction,
        reasoning: context.reasoning,
        changes: context.changes,
        impact: context.estimatedImpact
      },
      options: [
        { id: 'approve', label: '✓ Yes', description: 'Proceed with the action' },
        { id: 'always_approve', label: '✓ Always Yes', description: 'Always approve similar actions' },
        { id: 'reject', label: '✗ No', description: 'Reject and do not proceed' }
      ],
      attachments: this.createDecisionAttachments(context)
    };

    // Store decision in shared memory
    await this.sharedMemory.addDecision(decision);

    // Notify the other agent
    const receiver = initiator === 'primary' ? 'secondary' : 'primary';
    await this.communication.sendDirection(
      `Decision required: ${decision.id}`,
      receiver,
      { decisionId: decision.id }
    );

    return decision;
  }

  async processDecisionResponse(
    decisionId: string,
    response: 'approve' | 'always_approve' | 'reject',
    reasoning?: string
  ): Promise<{ approved: boolean; decision: Decision }> {
    const memory = this.sharedMemory.getSnapshot();
    const decision = memory.decisions.active.find(d => d.id === decisionId);

    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    const approved = response !== 'reject';

    // Update decision status
    decision.status = approved ? DecisionStatus.APPROVED : DecisionStatus.REJECTED;
    decision.outcome = {
      optionId: response,
      approved,
      reasoning: reasoning || `User responded with: ${response}`,
      timestamp: new Date()
    };

    // Archive the decision
    await this.sharedMemory.archiveDecision(decisionId);

    // Handle "Always Yes" automation
    if (response === 'always_approve' && decision.type === DecisionType.PROCEED_CHECK) {
      await this.createAlwaysYesRule(decision);
    }

    // Notify relevant parties
    const initiator = decision.initiator === 'primary' ? 'secondary' : 'primary';
    await this.communication.sendDirection(
      approved ? 'Action approved' : 'Action rejected',
      initiator,
      {
        decisionId,
        approved,
        reasoning: decision.outcome.reasoning
      }
    );

    return { approved, decision };
  }

  private async createAlwaysYesRule(decision: Decision): Promise<void> {
    // Extract pattern from decision context
    const pattern = this.extractDecisionPattern(decision);

    if (pattern) {
      const rule = {
        id: uuidv4(),
        pattern,
        action: DecisionType.PROCEED_CHECK,
        createdAt: new Date(),
        lastUsed: null,
        usageCount: 0
      };

      // Store rule in shared memory
      const memory = this.sharedMemory.getSnapshot();
      if (!memory.decisionRules) {
        memory.decisionRules = [];
      }
      memory.decisionRules.push(rule);

      await this.sharedMemory.setProjectContext({
        decisionRules: memory.decisionRules
      });
    }
  }

  private extractDecisionPattern(decision: Decision): any {
    // This is a simplified pattern extraction
    // In a real implementation, this would be more sophisticated
    return {
      actionType: decision.context.action,
      changeCount: decision.context.changes.length,
      fileTypes: decision.context.changes.map(c => c.path.split('.').pop()).filter(Boolean),
      similarityThreshold: 0.8
    };
  }

  private createDecisionAttachments(context: ProceedContext): any[] {
    const attachments: any[] = [];

    // Add diff preview if there are changes
    if (context.changes.length > 0) {
      attachments.push({
        type: 'diff',
        data: this.generateDiffPreview(context.changes),
        filename: 'changes.diff',
        description: 'Preview of proposed changes'
      });
    }

    // Add impact assessment if available
    if (context.estimatedImpact) {
      attachments.push({
        type: 'decision',
        data: JSON.stringify(context.estimatedImpact, null, 2),
        filename: 'impact.json',
        description: 'Estimated impact assessment'
      });
    }

    return attachments;
  }

  private generateDiffPreview(changes: FileChange[]): string {
    return changes.map(change => {
      const changeType = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : 'M';
      return `${changeType} ${change.path}`;
    }).join('\n');
  }

  async getDecisionHistory(filters?: {
    type?: DecisionType;
    initiator?: 'primary' | 'secondary';
    status?: DecisionStatus;
    since?: Date;
    limit?: number;
  }): Promise<Decision[]> {
    const memory = this.sharedMemory.getSnapshot();
    let decisions = [...memory.decisions.active, ...memory.decisions.archived];

    // Apply filters
    if (filters?.type) {
      decisions = decisions.filter(d => d.type === filters.type);
    }
    if (filters?.initiator) {
      decisions = decisions.filter(d => d.initiator === filters.initiator);
    }
    if (filters?.status) {
      decisions = decisions.filter(d => d.status === filters.status);
    }
    if (filters?.since) {
      decisions = decisions.filter(d => d.timestamp >= filters.since!);
    }
    if (filters?.limit) {
      decisions = decisions.slice(0, filters.limit);
    }

    // Sort by timestamp (most recent first)
    return decisions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
```

### 3.2. Decision Modal Component

```typescript
// src/components/Decisions/DecisionModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress
} from '@mui/material';
import { Decision, DecisionOption } from '@/types/decisions';
import { DiffPreview } from '@/components/Shared/DiffPreview';
import { formatDistanceToNow } from 'date-fns';

interface DecisionModalProps {
  decision: Decision;
  onClose: () => void;
  onApprove: (type: 'yes' | 'always_yes') => void;
  onReject: (reason: string) => void;
}

export const DecisionModal: React.FC<DecisionModalProps> = ({
  decision,
  onClose,
  onApprove,
  onReject
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async (type: 'yes' | 'always_yes') => {
    setIsProcessing(true);
    try {
      onApprove(type);
      onClose();
    } catch (error) {
      console.error('Error processing decision:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setIsProcessing(true);
    try {
      onReject(selectedReason);
      onClose();
    } catch (error) {
      console.error('Error processing decision:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getImpactColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'info';
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            Decision Required
          </Typography>
          <Chip
            label={decision.initiator}
            size="small"
            color={decision.initiator === 'primary' ? 'primary' : 'secondary'}
          />
          <Chip
            label={formatDistanceToNow(decision.timestamp, { addSuffix: true })}
            size="small"
            variant="outlined"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Action Description */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Proposed Action
          </Typography>
          <Typography variant="body2" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
            {decision.context.action}
          </Typography>
        </Box>

        {/* Reasoning */}
        {decision.context.reasoning && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Reasoning
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {decision.context.reasoning}
            </Typography>
          </Box>
        )}

        {/* Impact Assessment */}
        {decision.context.impact && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Estimated Impact
            </Typography>
            <Alert
              severity={getImpactColor(decision.context.impact.severity)}
              sx={{ mb: 2 }}
            >
              <strong>{decision.context.impact.severity.toUpperCase()}</strong> Impact
              <br />
              {decision.context.impact.description}
            </Alert>
          </Box>
        )}

        {/* Changes Preview */}
        {decision.attachments.some(a => a.type === 'diff') && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Proposed Changes
            </Typography>
            <DiffPreview
              diff={decision.attachments.find(a => a.type === 'diff')?.data || ''}
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Decision Options */}
        <Typography variant="subtitle1" gutterBottom>
          How would you like to proceed?
        </Typography>
        <List>
          {decision.options.map((option) => (
            <ListItem
              key={option.id}
              button
              onClick={() => {
                if (option.id === 'approve') {
                  handleApprove('yes');
                } else if (option.id === 'always_approve') {
                  handleApprove('always_yes');
                } else if (option.id === 'reject') {
                  setSelectedReason('');
                }
              }}
              disabled={isProcessing}
              sx={{
                ...(selectedReason && option.id === 'reject' ? {
                  bgcolor: 'action.hover'
                } : {})
              }}
            >
              <ListItemText
                primary={option.label}
                secondary={option.description}
                primaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          ))}
        </List>

        {/* Rejection Reason */}
        {selectedReason && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Please provide a reason for rejection:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontStyle: 'italic'
              }}
            >
              {selectedReason}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        {selectedReason ? (
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={isProcessing}
          >
            Reject
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setSelectedReason('Not suitable for this context')}
              color="secondary"
              disabled={isProcessing}
            >
              Reject
            </Button>
            <Button
              onClick={() => handleApprove('yes')}
              variant="contained"
              disabled={isProcessing}
            >
              ✓ Yes
            </Button>
            <Button
              onClick={() => handleApprove('always_yes')}
              variant="contained"
              color="primary"
              disabled={isProcessing}
            >
              ✓ Always Yes
            </Button>
          </>
        )}
        {isProcessing && <CircularProgress size={24} />}
      </DialogActions>
    </Dialog>
  );
};
```

## Phase 4: Advanced Features (Week 7-8)

### 4.1. Git Integration with Enhanced Features

```typescript
// src/lib/git/GitManager.ts
import simpleGit, { SimpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import {
  GitBranch,
  GitCommit,
  GitCheckpoint,
  FileChange,
  CommitMetadata
} from '@/types/git';

export class GitManager {
  private git: SimpleGit;
  private branchPrefix = 'task';
  private checkpointPrefix = 'decision';

  constructor(repoPath: string = './agent-workspace') {
    this.git = simpleGit(repoPath);
  }

  async initializeRepository(): Promise<void> {
    try {
      // Check if repo exists
      await this.git.raw(['rev-parse', '--is-inside-work-tree']);
    } catch {
      // Initialize if not exists
      await this.git.init();
      await this.git.add('.gitignore');
      await this.git.commit('Initial commit');
    }
  }

  async createTaskBranch(taskName: string): Promise<GitBranch> {
    const branchName = `${this.branchPrefix}/${this.slugify(taskName)}-${Date.now()}`;

    try {
      // Create branch from main
      await this.git.checkout('main');
      await this.git.pull('origin', 'main');
      await this.git.checkout(['-b', branchName]);

      // Set up branch protection info
      const branch: GitBranch = {
        name: branchName,
        createdAt: new Date(),
        parent: 'main',
        isProtected: true,
        agentType: 'executor', // Will be set based on which agent creates it
        metadata: {
          taskName,
          createdBy: 'system',
          createdFor: 'execution'
        }
      };

      // Store branch metadata
      await this.storeBranchMetadata(branch);

      return branch;
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error}`);
    }
  }

  async commitWithAgentContext(
    agent: 'primary' | 'secondary',
    message: string,
    files: string[],
    metadata: CommitMetadata = {}
  ): Promise<GitCommit> {
    try {
      // Stage specified files
      if (files.length > 0) {
        await this.git.add(files);
      }

      // Create commit message with agent context
      const fullMessage = this.formatCommitMessage(agent, message, metadata);

      // Commit changes
      const commitResult = await this.git.commit(fullMessage);

      const commit: GitCommit = {
        hash: commitResult.hash,
        message: fullMessage,
        author: agent,
        timestamp: new Date(),
        files: files,
        metadata,
        parents: commitResult.parents,
        branch: await this.getCurrentBranch()
      };

      // Store commit metadata
      await this.storeCommitMetadata(commit);

      return commit;
    } catch (error) {
      throw new Error(`Failed to commit: ${error}`);
    }
  }

  async createDecisionCheckpoint(
    decisionId: string,
    decision: any
  ): Promise<GitCheckpoint> {
    const checkpointLabel = `${this.checkpointPrefix}-${decisionId}`;

    try {
      // Get current commit
      const currentCommit = await this.git.log(['-1', '--pretty=%H']);

      // Create checkpoint tag
      await this.git.addTag([checkpointLabel, currentCommit.latest.hash]);

      const checkpoint: GitCheckpoint = {
        id: checkpointLabel,
        decisionId,
        commitHash: currentCommit.latest.hash,
        timestamp: new Date(),
        metadata: {
          decision,
          branch: await this.getCurrentBranch(),
          author: 'system'
        }
      };

      // Store checkpoint
      await this.storeCheckpoint(checkpoint);

      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to create checkpoint: ${error}`);
    }
  }

  async rollbackToCheckpoint(
    checkpointId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get checkpoint details
      const checkpoint = await this.getCheckpoint(checkpointId);

      if (!checkpoint) {
        return { success: false, message: 'Checkpoint not found' };
      }

      // Checkout the checkpoint commit
      await this.git.checkout([checkpoint.commitHash]);

      // Create rollback commit
      const rollbackMessage = `Rollback to checkpoint: ${checkpointId}\n\nReason: ${reason}`;
      await this.git.commit(rollbackMessage);

      // Update checkpoint status
      await this.markCheckpointAsRolledBack(checkpointId, reason);

      return {
        success: true,
        message: `Successfully rolled back to checkpoint ${checkpointId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to rollback: ${error}`
      };
    }
  }

  async getBranchDiff(branch1: string, branch2?: string): Promise<FileChange[]> {
    const targetBranch = branch2 || 'main';

    try {
      const diff = await this.git.diff([`${branch1}...${targetBranch}`]);
      return this.parseDiffOutput(diff);
    } catch (error) {
      throw new Error(`Failed to get diff: ${error}`);
    }
  }

  private formatCommitMessage(
    agent: 'primary' | 'secondary',
    message: string,
    metadata: CommitMetadata
  ): string {
    const agentName = agent === 'primary' ? 'Director' : 'Executor';
    const contextLines = [];

    // Add metadata context if available
    if (metadata.decisionId) {
      contextLines.push(`Decision ID: ${metadata.decisionId}`);
    }
    if (metadata.taskId) {
      contextLines.push(`Task ID: ${metadata.taskId}`);
    }
    if (metadata.reasoning) {
      contextLines.push(`Reasoning: ${metadata.reasoning}`);
    }

    const context = contextLines.length > 0
      ? `\n\n[${agentName} Context]\n${contextLines.join('\n')}`
      : '';

    return `[${agentName}] ${message}${context}`;
  }

  private parseDiffOutput(diff: string): FileChange[] {
    const changes: FileChange[] = [];
    const lines = diff.split('\n');
    let currentFile: string | null = null;
    let currentChangeType: 'added' | 'removed' | 'modified' | null = null;

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6);
        currentChangeType = null;
        continue;
      }

      if (line.startsWith('diff --git')) {
        currentFile = null;
        currentChangeType = null;
        continue;
      }

      if (line.startsWith('@@')) {
        // Hunks header - skip for now
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('++')) {
        currentChangeType = 'added';
        changes.push({
          type: 'added',
          path: currentFile!,
          content: line.substring(1),
          line: changes.length + 1
        });
      } else if (line.startsWith('-') && !line.startsWith('--')) {
        currentChangeType = 'removed';
        changes.push({
          type: 'removed',
          path: currentFile!,
          content: line.substring(1),
          line: changes.length + 1
        });
      } else if (line.startsWith(' ')) {
        currentChangeType = 'modified';
      }
    }

    return changes;
  }

  private async getCurrentBranch(): Promise<string> {
    const result = await this.git.branch(['--show-current']);
    return result.trim();
  }

  private async storeBranchMetadata(branch: GitBranch): Promise<void> {
    // Store branch metadata in a dedicated file or use git notes
    const metadata = JSON.stringify(branch, null, 2);
    await this.git.add('.metadata/branches.json');
    await this.git.commit('Update branch metadata');
  }

  private async storeCommitMetadata(commit: GitCommit): Promise<void> {
    // Store commit metadata
    const metadata = JSON.stringify(commit, null, 2);
    await this.git.add('.metadata/commits.json');
    await this.git.commit('Update commit metadata');
  }

  private async storeCheckpoint(checkpoint: GitCheckpoint): Promise<void> {
    // Store checkpoint metadata
    const metadata = JSON.stringify(checkpoint, null, 2);
    await this.git.add('.metadata/checkpoints.json');
    await this.git.commit('Update checkpoint metadata');
  }

  private async getCheckpoint(checkpointId: string): Promise<GitCheckpoint | null> {
    // Implementation to retrieve checkpoint from metadata
    // This would typically read from the .metadata/checkpoints.json file
    try {
      const result = await this.git.show(['.metadata/checkpoints.json']);
      const checkpoints = JSON.parse(result);
      return checkpoints.find((cp: GitCheckpoint) => cp.id === checkpointId) || null;
    } catch {
      return null;
    }
  }

  private async markCheckpointAsRolledBack(
    checkpointId: string,
    reason: string
  ): Promise<void> {
    // Update checkpoint metadata to mark as rolled back
    const checkpoint = await this.getCheckpoint(checkpointId);
    if (checkpoint) {
      checkpoint.rolledBack = true;
      checkpoint.rollbackReason = reason;
      checkpoint.rolledBackAt = new Date();
      await this.storeCheckpoint(checkpoint);
    }
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
```

### 4.2. Performance Monitoring and Analytics

```typescript
// src/lib/monitoring/PerformanceMonitor.ts
import { performance } from 'perf_hooks';
import {
  PerformanceMetrics,
  AgentPerformance,
  DecisionMetrics,
  SystemLoad
} from '@/types/monitoring';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = performance.now();
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      agentMetrics: new Map(),
      decisionMetrics: {
        totalDecisions: 0,
        averageDecisionTime: 0,
        approvalRate: 0,
        rejectionRate: 0,
        averageResponseTime: 0
      },
      gitMetrics: {
        totalCommits: 0,
        averageCommitTime: 0,
        branchCreations: 0,
        rollbacks: 0
      },
      memoryMetrics: {
        currentMemoryUsage: 0,
        peakMemoryUsage: 0,
        garbageCollections: 0
      },
      systemLoad: {
        cpu: 0,
        memory: 0,
        timestamp: new Date()
      },
      responseTimes: [],
      errorRates: [],
      startTime: new Date()
    };
  }

  private startMonitoring(): void {
    // Monitor every 5 seconds
    this.intervalId = setInterval(() => {
      this.updateSystemMetrics();
    }, 5000);

    // Monitor memory usage
    this.monitorMemoryUsage();
  }

  private updateSystemMetrics(): void {
    const now = Date.now();

    // Update system load (simplified implementation)
    this.metrics.systemLoad = {
      cpu: Math.random() * 100, // In real implementation, use actual CPU metrics
      memory: process.memoryUsage().heapUsed / process.memoryUsage().heapMax * 100,
      timestamp: new Date()
    };

    // Store historical data
    this.metrics.responseTimes.push({
      timestamp: now,
      value: this.metrics.systemLoad.cpu
    });

    // Keep only last 100 entries
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift();
    }
  }

  private monitorMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryMetrics.currentMemoryUsage = memoryUsage.heapUsed;

    if (memoryUsage.heapUsed > this.metrics.memoryMetrics.peakMemoryUsage) {
      this.metrics.memoryMetrics.peakMemoryUsage = memoryUsage.heapUsed;
    }

    // Monitor garbage collections
    if (global.gc) {
      global.gc();
      this.metrics.memoryMetrics.garbageCollections++;
    }
  }

  trackAgent(agentId: string, metrics: Partial<AgentPerformance>): void {
    const current = this.metrics.agentMetrics.get(agentId) || this.getEmptyAgentMetrics();

    const updated = {
      ...current,
      ...metrics,
      lastUpdated: new Date()
    };

    this.metrics.agentMetrics.set(agentId, updated);
  }

  trackDecision(decisionTime: number, approved: boolean): void {
    this.metrics.decisionMetrics.totalDecisions++;

    // Update average decision time
    const currentAverage = this.metrics.decisionMetrics.averageDecisionTime;
    const totalDecisions = this.metrics.decisionMetrics.totalDecisions;
    this.metrics.decisionMetrics.averageDecisionTime =
      (currentAverage * (totalDecisions - 1) + decisionTime) / totalDecisions;

    // Update approval/rejection rates
    if (approved) {
      this.metrics.decisionMetrics.approvalRate =
        (this.metrics.decisionMetrics.approvalRate * (totalDecisions - 1) + 1) / totalDecisions;
    } else {
      this.metrics.decisionMetrics.rejectionRate =
        (this.metrics.decisionMetrics.rejectionRate * (totalDecisions - 1) + 1) / totalDecisions;
    }

    // Track response times
    this.metrics.responseTimes.push({
      timestamp: Date.now(),
      value: decisionTime
    });
  }

  trackGitOperation(operation: 'commit' | 'branch' | 'rollback', duration: number): void {
    switch (operation) {
      case 'commit':
        this.metrics.gitMetrics.totalCommits++;
        break;
      case 'branch':
        this.metrics.gitMetrics.branchCreations++;
        break;
      case 'rollback':
        this.metrics.gitMetrics.rollbacks++;
        break;
    }

    // Update average commit time
    if (operation === 'commit') {
      const currentAverage = this.metrics.gitMetrics.averageCommitTime;
      const totalCommits = this.metrics.gitMetrics.totalCommits;
      this.metrics.gitMetrics.averageCommitTime =
        (currentAverage * (totalCommits - 1) + duration) / totalCommits;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getAgentMetrics(agentId: string): AgentPerformance | undefined {
    return this.metrics.agentMetrics.get(agentId);
  }

  getSystemHealth(): SystemLoad {
    return { ...this.metrics.systemLoad };
  }

  generateReport(period: 'hour' | 'day' | 'week' = 'day'): PerformanceReport {
    const now = Date.now();
    const periodMs = period === 'hour' ? 3600000 : period === 'day' ? 86400000 : 604800000;

    const responseTimesInPeriod = this.metrics.responseTimes.filter(
      rt => now - rt.timestamp <= periodMs
    );

    return {
      period,
      generatedAt: new Date(),
      summary: {
        totalDecisions: this.metrics.decisionMetrics.totalDecisions,
        averageResponseTime: this.metrics.decisionMetrics.averageResponseTime,
        systemLoad: this.metrics.systemLoad,
        memoryUsage: this.metrics.memoryMetrics.currentMemoryUsage
      },
      trends: {
        responseTimeTrend: this.calculateTrend(responseTimesInPeriod.map(rt => rt.value)),
        loadTrend: this.calculateTrend([
          ...this.metrics.responseTimes.slice(-20).map(rt => rt.value),
          ...this.metrics.errorRates.slice(-20).map(er => er.value)
        ])
      },
      recommendations: this.generateRecommendations()
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const threshold = 0.1; // 10% change threshold
    const change = (secondAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for memory usage
    const memoryUsagePercent = this.metrics.memoryMetrics.currentMemoryUsage /
      (1024 * 1024 * 1024) * 100; // Assuming GB scale

    if (memoryUsagePercent > 80) {
      recommendations.push('High memory usage detected. Consider optimizing memory usage or increasing available memory.');
    }

    // Check for response times
    if (this.metrics.decisionMetrics.averageDecisionTime > 5000) {
      recommendations.push('Slow decision processing detected. Consider optimizing decision logic or increasing resources.');
    }

    // Check error rates
    const recentErrorRate = this.metrics.errorRates.slice(-10).length > 0
      ? this.metrics.errorRates.slice(-10).reduce((sum, er) => sum + er.value, 0) / 10
      : 0;

    if (recentErrorRate > 0.1) {
      recommendations.push('High error rate detected. Investigate recent errors and implement error handling improvements.');
    }

    return recommendations;
  }

  private getEmptyAgentMetrics(): AgentPerformance {
    return {
      messagesSent: 0,
      decisionsMade: 0,
      commitsCreated: 0,
      averageResponseTime: 0,
      errorRate: 0,
      successRate: 0,
      lastUpdated: new Date()
    };
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

interface PerformanceReport {
  period: 'hour' | 'day' | 'week';
  generatedAt: Date;
  summary: {
    totalDecisions: number;
    averageResponseTime: number;
    systemLoad: SystemLoad;
    memoryUsage: number;
  };
  trends: {
    responseTimeTrend: 'increasing' | 'decreasing' | 'stable';
    loadTrend: 'increasing' | 'decreasing' | 'stable';
  };
  recommendations: string[];
}
```

## Testing Strategy

### Unit Tests

```typescript
// tests/lib/sharedMemory.test.ts
import { SharedMemoryManager } from '@/lib/sharedMemory/SharedMemoryManager';
import { Decision } from '@/types/decisions';

describe('SharedMemoryManager', () => {
  let memoryManager: SharedMemoryManager;

  beforeEach(() => {
    memoryManager = new SharedMemoryManager();
  });

  describe('setProjectContext', () => {
    it('should update project context', async () => {
      const context = {
        projectName: 'Test Project',
        mainBranch: 'main'
      };

      await memoryManager.setProjectContext(context);

      const snapshot = memoryManager.getSnapshot();
      expect(snapshot.context.projectName).toBe('Test Project');
      expect(snapshot.context.mainBranch).toBe('main');
    });

    it('should preserve existing context', async () => {
      await memoryManager.setProjectContext({ projectName: 'Test' });
      await memoryManager.setProjectContext({ mainBranch: 'dev' });

      const snapshot = memoryManager.getSnapshot();
      expect(snapshot.context.projectName).toBe('Test');
      expect(snapshot.context.mainBranch).toBe('dev');
    });
  });

  describe('addDecision', () => {
    it('should add decision to active decisions', async () => {
      const decision: Decision = {
        id: 'test-decision',
        type: 'proceed_check',
        initiator: 'primary',
        timestamp: new Date(),
        status: 'pending',
        context: { action: 'test' },
        options: [],
        attachments: []
      };

      await memoryManager.addDecision(decision);

      const snapshot = memoryManager.getSnapshot();
      expect(snapshot.decisions.active).toHaveLength(1);
      expect(snapshot.decisions.active[0].id).toBe('test-decision');
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/agentCommunication.test.ts
import { SharedMemoryManager } from '@/lib/sharedMemory/SharedMemoryManager';
import { CommunicationManager } from '@/lib/communication/CommunicationManager';
import { DecisionEngine } from '@/lib/decisions/DecisionEngine';

describe('Agent Communication Integration', () => {
  let sharedMemory: SharedMemoryManager;
  let communication: CommunicationManager;
  let decisionEngine: DecisionEngine;

  beforeEach(() => {
    sharedMemory = new SharedMemoryManager();
    communication = new CommunicationManager(sharedMemory);
    decisionEngine = new DecisionEngine(sharedMemory, communication);
  });

  it('should handle decision request/response flow', async () => {
    let receivedMessage: any = null;

    // Subscribe to messages
    communication.subscribe('proceed_check', (message) => {
      receivedMessage = message;
    });

    // Create a proceed check
    const proceedContext = {
      proposedAction: 'Create new file',
      reasoning: 'Need to add configuration',
      changes: [],
      estimatedImpact: { severity: 'low', description: 'Minimal impact' }
    };

    const decision = await decisionEngine.createProceedCheck(
      proceedContext,
      'secondary'
    );

    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(receivedMessage).toBeDefined();
    expect(receivedMessage.type).toBe('proceed_check');
    expect(receivedMessage.sender).toBe('secondary');
  });
});
```

## Deployment Considerations

### Environment Configuration

```typescript
// config/environments.ts
export interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production';
  redis?: {
    url: string;
    password?: string;
  };
  git: {
    repoPath: string;
    defaultBranch: string;
  };
  agents: {
    primary: {
      apiKey: string;
      baseUrl: string;
    };
    secondary: {
      apiKey: string;
      baseUrl: string;
    };
  };
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsRetention: number; // in days
  };
}

export const config: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    git: {
      repoPath: './agent-workspace',
      defaultBranch: 'main'
    },
    agents: {
      primary: {
        apiKey: process.env.PRIMARY_CLAUDE_API_KEY || '',
        baseUrl: 'https://api.anthropic.com'
      },
      secondary: {
        apiKey: process.env.SECONDARY_CLAUDE_API_KEY || '',
        baseUrl: 'https://api.anthropic.com'
      }
    },
    monitoring: {
      enabled: true,
      logLevel: 'debug',
      metricsRetention: 7
    }
  },
  // ... other environments
};
```

### Docker Setup

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - PRIMARY_CLAUDE_API_KEY=${PRIMARY_CLAUDE_API_KEY}
      - SECONDARY_CLAUDE_API_KEY=${SECONDARY_CLAUDE_API_KEY}
    depends_on:
      - redis
    volumes:
      - ./agent-workspace:/app/agent-workspace

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Monitoring and Observability

### Logging Configuration

```typescript
// config/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'claudesclaude' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Health Check Endpoint

```typescript
// src/api/health.ts
import { Request, Response } from 'express';
import { PerformanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

export class HealthController {
  private monitor: PerformanceMonitor;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
  }

  getHealth = (req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      metrics: this.monitor.getSystemHealth(),
      uptime: process.uptime()
    };

    // Check if system is healthy
    const systemLoad = this.monitor.getSystemHealth();
    if (systemLoad.cpu > 90 || systemLoad.memory > 90) {
      health.status = 'degraded';
    }

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  };

  getMetrics = (req: Request, res: Response) => {
    const report = this.monitor.generateReport('hour');
    res.json(report);
  };
}
```

This comprehensive implementation guide provides the foundation for building Claude's Claude, with detailed code examples for each major component and phase of the project.
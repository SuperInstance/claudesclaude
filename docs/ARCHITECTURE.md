# Architecture Documentation

## System Architecture Overview

Claude's Claude is designed as a dual-agent collaborative development environment with a sophisticated architecture that enables intelligent, traceable, and safe code generation.

### Core Principles

1. **Separation of Concerns**: Director handles high-level planning and validation, Executor handles implementation
2. **Shared Context**: Agents maintain a synchronized memory of project state and decisions
3. **Version Control Integration**: Git operations are core to the workflow
4. **Decision Transparency**: All major decisions are logged and auditable

## Detailed Architecture Components

### 1. User Interface Layer

#### Dual-Panel Layout
```typescript
interface ClaudePanelProps {
  id: string;                  // 'primary' or 'secondary'
  title: string;              // Display title
  role: 'director' | 'executor';
  onDecisionRequest: (decision: Decision) => void;
  onProceedCheck: (context: ProceedContext) => void;
  sharedContext: SharedMemory;
  messages: AgentMessage[];
}
```

#### Decision Interface Components
```typescript
interface DecisionModal {
  isVisible: boolean;
  decision: Decision;
  onApprove: (type: 'yes' | 'always_yes') => void;
  onReject: (reason: string) => void;
  renderDiffPreview: (changes: FileChange[]) => JSX.Element;
  renderHistory: (pastDecisions: Decision[]) => JSX.Element;
}
```

### 2. Shared Memory System

#### Data Structures
```typescript
interface SharedMemory {
  // Current project context
  context: ProjectContext;

  // Decision history
  decisions: DecisionHistory;

  // State management
  state: MemoryState;

  // Artifact tracking
  artifacts: ArtifactRegistry;

  // Performance metrics
  metrics: PerformanceMetrics;
}

interface ProjectContext {
  projectName: string;
  repositoryUrl?: string;
  mainBranch: string;
  currentTask?: string;
  constraints: Constraint[];
  goals: Goal[];
  timeline: ProjectTimeline;
}

interface DecisionHistory {
  active: Decision[];
  archived: Decision[];
  patterns: DecisionPattern[];
  conflicts: ConflictRecord[];
}
```

#### Memory Synchronization
```typescript
class MemorySynchronizer {
  async syncToRedis(): Promise<void> {
    // Persist shared memory to Redis
  }

  async loadFromRedis(): Promise<void> {
    // Load shared memory from Redis
  }

  async createCheckpoint(): Promise<string> {
    // Create memory checkpoint for rollback
  }

  async restoreCheckpoint(checkpointId: string): Promise<void> {
    // Restore memory to previous state
  }
}
```

### 3. Agent Communication Framework

#### Message Types and Protocols
```typescript
enum MessageType {
  // Primary → Secondary
  DIRECTION = 'direction',
  FEEDBACK = 'feedback',
  INTERRUPTION = 'interruption',

  // Secondary → Primary
  PROCEED_CHECK = 'proceed_check',
  VALIDATION = 'validation',
  STATUS_UPDATE = 'status_update',

  // Bidirectional
  COLLABORATION = 'collaboration',
  CONFLICT_RESOLUTION = 'conflict_resolution'
}

interface AgentMessage {
  id: string;
  type: MessageType;
  sender: AgentType;
  receiver?: AgentType;
  content: string;
  priority: MessagePriority;
  requiresResponse: boolean;
  responseDeadline?: Date;
  attachments: MessageAttachment[];
  metadata: Record<string, any>;
  timestamp: Date;
  sequence: number;
}
```

#### Communication Channel
```typescript
class CommunicationChannel {
  private subscribers: Map<MessageType, MessageHandler[]>;

  async subscribe(
    messageType: MessageType,
    handler: MessageHandler
  ): Promise<SubscriptionToken> {
    // Subscribe to specific message types
  }

  async publish(message: AgentMessage): Promise<void> {
    // Publish message to subscribers
    // Handle priority and deadlines
  }

  async requestResponse(
    message: AgentMessage,
    timeout: number = 30000
  ): Promise<AgentMessage> {
    // Request synchronous response with timeout
  }
}
```

### 4. Git Integration Layer

#### Enhanced Git Manager
```typescript
class EnhancedGitManager {
  private branches: Map<string, GitBranch>;
  private checkpoints: Map<string, GitCheckpoint>;
  private agentMetadata: AgentMetadataManager;

  async createIsolatedTaskBranch(
    task: Task,
    agent: AgentType
  ): Promise<GitBranch> {
    // Create branch with agent-specific naming
    // Set up branch protection
    // Initialize tracking
  }

  async commitWithMetadata(
    agent: AgentType,
    message: string,
    files: string[],
    metadata: CommitMetadata
  ): Promise<GitCommit> {
    // Create commit with agent context
    // Update shared memory
    // Create checkpoint if needed
  }

  async createDecisionCheckpoint(
    decision: Decision
  ): Promise<GitCheckpoint> {
    // Tag current state with decision metadata
    // Store decision details
    // Enable rollback to this point
  }

  async rollbackToCheckpoint(
    checkpoint: GitCheckpoint,
    reason: string
  ): Promise<RollbackResult> {
    // Perform git rollback
    // Update shared memory
    // Log rollback decision
  }
}
```

#### Branch Management Strategy
```yaml
branch_strategy:
  main_branch: main
  development_branches:
    - type: feature
      pattern: "feature/*"
      protection: true
    - type: task
      pattern: "task/*"
      isolation: full
      auto_cleanup: true
  agent_branches:
    director: "director/*"
    executor: "executor/*"
  cleanup_policy:
    max_age: "7d"
    success_criteria: "merged"
    manual_review: false
```

### 5. Decision Engine

#### Decision Types
```typescript
enum DecisionType {
  PROCEED_CHECK = 'proceed_check',      // Executor asks permission
  PLAN_APPROVAL = 'plan_approval',      // Director reviews plan
  CONFLICT_RESOLUTION = 'conflict',     // Agents disagree
  ROLLBACK_REQUEST = 'rollback',        // Undo previous decision
  ABORT_REQUEST = 'abort'              // Stop current task
}

interface Decision {
  id: string;
  type: DecisionType;
  initiator: AgentType;
  timestamp: Date;
  status: DecisionStatus;
  context: DecisionContext;
  options: DecisionOption[];
  outcome?: DecisionOutcome;
  reasoning?: string;
  attachments: DecisionAttachment[];
}
```

#### Decision Workflow
```typescript
class DecisionEngine {
  async processProceedCheck(
    check: ProceedCheck
  ): Promise<Decision> {
    // Validate context
    // Create decision record
    // Present to Director
    // Wait for response
    // Execute approved action
    // Log outcome
  }

  async createAlwaysYesRule(
    pattern: DecisionPattern
  ): Promise<AlwaysYesRule> {
    // Create automated approval rule
    // Store pattern for matching
    // Enable auto-approval for similar decisions
  }

  async getDecisionHistory(
    filters: DecisionFilter
  ): Promise<Decision[]> {
    // Query decision history
    // Apply filters
    // Return ordered results
  }
}
```

### 6. Workflow Orchestration

#### Task Execution Pipeline
```typescript
class WorkflowOrchestrator {
  private state: WorkflowState;
  private eventEmitter: WorkflowEventEmitter;

  async executeTask(task: Task): Promise<ExecutionResult> {
    try {
      // Initialize workflow
      await this.initializeWorkflow(task);

      // Director creates plan
      const plan = await this.director.createPlan(task);
      await this.sharedMemory.setPlan(plan);

      // Executor implements in phases
      for (const phase of plan.phases) {
        const result = await this.executor.executePhase(phase);

        // Check for approval
        const approval = await this.decisionEngine.checkProceed({
          phase,
          result,
          context: this.sharedMemory.getContext()
        });

        if (!approval.approved) {
          await this.rollbackToLastCheckpoint();
          break;
        }

        // Continue to next phase
      }

      return { success: true, artifacts: this.sharedMemory.getArtifacts() };
    } catch (error) {
      await this.handleWorkflowError(error);
      throw error;
    }
  }
}
```

#### State Management
```typescript
enum WorkflowState {
  INITIALIZING = 'initializing',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ROLLED_BACK = 'rolled_back',
  ERROR = 'error'
}

interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: Date;
  payload: any;
  source: AgentType;
}
```

### 7. Performance and Monitoring

#### Metrics Collection
```typescript
interface PerformanceMetrics {
  agentMetrics: AgentPerformance[];
  decisionMetrics: DecisionMetrics[];
  gitMetrics: GitMetrics[];
  memoryMetrics: MemoryMetrics[];

  // Real-time monitoring
  currentLoad: SystemLoad;
  responseTimes: ResponseTimeHistory;
  errorRates: ErrorRateHistory;
}

class MetricsCollector {
  async trackDecision(decision: Decision): Promise<void> {
    // Track decision performance
  }

  async trackAgentPerformance(
    agent: AgentType,
    metrics: AgentPerformance
  ): Promise<void> {
    // Track agent-specific metrics
  }

  async generateReport(period: ReportPeriod): Promise<PerformanceReport> {
    // Generate comprehensive performance report
  }
}
```

#### Monitoring Dashboard
```typescript
interface MonitoringDashboard {
  // Real-time metrics
  systemHealth: SystemHealth;
  agentStatus: AgentStatus[];
  activeDecisions: Decision[];
  recentActivity: ActivityLog[];

  // Analytics
  performanceTrends: TrendAnalysis;
  decisionPatterns: PatternAnalysis;
  efficiencyMetrics: EfficiencyReport;
}
```

### 8. Extensibility Framework

#### Plugin System
```typescript
interface ClaudePlugin {
  name: string;
  version: string;
  dependencies?: string[];

  // Lifecycle hooks
  onInit?: (context: PluginContext) => Promise<void>;
  onDecision?: (decision: Decision) => Promise<PluginResult>;
  onCommit?: (commit: GitCommit) => Promise<void>;
  onError?: (error: AgentError) => Promise<void>;

  // Custom components
  customComponents?: Map<string, React.Component>;
  customCommands?: Map<string, CommandHandler>;
}

class PluginManager {
  async loadPlugin(plugin: ClaudePlugin): Promise<void> {
    // Load and validate plugin
    // Register hooks and components
  }

  async executeHook(
    hookName: keyof ClaudePlugin,
    context: any
  ): Promise<PluginResult[]> {
    // Execute plugin hooks
    // Collect and merge results
  }
}
```

#### Configuration System
```typescript
interface SystemConfig {
  // Agent configuration
  agents: AgentConfig;

  // Git configuration
  git: GitConfig;

  // Memory configuration
  memory: MemoryConfig;

  // UI configuration
  ui: UIConfig;

  // Plugin configuration
  plugins: PluginConfig;

  // Security configuration
  security: SecurityConfig;
}

class ConfigManager {
  async loadConfiguration(): Promise<SystemConfig> {
    // Load from multiple sources
    // Apply environment overrides
    // Validate configuration
  }

  async updateConfiguration(updates: Partial<SystemConfig>): Promise<void> {
    // Update configuration
    // Validate changes
    // Notify affected components
  }
}
```

## Design Patterns and Principles

### 1. Observer Pattern
- Used for message broadcasting
- Agents subscribe to specific event types
- Decoupled communication between components

### 2. Strategy Pattern
- Different decision strategies based on context
- Configurable git branching strategies
- Pluggable memory storage backends

### 3. State Pattern
- Workflow state management
- Agent state transitions
- Decision state tracking

### 4. Command Pattern
- Git operations as commands
- Agent actions as commands
- Undo/redo functionality

### 5. Factory Pattern
- Agent instantiation
- Plugin creation
- Decision factory methods

## Scalability Considerations

### Horizontal Scaling
- Multiple instances of each agent type
- Load balancing for decision requests
- Distributed memory cache

### Vertical Scaling
- Optimized memory usage
- Efficient git operations
- Streamlined communication protocols

### Data Partitioning
- Sharded decision history
- Branch-specific isolation
- Time-based data archiving

## Error Handling and Resilience

### Error Types
```typescript
enum ErrorType {
  AGENT_ERROR = 'agent_error',
  COMMUNICATION_ERROR = 'communication_error',
  GIT_ERROR = 'git_error',
  MEMORY_ERROR = 'memory_error',
  VALIDATION_ERROR = 'validation_error',
  SYSTEM_ERROR = 'system_error'
}

interface ErrorContext {
  type: ErrorType;
  message: string;
  stack?: string;
  timestamp: Date;
  agent?: AgentType;
  decisionId?: string;
  retryable: boolean;
}
```

### Recovery Strategies
1. **Automatic Retry**: For transient network errors
2. **Fallback Mode**: When primary memory store unavailable
3. **Checkpoint Recovery**: Roll to last known good state
4. **Manual Intervention**: For critical system errors

## Future Enhancements

### 1. Multi-Agent Scaling
- Support for more than two agents
- Specialized agent roles (Tester, Documenter, etc.)
- Agent coordination protocols

### 2. External Integration
- CI/CD pipeline integration
- Testing framework integration
- Documentation generation
- Performance monitoring tools

### 3. Advanced Analytics
- Code quality metrics
- Development pattern analysis
- Predictive decision making
- Automated optimization suggestions

### 4. Machine Learning Integration
- Decision pattern recognition
- Agent performance optimization
- Automated task decomposition
- Predictive error prevention

This architecture provides a solid foundation for building an intelligent, collaborative development environment that scales with project complexity while maintaining traceability and safety.
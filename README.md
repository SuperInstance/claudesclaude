# Claude's Claude: Multi-Agent Development Assistant

An ambitious project creating a dual-agent system with shared memory and intelligent version control for collaborative software development.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [Key Components](#key-components)
- [Implementation Roadmap](#implementation-roadmap)
- [Technical Details](#technical-details)
- [Getting Started](#getting-started)
- [Security & Isolation](#security--isolation)
- [Contributing](#contributing)

## 🎯 Project Overview

"Claude's Claude" is an innovative multi-agent development environment where two AI assistants collaborate on coding tasks:

- **Director Claude**: Strategic planner and decision-maker
- **Executor Claude**: Hands-on code implementation specialist

The system provides a collaborative approach to software development with intelligent decision trees, shared context, and full rollback capabilities.

### Core Benefits

- **Traceability**: Every change linked to agent decisions
- **Rollbackability**: Git-based undo at any decision point
- **Abstraction**: Developer directs at high level
- **Safety**: Dual-agent verification system
- **Learning**: "Always Yes" automates repeated patterns

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Interface                       │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Claude-Code   │  │   Claude-Code   │                   │
│  │    (Primary)    │  │   (Secondary)   │                   │
│  └─────────────────┘  └─────────────────┘                   │
│           │                          │                       │
│           └───────────┬──────────────┘                       │
│                       ▼                                      │
│           ┌─────────────────────┐                           │
│           │   Shared Memory     │                           │
│           │   & Coordination    │                           │
│           └─────────────────────┘                           │
│                       │                                      │
│           ┌───────────┴───────────┐                         │
│           ▼                       ▼                         │
│  ┌─────────────────┐  ┌──────────────────────┐              │
│  │    Git Repo     │  │   Decision Logging   │              │
│  │  (Multi-branch) │  │   & Audit Trail     │              │
│  └─────────────────┘  └──────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Key Components

### 1. Modified UI Structure

A dual-panel interface replaces the traditional canvas layout:

```typescript
// New layout in components/Layout.tsx
<Grid container spacing={2}>
  <Grid item xs={6}>
    <ClaudePanel
      id="primary"
      title="Director Claude"
      role="director"
      onDecisionRequest={handleDecisionRequest}
    />
  </Grid>
  <Grid item xs={6}>
    <ClaudePanel
      id="secondary"
      title="Executor Claude"
      role="executor"
      onProceedCheck={handleProceedCheck}
    />
  </Grid>
</Grid>
```

### 2. Shared Memory System

Central coordination hub for agent collaboration:

```typescript
// lib/sharedMemory.ts
interface SharedMemory {
  context: {
    projectGoal: string;
    currentTask: string;
    constraints: string[];
    conversationHistory: Array<{
      agent: 'primary' | 'secondary';
      message: string;
      timestamp: Date;
    }>;
  };
  decisions: Array<{
    id: string;
    type: 'proceed_check' | 'plan_update' | 'conflict';
    initiator: string;
    status: 'pending' | 'approved' | 'rejected';
    reasoning: string;
    timestamp: Date;
  }>;
  artifacts: {
    codeFiles: Map<string, string>;
    plans: Array<ProjectPlan>;
    validations: Array<ValidationResult>;
  };
}
```

### 3. Inter-Agent Communication Protocol

Structured messaging between agents:

```typescript
// types/messaging.ts
type MessageType =
  | 'DIRECTION'      // Primary → Secondary
  | 'PROCEED_CHECK'  // Secondary → Primary
  | 'VALIDATION'     // Secondary → Primary
  | 'FEEDBACK'       // Primary → Secondary
  | 'COLLABORATION'; // Both directions

interface AgentMessage {
  id: string;
  type: MessageType;
  sender: 'primary' | 'secondary';
  content: string;
  metadata: {
    taskId?: string;
    requiresResponse?: boolean;
    priority: 'low' | 'medium' | 'high' | 'blocking';
  };
  timestamp: Date;
}
```

### 4. Git Integration & Branch Management

Intelligent version control for collaborative development:

```typescript
// lib/gitManager.ts
class GitManager {
  async createTaskBranch(taskName: string): Promise<string> {
    const branchName = `task/${this.slugify(taskName)}-${Date.now()}`;
    // Create branch from main
    // Return branch name for isolation
  }

  async commitWithAgentContext(
    agent: string,
    message: string,
    files: string[]
  ): Promise<string> {
    // Commits include agent metadata
    const commitMessage = `[${agent}] ${message}\n\nAgent Context: ${await this.getSharedContext()}`;
  }

  async rollbackToCheckpoint(checkpointId: string): Promise<void> {
    // Revert to specific agent decision point
  }
}
```

### 5. Decision & Proceed System

Intelligent decision-making interface:

```typescript
// components/DecisionManager.tsx
const DecisionManager: React.FC = () => {
  const handleProceedCheck = async (context: {
    proposedAction: string;
    reasoning: string;
    changes: FileChange[];
  }) => {
    // Present to Primary Claude for approval
    // Options: [✓] Yes, [✓] Always Yes, [✗] No
    // Log decision in shared memory
  };

  const renderDecisionInterface = () => (
    <div className="decision-panel">
      <h3>Proceed Check Required</h3>
      <pre>{currentDecision.context}</pre>
      <div className="decision-buttons">
        <Button onClick={() => approve('yes')}>✓ Yes</Button>
        <Button onClick={() => approve('always_yes')}>✓ Always Yes</Button>
        <Button onClick={() => reject()}>✗ No</Button>
      </div>
    </div>
  );
};
```

### 6. Workflow Orchestration

Main coordination engine for agent collaboration:

```typescript
// lib/workflowOrchestrator.ts
class WorkflowOrchestrator {
  async executeTask(task: Task): Promise<void> {
    // 1. Primary Claude analyzes task
    const plan = await this.primaryClaude.createPlan(task);

    // 2. Create isolated git branch
    const branch = await this.gitManager.createTaskBranch(task.name);

    // 3. Secondary Claude executes in phases
    for (const phase of plan.phases) {
      const result = await this.secondaryClaude.executePhase(phase);

      // 4. Proceed check at each milestone
      const approval = await this.decisionManager.checkProceed({
        phase,
        result,
        changes: await this.gitManager.getDiff()
      });

      if (!approval) {
        await this.gitManager.rollbackToLastCheckpoint();
        break;
      }

      // 5. Log and continue
      await this.sharedMemory.logDecision(approval);
    }
  }
}
```

## 🗓️ Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. **Fork & Setup**
   ```bash
   git clone https://github.com/dvdsgl/claude-canvas.git claudesclaude
   cd claudesclaude
   # Remove canvas dependencies
   # Install new dependencies: redis, simple-git, diff-viewer
   ```

2. **Dual Panel Interface**
   - Modify layout to show two chat panels
   - Add agent identification and role badges
   - Create shared context display panel

### Phase 2: Communication Layer (Week 3-4)
1. **Implement Shared Memory**
   - Redis for persistence or in-memory store
   - Context synchronization between panels
   - Message queue for inter-agent communication

2. **Basic Git Integration**
   - Initialize repo if not exists
   - Branch creation for tasks
   - Commit with agent metadata

### Phase 3: Decision System (Week 5-6)
1. **Proceed Check Interface**
   - Modal/popup for decisions
   - "Always Yes" rule learning
   - Decision history and audit trail

2. **Agent Coordination**
   - Primary can interrupt secondary
   - Secondary can request guidance
   - Conflict resolution protocol

### Phase 4: Advanced Features (Week 7-8)
1. **Rollback System**
   - Git-based checkpointing
   - Decision-point tagging
   - One-click revert to any decision

2. **Analytics & Visualization**
   - Decision timeline
   - Agent effectiveness metrics
   - Change impact analysis

## 🔬 Technical Details

### Storage Strategy

```yaml
shared_memory:
  type: redis  # or postgres for complex queries
  ttl: 24h    # keep context for active sessions
  backup: s3  # archive completed sessions

git_strategy:
  main_branch: main
  agent_branches: task/*
  auto_cleanup: 7d  # delete old branches
  checkpoint_tags: decision-*
```

### Agent Prompt Engineering

```typescript
// prompts/primaryDirector.ts
const PRIMARY_SYSTEM_PROMPT = `
You are Director Claude. Your role:
1. Analyze developer requests and create execution plans
2. Decompose tasks for Executor Claude
3. Review Executor's "Proceed?" checks
4. Provide strategic guidance
5. Maintain project vision and constraints

When Executor asks "Do you want to proceed?":
- Review changes and reasoning
- Respond with: YES, ALWAYS_YES, or NO
- If NO, provide clear feedback
`;

// prompts/secondaryExecutor.ts
const SECONDARY_SYSTEM_PROMPT = `
You are Executor Claude. Your role:
1. Receive tasks from Director Claude
2. Execute code changes incrementally
3. Before significant changes, ask "Do you want to proceed?"
4. Include reasoning and diff summary
5. Learn from "ALWAYS_YES" to automate similar decisions
`;
```

### Extensibility Points

1. **Plugin System**
   ```typescript
   interface ClaudePlugin {
     onDecision?: (decision: Decision) => Promise<void>;
     onCommit?: (commit: Commit) => Promise<void>;
     onError?: (error: AgentError) => Promise<void>;
   }
   ```

2. **Multi-Repository Support**
3. **Custom Decision Policies**
4. **External Tool Integration** (CI/CD, testing frameworks)

## 🚀 Getting Started

### Setup Script

```bash
#!/bin/bash
# setup-claudesclaude.sh

# Clone and setup
git clone https://github.com/dvdsgl/claude-canvas.git claudesclaude
cd claudesclaude

# Remove canvas dependencies
npm uninstall canvas konva react-konva

# Install new dependencies
npm install redis simple-git diff2html react-diff-viewer
npm install @types/simple-git --save-dev

# Setup git repo for agent work
mkdir -p agent-workspace
cd agent-workspace
git init
git checkout -b main
echo "# Claude's Claude Workspace" > README.md
git add . && git commit -m "Initial commit"

# Start development
cd ..
npm run dev
```

### Prerequisites

- Node.js >= 18.0.0
- Redis (optional, for persistent shared memory)
- Git (for version control integration)

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 🔒 Security & Isolation

### Git Sandboxing
```bash
# Run each agent branch in isolated container
docker run --rm -v ./repo:/repo agent-executor
```

### Context Boundaries
- Primary can see all context
- Secondary only sees assigned task context
- Shared memory has read/write permissions

### Rate Limiting
- Prevent infinite agent loops
- Max iterations per task
- Timeout protections

### Best Practices
1. Always validate user input at system boundaries
2. Use isolation for agent execution environments
3. Implement proper error handling for all agent interactions
4. Maintain audit trails for security compliance
5. Regular backups of shared memory state

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Submit pull requests with clear descriptions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Note**: This is an experimental project pushing the boundaries of AI-assisted development. Always review AI-generated code before committing to production systems.
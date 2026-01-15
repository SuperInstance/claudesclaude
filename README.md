# Claude Orchestration System

A lean, high-performance multi-agent orchestration system with TypeScript support.

## 🚀 Quick Start

```bash
git clone https://github.com/SuperInstance/claudesclaude.git
cd claudesclaude
npm install
npx tsc  # Build the project
node dist/cli.js start  # Start the system
```

## 📦 Core Features

- **Session Management**: Create and manage orchestration sessions
- **Message Bus**: Lightweight event-driven communication
- **Context Management**: Shared state across sessions
- **TypeScript Support**: Full type safety with strict configuration
- **CLI Interface**: Command-line tool for system interaction

## 🛠️ CLI Commands

### Start System
```bash
node dist/cli.js start
```

### Manage Sessions
```bash
# Create a session
node dist/cli.js session create -n "my-session" -w "/workspace/path"

# List all sessions
node dist/cli.js session list

# Get specific session
node dist/cli.js session get -s "session-id"
```

### Manage Context
```bash
# Set context
node dist/cli.js context set -k "key" -v '{"value": "data"}'

# Get context
node dist/cli.js context get -k "key"

# List all context
node dist/cli.js context list
```

## 🏗️ Architecture

### Core Components

1. **OrchestrationSystem** - Central session management
2. **MessageBus** - Event-driven communication
3. **Director** - Session lifecycle management
4. **ContextManager** - Shared state management
5. **CheckpointManager** - State persistence (basic)

### Type System

```typescript
type SessionType = 'ai-assistant' | 'development' | 'testing' | 'deployment';
type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

interface Session {
  id: string;
  type: SessionType;
  name: string;
  workspace: string;
  config: Record<string, any>;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| Bundle Size | 204KB |
| TypeScript Errors | 0 |
| Dependencies | Minimal (zod only) |
| Build Time | < 1 second |
| Test Coverage | Core functionality verified |

## 🔧 Development

### Build Commands
```bash
npx tsc              # Compile TypeScript
npx tsc --noEmit     # Type check only
npm run build        # Build with bun (if available)
```

### Project Structure
```
src/
├── core/           # Core orchestration components
│   ├── types.ts    # Type definitions
│   ├── registry.ts # Session management
│   ├── message-bus.ts # Event system
│   ├── director.ts # Session lifecycle
│   ├── context.ts  # State management
│   ├── checkpoint.ts # Persistence
│   └── department.ts # Specialized units
├── utils/          # Utility functions
│   └── git.ts      # Git integration
├── cli.ts          # CLI interface
└── index.ts        # Main exports

dist/              # Compiled JavaScript
```

## 🎯 Design Principles

1. **Simplicity** - Only essential functionality
2. **Type Safety** - Full TypeScript with strict mode
3. **Performance** - Minimal overhead, efficient data structures
4. **Maintainability** - Clean code structure
5. **Extensibility** - Easy to add new features

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure TypeScript compilation passes
5. Submit a pull request

## 🔍 Optimization Notes

This project has been optimized for:
- **Size**: Removed 194MB of unnecessary files
- **Performance**: Streamlined architecture
- **Maintainability**: Simple, focused codebase
- **Build Speed**: Fast TypeScript compilation

The system now provides a solid foundation for multi-agent orchestration without unnecessary complexity.
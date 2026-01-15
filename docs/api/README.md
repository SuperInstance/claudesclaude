# Claude Orchestration System API Documentation

## Overview

The Claude Orchestration System provides a comprehensive API for managing multi-session workflows, message passing, database operations, and worker thread management. This documentation covers all available APIs and provides examples for integration.

## Table of Contents

- [Core Components](#core-components)
  - [Message Bus API](./message-bus.md)
  - [Database API](./database.md)
  - [Worker Thread API](./worker-threads.md)
  - [Session Management API](./session-management.md)
  - [Checkpoint API](./checkpoints.md)
- [Authentication & Security](./security.md)
- [Error Handling](./error-handling.md)
- [Client SDK](../sdk/README.md)
  - [TypeScript SDK](../sdk/typescript/README.md)
  - [JavaScript SDK](../sdk/javascript/README.md)
- [API Testing](../testing/README.md)
- [Examples](../examples/README.md)
- [API Sandbox](../sandbox/README.md)
- [Migration Guides](../migration/README.md)

## Quick Start

### Installation

```bash
# Install the client SDK
npm install @claudesclaude/orchestration-sdk

# Or use with Bun
bun add @claudesclaude/orchestration-sdk
```

### Basic Usage

```typescript
import { OrchestrationClient } from '@claudesclaude/orchestration-sdk';

const client = new OrchestrationClient({
  databasePath: './orchestration.db',
  messageQueuePath: './.orchestration/queue'
});

// Create a session
const session = await client.sessions.create({
  type: 'director',
  name: 'main-director',
  workspace: '/workspace/main'
});

// Send a message
await client.messageBus.publish({
  type: 'COMMAND',
  sender: session.id,
  receiver: 'department-1',
  content: { action: 'process_data', data: {} }
});
```

## API Versioning

The API follows semantic versioning:

- **Major (X.0.0)**: Breaking changes
- **Minor (0.X.0)**: Backward-compatible new features
- **Patch (0.0.X)**: Backward-compatible bug fixes

Current API Version: `v1.0.0`

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Message Bus**: 1000 requests per minute
- **Database Operations**: 500 requests per minute
- **Worker Threads**: 100 requests per minute

## Support

For support and questions:
- GitHub Issues: [claudesclaude/orchestration](https://github.com/claudesclaude/orchestration)
- Documentation: [docs.api.claudesclaude.com](https://docs.api.claudesclaude.com)
- Community: [Discord](https://discord.gg/claudesclaude)
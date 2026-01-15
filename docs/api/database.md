# Database API

The Database API provides type-safe operations for managing sessions, departments, checkpoints, and messages using SQLite with advanced features like connection pooling, transactions, and bulk operations.

## Overview

The Database API supports:
- Type-safe database operations with full CRUD operations
- Connection pooling for improved performance
- Batch insertions for bulk operations
- Full-text search capabilities
- Transaction support for data consistency
- Automatic schema migrations
- Comprehensive error handling

## Database Schema

### Core Tables

#### `sessions`
Stores orchestration sessions and their metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique session identifier |
| `type` | TEXT | Session type (director, department, observer, active) |
| `name` | TEXT | Human-readable session name |
| `status` | TEXT | Current status (initializing, active, idle, completed, error, terminated) |
| `branch` | TEXT | Git branch associated with session |
| `workspace` | TEXT | Workspace directory |
| `created_at` | DATETIME | Session creation timestamp |
| `last_activity` | DATETIME | Last activity timestamp |
| `metadata_json` | JSON | Additional metadata as JSON |
| `termination_reason` | TEXT | Reason for termination |
| `terminated_at` | DATETIME | Termination timestamp |

#### `departments`
Stores department information within sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique department identifier |
| `name` | TEXT | Department name |
| `domain` | TEXT | Department domain |
| `session_id` | TEXT | Parent session ID |
| `is_active` | INTEGER | Active status (boolean) |
| `current_task` | TEXT | Current task ID |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

#### `checkpoints`
Stores checkpoint data for state management.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique checkpoint identifier |
| `name` | TEXT | Checkpoint name |
| `session_id` | TEXT | Associated session ID |
| `timestamp` | DATETIME | Checkpoint creation timestamp |
| `snapshot_json` | JSON | State snapshot as JSON |
| `branches_json` | JSON | Associated branches as JSON array |
| `feature` | TEXT | Feature name |
| `priority` | TEXT | Priority level |
| `author` | TEXT | Author information |
| `description` | TEXT | Checkpoint description |
| `workflow_id` | TEXT | Workflow ID |
| `step_id` | TEXT | Step ID |
| `created_by` | TEXT | Creator ID |
| `size` | INTEGER | Checkpoint size in bytes |
| `checksum` | TEXT | Data checksum |
| `compressed` | INTEGER | Compression flag (boolean) |
| `encrypted` | INTEGER | Encryption flag (boolean) |
| `retention_expires_at` | DATETIME | Retention expiration |
| `restored_from` | TEXT | Source checkpoint ID if restored |

#### `messages`
Stores all messages sent through the system.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | Unique message identifier |
| `type` | TEXT | Message type |
| `priority` | INTEGER | Message priority (1-4) |
| `sender` | TEXT | Sender session ID |
| `receiver` | TEXT | Receiver session ID |
| `timestamp` | DATETIME | Message timestamp |
| `content_json` | JSON | Message content as JSON |
| `metadata_json` | JSON | Additional metadata |
| `requires_response` | INTEGER | Response required flag |
| `response_deadline` | DATETIME | Response deadline |
| `retry_count` | INTEGER | Retry attempt count |
| `max_retries` | INTEGER | Maximum retry attempts |
| `delivered` | INTEGER | Delivered flag |
| `delivered_at` | DATETIME | Delivery timestamp |
| `failed` | INTEGER | Failed flag |
| `failure_reason` | TEXT | Failure reason |

### FTS Tables

The system includes full-text search tables for efficient text-based searches:
- `sessions_fts`: Search session names and workspaces
- `checkpoints_fts`: Search checkpoint names and descriptions

## Database Operations

### Initialization

```typescript
import { Database, createDatabase } from '@claudesclaude/orchestration-sdk';

// Create database instance
const db = await createDatabase({
  path: './orchestration.db',
  enableFTS: true,
  connectionPool: {
    min: 2,
    max: 10,
    idleTimeout: 30000
  }
});
```

### Session Operations

#### Create Session

```typescript
const session = await db.sessions.create({
  type: 'director',
  name: 'main-director',
  workspace: '/workspace/main',
  capabilities: ['task_management', 'resource_allocation'],
  constraints: ['max_concurrent_tasks:5'],
  metadata: {
    version: '1.0.0',
    configuration: { autoScale: true }
  }
});

console.log('Session created:', session.id);
```

#### Get Session

```typescript
const session = await db.sessions.getSession('session-123');

if (session) {
  console.log('Session found:', session.name, session.status);
} else {
  console.log('Session not found');
}
```

#### Get Sessions by Type

```typescript
const directorSessions = await db.sessions.getSessionsByType('director', {
  pagination: { page: 1, pageSize: 10 },
  orderBy: [{ field: 'created_at', direction: 'DESC' }]
});

console.log('Found', directorSessions.length, 'director sessions');
```

#### Update Session

```typescript
const success = await db.sessions.updateSession('session-123', {
  status: 'active',
  metadata: {
    lastActivity: new Date(),
    processedTasks: 5
  }
});

console.log('Update successful:', success);
```

#### Delete Session

```typescript
const deleted = await db.sessions.deleteSession('session-123');
console.log('Session deleted:', deleted);
```

#### Search Sessions

```typescript
const results = await db.sessions.searchSessions('director', 5);

for (const session of results) {
  console.log(`Found: ${session.name} (${session.id})`);
}
```

### Department Operations

#### Create Department

```typescript
const department = await db.departments.create({
  name: 'data-processor',
  domain: 'data-processing',
  session: session,
  isActive: true,
  currentTask: 'task-456',
  performance: {
    messagesProcessed: 100,
    averageResponseTime: 150,
    errorRate: 0.02,
    throughput: 10,
    lastActivity: new Date()
  }
});
```

#### Get Departments by Session

```typescript
const departments = await db.departments.getDepartmentsBySession(session.id);

for (const dept of departments) {
  console.log(`${dept.name}: ${dept.isActive ? 'active' : 'inactive'}`);
}
```

### Checkpoint Operations

#### Create Checkpoint

```typescript
const checkpoint = await db.checkpoints.create({
  name: 'checkpoint-v1.0',
  sessionId: session.id,
  timestamp: new Date(),
  snapshot: {
    sessions: [session.id],
    branches: ['main', 'feature-branch'],
    state: { progress: 75, completed: [1, 2, 3] }
  },
  branches: ['main', 'feature-branch'],
  metadata: {
    feature: 'feature-xyz',
    priority: 'high',
    author: 'developer-1',
    description: 'Checkpoint before feature implementation',
    workflowId: 'wf-123',
    stepId: 'step-456',
    tags: ['stable', 'release-candidate']
  },
  createdBy: 'developer-1',
  size: 1024000,
  checksum: 'abc123...',
  compressed: true,
  encrypted: true,
  retentionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
});
```

#### Get Checkpoints by Feature

```typescript
const checkpoints = await db.checkpoints.getCheckpointsByFeature('feature-xyz');

for (const cp of checkpoints) {
  console.log(`${cp.name}: ${cp.timestamp.toISOString()}`);
}
```

#### Search Checkpoints

```typescript
const results = await db.checkpoints.searchCheckpoints('release', 10);

for (const cp of results) {
  console.log(`Found: ${cp.name} - ${cp.metadata.description}`);
}
```

### Message Operations

#### Create Message

```typescript
const message = await db.messages.create({
  id: 'msg-789',
  type: 'COMMAND',
  priority: 3, // HIGH
  sender: 'session-123',
  receiver: 'session-456',
  timestamp: new Date(),
  content: {
    action: 'process_data',
    parameters: { dataset: 'large' }
  },
  metadata: {
    tags: ['urgent', 'data-processing'],
    correlationId: 'txn-999'
  },
  requiresResponse: true,
  responseDeadline: new Date(Date.now() + 300000), // 5 minutes
  maxRetries: 3
});
```

#### Get Messages by Conversation

```typescript
const conversation = await db.messages.getConversation(
  'session-123',
  'session-456',
  50 // limit
);

console.log(`Conversation has ${conversation.length} messages`);
```

#### Mark Message as Delivered

```typescript
const delivered = await db.messages.markMessageDelivered('msg-789');
console.log('Message delivered:', delivered);
```

#### Delete Old Messages

```typescript
const deletedCount = await db.messages.deleteOldMessages(30); // older than 30 days
console.log('Deleted', deletedCount, 'old messages');
```

### Bulk Operations

#### Bulk Insert Sessions

```typescript
const sessions = [
  {
    id: 'session-1',
    type: 'department',
    name: 'dept-1',
    workspace: '/workspace/dept1'
  },
  {
    id: 'session-2',
    type: 'department',
    name: 'dept-2',
    workspace: '/workspace/dept2'
  }
];

const result = await db.sessions.bulkInsertSessions(sessions);
console.log(`Inserted: ${result.inserted}, Failed: ${result.failed}`);
```

#### Bulk Insert Messages

```typescript
const messages = Array.from({ length: 100 }, (_, i) => ({
  id: `msg-${i}`,
  type: 'PROGRESS_REPORT',
  sender: 'session-123',
  timestamp: new Date(),
  content: { progress: i }
}));

const result = await db.messages.bulkInsertMessages(messages);
```

### Aggregation Queries

#### Count Sessions by Status

```typescript
const statusCounts = await db.sessions.countSessionsByStatus();
console.log(statusCounts);
// {
//   initializing: 2,
//   active: 5,
//   idle: 3,
//   completed: 10,
//   error: 1,
//   terminated: 0
// }
```

#### Aggregate Metrics

```typescript
const totalSessions = await db.aggregate('sessions', 'id', 'COUNT');
const avgResponseTime = await db.aggregate('messages', 'timestamp', 'AVG', {
  where: 'delivered = 1',
  params: []
});
```

#### Group By Query

```typescript
const statusMetrics = await db.groupByAggregate(
  'sessions',
  'status',
  'id',
  'COUNT'
);

console.log(statusMetrics);
// [
//   { status: 'active', result: 5 },
//   { status: 'idle', result: 3 },
//   ...
// ]
```

### Transaction Support

```typescript
try {
  await db.executeTransaction(async (conn) => {
    // Create session
    const session = await db.sessions.create(sessionData);

    // Create associated departments
    for (const dept of departmentData) {
      dept.sessionId = session.id;
      await db.departments.create(dept);
    }

    // Create initial checkpoint
    await db.checkpoints.create({
      ...checkpointData,
      sessionId: session.id
    });

    // All operations succeed together or fail together
  });
} catch (error) {
  console.error('Transaction failed:', error);
}
```

### Connection Management

```typescript
// Get current connection pool status
const poolStats = db.getConnectionPoolStats();
console.log(poolStats);

// Close database connection
await db.close();
```

### Complete Example

```typescript
import { createDatabase } from '@claudesclaude/orchestration-sdk';

async function main() {
  // Initialize database
  const db = await createDatabase({
    path: './orchestration.db',
    enableFTS: true
  });

  try {
    // Create a session
    const session = await db.sessions.create({
      type: 'director',
      name: 'my-director',
      workspace: '/workspace/my-project'
    });

    // Create departments
    await db.departments.create({
      name: 'data-processor',
      domain: 'data',
      session: session,
      isActive: true
    });

    await db.departments.create({
      name: 'validator',
      domain: 'validation',
      session: session,
      isActive: true
    });

    // Create a checkpoint
    await db.checkpoints.create({
      name: 'initial-state',
      sessionId: session.id,
      timestamp: new Date(),
      snapshot: {
        sessions: [session.id],
        state: { initialized: true }
      },
      metadata: {
        feature: 'initialization',
        author: 'admin',
        description: 'Initial system state'
      }
    });

    // Search sessions
    const searchResults = await db.sessions.searchSessions('director');
    console.log(`Found ${searchResults.length} director sessions`);

    // Get statistics
    const stats = await db.sessions.countSessionsByStatus();
    console.log('Session status:', stats);

  } finally {
    // Close database connection
    await db.close();
  }
}

main().catch(console.error);
```

## Performance Optimization

### Indexing

The database is automatically indexed on frequently queried columns:
- Primary keys: `id`
- Foreign keys: `session_id`, `department_id`
- Search columns: `type`, `status`, `feature`
- Time columns: `created_at`, `timestamp`

### Batch Operations

Always use batch operations for bulk inserts:
```typescript
// Instead of individual inserts
for (const item of items) {
  await db.sessions.create(item);
}

// Use batch insert
await db.sessions.bulkInsertSessions(items);
```

### Connection Pooling

Configure connection pool based on your workload:
```typescript
const db = await createDatabase({
  connectionPool: {
    min: 2,           // Minimum connections
    max: 20,          // Maximum connections
    idleTimeout: 30000 // 30 seconds
  }
});
```

### Query Optimization

Use filters and pagination for large datasets:
```typescript
// Good - with filtering and pagination
const results = await db.sessions.getSessionsByType('director', {
  pagination: { page: 1, pageSize: 100 },
  orderBy: [{ field: 'created_at', direction: 'DESC' }]
});

// Better - with specific filters
const results = await db.sessions.getAllSessions({
  where: 'status = ? AND created_at > ?',
  params: ['active', '2024-01-01'],
  orderBy: [{ field: 'last_activity', direction: 'ASC' }]
});
```

## Error Handling

```typescript
import { DatabaseError, ValidationError } from '@claudesclaude/orchestration-sdk';

try {
  await db.sessions.create(session);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.field);
  } else if (error instanceof DatabaseError) {
    console.error('Database error:', error.code);
    console.error('SQL:', error.sql);
    console.error('Params:', error.params);
  }
}
```
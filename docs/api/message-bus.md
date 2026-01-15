# Message Bus API

The Message Bus is the core communication system for the orchestration layer, providing reliable message delivery between sessions, departments, and workers.

## Overview

The Message Bus supports:
- Asynchronous and synchronous message patterns
- Message batching for performance
- Priority-based routing
- Retry mechanisms with exponential backoff
- Message persistence and recovery
- Subscription-based filtering

## Base URL

All Message Bus operations are local file-based operations:

```typescript
// Configuration
const config = {
  queuePath: './.orchestration/queue',  // Message queue directory
  maxQueueSize: 10000,                  // Maximum queue size
  gcIntervalMs: 60000                   // Garbage collection interval
};
```

## API Endpoints

### Create Message Bus Instance

```typescript
import { createMessageBus } from '@claudesclaude/orchestration-sdk';

// Create with default configuration
const messageBus = createMessageBus();

// Create with custom configuration
const messageBus = createMessageBus({
  queuePath: './custom/queue',
  maxQueueSize: 50000,
  gcIntervalMs: 30000
});
```

### Publishing Messages

#### Publish Single Message

```typescript
await messageBus.publish({
  id: 'msg-123',                     // Unique message ID
  type: 'COMMAND',                   // Message type
  priority: MessagePriority.HIGH,   // Priority (1-4)
  sender: 'session-1',              // Sender ID
  receiver: 'session-2',            // Optional receiver ID
  timestamp: new Date(),            // Message timestamp
  content: {                        // Message payload
    action: 'process_data',
    parameters: { id: 'data-123' }
  },
  metadata: {                       // Additional metadata
    tags: ['urgent', 'data-processing'],
    correlationId: 'txn-456'
  }
});
```

#### Publish Batch of Messages

```typescript
const messages = [
  {
    id: 'msg-batch-1',
    type: 'COMMAND',
    sender: 'session-1',
    content: { action: 'task_1' }
  },
  {
    id: 'msg-batch-2',
    type: 'PROGRESS_REPORT',
    sender: 'session-1',
    content: { progress: 50 }
  }
];

await messageBus.publishBatch(messages);
```

#### Publish to Batch (Delayed Processing)

```typescript
// Messages are collected and flushed after timeout
await messageBus.publishToBatch({
  id: 'msg-delayed-1',
  type: 'DATA_UPDATE',
  sender: 'session-1',
  content: { updates: [] }
});

// Automatically flushes when batch size reached or timeout occurs
```

### Subscribing to Messages

#### Basic Subscription

```typescript
const unsubscribe = messageBus.subscribe(async (message) => {
  console.log('Received message:', message);

  // Process message and acknowledge
  await messageBus.acknowledge(message.id);
}, {
  types: ['COMMAND', 'PROGRESS_REPORT'],  // Filter by message types
  priorities: [MessagePriority.HIGH]      // Filter by priority
});

// Unsubscribe when done
unsubscribe();
```

#### Advanced Filtering

```typescript
const unsubscribe = messageBus.subscribe(async (message) => {
  // Process message
}, {
  types: ['COMMAND'],                     // Specific message types
  priorities: [MessagePriority.HIGH, MessagePriority.CRITICAL],  // Multiple priorities
  senders: ['session-1', 'session-2'],  // Specific senders
  receivers: ['session-3'],             // Specific receivers
  tags: ['urgent', 'processing']        // Metadata tags
});
```

### Request-Response Pattern

```typescript
// Send request and wait for response
const request = {
  id: 'req-123',
  type: 'VERIFICATION_REQUEST',
  sender: 'session-1',
  content: { verificationType: 'code_quality' }
};

try {
  const response = await messageBus.request(request, 5000); // 5 second timeout

  console.log('Response received:', response);

  if (response.type === 'VERIFICATION_RESPONSE') {
    // Handle verification result
  }
} catch (error) {
  if (error instanceof MessageTimeoutError) {
    console.error('Request timed out');
  }
}
```

### Message Processing

#### Acknowledge Message

```typescript
// Mark message as successfully processed
await messageBus.acknowledge(message.id);
```

#### Reject Message

```typescript
// Move message to error queue with reason
await messageBus.reject(message.id, 'Invalid format');
```

### Queue Management

#### Get Queue Statistics

```typescript
const stats = messageBus.getStats();
console.log({
  messagesPublished: stats.messagesPublished,
  messagesDelivered: stats.messagesDelivered,
  messagesFailed: stats.messagesFailed,
  averageLatency: stats.averageLatency,
  queueSize: stats.queueSize,
  subscribers: stats.subscribers
});
```

#### Get Current Queue Size

```typescript
const size = await messageBus.getQueueSize();
console.log(`Current queue size: ${size}`);
```

### Health Check

```typescript
const health = await messageBus.healthCheck();
console.log(health);

// Possible statuses:
// - 'healthy': Queue operating normally
// - 'degraded': Queue size elevated (70-90% capacity)
// - 'unhealthy': Queue approaching maximum capacity (>90%)
```

### Message Types

| Type | Description | Direction |
|------|-------------|-----------|
| `DIRECTION` | General direction from director | Director → Department |
| `COMMAND` | Direct command execution | Director → Department |
| `VERIFICATION_REQUEST` | Request for verification | Director → Department |
| `MERGE_REQUEST` | Request for merge operation | Director → Department |
| `STATUS_UPDATE` | Status update notification | Department → Director |
| `PROGRESS_REPORT` | Progress report | Department → Director |
| `COMPLETION_NOTIFICATION` | Task completion notification | Department → Director |
| `BLOCKED_NOTIFICATION` | Blocked task notification | Department → Director |
| `HEARTBEAT` | System heartbeat | Bidirectional |
| `ERROR` | Error message | Bidirectional |
| `ACKNOWLEDGMENT` | Message acknowledgment | Bidirectional |
| `SESSION_REGISTER` | Session registration | System |
| `SESSION_DEREGISTER` | Session deregistration | System |
| `CHECKPOINT_CREATE` | Create checkpoint | System |
| `CHECKPOINT_RESTORE` | Restore checkpoint | System |

### Message Priorities

| Priority | Value | Description |
|----------|-------|-------------|
| `LOW` | 1 | Low priority, can be delayed |
| `NORMAL` | 2 | Standard priority |
| `HIGH` | 3 | High priority, should be processed quickly |
| `CRITICAL` | 4 | Critical priority, immediate processing |

### Error Handling

```typescript
import {
  OrchestrationError,
  ValidationError,
  MessageTimeoutError
} from '@claudesclaude/orchestration-sdk';

try {
  await messageBus.publish(message);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid message:', error.field);
  } else if (error instanceof OrchestrationError) {
    console.error('Message bus error:', error.code);
  }
}
```

### Complete Example

```typescript
import { createMessageBus, MessagePriority } from '@claudesclaude/orchestration-sdk';

const messageBus = createMessageBus();

// Subscribe for processing
const unsubscribe = messageBus.subscribe(async (message) => {
  console.log(`Processing message ${message.id}:`, message.content);

  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Acknowledge successful processing
  await messageBus.acknowledge(message.id);
}, {
  types: ['COMMAND'],
  priorities: [MessagePriority.HIGH, MessagePriority.CRITICAL]
});

// Publish some messages
await messageBus.publish({
  id: 'cmd-1',
  type: 'COMMAND',
  priority: MessagePriority.HIGH,
  sender: 'director-1',
  receiver: 'worker-1',
  timestamp: new Date(),
  content: { action: 'process_file', filename: 'data.txt' }
});

// Wait for processing
await new Promise(resolve => setTimeout(resolve, 1000));

// Cleanup
unsubscribe();
await messageBus.shutdown();
```

## Performance Considerations

- **Batching**: Use `publishBatch` for multiple messages to improve performance
- **Filtering**: Apply filters in subscriptions to reduce processing overhead
- **Queue Size**: Monitor queue size and implement backpressure when needed
- **Cleanup**: Enable garbage collection to prevent queue growth
- **Retry Logic**: Configure appropriate retry strategies for your use case
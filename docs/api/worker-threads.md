# Worker Threads API

The Worker Threads API provides a sophisticated system for managing CPU-intensive tasks with automatic scaling, health monitoring, and intelligent resource management.

## Overview

The Worker Thread Manager supports:
- Dynamic worker pool scaling based on load
- Priority-based task scheduling
- Health monitoring with automatic recovery
- Task retry mechanisms with exponential backoff
- Performance metrics and monitoring
- Resource usage tracking
- Graceful shutdown handling

## Worker Task Types

| Task Type | Description | Use Cases |
|-----------|-------------|-----------|
| `DATA_PROCESSING` | General data processing | Batch processing, ETL |
| `IMAGE_MANIPULATION` | Image processing | Resizing, filtering, transformations |
| `COMPRESSION` | Data compression | File compression, data encoding |
| `ENCRYPTION` | Encryption operations | Crypto operations, secure processing |
| `ANALYSIS` | Data analysis | Statistical analysis, ML inference |
| `COMPUTATION` | CPU-intensive calculations | Mathematical computations, simulations |
| `FILE_IO` | File operations | Heavy file processing, parsing |
| `CUSTOM` | Custom task types | User-defined processing logic |

## Worker States

| State | Description |
|-------|-------------|
| `IDLE` | Worker available for tasks |
| `BUSY` | Currently processing a task |
| `UNHEALTHY` | Worker malfunctioning |
| `TERMINATING` | Worker shutting down |
| `TERMINATED` | Worker has shut down |

## Task Status

| Status | Description |
|--------|-------------|
| `PENDING` | Task in queue waiting for execution |
| `ASSIGNED` | Task assigned to a worker |
| `RUNNING` | Task currently executing |
| `COMPLETED` | Task successfully completed |
| `FAILED` | Task failed permanently |
| `CANCELLED` | Task cancelled by user |
| `TIMEOUT` | Task timed out |

## Configuration

### Default Configuration

```typescript
const defaultConfig = {
  minWorkers: 2,                    // Minimum number of workers
  maxWorkers: 8,                    // Maximum number of workers
  maxTaskQueueSize: 1000,           // Maximum tasks in queue
  taskTimeout: 30000,               // 30 seconds timeout per task
  healthCheckInterval: 30000,       // 30 seconds health checks
  workerIdleTimeout: 300000,       // 5 minutes idle timeout
  maxWorkerMemory: 512 * 1024 * 1024, // 512MB memory limit
  maxRetries: 3,                   // Maximum retry attempts
  retryDelay: 1000,                // 1 second retry delay
  enableAutoScaling: true,         // Enable auto-scaling
  enableHealthChecks: true,        // Enable health checks
  scaleUpThreshold: 0.7,          // Scale up at 70% utilization
  scaleDownThreshold: 0.3,         // Scale down at 30% utilization
  scaleUpCooldown: 30000,          // 30 seconds between scale-ups
  scaleDownCooldown: 60000,        // 60 seconds between scale-downs
  backpressureThreshold: 0.9,      // Backpressure at 90% queue
  maxTasksPerWorker: 100,          // Recycle worker after this many tasks
  workerRecycleThreshold: 500      // Worker recycle threshold
};
```

### Creating Worker Manager

```typescript
import { createWorkerManager, WorkerTaskType } from '@claudesclaude/orchestration-sdk';

// Create with default configuration
const workerManager = createWorkerManager();

// Create with custom configuration
const workerManager = createWorkerManager({
  minWorkers: 4,
  maxWorkers: 16,
  taskTimeout: 60000,
  maxRetries: 5,
  enableAutoScaling: true
});
```

## Task Submission

### Submit Basic Task

```typescript
const taskId = await workerManager.submitTask(
  WorkerTaskType.DATA_PROCESSING,
  { data: Array.from({ length: 10000 }, (_, i) => i) },
  (error, result) => {
    if (error) {
      console.error('Task failed:', error);
    } else {
      console.log('Task completed:', result);
    }
  }
);

console.log('Task submitted with ID:', taskId);
```

### Submit Task with Options

```typescript
const taskId = await workerManager.submitTask(
  WorkerTaskType.IMAGE_MANIPULATION,
  {
    image: 'path/to/image.jpg',
    operation: 'resize',
    width: 800,
    height: 600
  },
  (error, result) => {
    // Handle result
  },
  {
    priority: TaskPriority.HIGH,
    timeout: 45000,      // 45 seconds timeout
    maxRetries: 2,       // Only retry twice
    dependencies: ['task-123'], // Wait for this task to complete
    metadata: {
      userId: 'user-456',
      projectId: 'project-789'
    }
  }
);
```

### Submit Multiple Tasks

```typescript
// Submit tasks with dependencies
const taskIds = [];

// First task
const taskId1 = await workerManager.submitTask(
  WorkerTaskType.DATA_PROCESSING,
  { input: 'data1.csv' },
  null, // No callback for parent task
  { priority: TaskPriority.HIGH }
);
taskIds.push(taskId1);

// Second task depends on first
const taskId2 = await workerManager.submitTask(
  WorkerTaskType.ANALYSIS,
  { analysisType: 'statistical' },
  null,
  {
    priority: TaskPriority.NORMAL,
    dependencies: [taskId1]
  }
);
taskIds.push(taskId2);

// Parent task depends on both
const parentId = await workerManager.submitTask(
  WorkerTaskType.COMPUTATION,
  { computation: 'merge_results' },
  (error, result) => {
    if (error) {
      console.error('Parent task failed:', error);
    } else {
      console.log('All dependencies completed:', result);
    }
  },
  {
    priority: TaskPriority.CRITICAL,
    dependencies: taskIds
  }
);
```

## Monitoring and Metrics

### Get Worker Statistics

```typescript
const metrics = workerManager.getMetrics();
console.log(metrics);
// {
//   totalWorkers: 4,
//   activeWorkers: 2,
//   idleWorkers: 2,
//   unhealthyWorkers: 0,
//   pendingTasks: 5,
//   runningTasks: 2,
//   completedTasks: 150,
//   failedTasks: 3,
//   averageTaskDuration: 2500,
//   averageQueueTime: 800,
//   throughput: 2.5,
//   cpuUtilization: 0.5,
//   memoryUtilization: 0.3
// }
```

### Get Worker Status

```typescript
const workerStatus = workerManager.getWorkerStatus();
console.log(workerStatus);
// [
//   {
//     id: 'worker-1',
//     state: 'BUSY',
//     currentTask: 'task-123',
//     tasksCompleted: 25,
//     tasksFailed: 1,
//     isHealthy: true
//   },
//   {
//     id: 'worker-2',
//     state: 'IDLE',
//     currentTask: null,
//     tasksCompleted: 30,
//     tasksFailed: 0,
//     isHealthy: true
//   }
// ]
```

### Health Check

```typescript
// Manual health check
await workerManager.performHealthChecks();

// Listen for health check events
workerManager.on('workerHeartbeat', (worker) => {
  console.log(`Worker ${worker.id} heartbeat received`);
});

workerManager.on('workerError', ({ worker, error }) => {
  console.error(`Worker ${worker.id} error:`, error);
});
```

## Task Management

### Cancel Task

```typescript
const cancelled = await workerManager.cancelTask('task-123');

if (cancelled) {
  console.log('Task cancelled successfully');
} else {
  console.log('Task not found or cannot be cancelled');
}
```

### Monitor Task Progress

```typescript
// Listen for progress updates
workerManager.on('taskProgress', ({ task, worker, progress }) => {
  console.log(`Task ${task.id}: ${progress}% complete`);
});

// Submit task with progress tracking
const taskId = await workerManager.submitTask(
  WorkerTaskType.ANALYSIS,
  { dataset: 'large' },
  (error, result) => {
    // Final callback
  },
  { priority: TaskPriority.NORMAL }
);
```

## Event Handling

### Available Events

```typescript
// Task lifecycle events
workerManager.on('taskSubmitted', (task) => {
  console.log('Task submitted:', task.id);
});

workerManager.on('taskAssigned', ({ task, worker }) => {
  console.log(`Task ${task.id} assigned to worker ${worker.id}`);
});

workerManager.on('taskCompleted', ({ task, worker }) => {
  console.log(`Task ${task.id} completed by ${worker.id}`);
  console.log('Duration:', task.completedAt - task.startedAt, 'ms');
});

workerManager.on('taskFailed', ({ task, worker }) => {
  console.error(`Task ${task.id} failed on ${worker.id}:`, task.error);
});

workerManager.on('taskTimeout', ({ task, worker }) => {
  console.warn(`Task ${task.id} timed out on ${worker.id}`);
});

// Worker lifecycle events
workerManager.on('workerCreated', (worker) => {
  console.log('New worker created:', worker.id);
});

workerManager.on('workerExited', ({ worker, exitCode }) => {
  console.log(`Worker ${worker.id} exited with code ${exitCode}`);
});

workerManager.on('workerTerminated', (worker) => {
  console.log('Worker terminated:', worker.id);
});

// Scaling events
workerManager.on('scaledUp', ({ workerCount }) => {
  console.log('Scaled up to', workerCount, 'workers');
});

workerManager.on('scaledDown', ({ workerCount }) => {
  console.log('Scaled down to', workerCount, 'workers');
});

// Metrics events
workerManager.on('metricsUpdated', (metrics) => {
  console.log('Updated metrics:', metrics.throughput, 'tasks/sec');
});
```

## Complete Example

```typescript
import { createWorkerManager, WorkerTaskType, TaskPriority } from '@claudesclaude/orchestration-sdk';

async function main() {
  // Create worker manager
  const workerManager = createWorkerManager({
    minWorkers: 2,
    maxWorkers: 8,
    taskTimeout: 30000,
    enableAutoScaling: true,
    enableHealthChecks: true
  });

  // Set up event listeners
  workerManager.on('taskCompleted', ({ task }) => {
    console.log(`✅ Task ${task.id} completed in ${task.completedAt - task.startedAt}ms`);
  });

  workerManager.on('taskFailed', ({ task }) => {
    console.error(`❌ Task ${task.id} failed:`, task.error);
  });

  workerManager.on('scaledUp', ({ workerCount }) => {
    console.log(`📈 Scaled up to ${workerCount} workers`);
  });

  workerManager.on('scaledDown', ({ workerCount }) => {
    console.log(`📉 Scaled down to ${workerCount} workers`);
  });

  try {
    // Submit multiple tasks
    const taskPromises = Array.from({ length: 20 }, (_, i) => {
      return workerManager.submitTask(
        WorkerTaskType.DATA_PROCESSING,
        {
          data: Array.from({ length: 1000 }, (_, j) => ({ id: i * 1000 + j, value: Math.random() })),
          iteration: i
        },
        (error, result) => {
          if (error) {
            console.error(`Task ${i} error:`, error.message);
          } else {
            console.log(`Task ${i} processed ${result.data.length} items`);
          }
        },
        {
          priority: i < 5 ? TaskPriority.HIGH : TaskPriority.NORMAL,
          timeout: 20000
        }
      );
    });

    const taskIds = await Promise.all(taskPromises);
    console.log(`Submitted ${taskIds.length} tasks`);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Monitor progress
    const metrics = workerManager.getMetrics();
    console.log('Current metrics:', metrics);

    // Submit some dependent tasks
    const parentId = await workerManager.submitTask(
      WorkerTaskType.ANALYSIS,
      {
        type: 'aggregate',
        tasks: taskIds.slice(0, 10)
      },
      (error, result) => {
        if (error) {
          console.error('Aggregate task failed:', error);
        } else {
          console.log('Aggregate result:', result.summary);
        }
      },
      {
        priority: TaskPriority.CRITICAL,
        dependencies: taskIds.slice(0, 10)
      }
    );

    // Wait for everything to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Print final statistics
    const finalMetrics = workerManager.getMetrics();
    console.log('\n=== Final Statistics ===');
    console.log('Total tasks:', finalMetrics.completedTasks + finalMetrics.failedTasks);
    console.log('Completed:', finalMetrics.completedTasks);
    console.log('Failed:', finalMetrics.failedTasks);
    console.log('Average duration:', Math.round(finalMetrics.averageTaskDuration), 'ms');
    console.log('Throughput:', finalMetrics.throughput.toFixed(2), 'tasks/sec');

  } finally {
    // Graceful shutdown
    await workerManager.shutdown();
    console.log('Worker manager shut down');
  }
}

main().catch(console.error);
```

## Advanced Configuration

### Custom Worker Script

```typescript
// worker-custom.js
import { parentPort } from 'worker_threads';

parentPort.on('message', async (message) => {
  if (message.type === 'task') {
    try {
      // Process the task
      const result = await processData(message.payload);

      // Send result back
      parentPort.postMessage({
        type: 'result',
        taskId: message.taskId,
        payload: result
      });
    } catch (error) {
      // Send error back
      parentPort.postMessage({
        type: 'error',
        taskId: message.taskId,
        error: error.message
      });
    }
  }
});

async function processData(payload) {
  // Custom processing logic
  if (payload.data) {
    return {
      processed: payload.data.map(item => ({
        ...item,
        processed: true,
        timestamp: Date.now()
      }))
    };
  }
  throw new Error('Invalid payload');
}

// Create manager with custom worker script
const workerManager = createWorkerManager({
  workerScriptPath: './worker-custom.js',
  // ... other config
});
```

### Performance Tuning

```typescript
// High-throughput configuration
const highPerfConfig = {
  minWorkers: os.cpus().length,
  maxWorkers: os.cpus().length * 2,
  maxTaskQueueSize: 5000,
  taskTimeout: 15000,
  workerIdleTimeout: 60000,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.2,
  scaleUpCooldown: 5000,
  scaleDownCooldown: 30000,
  backpressureThreshold: 0.95,
  maxTasksPerWorker: 1000,
  workerRecycleThreshold: 1000
};

// Memory-intensive configuration
const memoryIntensiveConfig = {
  minWorkers: 2,
  maxWorkers: 4,
  maxWorkerMemory: 1024 * 1024 * 1024, // 1GB
  taskTimeout: 120000,
  workerIdleTimeout: 300000,
  scaleUpThreshold: 0.6,
  scaleDownThreshold: 0.3
};
```

## Troubleshooting

### Common Issues

**1. Worker Creation Fails**
```typescript
workerManager.on('error', ({ type, error, index }) => {
  if (type === 'worker_creation_failed') {
    console.error('Failed to create worker:', error, 'index:', index);
  }
});
```

**2. High Memory Usage**
```typescript
// Monitor memory usage
setInterval(() => {
  const metrics = workerManager.getMetrics();
  if (metrics.memoryUtilization > 0.8) {
    console.warn('High memory usage:', metrics.memoryUtilization);
  }
}, 10000);
```

**3. Task Timeouts**
```typescript
// Increase timeout for long-running tasks
await workerManager.submitTask(
  WorkerTaskType.ANALYSIS,
  { complexAnalysis: true },
  callback,
  { timeout: 120000 } // 2 minutes
);
```

**4. Worker Health Issues**
```typescript
// Regular health checks
setInterval(async () => {
  await workerManager.performHealthChecks();
}, 30000);
```

### Debug Mode

```typescript
// Enable verbose logging
const debugWorkerManager = createWorkerManager({
  // ... config
  enableDebugLogging: true
});

// Listen for all events
debugWorkerManager.on('taskSubmitted', console.log);
debugWorkerManager.on('taskAssigned', console.log);
debugWorkerManager.on('taskCompleted', console.log);
debugWorkerManager.on('taskFailed', console.log);
```
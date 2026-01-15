# Session Management API

The Session Management API provides comprehensive control over orchestration sessions, enabling the creation, management, and monitoring of multi-agent workflows.

## Overview

Session Management supports:
- Multiple session types with specialized behaviors
- Session lifecycle management (create, update, delete)
- Session status monitoring and health checks
- Session discovery and filtering
- Performance metrics tracking
- Resource allocation and constraints
- Inter-session communication coordination

## Session Types

| Type | Description | Characteristics |
|------|-------------|-----------------|
| `DIRECTOR` | Main orchestrator session | Manages workflow, coordinates departments |
| `DEPARTMENT` | Specialized processing unit | Handles specific domain tasks |
| `OBSERVER` | Monitoring session | Tracks session performance without interfering |
| `ACTIVE` | Active participant session | Directly participates in workflow execution |

## Session Status

| Status | Description | Transition Rules |
|--------|-------------|-------------------|
| `INITIALIZING` | Session is being set up | → ACTIVE, ERROR |
| `ACTIVE` | Session is running normally | → IDLE, COMPLETED, ERROR, TERMINATED |
| `IDLE` | Session is waiting for work | → ACTIVE, TERMINATED |
| `COMPLETED` | Session finished successfully | - (final state) |
| `ERROR` | Session encountered an error | → TERMINATED |
| `TERMINATED` | Session was shut down | - (final state) |

## Session Operations

### Create Session

```typescript
import { SessionType, createSession } from '@claudesclaude/orchestration-sdk';

// Create a director session
const directorSession = createSession({
  type: SessionType.DIRECTOR,
  name: 'main-director',
  workspace: '/workspace/main-project',
  metadata: {
    version: '1.0.0',
    config: {
      autoScale: true,
      maxConcurrentTasks: 10
    }
  }
});

// Create a department session
const departmentSession = createSession({
  type: SessionType.DEPARTMENT,
  name: 'data-processing',
  workspace: '/workspace/departments/data',
  metadata: {
    domain: 'data-processing',
    capabilities: ['batch-processing', 'stream-processing'],
    constraints: ['max-memory:4gb', 'cpu-priority:high']
  }
});

// Create an observer session
const observerSession = createSession({
  type: SessionType.OBSERVER,
  name: 'performance-monitor',
  workspace: '/workspace/monitoring',
  metadata: {
    monitoringTargets: ['director-1', 'department-*'],
    metrics: ['cpu', 'memory', 'throughput']
  }
});
```

### Update Session

```typescript
// Update session status
await sessionManager.updateSession(sessionId, {
  status: SessionStatus.ACTIVE,
  metadata: {
    lastActivity: new Date(),
    processedTasks: 5
  }
});

// Update session capabilities
await sessionManager.updateSession(sessionId, {
  capabilities: ['new-capability-1', 'new-capability-2']
});

// Update constraints
await sessionManager.updateSession(sessionId, {
  constraints: ['max-memory:8gb', 'timeout:300000']
});
```

### Get Session

```typescript
const session = await sessionManager.getSession(sessionId);

if (session) {
  console.log('Session found:', {
    id: session.id,
    type: session.type,
    name: session.name,
    status: session.status,
    workspace: session.workspace
  });
} else {
  console.log('Session not found');
}
```

### Get Sessions by Type

```typescript
// Get all active director sessions
const directorSessions = await sessionManager.getSessionsByType(
  SessionType.DIRECTOR,
  {
    status: SessionStatus.ACTIVE,
    pagination: { page: 1, pageSize: 10 },
    orderBy: [{ field: 'lastActivity', direction: 'DESC' }]
  }
);

// Get all department sessions with filtering
const departmentSessions = await sessionManager.getSessionsByType(
  SessionType.DEPARTMENT,
  {
    filter: {
      where: 'metadata->>\'domain\' = ?',
      params: ['data-processing'],
      orderBy: [{ field: 'createdAt', direction: 'ASC' }]
    }
  }
);
```

### Get Sessions by Status

```typescript
// Get all sessions in specific status
const activeSessions = await sessionManager.getSessionsByStatus(
  SessionStatus.ACTIVE
);

// Get sessions with pagination
const idleSessions = await sessionManager.getSessionsByStatus(
  SessionStatus.IDLE,
  {
    pagination: { page: 1, pageSize: 5 },
    orderBy: [{ field: 'lastActivity', direction: 'ASC' }]
  }
);
```

### Delete Session

```typescript
const deleted = await sessionManager.deleteSession(sessionId);

if (deleted) {
  console.log('Session successfully deleted');
  // Clean up associated resources
} else {
  console.log('Session not found or could not be deleted');
}
```

## Session Discovery

### Search Sessions

```typescript
// Search by name or workspace
const results = await sessionManager.searchSessions('director', 10);

for (const session of results) {
  console.log(`Found: ${session.name} (${session.type}) in ${session.workspace}`);
}
```

### Filter Sessions

```typescript
// Advanced filtering
const filteredSessions = await sessionManager.getAllSessions({
  where: 'type = ? AND status IN (?, ?)',
  params: [SessionType.DEPARTMENT, SessionStatus.ACTIVE, SessionStatus.IDLE],
  orderBy: [
    { field: 'metadata->>\'priority\'', direction: 'DESC' },
    { field: 'lastActivity', direction: 'DESC' }
  ]
});
```

## Session Communication

### Register Session for Communication

```typescript
// Enable session for message bus communication
await sessionManager.registerSession(sessionId);

// Register with specific capabilities
await sessionManager.registerSession(sessionId, {
  messageTypes: ['COMMAND', 'PROGRESS_REPORT', 'ERROR'],
  priority: 3 // HIGH priority
});
```

### Deregister Session

```typescript
// Stop session communication
await sessionManager.deregisterSession(sessionId);

// Graceful deregistration with timeout
await sessionManager.deregisterSession(sessionId, 5000); // 5 second timeout
```

## Session Health Monitoring

### Health Check

```typescript
const health = await sessionManager.healthCheck(sessionId);

console.log(health);
// {
//   status: 'healthy', // healthy, degraded, unhealthy
//   details: {
//     uptime: 3600000, // milliseconds
//     memoryUsage: 256000000, // bytes
//     cpuUsage: 0.25,
//     lastActivity: '2024-01-15T10:30:00.000Z',
//     messageQueue: 5,
//     errorRate: 0.02
//   }
// }
```

### Monitor Session Events

```typescript
// Listen for session state changes
sessionManager.on('sessionStatusChanged', ({ sessionId, oldStatus, newStatus }) => {
  console.log(`Session ${sessionId} changed from ${oldStatus} to ${newStatus}`);
});

// Listen for session errors
sessionManager.on('sessionError', ({ sessionId, error }) => {
  console.error(`Session ${sessionId} error:`, error);
});

// Listen for session termination
sessionManager.on('sessionTerminated', ({ sessionId, reason }) => {
  console.log(`Session ${sessionId} terminated: ${reason}`);
});
```

## Session Metrics

### Get Session Statistics

```typescript
const stats = await sessionManager.getSessionStats();

console.log(stats);
// {
//   totalSessions: 15,
//   byType: {
//     director: 2,
//     department: 10,
//     observer: 3
//   },
//   byStatus: {
//     active: 8,
//     idle: 4,
//     completed: 2,
//     error: 1
//   },
//   averageUptime: 7200000, // 2 hours in ms
//   totalProcessedTasks: 1250
// }
```

### Get Performance Metrics

```typescript
const metrics = await sessionManager.getPerformanceMetrics(sessionId);

console.log(metrics);
// {
//   messagesProcessed: 150,
//   averageResponseTime: 250, // milliseconds
//   errorRate: 0.01, // 1%
//   throughput: 2.5, // messages per second
//   memoryUsage: 128000000, // bytes
//   cpuUsage: 0.15
// }
```

## Session Lifecycle Management

### Session Bootstrap

```typescript
async function bootstrapSession(sessionConfig) {
  try {
    // Create session
    const session = await sessionManager.createSession(sessionConfig);

    // Initialize session resources
    await sessionManager.initializeSession(session.id, {
      memory: '512m',
      cpu: '2',
      disk: '1g'
    });

    // Register for communication
    await sessionManager.registerSession(session.id);

    // Start session processes
    await sessionManager.startSession(session.id);

    return session;
  } catch (error) {
    console.error('Session bootstrap failed:', error);
    throw error;
  }
}
```

### Session Shutdown

```typescript
async function shutdownSession(sessionId, reason = 'normal') {
  try {
    // Graceful shutdown
    await sessionManager.gracefulShutdown(sessionId, {
      timeout: 30000, // 30 seconds
      reason: reason
    });

    // Cleanup resources
    await sessionManager.cleanupSession(sessionId);

    console.log(`Session ${sessionId} shutdown successfully`);
  } catch (error) {
    console.error(`Session ${sessionId} shutdown failed:`, error);

    // Force shutdown if graceful fails
    await sessionManager.forceShutdown(sessionId);
  }
}
```

## Session Templates

### Create Session Template

```typescript
const template = {
  name: 'data-department-template',
  type: SessionType.DEPARTMENT,
  baseConfig: {
    metadata: {
      domain: 'data-processing',
      standardCapabilities: [
        'batch-processing',
        'data-validation',
        'error-handling'
      ],
      standardConstraints: [
        'max-memory:4gb',
        'cpu-priority:normal'
      ]
    }
  },
  environmentVariables: {
    LOG_LEVEL: 'info',
    DATA_DIR: '/data',
    MAX_CONCURRENT_JOBS: '10'
  }
};

await sessionManager.createTemplate(template);
```

### Create Session from Template

```typescript
const session = await sessionManager.createFromTemplate(
  'data-department-template',
  {
    name: 'my-data-department',
    workspace: '/workspace/my-project',
    overrides: {
      metadata: {
        customDomain: 'my-data-processing',
        priority: 'high'
      }
    }
  }
);
```

## Complete Example

```typescript
import {
  SessionManager,
  SessionType,
  SessionStatus,
  createSession
} from '@claudesclaude/orchestration-sdk';

async function orchestrationExample() {
  // Initialize session manager
  const sessionManager = new SessionManager({
    databasePath: './orchestration.db',
    enableHealthChecks: true
  });

  try {
    // Set up event listeners
    sessionManager.on('sessionStatusChanged', ({ sessionId, oldStatus, newStatus }) => {
      console.log(`🔄 Session ${sessionId}: ${oldStatus} → ${newStatus}`);
    });

    sessionManager.on('sessionError', ({ sessionId, error }) => {
      console.error(`❌ Session ${sessionId} error:`, error.message);
    });

    // Create director session
    const directorSession = await sessionManager.createSession({
      type: SessionType.DIRECTOR,
      name: 'main-director',
      workspace: '/workspace/main',
      metadata: {
        version: '1.0.0',
        maxConcurrentTasks: 10,
        autoScale: true
      }
    });

    console.log('✅ Director session created:', directorSession.id);

    // Create department sessions
    const departmentConfigs = [
      { name: 'data-processor', domain: 'data' },
      { name: 'validator', domain: 'validation' },
      { name: 'notifier', domain: 'communication' }
    ];

    const departmentSessions = [];

    for (const config of departmentConfigs) {
      const session = await sessionManager.createSession({
        type: SessionType.DEPARTMENT,
        name: config.name,
        workspace: `/workspace/departments/${config.domain}`,
        metadata: {
          domain: config.domain,
          capabilities: ['task-processing'],
          constraints: ['max-memory:2gb']
        }
      });

      // Register for communication
      await sessionManager.registerSession(session.id);
      departmentSessions.push(session);

      console.log(`✅ Department session created: ${session.name}`);
    }

    // Start all sessions
    await sessionManager.startSession(directorSession.id);
    for (const session of departmentSessions) {
      await sessionManager.startSession(session.id);
    }

    // Wait for sessions to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check session health
    const directorHealth = await sessionManager.healthCheck(directorSession.id);
    console.log('Director health:', directorHealth.status);

    // Get statistics
    const stats = await sessionManager.getSessionStats();
    console.log('Session statistics:', stats);

    // Monitor sessions for a period
    const monitorInterval = setInterval(async () => {
      const metrics = await sessionManager.getPerformanceMetrics(directorSession.id);
      console.log(`Performance: ${metrics.throughput.toFixed(2)} tasks/sec, ${metrics.errorRate * 100}% errors`);
    }, 5000);

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Cleanup
    clearInterval(monitorInterval);

    // Graceful shutdown
    console.log('Starting graceful shutdown...');

    // Shutdown departments first
    for (const session of departmentSessions.reverse()) {
      await shutdownSession(session.id, 'completed-work');
    }

    // Shutdown director last
    await shutdownSession(directorSession.id, 'orchestration-complete');

    console.log('✅ All sessions shutdown successfully');

  } catch (error) {
    console.error('Orchestration error:', error);

    // Emergency shutdown
    await sessionManager.emergencyShutdown();
  }
}

async function shutdownSession(sessionId, reason) {
  try {
    await sessionManager.gracefulShutdown(sessionId, {
      timeout: 10000,
      reason: reason
    });
    console.log(`✅ Session ${sessionId} shutdown: ${reason}`);
  } catch (error) {
    console.error(`❌ Session ${sessionId} shutdown failed:`, error);
    await sessionManager.forceShutdown(sessionId);
  }
}

orchestrationExample().catch(console.error);
```

## Advanced Session Management

### Session Affinity

```typescript
// Configure session affinity
await sessionManager.setSessionAffinity(
  'director-1',
  ['department-1', 'department-2'],
  {
    strategy: 'round-robin',
    healthCheckInterval: 10000
  }
);
```

### Session Migration

```typescript
// Migrate session to different workspace
await sessionManager.migrateSession(
  'session-123',
  {
    workspace: '/workspace/new-location',
    preserveState: true,
    timeout: 60000
  }
);
```

### Session Cloning

```typescript
// Create copy of existing session
const clone = await sessionManager.cloneSession(
  'session-123',
  {
    name: 'session-123-clone',
    resetState: true,
    copyResources: true
  }
);
```

## Configuration Reference

### Session Manager Configuration

```typescript
const config = {
  databasePath: './orchestration.db',        // Database file path
  enableHealthChecks: true,                  // Enable session health monitoring
  healthCheckInterval: 30000,                // Health check interval (ms)
  sessionTimeout: 300000,                   // Session inactivity timeout (ms)
  maxSessions: 100,                          // Maximum concurrent sessions
  enableMetrics: true,                      // Enable performance metrics
  metricsInterval: 10000,                    // Metrics collection interval (ms)
  enableLogging: true,                       // Enable session logging
  logLevel: 'info',                          // Log level
  enableAffinity: true,                      // Enable session affinity
  enableMigration: true,                     // Enable session migration
  maxRetries: 3,                            // Maximum retry attempts
  retryDelay: 1000,                         // Retry delay (ms)
  enableEmergencyShutdown: true              // Enable emergency shutdown
};
```
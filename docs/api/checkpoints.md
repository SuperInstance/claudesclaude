# Checkpoint API

The Checkpoint API provides robust state management capabilities, allowing you to create, restore, and manage system checkpoints for reliability, backup, and workflow recovery.

## Overview

The Checkpoint API supports:
- Creating snapshots of system state
- Restoring system from previous checkpoints
- Version control and branching support
- Metadata tagging and organization
- Compression and encryption options
- Retention policies
- Full-text search capabilities

## Checkpoint Metadata

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable checkpoint name |
| `sessionId` | string | Associated session ID |
| `timestamp` | Date | Checkpoint creation timestamp |
| `snapshot` | object | State snapshot data |
| `branches` | string[] | Git branches included in checkpoint |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `feature` | string | Feature name |
| `priority` | string | Priority level |
| `author` | string | Author/creator ID |
| `description` | string | Detailed description |
| `workflowId` | string | Workflow identifier |
| `stepId` | string | Step identifier |
| `tags` | string[] | Search and filter tags |
| `retentionExpiresAt` | Date | Expiration timestamp |

## Checkpoint Operations

### Create Checkpoint

```typescript
import { CheckpointPriority } from '@claudesclaude/orchestration-sdk';

const checkpoint = await checkpointManager.create({
  name: 'milestone-v1.0',
  sessionId: session.id,
  timestamp: new Date(),
  snapshot: {
    sessions: [session.id],
    state: {
      progress: 75,
      completed: [1, 2, 3, 4, 5],
      pending: [6, 7],
      config: {
        environment: 'production',
        version: '1.0.0'
      },
      resources: {
        memory: '2GB',
        cpu: '4 cores',
        disk: '50GB'
      }
    },
    branches: ['main', 'feature-xyz'],
    metadata: {
      feature: 'user-authentication',
      priority: CheckpointPriority.HIGH,
      author: 'developer-1',
      description: 'Milestone checkpoint with user authentication feature',
      workflowId: 'wf-auth-flow',
      stepId: 'step-auth-implementation',
      tags: ['stable', 'milestone', 'production-ready']
    }
  },
  branches: ['main', 'feature-xyz'],
  createdBy: 'developer-1',
  size: 2048000, // 2MB
  checksum: 'sha256:abc123...',
  compressed: true,
  encrypted: true,
  retentionExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
});

console.log('Checkpoint created:', checkpoint.id);
```

### Create Minimal Checkpoint

```typescript
const quickCheckpoint = await checkpointManager.create({
  name: 'quick-backup',
  sessionId: session.id,
  timestamp: new Date(),
  snapshot: {
    sessions: [session.id],
    state: { quick: true }
  },
  branches: ['current-branch']
});
```

### Get Checkpoint

```typescript
const checkpoint = await checkpointManager.getCheckpoint(checkpointId);

if (checkpoint) {
  console.log('Checkpoint found:', {
    id: checkpoint.id,
    name: checkpoint.name,
    sessionId: checkpoint.sessionId,
    timestamp: checkpoint.timestamp,
    size: checkpoint.size,
    compressed: checkpoint.compressed,
    encrypted: checkpoint.encrypted,
    metadata: checkpoint.metadata
  });
} else {
  console.log('Checkpoint not found');
}
```

### Get Checkpoints by Session

```typescript
// Get all checkpoints for a session
const sessionCheckpoints = await checkpointManager.getCheckpointsBySession(sessionId);

// Get checkpoints with filtering
const filteredCheckpoints = await checkpointManager.getCheckpointsBySession(sessionId, {
  where: 'metadata->>\'feature\' = ? AND compressed = 1',
  params: ['user-authentication'],
  orderBy: [{ field: 'timestamp', direction: 'DESC' }],
  pagination: { page: 1, pageSize: 10 }
});

console.log(`Found ${sessionCheckpoints.length} checkpoints for session ${sessionId}`);
```

### Get Checkpoints by Feature

```typescript
const featureCheckpoints = await checkpointManager.getCheckpointsByFeature('user-authentication');

for (const checkpoint of featureCheckpoints) {
  console.log(`${checkpoint.name}: ${checkpoint.timestamp.toISOString()} by ${checkpoint.metadata.author}`);
}
```

### Update Checkpoint

```typescript
const updated = await checkpointManager.updateCheckpoint(checkpointId, {
  metadata: {
    ...checkpoint.metadata,
    description: 'Updated description',
    tags: [...checkpoint.metadata.tags, 'updated']
  }
});

console.log('Checkpoint updated:', updated);
```

### Delete Checkpoint

```typescript
const deleted = await checkpointManager.deleteCheckpoint(checkpointId);

if (deleted) {
  console.log('Checkpoint deleted successfully');
  // Cleanup associated resources
} else {
  console.log('Checkpoint not found or could not be deleted');
}
```

### Delete Expired Checkpoints

```typescript
// Clean up expired checkpoints
const deletedCount = await checkpointManager.deleteExpiredCheckpoints();

console.log(`Cleaned up ${deletedCount} expired checkpoints`);
```

## Checkpoint Restoration

### Restore Checkpoint

```typescript
const restoreResult = await checkpointManager.restoreCheckpoint(checkpointId, {
  targetSessionId: session.id,
  preserveCurrentState: true,
  mergeStrategy: 'overwrite',
  timeout: 300000 // 5 minutes
});

console.log('Restore result:', {
  success: restoreResult.success,
  restoredFrom: restoreResult.restoredFrom,
  conflicts: restoreResult.conflicts,
  warnings: restoreResult.warnings
});
```

### Restore with Conflict Resolution

```typescript
const restoreOptions = {
  conflictResolution: {
    strategy: 'merge', // merge, overwrite, keep-original
    customResolver: (current, checkpoint) => {
      // Custom logic for resolving conflicts
      return checkpoint; // Always prefer checkpoint state
    }
  },
  validation: {
    validateIntegrity: true,
    validateChecksum: true,
    validateSchema: true
  },
  rollbackOnError: true,
  notify: true
};

const result = await checkpointManager.restoreCheckpoint(checkpointId, restoreOptions);
```

## Checkpoint Search

### Search Checkpoints

```typescript
// Search by name or description
const results = await checkpointManager.searchCheckpoints('milestone', 10);

for (const checkpoint of results) {
  console.log(`Found: ${checkpoint.name} - ${checkpoint.metadata.description}`);
}
```

### Advanced Search

```typescript
// Complex search with filters
const searchResults = await checkpointManager.searchCheckpoints({
  query: 'authentication',
  filters: {
    feature: ['user-authentication', 'session-management'],
    priority: ['high', 'critical'],
    dateRange: {
      from: new Date('2024-01-01'),
      to: new Date('2024-12-31')
    },
    tags: ['production', 'stable']
  },
  sorting: {
    field: 'timestamp',
    direction: 'DESC'
  },
  pagination: {
    page: 1,
    pageSize: 20
  }
});
```

## Checkpoint Management

### Get Checkpoint Statistics

```typescript
const stats = await checkpointManager.getCheckpointStats();

console.log('Checkpoint statistics:', {
  totalCheckpoints: stats.totalCheckpoints,
  totalSize: stats.totalSize,
  averageSize: stats.averageSize,
  byFeature: stats.byFeature,
  byPriority: stats.byPriority,
  oldestCheckpoint: stats.oldestCheckpoint,
  newestCheckpoint: stats.newestCheckpoint
});
```

### Get Checkpoint Validation Report

```typescript
const validation = await checkpointManager.validateCheckpoint(checkpointId);

console.log('Validation result:', {
  isValid: validation.isValid,
  checksumValid: validation.checksumValid,
  sizeMatches: validation.sizeMatches,
  schemaValid: validation.schemaValid,
  errors: validation.errors,
  warnings: validation.warnings
});
```

### Create Checkpoint Chain

```typescript
async function createCheckpointChain(baseCheckpoint, checkpoints) {
  const chain = [];

  for (const cpConfig of checkpoints) {
    // Create child checkpoint
    const checkpoint = await checkpointManager.create({
      ...cpConfig,
      restoredFrom: baseCheckpoint.id,
      metadata: {
        ...cpConfig.metadata,
        parentCheckpoint: baseCheckpoint.id,
        chainDepth: chain.length + 1
      }
    });

    chain.push(checkpoint);
    baseCheckpoint = checkpoint;
  }

  return chain;
}

// Usage
const baseCheckpoint = await checkpointManager.getCheckpoint('base-123');
const chain = await createCheckpointChain(baseCheckpoint, [
  {
    name: 'checkpoint-1',
    snapshot: { step: 1 },
    metadata: { feature: 'feature-1' }
  },
  {
    name: 'checkpoint-2',
    snapshot: { step: 2 },
    metadata: { feature: 'feature-2' }
  }
]);
```

## Complete Example

```typescript
import {
  CheckpointManager,
  CheckpointPriority
} from '@claudesclaude/orchestration-sdk';

async function checkpointManagementExample() {
  const checkpointManager = new CheckpointManager({
    databasePath: './orchestration.db',
    enableCompression: true,
    enableEncryption: true,
    defaultRetentionDays: 30
  });

  try {
    // Create session for example
    const session = await sessionManager.createSession({
      type: 'director',
      name: 'checkpoint-example',
      workspace: '/workspace/example'
    });

    // Create regular checkpoints
    const milestones = [
      {
        name: 'start',
        description: 'Initial state',
        snapshot: {
          progress: 0,
          completed: [],
          config: { started: true }
        }
      },
      {
        name: 'quarterly',
        description: 'Q1 milestones reached',
        snapshot: {
          progress: 25,
          completed: [1, 2, 3],
          config: { quarterly: true }
        },
        priority: CheckpointPriority.NORMAL
      },
      {
        name: 'milestone-v1.0',
        description: 'Version 1.0 release',
        snapshot: {
          progress: 100,
          completed: [1, 2, 3, 4, 5, 6],
          config: {
            version: '1.0.0',
            released: true,
            features: ['auth', 'dashboard', 'api']
          }
        },
        priority: CheckpointPriority.HIGH,
        tags: ['release', 'stable', 'production']
      }
    ];

    const createdCheckpoints = [];

    for (const milestone of milestones) {
      const checkpoint = await checkpointManager.create({
        name: milestone.name,
        sessionId: session.id,
        timestamp: new Date(),
        snapshot: milestone.snapshot,
        branches: ['main'],
        metadata: {
          feature: 'version-release',
          priority: milestone.priority || CheckpointPriority.NORMAL,
          author: 'release-manager',
          description: milestone.description,
          tags: milestone.tags || ['checkpoint']
        }
      });

      createdCheckpoints.push(checkpoint);
      console.log(`✅ Created checkpoint: ${checkpoint.name}`);
    }

    // Search for checkpoints
    const searchResults = await checkpointManager.searchCheckpoints('milestone');
    console.log(`🔍 Found ${searchResults.length} milestone checkpoints`);

    // Get checkpoint statistics
    const stats = await checkpointManager.getCheckpointStats();
    console.log('📊 Statistics:', {
      total: stats.totalCheckpoints,
      totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
      averageSize: `${(stats.averageSize / 1024).toFixed(2)} KB`
    });

    // Restore from milestone checkpoint
    const milestoneCheckpoint = createdCheckpoints.find(cp => cp.name === 'milestone-v1.0');
    if (milestoneCheckpoint) {
      console.log('🔄 Restoring from milestone checkpoint...');

      const restoreResult = await checkpointManager.restoreCheckpoint(
        milestoneCheckpoint.id,
        {
          targetSessionId: session.id,
          preserveCurrentState: false,
          mergeStrategy: 'overwrite'
        }
      );

      console.log('Restore result:', {
        success: restoreResult.success,
        conflicts: restoreResult.conflicts.length,
        warnings: restoreResult.warnings.length
      });
    }

    // Cleanup old checkpoints (keep only recent ones)
    const oldCheckpoints = await checkpointManager.getCheckpointsBySession(session.id, {
      where: 'timestamp < ?',
      params: [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] // older than 7 days
    });

    for (const checkpoint of oldCheckpoints) {
      if (checkpoint.name !== 'milestone-v1.0') { // Keep the latest milestone
        await checkpointManager.deleteCheckpoint(checkpoint.id);
        console.log(`🗑️ Deleted old checkpoint: ${checkpoint.name}`);
      }
    }

    // Final statistics
    const finalStats = await checkpointManager.getCheckpointStats();
    console.log('\n🎯 Final checkpoint status:');
    console.log(`Total checkpoints: ${finalStats.totalCheckpoints}`);
    console.log(`Total storage: ${(finalStats.totalSize / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('Checkpoint management error:', error);
  } finally {
    await checkpointManager.close();
  }
}

checkpointManagementExample().catch(console.error);
```

## Configuration Reference

### Checkpoint Manager Configuration

```typescript
const config = {
  databasePath: './orchestration.db',        // Database file path
  enableCompression: true,                   // Enable checkpoint compression
  enableEncryption: true,                    // Enable checkpoint encryption
  compressionAlgorithm: 'gzip',              // Compression algorithm
  encryptionAlgorithm: 'aes-256-gcm',         // Encryption algorithm
  encryptionKey: 'your-encryption-key',        // Encryption key
  defaultRetentionDays: 30,                 // Default retention period
  maxCheckpointSize: 100 * 1024 * 1024,      // 100MB max size
  enableValidation: true,                    // Enable checksum validation
  validationAlgorithm: 'sha256',             // Checksum algorithm
  enableFTS: true,                          // Enable full-text search
  autoCleanup: true,                         // Enable automatic cleanup
  cleanupInterval: 86400000,                 // 24 hours cleanup interval
  enableMetrics: true,                       // Enable checkpoint metrics
  metricsInterval: 60000                     // 1 minute metrics interval
};
```

### Checkpoint Snapshot Schema

```typescript
const snapshotSchema = {
  sessions: string[],                    // Associated session IDs
  state: {
    progress: number,                    // Progress percentage
    completed: any[],                     // Completed items
    pending: any[],                      // Pending items
    config: object,                       // Configuration state
    resources: {                         // Resource usage
      memory: string,
      cpu: string,
      disk: string
    }
  },
  metadata: {
    version: string,
    environment: string,
    labels: string[]
  }
};
```

## Performance Considerations

### Optimization Tips

1. **Compression**: Always enable compression for large checkpoints
2. **Batch Operations**: Use bulk operations when creating multiple checkpoints
3. **Retention Policies**: Set appropriate retention periods to prevent storage bloat
4. **Search Optimization**: Use tags and metadata for efficient searching
5. **Validation**: Enable checksum validation in production environments
6. **Cleanup**: Configure automatic cleanup for expired checkpoints

### Monitoring Checkpoint Health

```typescript
// Monitor checkpoint system health
setInterval(async () => {
  const stats = await checkpointManager.getCheckpointStats();

  if (stats.totalSize > 10 * 1024 * 1024 * 1024) { // 10GB
    console.warn('⚠️ Checkpoint storage usage high:', stats.totalSize);
  }

  const recentCheckpoints = await checkpointManager.getCheckpointsBySession(session.id, {
    where: 'timestamp > ?',
    params: [new Date(Date.now() - 24 * 60 * 60 * 1000)] // last 24 hours
  });

  if (recentCheckpoints.length === 0) {
    console.log('ℹ️ No checkpoints created in last 24 hours');
  }
}, 3600000); // Check every hour
```
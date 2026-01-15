# Director Protocol API Documentation

This document provides comprehensive API documentation for the Director Protocol multi-agent orchestration system.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Core API Endpoints](#core-api-endpoints)
- [Sandbox API](#sandbox-api)
- [Network API](#network-api)
- [Security API](#security-api)
- [Environment API](#environment-api)
- [Monitoring API](#monitoring-api)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

The Director Protocol provides RESTful APIs for orchestrating multiple AI agents through sessions, departments, and workflows. All API endpoints return JSON responses and use standard HTTP status codes.

### Base URL

```
https://api.director.example.com/v1
```

### API Versioning

All API endpoints include version numbers in the path. We recommend using version-specific URLs to ensure compatibility:

- `v1` - Current stable version
- Future versions will follow semantic versioning

### Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": {},
  "metadata": {
    "timestamp": "2023-06-30T12:00:00Z",
    "requestId": "req_123456789",
    "version": "1.0.0"
  }
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "metadata": {
    "timestamp": "2023-06-30T12:00:00Z",
    "requestId": "req_123456789"
  }
}
```

## Authentication

### JWT Tokens

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

### Token Refresh

```http
POST /auth/refresh
Authorization: Bearer <your_refresh_token>
```

## Core API Endpoints

### Sessions

#### Create Session

```http
POST /sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "director",
  "name": "Main Director Session",
  "description": "Primary director session for orchestration",
  "config": {
    "maxDepartments": 10,
    "timeout": 3600000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ses_123456789",
    "type": "director",
    "name": "Main Director Session",
    "status": "active",
    "config": {
      "maxDepartments": 10,
      "timeout": 3600000
    },
    "createdAt": "2023-06-30T12:00:00Z",
    "updatedAt": "2023-06-30T12:00:00Z"
  }
}
```

#### Get Session

```http
GET /sessions/{sessionId}
Authorization: Bearer <token>
```

#### List Sessions

```http
GET /sessions?limit=10&offset=0&status=active
Authorization: Bearer <token>
```

#### Update Session

```http
PUT /sessions/{sessionId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Session Name",
  "config": {
    "maxDepartments": 15
  }
}
```

#### Delete Session

```http
DELETE /sessions/{sessionId}
Authorization: Bearer <token>
```

### Departments

#### Create Department

```http
POST /departments
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "ses_123456789",
  "name": "Code Generation Department",
  "domain": "code-generation",
  "config": {
    "maxConcurrentTasks": 5,
    "resourceLimits": {
      "memory": 512,
      "cpu": 1.0
    }
  },
  "capabilities": ["javascript", "typescript", "react"]
}
```

#### Get Department

```http
GET /departments/{departmentId}
Authorization: Bearer <token>
```

#### List Departments

```http
GET /departments?sessionId=ses_123456789&domain=code-generation
Authorization: Bearer <token>
```

#### Department Metrics

```http
GET /departments/{departmentId}/metrics
Authorization: Bearer <token>
```

### Workflows

#### Create Workflow

```http
POST /workflows
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "ses_123456789",
  "name": "Code Review Workflow",
  "description": "Automated code review process",
  "steps": [
    {
      "type": "execute",
      "command": "npm test",
      "timeout": 300000
    },
    {
      "type": "verify",
      "criteria": "tests pass",
      "timeout": 60000
    },
    {
      "type": "checkpoint",
      "name": "code-review-checkpoint",
      "description": "Checkpoint after code review"
    }
  ],
  "config": {
    "timeout": 1800000,
    "maxRetries": 3
  }
}
```

#### Start Workflow

```http
POST /workflows/{workflowId}/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "environment": {
    "NODE_ENV": "production"
  },
  "context": {
    "reviewer": "ai-assistant"
  }
}
```

#### Get Workflow Status

```http
GET /workflows/{workflowId}/status
Authorization: Bearer <token>
```

#### List Workflows

```http
GET /workflows?sessionId=ses_123456789&status=running
Authorization: Bearer <token>
```

### Context Management

#### Create Context Window

```http
POST /context
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "ses_123456789",
  "name": "Project Context",
  "items": [
    {
      "type": "text",
      "content": "This is a project overview...",
      "metadata": {
        "source": "project-overview",
        "priority": "high"
      }
    }
  ],
  "config": {
    "maxSize": 100,
    "retentionPolicy": {
      "maxAge": 86400000,
      "importanceThreshold": 0.5
    }
  }
}
```

#### Add Context Item

```http
POST /context/{contextId}/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "file",
  "content": "file://path/to/document.pdf",
  "metadata": {
    "title": "Project Requirements",
    "tags": ["requirements", "specification"]
  }
}
```

#### Get Context

```http
GET /context/{contextId}
Authorization: Bearer <token>
```

#### List Context Items

```http
GET /context/{contextId}/items?limit=20&offset=0
Authorization: Bearer <token>
```

### Checkpoints

#### Create Checkpoint

```http
POST /checkpoints
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "ses_123456789",
  "name": "Development Milestone",
  "description": "Checkpoint after completing user authentication",
  "data": {
    "committedFiles": ["auth.js", "database.js"],
    "currentHash": "abc123",
    "metadata": {
      "milestone": "v1.0.0-alpha"
    }
  }
}
```

#### Restore Checkpoint

```http
POST /checkpoints/{checkpointId}/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "includeState": true,
  "includeContext": true,
  "includeMessages": true
}
```

#### List Checkpoints

```http
GET /checkpoints?sessionId=ses_123456789&limit=10
Authorization: Bearer <token>
```

## Sandbox API

### Create Sandbox

```http
POST /sandboxes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Code Execution Sandbox",
  "image": "node:22-alpine",
  "command": ["node", "app.js"],
  "environment": {
    "NODE_ENV": "production",
    "API_KEY": "secure_key"
  },
  "resourceLimits": {
    "cpu": 2.0,
    "memory": 1024,
    "disk": 2048,
    "network": false,
    "maxDuration": 300000
  },
  "securityPolicy": {
    "allowFilesystem": true,
    "allowNetwork": false,
    "allowExec": true,
    "allowedPaths": ["/app"],
    "blockedPaths": ["/etc", "/root"],
    "readOnlyRoot": true,
    "noPrivileges": true
  },
  "networkMode": "isolated"
}
```

### Execute in Sandbox

```http
POST /sandboxes/{sandboxId}/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": ["node", "-e", "console.log('Hello World')"],
  "timeout": 30000,
  "environment": {
    "TASK_ID": "task_123"
  }
}
```

### Get Sandbox Status

```http
GET /sandboxes/{sandboxId}
Authorization: Bearer <token>
```

### Get Sandbox Metrics

```http
GET /sandboxes/{sandboxId}/metrics
Authorization: Bearer <token>
```

### List Sandboxes

```http
GET /sandboxes?status=running&limit=20
Authorization: Bearer <token>
```

### Stop Sandbox

```http
POST /sandboxes/{sandboxId}/stop
Authorization: Bearer <token>
```

### Delete Sandbox

```http
DELETE /sandboxes/{sandboxId}
Authorization: Bearer <token>
```

## Network API

### Create Network

```http
POST /networks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "sandbox-network",
  "subnet": "172.30.0.0/24",
  "gateway": "172.30.0.1",
  "enableDNS": true,
  "internal": true
}
```

### Apply Network Policy

```http
POST /networks/{networkId}/policies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "restrictive-policy",
  "description": "Block all outbound traffic",
  "inbound": [
    {
      "action": "allow",
      "protocol": "all",
      "source": "127.0.0.1/32"
    }
  ],
  "outbound": [
    {
      "action": "deny",
      "protocol": "all"
    }
  ],
  "logging": true,
  "metrics": true
}
```

### Get Network Info

```http
GET /networks/{networkId}
Authorization: Bearer <token>
```

### List Networks

```http
GET /networks?limit=20
Authorization: Bearer <token>
```

### Isolate Network

```http
POST /networks/{networkId}/isolate
Authorization: Bearer <token>
```

### Allow Network Access

```http
POST /networks/{networkId}/allow-access
Authorization: Bearer <token>
Content-Type: application/json

{
  "destinations": [
    {
      "host": "api.example.com",
      "port": 443,
      "protocol": "tcp",
      "description": "Allow API access"
    }
  ]
}
```

### Delete Network

```http
DELETE /networks/{networkId}
Authorization: Bearer <token>
```

## Security API

### Create Security Profile

```http
POST /security/profiles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "high-security",
  "description": "High security profile for production",
  "level": "high",
  "constraints": {
    "allowFilesystem": false,
    "allowNetwork": false,
    "allowExec": true,
    "maxProcesses": 5,
    "maxOpenFiles": 50,
    "readOnlyRoot": true,
    "noPrivileges": true
  }
}
```

### Get Security Events

```http
GET /security/events?sandboxId=sbx_123&limit=100&severity=high
Authorization: Bearer <token>
```

### Security Event Summary

```http
GET /security/events/summary
Authorization: Bearer <token>
```

### Enforce Security Policy

```http
POST /security/policies/{policyId}/enforce
Authorization: Bearer <token>
Content-Type: application/json

{
  "scope": {
    "sessionId": "ses_123",
    "sandboxId": "sbx_123"
  }
}
```

## Environment API

### Create Environment from Template

```http
POST /environments
Authorization: Bearer <token>
Content-Type: application/json

{
  "template": "web-api",
  "name": "Production API Environment",
  "variables": {
    "PORT": "3000",
    "NODE_ENV": "production",
    "DATABASE_URL": "postgresql://user:pass@host:port/db"
  }
}
```

### Get Environment

```http
GET /environments/{environmentId}
Authorization: Bearer <token>
```

### List Environments

```http
GET /environments?template=web-api&limit=20
Authorization: Bearer <token>
```

### Validate Environment

```http
POST /environments/{environmentId}/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "variables": {
    "PORT": "invalid_port"
  }
}
```

### Export Environment

```http
GET /environments/{environmentId}/export
Authorization: Bearer <token>
```

### Import Environment

```http
POST /environments/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Imported Environment",
  "template": "web-api",
  "variables": {},
  "files": []
}
```

### Delete Environment

```http
DELETE /environments/{environmentId}
Authorization: Bearer <token>
```

## Monitoring API

### Get Metrics

```http
GET /monitoring/metrics
Authorization: Bearer <token>

{
  "metrics": [
    {
      "name": "director_requests_total",
      "type": "counter",
      "value": 1234,
      "labels": {
        "method": "GET",
        "endpoint": "/api/sessions"
      }
    }
  ]
}
```

### Get Health Status

```http
GET /monitoring/health
Authorization: Bearer <token>
```

### Get System Statistics

```http
GET /monitoring/stats
Authorization: Bearer <token>
```

### Get Error Summary

```http
GET /monitoring/errors
Authorization: Bearer <token>
```

### Start/Stop Monitoring

```http
POST /monitoring/start
Authorization: Bearer <token>

POST /monitoring/stop
Authorization: Bearer <token>
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.director.example.com/v1/ws');

ws.onopen = () => {
  console.log('WebSocket connected');
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};
```

### Message Types

#### Session Updates

```json
{
  "type": "session_update",
  "data": {
    "sessionId": "ses_123",
    "status": "active",
    "metrics": {
      "activeDepartments": 5,
      "totalTasks": 23
    }
  }
}
```

#### Workflow Progress

```json
{
  "type": "workflow_progress",
  "data": {
    "workflowId": "wf_123",
    "step": 2,
    "totalSteps": 5,
    "progress": 40,
    "currentStep": {
      "type": "execute",
      "status": "running",
      "startTime": "2023-06-30T12:00:00Z"
    }
  }
}
```

#### Sandbox Events

```json
{
  "type": "sandbox_event",
  "data": {
    "sandboxId": "sbx_123",
    "event": "created",
    "status": "running",
    "resourceUsage": {
      "cpu": 25.5,
      "memory": 512
    }
  }
}
```

#### Security Alerts

```json
{
  "type": "security_alert",
  "data": {
    "alert": {
      "rule": "HIGH_ERROR_RATE",
      "severity": "high",
      "message": "Error rate exceeded threshold",
      "timestamp": "2023-06-30T12:00:00Z"
    }
  }
}
```

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `AUTHENTICATION_ERROR` | 401 | Authentication failed |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Response Structure

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format",
      "value": "invalid-email"
    }
  },
  "metadata": {
    "timestamp": "2023-06-30T12:00:00Z",
    "requestId": "req_123456789",
    "retryAfter": 60
  }
}
```

## Rate Limiting

### Rate Limits

- **Authentication**: 5 requests per minute
- **Session Operations**: 100 requests per minute
- **Sandbox Operations**: 50 requests per minute
- **General API**: 1000 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1625097600
X-RateLimit-Reset-Time: "2023-06-30T12:00:00Z"
```

### Handling Rate Limits

When rate limited, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded"
  },
  "metadata": {
    "retryAfter": 60
  }
}
```

## Examples

### Complete Workflow Example

```javascript
// 1. Create a session
const sessionResponse = await fetch('/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'director',
    name: 'Development Session'
  })
});

const session = await sessionResponse.json();

// 2. Create a department
const departmentResponse = await fetch('/departments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: session.data.id,
    name: 'Code Review Department',
    domain: 'code-review',
    capabilities: ['javascript', 'typescript']
  })
});

const department = await departmentResponse.json();

// 3. Create a workflow
const workflowResponse = await fetch('/workflows', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: session.data.id,
    name: 'Automated Code Review',
    steps: [
      {
        type: 'execute',
        command: 'npm test',
        timeout: 300000
      },
      {
        type: 'verify',
        criteria: 'tests pass'
      }
    ]
  })
});

const workflow = await workflowResponse.json();

// 4. Start the workflow
await fetch(`/workflows/${workflow.data.id}/start`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### WebSocket Example

```javascript
class DirectorAPI {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.eventHandlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://api.director.example.com/v1/ws');

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'auth',
          token: this.token
        }));
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = reject;
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect
        setTimeout(() => this.connect(), 5000);
      };
    });
  }

  handleMessage(message) {
    const handler = this.eventHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  on(type, handler) {
    this.eventHandlers.set(type, handler);
  }

  off(type) {
    this.eventHandlers.delete(type);
  }
}

// Usage
const api = new DirectorAPI('your_jwt_token');
await api.connect();

api.on('session_update', (data) => {
  console.log('Session updated:', data);
});

api.on('workflow_progress', (data) => {
  console.log('Workflow progress:', data);
});
```

### Batch Operations

```javascript
// Create multiple departments in parallel
const departments = [
  { name: 'Frontend', domain: 'frontend', capabilities: ['react', 'vue'] },
  { name: 'Backend', domain: 'backend', capabilities: ['node', 'python'] },
  { name: 'DevOps', domain: 'devops', capabilities: ['docker', 'k8s'] }
];

const promises = departments.map(dept =>
  fetch('/departments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: session.data.id,
      ...dept
    })
  })
);

const results = await Promise.all(promises);
console.log('Created departments:', results);
```

## SDK Usage

### Node.js SDK

```javascript
import { DirectorClient } from 'director-sdk';

const client = new DirectorClient({
  baseURL: 'https://api.director.example.com/v1',
  token: 'your_jwt_token'
});

// Create a session
const session = await client.sessions.create({
  type: 'director',
  name: 'My Session'
});

// Create a workflow
const workflow = await client.workflows.create({
  sessionId: session.id,
  name: 'Code Review',
  steps: [
    { type: 'execute', command: 'npm test' }
  ]
});

// Start workflow
await workflow.start();
```

### Python SDK

```python
from director_sdk import DirectorClient

client = DirectorClient(
    base_url='https://api.director.example.com/v1',
    token='your_jwt_token'
)

# Create session
session = client.sessions.create(
    type='director',
    name='My Session'
)

# Create workflow
workflow = client.workflows.create(
    session_id=session.id,
    name='Code Review',
    steps=[
        {'type': 'execute', 'command': 'npm test'}
    ]
)

# Start workflow
workflow.start()
```

## Webhooks

### Setting Up Webhooks

```http
POST /webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-server.com/webhooks",
  "events": [
    "session.created",
    "workflow.completed",
    "sandbox.created",
    "security.alert"
  ],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload

```json
{
  "event": "workflow.completed",
  "data": {
    "workflowId": "wf_123",
    "sessionId": "ses_123",
    "status": "completed",
    "result": {
      "success": true,
      "output": "All tests passed"
    }
  },
  "timestamp": "2023-06-30T12:00:00Z",
  "signature": "sha256=your_signature_here"
}
```

### Verifying Webhook Signatures

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${digest}`)
  );
}
```

## Conclusion

This API documentation covers all major aspects of the Director Protocol. For additional features or custom requirements, please refer to the [full documentation](./README.md) or contact our support team.

Always refer to the latest API version and update your implementations accordingly to ensure compatibility with future updates.
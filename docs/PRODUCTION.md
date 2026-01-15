# Director Protocol - Production Guide

This document provides comprehensive guidance for deploying and managing the Director Protocol in production environments.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Security](#security)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Performance Tuning](#performance-tuning)

## Overview

The Director Protocol is a multi-agent orchestration system that provides:
- Secure sandboxed execution environments
- Resource isolation and management
- Network isolation and security
- Comprehensive monitoring and observability
- High availability and fault tolerance

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Storage**: Minimum 50GB SSD (100GB+ recommended)
- **CPU**: Minimum 4 cores (8+ cores recommended)
- **Network**: Stable internet connection

### Software Dependencies

- **Docker**: 20.10+ with Docker Compose
- **Node.js**: 18+ (LTS version)
- **PostgreSQL**: 13+
- **Redis**: 6.0+
- **Git**: Latest version

### Infrastructure Requirements

- **Load Balancer**: Nginx or HAProxy (recommended for production)
- **SSL/TLS**: Certificate management (Let's Encrypt or provided)
- **Firewall**: Properly configured security groups
- **Monitoring**: Prometheus/Grafana stack (recommended)

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/SuperInstance/claudesclaude.git
cd claudesclaude
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your production settings:

```bash
NODE_ENV=production
PORT=3000
WORKERS=4

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=director_prod
DB_USER=director_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Security
JWT_SECRET=your_jwt_secret_here (minimum 32 characters)
SESSION_TIMEOUT=3600000
MAX_SESSIONS=100
```

### Step 4: Database Setup

```bash
# Create PostgreSQL database
createdb director_prod

# Run migrations (if applicable)
npm run migrate
```

### Step 5: Docker Setup

```bash
# Build and start services
docker-compose -f docker-compose.yml up -d

# Verify services are running
docker-compose ps
```

## Configuration

### Production Configuration

The system uses a layered configuration approach:
1. **Environment variables** (highest priority)
2. **Configuration files** (`config/` directory)
3. **Defaults** (built-in)

#### Configuration File Structure

```
config/
├── config.json          # Base configuration
├── production.json       # Production-specific overrides
└── development.json      # Development configuration
```

#### Key Configuration Sections

```json
{
  "app": {
    "environment": "production",
    "port": 3000,
    "workers": 4,
    "shutdownTimeout": 30000
  },
  "security": {
    "jwtSecret": "your_secure_secret",
    "sessionTimeout": 3600000,
    "maxSessions": 100,
    "enableCORS": false,
    "allowedOrigins": ["https://your-domain.com"]
  },
  "database": {
    "host": "your-db-host",
    "port": 5432,
    "name": "director_prod",
    "username": "director_user",
    "password": "secure_password",
    "pool": {
      "min": 2,
      "max": 20,
      "idle": 30000,
      "acquire": 60000
    }
  },
  "monitoring": {
    "enabled": true,
    "metricsPort": 9090,
    "prometheusEnabled": true
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `WORKERS` | Number of worker processes | `1` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `director` |
| `DB_USER` | Database username | `director` |
| `DB_PASSWORD` | Database password | `director` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | `null` |
| `JWT_SECRET` | JWT signing secret | auto-generated |
| `LOG_LEVEL` | Logging level | `info` |

## Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f director

# Stop services
docker-compose down
```

### Option 2: Systemd Service

Create `/etc/systemd/system/director.service`:

```ini
[Unit]
Description=Director Protocol Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=director
Group=director
WorkingDirectory=/opt/director
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable director
sudo systemctl start director

# Check status
sudo systemctl status director
```

### Option 3: Kubernetes

```yaml
# director-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: director
spec:
  replicas: 3
  selector:
    matchLabels:
      app: director
  template:
    metadata:
      labels:
        app: director
    spec:
      containers:
      - name: director
        image: your-registry/director:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## Monitoring

### Built-in Monitoring

The Director Protocol includes built-in monitoring endpoints:

#### Metrics Endpoint

```bash
curl http://localhost:9090/metrics
```

Returns Prometheus-compatible metrics including:
- Request counts and duration
- Active sessions and sandboxes
- Memory and CPU usage
- Error rates

#### Health Check Endpoint

```bash
curl http://localhost:9091/health
```

Returns health status:
```json
{
  "status": "healthy",
  "timestamp": 1625097600000,
  "checks": [
    {
      "name": "director",
      "healthy": true,
      "message": "Director service is healthy"
    },
    {
      "name": "database",
      "healthy": true,
      "message": "Database connection healthy"
    }
  ]
}
```

### Recommended Monitoring Stack

#### Prometheus + Grafana

1. **Prometheus Configuration** (`prometheus.yml`):

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'director'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics
```

2. **Grafana Dashboards**:

Create dashboards for:
- Application Performance
- Resource Utilization
- Error Rates
- Security Events

#### Logging

Structured logging with rotation:

```json
{
  "timestamp": "2023-06-30T12:00:00Z",
  "level": "info",
  "service": "director",
  "message": "Request processed",
  "metadata": {
    "method": "POST",
    "endpoint": "/api/sessions",
    "duration": 245,
    "status": 200
  }
}
```

### Alerting Rules

#### Critical Alerts

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(director_errors_total[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value }} errors per second"

# Database connection failure
- alert: DatabaseDown
  expr: up{job="director"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database connection lost"
    description: "Database has been down for more than 1 minute"
```

## Security

### Network Security

#### Firewall Rules

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow monitoring
sudo ufw allow 9090/tcp
sudo ufw allow 9091/tcp

# Deny all other inbound traffic
sudo ufw default deny incoming
sudo ufw enable
```

#### SSL/TLS Configuration

1. **Using Let's Encrypt**:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

2. **Custom Certificate**:

```bash
# Place certificates in /etc/ssl/certs/
sudo cp your-cert.pem /etc/ssl/certs/director-cert.pem
sudo cp your-key.pem /etc/ssl/private/director-key.pem

# Set permissions
sudo chmod 600 /etc/ssl/private/director-key.pem
```

### Application Security

#### JWT Configuration

```bash
# Generate secure JWT secret
openssl rand -base64 32
```

#### Session Management

```json
{
  "security": {
    "jwtSecret": "your_very_secure_secret_here",
    "sessionTimeout": 3600000,
    "maxSessions": 100,
    "rateLimitWindow": 60000,
    "rateLimitMax": 100
  }
}
```

#### Docker Security

```bash
# Run containers with security options
docker run --read-only \
  --user=1001:1001 \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --security-opt=seccomp=seccomp-profile.json \
  director:latest
```

### Security Best Practices

1. **Regular Updates**: Keep all dependencies updated
2. **Secret Management**: Use environment variables or secret management services
3. **Input Validation**: Validate all user inputs
4. **Rate Limiting**: Implement rate limiting for APIs
5. **Audit Logging**: Enable comprehensive logging
6. **Network Isolation**: Use separate networks for different services
7. **Regular Backups**: Schedule regular backups of critical data

## Backup and Recovery

### Database Backups

#### PostgreSQL Backups

```bash
# Daily backup
pg_dump director_prod > backup-$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump director_prod | gzip > /backups/director-$DATE.sql.gz
```

#### Retention Policy

```bash
# Keep 30 days of backups
find /backups -name "*.sql.gz" -mtime +30 -delete
```

### File System Backups

```bash
# Backup application files
tar -czf /backups/app-$(date +%Y%m%d).tar.gz \
  /opt/director \
  /var/log/director \
  /etc/director
```

### Automated Backup Strategy

```yaml
# backup-cron.yml
version: '3.8'

services:
  backup:
    image: postgres:13
    volumes:
      - ./backups:/backups
    environment:
      - PGPASSWORD=${DB_PASSWORD}
    command: |
      bash -c "
        while true; do
          pg_dump -h ${DB_HOST} -U ${DB_USER} director_prod | gzip > /backups/db-\$(date +%Y%m%d).sql.gz
          tar -czf /backups/app-\$(date +%Y%m%d).tar.gz /opt/director /var/log/director
          sleep 86400
        done
      "
```

### Disaster Recovery

#### Recovery Steps

1. **Assess Damage**: Determine scope and impact
2. **Restore Services**: Bring up infrastructure
3. **Restore Data**: Restore from backups
4. **Validate**: Verify system functionality
5. **Monitor**: Watch for issues after recovery

#### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: < 4 hours
- **Recovery Point Objective (RPO)**: < 1 hour

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check logs
journalctl -u director -n 50

# Check dependencies
sudo systemctl status postgresql
sudo systemctl status redis

# Check configuration
npm run config:validate
```

#### High Memory Usage

```bash
# Monitor memory usage
htop

# Check for memory leaks
npm run memory:profile

# Restart service
sudo systemctl restart director
```

#### Database Connection Issues

```bash
# Test connection
psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log

# Reset connection pool
sudo systemctl restart director
```

#### Network Connectivity

```bash
# Test connectivity
ping ${DB_HOST}
telnet ${DB_HOST} ${DB_PORT}

# Check firewall
sudo ufw status
sudo iptables -L

# Check DNS
nslookup ${DB_HOST}
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run start

# Enable debug mode in production
NODE_ENV=production LOG_LEVEL=debug npm run start
```

### Performance Analysis

```bash
# CPU profiling
npm run cpu:profile

# Memory profiling
npm run memory:profile

# Network tracing
sudo tcpdump -i any port 3000
```

## Performance Tuning

### Application Tuning

#### Worker Processes

```bash
# Optimize based on CPU cores
export WORKERS=$(nproc)

# Set in environment or config
{
  "app": {
    "workers": $(nproc)
  }
}
```

#### Database Tuning

```sql
-- PostgreSQL configuration tuning
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET effective_cache_size = '3GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

#### Redis Tuning

```redis
# Redis configuration
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### System Tuning

#### File System

```bash
# Optimize for SSD
mount -o noatime,nodiratime,data=writeback /dev/sda1 /opt/director

# Enable I/O scheduling
echo noop > /sys/block/sda/queue/scheduler
```

#### Kernel Parameters

```bash
# /etc/sysctl.conf
fs.file-max = 1000000
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 4096
vm.swappiness = 10
```

### Load Testing

```bash
# Using artillery for load testing
npm install -g artillery

# Create test script
cat > load-test.yml << EOF
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      rampTo: 50
scenarios:
  - flow:
      - get:
          url: "/api/sessions"
EOF

# Run test
artillery run load-test.yml
```

## Maintenance

### Regular Maintenance Tasks

```bash
#!/bin/bash
# maintenance.sh

# Daily tasks
echo "Starting daily maintenance..."

# Clean up old logs
find /var/log/director -name "*.log.*" -mtime +7 -delete

# Rotate application logs
/usr/sbin/logrotate -f /etc/logrotate.d/director

# Clean up temporary files
find /tmp/director-messages -type f -mtime +1 -delete

# Weekly tasks (every Sunday)
if [[ $(date +%u) -eq 7 ]]; then
  echo "Starting weekly maintenance..."

  # Database optimization
  vacuumdb --analyze --all-instances

  # Security audit
  npm run security:audit

  # Performance review
  npm run performance:report
fi

# Monthly tasks (every 1st)
if [[ $(date +%d) -eq 1 ]]; then
  echo "Starting monthly maintenance..."

  # Full database backup
  pg_dump director_prod > /backups/full-$(date +%Y%m%d).sql

  # System update
  apt update && apt upgrade -y

  # Dependency update
  npm audit fix
fi
```

### Scheduled Jobs

```bash
# Add to crontab
crontab -e

# Daily at 2 AM
0 2 * * * /opt/director/maintenance.sh

# Database backup every 6 hours
0 */6 * * * pg_dump director_prod | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Log rotation daily
0 0 * * * /usr/sbin/logrotate -f /etc/logrotate.d/director
```

## Conclusion

This production guide provides comprehensive instructions for deploying and maintaining the Director Protocol in production environments. For additional support or questions:

- **Documentation**: [Full documentation](./README.md)
- **Issues**: [GitHub Issues](https://github.com/SuperInstance/claudesclaude/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SuperInstance/claudesclaude/discussions)

Remember to regularly update this guide as your deployment evolves and new best practices emerge.
/**
 * Monitoring and Observability System
 * Provides comprehensive metrics, health checks, and observability features
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { promisify } from 'util';
import { redis, Database } from '../index';
import { config } from './config';
import { globalErrorHandler, DirectorError } from './error-handler';

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Metric labels interface
export interface MetricLabels {
  [key: string]: string;
}

// Metric definition
export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
  buckets?: number[];
  help?: string;
}

// Metric value
export interface MetricValue {
  value: number;
  labels?: MetricLabels;
  timestamp: number;
}

// Health check result
export interface HealthCheck {
  name: string;
  healthy: boolean;
  message?: string;
  duration?: number;
  details?: Record<string, any>;
  timestamp: number;
}

// Alert definition
export interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration: number; // milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  labels?: MetricLabels;
}

// Alert instance
export interface Alert {
  rule: AlertRule;
  triggered: boolean;
  lastTriggered?: number;
  triggeredCount: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

/**
 * Metrics Collector
 * Collects and manages application metrics
 */
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();
  private alerts: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeDefaultMetrics();
    this.startMonitoring();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    this.defineMetric({
      name: 'director_requests_total',
      type: MetricType.COUNTER,
      description: 'Total number of director requests',
      labels: ['method', 'endpoint', 'status']
    });

    this.defineMetric({
      name: 'director_request_duration_seconds',
      type: MetricType.HISTOGRAM,
      description: 'Request duration in seconds',
      labels: ['method', 'endpoint'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    this.defineMetric({
      name: 'director_active_sessions',
      type: MetricType.GAUGE,
      description: 'Number of active sessions',
      labels: ['type']
    });

    this.defineMetric({
      name: 'director_sandbox_count',
      type: MetricType.GAUGE,
      description: 'Number of active sandboxes',
      labels: ['status']
    });

    this.defineMetric({
      name: 'director_errors_total',
      type: MetricType.COUNTER,
      description: 'Total number of errors',
      labels: ['type', 'severity']
    });

    this.defineMetric({
      name: 'director_memory_usage_bytes',
      type: MetricType.GAUGE,
      description: 'Memory usage in bytes'
    });

    this.defineMetric({
      name: 'director_cpu_usage_percent',
      type: MetricType.GAUGE,
      description: 'CPU usage percentage'
    });
  }

  /**
   * Define a new metric
   */
  public defineMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.values.set(definition.name, []);
  }

  /**
   * Record a metric value
   */
  public record(name: string, value: number, labels?: MetricLabels): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      globalErrorHandler.handleNonCritical(
        new Error(`Unknown metric: ${name}`),
        { component: 'monitoring', operation: 'record' }
      );
      return;
    }

    const metricValue: MetricValue = {
      value,
      labels,
      timestamp: Date.now()
    };

    const values = this.values.get(name) || [];
    values.push(metricValue);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }

    this.values.set(name, values);

    // Emit metric event
    this.emit('metric', { name, value, labels, timestamp: metricValue.timestamp });

    // Check alerts
    this.checkAlerts(name, metricValue);
  }

  /**
   * Increment a counter metric
   */
  public increment(name: string, labels?: MetricLabels, value: number = 1): void {
    this.record(name, value, labels);
  }

  /**
   * Set a gauge metric
   */
  public set(name: string, value: number, labels?: MetricLabels): void {
    this.record(name, value, labels);
  }

  /**
   * Record a duration
   */
  public duration(name: string, startTime: number, labels?: MetricLabels): void {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    this.record(name, duration, labels);
  }

  /**
   * Get metric values
   */
  public getValues(name: string, limit: number = 100): MetricValue[] {
    const values = this.values.get(name) || [];
    return values.slice(-limit);
  }

  /**
   * Get metric statistics
   */
  public getStats(name: string): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    latest: number | null;
  } {
    const values = this.values.get(name) || [];
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, latest: null };
    }

    const numericValues = values.map(v => v.value);
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const avg = sum / numericValues.length;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const latest = numericValues[numericValues.length - 1];

    return {
      count: numericValues.length,
      sum,
      avg,
      min,
      max,
      latest
    };
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): { [name: string]: MetricDefinition } {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Get all values
   */
  public getAllValues(): { [name: string]: MetricValue[] } {
    return Object.fromEntries(this.values);
  }

  /**
   * Define alert rule
   */
  public defineAlert(rule: AlertRule): void {
    this.alerts.set(rule.name, rule);
  }

  /**
   * Remove alert rule
   */
  public removeAlert(name: string): void {
    this.alerts.delete(name);
    this.activeAlerts.delete(name);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Check alerts for metric
   */
  private checkAlerts(name: string, value: MetricValue): void {
    for (const [ruleName, rule] of this.alerts) {
      if (rule.metric !== name) continue;

      const isTriggered = this.evaluateAlertCondition(rule, value);
      const isActive = this.activeAlerts.has(ruleName);

      if (isTriggered && !isActive) {
        // Trigger new alert
        const alert: Alert = {
          rule,
          triggered: true,
          triggeredCount: 1,
          message: rule.message,
          severity: rule.severity,
          timestamp: Date.now()
        };

        this.activeAlerts.set(ruleName, alert);
        this.emit('alert', alert);
      } else if (isTriggered && isActive) {
        // Update existing alert
        const alert = this.activeAlerts.get(ruleName)!;
        alert.triggeredCount++;
        alert.lastTriggered = Date.now();
        this.activeAlerts.set(ruleName, alert);
      } else if (!isTriggered && isActive) {
        // Resolve alert
        this.activeAlerts.delete(ruleName);
        this.emit('alertResolved', { rule: rule, timestamp: Date.now() });
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(rule: AlertRule, value: MetricValue): boolean {
    const { condition, threshold } = rule;
    const metricValue = value.value;

    switch (condition) {
      case 'gt': return metricValue > threshold;
      case 'lt': return metricValue < threshold;
      case 'eq': return metricValue === threshold;
      case 'ne': return metricValue !== threshold;
      case 'gte': return metricValue >= threshold;
      case 'lte': return metricValue <= threshold;
      default: return false;
    }
  }

  /**
   * Start monitoring intervals
   */
  private startMonitoring(): void {
    // System metrics collection
    this.checkInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // Every 5 seconds

    // Alert checking
    this.alertInterval = setInterval(() => {
      this.checkAllAlerts();
    }, 10000); // Every 10 seconds
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const usage = process.memoryUsage();

    this.set('director_memory_usage_bytes', usage.heapUsed);
    this.set('director_memory_usage_total_bytes', usage.heapTotal);
    this.set('director_memory_usage_external_bytes', usage.external);
    this.set('director_memory_usage_rss_bytes', usage.rss);

    // CPU usage (approximate)
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    this.set('director_cpu_usage_percent', totalUsage / 1000000 * 100);
  }

  /**
   * Check all alerts
   */
  private checkAllAlerts(): void {
    // This checks if duration-based alerts should trigger
    // For example, if a metric stays above threshold for specified duration
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.alertInterval) clearInterval(this.alertInterval);
  }
}

/**
 * Health Check Manager
 * Manages application health checks
 */
export class HealthCheckManager extends EventEmitter {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private results: Map<string, HealthCheck> = new Map();

  constructor() {
    super();
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultChecks(): void {
    this.addCheck('director', async () => ({
      name: 'director',
      healthy: true,
      message: 'Director service is healthy',
      timestamp: Date.now()
    }));

    this.addCheck('database', async () => {
      const startTime = Date.now();
      try {
        // Simple database connectivity check
        await Database.query('SELECT 1');
        const duration = Date.now() - startTime;

        return {
          name: 'database',
          healthy: true,
          message: 'Database connection healthy',
          duration,
          details: { connectionTime: duration },
          timestamp: Date.now()
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          name: 'database',
          healthy: false,
          message: 'Database connection failed',
          duration,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now()
        };
      }
    });

    this.addCheck('redis', async () => {
      const startTime = Date.now();
      try {
        await redis.ping();
        const duration = Date.now() - startTime;

        return {
          name: 'redis',
          healthy: true,
          message: 'Redis connection healthy',
          duration,
          details: { connectionTime: duration },
          timestamp: Date.now()
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          name: 'redis',
          healthy: false,
          message: 'Redis connection failed',
          duration,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now()
        };
      }
    });

    this.addCheck('sandbox', async () => {
      const startTime = Date.now();
      try {
        // Check if Docker is available
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        await execAsync('docker --version');
        const duration = Date.now() - startTime;

        return {
          name: 'sandbox',
          healthy: true,
          message: 'Docker sandbox available',
          duration,
          details: { dockerAvailable: true },
          timestamp: Date.now()
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          name: 'sandbox',
          healthy: false,
          message: 'Docker sandbox unavailable',
          duration,
          details: { dockerAvailable: false, error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * Add health check
   */
  public addCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }

  /**
   * Remove health check
   */
  public removeCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Get all health checks
   */
  public getAllChecks(): Map<string, () => Promise<HealthCheck>> {
    return new Map(this.checks);
  }

  /**
   * Get health check results
   */
  public getResults(): Map<string, HealthCheck> {
    return new Map(this.results);
  }

  /**
   * Run specific health check
   */
  public async runCheck(name: string): Promise<HealthCheck | null> {
    const check = this.checks.get(name);
    if (!check) return null;

    try {
      const result = await check();
      this.results.set(name, result);
      this.emit('checkResult', result);
      return result;
    } catch (error) {
      const healthCheck: HealthCheck = {
        name,
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.results.set(name, healthCheck);
      this.emit('checkResult', healthCheck);
      return healthCheck;
    }
  }

  /**
   * Run all health checks
   */
  public async runAllChecks(): Promise<Map<string, HealthCheck>> {
    const results = new Map<string, HealthCheck>();

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        results.set(name, result);
        this.results.set(name, result);
        this.emit('checkResult', result);
      } catch (error) {
        const healthCheck: HealthCheck = {
          name,
          healthy: false,
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };

        results.set(name, healthCheck);
        this.results.set(name, healthCheck);
        this.emit('checkResult', healthCheck);
      }
    }

    return results;
  }

  /**
   * Start periodic health checks
   */
  public start(interval: number = 30000): void {
    if (this.interval) clearInterval(this.interval);

    this.interval = setInterval(async () => {
      await this.runAllChecks();
    }, interval);
  }

  /**
   * Stop health checks
   */
  public stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  /**
   * Get overall health status
   */
  public getOverallHealth(): { healthy: boolean; unhealthy: string[]; checks: HealthCheck[] } {
    const results = Array.from(this.results.values());
    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).map(r => r.name);

    return {
      healthy: healthy === results.length && results.length > 0,
      unhealthy,
      checks: results
    };
  }
}

/**
 * Monitoring Server
 * HTTP server for metrics and health endpoints
 */
export class MonitoringServer {
  private server: any;
  private metrics: MetricsCollector;
  private health: HealthCheckManager;
  private port: number;

  constructor(metrics: MetricsCollector, health: HealthCheckManager, port: number) {
    this.metrics = metrics;
    this.health = health;
    this.port = port;
    this.setupServer();
  }

  /**
   * Setup HTTP server
   */
  private setupServer(): void {
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);

      try {
        if (url.pathname === '/metrics') {
          await this.handleMetrics(req, res);
        } else if (url.pathname === '/health') {
          await this.handleHealth(req, res);
        } else if (url.pathname === '/healthcheck') {
          await this.handleHealthCheck(req, res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (error) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  }

  /**
   * Handle /metrics endpoint
   */
  private async handleMetrics(req: any, res: any): Promise<void> {
    const format = req.headers.accept?.includes('application/openmetrics-text') ? 'openmetrics' : 'prometheus';

    let output = '';

    // Header
    output += '# HELP director_info Application information\n';
    output += '# TYPE director_info gauge\n';
    output += `director_info{version="${config.app.version}",environment="${config.app.environment}"} 1\n\n`;

    // Metrics
    for (const [name, definition] of this.metrics.getAllMetrics()) {
      const stats = this.metrics.getStats(name);
      const values = this.metrics.getValues(name, 1);

      if (definition.type === MetricType.COUNTER) {
        output += `# HELP ${name} ${definition.description}\n`;
        output += `# TYPE ${name} counter\n`;

        if (values.length > 0) {
          const latest = values[values.length - 1];
          const labels = latest.labels ? Object.entries(latest.labels)
            .map(([k, v]) => `${k}="${v}"`).join(',') : '';
          output += `${name}{${labels}} ${latest.value.toFixed(6)} ${latest.timestamp}\n`;
        }
      } else if (definition.type === MetricType.GAUGE) {
        output += `# HELP ${name} ${definition.description}\n`;
        output += `# TYPE ${name} gauge\n`;
        output += `${name} ${stats.latest !== null ? stats.latest.toFixed(6) : '0'} ${Date.now()}\n`;
      }

      output += '\n';
    }

    // Alerts
    const alerts = this.metrics.getActiveAlerts();
    for (const alert of alerts) {
      output += `# HELP director_alert Alert firing\n`;
      output += `# TYPE director_alert gauge\n`;
      output += `director_alert{rule="${alert.rule.name}",severity="${alert.severity}"} 1 ${Date.now()}\n`;
    }

    res.writeHead(200, {
      'Content-Type': format === 'openmetrics'
        ? 'application/openmetrics-text; version=1.0.0; charset=utf-8'
        : 'text/plain; version=0.0.4; charset=utf-8'
    });
    res.end(output);
  }

  /**
   * Handle /health endpoint
   */
  private async handleHealth(req: any, res: any): Promise<void> {
    const overall = this.health.getOverallHealth();

    res.writeHead(overall.healthy ? 200 : 503, {
      'Content-Type': 'application/json'
    });

    res.end(JSON.stringify({
      status: overall.healthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      checks: Array.from(this.health.getResults().values()),
      unhealthy: overall.unhealthy
    }));
  }

  /**
   * Handle /healthcheck endpoint
   */
  private async handleHealthCheck(req: any, res: any): Promise<void> {
    const results = await this.health.runAllChecks();
    const overall = this.health.getOverallHealth();

    res.writeHead(overall.healthy ? 200 : 503, {
      'Content-Type': 'application/json'
    });

    res.end(JSON.stringify({
      status: overall.healthy ? 'pass' : 'fail',
      timestamp: Date.now(),
      version: config.app.version,
      checks: Array.from(results.values())
    }));
  }

  /**
   * Start server
   */
  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`Monitoring server listening on port ${this.port}`);
    });
  }

  /**
   * Stop server
   */
  public stop(): void {
    this.server.close();
  }
}

// Global instances
export const metricsCollector = new MetricsCollector();
export const healthCheckManager = new HealthCheckManager();

// Auto-start monitoring if enabled
if (config.monitoring.enabled) {
  healthCheckManager.start();

  if (config.monitoring.metricsPort) {
    const monitoringServer = new MonitoringServer(
      metricsCollector,
      healthCheckManager,
      config.monitoring.metricsPort
    );
    monitoringServer.start();
  }
}
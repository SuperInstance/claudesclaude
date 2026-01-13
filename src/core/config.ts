/**
 * Production Configuration System
 * Manages environment-specific configurations and settings
 */

import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Configuration validation schemas
const ConfigSchema = z.object({
  // Application settings
  app: z.object({
    name: z.string().default('Director Protocol'),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    workers: z.number().int().min(1).default(1),
    shutdownTimeout: z.number().int().min(1000).default(30000)
  }),

  // Security settings
  security: z.object({
    jwtSecret: z.string().min(32),
    sessionTimeout: z.number().int().min(60000).default(3600000),
    maxSessions: z.number().int().min(1).default(100),
    rateLimitWindow: z.number().int().min(1000).default(60000),
    rateLimitMax: z.number().int().min(1).default(100),
    enableCORS: z.boolean().default(true),
    allowedOrigins: z.array(z.string()).default(['http://localhost:3000'])
  }),

  // Database settings
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(5432),
    name: z.string(),
    username: z.string(),
    password: z.string(),
    pool: z.object({
      min: z.number().int().min(0).default(2),
      max: z.number().int().min(1).default(10),
      idle: z.number().int().min(1000).default(30000),
      acquire: z.number().int().min(1000).default(60000)
    }),
    ssl: z.object({
      enabled: z.boolean().default(false),
      rejectUnauthorized: z.boolean().default(true),
      ca: z.string().optional(),
      cert: z.string().optional(),
      key: z.string().optional()
    })
  }),

  // Redis settings
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(6379),
    password: z.string().optional(),
    db: z.number().int().min(0).default(0),
    keyPrefix: z.string().default('director:'),
    maxRetries: z.number().int().min(0).default(3)
  }),

  // Message bus settings
  messageBus: z.object({
    basePath: z.string().default('/tmp/director-messages'),
    maxFileSize: z.number().int().min(1024).default(10485760), // 10MB
    maxFiles: z.number().int().min(1).default(100),
    cleanupInterval: z.number().int().min(3600000).default(86400000), // 24 hours
    retryAttempts: z.number().int().min(0).default(3),
    retryDelay: z.number().int().min(1000).default(5000)
  }),

  // Sandbox settings
  sandbox: z.object({
    enabled: z.boolean().default(true),
    dockerHost: z.string().default('unix:///var/run/docker.sock'),
    maxConcurrent: z.number().int().min(1).default(5),
    defaultImage: z.string().default('node:22-alpine'),
    timeout: z.number().int().min(1000).default(300000), // 5 minutes
    healthCheckInterval: z.number().int().min(1000).default(30000),
    resourceLimits: z.object({
      cpu: z.number().min(0.1).max(8).default(1.0),
      memory: z.number().min(64).max(8192).default(512), // MB
      disk: z.number().min(128).max(10240).default(1024), // MB
      network: z.boolean().default(false)
    }),
    security: z.object({
      readOnlyRoot: z.boolean().default(true),
      noPrivileges: z.boolean().default(true),
      maxProcesses: z.number().int().min(1).default(10),
      maxOpenFiles: z.number().int().min(1).default(100)
    })
  }),

  // Network isolation settings
  network: z.object({
    enabled: z.boolean().default(true),
    iptablesEnabled: z.boolean().default(true),
    defaultSubnet: z.string().default('172.30.0.0/16'),
    dnsEnabled: z.boolean().default(true),
    internalNetworks: z.array(z.string()).default(['172.30.0.0/16', '172.31.0.0/16'])
  }),

  // Monitoring settings
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().int().min(1).max(65535).default(9090),
    healthCheckPort: z.number().int().min(1).max(65535).default(9091),
    prometheusEnabled: z.boolean().default(true),
    tracingEnabled: z.boolean().default(false),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  }),

  // Logging settings
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
    files: z.object({
      enabled: z.boolean().default(true),
      maxFiles: z.number().int().min(1).default(5),
      maxSize: z.string().default('10m'),
        error: z.string().default('logs/error.log'),
        combined: z.string().default('logs/combined.log'),
        access: z.string().default('logs/access.log')
      }),
      console: z.object({
        enabled: z.boolean().default(true),
        colorize: z.boolean().default(true)
      })
    }),

    // Backup settings
    backup: z.object({
      enabled: z.boolean().default(true),
      interval: z.number().int().min(3600000).default(86400000), // 24 hours
      retention: z.number().int().min(1).default(7), // days
      compression: z.boolean().default(true),
      remoteStorage: z.object({
        enabled: z.boolean().default(false),
        provider: z.enum(['s3', 'azure', 'gcs']).optional(),
        endpoint: z.string().optional(),
        accessKey: z.string().optional(),
        secretKey: z.string().optional(),
        bucket: z.string().optional()
      })
    }),

    // Cluster settings
    cluster: z.object({
      enabled: z.boolean().default(false),
      nodeID: z.string().default(''),
      seeds: z.array(z.string()).default([]),
      gossipPort: z.number().int().min(1).max(65535).default(7946),
      rpcPort: z.number().int().min(1).max(65535).default(7947),
      dataDir: z.string().default('./data')
    })
  });

// Type-safe configuration
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration Manager
 * Handles environment-specific configuration loading and validation
 */
export class ConfigManager {
  private config: Config;
  private configPath: string;
  private envConfigPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'config', 'config.json');
    this.envConfigPath = join(process.cwd(), 'config', `${process.env.NODE_ENV || 'development'}.json`);

    this.config = this.loadAndValidateConfig();
  }

  /**
   * Load and validate configuration
   */
  private loadAndValidateConfig(): Config {
    const defaultConfig = this.getDefaultConfig();
    const fileConfig = this.loadFromFile();
    const envConfig = this.fromEnvironment();

    // Merge configurations with precedence: env > file > defaults
    const mergedConfig = this.mergeConfigs(defaultConfig, fileConfig, envConfig);

    // Validate and return
    return ConfigSchema.parse(mergedConfig);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): Partial<Config> {
    return {
      app: {
        name: 'Director Protocol',
        version: '1.0.0',
        environment: process.env.NODE_ENV as any || 'development',
        port: 3000,
        host: 'localhost',
        workers: parseInt(process.env.WORKERS || '1'),
        shutdownTimeout: 30000
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || this.generateSecret(),
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'),
        maxSessions: parseInt(process.env.MAX_SESSIONS || '100'),
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        enableCORS: process.env.ENABLE_CORS !== 'false',
        allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'director',
        username: process.env.DB_USER || 'director',
        password: process.env.DB_PASSWORD || 'director',
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '2'),
          max: parseInt(process.env.DB_POOL_MAX || '10'),
          idle: parseInt(process.env.DB_POOL_IDLE || '30000'),
          acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000')
        },
        ssl: {
          enabled: process.env.DB_SSL === 'true',
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_PREFIX || 'director:',
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3')
      },
      messageBus: {
        basePath: process.env.MESSAGE_BUS_PATH || '/tmp/director-messages',
        maxFileSize: parseInt(process.env.MESSAGE_BUS_MAX_SIZE || '10485760'),
        maxFiles: parseInt(process.env.MESSAGE_BUS_MAX_FILES || '100'),
        cleanupInterval: parseInt(process.env.MESSAGE_BUS_CLEANUP || '86400000'),
        retryAttempts: parseInt(process.env.MESSAGE_BUS_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.MESSAGE_BUS_RETRY_DELAY || '5000')
      },
      sandbox: {
        enabled: process.env.SANDBOX_ENABLED !== 'false',
        dockerHost: process.env.DOCKER_HOST || 'unix:///var/run/docker.sock',
        maxConcurrent: parseInt(process.env.SANDBOX_MAX_CONCURRENT || '5'),
        defaultImage: process.env.SANDBOX_DEFAULT_IMAGE || 'node:22-alpine',
        timeout: parseInt(process.env.SANDBOX_TIMEOUT || '300000'),
        healthCheckInterval: parseInt(process.env.SANDBOX_HEALTH_CHECK || '30000'),
        resourceLimits: {
          cpu: parseFloat(process.env.SANDBOX_CPU_LIMIT || '1.0'),
          memory: parseInt(process.env.SANDBOX_MEMORY_LIMIT || '512'),
          disk: parseInt(process.env.SANDBOX_DISK_LIMIT || '1024'),
          network: process.env.SANDBOX_NETWORK !== 'true'
        },
        security: {
          readOnlyRoot: process.env.SANDBOX_READ_ONLY_ROOT !== 'false',
          noPrivileges: process.env.SANDBOX_NO_PRIVILEGES !== 'false',
          maxProcesses: parseInt(process.env.SANDBOX_MAX_PROCESSES || '10'),
          maxOpenFiles: parseInt(process.env.SANDBOX_MAX_OPEN_FILES || '100')
        }
      },
      network: {
        enabled: process.env.NETWORK_ISOLATION !== 'false',
        iptablesEnabled: process.env.IPTABLES_ENABLED !== 'false',
        defaultSubnet: process.env.DEFAULT_SUBNET || '172.30.0.0/16',
        dnsEnabled: process.env.DNS_ENABLED !== 'false',
        internalNetworks: (process.env.INTERNAL_NETWORKS || '172.30.0.0/16,172.31.0.0/16').split(',')
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
        healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '9091'),
        prometheusEnabled: process.env.PROMETHEUS_ENABLED !== 'false',
        tracingEnabled: process.env.TRACING_ENABLED === 'true',
        logLevel: (process.env.LOG_LEVEL || 'info') as any
      },
      logging: {
        level: (process.env.LOG_LEVEL || 'info') as any,
        format: (process.env.LOG_FORMAT || 'json') as any,
        files: {
          enabled: process.env.LOG_FILES_ENABLED !== 'false',
          maxFiles: parseInt(process.env.LOG_FILES_MAX || '5'),
          maxSize: process.env.LOG_FILES_MAX_SIZE || '10m',
          error: process.env.LOG_FILES_ERROR || 'logs/error.log',
          combined: process.env.LOG_FILES_COMBINED || 'logs/combined.log',
          access: process.env.LOG_FILES_ACCESS || 'logs/access.log'
        },
        console: {
          enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
          colorize: process.env.LOG_CONSOLE_COLORIZE !== 'false'
        }
      },
      backup: {
        enabled: process.env.BACKUP_ENABLED !== 'false',
        interval: parseInt(process.env.BACKUP_INTERVAL || '86400000'),
        retention: parseInt(process.env.BACKUP_RETENTION || '7'),
        compression: process.env.BACKUP_COMPRESSION !== 'false',
        remoteStorage: {
          enabled: process.env.REMOTE_STORAGE_ENABLED === 'true',
          provider: process.env.REMOTE_STORAGE_PROVIDER as any,
          endpoint: process.env.REMOTE_STORAGE_ENDPOINT,
          accessKey: process.env.REMOTE_STORAGE_ACCESS_KEY,
          secretKey: process.env.REMOTE_STORAGE_SECRET_KEY,
          bucket: process.env.REMOTE_STORAGE_BUCKET
        }
      },
      cluster: {
        enabled: process.env.CLUSTER_ENABLED === 'true',
        nodeID: process.env.CLUSTER_NODE_ID || '',
        seeds: (process.env.CLUSTER_SEEDS || '').split(',').filter(Boolean),
        gossipPort: parseInt(process.env.CLUSTER_GOSSIP_PORT || '7946'),
        rpcPort: parseInt(process.env.CLUSTER_RPC_PORT || '7947'),
        dataDir: process.env.CLUSTER_DATA_DIR || './data'
      }
    };
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(): Partial<Config> {
    try {
      if (existsSync(this.configPath)) {
        const content = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      }

      if (existsSync(this.envConfigPath)) {
        const content = readFileSync(this.envConfigPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load configuration file:', error);
    }

    return {};
  }

  /**
   * Load configuration from environment
   */
  private fromEnvironment(): Partial<Config> {
    // Additional environment-based configurations can be added here
    return {};
  }

  /**
   * Merge configurations with precedence
   */
  private mergeConfigs(...configs: Array<Partial<Config>>): Partial<Config> {
    const result: Partial<Config> = {};

    for (const config of configs) {
      this.deepMerge(result, config);
    }

    return result;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Generate a random secret
   */
  private generateSecret(length: number = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get configuration
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Get configuration value by key path
   */
  public get<T>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let current: any = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue as T;
      }
    }

    return current;
  }

  /**
   * Update configuration
   */
  public update(updates: Partial<Config>): void {
    this.config = ConfigSchema.parse(this.mergeConfigs(this.config, updates));
  }

  /**
   * Save configuration to file
   */
  public save(): void {
    try {
      const configDir = this.configPath.split('/').slice(0, -1).join('/');
      require('fs').mkdirSync(configDir, { recursive: true });

      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  /**
   * Validate configuration
   */
  public validate(): { valid: boolean; errors?: string[] } {
    try {
      ConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => e.message)
        };
      }
      return {
        valid: false,
        errors: ['Unknown configuration error']
      };
    }
  }

  /**
   * Get environment-specific configuration
   */
  public getEnvironmentConfig(): Config {
    const envConfig = { ...this.config };
    envConfig.app.environment = process.env.NODE_ENV as any || 'development';

    // Override sensitive values in production
    if (envConfig.app.environment === 'production') {
      envConfig.security.jwtSecret = this.generateSecret();
      envConfig.database.password = this.generateSecret(32);
    }

    return envConfig;
  }

  /**
   * Check if production environment
   */
  public isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  /**
   * Check if development environment
   */
  public isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  /**
   * Check if staging environment
   */
  public isStaging(): boolean {
    return this.config.app.environment === 'staging';
  }
}

// Global configuration instance
export const configManager = new ConfigManager();

// Export convenience methods
export const config = configManager.getConfig.bind(configManager);
export const get = configManager.get.bind(configManager);
export const update = configManager.update.bind(configManager);
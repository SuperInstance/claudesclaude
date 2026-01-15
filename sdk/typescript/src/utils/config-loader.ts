/**
 * Configuration loader for the Orchestration SDK
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OrchestrationConfig } from '../types';
import { logger } from './logger';
import { ValidationError } from '../../claudesclaude/dist/src/core/types';

export interface ConfigLoaderOptions {
  configPath?: string;
  environment?: string;
  defaults?: Partial<OrchestrationConfig>;
  validate?: boolean;
}

export class ConfigLoader {
  private config: OrchestrationConfig;
  private options: Required<ConfigLoaderOptions>;

  constructor(options: ConfigLoaderOptions = {}) {
    this.options = {
      configPath: './config/orchestration.yaml',
      environment: process.env.NODE_ENV || 'development',
      defaults: this.getDefaultConfig(),
      validate: true,
      ...options
    };

    this.config = this.loadConfig();
  }

  private getDefaultConfig(): OrchestrationConfig {
    return {
      database: {
        path: './data/orchestration.db',
        enableFTS: true,
        connectionPool: {
          min: 2,
          max: 10,
          idleTimeout: 30000
        }
      },
      messageBus: {
        queuePath: './.orchestration/queue',
        maxQueueSize: 10000,
        gcIntervalMs: 60000
      },
      workerManager: {
        minWorkers: 2,
        maxWorkers: 8,
        maxTaskQueueSize: 1000,
        taskTimeout: 30000,
        healthCheckInterval: 30000,
        workerIdleTimeout: 300000,
        maxWorkerMemory: 512 * 1024 * 1024,
        maxRetries: 3,
        retryDelay: 1000,
        enableAutoScaling: true,
        enableHealthChecks: true,
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpCooldown: 30000,
        scaleDownCooldown: 60000,
        backpressureThreshold: 0.9,
        maxTasksPerWorker: 100,
        workerRecycleThreshold: 500
      },
      security: {
        authMethod: 'api_key',
        apiKeyHeader: 'X-API-Key',
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        sessionTimeout: 3600000,
        enableMultiFactor: false
      },
      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: true,
        filePath: './logs/orchestration.log'
      },
      monitoring: {
        enableMetrics: true,
        metricsInterval: 10000,
        enableHealthChecks: true,
        healthCheckInterval: 30000
      }
    };
  }

  private loadConfig(): OrchestrationConfig {
    let config: OrchestrationConfig = { ...this.options.defaults! };

    // Load from file if specified
    if (this.options.configPath) {
      try {
        const fileConfig = this.loadConfigFile(this.options.configPath);
        config = this.mergeConfigs(config, fileConfig);
        logger.info('Loaded configuration from file', { configPath: this.options.configPath });
      } catch (error) {
        logger.warn('Failed to load configuration file, using defaults', {
          configPath: this.options.configPath,
          error: error.message
        });
      }
    }

    // Override with environment variables
    config = this.applyEnvironmentVariables(config);

    // Apply environment-specific overrides
    config = this.applyEnvironmentOverrides(config, this.options.environment);

    // Validate configuration if requested
    if (this.options.validate) {
      this.validateConfig(config);
    }

    return config;
  }

  private loadConfigFile(configPath: string): OrchestrationConfig {
    const fs = require('fs/promises');
    const path = require('path');

    // Try YAML first
    if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      return this.loadYamlConfig(configPath);
    }

    // Try JSON
    if (configPath.endsWith('.json')) {
      return this.loadJsonConfig(configPath);
    }

    // Try common extensions
    const extensions = ['.yaml', '.yml', '.json'];
    for (const ext of extensions) {
      const fullPath = configPath + ext;
      try {
        if (ext === '.yaml' || ext === '.yml') {
          return this.loadYamlConfig(fullPath);
        } else {
          return this.loadJsonConfig(fullPath);
        }
      } catch {
        // Continue to next extension
      }
    }

    throw new Error(`No configuration file found at ${configPath}`);
  }

  private loadYamlConfig(configPath: string): OrchestrationConfig {
    const fs = require('fs/promises');

    return yaml.load(fs.readFileSync(configPath, 'utf8')) as OrchestrationConfig;
  }

  private loadJsonConfig(configPath: string): OrchestrationConfig {
    const fs = require('fs/promises');

    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as OrchestrationConfig;
  }

  private mergeConfigs(base: OrchestrationConfig, override: Partial<OrchestrationConfig>): OrchestrationConfig {
    const result = { ...base };

    // Deep merge helper
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    };

    return deepMerge(result, override);
  }

  private applyEnvironmentVariables(config: OrchestrationConfig): OrchestrationConfig {
    const envConfig: Partial<OrchestrationConfig> = {};

    // Database configuration
    if (process.env.DB_PATH) {
      envConfig.database = { ...envConfig.database, path: process.env.DB_PATH };
    }

    if (process.env.DB_CONNECTION_POOL_MIN) {
      envConfig.database = {
        ...envConfig.database,
        connectionPool: {
          ...envConfig.database?.connectionPool,
          min: parseInt(process.env.DB_CONNECTION_POOL_MIN)
        }
      };
    }

    // Message bus configuration
    if (process.env.MESSAGE_QUEUE_PATH) {
      envConfig.messageBus = {
        ...envConfig.messageBus,
        queuePath: process.env.MESSAGE_QUEUE_PATH
      };
    }

    // Worker manager configuration
    if (process.env.MIN_WORKERS) {
      envConfig.workerManager = {
        ...envConfig.workerManager,
        minWorkers: parseInt(process.env.MIN_WORKERS)
      };
    }

    if (process.env.MAX_WORKERS) {
      envConfig.workerManager = {
        ...envConfig.workerManager,
        maxWorkers: parseInt(process.env.MAX_WORKERS)
      };
    }

    // Security configuration
    if (process.env.AUTH_METHOD) {
      envConfig.security = {
        ...envConfig.security,
        authMethod: process.env.AUTH_METHOD as any
      };
    }

    if (process.env.JWT_SECRET) {
      envConfig.security = {
        ...envConfig.security,
        jwtSecret: process.env.JWT_SECRET
      };
    }

    // Logging configuration
    if (process.env.LOG_LEVEL) {
      envConfig.logging = {
        ...envConfig.logging,
        level: process.env.LOG_LEVEL as any
      };
    }

    if (process.env.LOG_TO_FILE === 'false') {
      envConfig.logging = {
        ...envConfig.logging,
        enableFile: false
      };
    }

    // Merge environment overrides
    return this.mergeConfigs(config, envConfig);
  }

  private applyEnvironmentOverrides(config: OrchestrationConfig, environment: string): OrchestrationConfig {
    const overrides: Record<string, Partial<OrchestrationConfig>> = {
      production: {
        logging: {
          level: 'warn',
          enableConsole: false,
          enableFile: true
        },
        monitoring: {
          enableMetrics: true,
          metricsInterval: 5000
        },
        workerManager: {
          enableAutoScaling: false,
          maxWorkers: 16,
          minWorkers: 8
        }
      },
      staging: {
        logging: {
          level: 'info',
          enableConsole: true,
          enableFile: true
        },
        monitoring: {
          enableMetrics: true,
          metricsInterval: 10000
        }
      },
      development: {
        logging: {
          level: 'debug',
          enableConsole: true,
          enableFile: false
        },
        monitoring: {
          enableMetrics: false
        }
      },
      test: {
        logging: {
          level: 'error',
          enableConsole: false,
          enableFile: false
        },
        monitoring: {
          enableMetrics: false
        },
        database: {
          path: ':memory:'
        }
      }
    };

    const envOverrides = overrides[environment] || {};
    return this.mergeConfigs(config, envOverrides);
  }

  private validateConfig(config: OrchestrationConfig): void {
    const errors: string[] = [];

    // Validate database configuration
    if (!config.database.path) {
      errors.push('Database path is required');
    }

    // Validate message bus configuration
    if (config.messageBus && (!config.messageBus.queuePath)) {
      errors.push('Message queue path is required');
    }

    // Validate worker manager configuration
    if (config.workerManager) {
      if (config.workerManager.minWorkers > config.workerManager.maxWorkers) {
        errors.push('Min workers cannot be greater than max workers');
      }

      if (config.workerManager.maxTaskQueueSize < 1) {
        errors.push('Max task queue size must be at least 1');
      }
    }

    // Validate security configuration
    if (config.security) {
      if (config.security.authMethod === 'jwt' && !config.security.jwtSecret) {
        errors.push('JWT secret is required when using JWT authentication');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(
        'Configuration validation failed',
        'config',
        { errors }
      );
    }
  }

  // Public methods
  getConfig(): OrchestrationConfig {
    return { ...this.config };
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getMessageBusConfig() {
    return this.config.messageBus;
  }

  getWorkerManagerConfig() {
    return this.config.workerManager;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  getMonitoringConfig() {
    return this.config.monitoring;
  }

  updateConfig(updates: Partial<OrchestrationConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);

    if (this.options.validate) {
      this.validateConfig(this.config);
    }
  }

  reload(): void {
    this.config = this.loadConfig();
    logger.info('Configuration reloaded');
  }

  // Static convenience method
  static load(options: ConfigLoaderOptions = {}): ConfigLoader {
    return new ConfigLoader(options);
  }
}

// Export convenience function
export const loadConfig = (options?: ConfigLoaderOptions): ConfigLoader => {
  return ConfigLoader.load(options);
};

// Environment-specific loaders
export const loadDevelopmentConfig = (): ConfigLoader => {
  return ConfigLoader.load({
    environment: 'development'
  });
};

export const loadProductionConfig = (): ConfigLoader => {
  return ConfigLoader.load({
    environment: 'production'
  });
};

export const loadTestConfig = (): ConfigLoader => {
  return ConfigLoader.load({
    environment: 'test'
  });
};
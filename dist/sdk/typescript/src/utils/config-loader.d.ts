import { OrchestrationConfig } from '../types';
export interface ConfigLoaderOptions {
    configPath?: string;
    environment?: string;
    defaults?: Partial<OrchestrationConfig>;
    validate?: boolean;
}
export declare class ConfigLoader {
    private config;
    private options;
    constructor(options?: ConfigLoaderOptions);
    private getDefaultConfig;
    private loadConfig;
    private loadConfigFile;
    private loadYamlConfig;
    private loadJsonConfig;
    private mergeConfigs;
    private applyEnvironmentVariables;
    private applyEnvironmentOverrides;
    private validateConfig;
    getConfig(): OrchestrationConfig;
    getDatabaseConfig(): import("../types").DatabaseConfig;
    getMessageBusConfig(): {
        queuePath?: string;
        maxQueueSize?: number;
        gcIntervalMs?: number;
    } | undefined;
    getWorkerManagerConfig(): import("../types").WorkerManagerConfig | undefined;
    getSecurityConfig(): {
        authMethod?: "api_key" | "jwt" | "oauth2" | "session" | "certificate";
        apiKeyHeader?: string;
        jwtSecret?: string;
        sessionTimeout?: number;
        enableMultiFactor?: boolean;
    } | undefined;
    getLoggingConfig(): {
        level?: "debug" | "info" | "warn" | "error";
        enableConsole?: boolean;
        enableFile?: boolean;
        filePath?: string;
    } | undefined;
    getMonitoringConfig(): {
        enableMetrics?: boolean;
        metricsInterval?: number;
        enableHealthChecks?: boolean;
        healthCheckInterval?: number;
    } | undefined;
    updateConfig(updates: Partial<OrchestrationConfig>): void;
    reload(): void;
    static load(options?: ConfigLoaderOptions): ConfigLoader;
}
export declare const loadConfig: (options?: ConfigLoaderOptions) => ConfigLoader;
export declare const loadDevelopmentConfig: () => ConfigLoader;
export declare const loadProductionConfig: () => ConfigLoader;
export declare const loadTestConfig: () => ConfigLoader;

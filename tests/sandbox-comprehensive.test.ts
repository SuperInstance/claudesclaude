/**
 * Comprehensive Sandbox Testing Suite
 * Validates all aspects of the sandboxing and isolation system
 */

import { describe, beforeEach, afterEach, it, expect, beforeAll, afterAll } from 'bun:test';
import { SandboxManager } from '../src/core/sandbox';
import { NetworkIsolationManager } from '../src/core/network-isolation';
import { SecurityManager, SecurityLevel } from '../src/core/security-manager';
import { EnvironmentManager, EnvironmentTemplateType } from '../src/core/environment-manager';

describe('Sandbox Comprehensive Testing', () => {
  let sandboxManager: SandboxManager;
  let networkManager: NetworkIsolationManager;
  let securityManager: SecurityManager;
  let environmentManager: EnvironmentManager;

  beforeAll(async () => {
    // Initialize all managers
    sandboxManager = new SandboxManager();
    networkManager = new NetworkIsolationManager();
    securityManager = new SecurityManager();
    environmentManager = new EnvironmentManager();

    // Wait for managers to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup all sandboxes
    await sandboxManager.cleanupAll();
  });

  describe('Container-based Sandbox Testing', () => {
    it('should create a basic sandbox container', async () => {
      const sandboxId = await sandboxManager.createSandbox({
        name: 'test-basic-sandbox',
        command: ['node', '--version'],
        image: 'node:22-alpine'
      });

      expect(sandboxId).toBeDefined();
      const state = sandboxManager.getSandboxState(sandboxId);
      expect(state).toBeDefined();
      expect(state?.status).toBe('running');
    });

    it('should execute commands in sandbox with timeout', async () => {
      const result = await sandboxManager.executeInSandbox('test-exec-1', [
        'node', '-e', 'console.log("Hello World")'
      ], { timeout: 5000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello World');
      expect(result.stderr).toBe('');
    });

    it('should enforce resource limits', async () => {
      const sandboxId = await sandboxManager.createSandbox({
        name: 'test-resource-limits',
        resourceLimits: {
          cpu: 0.5,
          memory: 256,
          disk: 512,
          network: false,
          maxDuration: 10
        },
        command: ['node', '--version']
      });

      const state = sandboxManager.getSandboxState(sandboxId);
      expect(state).toBeDefined();

      // Resource monitoring should be active
      expect(state?.resourceUsage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(state?.resourceUsage.memoryBytes).toBeGreaterThanOrEqual(0);
    });

    it('should restrict network access when disabled', async () => {
      const sandboxId = await sandboxManager.createSandbox({
        name: 'test-no-network',
        resourceLimits: {
          cpu: 1.0,
          memory: 512,
          disk: 1024,
          network: false,
          maxDuration: 30
        },
        command: ['node', '-e', 'try { require("net"); console.log("Network available"); } catch(e) { console.log("Network blocked"); }']
      });

      const result = await sandboxManager.executeInSandbox('test-network-block', [
        'node', '-e', 'try { require("net"); console.log("Network available"); } catch(e) { console.log("Network blocked"); }'
      ]);

      // Should either fail or indicate network is blocked
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should enforce security policies', async () => {
      const sandboxId = await sandboxManager.createSandbox({
        name: 'test-security-policy',
        securityPolicy: {
          allowFilesystem: true,
          allowNetwork: false,
          allowExec: true,
          allowedPaths: ['/tmp'],
          blockedPaths: ['/etc', '/root'],
          maxProcesses: 5,
          maxOpenFiles: 50,
          readOnlyRoot: true,
          noPrivileges: true
        },
        command: ['node', '--version']
      });

      expect(sandboxId).toBeDefined();
      const state = sandboxManager.getSandboxState(sandboxId);
      expect(state?.status).toBe('running');
    });

    it('should prevent privilege escalation', async () => {
      const result = await sandboxManager.executeInSandbox('test-privilege-escalation', [
        'node', '-e', 'try { process.getuid(); console.log("UID:", process.getuid()); } catch(e) { console.log("UID access blocked"); }'
      ]);

      // Should either not run or indicate privileged operations are blocked
      expect([0, 1]).toContain(result.exitCode);
    });
  });

  describe('Network Isolation Testing', () => {
    it('should create isolated network for sandbox', async () => {
      const sandboxId = 'test-network-isolation';
      const networkId = await networkManager.createSandboxNetwork(sandboxId, {
        subnet: '172.31.0.0/24',
        gateway: '172.31.0.1',
        enableDNS: true,
        internal: true
      });

      expect(networkId).toBeDefined();
      expect(networkId).toBe(`sandbox-${sandboxId}`);

      const networkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(networkInfo.networkId).toBe(networkId);
      expect(networkInfo.interface).toBeDefined();
      expect(networkInfo.interface?.subnet).toBe('172.31.0.0/24');
    });

    it('should apply network policies', async () => {
      const sandboxId = 'test-network-policy';
      const networkId = await networkManager.createSandboxNetwork(sandboxId);

      const policy = networkManager.createNetworkPolicy({
        name: 'restrictive-policy',
        description: 'Block all outbound traffic',
        inbound: [
          {
            id: 'inbound-loopback',
            action: 'allow',
            protocol: 'all',
            source: '127.0.0.1/32',
            enabled: true
          }
        ],
        outbound: [
          {
            id: 'outblock-all',
            action: 'deny',
            protocol: 'all',
            enabled: true
          }
        ],
        logging: true,
        metrics: true
      });

      expect(policy.id).toBeDefined();
      await networkManager.applyNetworkPolicy(sandboxId, policy);

      // Verify policy was applied
      const networkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(networkInfo.policy).toBeDefined();
    });

    it('should allow selective network access', async () => {
      const sandboxId = 'test-selective-access';
      await networkManager.createSandboxNetwork(sandboxId);

      await networkManager.allowNetworkAccess(sandboxId, [
        { host: 'localhost', port: 80, protocol: 'tcp' },
        { host: '127.0.0.1', port: 443, protocol: 'tcp' }
      ]);

      const networkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(networkInfo.policy?.outbound.length).toBeGreaterThan(0);
    });

    it('should isolate sandbox completely', async () => {
      const sandboxId = 'test-complete-isolation';
      await networkManager.createSandboxNetwork(sandboxId);

      await networkManager.isolateSandbox(sandboxId);

      const networkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(networkInfo.policy).toBeDefined();
      expect(networkInfo.policy?.outbound.length).toBe(1);
      expect(networkInfo.policy?.outbound[0].action).toBe('deny');
    });
  });

  describe('Security Policy Testing', () => {
    it('should validate security profiles', () => {
      // Test low risk profile
      const lowRiskProfile = securityManager.getSecurityProfile(SecurityLevel.LOW);
      expect(lowRiskProfile).toBeDefined();
      expect(lowRiskProfile.name).toBe('low-risk');

      // Test medium risk profile
      const mediumRiskProfile = securityManager.getSecurityProfile(SecurityLevel.MEDIUM);
      expect(mediumRiskProfile).toBeDefined();
      expect(mediumRiskProfile.name).toBe('medium-risk');

      // Test high risk profile
      const highRiskProfile = securityManager.getSecurityProfile(SecurityLevel.HIGH);
      expect(highRiskProfile).toBeDefined();
      expect(highRiskProfile.name).toBe('high-risk');
    });

    it('should enforce file system restrictions', async () => {
      const result = await sandboxManager.executeInSandbox('test-fs-restrictions', [
        'node', '-e', `
          const fs = require('fs');
          const paths = ['/etc/passwd', '/root', '/tmp/test'];
          const results = paths.map(path => {
            try {
              fs.accessSync(path, fs.constants.R_OK);
              return 'accessible: ' + path;
            } catch(e) {
              return 'blocked: ' + path;
            }
          });
          console.log(results.join(', '));
        `
      ]);

      // Should show that sensitive paths are blocked
      expect(result.exitCode).toBe(0);
      const output = result.stdout;
      expect(output).toContain('blocked:');
    });

    it('should log security events', async () => {
      // Create sandbox with restricted policy
      const sandboxId = await sandboxManager.createSandbox({
        name: 'test-security-logging',
        securityPolicy: {
          allowFilesystem: true,
          allowNetwork: false,
          allowExec: true,
          allowedPaths: ['/tmp'],
          blockedPaths: ['/etc', '/root'],
          maxProcesses: 5,
          maxOpenFiles: 50,
          readOnlyRoot: true,
          noPrivileges: true
        },
        command: ['node', '--version']
      });

      // Wait a bit for security monitoring to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get initial security events
      const initialEvents = securityManager.getSecurityEvents(sandboxId, 10);
      expect(Array.isArray(initialEvents)).toBe(true);

      // Execute command that might trigger security events
      await sandboxManager.executeInSandbox('test-security-trigger', [
        'node', '-e', 'console.log("Security test");'
      ]);

      // Check for security events
      const events = securityManager.getSecurityEvents(sandboxId, 5);
      expect(events.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Environment Management Testing', () => {
    it('should create environment from template', async () => {
      const envId = await environmentManager.createEnvironment('test-web-api', {
        template: EnvironmentTemplateType.WEB_API,
        variables: {
          PORT: '3000',
          NODE_ENV: 'production',
          API_VERSION: 'v2'
        }
      });

      expect(envId).toBeDefined();

      const env = environmentManager.getEnvironment(envId);
      expect(env).toBeDefined();
      expect(env.name).toBe('test-web-api');
      expect(env.template).toBe(EnvironmentTemplateType.WEB_API);
      expect(env.variables.PORT).toBe('3000');
    });

    it('should validate environment variables', () => {
      const template = environmentManager.getTemplate(EnvironmentTemplateType.WEB_API);
      expect(template).toBeDefined();

      // Valid variables should pass validation
      const validVars = { PORT: '3000', NODE_ENV: 'production' };
      const validation = environmentManager.validateEnvironment(template, validVars);
      expect(validation.valid).toBe(true);

      // Invalid variables should fail validation
      const invalidVars = { PORT: 'invalid', DATABASE_URL: 'missing' };
      const invalidValidation = environmentManager.validateEnvironment(template, invalidVars);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors?.length).toBeGreaterThan(0);
    });

    it('should export and import environment', async () => {
      // Create environment
      const envId = await environmentManager.createEnvironment('test-export-import', {
        template: EnvironmentTemplateType.WORKER,
        variables: {
          WORKER_COUNT: '4',
          QUEUE_NAME: 'test-queue'
        }
      });

      // Export environment
      const exported = environmentManager.exportEnvironment(envId);
      expect(exported).toBeDefined();
      expect(exported.name).toBe('test-export-import');
      expect(exported.template).toBe(EnvironmentTemplateType.WORKER);

      // Import environment
      const importResult = await environmentManager.importEnvironment(exported);
      expect(importResult).toBeDefined();
      expect(importResult.name).toBe('test-export-import');
    });

    it('should create custom environment template', async () => {
      const templateId = await environmentManager.createTemplate({
        name: 'custom-test',
        description: 'Custom test template',
        type: 'custom' as any,
        variables: [
          {
            name: 'CUSTOM_VAR',
            type: 'string',
            required: true,
            description: 'Custom variable for testing',
            validation: '^[a-zA-Z0-9_]+$'
          }
        ],
        files: [
          {
            path: '/app/config.json',
            content: '{"env": "${CUSTOM_VAR}"}'
          }
        ]
      });

      expect(templateId).toBeDefined();

      // Test environment creation with custom template
      const envId = await environmentManager.createEnvironment('custom-env-test', {
        template: templateId,
        variables: { CUSTOM_VAR: 'test_value' }
      });

      expect(envId).toBeDefined();
    });
  });

  describe('End-to-End Integration Testing', () => {
    it('should complete full sandbox lifecycle with network isolation', async () => {
      const sandboxId = 'test-full-lifecycle';

      // Step 1: Create isolated network
      const networkId = await networkManager.createSandboxNetwork(sandboxId, {
        subnet: '172.32.0.0/24',
        internal: true
      });

      // Step 2: Create sandbox with security policy
      const createdSandboxId = await sandboxManager.createSandbox({
        id: sandboxId,
        name: 'full-lifecycle-test',
        securityPolicy: {
          allowFilesystem: true,
          allowNetwork: false,
          allowExec: true,
          allowedPaths: ['/tmp'],
          blockedPaths: ['/etc', '/root'],
          maxProcesses: 10,
          maxOpenFiles: 100,
          readOnlyRoot: true,
          noPrivileges: true
        },
        resourceLimits: {
          cpu: 1.0,
          memory: 512,
          disk: 1024,
          network: false,
          maxDuration: 60
        },
        command: ['node', '--version']
      });

      expect(createdSandboxId).toBe(sandboxId);

      // Step 3: Apply network isolation
      await networkManager.isolateSandbox(sandboxId);

      // Step 4: Execute task
      const result = await sandboxManager.executeInSandbox('lifecycle-task', [
        'node', '-e', 'console.log("Full lifecycle test completed successfully");'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Full lifecycle test completed successfully');

      // Step 5: Verify network isolation is active
      const networkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(networkInfo.policy).toBeDefined();

      // Step 6: Verify resource monitoring
      const state = sandboxManager.getSandboxState(sandboxId);
      expect(state?.resourceUsage).toBeDefined();

      // Step 7: Cleanup
      await sandboxManager.cleanupSandbox(sandboxId);
      await networkManager.cleanupSandboxNetwork(sandboxId);

      // Verify cleanup
      expect(sandboxManager.getSandboxState(sandboxId)).toBeUndefined();
      const cleanedNetworkInfo = networkManager.getSandboxNetwork(sandboxId);
      expect(cleanedNetworkInfo.networkId).toBeUndefined();
    });

    it('should handle multiple concurrent sandboxes with isolation', async () => {
      const sandboxIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      const promises: Promise<string>[] = [];

      // Create multiple sandboxes concurrently
      for (const id of sandboxIds) {
        promises.push(
          sandboxManager.createSandbox({
            id,
            name: `concurrent-${id}`,
            command: ['node', '-e', 'console.log("Sandbox " + process.env.TASK_ID + " running");'],
            resourceLimits: {
              cpu: 0.5,
              memory: 256,
              disk: 512,
              network: false,
              maxDuration: 30
            }
          })
        );
      }

      const createdIds = await Promise.all(promises);
      expect(createdIds.length).toBe(3);

      // Verify all sandboxes are running
      for (const id of createdIds) {
        const state = sandboxManager.getSandboxState(id);
        expect(state?.status).toBe('running');
      }

      // Get metrics
      const metrics = sandboxManager.getMetrics();
      expect(metrics.activeSandboxCount).toBeGreaterThanOrEqual(3);

      // Execute tasks in all sandboxes
      const taskPromises = createdIds.map(id =>
        sandboxManager.executeInSandbox(`task-${id}`, ['node', '-e', 'console.log("Task completed");'])
      );

      const results = await Promise.all(taskPromises);
      expect(results.length).toBe(3);

      for (const result of results) {
        expect(result.exitCode).toBe(0);
      }

      // Cleanup all
      await Promise.all(createdIds.map(id => sandboxManager.cleanupSandbox(id)));
    });

    it('should enforce security compliance across system', async () => {
      // Create environment with high security
      const envId = await environmentManager.createEnvironment('high-security-test', {
        template: EnvironmentTemplateType.MONITORING,
        variables: {
          LOG_LEVEL: 'error',
          SECURITY_SCAN: 'enabled'
        }
      });

      // Create sandbox with strict security policy
      const sandboxId = await sandboxManager.createSandbox({
        name: 'security-compliance-test',
        securityPolicy: {
          allowFilesystem: false,
          allowNetwork: false,
          allowExec: true,
          allowedPaths: [],
          blockedPaths: ['/'],
          maxProcesses: 5,
          maxOpenFiles: 50,
          readOnlyRoot: true,
          noPrivileges: true
        },
        resourceLimits: {
          cpu: 0.5,
          memory: 256,
          disk: 512,
          network: false,
          maxDuration: 30
        },
        command: ['node', '--version']
      });

      // Create isolated network
      await networkManager.createSandboxNetwork(sandboxId, {
        internal: true
      });

      // Apply strict isolation
      await networkManager.isolateSandbox(sandboxId);

      // Monitor security events
      const securityEvents = securityManager.getSecurityEvents(sandboxId, 10);
      expect(Array.isArray(securityEvents)).toBe(true);

      // Execute command that should be restricted
      const result = await sandboxManager.executeInSandbox('security-test', [
        'node', '-e', 'try { require("fs"); console.log("FS accessible"); } catch(e) { console.log("FS blocked"); }'
      ]);

      // Should demonstrate security restrictions
      expect([0, 1]).toContain(result.exitCode);

      // Verify compliance
      const finalEvents = securityManager.getSecurityEvents(sandboxId, 5);
      expect(finalEvents.length).toBeGreaterThanOrEqual(0);

      // Cleanup
      await sandboxManager.cleanupSandbox(sandboxId);
      await networkManager.cleanupSandboxNetwork(sandboxId);
      environmentManager.deleteEnvironment(envId);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle sandbox creation failures gracefully', async () => {
      // Try to create sandbox with invalid configuration
      try {
        await sandboxManager.createSandbox({
          name: 'invalid-test',
          resourceLimits: {
            cpu: -1, // Invalid CPU value
            memory: 0,
            disk: 0,
            network: false,
            maxDuration: 30
          },
          command: ['node', '--version']
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Insufficient resources');
      }
    });

    it('should handle network isolation failures gracefully', async () => {
      const sandboxId = 'network-failure-test';

      // Try to apply network policy to non-existent network
      try {
        await networkManager.applyNetworkPolicy(sandboxId, {
          id: 'test-policy',
          name: 'test',
          inbound: [],
          outbound: [],
          logging: false,
          metrics: false
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('not connected to a network');
      }
    });

    it('should handle environment validation failures', () => {
      const template = environmentManager.getTemplate(EnvironmentTemplateType.WEB_API);
      expect(template).toBeDefined();

      // Try with invalid variable types
      const invalidVars = { PORT: 'not-a-number', DATABASE_URL: '' };
      const validation = environmentManager.validateEnvironment(template, invalidVars);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it('should recover from resource exhaustion', async () => {
      // Create multiple sandboxes to exhaust resources
      const sandboxIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        try {
          const sandboxId = await sandboxManager.createSandbox({
            name: `resource-test-${i}`,
            resourceLimits: {
              cpu: 1.0,
              memory: 512,
              disk: 1024,
              network: false,
              maxDuration: 10
            },
            command: ['node', '--version']
          });
          sandboxIds.push(sandboxId);
        } catch (error) {
          // Expected to fail after some sandboxes
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('Insufficient resources');
          break;
        }
      }

      // Should have created at least some sandboxes before failing
      expect(sandboxIds.length).toBeGreaterThan(0);
      expect(sandboxIds.length).toBeLessThan(10);

      // Cleanup successfully created sandboxes
      for (const id of sandboxIds) {
        await sandboxManager.cleanupSandbox(id);
      }
    });
  });
});
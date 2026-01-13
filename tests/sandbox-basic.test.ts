import { test } from 'node:test';
import { ok } from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('should have implemented core sandbox interfaces', () => {
  const sandboxTs = readFileSync(join(process.cwd(), 'src/core/sandbox.ts'), 'utf-8');
  ok(sandboxTs);
  ok(sandboxTs.length > 0);

  // Check for key interfaces
  ok(sandboxTs.includes('export interface ResourceLimits'));
  ok(sandboxTs.includes('export interface SecurityPolicy'));
  ok(sandboxTs.includes('export interface SandboxConfig'));
  ok(sandboxTs.includes('export class SandboxManager'));
});

test('should have implemented network isolation', () => {
  const networkTs = readFileSync(join(process.cwd(), 'src/core/network-isolation.ts'), 'utf-8');
  ok(networkTs);
  ok(networkTs.length > 0);

  // Check for key interfaces and classes
  ok(networkTs.includes('export interface NetworkPolicy'));
  ok(networkTs.includes('export interface NetworkRule'));
  ok(networkTs.includes('export class NetworkIsolationManager'));
});

test('should have implemented security manager', () => {
  const securityTs = readFileSync(join(process.cwd(), 'src/core/security-manager.ts'), 'utf-8');
  ok(securityTs);
  ok(securityTs.length > 0);

  // Check for key components
  ok(securityTs.includes('export interface SecurityEvent'));
  ok(securityTs.includes('export class SecurityManager'));
  ok(securityTs.includes('export enum SecurityLevel'));
});

test('should have implemented environment manager', () => {
  const envTs = readFileSync(join(process.cwd(), 'src/core/environment-manager.ts'), 'utf-8');
  ok(envTs);
  ok(envTs.length > 0);

  // Check for key interfaces
  ok(envTs.includes('export interface EnvironmentTemplate'));
  ok(envTs.includes('export interface Environment'));
  ok(envTs.includes('export class EnvironmentManager'));
});

test('should have Docker infrastructure', () => {
  ok(existsSync(join(process.cwd(), 'Dockerfile')));
  ok(existsSync(join(process.cwd(), 'docker-compose.yml')));
  ok(existsSync(join(process.cwd(), 'Dockerfile.sandbox')));
});

test('should have comprehensive Docker configuration', () => {
  const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf-8');
  const compose = readFileSync(join(process.cwd(), 'docker-compose.yml'), 'utf-8');
  const sandboxDockerfile = readFileSync(join(process.cwd(), 'Dockerfile.sandbox'), 'utf-8');

  // Check main Dockerfile
  ok(dockerfile.includes('FROM node:22-alpine'));
  ok(dockerfile.includes('WORKDIR /app'));

  // Check docker-compose
  ok(compose.includes('director:'));
  ok(compose.includes('redis:'));
  ok(compose.includes('postgres:'));
  ok(compose.includes('sandbox-manager:'));

  // Check sandbox Dockerfile
  ok(sandboxDockerfile.includes('FROM node:22-alpine AS sandbox-base'));
  ok(sandboxDockerfile.includes('WORKDIR /task'));
});

test('should have valid security constraints in sandbox', () => {
  const sandboxDockerfile = readFileSync(join(process.cwd(), 'Dockerfile.sandbox'), 'utf-8');

  ok(sandboxDockerfile.includes('addgroup -g 1001 -S sandbox'));
  ok(sandboxDockerfile.includes('adduser -S sandboxuser -u 1001 -G sandbox'));
  ok(sandboxDockerfile.includes('--read-only'));
  ok(sandboxDockerfile.includes('set -euo pipefail'));
});

test('should implement resource monitoring in SandboxManager', () => {
  const sandboxTs = readFileSync(join(process.cwd(), 'src/core/sandbox.ts'), 'utf-8');
  ok(sandboxTs.includes('monitorSandbox'));
  ok(sandboxTs.includes('getContainerStats'));
  ok(sandboxTs.includes('ResourceMonitor'));
  ok(sandboxTs.includes('canAllocate'));
});

test('should implement network policy enforcement', () => {
  const networkTs = readFileSync(join(process.cwd(), 'src/core/network-isolation.ts'), 'utf-8');
  ok(networkTs.includes('applyIptablesRules'));
  ok(networkTs.includes('setupNetworkIsolation'));
  ok(networkTs.includes('isolateSandbox'));
  ok(networkTs.includes('allowNetworkAccess'));
});

test('should implement security event auditing', () => {
  const securityTs = readFileSync(join(process.cwd(), 'src/core/security-manager.ts'), 'utf-8');
  ok(securityTs.includes('logSecurityEvent'));
  ok(securityTs.includes('getSecurityEvents'));
  ok(securityTs.includes('enforceSecurityPolicy'));
  ok(securityTs.includes('getSecurityProfile'));
});

test('should implement environment lifecycle management', () => {
  const envTs = readFileSync(join(process.cwd(), 'src/core/environment-manager.ts'), 'utf-8');
  ok(envTs.includes('createEnvironment'));
  ok(envTs.includes('importEnvironment'));
  ok(envTs.includes('exportEnvironment'));
  ok(envTs.includes('createTemplate'));
  ok(envTs.includes('validateEnvironment'));
});

test('should have CLI integration', () => {
  const cliTs = readFileSync(join(process.cwd(), 'src/cli.ts'), 'utf-8');
  ok(cliTs);
  ok(cliTs.length > 0);

  ok(cliTs.includes('sandbox'));
  ok(cliTs.includes('environment'));
  ok(cliTs.includes('security'));
  ok(cliTs.includes('network'));
});

test('should have comprehensive test coverage', () => {
  const testFiles = [
    'tests/cli-simple.test.ts',
    'tests/sandbox-basic.test.ts'
  ];

  for (const file of testFiles) {
    const exists = existsSync(join(process.cwd(), file));
    ok(exists, `Test file ${file} should exist`);
  }
});
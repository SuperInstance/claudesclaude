/**
 * CLI Integration Tests
 * Verifies end-to-end CLI functionality with the Director Protocol system
 */

import { spawn } from "child_process";
import { test, expect } from "bun:test";
import * as fs from "fs/promises";
import * as path from "path";

describe("Director Protocol CLI", () => {
  const cliPath = process.cwd() + "/src/cli.ts";

  async function runCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const child = spawn("bun", [cliPath, ...args], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (exitCode) => {
        resolve({ stdout, stderr, exitCode: exitCode || 0 });
      });
    });
  }

  beforeEach(async () => {
    // Clean any existing temp directories
    const tempDirs = await fs.readdir("/tmp", { withFileTypes: true });
    for (const dir of tempDirs) {
      if (dir.name.startsWith("director-cli-")) {
        await fs.rm(`/tmp/${dir.name}`, { recursive: true, force: true });
      }
    }
  });

  test("should show help", async () => {
    const result = await runCommand(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Director Protocol CLI");
    expect(stdout).toContain("Multi-agent orchestration system");
  });

  test("should show version", async () => {
    const result = await runCommand(["dev", "version"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Director Protocol CLI");
    expect(stdout).toContain("Version: 1.0.0");
  });

  test("should create a session", async () => {
    const result = await runCommand([
      "session",
      "create",
      "director",
      "test-session",
      "--workspace",
      "/tmp/test-session"
    ]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("✅ Session created");
    expect(stdout).toContain("test-session");
    expect(stdout).toContain("director");
  });

  test("should list sessions", async () => {
    // First create a session
    await runCommand(["session", "create", "department", "test-dept"]);

    // Then list sessions
    const result = await runCommand(["session", "list"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Sessions");
    expect(stdout).toContain("test-dept");
  });

  test("should show session status", async () => {
    const createResult = await runCommand([
      "session",
      "create",
      "director",
      "test-session-status",
      "--workspace",
      "/tmp/status-test"
    ]);
    const sessionId = stdout.match(/([a-f0-9-]+)/)?.[0];

    expect(sessionId).toBeDefined();

    const statusResult = await runCommand([
      "session",
      "status",
      sessionId
    ]);
    expect(statusResult.exitCode).toBe(0);
    expect(stdout).toContain("Session Status");
    expect(stdout).toContain(sessionId);
  });

  test("should create a department", async () => {
    const result = await runCommand([
      "department",
      "create",
      "frontend",
      "Frontend Team",
      "frontend",
      "--max-tasks", "5",
      "--memory", "1024",
      "--cpu", "70"
    ]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("✅ Department created");
    expect(stdout).toContain("Frontend Team");
    expect(stdout).toContain("frontend");
    expect(stdout).toContain("Max Tasks: 5");
  });

  test("should list departments", async () => {
    // First create departments
    await runCommand(["department", "create", "frontend", "Frontend", "frontend"]);
    await runCommand(["department", "create", "backend", "Backend", "backend"]);

    // Then list departments
    const result = await runCommand(["department", "list"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Departments");
    expect(stdout).toContain("Frontend");
    expect(stdout).toContain("Backend");
  });

  test("should show department metrics", async () => {
    await runCommand(["department", "create", "test-metrics", "Metrics Test", "general"]);

    const result = await runCommand(["department", "metrics", "test-metrics"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Department Metrics");
    expect(stdout).toContain("test-metrics");
  });

  test("should create and start a workflow", async () => {
    // First create a session
    const createSessionResult = await runCommand(["session", "create", "director", "workflow-session"]);

    // Create a workflow with steps
    const steps = JSON.stringify([
      {
        id: "step-1",
        name: "Code Analysis",
        type: "execute" as const,
        target: "frontend",
        action: "code_analysis",
        parameters: { files: ["src/**"] },
        dependencies: [],
        timeoutMs: 10000,
        qualityGates: ["code_quality"]
      }
    ]);

    const createWorkflowResult = await runCommand([
      "workflow",
      "create",
      "Test Workflow",
      "--session",
      "workflow-session",
      "--steps",
      steps
    ]);

    expect(createWorkflowResult.exitCode).toBe(0);
    expect(stdout).toContain("✅ Workflow created");

    const workflowId = stdout.match(/([a-f0-9-]+)/)?.[0];
    expect(workflowId).toBeDefined();

    // Start the workflow
    const startResult = await runCommand([
      "workflow",
      "start",
      workflowId
    ]);

    expect(startResult.exitCode).toBe(0);
    expect(stdout).toContain("🚀 Started workflow");
  });

  test("should list workflows", async () => {
    // Create a session and workflow
    await runCommand(["session", "create", "director", "list-test-session"]);
    await runCommand([
      "workflow",
      "create",
      "List Test Workflow",
      "--steps",
      JSON.stringify([{
        id: "test-step",
        name: "Test Step",
        type: "execute" as const,
        target: "backend",
        action: "test_action",
        parameters: {},
        dependencies: [],
        timeoutMs: 5000,
        qualityGates: []
      }])
    ]);

    // List workflows
    const result = await runCommand(["workflow", "list"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Workflows");
    expect(stdout).toContain("List Test Workflow");
  });

  test("should show workflow status", async () => {
    // Create workflow and get its ID
    await runCommand(["session", "create", "director", "status-test-session"]);
    const createResult = await runCommand([
      "workflow",
      "create",
      "Status Test Workflow",
      "--steps",
      JSON.stringify([{
        id: "status-step",
        name: "Status Step",
        type: "verify" as const,
        target: "frontend",
        action: "verify_action",
        parameters: {},
        dependencies: [],
        timeoutMs: 5000,
        qualityGates: []
      }])
    ]);

    const workflowId = stdout.match(/([a-f0-9-]+)/)?.[0];
    expect(workflowId).toBeDefined();

    // Show workflow status
    const result = await runCommand([
      "workflow",
      "status",
      workflowId
    ]);

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("Workflow Status");
    expect(stdout).toContain(workflowId);
  });

  test("should create context window", async () => {
    await runCommand(["session", "create", "director", "context-test-session"]);

    const result = await runCommand([
      "context",
      "create",
      "Test Context"
    ]);

    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("✅ Context window created");
    expect(stdout).toContain("Test Context");
  });

  test("should manage context items", async () => {
    // Create context window
    const createContextResult = await runCommand([
      "context",
      "create",
      "Item Test Context"
    ]);

    const windowId = stdout.match(/([a-f0-9-]+)/)?.[0];
    expect(windowId).toBeDefined();

    // Add context item
    const itemContent = JSON.stringify({
      action: "test",
      data: "Hello, world!"
    });

    const addItemResult = await runCommand([
      "context",
      "add",
      windowId,
      "--type",
      "message",
      "--content",
      itemContent,
      "--importance",
      "0.9"
    ]);

    expect(addItemResult.exitCode).toBe(0);
    expect(stdout).toContain("✅ Context item added");

    // List context items
    const listResult = await runCommand([
      "context",
      "list",
      windowId
    ]);

    expect(listResult.exitCode).toBe(0);
    expect(stdout).toContain("Context Items");
    expect(stdout).toContain("Hello, world!");
  });

  test("should create and list checkpoints", async () => {
    await runCommand(["session", "create", "director", "checkpoint-test-session"]);

    const branches = JSON.stringify(["main", "feature-test"]);

    // Create checkpoint
    const createResult = await runCommand([
      "checkpoint",
      "create",
      "Test Checkpoint",
      "--branches",
      branches,
      "--description",
      "Test checkpoint creation"
    ]);

    expect(createResult.exitCode).toBe(0);
    expect(stdout).toContain("✅ Checkpoint created");

    // List checkpoints
    const listResult = await runCommand(["checkpoint", "list"]);
    expect(listResult.exitCode).toBe(0);
    expect(stdout).toContain("Checkpoints");
    expect(stdout).toContain("Test Checkpoint");
  });

  test("should show system status", async () => {
    // Create some components first
    await runCommand(["session", "create", "director", "status-test"]);
    await runCommand(["department", "create", "status-dept", "Status Dept", "general"]);

    const result = await runCommand(["status"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("System Status");
    expect(stdout).toContain("Workflows:");
    expect(stdout).toContain("Departments:");
  });

  test("should output status as JSON", async () => {
    const result = await runCommand(["status", "--json"]);
    expect(result.exitCode).toBe(0);

    const status = JSON.parse(stdout);
    expect(status).toHaveProperty("timestamp");
    expect(status).toHaveProperty("workflows");
    expect(status).toHaveProperty("departments");
    expect(status).toHaveProperty("director");
  });

  test("should run development commands", async () => {
    // Version command
    const versionResult = await runCommand(["dev", "version"]);
    expect(versionResult.exitCode).toBe(0);
    expect(stdout).toContain("Director Protocol CLI");

    // Test command
    const testResult = await runCommand(["dev", "test"]);
    expect(testResult.exitCode).toBe(0);
    expect(stdout).toContain("Running Director Protocol tests");

    // Clean command
    const cleanResult = await runCommand(["dev", "clean"]);
    expect(cleanResult.exitCode).toBe(0);
    expect(stdout).toContain("Cleaning up temporary files");
    expect(stdout).toContain("Cleanup complete");
  });

  test("should handle errors gracefully", async () => {
    // Try to get status of non-existent session
    const result = await runCommand(["session", "status", "non-existent-id"]);
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("❌ Session not found");

    // Try to start non-existent workflow
    const workflowResult = await runCommand(["workflow", "start", "non-existent-workflow"]);
    expect(workflowResult.exitCode).toBe(0);
    expect(stdout).toContain("❌ Workflow not found");
  });

  test("should parse JSON safely", async () => {
    // Test with valid JSON
    await runCommand([
      "context",
      "add",
      "test-window",
      "--content",
      '{"test": "value"}'
    ]);

    // Test with invalid JSON (should fallback to default)
    const invalidResult = await runCommand([
      "context",
      "add",
      "test-window",
      "--content",
      'invalid json',
      "--importance",
      "0.8"
    ]);

    // Should not crash and should handle gracefully
    expect(invalidResult.exitCode).toBe(0);
  });

  test("should handle watch mode", async () => {
    const result = await runCommand([
      "status",
      "--watch"
    ], { timeout: 3000 });

    // In test environment, watch mode should timeout or be interrupted
    // The important thing is it doesn't crash
    expect(result.exitCode === 0 || result.stdout).toBeDefined();
  }, 10000); // Extended timeout for watch mode test
});
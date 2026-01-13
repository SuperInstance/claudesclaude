#!/usr/bin/env bun
import { program } from "commander";
import { createMessageBus } from "./core/message-bus";
import { createRegistry } from "./core/registry";
import { Director, DirectorConfig } from "./core/director";
import { Department, DepartmentConfig } from "./core/department";
import { ContextManager } from "./core/context";
import { CheckpointManager, CheckpointConfig } from "./core/checkpoint";
import { createGitManager } from "./utils/git";
import { MessageType, SessionType, SessionStatus, WorkflowStepType } from "./core/types";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";

// Set window title
function setWindowTitle(title: string) {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

// Global state management
let globalState: {
  messageBus: any;
  registry: any;
  gitManager: any;
  director: Director;
  departments: Map<string, Department>;
  contextManager: ContextManager;
  checkpointManager: CheckpointManager;
  tempDir: string;
} | null = null;

async function initializeGlobalState() {
  if (globalState) {
    return globalState;
  }

  const tempDir = `/tmp/director-cli-${Date.now()}`;
  await fs.mkdir(`${tempDir}/queue`, { recursive: true });
  await fs.mkdir(`${tempDir}/registry/sessions`, { recursive: true });
  await fs.mkdir(`${tempDir}/registry/departments`, { recursive: true });
  await fs.mkdir(`${tempDir}/registry/checkpoints`, { recursive: true });

  globalState = {
    tempDir,
    messageBus: createMessageBus({
      queuePath: `${tempDir}/queue`,
      maxQueueSize: 1000,
      gcIntervalMs: 60000
    }),
    registry: createRegistry({
      storageDir: `${tempDir}/registry`,
      autoSave: false
    }),
    gitManager: createGitManager({
      repoPath: process.cwd(),
      branchPrefix: 'director-cli'
    }),
    director: new Director({
      maxConcurrentSessions: 10,
      decisionTimeoutMs: 30000,
      qualityGateTimeoutMs: 15000,
      autoRetryFailedDecisions: true,
      enableRollbackOnFailure: true,
      checkpointInterval: 300000,
      maxRetries: 3
    }, globalState.messageBus, globalState.registry, globalState.gitManager),
    departments: new Map(),
    contextManager: new ContextManager(globalState.registry),
    checkpointManager: new CheckpointManager({
      maxCheckpoints: 20,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000,
      autoCheckpointInterval: 120000,
      compressionEnabled: false,
      encryptionEnabled: false,
      backupOnRemote: false
    }, globalState.registry, globalState.gitManager)
  };

  // Set up cleanup on exit
  process.on('exit', async () => {
    if (globalState) {
      await globalState.director.shutdown();
      await globalState.messageBus.shutdown();
      await globalState.registry.shutdown();
      await globalState.checkpointManager.shutdown();
      await globalState.contextManager.shutdown();
    }
  });

  return globalState;
}

// Helper function to create department
async function createDepartment(config: DepartmentConfig): Promise<Department> {
  const state = await initializeGlobalState();
  const department = new Department(config, state.messageBus, state.registry);
  state.departments.set(config.id, department);
  return department;
}

// Helper function to parse JSON safely
function parseJSONSafely(jsonString: string, fallback: any = {}) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

// Director CLI main program
program
  .name("director")
  .description("Director Protocol CLI - Multi-agent orchestration system")
  .version("1.0.0");

// Session Management Commands
program
  .command("session")
  .description("Session management operations")
  .addCommand(
    program
      .command("create <type> <name>")
      .description("Create a new session")
      .option("--workspace <path>", "Workspace path", "/tmp/director-session")
      .option("--config <json>", "Session configuration (JSON)")
      .action(async (type: string, name: string, options) => {
        const state = await initializeGlobalState();
        const config = parseJSONSafely(options.config, {});

        const session = {
          type: type as SessionType,
          name,
          workspace: options.workspace,
          config,
          status: SessionType.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await state.registry.registerSession(session);
        console.log(`✅ Session created: ${session.id} (${name})`);
        console.log(`   Type: ${type}`);
        console.log(`   Workspace: ${options.workspace}`);
      })
  )
  .addCommand(
    program
      .command("list")
      .description("List all sessions")
      .option("--type <type>", "Filter by session type")
      .option("--status <status>", "Filter by session status")
      .action(async (options) => {
        const state = await initializeGlobalState();
        const sessions = await state.registry.getAllSessions();

        const filtered = sessions.filter(s => {
          if (options.type && s.type !== options.type) return false;
          if (options.status && s.status !== options.status) return false;
          return true;
        });

        if (filtered.length === 0) {
          console.log("No sessions found.");
          return;
        }

        console.log(`\n📋 Sessions (${filtered.length} total):`);
        console.log("─".repeat(80));
        filtered.forEach(session => {
          console.log(`🔹 ${session.id}`);
          console.log(`   Name: ${session.name}`);
          console.log(`   Type: ${session.type}`);
          console.log(`   Status: ${session.status}`);
          console.log(`   Workspace: ${session.workspace}`);
          console.log(`   Created: ${session.createdAt.toLocaleString()}`);
          console.log("─".repeat(80));
        });
      })
  )
  .addCommand(
    program
      .command("status <id>")
      .description("Get session status")
      .action(async (id: string) => {
        const state = await initializeGlobalState();
        const session = await state.registry.getSession(id);

        if (!session) {
          console.log(`❌ Session not found: ${id}`);
          return;
        }

        console.log(`\n📊 Session Status: ${session.id}`);
        console.log("─".repeat(50));
        console.log(`Name: ${session.name}`);
        console.log(`Type: ${session.type}`);
        console.log(`Status: ${session.status}`);
        console.log(`Workspace: ${session.workspace}`);
        console.log(`Created: ${session.createdAt.toLocaleString()}`);
        console.log(`Last Updated: ${session.updatedAt.toLocaleString()}`);

        if (session.config) {
          console.log(`\nConfiguration:`);
          console.log(JSON.stringify(session.config, null, 2));
        }
      })
  );

// Department Management Commands
program
  .command("department")
  .description("Department management operations")
  .addCommand(
    program
      .command("create <id> <name> <domain>")
      .description("Create a new department")
      .option("--max-tasks <number>", "Max concurrent tasks", "3")
      .option("--timeout <ms>", "Task timeout in ms", "15000")
      .option("--memory <mb>", "Memory limit in MB", "512")
      .option("--cpu <percent>", "CPU limit in percent", "50")
      .option("--capabilities <json>", "Department capabilities (JSON)")
      .action(async (id: string, name: string, domain: string, options) => {
        const state = await initializeGlobalState();
        const config: DepartmentConfig = {
          id,
          name,
          domain,
          maxConcurrentTasks: parseInt(options.maxTasks),
          taskTimeoutMs: parseInt(options.timeout),
          enableAutoScaling: false,
          resourceLimits: {
            memory: parseInt(options.memory),
            cpu: parseInt(options.cpu),
            disk: 10
          },
          capabilities: parseJSONSafely(options.capabilities, ['general']),
          constraints: []
        };

        await createDepartment(config);
        console.log(`✅ Department created: ${name} (${id})`);
        console.log(`   Domain: ${domain}`);
        console.log(`   Max Tasks: ${config.maxConcurrentTasks}`);
        console.log(`   Memory: ${config.resourceLimits.memory}MB`);
      })
  )
  .addCommand(
    program
      .command("list")
      .description("List all departments")
      .action(async () => {
        const state = await initializeGlobalState();
        const departments = Array.from(state.departments.values());

        if (departments.length === 0) {
          console.log("No departments found.");
          return;
        }

        console.log(`\n🏢 Departments (${departments.length} total):`);
        console.log("─".repeat(80));
        departments.forEach(dept => {
          const config = dept.getDepartmentConfig();
          console.log(`🔹 ${config.name} (${config.id})`);
          console.log(`   Domain: ${config.domain}`);
          console.log(`   Tasks: ${dept.getActiveTasks().length} active`);
          console.log(`   Queue: ${dept.getTaskQueue().length} waiting`);
          console.log(`   Memory: ${config.resourceLimits.memory}MB`);
          console.log("─".repeat(80));
        });
      })
  )
  .addCommand(
    program
      .command("metrics <id>")
      .description("Get department metrics")
      .action(async (id: string) => {
        const state = await initializeGlobalState();
        const department = state.departments.get(id);

        if (!department) {
          console.log(`❌ Department not found: ${id}`);
          return;
        }

        const metrics = department.getDepartmentMetrics();
        console.log(`\n📊 Department Metrics: ${id}`);
        console.log("─".repeat(50));
        console.log(`Active Tasks: ${metrics.activeTasks}`);
        console.log(`Completed Tasks: ${metrics.totalTasks}`);
        console.log(`Failed Tasks: ${metrics.failedTasks}`);
        console.log(`Success Rate: ${metrics.successRate}%`);
        console.log(`Avg Processing Time: ${metrics.avgProcessingTime}ms`);
        console.log(`Queue Size: ${metrics.queueSize}`);
        console.log(`Memory Usage: ${metrics.memoryUsage}MB`);
      })
  );

// Workflow Management Commands
program
  .command("workflow")
  .description("Workflow execution and monitoring")
  .addCommand(
    program
      .command("create <name>")
      .description("Create a new workflow")
      .option("--session <id>", "Session ID", "default-session")
      .option("--steps <json>", "Workflow steps (JSON)")
      .option("--description <text>", "Workflow description")
      .action(async (name: string, options) => {
        const state = await initializeGlobalState();
        const steps = parseJSONSafely(options.steps, []);

        const workflow = {
          name,
          sessionId: options.session,
          description: options.description,
          steps,
          metadata: {}
        };

        const workflowId = await state.director.createWorkflow(workflow);
        console.log(`✅ Workflow created: ${name}`);
        console.log(`   ID: ${workflowId}`);
        console.log(`   Session: ${options.session}`);
        console.log(`   Steps: ${steps.length}`);
      })
  )
  .addCommand(
    program
      .command("start <id>")
      .description("Start a workflow")
      .action(async (id: string) => {
        const state = await initializeGlobalState();
        const workflow = state.director.getWorkflow(id);

        if (!workflow) {
          console.log(`❌ Workflow not found: ${id}`);
          return;
        }

        await state.director.startWorkflow(id);
        console.log(`🚀 Started workflow: ${workflow.name} (${id})`);

        // Monitor progress
        const interval = setInterval(async () => {
          const status = state.director.getWorkflow(id);
          if (status) {
            console.log(`📈 Progress: Step ${status.currentStep}/${status.steps.length} - ${status.status}`);
            if (status.status === 'completed') {
              clearInterval(interval);
              console.log(`✅ Workflow completed: ${id}`);
            }
          }
        }, 2000);
      })
  )
  .addCommand(
    program
      .command("status <id>")
      .description("Get workflow status")
      .action(async (id: string) => {
        const state = await initializeGlobalState();
        const workflow = state.director.getWorkflow(id);

        if (!workflow) {
          console.log(`❌ Workflow not found: ${id}`);
          return;
        }

        console.log(`\n📊 Workflow Status: ${workflow.name}`);
        console.log("─".repeat(50));
        console.log(`ID: ${workflow.id}`);
        console.log(`Status: ${workflow.status}`);
        console.log(`Current Step: ${workflow.currentStep}/${workflow.steps.length}`);
        console.log(`Session: ${workflow.sessionId}`);
        console.log(`Created: ${workflow.createdAt.toLocaleString()}`);

        if (workflow.description) {
          console.log(`Description: ${workflow.description}`);
        }

        // Show current step details
        if (workflow.currentStep > 0 && workflow.currentStep <= workflow.steps.length) {
          const currentStep = workflow.steps[workflow.currentStep - 1];
          console.log(`\nCurrent Step: ${currentStep.name}`);
          console.log(`Type: ${currentStep.type}`);
          console.log(`Target: ${currentStep.target}`);
          console.log(`Action: ${currentStep.action}`);
        }
      })
  )
  .addCommand(
    program
      .command("list")
      .description("List all workflows")
      .option("--session <id>", "Filter by session")
      .action(async (options) => {
        const state = await initializeGlobalState();
        const workflows = state.director.getAllWorkflows();

        const filtered = options.session
          ? workflows.filter(w => w.sessionId === options.session)
          : workflows;

        if (filtered.length === 0) {
          console.log("No workflows found.");
          return;
        }

        console.log(`\n🔄 Workflows (${filtered.length} total):`);
        console.log("─".repeat(80));
        filtered.forEach(workflow => {
          console.log(`🔹 ${workflow.name}`);
          console.log(`   ID: ${workflow.id}`);
          console.log(`   Status: ${workflow.status}`);
          console.log(`   Steps: ${workflow.currentStep}/${workflow.steps.length}`);
          console.log(`   Session: ${workflow.sessionId}`);
          console.log("─".repeat(80));
        });
      })
  );

// Real-time Status Commands
program
  .command("status")
  .description("Show real-time system status")
  .option("--watch", "Watch mode - refresh every second")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const state = await initializeGlobalState();

    if (options.watch) {
      console.log("📊 Live Status Monitor (Press Ctrl+C to exit)\n");
      console.log("─".repeat(80));

      const renderStatus = async () => {
        const workflows = state.director.getAllWorkflows();
        const departments = Array.from(state.departments.values());

        console.clear();
        console.log("📊 Live Status Monitor");
        console.log("─".repeat(80));
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        console.log(`Director Sessions: ${workflows.length}`);
        console.log(`Active Departments: ${departments.length}`);
        console.log(`Total Steps: ${workflows.reduce((acc, w) => acc + w.steps.length, 0)}`);
        console.log("─".repeat(80));

        workflows.forEach(workflow => {
          const progress = workflow.steps.length > 0
            ? Math.round((workflow.currentStep / workflow.steps.length) * 100)
            : 0;
          console.log(`${workflow.name}: ${workflow.status} (${progress}%)`);
        });
      };

      renderStatus();
      const interval = setInterval(renderStatus, 1000);
      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });
    } else {
      const workflows = state.director.getAllWorkflows();
      const departments = Array.from(state.departments.values());

      if (options.json) {
        const status = {
          timestamp: new Date().toISOString(),
          workflows: workflows.length,
          departments: departments.length,
          director: {
            activeSessions: workflows.filter(w => w.status === 'active').length,
            totalSteps: workflows.reduce((acc, w) => acc + w.steps.length, 0)
          },
          departments: departments.map(dept => {
            const config = dept.getDepartmentConfig();
            return {
              id: config.id,
              name: config.name,
              activeTasks: dept.getActiveTasks().length,
              queueSize: dept.getTaskQueue().length
            };
          })
        };
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log("\n📊 System Status");
        console.log("─".repeat(50));
        console.log(`Timestamp: ${new Date().toLocaleString()}`);
        console.log(`Workflows: ${workflows.length}`);
        console.log(`Departments: ${departments.length}`);
        console.log(`Total Steps: ${workflows.reduce((acc, w) => acc + w.steps.length, 0)}`);

        const activeWorkflows = workflows.filter(w => w.status === 'active');
        if (activeWorkflows.length > 0) {
          console.log(`\nActive Workflows: ${activeWorkflows.length}`);
          activeWorkflows.forEach(workflow => {
            const progress = workflow.steps.length > 0
              ? Math.round((workflow.currentStep / workflow.steps.length) * 100)
              : 0;
            console.log(`  🔄 ${workflow.name}: ${progress}%`);
          });
        }
      }
    }
  });

// Context Management Commands
program
  .command("context")
  .description("Context management operations")
  .addCommand(
    program
      .command("create <name>")
      .description("Create a new context window")
      .option("--session <id>", "Session ID", "default-session")
      .action(async (name: string, options) => {
        const state = await initializeGlobalState();
        const contextWindowId = await state.contextManager.createContextWindow(
          options.session,
          name
        );
        console.log(`✅ Context window created: ${name}`);
        console.log(`   ID: ${contextWindowId}`);
        console.log(`   Session: ${options.session}`);
      })
  )
  .addCommand(
    program
      .command("add <window-id>")
      .description("Add item to context window")
      .option("--type <type>", "Item type", "message")
      .option("--content <json>", "Item content (JSON)")
      .option("--importance <number>", "Item importance (0-1)", "0.8")
      .action(async (windowId: string, options) => {
        const state = await initializeGlobalState();
        const content = parseJSONSafely(options.content, {});

        const contextItem = {
          type: options.type,
          content,
          metadata: {
            timestamp: new Date(),
            importance: parseFloat(options.importance),
            tags: []
          },
          confidence: 0.9,
          source: 'cli'
        };

        const itemId = await state.contextManager.addContextItem(windowId, contextItem);
        console.log(`✅ Context item added: ${itemId}`);
      })
  )
  .addCommand(
    program
      .command("list <window-id>")
      .description("List context items")
      .action(async (windowId: string) => {
        const state = await initializeGlobalState();
        const items = await state.contextManager.getContextItems({ windowId });

        if (items.length === 0) {
          console.log("No context items found.");
          return;
        }

        console.log(`\n📚 Context Items: ${windowId}`);
        console.log("─".repeat(80));
        items.forEach((item, index) => {
          console.log(`${index + 1}. ${item.type} - ${JSON.stringify(item.content).substring(0, 50)}...`);
          console.log(`   Importance: ${item.metadata.importance}`);
          console.log(`   Added: ${item.metadata.timestamp.toLocaleString()}`);
        });
      })
  );

// Checkpoint Management Commands
program
  .command("checkpoint")
  .description("Checkpoint management operations")
  .addCommand(
    program
      .command("create <name>")
      .description("Create a new checkpoint")
      .option("--session <id>", "Session ID", "default-session")
      .option("--branches <json>", "Branch names (JSON)")
      .option("--description <text>", "Checkpoint description")
      .action(async (name: string, options) => {
        const state = await initializeGlobalState();
        const branches = parseJSONSafely(options.branches, ['main']);

        const checkpointId = await state.checkpointManager.createCheckpoint({
          name,
          sessionId: options.session,
          branches,
          metadata: {
            description: options.description,
            created_by: 'cli'
          },
          createdBy: 'cli'
        });

        console.log(`✅ Checkpoint created: ${name}`);
        console.log(`   ID: ${checkpointId}`);
        console.log(`   Session: ${options.session}`);
        console.log(`   Branches: ${branches.join(', ')}`);
      })
  )
  .addCommand(
    program
      .command("list")
      .description("List all checkpoints")
      .option("--session <id>", "Filter by session")
      .action(async (options) => {
        const state = await initializeGlobalState();
        const checkpoints = await state.registry.getAllCheckpoints();

        const filtered = options.session
          ? checkpoints.filter(c => c.sessionId === options.session)
          : checkpoints;

        if (filtered.length === 0) {
          console.log("No checkpoints found.");
          return;
        }

        console.log(`\n💾 Checkpoints (${filtered.length} total):`);
        console.log("─".repeat(80));
        filtered.forEach(checkpoint => {
          console.log(`🔹 ${checkpoint.name}`);
          console.log(`   ID: ${checkpoint.id}`);
          console.log(`   Created: ${checkpoint.timestamp.toLocaleString()}`);
          console.log(`   Session: ${checkpoint.sessionId}`);
          console.log(`   Size: ${Math.round(checkpoint.size / 1024)}KB`);
          console.log("─".restore(80));
        });
      })
  )
  .addCommand(
    program
      .command("restore <id>")
      .description("Restore from checkpoint")
      .action(async (id: string) => {
        const state = await initializeGlobalState();
        const checkpoint = state.checkpointManager.getCheckpoint(id);

        if (!checkpoint) {
          console.log(`❌ Checkpoint not found: ${id}`);
          return;
        }

        const restoreOptions = {
          restoreType: 'full',
          includeSessions: [],
          excludeSessions: [],
          includeContext: true,
          includeGitState: true,
          includeSystemState: true,
          validationMode: 'strict' as const,
          backupCurrentState: true
        };

        const result = await state.checkpointManager.restoreCheckpoint(id, restoreOptions);

        if (result.success) {
          console.log(`✅ System restored from checkpoint: ${checkpoint.name}`);
          console.log(`   Restored sessions: ${result.restoredSessions.length}`);
          console.log(`   Restored context items: ${result.restoredContextItems.length}`);
        } else {
          console.log(`❌ Restoration failed: ${result.error}`);
        }
      })
  );

// Interactive Mode
program
  .command("interactive")
  .alias("shell")
  .description("Enter interactive CLI mode")
  .action(async () => {
    console.log("🚀 Director Protocol Interactive Shell");
    console.log("Type 'help' for available commands, 'exit' to quit\n");

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'director> '
    });

    rl.prompt();

    rl.on('line', async (input: string) => {
      const command = input.trim();

      if (command === 'exit' || command === 'quit') {
        rl.close();
        return;
      }

      if (command === 'help') {
        console.log(`
Available commands:
  help                - Show this help
  status              - Show system status
  workflow list       - List workflows
  workflow create     - Create new workflow
  department list     - List departments
  context list        - List context windows
  checkpoint list     - List checkpoints
  clear               - Clear screen
  exit/quit           - Exit shell
`);
        rl.prompt();
        return;
      }

      if (command === 'clear') {
        console.clear();
        rl.prompt();
        return;
      }

      if (command) {
        try {
          // Execute command
          const result = await Bun.$`bun ${program.name()} ${command}`.text();
          console.log(result);
        } catch (error) {
          console.error(`Error: ${error.message}`);
        }
      }

      rl.prompt();
    });

    rl.on('close', () => {
      console.log('👋 Goodbye!');
      process.exit(0);
    });
  });

// Development Commands
program
  .command("dev")
  .description("Development utilities")
  .addCommand(
    program
      .command("test")
      .description("Run all tests")
      .action(async () => {
        console.log("🧪 Running Director Protocol tests...");
        const result = await Bun.$`bun test`.text();
        console.log(result);
      })
  )
  .addCommand(
    program
      .command("clean")
      .description("Clean up temporary files")
      .action(async () => {
        console.log("🧹 Cleaning up temporary files...");
        const state = globalState;
        if (state) {
          await fs.rm(state.tempDir, { recursive: true, force: true });
          globalState = null;
        }
        console.log("✅ Cleanup complete");
      })
  )
  .addCommand(
    program
      .command("version")
      .description("Show version information")
      .action(async () => {
        console.log("📋 Director Protocol CLI");
        console.log("Version: 1.0.0");
        console.log("Built for multi-agent orchestration");
        console.log("Director Protocol Implementation");
      })
  );

program.parse();
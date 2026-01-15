#!/usr/bin/env node
import { program } from "commander";
import { createMessageBus } from "./core/message-bus.js";
import { createRegistry } from "./core/registry.js";
import { Director } from "./core/director.js";
import { ContextManager } from "./core/context.js";
import type { SessionType } from "./core/types.js";

// Global state
const registry = createRegistry();
let state = {
  messageBus: createMessageBus(),
  registry: registry,
  director: new Director({ maxConcurrentSessions: 10 }, registry),
  contextManager: new ContextManager()
};

program
  .name('claude-orchestration')
  .description('Claude Orchestration System CLI')
  .version('0.1.0');

program
  .command('start')
  .description('Start the orchestration system')
  .action(async () => {
    console.log('Orchestration system started');
    console.log('Message Bus:', state.messageBus.constructor.name);
    console.log('Registry:', state.registry.constructor.name);
    console.log('Director:', state.director.constructor.name);
    console.log('Context Manager:', state.contextManager.constructor.name);
  });

program
  .command('session')
  .description('Manage sessions')
  .argument('<action>', 'Action: create, list')
  .option('-t, --type <type>', 'Session type', 'development')
  .option('-n, --name <name>', 'Session name')
  .option('-w, --workspace <workspace>', 'Workspace path')
  .action(async (action, options) => {
    switch (action) {
      case 'create':
        if (!options.name || !options.workspace) {
          console.error('Name and workspace are required');
          process.exit(1);
        }

        const session = await state.director.createSession({
          type: options.type as SessionType,
          name: options.name,
          workspace: options.workspace,
          config: {}
        });

        console.log('Session created:', session.id);
        break;

      case 'list':
        const sessions = state.director.getAllSessions();
        console.log('Sessions:', sessions.length);
        sessions.forEach(s => console.log(`- ${s.id}: ${s.name} (${s.type})`));
        break;

      default:
        console.error('Unknown action:', action);
        process.exit(1);
    }
  });

program
  .command('context')
  .description('Manage context')
  .argument('<action>', 'Action: set, get, list')
  .option('-k, --key <key>', 'Context key')
  .option('-v, --value <value>', 'Context value (JSON)')
  .action(async (action, options) => {
    switch (action) {
      case 'set':
        if (!options.key || !options.value) {
          console.error('Key and value are required');
          process.exit(1);
        }

        try {
          const value = JSON.parse(options.value);
          state.contextManager.setContext(options.key, value);
          console.log('Context set:', options.key);
        } catch (e) {
          console.error('Invalid JSON value');
          process.exit(1);
        }
        break;

      case 'get':
        const context = state.contextManager.getContext(options.key || '');
        if (context) {
          console.log(JSON.stringify(context, null, 2));
        } else {
          console.log('Context not found');
        }
        break;

      case 'list':
        const contexts = state.contextManager.getAllContexts();
        console.log('Contexts:', contexts.length);
        contexts.forEach((c, i) => console.log(`${i}: ${JSON.stringify(c).substring(0, 50)}...`));
        break;

      default:
        console.error('Unknown action:', action);
        process.exit(1);
    }
  });

program.parse();
import { ultimateOrchestrator, hyperOrchestrator, microOrchestrator, ultraOrchestrator, orchestrator } from '../index.js';
function generateTestSession(type = 'agent', name = 'Test Session') {
    return {
        type: type,
        name,
        workspace: '/test',
        config: {}
    };
}
function generateTestMessage(id = 'msg-1') {
    return {
        id,
        type: 'text',
        content: 'Test message content',
        timestamp: new Date()
    };
}
function getMemoryUsage() {
    return process.memoryUsage ? process.memoryUsage().heapUsed : 0;
}
function benchmarkOperation(name, operation, iterations = 10000) {
    const memoryBefore = getMemoryUsage();
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
        operation();
    }
    const endTime = performance.now();
    const memoryAfter = getMemoryUsage();
    return {
        name,
        time: endTime - startTime,
        operations: iterations,
        opsPerSecond: (iterations / (endTime - startTime)) * 1000,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore
    };
}
export class PerformanceBenchmark {
    suites = [];
    benchmarkSessionCreation(orchestrator, iterations = 10000) {
        return benchmarkOperation('Session Creation', () => {
            orchestrator.createSession(generateTestSession());
        }, iterations);
    }
    benchmarkSessionRetrieval(orchestrator, iterations = 10000) {
        const sessions = [];
        for (let i = 0; i < iterations; i++) {
            const session = orchestrator.createSession(generateTestSession());
            sessions.push(session.id);
        }
        return benchmarkOperation('Session Retrieval', () => {
            const randomIndex = Math.floor(Math.random() * sessions.length);
            orchestrator.getSession(sessions[randomIndex]);
        }, iterations);
    }
    benchmarkMessageSending(orchestrator, iterations = 10000) {
        const session = orchestrator.createSession(generateTestSession());
        return benchmarkOperation('Message Sending', () => {
            orchestrator.sendMessage(session.id, generateTestMessage());
        }, iterations);
    }
    benchmarkContextManagement(orchestrator, iterations = 10000) {
        const session = orchestrator.createSession(generateTestSession());
        return benchmarkOperation('Context Management', () => {
            orchestrator.setContext(session.id, { data: `test-${iterations}` });
            orchestrator.getContext(session.id);
        }, iterations);
    }
    benchmarkQueryOperations(orchestrator, iterations = 1000) {
        for (let i = 0; i < 100; i++) {
            orchestrator.createSession(generateTestSession('agent', `Session ${i}`));
        }
        return benchmarkOperation('Query Operations', () => {
            orchestrator.getAllSessions();
            orchestrator.getSessionsByType('agent');
            orchestrator.getSessionsByStatus('active');
            orchestrator.getWorkspaceSessions('/test');
        }, iterations);
    }
    benchmarkMemoryUsage(orchestrator, iterations = 1000) {
        const memoryBefore = getMemoryUsage();
        for (let i = 0; i < iterations; i++) {
            const session = orchestrator.createSession(generateTestSession());
            orchestrator.sendMessage(session.id, generateTestMessage());
            orchestrator.setContext(session.id, { data: `memory-test-${i}` });
        }
        const memoryAfter = getMemoryUsage();
        return {
            name: 'Memory Usage',
            time: 0,
            operations: iterations,
            opsPerSecond: 0,
            memoryBefore,
            memoryAfter,
            memoryDelta: memoryAfter - memoryBefore
        };
    }
    async runFullBenchmark() {
        const orchestrators = [
            { name: 'Ultimate Orchestrator', instance: ultimateOrchestrator },
            { name: 'Hyper-Optimized Orchestrator', instance: hyperOrchestrator },
            { name: 'Micro Orchestrator', instance: microOrchestrator },
            { name: 'Ultra-Streamlined Orchestrator', instance: ultraOrchestrator },
            { name: 'Streamlined Orchestrator', instance: orchestrator }
        ];
        this.suites = [];
        for (const { name, instance } of orchestrators) {
            console.log(`\n🚀 Benchmarking ${name}...`);
            const suite = {
                name,
                results: []
            };
            suite.results.push(this.benchmarkSessionCreation(instance));
            suite.results.push(this.benchmarkSessionRetrieval(instance));
            suite.results.push(this.benchmarkMessageSending(instance));
            suite.results.push(this.benchmarkContextManagement(instance));
            suite.results.push(this.benchmarkQueryOperations(instance));
            suite.results.push(this.benchmarkMemoryUsage(instance));
            this.suites.push(suite);
            instance.clearAll();
        }
        return this.suites;
    }
    generateReport() {
        let report = '🔥 Performance Benchmark Results\n';
        report += '='.repeat(60) + '\n\n';
        const summary = this.suites.map(suite => {
            const avgOps = suite.results
                .filter(r => r.opsPerSecond > 0)
                .reduce((sum, r) => sum + r.opsPerSecond, 0) / suite.results.filter(r => r.opsPerSecond > 0).length;
            const totalMemory = suite.results
                .reduce((sum, r) => sum + r.memoryDelta, 0);
            return {
                name: suite.name,
                avgOps: Math.round(avgOps),
                totalMemory: Math.round(totalMemory),
                score: Math.round(avgOps / (totalMemory || 1))
            };
        });
        report += '📊 Performance Rankings:\n';
        summary.sort((a, b) => b.score - a.score).forEach((item, index) => {
            report += `${index + 1}. ${item.name}: ${item.avgOps.toLocaleString()} ops/sec, ${item.totalMemory} bytes, Score: ${item.score}\n`;
        });
        this.suites.forEach(suite => {
            report += `\n📈 ${suite.name} Detailed Results:\n`;
            report += '-'.repeat(40) + '\n';
            suite.results.forEach(result => {
                const opsStr = result.opsPerSecond > 0
                    ? `${Math.round(result.opsPerSecond).toLocaleString()} ops/sec`
                    : 'N/A';
                report += `${result.name.padEnd(20)}: ${result.time.toFixed(2)}ms, ${opsStr}, ${result.memoryDelta} bytes\n`;
            });
        });
        return report;
    }
    exportResults() {
        return JSON.stringify(this.suites, null, 2);
    }
}
export async function quickBenchmark() {
    const benchmark = new PerformanceBenchmark();
    await benchmark.runFullBenchmark();
    console.log(benchmark.generateReport());
}
if (import.meta.url === `file://${process.argv[1]}`) {
    quickBenchmark().catch(console.error);
}
//# sourceMappingURL=performance-benchmark.js.map
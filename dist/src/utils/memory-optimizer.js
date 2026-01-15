function estimateSessionMemory(session) {
    return (64 +
        session.name.length * 2 +
        session.workspace.length * 2 +
        JSON.stringify(session.config).length +
        32);
}
function estimateMessageMemory(message) {
    return (48 +
        message.content.length * 2 +
        (message.metadata ? JSON.stringify(message.metadata).length : 0) +
        24);
}
export class MemoryOptimizer {
    strategies = [
        {
            name: 'Session Pruning',
            description: 'Remove inactive sessions older than TTL',
            apply: (orchestrator) => {
                const sessions = orchestrator.getAllSessions();
                const now = Date.now();
                const maxAge = 24 * 60 * 60 * 1000;
                sessions.forEach(session => {
                    if (now - session.createdAt.getTime() > maxAge && session.status === 'inactive') {
                        orchestrator.deleteSession(session.id);
                    }
                });
            },
            benefit: 'Removes stale sessions that are no longer needed'
        },
        {
            name: 'Message Buffer Optimization',
            description: 'Compact message buffer periodically',
            apply: (orchestrator) => {
                const processed = orchestrator.processMessages();
                if (processed > 0) {
                    console.log(`Optimized: Processed ${processed} messages`);
                }
            },
            benefit: 'Reduces memory usage from accumulated messages'
        },
        {
            name: 'Context Compression',
            description: 'Clear unused contexts',
            apply: (orchestrator) => {
                const sessions = orchestrator.getAllSessions();
                sessions.forEach(session => {
                    const context = orchestrator.getContext(session.id);
                    if (context && !context.lastUsed) {
                        orchestrator.setContext(session.id, null);
                    }
                });
            },
            benefit: 'Frees up memory from unused context data'
        },
        {
            name: 'Cache Optimization',
            description: 'Adjust cache sizes based on usage patterns',
            apply: (orchestrator) => {
                const metrics = orchestrator.getMetrics();
                const utilization = metrics.activeSessions / 1000;
                if (utilization < 0.3 && metrics.activeSessions < 300) {
                    console.log(`Recommendation: Consider reducing session cache size to ${Math.round(1000 * utilization)}`);
                }
            },
            benefit: 'Optimizes memory usage based on actual load'
        }
    ];
    calculateMemoryStats(orchestrator) {
        const sessions = orchestrator.getAllSessions();
        const messages = orchestrator.getMetrics().pendingMessages;
        const contexts = orchestrator.getMetrics().cachedContexts;
        let estimatedMemoryUsage = 0;
        sessions.forEach(session => {
            estimatedMemoryUsage += estimateSessionMemory(session);
        });
        estimatedMemoryUsage += messages * 100;
        estimatedMemoryUsage += contexts * 50;
        const overhead = estimatedMemoryUsage * 0.2;
        return {
            totalSessions: sessions.length,
            totalMessages: messages,
            totalContexts: contexts,
            estimatedMemoryUsage: Math.round(estimatedMemoryUsage),
            overhead: Math.round(overhead)
        };
    }
    optimizeMemory(orchestrator) {
        console.log('🧹 Applying memory optimization strategies...');
        this.strategies.forEach(strategy => {
            try {
                strategy.apply(orchestrator);
                console.log(`✅ Applied: ${strategy.name} - ${strategy.benefit}`);
            }
            catch (error) {
                console.warn(`⚠️  Failed to apply ${strategy.name}:`, error);
            }
        });
        const finalStats = this.calculateMemoryStats(orchestrator);
        console.log(`📊 Final memory usage: ${finalStats.estimatedMemoryUsage + finalStats.overhead} bytes`);
    }
    getRecommendations(orchestrator) {
        const recommendations = [];
        const stats = this.calculateMemoryStats(orchestrator);
        const metrics = orchestrator.getMetrics();
        if (stats.estimatedMemoryUsage > 10 * 1024 * 1024) {
            recommendations.push('Consider implementing session expiration to reduce memory usage');
        }
        if (metrics.activeSessions < 100 && metrics.cachedContexts < 50) {
            recommendations.push('Consider reducing cache sizes for better memory efficiency');
        }
        if (metrics.pendingMessages > 1000) {
            recommendations.push('Message buffer is growing, consider increasing processing frequency');
        }
        const health = orchestrator.healthCheck();
        if (health.status === 'degraded') {
            recommendations.push('System is degraded, consider scaling or reducing load');
        }
        return recommendations;
    }
    generateMemoryReport(orchestrator) {
        const stats = this.calculateMemoryStats(orchestrator);
        const metrics = orchestrator.getMetrics();
        const recommendations = this.getRecommendations(orchestrator);
        let report = '🧠 Memory Optimization Report\n';
        report += '='.repeat(50) + '\n\n';
        report += '📊 Memory Statistics:\n';
        report += `  Sessions: ${stats.totalSessions}\n`;
        report += `  Messages: ${stats.totalMessages}\n`;
        report += `  Contexts: ${stats.totalContexts}\n`;
        report += `  Estimated Usage: ${stats.estimatedMemoryUsage} bytes\n`;
        report += `  Overhead: ${stats.overhead} bytes\n`;
        report += `  Total: ${(stats.estimatedMemoryUsage + stats.overhead).toLocaleString()} bytes\n\n`;
        report += '📈 System Metrics:\n';
        report += `  Active Sessions: ${metrics.activeSessions}\n`;
        report += `  Total Messages: ${metrics.totalMessages}\n`;
        report += `  Pending Messages: ${metrics.pendingMessages}\n`;
        report += `  Memory Usage: ${metrics.memoryUsage} bytes\n\n`;
        report += '💡 Optimization Recommendations:\n';
        if (recommendations.length > 0) {
            recommendations.forEach((rec, index) => {
                report += `${index + 1}. ${rec}\n`;
            });
        }
        else {
            report += '  No immediate recommendations - system is well-optimized\n';
        }
        report += '\n🔧 Available Optimization Strategies:\n';
        this.strategies.forEach(strategy => {
            report += `  • ${strategy.name}: ${strategy.description}\n`;
        });
        return report;
    }
    startMemoryMonitoring(orchestrator, intervalMs = 30000) {
        console.log(`🔄 Starting memory monitoring (interval: ${intervalMs}ms)...`);
        setInterval(() => {
            const stats = this.calculateMemoryStats(orchestrator);
            const health = orchestrator.healthCheck();
            console.log(`📊 Memory: ${(stats.estimatedMemoryUsage + stats.overhead).toLocaleString()} bytes | Health: ${health.status}`);
            if (health.status === 'unhealthy') {
                console.warn('⚠️  Memory optimization needed!');
                this.optimizeMemory(orchestrator);
            }
        }, intervalMs);
    }
}
export const memoryOptimizer = new MemoryOptimizer();
//# sourceMappingURL=memory-optimizer.js.map
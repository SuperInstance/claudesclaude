import { describe, it, expect, beforeEach } from 'bun:test';
import { UnifiedOrchestrator } from '../src/core/unified.js';
describe('Unified Orchestrator Tests', () => {
    let orchestrator;
    beforeEach(() => {
        orchestrator = new UnifiedOrchestrator();
    });
    it('should create and retrieve sessions', async () => {
        const session = await orchestrator.createSession({
            type: 'development',
            name: 'Test Session',
            workspace: 'workspace',
            config: { key: 'value' }
        });
        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.type).toBe('development');
        expect(session.name).toBe('Test Session');
        expect(session.workspace).toBe('workspace');
        expect(session.config).toEqual({ key: 'value' });
        expect(session.status).toBe('active');
        const retrieved = orchestrator.getSession(session.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(session.id);
    });
    it('should list all sessions', async () => {
        await orchestrator.createSession({
            type: 'development',
            name: 'Session 1',
            workspace: 'workspace1'
        });
        await orchestrator.createSession({
            type: 'testing',
            name: 'Session 2',
            workspace: 'workspace2'
        });
        const sessions = orchestrator.getAllSessions();
        expect(sessions.length).toBe(2);
        expect(sessions.some(s => s.name === 'Session 1')).toBe(true);
        expect(sessions.some(s => s.name === 'Session 2')).toBe(true);
    });
    it('should update sessions', async () => {
        const session = await orchestrator.createSession({
            type: 'development',
            name: 'Test Session',
            workspace: 'workspace'
        });
        orchestrator.updateSession(session.id, {
            status: 'paused',
            name: 'Updated Session'
        });
        const updated = orchestrator.getSession(session.id);
        expect(updated?.status).toBe('paused');
        expect(updated?.name).toBe('Updated Session');
    });
    it('should delete sessions', async () => {
        const session = await orchestrator.createSession({
            type: 'development',
            name: 'Test Session',
            workspace: 'workspace'
        });
        orchestrator.deleteSession(session.id);
        const retrieved = orchestrator.getSession(session.id);
        expect(retrieved).toBeUndefined();
    });
    it('should manage context', () => {
        orchestrator.setContext('test-key', { value: 'test-data' });
        expect(orchestrator.getContext('test-key')).toEqual({ value: 'test-data' });
        const contexts = orchestrator.getAllContexts();
        expect(contexts.length).toBe(1);
        expect(contexts[0]).toEqual({ value: 'test-data' });
    });
    it('should provide metrics', async () => {
        await orchestrator.createSession({
            type: 'development',
            name: 'Session 1',
            workspace: 'workspace1'
        });
        await orchestrator.createSession({
            type: 'testing',
            name: 'Session 2',
            workspace: 'workspace2'
        });
        const metrics = orchestrator.getMetrics();
        expect(metrics.sessionCount).toBe(2);
        expect(metrics.activeSessions).toBe(2);
    });
    it('should handle messaging', (done) => {
        orchestrator.subscribe((message) => {
            expect(message.type).toBe('test');
            expect(message.source).toBe('test-source');
            expect(message.data).toEqual({ content: 'hello' });
            done();
        });
        orchestrator.publish({
            type: 'test',
            source: 'test-source',
            data: { content: 'hello' }
        });
    });
    it('should shutdown properly', () => {
        orchestrator.createSession({
            type: 'development',
            name: 'Test Session',
            workspace: 'workspace'
        });
        orchestrator.setContext('test', 'data');
        orchestrator.shutdown();
        expect(orchestrator.getAllSessions().length).toBe(0);
        expect(orchestrator.getAllContexts().length).toBe(0);
    });
});
//# sourceMappingURL=unified.test.js.map
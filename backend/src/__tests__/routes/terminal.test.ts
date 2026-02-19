import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma, mockRedis } from '../setup';
import express from 'express';
import request from 'supertest';

const { mockPtyProcess } = vi.hoisted(() => ({
  mockPtyProcess: {
    pid: 12345,
    kill: vi.fn(),
  },
}));

vi.mock('node-pty', () => ({
  default: { spawn: vi.fn().mockReturnValue(mockPtyProcess) },
  spawn: vi.fn().mockReturnValue(mockPtyProcess),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

import router, { ptyProcesses } from '../../routes/terminal';

const app = express();
app.use(express.json());
app.use('/api/terminal', router);

beforeEach(() => {
  vi.clearAllMocks();
  ptyProcesses.clear();
});

describe('POST /api/terminal/sessions', () => {
  it('ターミナルセッションを作成できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.create.mockResolvedValue({
      id: 'terminal-1',
    });
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/api/terminal/sessions')
      .send({ sessionId: 'session-1', cols: 120, rows: 40 });

    expect(res.status).toBe(200);
    expect(res.body.terminalSessionId).toBe('terminal-1');
    expect(res.body.wsEndpoint).toContain('ws://');
    expect(res.body.sandboxPath).toBeDefined();
  });

  it('sessionIdが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/terminal/sessions')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId is required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/terminal/sessions')
      .send({ sessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('デフォルトのcols/rowsを使用する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.create.mockResolvedValue({
      id: 'terminal-1',
    });
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/api/terminal/sessions')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(mockPrisma.terminalSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cols: 80,
          rows: 24,
        }),
      })
    );
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/terminal/sessions')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/terminal/sessions/:terminalSessionId', () => {
  it('ターミナルセッションを終了できる', async () => {
    mockPrisma.terminalSession.findFirst.mockResolvedValue({
      id: 'terminal-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.update.mockResolvedValue({});
    mockRedis.del.mockResolvedValue(1);

    // Add a pty process to the map
    const mockPty = { kill: vi.fn() };
    ptyProcesses.set('terminal-1', mockPty as any);

    const res = await request(app)
      .delete('/api/terminal/sessions/terminal-1');

    expect(res.status).toBe(200);
    expect(res.body.terminated).toBe(true);
    expect(mockPty.kill).toHaveBeenCalled();
    expect(ptyProcesses.has('terminal-1')).toBe(false);
  });

  it('ptyプロセスがない場合もDBを更新する', async () => {
    mockPrisma.terminalSession.findFirst.mockResolvedValue({
      id: 'terminal-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.update.mockResolvedValue({});
    mockRedis.del.mockResolvedValue(1);

    const res = await request(app)
      .delete('/api/terminal/sessions/terminal-1');

    expect(res.status).toBe(200);
    expect(res.body.terminated).toBe(true);
  });

  it('存在しないターミナルセッションの場合404エラーを返す', async () => {
    mockPrisma.terminalSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/terminal/sessions/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Terminal session not found');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.terminalSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .delete('/api/terminal/sessions/terminal-1');

    expect(res.status).toBe(500);
  });
});

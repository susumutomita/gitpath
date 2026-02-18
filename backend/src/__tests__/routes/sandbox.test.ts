import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';

// Mock terminal ptyProcesses
vi.mock('../../routes/terminal', () => ({
  ptyProcesses: new Map(),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue(['file1.txt', 'file2.txt']),
    rmSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue(['file1.txt', 'file2.txt']),
  rmSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import router from '../../routes/sandbox';

const app = express();
app.use(express.json());
app.use('/api/sandbox', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/sandbox/reset', () => {
  it('サンドボックスをリセットできる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.findFirst.mockResolvedValue({
      id: 'terminal-1',
      userId: 'test-user-id',
      sandboxPath: '/tmp/sandbox/test-user-id/session-1',
    });

    const res = await request(app)
      .post('/api/sandbox/reset')
      .send({ sessionId: 'session-1', terminalSessionId: 'terminal-1' });

    expect(res.status).toBe(200);
    expect(res.body.reset).toBe(true);
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/sandbox/reset')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId and terminalSessionId are required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sandbox/reset')
      .send({ sessionId: 'nonexistent', terminalSessionId: 'terminal-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('存在しないターミナルセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sandbox/reset')
      .send({ sessionId: 'session-1', terminalSessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Terminal session not found');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/sandbox/reset')
      .send({ sessionId: 'session-1', terminalSessionId: 'terminal-1' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/sandbox/events', () => {
  it('サンドボックスイベントを記録できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.sandboxEvent.create.mockResolvedValue({ id: 'event-1' });

    const res = await request(app)
      .post('/api/sandbox/events')
      .send({
        sessionId: 'session-1',
        eventType: 'click_stop',
        stepName: 'sandbox_experience',
        durationMs: 5000,
      });

    expect(res.status).toBe(200);
    expect(res.body.eventId).toBe('event-1');
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/sandbox/events')
      .send({ sessionId: 'session-1', eventType: 'click_stop' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId, eventType, and stepName are required');
  });

  it('無効なeventTypeの場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/sandbox/events')
      .send({
        sessionId: 'session-1',
        eventType: 'invalid_type',
        stepName: 'test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('eventType must be one of');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sandbox/events')
      .send({
        sessionId: 'nonexistent',
        eventType: 'click_stop',
        stepName: 'test',
      });

    expect(res.status).toBe(404);
  });

  it('全有効イベントタイプを受け付ける', async () => {
    const validTypes = ['click_stop', 'file_edit', 'file_save', 'version_loss', 'git_demo'];

    for (const eventType of validTypes) {
      mockPrisma.learningSession.findFirst.mockResolvedValue({
        id: 'session-1',
        userId: 'test-user-id',
      });
      mockPrisma.sandboxEvent.create.mockResolvedValue({ id: 'event-1' });

      const res = await request(app)
        .post('/api/sandbox/events')
        .send({ sessionId: 'session-1', eventType, stepName: 'test' });

      expect(res.status).toBe(200);
    }
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/sandbox/events')
      .send({
        sessionId: 'session-1',
        eventType: 'click_stop',
        stepName: 'test',
      });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/sandbox/understanding', () => {
  it('Git理解度の回答を保存できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.gitUnderstandingResponse.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/sandbox/understanding')
      .send({
        sessionId: 'session-1',
        understands: true,
        freeText: 'バージョン管理が理解できました',
      });

    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
  });

  it('understands=falseの場合も保存できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.gitUnderstandingResponse.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/sandbox/understanding')
      .send({ sessionId: 'session-1', understands: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.gitUnderstandingResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          understands: false,
        }),
      })
    );
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/sandbox/understanding')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId and understands are required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sandbox/understanding')
      .send({ sessionId: 'nonexistent', understands: true });

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/sandbox/understanding')
      .send({ sessionId: 'session-1', understands: true });

    expect(res.status).toBe(500);
  });
});

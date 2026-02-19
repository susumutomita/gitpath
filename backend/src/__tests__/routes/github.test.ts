import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis, mockFetch } = vi.hoisted(() => ({
  mockPrisma: {
    learningSession: { findFirst: vi.fn() },
    githubCredential: { upsert: vi.fn() },
    userMilestone: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  mockFetch: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../../lib/redis', () => ({ redis: mockRedis }));
vi.mock('../../lib/encryption', () => ({
  encrypt: vi.fn().mockReturnValue('encrypted-token'),
}));
vi.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
}));
vi.stubGlobal('fetch', mockFetch);

import express from 'express';
import request from 'supertest';
import router from '../../routes/github';

const app = express();
app.use(express.json());
app.use('/api/github', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/github/oauth/start', () => {
  it('OAuth URLを生成できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockRedis.set.mockResolvedValue('OK');

    const res = await request(app)
      .post('/api/github/oauth/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.oauthUrl).toContain('github.com/login/oauth/authorize');
    expect(res.body.state).toBeDefined();
  });

  it('sessionIdが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/github/oauth/start')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId is required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/github/oauth/start')
      .send({ sessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/github/oauth/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/github/oauth/callback', () => {
  it('GitHub OAuthコールバックを処理できる', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'test-user-id', sessionId: 'session-1' }));
    mockRedis.del.mockResolvedValue(1);
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'github-token', scope: 'repo' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 12345, login: 'testuser' }),
      });
    mockPrisma.githubCredential.upsert.mockResolvedValue({});
    mockPrisma.userMilestone.findFirst.mockResolvedValue(null);
    mockPrisma.userMilestone.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'valid-state' });

    expect(res.status).toBe(200);
    expect(res.body.githubUsername).toBe('testuser');
    expect(res.body.accessTokenSaved).toBe(true);
  });

  it('codeまたはstateが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('code and state are required');
  });

  it('無効なstateの場合401エラーを返す', async () => {
    mockRedis.get.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'invalid-state' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('GITHUB_AUTH_FAILED');
  });

  it('GitHubトークン取得失敗の場合401エラーを返す', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'test-user-id', sessionId: 'session-1' }));
    mockRedis.del.mockResolvedValue(1);
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'bad_verification_code' }),
    });

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'invalid-code', state: 'valid-state' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('GITHUB_AUTH_FAILED');
  });

  it('GitHubユーザー取得失敗の場合401エラーを返す', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'test-user-id', sessionId: 'session-1' }));
    mockRedis.del.mockResolvedValue(1);
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'github-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Bad credentials' }),
      });

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'valid-state' });

    expect(res.status).toBe(401);
  });

  it('既存マイルストーンが未完了の場合更新する', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'test-user-id', sessionId: 'session-1' }));
    mockRedis.del.mockResolvedValue(1);
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'github-token', scope: 'repo' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 12345, login: 'testuser' }),
      });
    mockPrisma.githubCredential.upsert.mockResolvedValue({});
    mockPrisma.userMilestone.findFirst.mockResolvedValue({
      id: 'milestone-1',
      completed: false,
    });
    mockPrisma.userMilestone.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'valid-state' });

    expect(res.status).toBe(200);
    expect(mockPrisma.userMilestone.update).toHaveBeenCalled();
  });

  it('既存マイルストーンが完了済みの場合スキップする', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'test-user-id', sessionId: 'session-1' }));
    mockRedis.del.mockResolvedValue(1);
    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'github-token', scope: 'repo' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 12345, login: 'testuser' }),
      });
    mockPrisma.githubCredential.upsert.mockResolvedValue({});
    mockPrisma.userMilestone.findFirst.mockResolvedValue({
      id: 'milestone-1',
      completed: true,
    });

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'valid-state' });

    expect(res.status).toBe(200);
    expect(mockPrisma.userMilestone.create).not.toHaveBeenCalled();
    expect(mockPrisma.userMilestone.update).not.toHaveBeenCalled();
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis error'));

    const res = await request(app)
      .post('/api/github/oauth/callback')
      .send({ code: 'auth-code', state: 'valid-state' });

    expect(res.status).toBe(500);
  });
});

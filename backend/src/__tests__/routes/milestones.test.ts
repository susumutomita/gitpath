import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';

// Mock encryption
vi.mock('../../lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import router from '../../routes/milestones';

const app = express();
app.use(express.json());
app.use('/api/milestones', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/milestones/:milestoneId/verify', () => {
  it('マイルストーンを検証して完了にできる', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 1,
      name: 'GitHubアカウント作成',
      githubVerificationType: 'account',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.githubCredential.findUnique.mockResolvedValue({
      accessTokenEncrypted: 'encrypted',
    });

    // Rate limit check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '100'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({}),
    });

    // Account verification
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '99'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({ login: 'testuser' }),
    });

    mockPrisma.userMilestone.findUnique.mockResolvedValue(null);
    mockPrisma.userMilestone.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({
        sessionId: 'session-1',
        githubUsername: 'testuser',
      });

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.milestoneId).toBe(1);
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId and githubUsername are required');
  });

  it('存在しないマイルストーンの場合404エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/milestones/999/verify')
      .send({ sessionId: 'session-1', githubUsername: 'testuser' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MILESTONE_NOT_FOUND');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 1,
      githubVerificationType: 'account',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'nonexistent', githubUsername: 'testuser' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('GitHub認証情報がない場合422エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 1,
      githubVerificationType: 'account',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.githubCredential.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'session-1', githubUsername: 'testuser' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('GITHUB_VERIFICATION_FAILED');
  });

  it('GitHub APIレートリミットの場合429エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 1,
      githubVerificationType: 'account',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.githubCredential.findUnique.mockResolvedValue({
      accessTokenEncrypted: 'encrypted',
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Map([
        ['x-ratelimit-remaining', '0'],
        ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 300)],
      ]),
      json: () => Promise.resolve({ message: 'rate limit exceeded' }),
    });

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'session-1', githubUsername: 'testuser' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('GITHUB_RATE_LIMITED');
  });

  it('GitHub検証失敗の場合422エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 2,
      name: 'リポジトリ作成',
      githubVerificationType: 'repository',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.githubCredential.findUnique.mockResolvedValue({
      accessTokenEncrypted: 'encrypted',
    });

    // Rate limit check - ok
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '100'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({}),
    });

    // Repository check - not found
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map([['x-ratelimit-remaining', '99'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({ message: 'Not Found' }),
    });

    const res = await request(app)
      .post('/api/milestones/2/verify')
      .send({
        sessionId: 'session-1',
        githubUsername: 'testuser',
        repoName: 'nonexistent-repo',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('GITHUB_VERIFICATION_FAILED');
  });

  it('既存マイルストーンを更新できる', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockResolvedValue({
      id: 1,
      name: 'GitHubアカウント作成',
      githubVerificationType: 'account',
    });
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.githubCredential.findUnique.mockResolvedValue({
      accessTokenEncrypted: 'encrypted',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '100'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({}),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['x-ratelimit-remaining', '99'], ['x-ratelimit-reset', '0']]),
      json: () => Promise.resolve({ login: 'testuser' }),
    });

    mockPrisma.userMilestone.findUnique.mockResolvedValue({
      id: 'milestone-1',
      completed: false,
    });
    mockPrisma.userMilestone.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'session-1', githubUsername: 'testuser' });

    expect(res.status).toBe(200);
    expect(mockPrisma.userMilestone.update).toHaveBeenCalled();
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.milestoneDefinition.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/milestones/1/verify')
      .send({ sessionId: 'session-1', githubUsername: 'testuser' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/milestones/session/:sessionId', () => {
  it('セッションのマイルストーン一覧を取得できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.milestoneDefinition.findMany.mockResolvedValue([
      { id: 1, name: 'アカウント作成', description: '説明1', stepOrder: 1 },
      { id: 2, name: 'リポジトリ作成', description: '説明2', stepOrder: 2 },
    ]);
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      {
        milestoneId: 1,
        completedAt: new Date('2024-01-01'),
        verifiedViaGithubApi: true,
      },
    ]);

    const res = await request(app)
      .get('/api/milestones/session/session-1');

    expect(res.status).toBe(200);
    expect(res.body.milestones).toHaveLength(2);
    expect(res.body.milestones[0].completedAt).toBeDefined();
    expect(res.body.milestones[1].completedAt).toBe(null);
    expect(res.body.allCompleted).toBe(false);
  });

  it('全マイルストーン完了の場合allCompletedがtrueを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.milestoneDefinition.findMany.mockResolvedValue([
      { id: 1, name: 'M1', description: 'D1', stepOrder: 1 },
    ]);
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      { milestoneId: 1, completedAt: new Date(), verifiedViaGithubApi: true },
    ]);

    const res = await request(app)
      .get('/api/milestones/session/session-1');

    expect(res.status).toBe(200);
    expect(res.body.allCompleted).toBe(true);
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/milestones/session/nonexistent');

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/milestones/session/session-1');

    expect(res.status).toBe(500);
  });
});

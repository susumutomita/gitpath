import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';
import router from '../../routes/sessions';

const app = express();
app.use(express.json());
app.use('/api/sessions', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/sessions', () => {
  it('新しいセッションを作成できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null); // no active session
    mockPrisma.learningSession.create.mockResolvedValue({
      id: 'session-1',
      firstStartedAt: new Date('2024-01-01T00:00:00Z'),
      accumulatedSeconds: 0,
      currentStep: 'hearing',
    });

    const res = await request(app)
      .post('/api/sessions')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('session-1');
    expect(res.body.currentStep).toBe('hearing');
    expect(res.body.isResumed).toBe(false);
  });

  it('既存セッションを再開できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
      status: 'paused',
    });
    mockPrisma.learningSession.update.mockResolvedValue({
      id: 'session-1',
      status: 'active',
      firstStartedAt: new Date('2024-01-01T00:00:00Z'),
      accumulatedSeconds: 120,
      currentStep: 'sandbox',
    });

    const res = await request(app)
      .post('/api/sessions')
      .send({ resumeSessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.isResumed).toBe(true);
    expect(res.body.accumulatedSeconds).toBe(120);
  });

  it('完了済みセッションの再開は400エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
      status: 'completed',
    });

    const res = await request(app)
      .post('/api/sessions')
      .send({ resumeSessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Session already completed');
  });

  it('存在しないセッションの再開は404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sessions')
      .send({ resumeSessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('アクティブセッションがある場合デバイスコンフリクトを記録して新しいセッションを作成する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'old-session',
      userId: 'test-user-id',
      status: 'active',
    });
    mockPrisma.deviceConflictLog.create.mockResolvedValue({});
    mockPrisma.learningSession.update.mockResolvedValue({});
    mockPrisma.learningSession.create.mockResolvedValue({
      id: 'new-session',
      firstStartedAt: new Date('2024-01-01T00:00:00Z'),
      accumulatedSeconds: 0,
      currentStep: 'hearing',
    });

    const res = await request(app)
      .post('/api/sessions')
      .send({ deviceInfo: 'Chrome/Windows' });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('new-session');
    expect(mockPrisma.deviceConflictLog.create).toHaveBeenCalled();
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/sessions')
      .send({});

    expect(res.status).toBe(500);
  });
});

describe('GET /api/sessions/:sessionId', () => {
  it('セッション情報を取得できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
      status: 'active',
      accumulatedSeconds: 300,
      currentStep: 'sandbox',
    });
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      {
        milestoneId: 1,
        milestoneDefinition: { name: 'GitHubアカウント作成', stepOrder: 1 },
        completedAt: new Date('2024-01-01'),
        verifiedViaGithubApi: true,
      },
    ]);
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue({
      levelEstimate: 'beginner',
    });
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      status: 'completed',
    });

    const res = await request(app)
      .get('/api/sessions/session-1');

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('session-1');
    expect(res.body.milestones).toHaveLength(1);
    expect(res.body.levelEstimate).toBe('beginner');
    expect(res.body.hearingCompleted).toBe(true);
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/sessions/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('ヒアリング未完了の場合hearingCompletedがfalseを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
      status: 'active',
      accumulatedSeconds: 0,
      currentStep: 'hearing',
    });
    mockPrisma.userMilestone.findMany.mockResolvedValue([]);
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockPrisma.hearingSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/sessions/session-1');

    expect(res.status).toBe(200);
    expect(res.body.hearingCompleted).toBe(false);
    expect(res.body.levelEstimate).toBe(null);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/sessions/session-1');

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/sessions/:sessionId/step', () => {
  it('セッションのステップを更新できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.learningSession.update.mockResolvedValue({});

    const res = await request(app)
      .patch('/api/sessions/session-1/step')
      .send({ currentStep: 'sandbox', accumulatedSeconds: 300 });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
  });

  it('ステップをcompletedにするとセッションも完了にする', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.learningSession.update.mockResolvedValue({});

    const res = await request(app)
      .patch('/api/sessions/session-1/step')
      .send({ currentStep: 'completed' });

    expect(res.status).toBe(200);
    expect(mockPrisma.learningSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStep: 'completed',
          status: 'completed',
        }),
      })
    );
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/sessions/nonexistent/step')
      .send({ currentStep: 'sandbox' });

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .patch('/api/sessions/session-1/step')
      .send({ currentStep: 'sandbox' });

    expect(res.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';

// Mock OpenAI
vi.mock('../../lib/openai', () => ({
  getOpenAI: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({
            levelEstimate: 'beginner',
            occupation: null,
            pcExperienceYears: null,
            programmingExperience: 'none',
            productIdeaSummary: null,
            domainKeywords: [],
            curriculum: {
              steps: [],
              emphasizedConcepts: [],
              skippedSteps: [],
              personalizedIntro: 'テスト用イントロ',
            },
          }) } }],
        }),
      },
    },
  }),
}));

import router from '../../routes/hearing';

const app = express();
app.use(express.json());
app.use('/api/hearing', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/hearing/start', () => {
  it('ヒアリングセッションを開始できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.hearingSession.findFirst.mockResolvedValue(null);
    mockPrisma.hearingSession.create.mockResolvedValue({
      id: 'hearing-1',
    });
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.hearingSessionId).toBe('hearing-1');
    expect(res.body.questionNumber).toBe(1);
    expect(res.body.totalQuestions).toBe(5);
    expect(res.body.firstQuestion).toBeDefined();
  });

  it('sessionIdが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/hearing/start')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId is required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('完了済みヒアリングの場合400エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      status: 'completed',
    });

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Hearing already completed for this session');
  });

  it('進行中のヒアリングを再開できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-existing',
      status: 'in_progress',
    });
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([
      { questionNumber: 1 },
      { questionNumber: 2 },
    ]);

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.hearingSessionId).toBe('hearing-existing');
    expect(res.body.questionNumber).toBe(3);
  });

  it('全質問に回答済みの場合400エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-existing',
      status: 'in_progress',
    });
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([
      { questionNumber: 1 },
      { questionNumber: 2 },
      { questionNumber: 3 },
      { questionNumber: 4 },
      { questionNumber: 5 },
    ]);

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('All questions already answered');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/hearing/start')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/hearing/:hearingSessionId/answer', () => {
  it('中間の質問に回答すると次の質問を返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'in_progress',
      learningSessionId: 'session-1',
    });
    mockPrisma.hearingAnswer.upsert.mockResolvedValue({});
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([
      { questionNumber: 1, questionText: 'Q1', answerText: 'A1' },
    ]);

    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 1, answerText: 'テスト回答です' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('continue');
    expect(res.body.questionNumber).toBe(2);
    expect(res.body.nextQuestion).toBeDefined();
  });

  it('最後の質問に回答するとカリキュラムを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'in_progress',
      learningSessionId: 'session-1',
    });
    mockPrisma.hearingAnswer.upsert.mockResolvedValue({});
    mockPrisma.hearingSession.update.mockResolvedValue({});
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([
      { questionNumber: 1, questionText: 'Q1', answerText: 'A1', isSkipped: false },
      { questionNumber: 2, questionText: 'Q2', answerText: 'A2', isSkipped: false },
      { questionNumber: 3, questionText: 'Q3', answerText: 'A3', isSkipped: false },
      { questionNumber: 4, questionText: 'Q4', answerText: 'A4', isSkipped: false },
      { questionNumber: 5, questionText: 'Q5', answerText: 'A5', isSkipped: false },
    ]);
    mockPrisma.userLevelProfile.upsert.mockResolvedValue({});
    mockPrisma.learningSession.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 5, answerText: '最後の回答' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');
    expect(res.body.curriculum).toBeDefined();
    expect(res.body.curriculum.levelEstimate).toBe('beginner');
  });

  it('questionNumberが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ answerText: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('questionNumber is required');
  });

  it('questionNumberが範囲外の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 0, answerText: 'テスト' });

    expect(res.status).toBe(400);

    const res2 = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 6, answerText: 'テスト' });

    expect(res2.status).toBe(400);
  });

  it('存在しないヒアリングセッションの場合404エラーを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/hearing/nonexistent/answer')
      .send({ questionNumber: 1, answerText: 'テスト' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Hearing session not found');
  });

  it('完了済みヒアリングの場合400エラーを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'completed',
    });

    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 1, answerText: 'テスト' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Hearing session already completed');
  });

  it('スキップした場合answerTextがnullで保存される', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'in_progress',
      learningSessionId: 'session-1',
    });
    mockPrisma.hearingAnswer.upsert.mockResolvedValue({});
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 1, isSkipped: true });

    expect(res.status).toBe(200);
    expect(mockPrisma.hearingAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          answerText: null,
          isSkipped: true,
        }),
      })
    );
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/hearing/hearing-1/answer')
      .send({ questionNumber: 1, answerText: 'テスト' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/hearing/:hearingSessionId/previous', () => {
  it('過去の回答一覧を取得できる', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'in_progress',
      learningSessionId: 'session-1',
    });
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([
      {
        questionNumber: 1,
        questionText: 'Q1',
        answerText: 'A1',
        answeredAt: new Date('2024-01-01T00:00:00Z'),
      },
    ]);

    const res = await request(app)
      .get('/api/hearing/hearing-1/previous');

    expect(res.status).toBe(200);
    expect(res.body.answers).toHaveLength(1);
    expect(res.body.answers[0].questionNumber).toBe(1);
    expect(res.body.curriculum).toBe(null);
  });

  it('完了済みの場合カリキュラムも返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue({
      id: 'hearing-1',
      userId: 'test-user-id',
      status: 'completed',
      learningSessionId: 'session-1',
    });
    mockPrisma.hearingAnswer.findMany.mockResolvedValue([]);
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue({
      curriculum: { steps: [], personalizedIntro: 'test' },
    });

    const res = await request(app)
      .get('/api/hearing/hearing-1/previous');

    expect(res.status).toBe(200);
    expect(res.body.curriculum).toBeDefined();
  });

  it('存在しないヒアリングセッションの場合404エラーを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/hearing/nonexistent/previous');

    expect(res.status).toBe(404);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.hearingSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/hearing/hearing-1/previous');

    expect(res.status).toBe(500);
  });
});

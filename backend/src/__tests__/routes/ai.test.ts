import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('../../lib/openai', () => ({
  getOpenAI: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

import router from '../../routes/ai';

const app = express();
app.use(express.json());
app.use('/api/ai', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/ai/explain', () => {
  it('AI説明を取得できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue({
      levelEstimate: 'beginner',
      occupation: 'デザイナー',
      domainKeywords: ['UI', 'デザイン'],
    });
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            explanation: 'テスト説明',
            suggestedCommand: 'git init',
            metaphor: 'テスト比喩',
          }),
        },
      }],
    });
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'explain',
        context: 'テストコンテキスト',
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('テスト説明');
    expect(res.body.suggestedCommand).toBe('git init');
    expect(res.body.metaphor).toBe('テスト比喩');
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/ai/explain')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId, stepId, and requestType are required');
  });

  it('無効なrequestTypeの場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'invalid',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('requestType must be one of');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'nonexistent',
        stepId: 'first_commit',
        requestType: 'explain',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('AI APIエラーの場合503エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error('API error'));
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'explain',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI_API_UNAVAILABLE');
  });

  it('AIレスポンスがJSONとしてパースできない場合でも応答する', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'これはプレーンテキストです' } }],
    });
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'explain',
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('これはプレーンテキストです');
  });

  it('error_helpリクエストを処理できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            explanation: 'エラーの説明',
            suggestedCommand: 'git status',
            metaphor: null,
          }),
        },
      }],
    });
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'error_help',
        errorOutput: 'fatal: not a git repository',
        consecutiveErrors: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('エラーの説明');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/ai/explain')
      .send({
        sessionId: 'session-1',
        stepId: 'first_commit',
        requestType: 'explain',
      });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/ai/generate-yaml', () => {
  it('YAML設定を生成できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue({
      levelEstimate: 'beginner',
    });
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            yamlContent: 'name: CI\non: push',
            fileName: '.github/workflows/ci.yml',
            explanation: 'CI設定の説明',
          }),
        },
      }],
    });
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({
        sessionId: 'session-1',
        repoName: 'my-repo',
        projectType: 'Node.js',
      });

    expect(res.status).toBe(200);
    expect(res.body.yamlContent).toBe('name: CI\non: push');
    expect(res.body.fileName).toBe('.github/workflows/ci.yml');
    expect(res.body.explanation).toBe('CI設定の説明');
  });

  it('必須パラメータが不足の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId and repoName are required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({ sessionId: 'nonexistent', repoName: 'my-repo' });

    expect(res.status).toBe(404);
  });

  it('AI APIエラーの場合503エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error('API timeout'));

    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({ sessionId: 'session-1', repoName: 'my-repo' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI_API_UNAVAILABLE');
  });

  it('AIレスポンスがJSONとしてパースできない場合でもyamlContentを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.userLevelProfile.findUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'name: CI\non: push' } }],
    });
    mockPrisma.aiExplanationLog.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({ sessionId: 'session-1', repoName: 'my-repo' });

    expect(res.status).toBe(200);
    expect(res.body.yamlContent).toBe('name: CI\non: push');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/ai/generate-yaml')
      .send({ sessionId: 'session-1', repoName: 'my-repo' });

    expect(res.status).toBe(500);
  });
});

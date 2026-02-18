import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../setup';
import { mockPrisma } from '../setup';
import express from 'express';
import request from 'supertest';
import router from '../../routes/certificates';

const app = express();
app.use(express.json());
app.use('/api/certificates', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/certificates', () => {
  it('修了証を発行できる', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
      accumulatedSeconds: 3600,
    });
    mockPrisma.certificate.findUnique.mockResolvedValue(null);
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      { milestoneDefinition: { stepOrder: 1, name: 'M1' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 2, name: 'M2' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 3, name: 'M3' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 4, name: 'M4' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 5, name: 'M5' }, completedAt: new Date() },
    ]);
    mockPrisma.githubCredential.findUnique.mockResolvedValue({
      githubUsername: 'testuser',
    });
    mockPrisma.certificate.create.mockResolvedValue({
      id: 'cert-1',
    });
    mockPrisma.learningSession.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(201);
    expect(res.body.certificateId).toBe('cert-1');
    expect(res.body.certificateUrl).toBe('/certificate/cert-1');
  });

  it('既存の修了証がある場合はそれを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.certificate.findUnique.mockResolvedValue({
      id: 'existing-cert',
    });

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(200);
    expect(res.body.certificateId).toBe('existing-cert');
    expect(res.body.alreadyExists).toBe(true);
  });

  it('sessionIdが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/certificates')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('sessionId is required');
  });

  it('存在しないセッションの場合404エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('マイルストーン未達成の場合400エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.certificate.findUnique.mockResolvedValue(null);
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      { milestoneDefinition: { stepOrder: 1, name: 'M1' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 2, name: 'M2' }, completedAt: new Date() },
    ]);

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NOT_ALL_MILESTONES_COMPLETED');
    expect(res.body.completedCount).toBe(2);
    expect(res.body.totalRequired).toBe(5);
  });

  it('GitHub連携がない場合400エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'test-user-id',
    });
    mockPrisma.certificate.findUnique.mockResolvedValue(null);
    mockPrisma.userMilestone.findMany.mockResolvedValue([
      { milestoneDefinition: { stepOrder: 1, name: 'M1' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 2, name: 'M2' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 3, name: 'M3' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 4, name: 'M4' }, completedAt: new Date() },
      { milestoneDefinition: { stepOrder: 5, name: 'M5' }, completedAt: new Date() },
    ]);
    mockPrisma.githubCredential.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('GITHUB_NOT_LINKED');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.learningSession.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/certificates')
      .send({ sessionId: 'session-1' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/certificates/:certificateId', () => {
  it('修了証を公開取得できる', async () => {
    mockPrisma.certificate.findUnique.mockResolvedValue({
      id: 'cert-1',
      githubUsername: 'testuser',
      elapsedSeconds: 3600,
      completedAt: new Date('2024-01-01T00:00:00Z'),
      milestoneDetails: [{ name: 'M1', completedAt: '2024-01-01' }],
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    const res = await request(app)
      .get('/api/certificates/cert-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('cert-1');
    expect(res.body.githubUsername).toBe('testuser');
    expect(res.body.elapsedSeconds).toBe(3600);
    expect(res.body.completedAt).toBeDefined();
    expect(res.body.milestoneDetails).toHaveLength(1);
  });

  it('存在しない修了証の場合404エラーを返す', async () => {
    mockPrisma.certificate.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/certificates/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Certificate not found');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.certificate.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/certificates/cert-1');

    expect(res.status).toBe(500);
  });
});

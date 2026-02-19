import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockVerifyIdToken,
  mockGenerateAccessToken,
  mockGenerateRefreshToken,
  mockHashPassword,
  mockComparePassword,
  mockPrisma,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockGenerateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  mockGenerateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  mockHashPassword: vi.fn().mockResolvedValue('hashed-password'),
  mockComparePassword: vi.fn(),
  mockPrisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
    learningSession: { findFirst: vi.fn() },
  },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerifyIdToken;
  },
}));

vi.mock('../../lib/jwt', () => ({
  generateAccessToken: (...args: any[]) => mockGenerateAccessToken(...args),
  generateRefreshToken: (...args: any[]) => mockGenerateRefreshToken(...args),
}));

vi.mock('../../lib/password', () => ({
  hashPassword: (...args: any[]) => mockHashPassword(...args),
  comparePassword: (...args: any[]) => mockComparePassword(...args),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: mockPrisma,
}));

import express from 'express';
import request from 'supertest';
import router from '../../routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', router);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/signup', () => {
  it('メールアドレスとパスワードで新規ユーザーを作成できる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user-id',
      email: 'test@example.com',
      provider: 'email',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.accessToken).toBe('mock-access-token');
    expect(res.body.refreshToken).toBe('mock-refresh-token');
  });

  it('メールアドレスが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('パスワードが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('既存メールアドレスの場合409エラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'test@example.com' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('Googleトークンで新規ユーザーを作成できる', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-123', email: 'google@example.com' }),
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-google-user',
      email: 'google@example.com',
      provider: 'google',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ googleToken: 'valid-google-token' });

    expect(res.status).toBe(201);
    expect(res.body.user.provider).toBe('google');
  });

  it('無効なGoogleトークンの場合400エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => null,
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ googleToken: 'invalid-token' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Google token');
  });

  it('Google subが既存の場合409エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-123', email: 'google@example.com' }),
    });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'existing' }) // findUnique by googleSub
      ;

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ googleToken: 'valid-google-token' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ACCOUNT_ALREADY_EXISTS');
  });

  it('Googleメールが既存の場合409エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'new-sub', email: 'existing@example.com' }),
    });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // googleSub not found
      .mockResolvedValueOnce({ id: 'existing', email: 'existing@example.com' }); // email found

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ googleToken: 'valid-google-token' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('POST /api/auth/login', () => {
  it('メールアドレスとパスワードでログインできる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      provider: 'email',
      passwordHash: 'hashed',
    });
    mockComparePassword.mockResolvedValue(true);
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.hasActiveSession).toBe(false);
    expect(res.body.lastSessionId).toBe(null);
  });

  it('アクティブセッションがある場合hasActiveSessionがtrueを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      provider: 'email',
      passwordHash: 'hashed',
    });
    mockComparePassword.mockResolvedValue(true);
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.learningSession.findFirst.mockResolvedValue({ id: 'session-1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.hasActiveSession).toBe(true);
    expect(res.body.lastSessionId).toBe('session-1');
  });

  it('メール未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('存在しないユーザーの場合401エラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nouser@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('パスワードが間違っている場合401エラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
      passwordHash: 'hashed',
    });
    mockComparePassword.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('Googleトークンでログインできる', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-123' }),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'google-user-id',
      email: 'google@example.com',
      provider: 'google',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ googleToken: 'valid-google-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.provider).toBe('google');
  });

  it('Googleアカウントが存在しない場合401エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'unknown-sub' }),
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ googleToken: 'valid-google-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('ACCOUNT_NOT_FOUND');
  });

  it('無効なGoogleトークンの場合400エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => null,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ googleToken: 'invalid-token' });

    expect(res.status).toBe(400);
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/refresh', () => {
  it('有効なリフレッシュトークンで新しいアクセストークンを取得できる', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'valid-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('mock-access-token');
  });

  it('リフレッシュトークンが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Refresh token is required');
  });

  it('無効なリフレッシュトークンの場合401エラーを返す', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
  });

  it('期限切れリフレッシュトークンの場合401エラーを返す', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      expiresAt: new Date(Date.now() - 86400000),
    });
    mockPrisma.refreshToken.delete.mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'expired-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockPrisma.refreshToken.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'valid-token' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/google', () => {
  it('新規Googleユーザーの場合201でユーザーを作成できる', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'new-google-sub', email: 'new@google.com' }),
    });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // googleSub not found
      .mockResolvedValueOnce(null); // email not found
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'new@google.com',
      provider: 'google',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(201);
    expect(res.body.isNewUser).toBe(true);
  });

  it('既存Googleユーザーの場合200でログインできる', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'existing-sub', email: 'existing@google.com' }),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user',
      email: 'existing@google.com',
      provider: 'google',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.learningSession.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
  });

  it('idTokenが未入力の場合400エラーを返す', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Google ID token is required');
  });

  it('無効なGoogleトークンの場合400エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => null,
    });

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'invalid-token' });

    expect(res.status).toBe(400);
  });

  it('メールが既に登録されている場合409エラーを返す', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'new-sub', email: 'taken@example.com' }),
    });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // googleSub not found
      .mockResolvedValueOnce({ id: 'existing', email: 'taken@example.com' }); // email found

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('内部エラーの場合500エラーを返す', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Google API error'));

    const res = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/github', () => {
  it('501 Not Implementedを返す', async () => {
    const res = await request(app)
      .post('/api/auth/github')
      .send({});

    expect(res.status).toBe(501);
    expect(res.body.error).toBe('Not implemented');
  });
});

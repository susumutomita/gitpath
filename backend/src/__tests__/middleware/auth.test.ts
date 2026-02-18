import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock jwt module
const mockVerifyToken = vi.fn();
vi.mock('../../lib/jwt', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

// Import after mocking
import { authenticate } from '../../middleware/auth';

function createMockReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function createMockRes(): Partial<Response> & { statusCode: number; body: any } {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticate middleware', () => {
  it('有効なBearerトークンでreq.userを設定する', () => {
    mockVerifyToken.mockReturnValue({ userId: 'user-123' });

    const req = createMockReq('Bearer valid-token');
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect((req as any).user).toEqual({ userId: 'user-123' });
  });

  it('Authorizationヘッダーがない場合401エラーを返す', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Authorization token required');
  });

  it('Bearer以外のスキームの場合401エラーを返す', () => {
    const req = createMockReq('Basic dXNlcjpwYXNz');
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Authorization token required');
  });

  it('無効なトークンの場合401エラーを返す', () => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const req = createMockReq('Bearer invalid-token');
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('期限切れトークンの場合401エラーを返す', () => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = createMockReq('Bearer expired-token');
    const res = createMockRes();
    const next = vi.fn();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});

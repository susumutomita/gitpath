import { describe, it, expect } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../lib/jwt';

describe('JWT Token Management', () => {
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAccessToken(testUserId);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should contain the userId in payload', () => {
      const token = generateAccessToken(testUserId);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(testUserId);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateRefreshToken(testUserId);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should contain the userId in payload', () => {
      const token = generateRefreshToken(testUserId);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(testUserId);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateAccessToken(testUserId);
      const payload = verifyToken(token);
      expect(payload.userId).toBe(testUserId);
    });

    it('should throw on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    it('should throw on empty string', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateAccessToken('user-1');
      const token2 = generateAccessToken('user-2');
      expect(token1).not.toBe(token2);
    });
  });
});

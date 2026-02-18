import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../lib/password';

describe('Password Hashing', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('TestPass123!');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('TestPass123!');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should verify correct password', async () => {
    const password = 'MySecurePassword!';
    const hash = await hashPassword(password);
    const isValid = await comparePassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    const isValid = await comparePassword('wrong-password', hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same password (salt)', async () => {
    const password = 'same-password';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
    // But both should validate
    expect(await comparePassword(password, hash1)).toBe(true);
    expect(await comparePassword(password, hash2)).toBe(true);
  });

  it('should handle unicode passwords', async () => {
    const password = 'パスワード123!';
    const hash = await hashPassword(password);
    expect(await comparePassword(password, hash)).toBe(true);
  });

  it('should handle long passwords', async () => {
    const password = 'a'.repeat(100);
    const hash = await hashPassword(password);
    expect(await comparePassword(password, hash)).toBe(true);
  });
});

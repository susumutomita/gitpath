import { describe, it, expect, beforeAll } from 'vitest';

// Set env before importing
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-vitest';
});

describe('AES-256-GCM Encryption', () => {
  it('should encrypt and decrypt a string correctly', async () => {
    const { encrypt, decrypt } = await import('../lib/encryption');
    const original = 'gho_test_access_token_12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('../lib/encryption');
    const text = 'same-input-text';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);
    expect(enc1).not.toBe(enc2);
  });

  it('should produce ciphertext in format iv:tag:data', async () => {
    const { encrypt } = await import('../lib/encryption');
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // IV is 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Tag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Data should be non-empty
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should handle empty string', async () => {
    const { encrypt, decrypt } = await import('../lib/encryption');
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle unicode text', async () => {
    const { encrypt, decrypt } = await import('../lib/encryption');
    const original = 'GitHubトークン：テスト用🔑';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should fail to decrypt tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('../lib/encryption');
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    // Tamper with the data
    parts[2] = parts[2].replace(/[0-9a-f]/, 'x');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});

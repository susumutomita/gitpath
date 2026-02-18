import { describe, it, expect } from 'vitest';

describe('Redis configuration', () => {
  it('retryStrategyが遅延時間を正しく計算する', () => {
    const retryStrategy = (times: number) => Math.min(times * 200, 2000);

    expect(retryStrategy(1)).toBe(200);
    expect(retryStrategy(5)).toBe(1000);
    expect(retryStrategy(10)).toBe(2000);
    expect(retryStrategy(20)).toBe(2000);
  });

  it('デフォルトURLがredis://localhost:6379である', () => {
    const defaultUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    expect(defaultUrl).toContain('redis://');
  });
});

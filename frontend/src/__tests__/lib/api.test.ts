import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const authInitialState = useAuthStore.getState();

// We need to dynamically import api after mocking fetch
let api: typeof import('@/lib/api').api;

beforeEach(async () => {
  useAuthStore.setState(authInitialState, true);
  vi.restoreAllMocks();
  // Re-import to get fresh instance
  const mod = await import('@/lib/api');
  api = mod.api;
});

function mockFetchResponse(body: unknown, status = 200, statusText = 'OK') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

function mockFetchSequence(...responses: Array<{ body: unknown; status?: number; statusText?: string }>) {
  const fn = vi.fn();
  responses.forEach((r, i) => {
    fn.mockResolvedValueOnce({
      ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      json: () => Promise.resolve(r.body),
    });
  });
  return fn;
}

describe('ApiClient', () => {
  describe('GETリクエスト', () => {
    it('正常なGETリクエストでレスポンスを返す', async () => {
      const data = { id: 1, name: 'test' };
      globalThis.fetch = mockFetchResponse(data);

      const result = await api.get('/test');
      expect(result).toEqual(data);
    });

    it('GETリクエストでContent-Typeヘッダーが設定される', async () => {
      globalThis.fetch = mockFetchResponse({});

      await api.get('/test');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('POSTリクエスト', () => {
    it('POSTリクエストでボディが送信される', async () => {
      globalThis.fetch = mockFetchResponse({ success: true });

      await api.post('/test', { key: 'value' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ key: 'value' }),
        }),
      );
    });

    it('データなしのPOSTリクエストでbodyがundefinedになる', async () => {
      globalThis.fetch = mockFetchResponse({ success: true });

      await api.post('/test');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        }),
      );
    });
  });

  describe('PUTリクエスト', () => {
    it('PUTリクエストでボディが送信される', async () => {
      globalThis.fetch = mockFetchResponse({ success: true });

      await api.put('/test', { key: 'value' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ key: 'value' }),
        }),
      );
    });
  });

  describe('PATCHリクエスト', () => {
    it('PATCHリクエストでボディが送信される', async () => {
      globalThis.fetch = mockFetchResponse({ success: true });

      await api.patch('/test', { key: 'value' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ key: 'value' }),
        }),
      );
    });
  });

  describe('DELETEリクエスト', () => {
    it('DELETEリクエストが送信される', async () => {
      globalThis.fetch = mockFetchResponse({ success: true });

      await api.delete('/test');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('認証トークン', () => {
    it('accessTokenがある場合Authorizationヘッダーが設定される', async () => {
      useAuthStore.getState().setAccessToken('my-token');
      globalThis.fetch = mockFetchResponse({});

      await api.get('/test');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('accessTokenがない場合Authorizationヘッダーが設定されない', async () => {
      globalThis.fetch = mockFetchResponse({});

      await api.get('/test');
      const callHeaders = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });
  });

  describe('401でトークンリフレッシュ', () => {
    it('401レスポンスでトークンリフレッシュが試行される', async () => {
      const user = { id: 'u1', email: 'test@example.com', provider: 'github' };
      useAuthStore.getState().login(user, 'old-token', 'refresh-token');

      globalThis.fetch = mockFetchSequence(
        { body: {}, status: 401, statusText: 'Unauthorized' },
        { body: { accessToken: 'new-token' }, status: 200 },
        { body: { data: 'success' }, status: 200 },
      );

      const result = await api.get('/test');
      expect(result).toEqual({ data: 'success' });
    });

    it('リフレッシュ成功後にaccessTokenが更新される', async () => {
      const user = { id: 'u1', email: 'test@example.com', provider: 'github' };
      useAuthStore.getState().login(user, 'old-token', 'refresh-token');

      globalThis.fetch = mockFetchSequence(
        { body: {}, status: 401, statusText: 'Unauthorized' },
        { body: { accessToken: 'new-token' }, status: 200 },
        { body: { data: 'success' }, status: 200 },
      );

      await api.get('/test');
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('リフレッシュ失敗時にlogoutが呼ばれる', async () => {
      const user = { id: 'u1', email: 'test@example.com', provider: 'github' };
      useAuthStore.getState().login(user, 'old-token', 'refresh-token');

      globalThis.fetch = mockFetchSequence(
        { body: {}, status: 401, statusText: 'Unauthorized' },
        { body: {}, status: 401, statusText: 'Unauthorized' },
      );

      await expect(api.get('/test')).rejects.toMatchObject({ status: 401 });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('refreshTokenがない場合リフレッシュを試行しない', async () => {
      useAuthStore.getState().setAccessToken('some-token');

      globalThis.fetch = mockFetchSequence(
        { body: {}, status: 401, statusText: 'Unauthorized' },
      );

      await expect(api.get('/test')).rejects.toMatchObject({ status: 401 });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('APIエラー時にApiErrorがスローされる', async () => {
      globalThis.fetch = mockFetchResponse(
        { message: 'Not found', error: 'NOT_FOUND' },
        404,
        'Not Found',
      );

      await expect(api.get('/test')).rejects.toMatchObject({
        message: 'Not found',
        error: 'NOT_FOUND',
        status: 404,
      });
    });

    it('レスポンスボディがパースできない場合デフォルトメッセージが使用される', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(api.get('/test')).rejects.toMatchObject({
        message: 'API Error: Internal Server Error',
        error: 'UNKNOWN_ERROR',
        status: 500,
      });
    });
  });

  describe('リフレッシュ中のネットワークエラー', () => {
    it('リフレッシュ中にネットワークエラーが発生するとlogoutが呼ばれる', async () => {
      const user = { id: 'u1', email: 'test@example.com', provider: 'github' };
      useAuthStore.getState().login(user, 'old-token', 'refresh-token');

      const fn = vi.fn();
      // First call: 401
      fn.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      });
      // Second call (refresh): network error
      fn.mockRejectedValueOnce(new Error('Network error'));
      globalThis.fetch = fn;

      await expect(api.get('/test')).rejects.toMatchObject({ status: 401 });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});

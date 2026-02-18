import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const initialState = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState(initialState, true);
});

describe('authStore', () => {
  describe('初期状態', () => {
    it('userがnullである', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('accessTokenがnullである', () => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('refreshTokenValueがnullである', () => {
      expect(useAuthStore.getState().refreshTokenValue).toBeNull();
    });

    it('isAuthenticatedがfalseである', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('hasActiveSessionがfalseである', () => {
      expect(useAuthStore.getState().hasActiveSession).toBe(false);
    });

    it('lastSessionIdがnullである', () => {
      expect(useAuthStore.getState().lastSessionId).toBeNull();
    });
  });

  describe('login', () => {
    const user = { id: 'user-1', email: 'test@example.com', provider: 'github' };

    it('ログイン後にuserが設定される', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().user).toEqual(user);
    });

    it('ログイン後にaccessTokenが設定される', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().accessToken).toBe('access-token');
    });

    it('ログイン後にrefreshTokenValueが設定される', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().refreshTokenValue).toBe('refresh-token');
    });

    it('ログイン後にisAuthenticatedがtrueになる', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('hasActiveSessionを指定しない場合falseになる', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().hasActiveSession).toBe(false);
    });

    it('hasActiveSessionをtrueで指定できる', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token', true);
      expect(useAuthStore.getState().hasActiveSession).toBe(true);
    });

    it('lastSessionIdを指定しない場合nullになる', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token');
      expect(useAuthStore.getState().lastSessionId).toBeNull();
    });

    it('lastSessionIdを指定できる', () => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token', false, 'session-1');
      expect(useAuthStore.getState().lastSessionId).toBe('session-1');
    });
  });

  describe('logout', () => {
    const user = { id: 'user-1', email: 'test@example.com', provider: 'github' };

    beforeEach(() => {
      useAuthStore.getState().login(user, 'access-token', 'refresh-token', true, 'session-1');
    });

    it('ログアウト後にuserがnullになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('ログアウト後にaccessTokenがnullになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('ログアウト後にrefreshTokenValueがnullになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().refreshTokenValue).toBeNull();
    });

    it('ログアウト後にisAuthenticatedがfalseになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('ログアウト後にhasActiveSessionがfalseになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().hasActiveSession).toBe(false);
    });

    it('ログアウト後にlastSessionIdがnullになる', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().lastSessionId).toBeNull();
    });
  });

  describe('setAccessToken', () => {
    it('accessTokenを更新できる', () => {
      useAuthStore.getState().setAccessToken('new-token');
      expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('他のステートに影響しない', () => {
      const user = { id: 'user-1', email: 'test@example.com', provider: 'github' };
      useAuthStore.getState().login(user, 'old-token', 'refresh-token');
      useAuthStore.getState().setAccessToken('new-token');
      expect(useAuthStore.getState().user).toEqual(user);
    });
  });
});

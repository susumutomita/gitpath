import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  provider: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshTokenValue: string | null;
  isAuthenticated: boolean;
  hasActiveSession: boolean;
  lastSessionId: string | null;
  login: (
    user: User,
    accessToken: string,
    refreshToken: string,
    hasActiveSession?: boolean,
    lastSessionId?: string | null
  ) => void;
  logout: () => void;
  setAccessToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshTokenValue: null,
      isAuthenticated: false,
      hasActiveSession: false,
      lastSessionId: null,
      login: (user, accessToken, refreshToken, hasActiveSession, lastSessionId) =>
        set({
          user,
          accessToken,
          refreshTokenValue: refreshToken,
          isAuthenticated: true,
          hasActiveSession: hasActiveSession ?? false,
          lastSessionId: lastSessionId ?? null,
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshTokenValue: null,
          isAuthenticated: false,
          hasActiveSession: false,
          lastSessionId: null,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: "gitpath-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshTokenValue: state.refreshTokenValue,
        isAuthenticated: state.isAuthenticated,
        hasActiveSession: state.hasActiveSession,
        lastSessionId: state.lastSessionId,
      }),
    }
  )
);

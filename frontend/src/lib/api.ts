import { useAuthStore } from "@/stores/authStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export interface ApiError {
  message: string;
  error: string;
  status: number;
}

class ApiClient {
  private getToken(): string | null {
    return useAuthStore.getState().accessToken;
  }

  private async tryRefresh(): Promise<string | null> {
    const { refreshTokenValue, setAccessToken, logout } =
      useAuthStore.getState();
    if (!refreshTokenValue) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      if (!response.ok) {
        logout();
        return null;
      }

      const data = await response.json();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      logout();
      return null;
    }
  }

  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (response.status === 401 && token) {
      const newToken = await this.tryRefresh();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      let body: { error?: string; message?: string } = {};
      try {
        body = await response.json();
      } catch {
        // use default
      }

      const error: ApiError = {
        message: body.message || `API Error: ${response.statusText}`,
        error: body.error || "UNKNOWN_ERROR",
        status: response.status,
      };
      throw error;
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.fetch<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.fetch<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown) {
    return this.fetch<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  githubId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Session types
export interface Session {
  id: string;
  userId: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionStatus = 'active' | 'completed' | 'abandoned';

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

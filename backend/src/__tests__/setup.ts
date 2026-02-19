import { vi } from 'vitest';

// Mock Prisma client
export const mockPrisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  refreshToken: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  learningSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  hearingSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  hearingAnswer: { findMany: vi.fn(), upsert: vi.fn() },
  userLevelProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  milestoneDefinition: { findUnique: vi.fn(), findMany: vi.fn() },
  userMilestone: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  terminalSession: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  commandLog: { create: vi.fn() },
  aiExplanationLog: { create: vi.fn() },
  sandboxEvent: { create: vi.fn() },
  gitUnderstandingResponse: { create: vi.fn() },
  githubCredential: { findUnique: vi.fn(), upsert: vi.fn() },
  certificate: { findUnique: vi.fn(), create: vi.fn() },
  deviceConflictLog: { create: vi.fn() },
};

vi.mock('../lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock Redis
export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};
vi.mock('../lib/redis', () => ({
  redis: mockRedis,
}));

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'test-user-id' };
    next();
  },
}));

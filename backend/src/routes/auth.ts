import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { generateAccessToken, generateRefreshToken } from '../lib/jwt';
import { hashPassword, comparePassword } from '../lib/password';

const router = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

async function getActiveSession(userId: string) {
  return prisma.learningSession.findFirst({
    where: { userId, status: 'active' },
    orderBy: { lastActiveAt: 'desc' },
  });
}

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, googleToken } = req.body;

    // Google OAuth signup
    if (googleToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        res.status(400).json({ error: 'Invalid Google token' });
        return;
      }

      const existingUser = await prisma.user.findUnique({
        where: { googleSub: payload.sub },
      });
      if (existingUser) {
        res.status(409).json({ error: 'ACCOUNT_ALREADY_EXISTS' });
        return;
      }

      const existingEmail = await prisma.user.findUnique({
        where: { email: payload.email },
      });
      if (existingEmail) {
        res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
        return;
      }

      const user = await prisma.user.create({
        data: {
          email: payload.email,
          provider: 'google',
          googleSub: payload.sub,
        },
      });

      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await saveRefreshToken(user.id, refreshToken);

      res.status(201).json({
        user: { id: user.id, email: user.email, provider: user.provider },
        accessToken,
        refreshToken,
      });
      return;
    }

    // Email signup
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, provider: 'email' },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      user: { id: user.id, email: user.email, provider: user.provider },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, googleToken } = req.body;

    // Google OAuth login
    if (googleToken) {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        res.status(400).json({ error: 'Invalid Google token' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { googleSub: payload.sub },
      });
      if (!user) {
        res.status(401).json({ error: 'ACCOUNT_NOT_FOUND' });
        return;
      }

      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await saveRefreshToken(user.id, refreshToken);

      const activeSession = await getActiveSession(user.id);

      res.json({
        user: { id: user.id, email: user.email, provider: user.provider },
        accessToken,
        refreshToken,
        hasActiveSession: !!activeSession,
        lastSessionId: activeSession?.id ?? null,
      });
      return;
    }

    // Email login
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken);

    const activeSession = await getActiveSession(user.id);

    res.json({
      user: { id: user.id, email: user.email, provider: user.provider },
      accessToken,
      refreshToken,
      hasActiveSession: !!activeSession,
      lastSessionId: activeSession?.id ?? null,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!storedToken) {
      res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      res.status(401).json({ error: 'REFRESH_TOKEN_EXPIRED' });
      return;
    }

    const accessToken = generateAccessToken(storedToken.userId);

    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/google (convenience alias - delegates to signup/login logic)
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      res.status(400).json({ error: 'Invalid Google token' });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { googleSub: payload.sub },
    });

    const isNewUser = !user;

    if (!user) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: payload.email },
      });
      if (existingEmail) {
        res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
        return;
      }

      user = await prisma.user.create({
        data: {
          email: payload.email,
          provider: 'google',
          googleSub: payload.sub,
        },
      });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken);

    const activeSession = await getActiveSession(user.id);

    res.status(isNewUser ? 201 : 200).json({
      user: { id: user.id, email: user.email, provider: user.provider },
      accessToken,
      refreshToken,
      isNewUser,
      hasActiveSession: !!activeSession,
      lastSessionId: activeSession?.id ?? null,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/github - placeholder for GitHub OAuth
router.post('/github', async (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;

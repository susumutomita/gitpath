import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { encrypt } from '../lib/encryption';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/github/oauth/callback';

// POST /api/github/oauth/start - requires auth
router.post('/oauth/start', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user!.userId;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state -> userId+sessionId mapping in Redis (10 min TTL)
    await redis.set(
      `github_oauth_state:${state}`,
      JSON.stringify({ userId, sessionId }),
      'EX',
      600
    );

    const scope = 'repo workflow read:user';
    const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}`;

    res.json({ oauthUrl, state });
  } catch (err) {
    console.error('GitHub OAuth start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/github/oauth/callback - no auth required (comes from GitHub redirect)
router.post('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      res.status(400).json({ error: 'code and state are required' });
      return;
    }

    // Validate state from Redis
    const stateData = await redis.get(`github_oauth_state:${state}`);
    if (!stateData) {
      res.status(401).json({ error: 'GITHUB_AUTH_FAILED', message: 'Invalid or expired state. GitHub認証に失敗しました。再認証してください' });
      return;
    }

    const { userId, sessionId } = JSON.parse(stateData);

    // Delete state token (single use)
    await redis.del(`github_oauth_state:${state}`);

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      scope?: string;
      error?: string;
    };

    if (!tokenData.access_token) {
      res.status(401).json({ error: 'GITHUB_AUTH_FAILED', message: 'GitHub認証に失敗しました。再認証してください' });
      return;
    }

    // Fetch GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      res.status(401).json({ error: 'GITHUB_AUTH_FAILED', message: 'GitHub認証に失敗しました。再認証してください' });
      return;
    }

    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
    };

    // Encrypt and store the access token (AES-256-GCM)
    const encryptedToken = encrypt(tokenData.access_token);

    await prisma.githubCredential.upsert({
      where: { userId },
      update: {
        githubUserId: BigInt(githubUser.id),
        githubUsername: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope: tokenData.scope || '',
      },
      create: {
        userId,
        githubUserId: BigInt(githubUser.id),
        githubUsername: githubUser.login,
        accessTokenEncrypted: encryptedToken,
        scope: tokenData.scope || '',
      },
    });

    // Auto-verify "account" milestone (milestone ID 1)
    const existingMilestone = await prisma.userMilestone.findFirst({
      where: { learningSessionId: sessionId, milestoneId: 1 },
    });

    if (!existingMilestone) {
      await prisma.userMilestone.create({
        data: {
          userId,
          learningSessionId: sessionId,
          milestoneId: 1,
          completed: true,
          completedAt: new Date(),
          verifiedViaGithubApi: true,
          githubApiResponse: { githubUserId: githubUser.id, githubUsername: githubUser.login },
        },
      });
    } else if (!existingMilestone.completed) {
      await prisma.userMilestone.update({
        where: { id: existingMilestone.id },
        data: {
          completed: true,
          completedAt: new Date(),
          verifiedViaGithubApi: true,
          githubApiResponse: { githubUserId: githubUser.id, githubUsername: githubUser.login },
        },
      });
    }

    res.json({
      githubUsername: githubUser.login,
      githubUserId: githubUser.id,
      accessTokenSaved: true,
    });
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

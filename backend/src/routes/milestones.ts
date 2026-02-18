import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encryption';

const router = Router();

router.use(authenticate);

async function callGitHubApi(path: string, accessToken: string): Promise<{ ok: boolean; data: unknown; status: number; rateLimitRemaining?: number; rateLimitReset?: number }> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-remaining') || '-1', 10);
  const rateLimitReset = parseInt(response.headers.get('x-ratelimit-reset') || '0', 10);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, data, status: response.status, rateLimitRemaining, rateLimitReset };
}

async function verifyMilestone(
  milestoneId: number,
  githubVerificationType: string,
  accessToken: string,
  githubUsername: string,
  repoName: string | null,
  prNumber: number | null,
  workflowRunId: number | null
): Promise<{ verified: boolean; apiResponse: unknown }> {
  switch (githubVerificationType) {
    case 'account': {
      const result = await callGitHubApi(`/users/${githubUsername}`, accessToken);
      return { verified: result.ok, apiResponse: result.data };
    }

    case 'repository': {
      if (!repoName) return { verified: false, apiResponse: { error: 'repoName is required' } };
      const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}`, accessToken);
      return { verified: result.ok, apiResponse: result.data };
    }

    case 'commit': {
      if (!repoName) return { verified: false, apiResponse: { error: 'repoName is required' } };
      const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}/commits?per_page=1`, accessToken);
      const commits = result.data;
      const verified = result.ok && Array.isArray(commits) && commits.length > 0;
      return { verified, apiResponse: result.data };
    }

    case 'pull_request': {
      if (!repoName) return { verified: false, apiResponse: { error: 'repoName is required' } };
      if (prNumber) {
        const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}/pulls/${prNumber}`, accessToken);
        return { verified: result.ok, apiResponse: result.data };
      }
      // If no PR number, check if any PRs exist
      const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}/pulls?state=all&per_page=1`, accessToken);
      const prs = result.data;
      const verified = result.ok && Array.isArray(prs) && prs.length > 0;
      return { verified, apiResponse: result.data };
    }

    case 'workflow_run': {
      if (!repoName) return { verified: false, apiResponse: { error: 'repoName is required' } };
      if (workflowRunId) {
        const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}/actions/runs/${workflowRunId}`, accessToken);
        return { verified: result.ok, apiResponse: result.data };
      }
      // Check if any workflow runs exist
      const result = await callGitHubApi(`/repos/${githubUsername}/${repoName}/actions/runs?per_page=1`, accessToken);
      const data = result.data as { total_count?: number; workflow_runs?: unknown[] } | null;
      const verified = result.ok && !!data && (data.total_count ?? 0) > 0;
      return { verified, apiResponse: result.data };
    }

    default:
      return { verified: false, apiResponse: { error: 'Unknown verification type' } };
  }
}

// POST /api/milestones/:milestoneId/verify
router.post('/:milestoneId/verify', async (req: Request, res: Response) => {
  try {
    const milestoneId = parseInt(req.params.milestoneId, 10);
    const { sessionId, githubUsername, repoName, prNumber, workflowRunId } = req.body;
    const userId = req.user!.userId;

    if (!sessionId || !githubUsername) {
      res.status(400).json({ error: 'sessionId and githubUsername are required' });
      return;
    }

    // Look up milestone definition
    const milestoneDefinition = await prisma.milestoneDefinition.findUnique({
      where: { id: milestoneId },
    });
    if (!milestoneDefinition) {
      res.status(404).json({ error: 'MILESTONE_NOT_FOUND' });
      return;
    }

    // Verify session belongs to user
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get GitHub credentials
    const credential = await prisma.githubCredential.findUnique({
      where: { userId },
    });
    if (!credential) {
      res.status(422).json({ error: 'GITHUB_VERIFICATION_FAILED', message: 'GitHub認証が必要です。先にGitHub OAuthを完了してください' });
      return;
    }

    const accessToken = decrypt(credential.accessTokenEncrypted);

    // Check rate limit before making API calls
    const rateLimitCheck = await callGitHubApi('/rate_limit', accessToken);
    if (rateLimitCheck.status === 403 && rateLimitCheck.rateLimitRemaining === 0) {
      const resetAt = rateLimitCheck.rateLimitReset || 0;
      const waitMinutes = Math.ceil((resetAt * 1000 - Date.now()) / 60000);
      res.status(429).json({
        error: 'GITHUB_RATE_LIMITED',
        message: `GitHub APIの制限に達しました。${waitMinutes > 0 ? waitMinutes : 1}分後に再試行してください`,
        retryAfterMinutes: waitMinutes > 0 ? waitMinutes : 1,
      });
      return;
    }

    // Verify via GitHub API
    const { verified, apiResponse } = await verifyMilestone(
      milestoneId,
      milestoneDefinition.githubVerificationType || '',
      accessToken,
      githubUsername,
      repoName || null,
      prNumber || null,
      workflowRunId || null
    );

    if (!verified) {
      res.status(422).json({
        error: 'GITHUB_VERIFICATION_FAILED',
        message: `マイルストーン「${milestoneDefinition.name}」の検証に失敗しました。条件を満たしているか確認してください`,
      });
      return;
    }

    // Upsert the milestone record
    const now = new Date();
    const existingMilestone = await prisma.userMilestone.findUnique({
      where: { learningSessionId_milestoneId: { learningSessionId: sessionId, milestoneId } },
    });

    if (existingMilestone) {
      await prisma.userMilestone.update({
        where: { id: existingMilestone.id },
        data: {
          completed: true,
          completedAt: now,
          verifiedViaGithubApi: true,
          githubApiResponse: apiResponse as object,
        },
      });
    } else {
      await prisma.userMilestone.create({
        data: {
          userId,
          learningSessionId: sessionId,
          milestoneId,
          completed: true,
          completedAt: now,
          verifiedViaGithubApi: true,
          githubApiResponse: apiResponse as object,
        },
      });
    }

    res.json({
      milestoneId,
      verified: true,
      verifiedAt: now.toISOString(),
      githubApiResponse: apiResponse,
    });
  } catch (err) {
    console.error('Milestone verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/milestones/session/:sessionId
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get all milestone definitions
    const definitions = await prisma.milestoneDefinition.findMany({
      orderBy: { stepOrder: 'asc' },
    });

    // Get user milestones for this session
    const userMilestones = await prisma.userMilestone.findMany({
      where: { learningSessionId: sessionId },
    });

    const milestoneMap = new Map(
      userMilestones.map((m) => [m.milestoneId, m])
    );

    const milestones = definitions.map((def) => {
      const userMilestone = milestoneMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        completedAt: userMilestone?.completedAt?.toISOString() || null,
        verifiedViaGitHubApi: userMilestone?.verifiedViaGithubApi || false,
      };
    });

    const allCompleted = milestones.every((m) => m.completedAt !== null);

    res.json({ milestones, allCompleted });
  } catch (err) {
    console.error('Milestones session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

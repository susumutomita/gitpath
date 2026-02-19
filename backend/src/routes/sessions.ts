import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticate);

// POST /api/sessions - Create new or resume session
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { resumeSessionId } = req.body;

    // Resume existing session
    if (resumeSessionId) {
      const existing = await prisma.learningSession.findFirst({
        where: { id: resumeSessionId, userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (existing.status === 'completed') {
        res.status(400).json({ error: 'Session already completed' });
        return;
      }

      // Reactivate if paused/abandoned
      const updated = await prisma.learningSession.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          lastActiveAt: new Date(),
        },
      });

      res.json({
        sessionId: updated.id,
        startedAt: updated.firstStartedAt.toISOString(),
        accumulatedSeconds: updated.accumulatedSeconds,
        currentStep: updated.currentStep,
        isResumed: true,
      });
      return;
    }

    // Check for existing active session - handle device conflict
    const activeSession = await prisma.learningSession.findFirst({
      where: { userId, status: 'active' },
    });

    if (activeSession) {
      // Log device conflict
      const deviceInfo = req.body.deviceInfo || null;
      await prisma.deviceConflictLog.create({
        data: {
          userId,
          learningSessionId: activeSession.id,
          winningDeviceInfo: deviceInfo,
        },
      });

      // Pause the existing session (new device wins)
      await prisma.learningSession.update({
        where: { id: activeSession.id },
        data: { status: 'paused', lastActiveAt: new Date() },
      });
    }

    // Create new session
    const deviceInfo = req.body.deviceInfo || null;
    const session = await prisma.learningSession.create({
      data: {
        userId,
        status: 'active',
        currentStep: 'hearing',
        accumulatedSeconds: 0,
        deviceInfo,
      },
    });

    res.json({
      sessionId: session.id,
      startedAt: session.firstStartedAt.toISOString(),
      accumulatedSeconds: 0,
      currentStep: 'hearing',
      isResumed: false,
    });
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/:sessionId
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get milestones
    const userMilestones = await prisma.userMilestone.findMany({
      where: { learningSessionId: sessionId },
      include: { milestoneDefinition: true },
      orderBy: { milestoneDefinition: { stepOrder: 'asc' } },
    });

    const milestones = userMilestones.map((m) => ({
      id: m.milestoneId,
      name: m.milestoneDefinition.name,
      completedAt: m.completedAt?.toISOString() || null,
      verifiedViaGitHubApi: m.verifiedViaGithubApi,
    }));

    // Get level profile
    const profile = await prisma.userLevelProfile.findUnique({
      where: { learningSessionId: sessionId },
    });

    // Check hearing completion
    const hearingSession = await prisma.hearingSession.findFirst({
      where: { learningSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      sessionId: session.id,
      userId: session.userId,
      status: session.status,
      accumulatedSeconds: session.accumulatedSeconds,
      currentStep: session.currentStep,
      milestones,
      levelEstimate: profile?.levelEstimate || null,
      hearingCompleted: hearingSession?.status === 'completed',
    });
  } catch (err) {
    console.error('Session get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/sessions/:sessionId/step
router.patch('/:sessionId/step', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.params;
    const { currentStep, accumulatedSeconds } = req.body;

    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const updateData: Record<string, unknown> = {
      lastActiveAt: new Date(),
    };

    if (currentStep !== undefined) {
      updateData.currentStep = currentStep;
    }

    if (accumulatedSeconds !== undefined) {
      updateData.accumulatedSeconds = accumulatedSeconds;
    }

    // If step is 'completed', mark session as completed
    if (currentStep === 'completed') {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    await prisma.learningSession.update({
      where: { id: session.id },
      data: updateData,
    });

    res.json({ updated: true });
  } catch (err) {
    console.error('Session step update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

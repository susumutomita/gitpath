import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

import { TOTAL_MILESTONES } from '../lib/constants';

// POST /api/certificates - Generate certificate (authenticated)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
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

    // Check if certificate already exists for this session
    const existing = await prisma.certificate.findUnique({
      where: { learningSessionId: sessionId },
    });
    if (existing) {
      res.json({
        certificateId: existing.id,
        certificateUrl: `/certificate/${existing.id}`,
        alreadyExists: true,
      });
      return;
    }

    // Verify all milestones are completed
    const completedMilestones = await prisma.userMilestone.findMany({
      where: {
        learningSessionId: sessionId,
        completed: true,
      },
      include: {
        milestoneDefinition: true,
      },
    });

    if (completedMilestones.length < TOTAL_MILESTONES) {
      res.status(400).json({
        error: 'NOT_ALL_MILESTONES_COMPLETED',
        message: `全${TOTAL_MILESTONES}マイルストーンを達成する必要があります。現在${completedMilestones.length}個達成済みです。`,
        completedCount: completedMilestones.length,
        totalRequired: TOTAL_MILESTONES,
      });
      return;
    }

    // Get GitHub username
    const credential = await prisma.githubCredential.findUnique({
      where: { userId },
    });
    if (!credential) {
      res.status(400).json({
        error: 'GITHUB_NOT_LINKED',
        message: 'GitHub連携が必要です。',
      });
      return;
    }

    // Build milestone details for the certificate (public-safe data only)
    const milestoneDetails = completedMilestones
      .sort((a, b) => a.milestoneDefinition.stepOrder - b.milestoneDefinition.stepOrder)
      .map((m) => ({
        name: m.milestoneDefinition.name,
        completedAt: m.completedAt?.toISOString() || null,
      }));

    const now = new Date();

    const certificate = await prisma.certificate.create({
      data: {
        learningSessionId: sessionId,
        userId,
        githubUsername: credential.githubUsername,
        elapsedSeconds: session.accumulatedSeconds,
        completedAt: now,
        milestoneDetails,
      },
    });

    // Mark session as completed
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: now,
      },
    });

    res.status(201).json({
      certificateId: certificate.id,
      certificateUrl: `/certificate/${certificate.id}`,
    });
  } catch (err) {
    console.error('Certificate creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/certificates/:certificateId - Public view (no auth required)
router.get('/:certificateId', async (req: Request, res: Response) => {
  try {
    const { certificateId } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!certificate) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    // Return only public-safe data (no userId, no email, no personal info)
    res.json({
      id: certificate.id,
      githubUsername: certificate.githubUsername,
      elapsedSeconds: certificate.elapsedSeconds,
      completedAt: certificate.completedAt.toISOString(),
      milestoneDetails: certificate.milestoneDetails,
      createdAt: certificate.createdAt.toISOString(),
    });
  } catch (err) {
    console.error('Certificate fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

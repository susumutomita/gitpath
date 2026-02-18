import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ptyProcesses } from './terminal';

const router = Router();

router.use(authenticate);

const SANDBOX_BASE = process.env.SANDBOX_BASE_PATH || path.join(process.cwd(), 'sandboxes');

// POST /api/sandbox/reset - Reset sandbox environment
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, terminalSessionId } = req.body;

    if (!sessionId || !terminalSessionId) {
      res.status(400).json({ error: 'sessionId and terminalSessionId are required' });
      return;
    }

    // Verify session
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Verify terminal session
    const terminalSession = await prisma.terminalSession.findFirst({
      where: { id: terminalSessionId, userId },
    });
    if (!terminalSession) {
      res.status(404).json({ error: 'Terminal session not found' });
      return;
    }

    const sandboxPath = terminalSession.sandboxPath || path.join(SANDBOX_BASE, userId, sessionId);

    // Clear sandbox directory contents (but keep the directory)
    if (fs.existsSync(sandboxPath)) {
      const entries = fs.readdirSync(sandboxPath);
      for (const entry of entries) {
        const fullPath = path.join(sandboxPath, entry);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } else {
      fs.mkdirSync(sandboxPath, { recursive: true });
    }

    // Reset pty working directory (shell-escape the path to prevent injection)
    const ptyProcess = ptyProcesses.get(terminalSessionId);
    if (ptyProcess) {
      const escapedPath = sandboxPath.replace(/'/g, "'\\''");
      ptyProcess.write(`cd '${escapedPath}'\r`);
    }

    res.json({ reset: true });
  } catch (err) {
    console.error('Sandbox reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sandbox/events - Save sandbox operation event logs
router.post('/events', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, eventType, stepName, durationMs, metadata } = req.body;

    if (!sessionId || !eventType || !stepName) {
      res.status(400).json({ error: 'sessionId, eventType, and stepName are required' });
      return;
    }

    const validEventTypes = ['click_stop', 'file_edit', 'file_save', 'version_loss', 'git_demo'];
    if (!validEventTypes.includes(eventType)) {
      res.status(400).json({ error: `eventType must be one of: ${validEventTypes.join(', ')}` });
      return;
    }

    // Verify session
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const event = await prisma.sandboxEvent.create({
      data: {
        learningSessionId: sessionId,
        userId,
        eventType,
        stepName,
        durationMs: durationMs || null,
        metadata: metadata || null,
      },
    });

    res.json({ eventId: event.id });
  } catch (err) {
    console.error('Sandbox event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sandbox/understanding - Save Git understanding response
router.post('/understanding', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, understands, freeText } = req.body;

    if (!sessionId || understands === undefined) {
      res.status(400).json({ error: 'sessionId and understands are required' });
      return;
    }

    // Verify session
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await prisma.gitUnderstandingResponse.create({
      data: {
        learningSessionId: sessionId,
        userId,
        understands: !!understands,
        freeText: freeText || null,
      },
    });

    res.json({ saved: true });
  } catch (err) {
    console.error('Sandbox understanding error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

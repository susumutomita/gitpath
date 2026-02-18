import { Router, Request, Response } from 'express';
import * as pty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.use(authenticate);

// In-memory map of active pty processes (per this server instance)
export const ptyProcesses = new Map<string, pty.IPty>();

const SANDBOX_BASE = process.env.SANDBOX_BASE_PATH || path.join(process.cwd(), 'sandboxes');

function ensureSandboxDir(sandboxPath: string): void {
  if (!fs.existsSync(sandboxPath)) {
    fs.mkdirSync(sandboxPath, { recursive: true });
  }
}

// POST /api/terminal/sessions - Create terminal session with node-pty
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, cols, rows } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    // Verify learning session
    const learningSession = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!learningSession) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Create sandbox directory
    const sandboxPath = path.join(SANDBOX_BASE, userId, sessionId);
    ensureSandboxDir(sandboxPath);

    // Spawn pty process
    const shell = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
    const termCols = cols || 80;
    const termRows = rows || 24;

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: termCols,
      rows: termRows,
      cwd: sandboxPath,
      env: {
        HOME: sandboxPath,
        TERM: 'xterm-256color',
        PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        SHELL: shell,
        LANG: process.env.LANG || 'en_US.UTF-8',
        USER: 'sandbox',
      },
    });

    // Create DB record
    const terminalSession = await prisma.terminalSession.create({
      data: {
        learningSessionId: sessionId,
        userId,
        processPid: ptyProcess.pid,
        sandboxPath,
        status: 'active',
        cols: termCols,
        rows: termRows,
      },
    });

    // Store process in memory
    ptyProcesses.set(terminalSession.id, ptyProcess);

    // Store session mapping in Redis for WebSocket lookup
    await redis.set(
      `terminal:${terminalSession.id}`,
      JSON.stringify({ userId, learningSessionId: sessionId, pid: ptyProcess.pid }),
      'EX',
      86400 // 24h TTL
    );

    const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    const wsHost = process.env.WS_HOST || 'localhost:3001';

    res.json({
      terminalSessionId: terminalSession.id,
      wsEndpoint: `${wsProtocol}://${wsHost}/ws/terminal/${terminalSession.id}`,
      sandboxPath,
    });
  } catch (err) {
    console.error('Terminal session create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/terminal/sessions/:terminalSessionId - Terminate terminal session
router.delete('/sessions/:terminalSessionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { terminalSessionId } = req.params;

    const terminalSession = await prisma.terminalSession.findFirst({
      where: { id: terminalSessionId, userId },
    });
    if (!terminalSession) {
      res.status(404).json({ error: 'Terminal session not found' });
      return;
    }

    // Kill pty process
    const ptyProcess = ptyProcesses.get(terminalSessionId);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcesses.delete(terminalSessionId);
    }

    // Update DB
    await prisma.terminalSession.update({
      where: { id: terminalSessionId },
      data: { status: 'terminated' },
    });

    // Clean up Redis
    await redis.del(`terminal:${terminalSessionId}`);

    res.json({ terminated: true });
  } catch (err) {
    console.error('Terminal session delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

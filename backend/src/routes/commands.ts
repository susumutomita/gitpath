import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.use(authenticate);

// Dangerous command patterns to block
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\//, reason: 'ルートディレクトリの削除は禁止されています' },
  { pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f|rm\s+-[a-zA-Z]*f[a-zA-Z]*r/, reason: '再帰的な強制削除は危険です' },
  { pattern: /\bsudo\b/, reason: 'sudoコマンドはこの環境では使用できません' },
  { pattern: /\bchmod\s+777\b/, reason: 'パーミッション777の設定は危険です' },
  { pattern: /\b(mkfs|fdisk)\b|\bdd\s+if=/, reason: 'ディスク操作コマンドは使用できません' },
  { pattern: /\b(shutdown|reboot|halt|poweroff)\b/, reason: 'システム制御コマンドは使用できません' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: 'デバイスへの直接書き込みは禁止されています' },
  { pattern: /\|.*\b(bash|sh|zsh)\b.*<<</, reason: 'ヒアストリングによるシェル実行は制限されています' },
  { pattern: /:\(\)\s*\{.*:\|:.*\}/, reason: 'フォーク爆弾は禁止されています' },
  { pattern: /\bkill\s+-9\s+(-1|1)\b/, reason: '全プロセスのkillは禁止されています' },
  { pattern: /\bcurl\b.*\|\s*(bash|sh)/, reason: 'リモートスクリプトの直接実行は危険です' },
  { pattern: /\bwget\b.*\|\s*(bash|sh)/, reason: 'リモートスクリプトの直接実行は危険です' },
];

function validateCommand(command: string): { allowed: boolean; reason: string | null } {
  const trimmed = command.trim();

  if (!trimmed) {
    return { allowed: true, reason: null };
  }

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason };
    }
  }

  return { allowed: true, reason: null };
}

// POST /api/command/validate - Pre-validate dangerous commands
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { command, sessionId } = req.body;

    if (!command || !sessionId) {
      res.status(400).json({ error: 'command and sessionId are required' });
      return;
    }

    const userId = req.user!.userId;

    // Verify session
    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const result = validateCommand(command);

    res.json({
      allowed: result.allowed,
      reason: result.reason,
    });
  } catch (err) {
    console.error('Command validate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/command/errors - Log command errors, detect consecutive errors
router.post('/errors', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, command, stderr, consecutiveCount, stepId } = req.body;

    if (!sessionId || !command) {
      res.status(400).json({ error: 'sessionId and command are required' });
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

    // Find active terminal session for this learning session
    const terminalSession = await prisma.terminalSession.findFirst({
      where: { learningSessionId: sessionId, userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    // Log the command error
    if (terminalSession) {
      await prisma.commandLog.create({
        data: {
          terminalSessionId: terminalSession.id,
          learningSessionId: sessionId,
          commandText: command,
          stderr: stderr || null,
          exitCode: 1,
          isBlocked: false,
          consecutiveErrorCount: consecutiveCount || 1,
        },
      });
    }

    // Determine if AI should intervene
    const errorCount = consecutiveCount || 1;
    const shouldIntervene = errorCount >= 3;

    res.json({
      errorLogId: terminalSession ? terminalSession.id : null,
      shouldIntervene,
      interventionMode: shouldIntervene ? 'decompose' : null,
    });
  } catch (err) {
    console.error('Command error log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export validateCommand for use in WebSocket terminal handler
export { validateCommand };

export default router;

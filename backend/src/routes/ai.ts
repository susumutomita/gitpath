import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getOpenAI } from '../lib/openai';
import { AI_TIMEOUT_MS } from '../lib/constants';

const router = Router();

router.use(authenticate);

function buildExplainPrompt(
  requestType: string,
  stepId: string,
  context: string,
  levelEstimate: string | null,
  occupation: string | null,
  domainKeywords: unknown,
  errorOutput: string | null,
  consecutiveErrors: number
): string {
  const level = levelEstimate || 'beginner';
  const occupationText = occupation || '一般ユーザー';
  const keywords = Array.isArray(domainKeywords) ? domainKeywords.join(', ') : '';

  const baseContext = `ユーザー情報: レベル=${level}, 職業=${occupationText}${keywords ? `, ドメインキーワード=${keywords}` : ''}
現在のステップ: ${stepId}
コンテキスト: ${context}`;

  switch (requestType) {
    case 'explain':
      return `${baseContext}

あなたはGit/CI/CDの初学者向けメンターです。上記ユーザーの職業やドメイン知識に合わせた比喩を使って、現在のステップを日本語で分かりやすく説明してください。技術用語は避け、中学生レベルの語彙で説明してください。

以下のJSON形式で回答してください:
{"explanation": "説明文", "suggestedCommand": "次に実行すべきコマンド（あれば）", "metaphor": "職業に合わせた比喩（あれば）"}`;

    case 'simplify':
      return `${baseContext}

ユーザーが「わからない」「もう少し詳しく」と言っています。前回の説明をさらに平易にし、ユーザーの職業(${occupationText})に紐づいた具体的な比喩を使って、もう一度日本語で説明してください。専門用語は一切使わないでください。

以下のJSON形式で回答してください:
{"explanation": "より平易な説明文", "suggestedCommand": "次に実行すべきコマンド（あれば）", "metaphor": "職業に合わせた比喩"}`;

    case 'error_help':
      return `${baseContext}
エラー出力: ${errorOutput || 'なし'}
連続エラー回数: ${consecutiveErrors}

ユーザーがコマンド実行でエラーになりました。以下の2点を必ず含めて日本語で説明してください:
1. 何がまずかったか（技術用語を使わず）
2. 次に何をすべきか
${consecutiveErrors >= 3 ? '\nユーザーは3回以上連続でミスしています。「一緒に確認しましょう」と声をかけ、コマンドを1要素ずつ分解して説明してください。' : ''}

以下のJSON形式で回答してください:
{"explanation": "エラーの説明と修正方法", "suggestedCommand": "修正コマンド", "metaphor": null}`;

    case 'reexplain':
      return `${baseContext}

前回の説明でユーザーが理解できませんでした。全く異なるアプローチと比喩を使って、もう一度日本語で説明してください。ユーザーの職業(${occupationText})の日常業務に例えると特に効果的です。

以下のJSON形式で回答してください:
{"explanation": "別のアプローチの説明文", "suggestedCommand": "次に実行すべきコマンド（あれば）", "metaphor": "別の比喩"}`;

    default:
      return `${baseContext}\n\n現在のステップを日本語で分かりやすく説明してください。\n以下のJSON形式で回答してください:\n{"explanation": "説明文", "suggestedCommand": null, "metaphor": null}`;
  }
}

function isContentSafe(text: string): boolean {
  const harmfulPatterns = [
    /自殺|自害/,
    /殺[す害]/,
    /爆弾|爆発物/,
    /違法薬物/,
    /児童ポルノ/,
  ];
  return !harmfulPatterns.some((p) => p.test(text));
}

// POST /api/ai/explain
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { sessionId, stepId, context, requestType, errorOutput, consecutiveErrors } = req.body;
    const userId = req.user!.userId;

    if (!sessionId || !stepId || !requestType) {
      res.status(400).json({ error: 'sessionId, stepId, and requestType are required' });
      return;
    }

    const validTypes = ['explain', 'simplify', 'error_help', 'reexplain'];
    if (!validTypes.includes(requestType)) {
      res.status(400).json({ error: `requestType must be one of: ${validTypes.join(', ')}` });
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

    // Get user level profile for personalization
    const profile = await prisma.userLevelProfile.findUnique({
      where: { learningSessionId: sessionId },
    });

    const prompt = buildExplainPrompt(
      requestType,
      stepId,
      context || '',
      profile?.levelEstimate || null,
      profile?.occupation || null,
      profile?.domainKeywords || null,
      errorOutput || null,
      consecutiveErrors || 0
    );

    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    let aiResponse: string | null = null;
    let apiError = false;
    let isFiltered = false;

    try {
      const completion = await getOpenAI().chat.completions.create(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'あなたは非エンジニア向けのGit/CI/CD学習メンターです。常に日本語で回答し、JSONフォーマットで返してください。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );

      aiResponse = completion.choices[0]?.message?.content || null;
    } catch (err: unknown) {
      apiError = true;
      if (err instanceof Error && err.name === 'AbortError') {
        // Timeout - will be handled below
      }
    } finally {
      clearTimeout(timeout);
    }

    const responseTimeMs = Date.now() - startTime;

    // Content safety check
    if (aiResponse && !isContentSafe(aiResponse)) {
      isFiltered = true;
      aiResponse = null;
    }

    // Log the AI interaction
    await prisma.aiExplanationLog.create({
      data: {
        learningSessionId: sessionId,
        stepId,
        requestType,
        promptSent: prompt,
        responseReceived: aiResponse,
        responseTimeMs,
        isFiltered,
        apiError,
      },
    });

    if (apiError || !aiResponse) {
      const errorMessage = isFiltered
        ? '説明を生成できませんでした'
        : 'AIが応答できていません、再試行してください';
      res.status(503).json({ error: 'AI_API_UNAVAILABLE', message: errorMessage });
      return;
    }

    let parsed: { explanation?: string; suggestedCommand?: string | null; metaphor?: string | null };
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      parsed = { explanation: aiResponse, suggestedCommand: null, metaphor: null };
    }

    res.json({
      explanation: parsed.explanation || aiResponse,
      suggestedCommand: parsed.suggestedCommand || null,
      metaphor: parsed.metaphor || null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('AI explain error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ai/generate-yaml
router.post('/generate-yaml', async (req: Request, res: Response) => {
  try {
    const { sessionId, repoName, projectType } = req.body;
    const userId = req.user!.userId;

    if (!sessionId || !repoName) {
      res.status(400).json({ error: 'sessionId and repoName are required' });
      return;
    }

    const session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const profile = await prisma.userLevelProfile.findUnique({
      where: { learningSessionId: sessionId },
    });

    const prompt = `リポジトリ名: ${repoName}
プロジェクトタイプ: ${projectType || '一般的なWebプロジェクト'}
ユーザーレベル: ${profile?.levelEstimate || 'beginner'}

上記のリポジトリ用にGitHub Actions CIワークフローのYAMLファイルを生成してください。
初心者が理解しやすいシンプルな構成にし、各ステップにコメントを日本語で付けてください。

以下のJSON形式で回答してください:
{"yamlContent": "YAMLファイルの内容", "fileName": ".github/workflows/ci.yml", "explanation": "このCI/CD設定の日本語の説明"}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    let aiResponse: string | null = null;
    const startTime = Date.now();

    try {
      const completion = await getOpenAI().chat.completions.create(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'あなたはGitHub Actionsの専門家です。初心者向けの分かりやすいCI/CD設定を生成してください。常に日本語でコメントし、JSONフォーマットで返してください。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );

      aiResponse = completion.choices[0]?.message?.content || null;
    } catch {
      // timeout or API error
    } finally {
      clearTimeout(timeout);
    }

    const responseTimeMs = Date.now() - startTime;

    if (!aiResponse) {
      res.status(503).json({ error: 'AI_API_UNAVAILABLE', message: 'AIが応答できていません、再試行してください' });
      return;
    }

    // Log the interaction
    await prisma.aiExplanationLog.create({
      data: {
        learningSessionId: sessionId,
        stepId: 'generate-yaml',
        requestType: 'generate_yaml',
        promptSent: prompt,
        responseReceived: aiResponse,
        responseTimeMs,
        isFiltered: false,
        apiError: false,
      },
    });

    let parsed: { yamlContent?: string; fileName?: string; explanation?: string };
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      parsed = { yamlContent: aiResponse, fileName: '.github/workflows/ci.yml', explanation: '' };
    }

    res.json({
      yamlContent: parsed.yamlContent || '',
      fileName: parsed.fileName || '.github/workflows/ci.yml',
      explanation: parsed.explanation || '',
    });
  } catch (err) {
    console.error('AI generate-yaml error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

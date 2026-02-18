import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getOpenAI } from '../lib/openai';
import { AI_TIMEOUT_MS, TOTAL_HEARING_QUESTIONS } from '../lib/constants';

const router = Router();

router.use(authenticate);

const TOTAL_QUESTIONS = TOTAL_HEARING_QUESTIONS;

const HEARING_QUESTIONS: string[] = [
  'はじめまして！まず、あなたのお仕事や普段の活動について教えてください。（例: 研究者、デザイナー、営業、学生など）',
  'パソコンはどのくらい使い慣れていますか？普段どんな作業をしていますか？（例: メールとExcelくらい、プレゼン資料をよく作る、など）',
  'プログラミングやコードを書いた経験はありますか？あれば、どんなことをしましたか？（全くない場合は「なし」とお答えください）',
  'これから作ってみたいもの、実現したいアイデアはありますか？ざっくりとしたイメージで構いません。',
  'Git、GitHub、CI/CDという言葉を聞いたことがありますか？もしあれば、どんなイメージを持っていますか？',
];

// Mask personal information from user input
function maskPersonalInfo(text: string): string {
  // Mask email addresses
  let masked = text.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[メールアドレス]');
  // Mask phone numbers (Japanese format)
  masked = masked.replace(/\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/g, '[電話番号]');
  // Mask potential names in specific patterns (e.g., "私の名前はXXです")
  masked = masked.replace(/(?:名前は|私は)([^\s,。、]{2,10})(?:です|と申します)/g, (_, name) => {
    return `名前は[氏名]です`;
  });
  return masked;
}

async function generateNextQuestion(
  questionNumber: number,
  previousAnswers: { questionNumber: number; questionText: string; answerText: string | null }[]
): Promise<string> {
  // Use predefined questions as base, but allow AI to personalize follow-ups
  if (questionNumber <= TOTAL_QUESTIONS) {
    return HEARING_QUESTIONS[questionNumber - 1];
  }
  return HEARING_QUESTIONS[TOTAL_QUESTIONS - 1];
}

async function generateCurriculum(
  answers: { questionNumber: number; questionText: string; answerText: string | null; isSkipped: boolean }[]
): Promise<{
  levelEstimate: string;
  occupation: string | null;
  pcExperienceYears: number | null;
  programmingExperience: string | null;
  productIdeaSummary: string | null;
  domainKeywords: string[];
  curriculum: {
    steps: { stepId: string; title: string; estimatedMinutes: number; isSkippable: boolean }[];
    emphasizedConcepts: string[];
    skippedSteps: string[];
    personalizedIntro: string;
  };
}> {
  const answersText = answers
    .map((a) => `Q${a.questionNumber}: ${a.questionText}\nA${a.questionNumber}: ${a.isSkipped ? '(スキップ)' : a.answerText || '(未回答)'}`)
    .join('\n\n');

  const prompt = `以下はユーザーへのヒアリング回答です。この情報をもとに、ユーザーのレベル推定とカスタムカリキュラムを生成してください。

${answersText}

以下のJSON形式で回答してください:
{
  "levelEstimate": "beginner" | "intermediate" | "advanced",
  "occupation": "推定される職業（個人名・機関名を含めないこと）",
  "pcExperienceYears": 数値またはnull,
  "programmingExperience": "none" | "basic" | "intermediate" | "advanced",
  "productIdeaSummary": "作りたいもののサマリー（個人特定情報はマスキング）",
  "domainKeywords": ["職業ドメインキーワード1", "キーワード2"],
  "curriculum": {
    "steps": [
      {"stepId": "sandbox_experience", "title": "概念体感: ファイルのバージョン管理を体験", "estimatedMinutes": 5, "isSkippable": false},
      {"stepId": "github_account", "title": "GitHubアカウント作成", "estimatedMinutes": 3, "isSkippable": false},
      {"stepId": "create_repo", "title": "リポジトリ作成", "estimatedMinutes": 3, "isSkippable": false},
      {"stepId": "first_commit", "title": "最初のコミット", "estimatedMinutes": 5, "isSkippable": false},
      {"stepId": "pull_request", "title": "プルリクエスト作成", "estimatedMinutes": 5, "isSkippable": true},
      {"stepId": "ci_cd_setup", "title": "CI/CD設定 (GitHub Actions)", "estimatedMinutes": 5, "isSkippable": true}
    ],
    "emphasizedConcepts": ["強調すべき概念1", "概念2"],
    "skippedSteps": ["上級者の場合にスキップ可能なステップID"],
    "personalizedIntro": "ユーザーの職業に合わせたパーソナライズされた導入文"
  }
}

重要:
- levelEstimateは回答内容がほぼなければ "beginner" にしてください
- personalizedIntroにはユーザーの職業ドメインに合わせた比喩を使ってください
- 個人名・機関名はマスキングしてください
- 回答がすべてスキップされた場合はデフォルト（beginner・一般職）で生成してください`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'あなたは非エンジニア向けのGit/CI/CD学習プラットフォームのカリキュラム設計者です。ユーザーのヒアリング回答を分析し、最適な学習カリキュラムを設計してください。常にJSON形式で回答してください。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    const content = completion.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch {
    // AI timeout or error - fall through to default
  } finally {
    clearTimeout(timeout);
  }

  // Default curriculum for when AI fails
  return {
    levelEstimate: 'beginner',
    occupation: null,
    pcExperienceYears: null,
    programmingExperience: 'none',
    productIdeaSummary: null,
    domainKeywords: [],
    curriculum: {
      steps: [
        { stepId: 'sandbox_experience', title: '概念体感: ファイルのバージョン管理を体験', estimatedMinutes: 5, isSkippable: false },
        { stepId: 'github_account', title: 'GitHubアカウント作成', estimatedMinutes: 3, isSkippable: false },
        { stepId: 'create_repo', title: 'リポジトリ作成', estimatedMinutes: 3, isSkippable: false },
        { stepId: 'first_commit', title: '最初のコミット', estimatedMinutes: 5, isSkippable: false },
        { stepId: 'pull_request', title: 'プルリクエスト作成', estimatedMinutes: 5, isSkippable: false },
        { stepId: 'ci_cd_setup', title: 'CI/CD設定 (GitHub Actions)', estimatedMinutes: 5, isSkippable: false },
      ],
      emphasizedConcepts: ['バージョン管理の必要性', 'Gitの基本操作', 'CI/CDの概念'],
      skippedSteps: [],
      personalizedIntro: 'これからGitとCI/CDの基本を、ステップバイステップで一緒に学んでいきましょう。難しい用語は使わず、実際に手を動かしながら進めていきます。',
    },
  };
}

// POST /api/hearing/start
router.post('/start', async (req: Request, res: Response) => {
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

    // Check if hearing already exists for this session
    const existingHearing = await prisma.hearingSession.findFirst({
      where: { learningSessionId: sessionId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingHearing && existingHearing.status === 'completed') {
      res.status(400).json({ error: 'Hearing already completed for this session' });
      return;
    }

    // Reuse existing in-progress hearing or create new
    let hearingSession;
    if (existingHearing && existingHearing.status === 'in_progress') {
      hearingSession = existingHearing;
    } else {
      hearingSession = await prisma.hearingSession.create({
        data: {
          learningSessionId: sessionId,
          userId,
          status: 'in_progress',
        },
      });
    }

    // Check if there are already answers (resuming)
    const existingAnswers = await prisma.hearingAnswer.findMany({
      where: { hearingSessionId: hearingSession.id },
      orderBy: { questionNumber: 'asc' },
    });

    const nextQuestionNumber = existingAnswers.length > 0
      ? existingAnswers[existingAnswers.length - 1].questionNumber + 1
      : 1;

    if (nextQuestionNumber > TOTAL_QUESTIONS) {
      // All questions already answered
      res.status(400).json({ error: 'All questions already answered' });
      return;
    }

    const firstQuestion = await generateNextQuestion(nextQuestionNumber, []);

    res.json({
      hearingSessionId: hearingSession.id,
      firstQuestion,
      questionNumber: nextQuestionNumber,
      totalQuestions: TOTAL_QUESTIONS,
    });
  } catch (err) {
    console.error('Hearing start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/hearing/:hearingSessionId/answer
router.post('/:hearingSessionId/answer', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { hearingSessionId } = req.params;
    const { questionNumber, answerText, isSkipped } = req.body;

    if (!questionNumber) {
      res.status(400).json({ error: 'questionNumber is required' });
      return;
    }

    if (questionNumber < 1 || questionNumber > TOTAL_QUESTIONS) {
      res.status(400).json({ error: `questionNumber must be between 1 and ${TOTAL_QUESTIONS}` });
      return;
    }

    // Verify hearing session belongs to user
    const hearingSession = await prisma.hearingSession.findFirst({
      where: { id: hearingSessionId, userId },
    });
    if (!hearingSession) {
      res.status(404).json({ error: 'Hearing session not found' });
      return;
    }

    if (hearingSession.status === 'completed') {
      res.status(400).json({ error: 'Hearing session already completed' });
      return;
    }

    // Mask personal info before saving
    const maskedAnswer = answerText ? maskPersonalInfo(answerText) : null;

    // Get the question text for this question number
    const questionText = HEARING_QUESTIONS[questionNumber - 1] || `Question ${questionNumber}`;

    // Save or update the answer
    await prisma.hearingAnswer.upsert({
      where: {
        hearingSessionId_questionNumber: {
          hearingSessionId,
          questionNumber,
        },
      },
      update: {
        answerText: isSkipped ? null : maskedAnswer,
        isSkipped: !!isSkipped,
        questionText,
      },
      create: {
        hearingSessionId,
        questionNumber,
        questionText,
        answerText: isSkipped ? null : maskedAnswer,
        isSkipped: !!isSkipped,
      },
    });

    // Check if this was the last question
    if (questionNumber >= TOTAL_QUESTIONS) {
      // Complete hearing and generate curriculum
      await prisma.hearingSession.update({
        where: { id: hearingSessionId },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Get all answers for curriculum generation
      const allAnswers = await prisma.hearingAnswer.findMany({
        where: { hearingSessionId },
        orderBy: { questionNumber: 'asc' },
      });

      const answersForAI = allAnswers.map((a) => ({
        questionNumber: a.questionNumber,
        questionText: a.questionText,
        answerText: a.answerText,
        isSkipped: a.isSkipped,
      }));

      const result = await generateCurriculum(answersForAI);

      // Save user level profile
      await prisma.userLevelProfile.upsert({
        where: { learningSessionId: hearingSession.learningSessionId },
        update: {
          levelEstimate: result.levelEstimate,
          occupation: result.occupation,
          pcExperienceYears: result.pcExperienceYears,
          programmingExperience: result.programmingExperience,
          productIdeaSummary: result.productIdeaSummary,
          domainKeywords: result.domainKeywords,
          curriculum: result.curriculum as object,
        },
        create: {
          userId,
          learningSessionId: hearingSession.learningSessionId,
          levelEstimate: result.levelEstimate,
          occupation: result.occupation,
          pcExperienceYears: result.pcExperienceYears,
          programmingExperience: result.programmingExperience,
          productIdeaSummary: result.productIdeaSummary,
          domainKeywords: result.domainKeywords,
          curriculum: result.curriculum as object,
        },
      });

      // Update learning session step
      await prisma.learningSession.update({
        where: { id: hearingSession.learningSessionId },
        data: { currentStep: 'curriculum' },
      });

      res.json({
        status: 'complete',
        nextQuestion: null,
        questionNumber: null,
        curriculum: {
          levelEstimate: result.levelEstimate,
          steps: result.curriculum.steps,
          emphasizedConcepts: result.curriculum.emphasizedConcepts,
          skippedSteps: result.curriculum.skippedSteps,
          personalizedIntro: result.curriculum.personalizedIntro,
        },
      });
      return;
    }

    // Not the last question - return next question
    const previousAnswers = await prisma.hearingAnswer.findMany({
      where: { hearingSessionId },
      orderBy: { questionNumber: 'asc' },
    });

    const nextQuestionNumber = questionNumber + 1;
    const nextQuestion = await generateNextQuestion(
      nextQuestionNumber,
      previousAnswers.map((a) => ({
        questionNumber: a.questionNumber,
        questionText: a.questionText,
        answerText: a.answerText,
      }))
    );

    res.json({
      status: 'continue',
      nextQuestion,
      questionNumber: nextQuestionNumber,
      curriculum: null,
    });
  } catch (err) {
    console.error('Hearing answer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/hearing/:hearingSessionId/previous
router.get('/:hearingSessionId/previous', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { hearingSessionId } = req.params;

    // Verify hearing session belongs to user
    const hearingSession = await prisma.hearingSession.findFirst({
      where: { id: hearingSessionId, userId },
    });
    if (!hearingSession) {
      res.status(404).json({ error: 'Hearing session not found' });
      return;
    }

    const answers = await prisma.hearingAnswer.findMany({
      where: { hearingSessionId },
      orderBy: { questionNumber: 'asc' },
    });

    // Get curriculum if hearing is completed
    let curriculum = null;
    if (hearingSession.status === 'completed') {
      const profile = await prisma.userLevelProfile.findUnique({
        where: { learningSessionId: hearingSession.learningSessionId },
      });
      curriculum = profile?.curriculum || null;
    }

    res.json({
      answers: answers.map((a) => ({
        questionNumber: a.questionNumber,
        questionText: a.questionText,
        answerText: a.answerText,
        answeredAt: a.answeredAt.toISOString(),
      })),
      curriculum,
    });
  } catch (err) {
    console.error('Hearing previous error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

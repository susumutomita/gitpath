"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { MilestoneProgressBar } from "@/components/learning/MilestoneProgressBar";
import { CommandSuggestion } from "@/components/terminal/CommandSuggestion";
import { StepGuide } from "@/components/terminal/StepGuide";
import { ErrorHelper } from "@/components/terminal/ErrorHelper";
import { useTimerStore } from "@/stores/timerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";

const TerminalView = dynamic(
  () =>
    import("@/components/terminal/TerminalView").then(
      (mod) => mod.TerminalView
    ),
  { ssr: false, loading: () => <TerminalLoading /> }
);

function TerminalLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-gray-700 bg-[#1e1e2e]">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        <p className="text-sm text-gray-400">ターミナルを準備中...</p>
      </div>
    </div>
  );
}

const LEARNING_STEPS = [
  { id: "github-account", title: "GitHubアカウント確認", status: "completed" as const },
  { id: "git-init", title: "リポジトリを作成する", status: "current" as const },
  { id: "first-commit", title: "最初のコミット", status: "upcoming" as const },
  { id: "pull-request", title: "プルリクエストを作成", status: "upcoming" as const },
  { id: "ci-cd", title: "CI/CDを設定する", status: "upcoming" as const },
];

export default function TerminalPage() {
  const { startTimer } = useTimerStore();
  const { sessionId, milestones } = useSessionStore();

  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    explanation: string;
    count: number;
  } | null>(null);

  const [aiExplanation, setAiExplanation] = useState<string>(
    "リポジトリ（repository）は「保管庫」という意味です。あなたのファイルとその変更履歴がすべてここに保存されます。略して「リポ」や「repo」と呼ばれることもあります。"
  );

  const [suggestedCommand, setSuggestedCommand] = useState({
    command: "git init my-project",
    description:
      "新しいGitリポジトリを作成するコマンドです。「my-project」という名前のフォルダが作られ、その中でバージョン管理が始まります。",
  });

  const [wsEndpoint, setWsEndpoint] = useState<string | null>(null);
  const consecutiveErrors = useRef(0);

  useEffect(() => {
    startTimer();
  }, [startTimer]);

  // Create terminal session on mount
  useEffect(() => {
    if (!sessionId) return;

    api
      .post<{
        terminalSessionId: string;
        wsEndpoint: string;
        sandboxPath: string;
      }>("/terminal/sessions", { sessionId })
      .then((data) => {
        setWsEndpoint(data.wsEndpoint);
      })
      .catch(() => {
        // Terminal session creation may fail if node-pty not available
      });
  }, [sessionId]);

  const handleTerminalData = useCallback(
    async (data: string) => {
      if (!sessionId) return;

      // Validate command before execution
      const trimmed = data.trim();
      if (!trimmed) return;

      try {
        const validation = await api.post<{
          allowed: boolean;
          reason: string | null;
        }>("/commands/validate", {
          command: trimmed,
          sessionId,
        });

        if (!validation.allowed) {
          setErrorInfo({
            message: trimmed,
            explanation: validation.reason || "このコマンドは使用できません",
            count: 0,
          });
          return;
        }
      } catch {
        // Allow command if validation endpoint fails
      }
    },
    [sessionId]
  );

  const handleRequestDetail = useCallback(async () => {
    if (!sessionId) return;

    try {
      const result = await api.post<{
        explanation: string;
        suggestedCommand: string | null;
        metaphor: string | null;
      }>("/ai/explain", {
        sessionId,
        stepId: "git-init",
        context: "User requested more detail",
        requestType: "simplify",
      });

      setAiExplanation(result.explanation);
      if (result.suggestedCommand) {
        setSuggestedCommand({
          command: result.suggestedCommand,
          description: result.explanation,
        });
      }
    } catch {
      // Keep existing explanation if API fails
    }
  }, [sessionId]);

  const handleErrorDetail = useCallback(async () => {
    if (!sessionId || !errorInfo) return;

    try {
      const result = await api.post<{
        explanation: string;
        suggestedCommand: string | null;
      }>("/ai/explain", {
        sessionId,
        stepId: "git-init",
        context: errorInfo.message,
        requestType: "error_help",
        errorOutput: errorInfo.message,
        consecutiveErrors: errorInfo.count,
      });

      setErrorInfo((prev) =>
        prev ? { ...prev, explanation: result.explanation } : null
      );
    } catch {
      // Keep existing error info
    }
  }, [sessionId, errorInfo]);

  return (
    <>
      <Header showTimer />

      {/* Progress Bar */}
      <div className="border-b bg-white px-4">
        <div className="mx-auto max-w-7xl">
          <MilestoneProgressBar
            milestones={
              milestones.length > 0
                ? milestones
                : [
                    { id: "github-account", name: "GitHubアカウント作成", completed: true },
                    { id: "repository", name: "リポジトリ作成", completed: false },
                    { id: "commit", name: "コミット", completed: false },
                    { id: "pull-request", name: "PR", completed: false },
                    { id: "ci-cd", name: "CI/CD", completed: false },
                  ]
            }
          />
        </div>
      </div>

      {/* Main Layout: Terminal (60%) + Guide (40%) */}
      <main className="flex flex-1 overflow-hidden">
        {/* Terminal Side */}
        <div className="relative flex w-[60%] flex-col gap-4 border-r p-4">
          <TerminalView wsEndpoint={wsEndpoint} onData={handleTerminalData} />

          {/* Command Suggestion */}
          <CommandSuggestion
            command={suggestedCommand.command}
            description={suggestedCommand.description}
          />

          {/* Error Helper Overlay */}
          {errorInfo && (
            <ErrorHelper
              errorMessage={errorInfo.message}
              aiExplanation={errorInfo.explanation}
              consecutiveErrors={errorInfo.count}
              onRequestDetail={handleErrorDetail}
              onClose={() => {
                setErrorInfo(null);
                consecutiveErrors.current = 0;
              }}
            />
          )}
        </div>

        {/* Guide Side */}
        <div className="w-[40%] overflow-y-auto bg-gray-50 p-4">
          <StepGuide
            currentStepTitle="リポジトリを作成しよう"
            currentStepDescription="Gitでバージョン管理を始めるには、まず「リポジトリ」を作成します。リポジトリとは、ファイルの変更履歴を保管する場所のことです。"
            steps={LEARNING_STEPS}
            aiExplanation={aiExplanation}
            onRequestDetail={handleRequestDetail}
          />
        </div>
      </main>
    </>
  );
}

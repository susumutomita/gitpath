"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatInterface, type ChatMessage } from "@/components/chat/ChatInterface";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { useHearingStore } from "@/stores/hearingStore";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SkipForward } from "lucide-react";

const TOTAL_QUESTIONS = 5;

export default function HearingPage() {
  const router = useRouter();
  const { currentQuestion, setCurrentQuestion, setAnswer } = useHearingStore();
  const { sessionId, setSessionId, hearingSessionId, setHearingSessionId, setCurriculum } =
    useSessionStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const initializedRef = useRef(false);

  // Initialize: create session + start hearing
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        // Create session if none exists
        let sid = sessionId;
        if (!sid) {
          const sessionData = await api.post<{
            sessionId: string;
            currentStep: string;
          }>("/sessions", {});
          sid = sessionData.sessionId;
          setSessionId(sid);
        }

        // Start hearing
        const hearingData = await api.post<{
          hearingSessionId: string;
          firstQuestion: string;
          questionNumber: number;
          totalQuestions: number;
        }>("/hearing/start", { sessionId: sid });

        setHearingSessionId(hearingData.hearingSessionId);
        setCurrentQuestion(hearingData.questionNumber - 1);
        setMessages([
          {
            id: "q-0",
            role: "ai",
            content: hearingData.firstQuestion,
          },
        ]);
      } catch {
        setApiError("セッションの開始に失敗しました。ページを再読み込みしてください。");
      }
    };

    init();
  }, [sessionId, setSessionId, setHearingSessionId, setCurrentQuestion]);

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!hearingSessionId) return;

      const questionIndex = currentQuestion;
      const questionNumber = questionIndex + 1;

      // Add user message
      setMessages((prev) => [
        ...prev,
        { id: `u-${questionIndex}`, role: "user" as const, content: message },
      ]);

      setAnswer(`q${questionIndex}`, message);

      setIsLoading(true);
      try {
        const result = await api.post<{
          status: "continue" | "complete";
          nextQuestion: string | null;
          questionNumber: number | null;
          curriculum: {
            levelEstimate: string;
            steps: { stepId: string; title: string; estimatedMinutes: number; isSkippable: boolean }[];
            emphasizedConcepts: string[];
            skippedSteps: string[];
            personalizedIntro: string;
          } | null;
        }>(`/hearing/${hearingSessionId}/answer`, {
          questionNumber,
          answerText: message,
          isSkipped: false,
        });

        if (result.status === "complete" && result.curriculum) {
          setCurriculum(result.curriculum);
          setMessages((prev) => [
            ...prev,
            {
              id: "complete",
              role: "ai" as const,
              content:
                "ありがとうございます! あなたに最適なカリキュラムを作成しました。次のページで確認しましょう。",
            },
          ]);
          setTimeout(() => {
            router.push("/onboarding/curriculum");
          }, 2000);
        } else if (result.nextQuestion) {
          const nextIdx = (result.questionNumber ?? questionNumber + 1) - 1;
          setCurrentQuestion(nextIdx);
          setMessages((prev) => [
            ...prev,
            {
              id: `q-${nextIdx}`,
              role: "ai" as const,
              content: result.nextQuestion!,
            },
          ]);
        }
      } catch {
        setApiError("回答の送信に失敗しました。もう一度お試しください。");
      } finally {
        setIsLoading(false);
      }
    },
    [currentQuestion, hearingSessionId, setCurrentQuestion, setAnswer, setCurriculum, router]
  );

  const handleSkipConfirm = async () => {
    setSkipDialogOpen(false);
    if (!hearingSessionId) {
      router.push("/onboarding/curriculum");
      return;
    }

    // Skip remaining questions
    setIsLoading(true);
    try {
      let result: { status: string; curriculum: unknown } = { status: "", curriculum: null };
      for (let i = currentQuestion + 1; i <= TOTAL_QUESTIONS; i++) {
        result = await api.post<{
          status: string;
          curriculum: {
            levelEstimate: string;
            steps: { stepId: string; title: string; estimatedMinutes: number; isSkippable: boolean }[];
            emphasizedConcepts: string[];
            skippedSteps: string[];
            personalizedIntro: string;
          } | null;
        }>(`/hearing/${hearingSessionId}/answer`, {
          questionNumber: i,
          answerText: null,
          isSkipped: true,
        });
      }

      if (result.status === "complete" && result.curriculum) {
        setCurriculum(result.curriculum as Parameters<typeof setCurriculum>[0]);
      }
    } catch {
      // Continue to curriculum even if skip fails
    } finally {
      setIsLoading(false);
    }
    router.push("/onboarding/curriculum");
  };

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {/* Question Progress */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">質問</span>
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    i < currentQuestion
                      ? "bg-green-500"
                      : i === currentQuestion
                        ? "bg-blue-500"
                        : "bg-gray-200"
                  }`}
                  aria-label={
                    i < currentQuestion
                      ? `質問${i + 1}: 回答済み`
                      : i === currentQuestion
                        ? `質問${i + 1}: 現在の質問`
                        : `質問${i + 1}: 未回答`
                  }
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              Q{Math.min(currentQuestion + 1, TOTAL_QUESTIONS)}/{TOTAL_QUESTIONS}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSkipDialogOpen(true)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            <SkipForward className="mr-1 h-4 w-4" />
            スキップ
          </Button>
        </div>

        {/* Error Banner */}
        {apiError && (
          <div className="mb-4">
            <ErrorBanner
              message={apiError}
              onClose={() => setApiError(null)}
            />
          </div>
        )}

        {/* Chat Interface */}
        <div className="flex-1">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholder="回答を入力してください..."
          />
        </div>
      </main>
      <Footer />

      {/* Skip Confirmation Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              ヒアリングをスキップしますか?
            </DialogTitle>
          </DialogHeader>
          <p className="text-base leading-relaxed text-gray-600">
            ヒアリングをスキップすると、あなたに最適化されたカリキュラムを生成できません。
            概念理解なしに進むと、学習の途中でつまずきやすくなります。
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSkipDialogOpen(false)}
              className="text-base"
            >
              ヒアリングを続ける
            </Button>
            <Button
              variant="destructive"
              onClick={handleSkipConfirm}
              className="text-base"
            >
              スキップして進む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

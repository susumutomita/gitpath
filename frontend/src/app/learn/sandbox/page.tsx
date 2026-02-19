"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { VersionLossDemo } from "@/components/sandbox/VersionLossDemo";
import { GitUnderstandingQuestion } from "@/components/sandbox/GitUnderstandingQuestion";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

type Phase = "demo" | "question";

export default function SandboxPage() {
  const router = useRouter();
  const { sessionId, setCurrentStep } = useSessionStore();
  const [phase, setPhase] = useState<Phase>("demo");

  const handleDemoComplete = () => {
    if (sessionId) {
      api
        .post("/sandbox/events", {
          sessionId,
          eventType: "version_loss",
          stepName: "sandbox_experience",
        })
        .catch(() => {});
    }
    setPhase("question");
  };

  const handleQuestionSubmit = async (needsGit: boolean, reason: string) => {
    if (sessionId) {
      try {
        await api.post("/sandbox/understanding", {
          sessionId,
          understands: needsGit,
          freeText: reason,
        });
        await api.patch(`/sessions/${sessionId}/step`, {
          currentStep: "terminal",
        });
        setCurrentStep("terminal");
      } catch {
        // Continue even if API call fails
      }
    }
    router.push("/learn/terminal");
  };

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        {/* Page Header */}
        <div className="mb-6 text-center">
          <Badge
            variant="secondary"
            className="mb-3 bg-yellow-50 text-yellow-700"
          >
            <Lightbulb className="mr-1 h-3.5 w-3.5" />
            体験学習
          </Badge>
          <h1 className="text-2xl font-bold text-gray-900">
            {phase === "demo"
              ? "なぜGitが必要なのか、体験してみましょう"
              : "体験を振り返ってみましょう"}
          </h1>
          <p className="mt-2 text-base text-gray-600">
            {phase === "demo"
              ? "実際にファイルを編集して、バージョン管理の大切さを体感しましょう。"
              : "先ほどの体験について、あなたの考えを聞かせてください。"}
          </p>
        </div>

        {/* Content */}
        {phase === "demo" ? (
          <VersionLossDemo onComplete={handleDemoComplete} />
        ) : (
          <GitUnderstandingQuestion onSubmit={handleQuestionSubmit} />
        )}
      </main>
      <Footer />
    </>
  );
}

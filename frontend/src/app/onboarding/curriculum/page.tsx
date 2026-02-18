"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useHearingStore } from "@/stores/hearingStore";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
} from "lucide-react";

const DEFAULT_STEPS = [
  {
    stepId: "sandbox_experience",
    title: "概念体感: バージョン管理を体験",
    estimatedMinutes: 5,
    isSkippable: false,
  },
  {
    stepId: "github_account",
    title: "GitHubアカウント作成",
    estimatedMinutes: 3,
    isSkippable: false,
  },
  {
    stepId: "create_repo",
    title: "リポジトリ作成",
    estimatedMinutes: 3,
    isSkippable: false,
  },
  {
    stepId: "first_commit",
    title: "最初のコミット",
    estimatedMinutes: 5,
    isSkippable: false,
  },
  {
    stepId: "pull_request",
    title: "プルリクエスト作成",
    estimatedMinutes: 5,
    isSkippable: true,
  },
  {
    stepId: "ci_cd_setup",
    title: "CI/CD設定 (GitHub Actions)",
    estimatedMinutes: 5,
    isSkippable: true,
  },
];

export default function CurriculumPage() {
  const router = useRouter();
  const { answers } = useHearingStore();
  const { sessionId, curriculum, setCurrentStep } = useSessionStore();

  const occupation = answers["q0"] || "";
  const personalizedIntro = curriculum?.personalizedIntro
    ? curriculum.personalizedIntro
    : occupation
      ? `${occupation}のお仕事をされているあなたに最適なカリキュラムを用意しました。`
      : "あなたに最適なカリキュラムを用意しました。";

  const steps = curriculum?.steps ?? DEFAULT_STEPS;

  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const totalDuration = `約${totalMinutes}分`;

  const handleStartLearning = async () => {
    if (sessionId) {
      try {
        await api.patch(`/sessions/${sessionId}/step`, {
          currentStep: "sandbox",
        });
        setCurrentStep("sandbox");
      } catch {
        // Continue even if update fails
      }
    }
    router.push("/learn/sandbox");
  };

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        {/* Personalized Intro */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Sparkles className="h-8 w-8 text-blue-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            あなた専用のカリキュラム
          </h1>
          <p className="mt-3 text-base leading-relaxed text-gray-600">
            {personalizedIntro}
            <br />
            一つひとつ、AIが丁寧にガイドします。
          </p>
        </div>

        {/* Curriculum Overview */}
        <Card className="mb-8 border-blue-100">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen
                  className="h-5 w-5 text-blue-600"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-semibold text-gray-900">
                  学習ステップ
                </h2>
              </div>
              <Badge
                variant="secondary"
                className="bg-blue-50 text-blue-700"
              >
                <Clock className="mr-1 h-3.5 w-3.5" />
                {totalDuration}
              </Badge>
            </div>

            <ol className="space-y-4">
              {steps.map((step, index) => (
                <li key={step.stepId} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {index + 1}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className="mt-1 h-full w-0.5 bg-blue-100"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {step.title}
                      </h3>
                      <span className="text-sm text-gray-400">
                        {step.estimatedMinutes}分
                      </span>
                      {step.isSkippable && (
                        <Badge
                          variant="outline"
                          className="text-xs text-gray-400"
                        >
                          スキップ可
                        </Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Reassurance */}
        <div className="mb-8 rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
              aria-hidden="true"
            />
            <p className="text-base leading-relaxed text-green-800">
              途中でわからないことがあっても大丈夫。AIがいつでもサポートします。
              自分のペースで進められます。
            </p>
          </div>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <Button
            onClick={handleStartLearning}
            className="h-14 rounded-xl bg-blue-600 px-10 text-lg font-semibold text-white transition-colors hover:bg-blue-700"
            aria-label="このカリキュラムで学習を始める"
          >
            このカリキュラムで学習を始める
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}

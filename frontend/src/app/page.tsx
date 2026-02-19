"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { api, type ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Clock, Github, ArrowRight, RotateCcw } from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    title: "AIがあなた専用に教える",
    description:
      "あなたの職業や経験に合わせて、AIが最適なカリキュラムを作成。わからないことはいつでも質問できます。",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Clock,
    title: "30分で完走",
    description:
      "GitHubアカウント作成からCI/CDまで、最短30分で体験。忙しい方でも無理なく学べます。",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    icon: Github,
    title: "実際のGitHubで体験",
    description:
      "シミュレーションではなく、本物のGitHub上で操作。学んだことがそのまま実務に活かせます。",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
] as const;

interface StatsResponse {
  totalCompletions: number;
  averageMinutes: number;
}

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const router = useRouter();
  const { isAuthenticated, hasActiveSession, lastSessionId, login } =
    useAuthStore();
  const { setSessionId, setIsResumed, setCurrentStep, addAccumulatedSeconds } =
    useSessionStore();

  useEffect(() => {
    api
      .get<StatsResponse>("/stats/completions")
      .then(setStats)
      .catch(() => {
        // Stats endpoint may not exist yet
      });
  }, []);

  const handleEmailAuth = async (
    email: string,
    password: string,
    mode: "login" | "signup"
  ) => {
    setAuthError("");
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const data = await api.post<{
        user: { id: string; email: string; provider: string };
        accessToken: string;
        refreshToken: string;
        hasActiveSession?: boolean;
        lastSessionId?: string | null;
      }>(endpoint, { email, password });

      login(
        data.user,
        data.accessToken,
        data.refreshToken,
        data.hasActiveSession,
        data.lastSessionId
      );
      setAuthOpen(false);
      // If returning user with active session, show homepage (resume button visible)
      // Otherwise, start fresh onboarding
      if (!data.hasActiveSession) {
        router.push("/onboarding/hearing");
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.error === "EMAIL_ALREADY_EXISTS") {
        setAuthError("このメールアドレスは既に登録されています");
      } else if (apiErr.error === "INVALID_CREDENTIALS") {
        setAuthError("メールアドレスまたはパスワードが正しくありません");
      } else {
        setAuthError(apiErr.message || "認証に失敗しました");
      }
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setAuthError("");
    try {
      const data = await api.post<{
        user: { id: string; email: string; provider: string };
        accessToken: string;
        refreshToken: string;
        isNewUser?: boolean;
        hasActiveSession?: boolean;
        lastSessionId?: string | null;
      }>("/auth/google", { idToken: credential });

      login(
        data.user,
        data.accessToken,
        data.refreshToken,
        data.hasActiveSession,
        data.lastSessionId
      );
      setAuthOpen(false);
      if (!data.hasActiveSession) {
        router.push("/onboarding/hearing");
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.error === "EMAIL_ALREADY_EXISTS") {
        setAuthError("このメールアドレスは別の方法で登録済みです");
      } else {
        setAuthError(apiErr.message || "Google認証に失敗しました");
      }
    }
  };

  const handleStart = () => {
    if (isAuthenticated) {
      router.push("/onboarding/hearing");
    } else {
      setAuthOpen(true);
    }
  };

  const handleResume = async () => {
    if (!lastSessionId) return;
    try {
      const data = await api.post<{
        sessionId: string;
        accumulatedSeconds: number;
        currentStep: string;
        isResumed: boolean;
      }>("/sessions", { resumeSessionId: lastSessionId });

      setSessionId(data.sessionId);
      setIsResumed(true);
      setCurrentStep(data.currentStep);
      addAccumulatedSeconds(data.accumulatedSeconds);

      // Route based on current step
      const stepRoutes: Record<string, string> = {
        hearing: "/onboarding/hearing",
        curriculum: "/onboarding/curriculum",
        sandbox: "/learn/sandbox",
        terminal: "/learn/terminal",
      };
      router.push(stepRoutes[data.currentStep] || "/onboarding/hearing");
    } catch {
      router.push("/onboarding/hearing");
    }
  };

  return (
    <>
      <Header onLoginClick={() => setAuthOpen(true)} />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="flex flex-col items-center px-4 pb-16 pt-20 text-center">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            エンジニアに頼らず、
            <br />
            <span className="text-blue-600">自分でプロダクトを作れる</span>
            ようになる
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600">
            GitPathは、非エンジニアの方でも安心してGit・CI/CDを習得できる
            AIガイド付き学習プラットフォームです。
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Button
              onClick={handleStart}
              className="h-14 rounded-xl bg-blue-600 px-10 text-lg font-semibold text-white transition-colors hover:bg-blue-700"
              aria-label="今すぐ学習を始める"
            >
              今すぐ始める
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            {hasActiveSession && lastSessionId && (
              <Button
                variant="outline"
                onClick={handleResume}
                className="h-12 rounded-xl border-blue-200 px-8 text-base font-medium text-blue-700 hover:bg-blue-50"
                aria-label="前回の続きから再開する"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                前回の続きから再開
              </Button>
            )}
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="bg-gray-50 px-4 py-16" aria-label="GitPathの特徴">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
              GitPathが選ばれる理由
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-xl ${feature.bg}`}
                    >
                      <feature.icon
                        className={`h-7 w-7 ${feature.color}`}
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-gray-600">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="px-4 py-16" aria-label="達成実績">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              多くの方がGitを習得しています
            </h2>
            <div className="mt-8 flex justify-center gap-12">
              <div>
                <p className="text-4xl font-bold text-blue-600">
                  {stats ? stats.totalCompletions : "--"}
                </p>
                <p className="mt-1 text-base text-gray-600">累計達成者</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-green-600">
                  {stats ? `${stats.averageMinutes}分` : "--"}
                </p>
                <p className="mt-1 text-base text-gray-600">平均完走時間</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <AuthModal
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) setAuthError("");
        }}
        onEmailAuth={handleEmailAuth}
        onGoogleSuccess={handleGoogleSuccess}
        error={authError}
      />
    </>
  );
}

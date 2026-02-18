"use client";

import { useState } from "react";
import { SandboxFileEditor } from "./SandboxFileEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  AlertTriangle,
  GitBranch,
  RotateCcw,
  Lightbulb,
} from "lucide-react";

type DemoStep = 1 | 2 | 3 | 4;

interface VersionLossDemoProps {
  onComplete: () => void;
}

const STEP_INFO: Record<
  DemoStep,
  { title: string; instruction: string; icon: React.ElementType }
> = {
  1: {
    title: "ステップ 1/4: レポートを作成",
    instruction:
      "下のエディタに、あなたが書いたレポートだと想像して文章を入力し、「保存」してください。",
    icon: Lightbulb,
  },
  2: {
    title: "ステップ 2/4: 内容を変更して上書き保存",
    instruction:
      "レポートの内容を全く別の文章に書き換えて、もう一度「保存」してください。",
    icon: Lightbulb,
  },
  3: {
    title: "ステップ 3/4: 元に戻せますか?",
    instruction:
      "最初に書いた内容に戻してみてください。...思い出せますか? 上書きしたので、元の内容は失われてしまいました。",
    icon: AlertTriangle,
  },
  4: {
    title: "ステップ 4/4: Gitがあれば...",
    instruction:
      "Gitを使えば、過去のすべてのバージョンが記録されます。いつでも好きな時点に戻れるのです。",
    icon: GitBranch,
  },
};

export function VersionLossDemo({ onComplete }: VersionLossDemoProps) {
  const [step, setStep] = useState<DemoStep>(1);
  const [savedVersions, setSavedVersions] = useState<string[]>([]);
  const [hasSaved, setHasSaved] = useState(false);

  const currentStep = STEP_INFO[step];
  const StepIcon = currentStep.icon;

  const handleSave = (content: string) => {
    setSavedVersions((prev) => [...prev, content]);
    setHasSaved(true);
  };

  const handleNext = () => {
    if (step < 4) {
      setStep((step + 1) as DemoStep);
      setHasSaved(false);
    } else {
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div
        className={`rounded-xl p-4 ${
          step === 3
            ? "border border-orange-200 bg-orange-50"
            : step === 4
              ? "border border-green-200 bg-green-50"
              : "border border-blue-200 bg-blue-50"
        }`}
      >
        <div className="flex items-start gap-3">
          <StepIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              step === 3
                ? "text-orange-600"
                : step === 4
                  ? "text-green-600"
                  : "text-blue-600"
            }`}
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {currentStep.title}
            </h2>
            <p className="mt-1 text-base leading-relaxed text-gray-700">
              {currentStep.instruction}
            </p>
          </div>
        </div>
      </div>

      {/* Editor (Steps 1-3) */}
      {step <= 3 && (
        <SandboxFileEditor
          fileName="レポート.txt"
          initialContent={
            step === 1
              ? ""
              : step === 2
                ? savedVersions[savedVersions.length - 1] || ""
                : savedVersions[savedVersions.length - 1] || ""
          }
          onSave={handleSave}
          disabled={step === 3}
        />
      )}

      {/* Git Diff Demo (Step 4) */}
      {step === 4 && savedVersions.length >= 2 && (
        <Card className="border-green-200">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-green-800">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
              Gitのバージョン履歴
            </h3>
            <div className="space-y-3">
              {savedVersions.map((version, i) => (
                <div key={i} className="rounded-lg border bg-white p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <RotateCcw
                      className="h-3.5 w-3.5 text-green-600"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-green-700">
                      バージョン {i + 1}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                    {version}
                  </pre>
                </div>
              ))}
            </div>
            <p className="mt-4 text-base leading-relaxed text-green-700">
              このように、Gitは全ての変更履歴を保存します。
              いつでも過去のバージョンに戻すことができます。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4 without versions */}
      {step === 4 && savedVersions.length < 2 && (
        <Card className="border-green-200">
          <CardContent className="p-5">
            <p className="text-base leading-relaxed text-green-700">
              Gitを使えば、ファイルの変更履歴がすべて記録されます。
              「あのときの内容に戻したい」がいつでも実現できます。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={step <= 2 && !hasSaved}
          className="h-12 rounded-xl bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700"
        >
          {step === 4 ? "理解度チェックへ" : "次へ"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

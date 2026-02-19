"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AIExplanationPanel } from "@/components/learning/AIExplanationPanel";
import { Check, Circle, ChevronRight } from "lucide-react";

interface Step {
  id: string;
  title: string;
  status: "completed" | "current" | "upcoming";
}

interface StepGuideProps {
  currentStepTitle: string;
  currentStepDescription: string;
  steps: Step[];
  aiExplanation?: string;
  aiLoading?: boolean;
  aiError?: string | null;
  onRequestDetail?: () => void;
}

export function StepGuide({
  currentStepTitle,
  currentStepDescription,
  steps,
  aiExplanation,
  aiLoading = false,
  aiError = null,
  onRequestDetail,
}: StepGuideProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Current Step */}
      <Card className="border-blue-200 bg-white">
        <CardContent className="p-4">
          <div className="mb-1 text-sm font-medium text-blue-600">
            いまやること
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {currentStepTitle}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-gray-600">
            {currentStepDescription}
          </p>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      {(aiExplanation || aiLoading || aiError) && (
        <AIExplanationPanel
          explanation={aiExplanation || ""}
          isLoading={aiLoading}
          error={aiError}
          onRequestDetail={onRequestDetail}
        />
      )}

      {/* Step List */}
      <Card className="flex-1 bg-white">
        <CardContent className="p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-500">
            ステップ一覧
          </h4>
          <ol className="space-y-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  step.status === "current"
                    ? "bg-blue-50"
                    : step.status === "completed"
                      ? "bg-green-50/50"
                      : ""
                }`}
                aria-current={step.status === "current" ? "step" : undefined}
              >
                {step.status === "completed" ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-green-500"
                    aria-hidden="true"
                  />
                ) : step.status === "current" ? (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-blue-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-gray-300"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`text-sm ${
                    step.status === "completed"
                      ? "text-green-700 line-through"
                      : step.status === "current"
                        ? "font-semibold text-blue-700"
                        : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Check } from "lucide-react";

interface MilestoneStep {
  id: string;
  name: string;
  completed: boolean;
}

const DEFAULT_MILESTONES: MilestoneStep[] = [
  { id: "github-account", name: "GitHubアカウント作成", completed: false },
  { id: "repository", name: "リポジトリ作成", completed: false },
  { id: "commit", name: "コミット", completed: false },
  { id: "pull-request", name: "PR", completed: false },
  { id: "ci-cd", name: "CI/CD", completed: false },
];

interface MilestoneProgressBarProps {
  milestones?: MilestoneStep[];
  currentIndex?: number;
}

export function MilestoneProgressBar({
  milestones = DEFAULT_MILESTONES,
  currentIndex,
}: MilestoneProgressBarProps) {
  const activeIndex =
    currentIndex ??
    milestones.findIndex((m) => !m.completed);

  return (
    <nav aria-label="学習進捗" className="w-full py-4">
      <ol className="flex items-center justify-between">
        {milestones.map((milestone, index) => {
          const isCompleted = milestone.completed;
          const isCurrent = index === activeIndex;

          return (
            <li
              key={milestone.id}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={`h-1 flex-1 rounded ${
                      milestones[index - 1].completed
                        ? "bg-green-500"
                        : "bg-gray-200"
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                        ? "border-2 border-blue-500 bg-blue-50 text-blue-700"
                        : "border-2 border-gray-300 bg-white text-gray-400"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < milestones.length - 1 && (
                  <div
                    className={`h-1 flex-1 rounded ${
                      isCompleted ? "bg-green-500" : "bg-gray-200"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className={`text-center text-xs leading-tight ${
                  isCompleted
                    ? "font-semibold text-green-700"
                    : isCurrent
                      ? "font-semibold text-blue-700"
                      : "text-gray-400"
                }`}
              >
                {milestone.name}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, HelpCircle, HandHelping, X } from "lucide-react";

interface ErrorHelperProps {
  errorMessage: string;
  aiExplanation: string;
  isLoading?: boolean;
  consecutiveErrors?: number;
  onRequestDetail?: () => void;
  onClose: () => void;
}

export function ErrorHelper({
  errorMessage,
  aiExplanation,
  isLoading = false,
  consecutiveErrors = 0,
  onRequestDetail,
  onClose,
}: ErrorHelperProps) {
  const isAssistMode = consecutiveErrors >= 3;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 p-4">
      <Card
        className={`shadow-xl ${
          isAssistMode
            ? "border-orange-300 bg-orange-50"
            : "border-red-200 bg-white"
        }`}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              {isAssistMode ? (
                <HandHelping
                  className="h-5 w-5 text-orange-500"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="h-5 w-5 text-red-500"
                  aria-hidden="true"
                />
              )}
              <span
                className={`text-sm font-semibold ${
                  isAssistMode ? "text-orange-700" : "text-red-700"
                }`}
              >
                {isAssistMode
                  ? "一緒に確認しましょう"
                  : "エラーが発生しました"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="エラーヘルパーを閉じる"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Error Message */}
          <code className="mb-3 block rounded bg-gray-900 px-3 py-2 font-mono text-sm text-red-400">
            {errorMessage}
          </code>

          {/* AI Explanation */}
          {isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="text-sm text-blue-600">
                AIが原因を分析しています...
              </span>
            </div>
          ) : (
            <p className="text-base leading-relaxed text-gray-700">
              {aiExplanation}
            </p>
          )}

          {/* Actions */}
          {!isLoading && onRequestDetail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestDetail}
              className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <HelpCircle className="mr-1.5 h-4 w-4" />
              もう少し詳しく
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

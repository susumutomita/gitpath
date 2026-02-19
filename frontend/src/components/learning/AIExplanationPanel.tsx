"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, HelpCircle } from "lucide-react";

interface AIExplanationPanelProps {
  explanation: string;
  isLoading?: boolean;
  error?: string | null;
  onRequestDetail?: () => void;
}

export function AIExplanationPanel({
  explanation,
  isLoading = false,
  error = null,
  onRequestDetail,
}: AIExplanationPanelProps) {
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-base font-medium text-red-800">
              AIからの応答を取得できませんでした
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-100 bg-blue-50/50">
      <CardContent className="py-4">
        {isLoading ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <span className="text-base text-blue-700">
              AIが説明を準備しています...
            </span>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-800">
              {explanation}
            </p>
            {onRequestDetail && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestDetail}
                className="mt-4 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <HelpCircle className="mr-1.5 h-4 w-4" />
                もう少し詳しく
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ThumbsUp, ThumbsDown } from "lucide-react";

interface GitUnderstandingQuestionProps {
  onSubmit: (needsGit: boolean, reason: string) => void;
}

export function GitUnderstandingQuestion({
  onSubmit,
}: GitUnderstandingQuestionProps) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (answer === null) return;
    onSubmit(answer, reason);
  };

  return (
    <Card className="border-blue-100">
      <CardContent className="p-6">
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Gitが必要だと思いますか?
        </h2>
        <p className="mb-6 text-base leading-relaxed text-gray-600">
          先ほどの体験を踏まえて、あなたのお仕事にGitが役立つと思いますか?
        </p>

        {/* Yes / No Buttons */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={answer === true ? "default" : "outline"}
            onClick={() => setAnswer(true)}
            className={`h-14 flex-1 text-base font-semibold ${
              answer === true
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "hover:border-blue-300 hover:bg-blue-50"
            }`}
            aria-pressed={answer === true}
          >
            <ThumbsUp className="mr-2 h-5 w-5" />
            はい、役立ちそう
          </Button>
          <Button
            variant={answer === false ? "default" : "outline"}
            onClick={() => setAnswer(false)}
            className={`h-14 flex-1 text-base font-semibold ${
              answer === false
                ? "bg-gray-600 text-white hover:bg-gray-700"
                : "hover:border-gray-300 hover:bg-gray-50"
            }`}
            aria-pressed={answer === false}
          >
            <ThumbsDown className="mr-2 h-5 w-5" />
            まだわからない
          </Button>
        </div>

        {/* Free Text */}
        {answer !== null && (
          <div className="mb-6 space-y-2">
            <label
              htmlFor="reason"
              className="text-base font-medium text-gray-700"
            >
              {answer
                ? "どんな場面で使えそうですか? (任意)"
                : "気になる点があれば教えてください (任意)"}
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="自由に書いてください..."
              className="min-h-[80px] text-base"
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={answer === null}
            className="h-12 rounded-xl bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700"
          >
            次へ進む
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

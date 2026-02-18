"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Terminal, Info } from "lucide-react";

interface CommandSuggestionProps {
  command: string;
  description: string;
}

export function CommandSuggestion({
  command,
  description,
}: CommandSuggestionProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/70">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <span className="text-sm font-medium text-blue-700">
            次に入力するコマンド
          </span>
        </div>
        <code className="block rounded-lg bg-gray-900 px-4 py-3 font-mono text-base text-green-400">
          {command}
        </code>
        <div className="mt-3 flex items-start gap-2">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-gray-600">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

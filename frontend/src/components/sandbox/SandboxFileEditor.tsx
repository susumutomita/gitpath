"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, FileText } from "lucide-react";

interface SandboxFileEditorProps {
  fileName: string;
  initialContent: string;
  onSave: (content: string) => void;
  disabled?: boolean;
}

export function SandboxFileEditor({
  fileName,
  initialContent,
  onSave,
  disabled = false,
}: SandboxFileEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(content);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* File Tab */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700">{fileName}</span>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={disabled}
          className={`text-sm transition-colors ${
            saved
              ? "bg-green-600 hover:bg-green-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          aria-label={`${fileName}を保存`}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saved ? "保存しました" : "保存"}
        </Button>
      </div>

      {/* Editor Area */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={disabled}
        className="min-h-[200px] resize-none rounded-none border-0 font-mono text-base leading-relaxed focus-visible:ring-0"
        placeholder="ここに内容を入力..."
        aria-label={`${fileName}の内容を編集`}
      />
    </div>
  );
}

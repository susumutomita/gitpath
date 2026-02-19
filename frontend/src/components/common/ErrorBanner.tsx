"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
  autoCloseMs?: number;
}

export function ErrorBanner({
  message,
  onClose,
  autoCloseMs = 5000,
}: ErrorBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoCloseMs <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onClose]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg bg-red-600 px-4 py-3 text-white shadow-md"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-base">{message}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-white hover:bg-red-700"
        onClick={() => {
          setVisible(false);
          onClose?.();
        }}
        aria-label="エラーを閉じる"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

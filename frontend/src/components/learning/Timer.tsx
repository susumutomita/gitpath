"use client";

import { useEffect, useRef } from "react";
import { useTimerStore } from "@/stores/timerStore";
import { Clock } from "lucide-react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getTimerColor(seconds: number): string {
  if (seconds >= 2700) return "text-red-600"; // 45min+
  if (seconds >= 1800) return "text-orange-500"; // 30min+
  return "text-gray-700";
}

export function Timer() {
  const { elapsedSeconds, isRunning, tick } = useTimerStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, tick]);

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-lg font-semibold ${getTimerColor(elapsedSeconds)}`}
      role="timer"
      aria-label={`経過時間 ${formatTime(elapsedSeconds)}`}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span>{formatTime(elapsedSeconds)}</span>
    </div>
  );
}

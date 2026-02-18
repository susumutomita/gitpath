"use client";

import { useAuthStore } from "@/stores/authStore";
import { Timer } from "@/components/learning/Timer";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut } from "lucide-react";

interface HeaderProps {
  onLoginClick?: () => void;
  showTimer?: boolean;
}

export function Header({ onLoginClick, showTimer = false }: HeaderProps) {
  const { isAuthenticated, user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold text-blue-600"
            aria-label="GitPath ホーム"
          >
            GitPath
          </span>
        </div>

        <div className="flex items-center gap-4">
          {showTimer && <Timer />}

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                aria-label="ログアウト"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                ログアウト
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onLoginClick}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="ログイン"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              ログイン
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

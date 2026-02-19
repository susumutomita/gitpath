"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

type AuthMode = "login" | "signup";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailAuth?: (email: string, password: string, mode: AuthMode) => void;
  onGoogleSuccess?: (credential: string) => void;
  error?: string;
}

export function AuthModal({
  open,
  onOpenChange,
  onEmailAuth,
  onGoogleSuccess,
  error: externalError,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    onEmailAuth?.(email, password, mode);
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setConfirmPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === "login" ? "ログイン" : "アカウント作成"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              autoComplete={mode === "login" ? "email" : "new-email"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="8文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base">
                パスワード (確認)
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="もう一度入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 text-base"
                autoComplete="new-password"
              />
            </div>
          )}

          {(error || externalError) && (
            <p className="text-sm text-red-600" role="alert">
              {error || externalError}
            </p>
          )}

          <Button
            type="submit"
            className="h-12 w-full bg-blue-600 text-base hover:bg-blue-700"
          >
            {mode === "login" ? "ログイン" : "アカウントを作成"}
          </Button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-2 text-muted-foreground">
              または
            </span>
          </div>
        </div>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={(credentialResponse: CredentialResponse) => {
              if (credentialResponse.credential) {
                onGoogleSuccess?.(credentialResponse.credential);
              }
            }}
            onError={() => {
              // Google login failed
            }}
            text="signin_with"
            shape="rectangular"
            width={350}
          />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              アカウントをお持ちでない方は{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-blue-600 underline hover:text-blue-800"
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちの方は{" "}
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-blue-600 underline hover:text-blue-800"
              >
                ログイン
              </button>
            </>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}

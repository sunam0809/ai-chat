import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { login, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login({ username, password });
      qc.setQueryData(getGetMeQueryKey(), user);
      setLocation("/");
    } catch (err: any) {
      const msg =
        err?.data?.error ??
        err?.data?.message ??
        err?.message ??
        "로그인 실패. 다시 시도해주세요.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">다시 오셨군요</h1>
          <p className="text-muted-foreground text-sm">계정에 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              data-testid="input-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              required
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
              className="bg-card border-border"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center" data-testid="text-error">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            data-testid="button-submit"
          >
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <a
            href="/register"
            className="text-primary hover:underline font-medium"
            data-testid="link-register"
            onClick={e => { e.preventDefault(); setLocation("/register"); }}
          >
            회원가입
          </a>
        </p>
      </div>
    </div>
  );
}

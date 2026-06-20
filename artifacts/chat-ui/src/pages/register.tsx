import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { register, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다"); return; }
    if (password.length < 4) { setError("비밀번호는 4자 이상이어야 합니다"); return; }
    setLoading(true);
    try {
      await register({ username, password });
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "회원가입 실패");
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
          <h1 className="text-2xl font-bold text-foreground">계정 만들기</h1>
          <p className="text-muted-foreground text-sm">아이디와 비밀번호로 가입하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              data-testid="input-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="2자 이상의 아이디"
              autoComplete="username"
              required
              minLength={2}
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
              placeholder="4자 이상의 비밀번호"
              autoComplete="new-password"
              required
              className="bg-card border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">비밀번호 확인</Label>
            <Input
              id="confirm"
              data-testid="input-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              autoComplete="new-password"
              required
              className="bg-card border-border"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center" data-testid="text-error">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
            {loading ? "가입 중..." : "회원가입"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <a
            href="/login"
            className="text-primary hover:underline font-medium"
            data-testid="link-login"
            onClick={e => { e.preventDefault(); setLocation("/login"); }}
          >
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}

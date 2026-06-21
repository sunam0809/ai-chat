import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { login, setToken, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

export default function LoginPage() {
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
      // 캐시에 유저 데이터 세팅 후 즉시 리다이렉트
      qc.setQueryData(getGetMeQueryKey(), user);
      // href 사용: 완전 새로고침 → React Query 캐시 초기화 없이 localStorage 토큰으로 시작
      window.location.href = "/";
    } catch (err: any) {
      const msg =
        err?.data?.error ??
        err?.data?.message ??
        err?.message ??
        "로그인 실패. 다시 시도해주세요.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 flex items-center justify-center border border-purple-500/30">
              <span className="text-3xl">⚡</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI Builder</h1>
          <p className="text-muted-foreground text-sm">계정에 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              required
              className="bg-card border-border h-11"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
              className="bg-card border-border h-11"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <p className="text-destructive text-sm text-center">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                로그인 중...
              </span>
            ) : "로그인"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
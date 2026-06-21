import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { register, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

export default function RegisterPage() {
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
    if (username.length < 2) { setError("아이디는 2자 이상이어야 합니다"); return; }
    setLoading(true);
    try {
      const user = await register({ username, password });
      qc.setQueryData(getGetMeQueryKey(), user);
      window.location.replace("/");
    } catch (err: any) {
      const msg =
        err?.data?.error ??
        err?.data?.message ??
        err?.message ??
        "회원가입 실패. 다시 시도해주세요.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center border border-purple-500/30">
              <span className="text-2xl">⚡</span>
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
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="2자 이상의 아이디"
              autoComplete="username"
              required
              minLength={2}
              className="bg-card border-border"
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
              placeholder="4자 이상"
              autoComplete="new-password"
              required
              className="bg-card border-border"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">비밀번호 확인</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="비밀번호를 다시 입력하세요"
              autoComplete="new-password"
              required
              className="bg-card border-border"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                가입 중...
              </span>
            ) : "회원가입"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
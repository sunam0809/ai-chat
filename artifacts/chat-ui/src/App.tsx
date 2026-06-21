import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, clearToken } from "@workspace/api-client-react";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      retryDelay: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetMe();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const errStatus = (error as any)?.status;

  // 401/403 → 토큰 무효, 로그인으로
  useEffect(() => {
    if (!isLoading && errStatus === 401 || errStatus === 403) {
      clearToken();
      qc.removeQueries({ queryKey: ["getMe"] });
      setLocation("/login");
    }
  }, [errStatus, isLoading]);

  // 로컬 토큰이 있으면 initialData 덕분에 isLoading=false, user=있음 → 즉시 표시
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return <>{children}</>;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  if (isLoading) return null;
  if (user) return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <GuestGuard><LoginPage /></GuestGuard>
      </Route>
      <Route path="/register">
        <GuestGuard><RegisterPage /></GuestGuard>
      </Route>
      <Route path="/">
        <AuthGuard><ChatPage /></AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

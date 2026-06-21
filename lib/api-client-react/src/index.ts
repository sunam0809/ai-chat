import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// JWT 페이로드를 서버 없이 로컬에서 디코딩 (서명 검증 X, 만료만 확인)
export function getDecodedToken(): { id: number; userId?: number; username: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    // 만료 확인
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      clearToken();
      return null;
    }
    const uid = payload.userId ?? payload.id;
    if (!uid || !payload.username) return null;
    return { id: uid, userId: uid, username: payload.username };
  } catch {
    return null;
  }
}

async function apiFetch<T = void>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    try { err.data = await res.json(); } catch {}
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : undefined as T;
}

// Auth
export const getGetMeQueryKey = () => ["getMe"] as const;

export const useGetMe = (options?: Partial<UseQueryOptions<any, any>>) => {
  // 로컬 JWT 디코딩 → 서버 응답 없이도 즉시 사용자 정보 반환
  const localUser = getDecodedToken();

  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => {
      if (!getToken()) {
        return Promise.reject(Object.assign(new Error("No token"), { status: 401 }));
      }
      return apiFetch<any>("/api/auth/me");
    },
    // 로컬 토큰이 유효하면 즉시 사용 (로딩 상태 건너뜀)
    initialData: localUser ?? undefined,
    initialDataUpdatedAt: localUser ? Date.now() - 30_000 : undefined,
    staleTime: 5 * 60 * 1000,
    // 401/403 = 재시도 안 함 / 네트워크 에러 = 2회 재시도
    retry: (failureCount: number, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
    retryDelay: 1500,
    ...options,
  });
};

export const login = async (body: { username: string; password: string }) => {
  const res = await apiFetch<{ token: string; user: any }>("/api/auth/login", {
    method: "POST", body: JSON.stringify(body),
  });
  setToken(res.token);
  return res.user;
};

export const register = async (body: { username: string; password: string }) => {
  const res = await apiFetch<{ token: string; user: any }>("/api/auth/register", {
    method: "POST", body: JSON.stringify(body),
  });
  setToken(res.token);
  return res.user;
};

export const logout = () => {
  clearToken();
  return Promise.resolve();
};

// Conversations
export const getListConversationsQueryKey = () => ["listConversations"] as const;
export const useListConversations = (options?: Partial<UseQueryOptions<any, any>>) =>
  useQuery({
    queryKey: getListConversationsQueryKey(),
    queryFn: () => apiFetch<any[]>("/api/conversations"),
    initialData: [] as any[],
    ...options,
  });

export const getGetConversationQueryKey = (id: number) => ["getConversation", id] as const;
export const useGetConversation = (id: number, options?: { query?: Partial<UseQueryOptions<any, any>> }) =>
  useQuery({
    queryKey: getGetConversationQueryKey(id),
    queryFn: () => apiFetch<any>(`/api/conversations/${id}`),
    enabled: !!id,
    ...options?.query,
  });

export const createConversation = (body: { title?: string; model?: string }) =>
  apiFetch<any>("/api/conversations", { method: "POST", body: JSON.stringify(body) });

export const updateConversation = ({ id, ...body }: { id: number; title?: string }) =>
  apiFetch<any>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteConversation = ({ id }: { id: number }) =>
  apiFetch<void>(`/api/conversations/${id}`, { method: "DELETE" });

export const sendMessage = (conversationId: number, body: { content: string; model?: string }) =>
  apiFetch<any>(`/api/conversations/${conversationId}/messages`, {
    method: "POST", body: JSON.stringify(body),
  });

// Models
export const getListModelsQueryKey = () => ["listModels"] as const;
export const useListModels = (options?: Partial<UseQueryOptions<any, any>>) =>
  useQuery({
    queryKey: getListModelsQueryKey(),
    queryFn: () => apiFetch<any[]>("/api/models"),
    staleTime: Infinity,
    initialData: [] as any[],
    ...options,
  });

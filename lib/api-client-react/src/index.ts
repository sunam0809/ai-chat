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
export const useGetMe = (options?: Partial<UseQueryOptions<any, any>>) =>
  useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => {
      if (!getToken()) return Promise.reject(Object.assign(new Error("No token"), { status: 401 }));
      return apiFetch<any>("/api/auth/me");
    },
    // 401/403은 재시도 안 함, 네트워크/서버 오류는 2회 재시도 (Render 콜드스타트 대응)
    retry: (failureCount: number, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    ...options,
  });

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

// Messages (streaming via SSE)
export const sendMessageStream = (conversationId: number, content: string, model?: string): EventSource => {
  const token = getToken();
  const params = new URLSearchParams({ content, ...(model ? { model } : {}) });
  // Use fetch for streaming with auth header
  return null as any; // handled separately in chat.tsx
};

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

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

async function apiFetch<T = void>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    try { err.response = { data: await res.json() }; } catch {}
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
    queryFn: () => apiFetch<any>("/api/auth/me"),
    retry: false,
    staleTime: 30_000,
    ...options,
  });

export const login = (body: { username: string; password: string }) =>
  apiFetch<any>("/api/auth/login", { method: "POST", body: JSON.stringify(body) });

export const register = (body: { username: string; password: string }) =>
  apiFetch<any>("/api/auth/register", { method: "POST", body: JSON.stringify(body) });

export const logout = () =>
  apiFetch<any>("/api/auth/logout", { method: "POST" });

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

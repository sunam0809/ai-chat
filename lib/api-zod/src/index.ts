function assertString(val: unknown, field: string, min = 1): string {
  if (typeof val !== "string" || val.length < min) {
    throw Object.assign(new Error(`${field} must be at least ${min} char`), { status: 400 });
  }
  return val;
}

interface ParseResult<T> { success: boolean; data?: T; error?: string; }
function ok<T>(data: T): ParseResult<T> { return { success: true, data }; }
function fail<T>(error: string): ParseResult<T> { return { success: false, error }; }

export const RegisterBody = {
  safeParse(body: unknown): ParseResult<{ username: string; password: string }> {
    try {
      const b = body as Record<string, unknown>;
      return ok({ username: assertString(b?.username, "username", 2), password: assertString(b?.password, "password", 4) });
    } catch { return fail("아이디는 2자 이상, 비밀번호는 4자 이상이어야 합니다"); }
  }
};

export const LoginBody = {
  safeParse(body: unknown): ParseResult<{ username: string; password: string }> {
    try {
      const b = body as Record<string, unknown>;
      return ok({ username: assertString(b?.username, "username", 1), password: assertString(b?.password, "password", 1) });
    } catch { return fail("아이디와 비밀번호를 입력해주세요"); }
  }
};

export const CreateConversationBody = {
  safeParse(body: unknown): ParseResult<{ title?: string; model?: string }> {
    const b = (body ?? {}) as Record<string, unknown>;
    return ok({
      title: typeof b?.title === "string" ? b.title : undefined,
      model: typeof b?.model === "string" ? b.model : undefined,
    });
  }
};

export const UpdateConversationBody = {
  safeParse(body: unknown): ParseResult<{ title?: string }> {
    const b = (body ?? {}) as Record<string, unknown>;
    return ok({ title: typeof b?.title === "string" ? b.title : undefined });
  }
};

export const SendMessageBody = {
  safeParse(body: unknown): ParseResult<{ content: string; model?: string }> {
    try {
      const b = body as Record<string, unknown>;
      return ok({
        content: assertString(b?.content, "content", 1),
        model: typeof b?.model === "string" ? b.model : undefined,
      });
    } catch { return fail("content is required"); }
  }
};

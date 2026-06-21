import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useGetMe, useListConversations, useGetConversation, useListModels,
  createConversation, deleteConversation, logout, updateConversation,
  getListConversationsQueryKey, getGetMeQueryKey, getGetConversationQueryKey,
  getToken,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COMPILE_LANGS: Record<string, { label: string; key: string }> = {
  c:    { label: "EXE (Windows)", key: "c" },
  cpp:  { label: "EXE (Windows)", key: "cpp" },
  asm:  { label: "EXE (Windows)", key: "asm" },
  nasm: { label: "EXE (Windows)", key: "asm" },
};

const DLL_LANGS: Record<string, { label: string; key: string }> = {
  c:   { label: "DLL", key: "c-dll" },
  cpp: { label: "DLL", key: "cpp-dll" },
  asm: { label: "DLL", key: "asm-dll" },
};

const SYS_LANGS: Record<string, { label: string; key: string }> = {
  c:   { label: "SYS (드라이버)", key: "c-sys" },
  cpp: { label: "SYS (드라이버)", key: "cpp-sys" },
};

const LINUX_LANGS: Record<string, { label: string; key: string }> = {
  c:   { label: "ELF (Linux)", key: "c-linux" },
  cpp: { label: "ELF (Linux)", key: "cpp-linux" },
};

const LANG_EXT: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts", cpp: "cpp", c: "c",
  csharp: "cs", java: "java", rust: "rs", go: "go", bash: "sh",
  shell: "sh", powershell: "ps1", html: "html", css: "css", json: "json",
  yaml: "yml", toml: "toml", sql: "sql", php: "php", ruby: "rb",
  swift: "swift", kotlin: "kt", asm: "asm", nasm: "asm", lua: "lua",
  r: "r", dart: "dart", scala: "scala", dockerfile: "dockerfile",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string) {
  downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
}

function parseLangAndFile(className?: string): { lang: string; filename: string | null } {
  if (!className) return { lang: "text", filename: null };
  const raw = className.replace("language-", "");
  const colonIdx = raw.indexOf(":");
  if (colonIdx !== -1) {
    return { lang: raw.slice(0, colonIdx), filename: raw.slice(colonIdx + 1) };
  }
  return { lang: raw, filename: null };
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileTarget, setCompileTarget] = useState<"exe" | "dll" | "sys" | "linux">("exe");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const code = String(children ?? "").replace(/\n$/, "");
  const { lang, filename } = parseLangAndFile(className);
  const ext = LANG_EXT[lang.toLowerCase()] ?? "txt";
  const downloadName = filename ?? `code.${ext}`;

  const canCompile = lang in COMPILE_LANGS;
  const canDll = lang in DLL_LANGS;
  const canSys = lang in SYS_LANGS;
  const canLinux = lang in LINUX_LANGS;
  const isHtml = lang === "html";

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => downloadText(code, downloadName);

  const compile = async () => {
    setCompiling(true);
    const token = getToken();
    let langKey: string;
    if (compileTarget === "dll") langKey = DLL_LANGS[lang]?.key ?? COMPILE_LANGS[lang]?.key;
    else if (compileTarget === "sys") langKey = SYS_LANGS[lang]?.key ?? COMPILE_LANGS[lang]?.key;
    else if (compileTarget === "linux") langKey = LINUX_LANGS[lang]?.key ?? "c-linux";
    else langKey = COMPILE_LANGS[lang]?.key;

    try {
      const res = await fetch(`${BASE}/api/compile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source: code, language: langKey, filename: downloadName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `컴파일 실패: HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const outExt = compileTarget === "dll" ? "dll" : compileTarget === "sys" ? "sys" : compileTarget === "linux" ? "" : "exe";
      const outName = filename
        ? filename.replace(/\.[^.]+$/, outExt ? `.${outExt}` : "")
        : `output${outExt ? `.${outExt}` : ""}`;
      downloadBlob(blob, outName);
    } catch (err: any) {
      alert(`컴파일 오류: ${err?.message}`);
    } finally {
      setCompiling(false);
    }
  };

  const createPreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(`${BASE}/api/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: code, title: filename ?? "Preview" }),
      });
      if (!res.ok) throw new Error("미리보기 생성 실패");
      const data = await res.json();
      setPreviewId(data.id);
      setShowPreview(true);
    } catch (err: any) {
      alert(err?.message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="code-block-wrapper relative group my-3 rounded-lg overflow-hidden border border-border min-w-0">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border flex-wrap gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {filename ? (
            <span className="text-primary/80">{filename}</span>
          ) : lang}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {isHtml && (
            <button
              onClick={showPreview ? () => setShowPreview(false) : (previewId ? () => setShowPreview(true) : createPreview)}
              disabled={previewing}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
            >
              {previewing ? (
                <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              {showPreview ? "미리보기 닫기" : "미리보기"}
            </button>
          )}
          {canCompile && (
            <>
              {(canDll || canSys || canLinux) && (
                <select
                  value={compileTarget}
                  onChange={e => setCompileTarget(e.target.value as any)}
                  className="text-xs bg-muted border border-border rounded px-1 py-0.5 text-muted-foreground"
                >
                  <option value="exe">EXE (Windows)</option>
                  {canDll && <option value="dll">DLL</option>}
                  {canSys && <option value="sys">SYS (드라이버)</option>}
                  {canLinux && <option value="linux">ELF (Linux)</option>}
                </select>
              )}
              <button
                onClick={compile}
                disabled={compiling}
                className="text-xs text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20"
              >
                {compiling ? (
                  <span className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                )}
                {compiling ? "컴파일 중..." : "컴파일"}
              </button>
            </>
          )}
          <button
            onClick={download}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            저장
          </button>
          <button onClick={copy} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-auto text-sm leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
      {showPreview && previewId && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 text-xs text-muted-foreground">
            <span>🌐 실시간 미리보기</span>
            <div className="flex gap-2">
              <a
                href={`${BASE}/api/preview/${previewId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                새 탭으로 열기 ↗
              </a>
              <button onClick={() => setShowPreview(false)} className="hover:text-foreground">✕</button>
            </div>
          </div>
          <iframe
            src={`${BASE}/api/preview/${previewId}`}
            className="w-full h-80 bg-white"
            title="Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role, content, streaming = false,
}: {
  role: string;
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const copyMsg = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMsg = () => {
    const firstLine = content.split("\n")[0].slice(0, 40).replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    downloadText(content, `${firstLine || "response"}.md`);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-6 group`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        isUser ? "bg-primary text-primary-foreground" : "bg-purple-600/20 text-purple-400 border border-purple-500/30"
      }`}>
        {isUser ? "나" : "AI"}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1 overflow-hidden`}>
        {!isUser && !streaming && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
            <button onClick={copyMsg} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              {copied ? "복사됨!" : "복사"}
            </button>
            <button onClick={downloadMsg} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              .md 저장
            </button>
          </div>
        )}
        {isUser ? (
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-foreground min-w-0 overflow-x-hidden">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }: any) {
                  const inline = !className;
                  return inline
                    ? <code className="px-1.5 py-0.5 rounded text-purple-300 bg-purple-500/20 font-mono text-[0.85em]" {...props}>{children}</code>
                    : <CodeBlock className={className}>{children}</CodeBlock>;
                },
                pre({ children }: any) { return <>{children}</>; },
              }}
            >
              {content}
            </ReactMarkdown>
            {streaming && (
              <span className="inline-block w-2 h-4 bg-purple-400 rounded-sm ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingPanel({
  steps, currentStep, thinkingText, expanded, onToggle,
}: {
  steps: string[];
  currentStep: string;
  thinkingText: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = currentStep || steps[steps.length - 1] || "분석 중";
  const isThinking = !!currentStep;

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30">
        AI
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
            {isThinking ? (
              <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <svg className="w-3 h-3 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium text-foreground/80">{label}</span>
            <svg className={`w-3 h-3 ml-1 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded && (
          <div className="ml-2 border-l-2 border-purple-500/30 pl-3 space-y-1 mb-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <svg className="w-3 h-3 text-green-400/70 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {step}
              </div>
            ))}
            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-purple-400">
                <div className="w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {currentStep}
              </div>
            )}
            {thinkingText && (
              <div className="mt-2 text-xs text-muted-foreground/70 font-mono bg-muted/30 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                {thinkingText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ onPrompt }: { onPrompt: (text: string) => void }) {
  const capabilities = [
    {
      icon: "⚙️",
      title: "바이너리 빌더",
      desc: "C/C++/ASM 코드 → .exe/.dll/.sys 자동 컴파일 다운로드",
      prompt: "DLL 인젝션 C++ 코드 짜줘 (CreateRemoteThread 방식)",
    },
    {
      icon: "🌐",
      title: "웹사이트 빌더",
      desc: "코드가 아닌 실제 사이트 생성 + 실시간 미리보기",
      prompt: "멋진 SaaS 랜딩페이지 만들어줘 (다크테마, 애니메이션 포함)",
    },
    {
      icon: "🔍",
      title: "보안 연구",
      desc: "익스플로잇, 취약점 분석, 리버스 엔지니어링 — 검열 없음",
      prompt: "x64 ROP 체인 작성 방법 알려줘 (실제 예제 포함)",
    },
    {
      icon: "🤖",
      title: "무제한 코딩",
      desc: "모든 언어, 어떤 주제든 완전한 코드 — 잘림 없음",
      prompt: "Python 키로거 + 스크린샷 캡처 + 이메일 전송 코드",
    },
  ];
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 max-w-2xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center mb-6 border border-purple-500/30">
        <svg viewBox="0 0 24 24" className="w-9 h-9 text-purple-400 fill-current">
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">무엇을 만들까요?</h1>
      <p className="text-muted-foreground mb-8 text-center text-sm">
        코딩, 바이너리 빌드, 웹사이트 제작, 보안 연구 — 검열 없이 완전하게
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-6">
        {capabilities.map(cap => (
          <button
            key={cap.title}
            onClick={() => onPrompt(cap.prompt)}
            className="text-left p-4 rounded-xl border border-border bg-card hover:border-purple-500/50 hover:bg-card/80 transition-all group"
          >
            <div className="text-xl mb-1">{cap.icon}</div>
            <div className="font-semibold text-foreground text-sm mb-1 group-hover:text-purple-400 transition-colors">{cap.title}</div>
            <div className="text-muted-foreground text-xs leading-relaxed">{cap.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState("anthropic/claude-sonnet-4-5");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [thinkingText, setThinkingText] = useState("");
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: user } = useGetMe();
  const { data: conversations = [], refetch: refetchConvos } = useListConversations();
  const { data: models = [] } = useListModels();
  const { data: activeConv } = useGetConversation(
    activeConvId as number,
    { query: { enabled: activeConvId !== null, queryKey: getGetConversationQueryKey(activeConvId as number) } }
  );

  const messages = activeConv?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent, pendingUserMsg]);

  async function handleLogout() {
    try { await logout(); } catch {}
    await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/login");
  }

  function handleNewChat() {
    if (streaming) abortRef.current?.abort();
    setActiveConvId(null);
    setInput("");
    setStreamContent("");
    setPendingUserMsg(null);
    setThinkingSteps([]);
    setCurrentStep("");
    setThinkingText("");
    setAttachedFile(null);
    setStreaming(false);
  }

  async function handleDeleteConv(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversation({ id });
      await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      if (activeConvId === id) handleNewChat();
    } catch {
      toast({ title: "오류", description: "대화 삭제 실패", variant: "destructive" });
    }
  }

  async function streamMessages(convId: number, userContent: string, signal: AbortSignal) {
    const token = getToken();
    const res = await fetch(`${BASE}/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content: userContent, model: selectedModel }),
      signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("스트림을 읽을 수 없습니다");
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.thinking_step) {
            setCurrentStep(json.thinking_step);
            setThinkingSteps(p => [...p, json.thinking_step]);
          }
          if (json.thinking_done) setCurrentStep("");
          if (json.thinking) setThinkingText(p => p + json.thinking);
          if (json.content) setStreamContent(p => p + json.content);
          if (json.error) {
            toast({ title: "AI 오류", description: json.error, variant: "destructive" });
          }
        } catch {}
      }
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && !attachedFile) return;
    if (streaming) return;

    setInput("");
    setStreaming(true);
    setStreamContent("");
    setPendingUserMsg(text || `[파일: ${attachedFile?.name}]`);
    setThinkingSteps([]);
    setCurrentStep("");
    setThinkingText("");
    setThinkingExpanded(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let convId = activeConvId;
      let userContent = text;

      if (attachedFile) {
        const fd = new FormData();
        fd.append("file", attachedFile);
        const uploadToken = getToken();
        const r = await fetch(`${BASE}/api/files/upload`, {
          method: "POST",
          body: fd,
          headers: uploadToken ? { Authorization: `Bearer ${uploadToken}` } : {},
        });
        if (!r.ok) throw new Error("파일 업로드 실패");
        const fileInfo = await r.json();
        userContent = text
          ? `[파일 첨부: ${fileInfo.fileName}]\n${text}`
          : `[파일 첨부: ${fileInfo.fileName}]`;
        setAttachedFile(null);
      }

      if (!convId) {
        const title = text.slice(0, 50) || (attachedFile?.name ?? "새 대화");
        const conv = await createConversation({ title, model: selectedModel });
        convId = conv.id;
        setActiveConvId(convId);
        await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }

      await streamMessages(convId, userContent, ctrl.signal);

      await qc.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      await refetchConvos();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({
          title: "오류",
          description: err?.message ?? "메시지 전송 실패. API 키가 설정됐는지 확인하세요.",
          variant: "destructive",
        });
      }
    } finally {
      setStreaming(false);
      setStreamContent("");
      setPendingUserMsg(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePromptClick(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  const showThinking = streaming && (thinkingSteps.length > 0 || currentStep || thinkingText);
  const showStreamBubble = streaming && streamContent;
  const showWaitingDots = streaming && !thinkingSteps.length && !currentStep && !streamContent;

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {sidebarOpen && (
        <div className="mobile-sidebar sidebar-slide-in fixed md:relative inset-y-0 left-0 z-30 md:z-auto w-64 md:w-64 flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
          <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
            <span className="font-semibold text-sm text-sidebar-foreground flex items-center gap-2">
              <span className="text-purple-400">⚡</span> AI Builder
            </span>
            <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 md:hidden">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-2">
            <Button onClick={handleNewChat} className="w-full justify-start gap-2 text-sm h-9" variant="ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              새 대화
            </Button>
          </div>

          <div className="px-3 py-2">
            <label className="text-xs text-muted-foreground mb-1 block">AI 모델</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.length > 0 ? models.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                )) : (
                  <>
                    <SelectItem value="anthropic/claude-sonnet-4-5">Claude Sonnet 4.5</SelectItem>
                    <SelectItem value="anthropic/claude-opus-4">Claude Opus 4</SelectItem>
                    <SelectItem value="anthropic/claude-3.5-haiku">Claude Haiku 3.5</SelectItem>
                    <SelectItem value="deepseek/deepseek-r1">DeepSeek R1</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 px-2">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">대화 기록 없음</p>
            ) : (
              <div className="space-y-0.5 py-1">
                {conversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    onClick={() => { if (!streaming) setActiveConvId(conv.id); }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                      activeConvId === conv.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                    } ${streaming ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    <span className="text-xs flex-1 truncate">{conv.title}</span>
                    <button
                      onClick={e => handleDeleteConv(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user?.username?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="text-xs text-sidebar-foreground flex-1 truncate font-medium">{user?.username}</span>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground transition-colors" title="로그아웃">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
          <span className="text-sm font-medium text-muted-foreground truncate">
            {activeConv?.title ?? "새 대화"}
          </span>
          {activeConvId && (
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[120px] sm:max-w-none" title={activeConv?.model ?? selectedModel}>
              {(activeConv?.model ?? selectedModel).split("/").pop()?.split("-").slice(0,3).join("-") ?? ""}
            </span>
          )}
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto py-6">
            {!activeConvId && !streaming ? (
              <WelcomeScreen onPrompt={handlePromptClick} />
            ) : (
              <>
                {messages.map((msg: any) => (
                  <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}

                {streaming && pendingUserMsg && (
                  <MessageBubble role="user" content={pendingUserMsg} />
                )}

                {showWaitingDots && (
                  <div className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30">
                      AI
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                {showThinking && (
                  <ThinkingPanel
                    steps={thinkingSteps}
                    currentStep={currentStep}
                    thinkingText={thinkingText}
                    expanded={thinkingExpanded}
                    onToggle={() => setThinkingExpanded(p => !p)}
                  />
                )}

                {showStreamBubble && (
                  <MessageBubble role="assistant" content={streamContent} streaming />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="input-area px-3 sm:px-4 pt-3 pb-4 border-t border-border flex-shrink-0 bg-background">
          <div className="max-w-3xl mx-auto">
            {attachedFile && (
              <div className="flex items-center gap-2 mb-2 bg-muted/50 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="text-xs text-muted-foreground flex-1 truncate">{attachedFile.name}</span>
                <span className="text-xs text-muted-foreground">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 focus-within:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setAttachedFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 pb-1 disabled:opacity-40"
                title="파일 첨부"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={streaming ? "응답 생성 중..." : "메시지 입력... (Shift+Enter 줄바꿈)"}
                className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[24px] max-h-[200px] text-sm p-0 shadow-none"
                rows={1}
                disabled={streaming}
              />
              {streaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="flex-shrink-0 pb-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="중지"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && !attachedFile}
                  className="flex-shrink-0 pb-1 text-primary hover:text-primary/80 disabled:text-muted-foreground/40 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground/40 text-center mt-2">
              C/C++ 코드 → 컴파일 버튼으로 .exe/.dll 다운로드 · HTML → 미리보기 버튼으로 실시간 확인
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

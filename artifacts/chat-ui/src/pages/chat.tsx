import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useGetMe, useListConversations, useGetConversation, useListModels,
  createConversation, deleteConversation, logout, updateConversation,
  getListConversationsQueryKey, getGetMeQueryKey, getGetConversationQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const LANG_EXT: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts", cpp: "cpp", c: "c",
  csharp: "cs", java: "java", rust: "rs", go: "go", bash: "sh",
  shell: "sh", powershell: "ps1", html: "html", css: "css", json: "json",
  yaml: "yml", toml: "toml", sql: "sql", php: "php", ruby: "rb",
  swift: "swift", kotlin: "kt", asm: "asm", nasm: "asm", lua: "lua",
  r: "r", dart: "dart", scala: "scala", dockerfile: "dockerfile",
};

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = (className ?? "").replace("language-", "") || "text";
  const ext = LANG_EXT[lang.toLowerCase()] ?? "txt";

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => downloadText(code, `code.${ext}`);

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{lang}</span>
        <div className="flex items-center gap-3">
          <button onClick={download} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
    </div>
  );
}

function MessageBubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
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
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
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
          <div className={`prose prose-sm prose-invert max-w-none text-foreground ${streaming ? "streaming-cursor" : ""}`}>
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
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({ onPrompt }: { onPrompt: (text: string) => void }) {
  const capabilities = [
    { title: "코딩 전문가", desc: "모든 언어 코드 작성, 디버깅, 코드 리뷰", prompt: "Python으로 파일 암호화 도구를 만들어줘" },
    { title: "파일 분석", desc: "exe, dll, zip 등 모든 파일 첨부 및 분석", prompt: "코드 분석을 도와줘" },
    { title: "무제한 대화", desc: "검열 없이 어떤 주제든 자유롭게 대화", prompt: "솔직하게 조언해줘" },
    { title: "대화 기억", desc: "프로젝트별로 대화 히스토리 영구 보존", prompt: "이전 대화를 이어서 작업하고 싶어" },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 max-w-2xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 border border-primary/30">
        <svg viewBox="0 0 24 24" className="w-9 h-9 text-primary fill-current">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">무엇을 도와드릴까요?</h1>
      <p className="text-muted-foreground mb-8 text-center">코딩, 분석, 창작, 어떤 것이든 물어보세요.</p>
      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        {capabilities.map(cap => (
          <button
            key={cap.title}
            onClick={() => onPrompt(cap.prompt)}
            data-testid={`card-capability-${cap.title}`}
            className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all group"
          >
            <div className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{cap.title}</div>
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
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [thinkingText, setThinkingText] = useState("");
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: user } = useGetMe();
  const { data: conversations = [], refetch: refetchConvos } = useListConversations();
  const { data: models = [] } = useListModels();
  const { data: activeConv, refetch: refetchConv } = useGetConversation(
    activeConvId as number,
    { query: { enabled: activeConvId !== null, queryKey: getGetConversationQueryKey(activeConvId as number) } }
  );

  const messages = activeConv?.messages ?? [];
  const displayMessages = streaming
    ? [...messages, { id: -1, conversationId: activeConvId ?? 0, role: "assistant", content: streamContent, createdAt: new Date().toISOString() }]
    : messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, streaming, streamContent]);

  async function handleLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setLocation("/login");
  }

  async function handleNewChat() {
    setActiveConvId(null);
    setInput("");
    setStreamContent("");
    setThinkingSteps([]);
    setCurrentStep("");
    setThinkingText("");
    setAttachedFile(null);
  }

  async function handleDeleteConv(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteConversation({ id });
    await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    if (activeConvId === id) setActiveConvId(null);
  }

  async function streamMessages(convId: number, userContent: string, signal: AbortSignal) {
    const res = await fetch(`${BASE}/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: userContent, model: selectedModel }),
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No stream");
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
          if (json.error) toast({ title: "오류", description: json.error, variant: "destructive" });
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
    setThinkingSteps([]);
    setCurrentStep("");
    setThinkingText("");
    setThinkingExpanded(true);

    try {
      let convId = activeConvId;
      let userContent = text;

      if (attachedFile) {
        const fd = new FormData();
        fd.append("file", attachedFile);
        const r = await fetch(`${BASE}/api/files/upload`, { method: "POST", body: fd });
        const fileInfo = await r.json();
        userContent = `[파일 첨부: ${fileInfo.fileName}]\n${text}`;
      }

      if (!convId) {
        const title = text.slice(0, 50) || (attachedFile?.name ?? "새 대화");
        const conv = await createConversation({ title, model: selectedModel });
        convId = conv.id;
        setActiveConvId(convId);
        await qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      await streamMessages(convId, userContent, ctrl.signal);

      setAttachedFile(null);
      await qc.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
      await refetchConvos();
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "오류", description: "메시지 전송에 실패했습니다. API 키가 설정됐는지 확인하세요.", variant: "destructive" });
      }
    } finally {
      setStreaming(false);
      setStreamContent("");
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

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
          <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
            <span className="font-semibold text-sm text-sidebar-foreground">AI Chat</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              data-testid="button-close-sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-2">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start gap-2 text-sm h-9"
              variant="ghost"
              data-testid="button-new-chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              새 대화
            </Button>
          </div>

          <div className="px-3 py-2">
            <label className="text-xs text-muted-foreground mb-1 block">AI 모델</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border" data-testid="select-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.length > 0 ? models.map(m => (
                  <SelectItem key={m.id} value={m.id} data-testid={`option-model-${m.id}`}>
                    {m.name}
                  </SelectItem>
                )) : (
                  <>
                    <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-opus-4-8">Claude Opus 4</SelectItem>
                    <SelectItem value="claude-haiku-4-5">Claude Haiku</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 px-2">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-2">대화 기록이 없습니다</p>
            ) : (
              <div className="space-y-0.5 py-1">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    data-testid={`item-conversation-${conv.id}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer group transition-colors ${
                      activeConvId === conv.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    <span className="text-xs flex-1 truncate">{conv.title}</span>
                    <button
                      onClick={e => handleDeleteConv(conv.id, e)}
                      data-testid={`button-delete-${conv.id}`}
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
              <button
                onClick={handleLogout}
                data-testid="button-logout"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="로그아웃"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors mr-1"
              data-testid="button-open-sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
          <span className="text-sm font-medium text-muted-foreground truncate">
            {activeConv?.title ?? "새 대화"}
          </span>
          {activeConvId && (
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {activeConv?.model ?? selectedModel}
            </span>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="max-w-3xl mx-auto py-6">
            {!activeConvId ? (
              <WelcomeScreen onPrompt={handlePromptClick} />
            ) : displayMessages.length === 0 && !streaming ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                메시지를 입력해 대화를 시작하세요
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    streaming={false}
                  />
                ))}

                {/* Thinking panel — shown while streaming */}
                {streaming && (thinkingSteps.length > 0 || currentStep || thinkingText) && (
                  <div className="flex gap-3 mb-4 flex-row">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-purple-600/20 text-purple-400 border border-purple-500/30">
                      AI
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setThinkingExpanded(p => !p)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 group"
                      >
                        <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5">
                          {currentStep ? (
                            <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          ) : (
                            <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          )}
                          <span className="font-medium text-foreground/80">
                            {currentStep || (thinkingSteps[thinkingSteps.length - 1] ?? "분석 중")}
                          </span>
                          <svg className={`w-3 h-3 ml-1 transition-transform ${thinkingExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>

                      {thinkingExpanded && thinkingSteps.length > 0 && (
                        <div className="ml-2 border-l-2 border-purple-500/30 pl-3 space-y-1 mb-3">
                          {thinkingSteps.map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <svg className="w-3 h-3 text-purple-400/70 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              {step}
                            </div>
                          ))}
                          {currentStep && (
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
                )}

                {/* Streaming response */}
                {streaming && streamContent && (
                  <MessageBubble
                    key="stream"
                    role="assistant"
                    content={streamContent}
                    streaming={true}
                  />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-border">
          <div className="max-w-3xl mx-auto">
            {attachedFile && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg">
                <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="text-xs text-muted-foreground truncate flex-1">{attachedFile.name}</span>
                <span className="text-xs text-muted-foreground">({(attachedFile.size / 1024).toFixed(1)}KB)</span>
                <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="*/*"
                className="hidden"
                data-testid="input-file"
                onChange={e => setAttachedFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="파일 첨부 (exe, dll, sys, zip 등 모든 파일)"
                data-testid="button-attach-file"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                className="flex-1 min-h-[40px] max-h-40 resize-none bg-card border-border text-sm leading-relaxed"
                disabled={streaming}
                rows={1}
                data-testid="input-message"
              />
              <Button
                onClick={streaming ? () => abortRef.current?.abort() : handleSend}
                disabled={!streaming && !input.trim() && !attachedFile}
                className="flex-shrink-0 h-10 w-10 p-0"
                data-testid="button-send"
                title={streaming ? "중지" : "전송"}
              >
                {streaming ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              exe, dll, sys, zip 등 모든 파일 첨부 가능 · 대화는 자동 저장됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

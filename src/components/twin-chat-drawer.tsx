"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const DEFAULT_SUGGESTIONS = [
  "What's my strongest signal this cycle?",
  "Where am I most exposed in calibration?",
  "What should I focus on next month?",
];

export function TwinChatDrawer({
  personFirstName,
  labels,
}: {
  personFirstName: string;
  labels?: {
    launcher?: string;
    launcherEyebrow?: string;
    title?: string;
    privacy?: string;
    greeting?: string;
    tryAsking?: string;
    suggestions?: string[];
    placeholder?: string;
    clearConversation?: string;
    errorTitle?: string;
  };
}) {
  const L = {
    launcher: labels?.launcher ?? "Ask me anything",
    launcherEyebrow: labels?.launcherEyebrow ?? "Twin",
    title: labels?.title ?? "Your Twin",
    privacy: labels?.privacy ?? "Private space · nothing shared with manager or HR",
    greeting: labels?.greeting ?? "ask me about your Pulse, your evidence, your peer feedback, or just think out loud about your work.",
    tryAsking: labels?.tryAsking ?? "Try asking",
    suggestions: labels?.suggestions ?? DEFAULT_SUGGESTIONS,
    placeholder: labels?.placeholder ?? "Message your Twin…",
    clearConversation: labels?.clearConversation ?? "Clear conversation",
    errorTitle: labels?.errorTitle ?? "Twin chat unavailable",
  };
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const assistantMsg: Message = { role: "assistant", content: "" };
    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, assistantMsg]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/twin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }

      // The route returns JSON when there's no API key, otherwise a text stream
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        if (j.error === "no_api_key") {
          setError(j.message ?? "Twin chat requires ANTHROPIC_API_KEY.");
          setMessages(nextHistory); // drop the empty assistant message
          return;
        }
        throw new Error(j.message ?? "Twin chat error");
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...nextHistory, { role: "assistant", content: accumulated }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages(nextHistory);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 end-6 z-40 flex items-center gap-3 ps-2 pe-5 py-2 rounded-full bg-ink-900 text-white shadow-lg hover:bg-ink-800 transition group"
        title={L.title}
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 twin-glow" />
          <div className="absolute inset-0 rounded-full ring-2 ring-white/20" />
        </div>
        <div className="text-start">
          <div className="text-[10px] uppercase tracking-wider opacity-70">{L.launcherEyebrow}</div>
          <div className="text-[13px] font-semibold">{L.launcher}</div>
        </div>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/20 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 end-0 z-50 h-full w-full max-w-md bg-white shadow-2xl border-s border-soft flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "rtl:-translate-x-full ltr:translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="px-5 py-4 border-b border-soft flex items-center gap-3 bg-gradient-to-br from-gold-50/60 to-white">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 twin-glow flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg text-ink-900 leading-tight">{L.title}</div>
            <div className="text-[11px] text-ink-500 leading-tight">
              {L.privacy}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-ink-400 hover:text-ink-900 transition p-2 -me-2"
            title="Close (ESC)"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-surface-50">
          {messages.length === 0 && !error && (
            <div>
              <div className="text-[14px] text-ink-700 leading-relaxed mb-4">
                {personFirstName} — {L.greeting}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-2">{L.tryAsking}</div>
              <div className="space-y-2">
                {L.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-start text-[13px] text-ink-800 bg-white border border-soft hover:border-gold-500 hover:bg-gold-50/40 transition rounded-lg px-3 py-2.5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex-shrink-0 mr-2 mt-0.5" />
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-ink-900 text-white rounded-br-sm"
                    : "bg-white border border-soft text-ink-900 rounded-bl-sm"
                }`}
              >
                {m.content || (streaming && i === messages.length - 1 ? <TypingDots /> : null)}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg bg-warn-50 border border-warn-500/30 p-3 text-[12px] text-warn-700">
              <div className="font-semibold mb-1">{L.errorTitle}</div>
              <div className="text-ink-700">{error}</div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          className="border-t border-soft p-4 bg-white"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={L.placeholder}
              className="flex-1 bg-surface-50 border border-soft rounded-full px-4 py-2.5 text-[14px] text-ink-900 placeholder-ink-400 focus:bg-white focus:border-gold-500 transition"
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="w-10 h-10 rounded-full bg-gold-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gold-700 transition flex-shrink-0"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          {messages.length > 0 && !streaming && (
            <button
              type="button"
              onClick={() => { setMessages([]); setError(null); }}
              className="text-[11px] text-ink-400 hover:text-ink-700 mt-2 ms-1"
            >
              {L.clearConversation}
            </button>
          )}
        </form>
      </aside>
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-label="Twin is typing">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-[typing_1.4s_ease-in-out_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-[typing_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-[typing_1.4s_ease-in-out_0.4s_infinite]" />
      <style>{`@keyframes typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-2px); } }`}</style>
    </span>
  );
}

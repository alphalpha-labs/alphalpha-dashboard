"use client";
import { useState, useRef, useEffect } from "react";
import type { ThreadContext } from "./Dashboard";
import { MODELS, DEFAULT_MODEL } from "@/lib/models";

type Message = { role: "assistant" | "user"; content: string };

function buildSystemPrompt(ctx: ThreadContext): string {
  // OPENCLAW: This system prompt is sent to /api/thread on every message.
  // When you wire up your AI endpoint, this is the full context you'll receive.
  // Modify the prompt template here if you want Alphalpha's personality adjusted.
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const lines = [
    `You are Alphalpha, Alex's personal AI chief of staff. Today is ${today}.`,
    `You are discussing a ${ctx.type} item.`,
    `Title: "${ctx.title}"`,
    ctx.project  && `Project: ${ctx.project}`,
    ctx.priority && `Priority: ${ctx.priority}`,
    ctx.next     && `Suggested next step: ${ctx.next}`,
    ctx.theme    && `Investment theme: ${ctx.theme}`,
    ctx.stance   && `Stance: ${ctx.stance}`,
    ctx.summary  && `Summary: ${ctx.summary}`,
    ctx.category && `Category: ${ctx.category}`,
    ctx.ocOwned  && `This item is actively managed by OpenClaw.`,
    `Be concise (≤3 sentences), warm, and concrete. Help Alex decide, act, or think more clearly.`,
  ];
  return lines.filter(Boolean).join("\n");
}

function openerFor(ctx: ThreadContext): string {
  const t = ctx.title;
  switch (ctx.type) {
    case "decision": return `On "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — what's your thinking? I can help you decide or draft the next step.`;
    case "loop":     return `This loop has been open for a while. Want to close it, snooze it, or think through what's blocking it?`;
    case "project":  return ctx.ocOwned
      ? `I'm actively managing this one. What aspect of "${t}" do you want to think through?`
      : `This is a manually-tracked project. What aspect of "${t}" do you want to think through?`;
    case "ticker":   return `${t} — ${ctx.theme ?? ""}. Want to think through the thesis, timing, or what would change your mind?`;
    case "digest":   return `"${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — want to dig into this, connect it to other threads, or decide what to do with it?`;
    case "systemDoc": return `This is one of Alphalpha's source documents. Want to inspect the policy, revise it, or turn part of it into an action?`;
    default:         return `Want to think through "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" together?`;
  }
}

interface Props {
  thread:  ThreadContext | null;
  onClose: () => void;
}

export default function ThreadDrawer({ thread, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [model,    setModel]    = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    return localStorage.getItem("alphalpha-model") ?? DEFAULT_MODEL;
  });
  const inputRef    = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const prevId      = useRef<string | null>(null);

  const handleModelChange = (id: string) => {
    setModel(id);
    localStorage.setItem("alphalpha-model", id);
  };

  useEffect(() => {
    if (!thread) return;
    if (thread.id === prevId.current) return;
    prevId.current = thread.id;
    setMessages([{ role: "assistant", content: openerFor(thread) }]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 320);
  }, [thread?.id]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!thread || !input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "· · ·" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(thread),
          messages:     history,
          threadId:     thread.id,
          threadType:   thread.type,
          model,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[ThreadDrawer] /api/thread failed:", res.status, errBody);
        throw new Error(`HTTP ${res.status}: ${errBody.detail ?? errBody.error ?? ""}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuffer  = "";

      reading: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer  = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { reader.cancel(); break reading; }
          try {
            const evt = JSON.parse(raw);
            // Responses API: response.output_text.delta
            const delta: string =
              typeof evt.delta === "string"           ? evt.delta :
              typeof evt.delta?.text === "string"     ? evt.delta.text :
              evt.choices?.[0]?.delta?.content        ?? "";
            if (delta) {
              accumulated += delta;
              setMessages([...history, { role: "assistant", content: accumulated }]);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      if (!accumulated) throw new Error("Empty response");
    } catch (err) {
      console.error("[ThreadDrawer] send failed:", err);
      setMessages([...history, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  // OPENCLAW: Thread conversations currently reset on every item change.
  // To persist threads across navigation, key messages to localStorage by item id:
  //   localStorage.setItem(`thread-${ctx.id}`, JSON.stringify(messages))
  // Implement once the real AI endpoint is wired.

  const isOpen = !!thread;

  return (
    <aside className={`threadDrawer${isOpen ? " threadDrawer--open" : ""}`} aria-hidden={!isOpen}>
      {thread && (
        <>
          <div className="threadHeader">
            <div className="threadAvatar">α</div>
            <div className="threadMeta">
              <div className="threadType">{thread.type}</div>
              <div className="threadItemTitle" title={thread.title}>
                {thread.title.slice(0, 60)}{thread.title.length > 60 ? "…" : ""}
              </div>
              {(thread.project || thread.ocOwned) && (
                <div className="threadProject">
                  {thread.project}
                  {thread.ocOwned && <span className="badgeOC"><span className="alphaGlyph">α</span> OpenClaw managed</span>}
                </div>
              )}
            </div>
            <button className="threadClose" onClick={onClose} aria-label="Close thread">✕</button>
          </div>

          <div className="threadMessages" ref={messagesRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`threadMsgRow threadMsgRow--${msg.role}`}>
                {msg.role === "assistant" && <div className="threadAvatarSm">α</div>}
                <div className={`threadBubble${msg.content === "· · ·" ? " threadLoading" : ""}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="threadFooter">
            <div className="threadModelRow">
              <select
                className="threadModelSelect"
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                disabled={loading}
                aria-label="Model"
              >
                {MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="threadInputRow">
              <input
                ref={inputRef}
                className="threadInput"
                placeholder="Share your thinking, ask a question…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                disabled={loading}
              />
              <button className="threadSend" onClick={send} disabled={loading} aria-label="Send">↑</button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

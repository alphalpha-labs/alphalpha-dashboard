"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { ThreadContext } from "./Dashboard";
import { MODELS, DEFAULT_MODEL } from "@/lib/models";
import {
  getThreadsForItem,
  upsertThread,
  deleteThread as removeThread,
  newThreadId,
  type StoredThread,
} from "@/lib/threads";

type Message = { role: "assistant" | "user"; content: string };

function renderMessageContent(content: string) {
  if (content === "· · ·") return content;
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/(#{2,6}\s+)/g, "\n$1")
    .replace(/\s+-\s+(?=\*\*?[A-Za-z0-9$])/g, "\n- ")
    .trim();
  const blocks = normalized.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const heading = lines.length === 1 ? lines[0].match(/^#{1,6}\s+(.+)/) : null;
    if (heading) return <strong key={blockIndex} className="threadMarkdownHeading">{stripMarkdown(heading[1])}</strong>;
    if (lines.every(line => /^[-*]\s+/.test(line))) {
      return (
        <ul key={blockIndex} className="threadMarkdownList">
          {lines.map((line, lineIndex) => <li key={lineIndex}>{stripMarkdown(line.replace(/^[-*]\s+/, ""))}</li>)}
        </ul>
      );
    }
    return <p key={blockIndex}>{stripMarkdown(lines.join(" "))}</p>;
  });
}

function stripMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

function buildSystemPrompt(ctx: ThreadContext): string {
  // OPENCLAW: This system prompt is sent to /api/thread on every message.
  // Modify here to adjust Alphalpha's personality or context fields.
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
    `Be concise, warm, and concrete. Use mobile-readable plain text: short paragraphs, at most 5 bullets, no markdown tables, no long ticker dumps unless asked. Help Alex decide, act, or think more clearly.`,
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
    case "queueItem": return `Want to read/watch this soon, save it for later, or use it as a recommendation seed?`;
    default:         return `Want to think through "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" together?`;
  }
}

function formatDate(ts: number): string {
  const d     = new Date(ts);
  const today = new Date();
  const time  = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return time;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + time;
}

interface Props {
  thread:  ThreadContext | null;
  onClose: () => void;
}

export default function ThreadDrawer({ thread, onClose }: Props) {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [model,       setModel]       = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    return localStorage.getItem("alphalpha-model") ?? DEFAULT_MODEL;
  });
  const [view,        setView]        = useState<"chat" | "history">("chat");
  const [threadId,    setThreadId]    = useState<string | null>(null);
  const [itemThreads, setItemThreads] = useState<StoredThread[]>([]);

  const inputRef   = useRef<HTMLInputElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const prevItemId = useRef<string | null>(null);

  // Create a fresh thread, save it to KV, and activate it.
  const startFresh = useCallback(async (ctx: ThreadContext) => {
    const id      = newThreadId();
    const initial: Message[] = [{ role: "assistant", content: openerFor(ctx) }];
    const now     = Date.now();
    const record: StoredThread = {
      id, itemId: ctx.id, itemTitle: ctx.title, itemType: ctx.type,
      messages: initial, startedAt: now, updatedAt: now,
    };
    await upsertThread(record);
    setThreadId(id);
    setMessages(initial);
    return record;
  }, []);

  // Load or start a thread whenever the item changes.
  useEffect(() => {
    if (!thread) return;
    if (thread.id === prevItemId.current) return;
    prevItemId.current = thread.id;
    setView("chat");
    setInput("");
    setMessages([]); // clear while fetching

    (async () => {
      const threads = await getThreadsForItem(thread.id);
      if (threads.length > 0) {
        setThreadId(threads[0].id);
        setMessages(threads[0].messages);
        setItemThreads(threads);
      } else {
        const record = await startFresh(thread);
        setItemThreads([record]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    })();
  }, [thread?.id, startFresh]);

  // Auto-scroll chat on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewThread = async () => {
    if (!thread || loading) return;
    await startFresh(thread);
    setItemThreads(await getThreadsForItem(thread.id));
    setView("chat");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleLoadThread = (stored: StoredThread) => {
    setThreadId(stored.id);
    setMessages(stored.messages);
    setView("chat");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleDeleteThread = async (id: string) => {
    await removeThread(id, thread!.id);
    const remaining = await getThreadsForItem(thread!.id);
    setItemThreads(remaining);
    if (id !== threadId) return;
    if (remaining.length > 0) {
      setThreadId(remaining[0].id);
      setMessages(remaining[0].messages);
    } else {
      await startFresh(thread!);
      setItemThreads(await getThreadsForItem(thread!.id));
    }
    setView("chat");
  };

  const handleModelChange = (id: string) => {
    setModel(id);
    localStorage.setItem("alphalpha-model", id);
  };

  const send = async () => {
    if (!thread || !threadId || !input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "· · ·" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/thread", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          systemPrompt: buildSystemPrompt(thread),
          messages:     history,
          threadId,
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
            const evt   = JSON.parse(raw);
            const delta: string =
              typeof evt.delta === "string"       ? evt.delta :
              typeof evt.delta?.text === "string" ? evt.delta.text :
              evt.choices?.[0]?.delta?.content    ?? "";
            if (delta) {
              accumulated += delta;
              setMessages([...history, { role: "assistant", content: accumulated }]);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      if (!accumulated) throw new Error("Empty response");

      // Persist the completed exchange to KV.
      const finalMessages = [...history, { role: "assistant", content: accumulated }];
      setMessages(finalMessages);
      const now = Date.now();
      await upsertThread({
        id: threadId, itemId: thread.id, itemTitle: thread.title, itemType: thread.type,
        messages: finalMessages, startedAt: now, updatedAt: now,
      });
      setItemThreads(await getThreadsForItem(thread.id));

    } catch (err) {
      console.error("[ThreadDrawer] send failed:", err);
      setMessages([...history, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const isOpen = !!thread;

  return (
    <>
    <button
      className={`threadScrim${isOpen ? " threadScrim--open" : ""}`}
      aria-label="Close discussion"
      tabIndex={isOpen ? 0 : -1}
      onClick={onClose}
    />
    <aside className={`threadDrawer${isOpen ? " threadDrawer--open" : ""}`} aria-hidden={!isOpen} role="dialog" aria-modal={isOpen}>
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
            <div className="threadActions">
              <button
                className="threadActionBtn"
                onClick={handleNewThread}
                disabled={loading}
                aria-label="New thread"
                title="New thread"
              >+</button>
              <button
                className={`threadActionBtn${view === "history" ? " threadActionBtn--on" : ""}`}
                onClick={() => setView(v => v === "history" ? "chat" : "history")}
                aria-label={view === "history" ? "Back to chat" : "Thread history"}
                title={view === "history" ? "Back to chat" : "Thread history"}
              >≡</button>
            </div>
            <button className="threadClose" onClick={onClose} aria-label="Close thread">✕</button>
          </div>

          {view === "history" ? (
            <div className="threadHistoryList" ref={scrollRef}>
              {itemThreads.length === 0 ? (
                <p className="threadHistoryEmpty">No saved threads for this item.</p>
              ) : itemThreads.map(t => {
                const firstUser = t.messages.find(m => m.role === "user");
                const msgCount  = t.messages.filter(m => m.role === "user").length;
                const isActive  = t.id === threadId;
                return (
                  <div
                    key={t.id}
                    className={`threadHistoryItem${isActive ? " threadHistoryItem--active" : ""}`}
                    onClick={() => handleLoadThread(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && handleLoadThread(t)}
                  >
                    <div className="threadHistoryTop">
                      <span className="threadHistoryDate">{formatDate(t.updatedAt)}</span>
                      {isActive && <span className="threadHistoryCurrent">current</span>}
                      <button
                        className="threadHistoryDelete"
                        onClick={e => { e.stopPropagation(); handleDeleteThread(t.id); }}
                        aria-label="Delete thread"
                        title="Delete thread"
                      >✕</button>
                    </div>
                    <div className="threadHistoryPreview">
                      {firstUser
                        ? `"${firstUser.content.slice(0, 80)}${firstUser.content.length > 80 ? "…" : ""}"`
                        : <em>No messages yet</em>}
                    </div>
                    <div className="threadHistoryCount">
                      {msgCount} message{msgCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="threadMessages" ref={scrollRef}>
              {messages.map((msg, i) => (
                <div key={i} className={`threadMsgRow threadMsgRow--${msg.role}`}>
                  {msg.role === "assistant" && <div className="threadAvatarSm">α</div>}
                  <div className={`threadBubble${msg.content === "· · ·" ? " threadLoading" : ""}`}>
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                disabled={loading || view === "history"}
              />
              <button
                className="threadSend"
                onClick={send}
                disabled={loading || view === "history"}
                aria-label="Send"
              >↑</button>
            </div>
          </div>
        </>
      )}
    </aside>
    </>
  );
}

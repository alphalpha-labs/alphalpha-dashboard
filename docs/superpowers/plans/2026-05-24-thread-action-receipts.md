# Thread Action Cards & Receipts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a thread conversation leads to a concrete next step, Alphalpha surfaces an inline action card with confirm/dismiss; confirming calls `/api/signal` and, on success, animates the card into a green receipt.

**Architecture:** Alphalpha embeds a fenced `action` JSON block at the end of its response; `parseActionBlock()` strips it from displayed text and returns a typed `ActionProposal`. `ActionPanel` renders the proposal (structured or narrative variant), manages its own loading/done/error state, and POSTs to `/api/signal` on confirm. `ThreadDrawer` stores one `pendingAction` in state, clears it on dismiss, and replaces it when a new AI response arrives.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS custom properties (no Tailwind), existing `/api/signal` route, `@upstash/redis` for thread persistence. Tests use Vitest (added as dev dependency).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/actions.ts` | **Create** | `ActionProposal` type + `parseActionBlock()` utility |
| `lib/actions.test.ts` | **Create** | Unit tests for `parseActionBlock()` |
| `components/ActionPanel.tsx` | **Create** | Both card variants + all states (idle/loading/done/error) |
| `app/globals.css` | **Modify** | New CSS classes for action panel, animations, receipt state |
| `components/ThreadDrawer.tsx` | **Modify** | Parse action block after stream, hold `pendingAction` state, render `<ActionPanel>` |

---

## Task 1: Install Vitest and define the `ActionProposal` type

**Files:**
- Create: `lib/actions.ts`
- Create: `lib/actions.test.ts`

- [ ] **Step 1.1: Install Vitest**

```bash
npm install --save-dev vitest
```

Add a test script to `package.json`. Open `package.json` and add `"test": "vitest run"` to the `scripts` block:

```json
"scripts": {
  "dev":   "next dev",
  "build": "next build",
  "start": "next start",
  "lint":  "next lint",
  "test":  "vitest run"
}
```

- [ ] **Step 1.2: Create `lib/actions.ts` with types and parser**

```typescript
// lib/actions.ts
// Shared types and utilities for thread action proposals.
// Imported by both client components and (if needed) server routes.

export type StructuredPreview = {
  item:  string;
  field: string;
  from:  string;
  to:    string;
};

export type NarrativePreview = {
  summary: string;
  tags:    string[];
};

export type ActionProposal = {
  variant: "structured" | "narrative";
  label:   string;          // e.g. "Proposed change", "Proposed actions"
  signal:  string;          // maps to /api/signal `type` field
  payload: Record<string, unknown>;
  preview: StructuredPreview | NarrativePreview;
};

export function isStructured(p: ActionProposal): p is ActionProposal & { preview: StructuredPreview } {
  return p.variant === "structured";
}

// ACTION_FENCE matches a fenced ```action ... ``` block at the end of a response.
// The leading whitespace/newlines before the fence are also consumed.
const ACTION_FENCE_RE = /\n?\s*```action\n([\s\S]*?)```\s*$/;

/**
 * Strips the action fence from `text` and parses the embedded JSON.
 * Returns the cleaned display text and a proposal (or null if none / malformed).
 * Never throws — malformed blocks are silently discarded.
 */
export function parseActionBlock(text: string): {
  cleaned:  string;
  proposal: ActionProposal | null;
} {
  const match = text.match(ACTION_FENCE_RE);
  if (!match) return { cleaned: text, proposal: null };

  try {
    const raw = JSON.parse(match[1]) as Partial<ActionProposal>;
    if (
      (raw.variant !== "structured" && raw.variant !== "narrative") ||
      typeof raw.signal  !== "string" || !raw.signal  ||
      typeof raw.label   !== "string" || !raw.label   ||
      !raw.payload || typeof raw.payload !== "object"  ||
      !raw.preview || typeof raw.preview !== "object"
    ) {
      return { cleaned: text, proposal: null };
    }
    const cleaned = text.replace(ACTION_FENCE_RE, "").trim();
    return { cleaned, proposal: raw as ActionProposal };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

/**
 * Strip-only version used during live streaming to hide a partial fence
 * that is still building. Removes everything from the opening fence onwards.
 */
export function stripPartialActionFence(text: string): string {
  return text.replace(/\n?\s*```action[\s\S]*$/, "").trim();
}
```

- [ ] **Step 1.3: Write failing tests**

```typescript
// lib/actions.test.ts
import { describe, it, expect } from "vitest";
import { parseActionBlock, stripPartialActionFence } from "./actions";

const STRUCTURED_BLOCK = `I'll update your conviction.

\`\`\`action
{
  "variant": "structured",
  "label": "Proposed change",
  "signal": "investment-action",
  "payload": { "action": "update-conviction", "value": "high" },
  "preview": { "item": "NVDA thesis", "field": "Conviction", "from": "Medium", "to": "High" }
}
\`\`\``;

const NARRATIVE_BLOCK = `On it.

\`\`\`action
{
  "variant": "narrative",
  "label": "Proposed actions",
  "signal": "automation-action",
  "payload": { "action": "multi-step" },
  "preview": { "summary": "Draft note, flag loop", "tags": ["Research note", "Loop"] }
}
\`\`\``;

describe("parseActionBlock", () => {
  it("parses a valid structured block and returns cleaned text", () => {
    const { cleaned, proposal } = parseActionBlock(STRUCTURED_BLOCK);
    expect(cleaned).toBe("I'll update your conviction.");
    expect(proposal).not.toBeNull();
    expect(proposal!.variant).toBe("structured");
    expect(proposal!.signal).toBe("investment-action");
    expect((proposal!.preview as any).to).toBe("High");
  });

  it("parses a valid narrative block", () => {
    const { cleaned, proposal } = parseActionBlock(NARRATIVE_BLOCK);
    expect(cleaned).toBe("On it.");
    expect(proposal!.variant).toBe("narrative");
    expect((proposal!.preview as any).tags).toEqual(["Research note", "Loop"]);
  });

  it("returns null proposal for plain text with no fence", () => {
    const { cleaned, proposal } = parseActionBlock("Just some text.");
    expect(cleaned).toBe("Just some text.");
    expect(proposal).toBeNull();
  });

  it("returns null proposal for malformed JSON inside fence", () => {
    const bad = "Text.\n\`\`\`action\n{ not json }\n\`\`\`";
    const { cleaned, proposal } = parseActionBlock(bad);
    expect(cleaned).toBe("Text.\n\`\`\`action\n{ not json }\n\`\`\`");
    expect(proposal).toBeNull();
  });

  it("returns null proposal when required fields are missing", () => {
    const incomplete = "Text.\n\`\`\`action\n{\"variant\":\"structured\"}\n\`\`\`";
    const { proposal } = parseActionBlock(incomplete);
    expect(proposal).toBeNull();
  });

  it("returns null proposal for unknown variant", () => {
    const badVariant = `Text.\n\`\`\`action\n{"variant":"unknown","signal":"s","label":"l","payload":{},"preview":{}}\n\`\`\``;
    const { proposal } = parseActionBlock(badVariant);
    expect(proposal).toBeNull();
  });
});

describe("stripPartialActionFence", () => {
  it("removes a partial fence mid-stream", () => {
    const partial = "I'll update your conviction.\n\`\`\`action\n{\"variant\":";
    expect(stripPartialActionFence(partial)).toBe("I'll update your conviction.");
  });

  it("leaves plain text unchanged", () => {
    expect(stripPartialActionFence("Plain text.")).toBe("Plain text.");
  });
});
```

- [ ] **Step 1.4: Run tests and verify they fail**

```bash
npm test
```

Expected: Tests fail with "Cannot find module './actions'" or similar.

- [ ] **Step 1.5: Run tests again to verify they pass**

```bash
npm test
```

Expected: All 8 tests pass.

- [ ] **Step 1.6: Commit**

```bash
git add lib/actions.ts lib/actions.test.ts package.json package-lock.json
git commit -m "feat: add ActionProposal types and parseActionBlock utility"
```

---

## Task 2: Add CSS for the action panel

**Files:**
- Modify: `app/globals.css` (append after the `.threadSend:disabled` line near the thread section)

- [ ] **Step 2.1: Add action panel CSS**

Open `app/globals.css`. Find the line:
```css
.threadSend:disabled, .threadInput:disabled { opacity: 0.45; cursor: default; }
```

Add the following block immediately after it:

```css
/* 19b. Thread action panel */
.actionPanel {
  margin-left: 29px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  background: var(--bg-side);
  transition: border-color 0.2s ease, background 0.2s ease;
}
.actionPanel-head {
  background: var(--border-faint);
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-faint);
}
.actionPanel-headLabel {
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-muted);
}
.actionPanel-body { padding: 9px 10px; }
.actionPanel-foot {
  padding: 8px 10px;
  border-top: 1px solid var(--border-faint);
  display: flex; gap: 6px;
}

/* Structured variant */
.actionFieldRow {
  display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px;
}
.actionFieldRow:last-child { margin-bottom: 0; }
.actionFieldLabel {
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint);
  width: 44px; flex-shrink: 0;
}
.actionFieldVal {
  font-family: 'Lora', Georgia, serif; font-size: 11px; color: var(--ink-2);
}
.actionFieldArrow { font-size: 10px; color: var(--ink-faint); }
.actionFieldVal--new { color: var(--accent-low); font-weight: 500; font-family: 'DM Sans', sans-serif; }

/* Narrative variant */
.actionNarrativeSummary {
  font-family: 'Lora', Georgia, serif; font-size: 12px; color: var(--ink-2);
  line-height: 1.5; margin-bottom: 8px; font-style: italic;
}
.actionTags { display: flex; flex-wrap: wrap; gap: 4px; }
.actionTag {
  background: var(--border-faint); border: 1px solid var(--border);
  border-radius: 99px; padding: 2px 8px;
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted);
}

/* Buttons */
.actionConfirmBtn {
  background: var(--dark-fill); color: var(--dark-fill-text);
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 500;
  padding: 5px 11px; border-radius: 6px; cursor: pointer; border: none;
  transition: transform 80ms ease; display: flex; align-items: center; gap: 4px;
}
.actionConfirmBtn:hover:not(:disabled) { transform: scale(0.97); }
.actionConfirmBtn:disabled { opacity: 0.5; cursor: default; }
.actionDismissBtn {
  background: transparent; color: var(--ink-faint);
  border: 1px solid var(--border-faint); border-radius: 6px;
  padding: 5px 8px; font-family: 'DM Sans', sans-serif; font-size: 10px; cursor: pointer;
}
.actionDismissBtn:disabled { opacity: 0.4; cursor: default; }

/* Loading state */
.actionPanel--loading { animation: panelPulse 1s ease-in-out infinite; }
@keyframes panelPulse {
  0%, 100% { border-color: var(--border); }
  50%       { border-color: var(--border-strong); }
}

/* Done / receipt state */
.actionPanel--done {
  background: #eef4eb;
  border-color: #b8d4b0;
  animation: panelPop 0.45s cubic-bezier(0.16,1,0.3,1) both;
}
@keyframes panelPop {
  0%   { transform: scale(0.96); opacity: 0.7; }
  60%  { transform: scale(1.015); }
  100% { transform: scale(1); opacity: 1; }
}
.actionReceipt { padding: 10px; display: flex; align-items: center; gap: 9px; }
.actionReceiptCheck {
  width: 26px; height: 26px; background: var(--accent-low); color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
  animation: checkBounce 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.15s both;
}
@keyframes checkBounce {
  0%   { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.actionReceiptMain {
  font-family: 'DM Sans', sans-serif; font-size: 11px;
  font-weight: 600; color: #3a5a38;
}
.actionReceiptSub {
  font-family: 'DM Sans', sans-serif; font-size: 10px;
  color: var(--accent-low); opacity: 0.8; margin-top: 2px;
}
.actionReceiptShimmer {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
  animation: shimmer 0.65s ease 0.05s both;
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translateX(110%); opacity: 0; }
}

/* Error state */
.actionPanel--error { border-color: #c8906a; background: #fdf0ea; }
.actionErrorMsg {
  font-family: 'DM Sans', sans-serif; font-size: 11px; color: #8a4030;
  padding: 4px 0 6px;
}

/* Dismiss animation */
.actionPanel--dismissed {
  animation: panelDismiss 0.3s ease both;
  pointer-events: none;
}
@keyframes panelDismiss {
  0%   { opacity: 1; max-height: 200px; }
  100% { opacity: 0; max-height: 0; padding: 0; margin: 0; border-width: 0; }
}
```

- [ ] **Step 2.2: Verify the build still compiles**

```bash
npm run build
```

Expected: Build succeeds (CSS is static, no TS errors introduced).

- [ ] **Step 2.3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add action panel CSS — panel, variants, animations, receipt, error states"
```

---

## Task 3: Build the `ActionPanel` component

**Files:**
- Create: `components/ActionPanel.tsx`

- [ ] **Step 3.1: Create `components/ActionPanel.tsx`**

```typescript
// components/ActionPanel.tsx
"use client";
import { useState } from "react";
import { isStructured, type ActionProposal, type StructuredPreview, type NarrativePreview } from "@/lib/actions";

type PanelState = "idle" | "loading" | "done" | "error";

interface Props {
  proposal: ActionProposal;
  itemId:   string;
  onDismiss: () => void;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function receiptCopy(proposal: ActionProposal): { main: string; sub: string } {
  if (isStructured(proposal)) {
    const p = proposal.preview as StructuredPreview;
    return {
      main: `${p.field} updated to ${p.to}`,
      sub:  `${p.item} · logged ${formatTime()}`,
    };
  }
  const p = proposal.preview as NarrativePreview;
  const count = p.tags?.length ?? 1;
  return {
    main: count === 1 ? "Action queued" : `${count} actions queued`,
    sub:  `${p.tags?.join(" · ") ?? "Done"} · ${formatTime()}`,
  };
}

export default function ActionPanel({ proposal, itemId, onDismiss }: Props) {
  const [state,       setState]       = useState<PanelState>("idle");
  const [dismissing,  setDismissing]  = useState(false);
  const [receipt,     setReceipt]     = useState<{ main: string; sub: string } | null>(null);

  const handleConfirm = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/signal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:    proposal.signal,
          itemId,
          payload: proposal.payload,
        }),
      });
      if (!res.ok) throw new Error(`Signal failed: ${res.status}`);
      setReceipt(receiptCopy(proposal));
      setState("done");
    } catch (err) {
      console.error("[ActionPanel] signal failed:", err);
      setState("error");
    }
  };

  const handleDismiss = () => {
    setDismissing(true);
    // Wait for the CSS dismiss animation to finish before removing from DOM.
    setTimeout(() => onDismiss(), 300);
  };

  const handleRetry = () => setState("idle");

  // ── Done (receipt) ──
  if (state === "done" && receipt) {
    return (
      <div className="actionPanel actionPanel--done">
        <div className="actionReceiptShimmer" />
        <div className="actionReceipt">
          <div className="actionReceiptCheck">✓</div>
          <div>
            <div className="actionReceiptMain">{receipt.main}</div>
            <div className="actionReceiptSub">{receipt.sub}</div>
          </div>
        </div>
      </div>
    );
  }

  const panelClass = [
    "actionPanel",
    state === "loading"  && "actionPanel--loading",
    state === "error"    && "actionPanel--error",
    dismissing           && "actionPanel--dismissed",
  ].filter(Boolean).join(" ");

  const busy = state === "loading";

  // ── Structured body ──
  const structuredBody = isStructured(proposal) && (() => {
    const p = proposal.preview as StructuredPreview;
    return (
      <div className="actionPanel-body">
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Item</span>
          <span className="actionFieldVal">{p.item}</span>
        </div>
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Field</span>
          <span className="actionFieldVal">{p.field}</span>
        </div>
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Change</span>
          <span className="actionFieldVal">{p.from}</span>
          <span className="actionFieldArrow">→</span>
          <span className="actionFieldVal actionFieldVal--new">{p.to}</span>
        </div>
      </div>
    );
  })();

  // ── Narrative body ──
  const narrativeBody = !isStructured(proposal) && (() => {
    const p = proposal.preview as NarrativePreview;
    return (
      <div className="actionPanel-body">
        <div className="actionNarrativeSummary">"{p.summary}"</div>
        {p.tags?.length > 0 && (
          <div className="actionTags">
            {p.tags.map(tag => <span key={tag} className="actionTag">{tag}</span>)}
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className={panelClass}>
      <div className="actionPanel-head">
        <span className="actionPanel-headLabel">{proposal.label}</span>
      </div>

      {structuredBody || narrativeBody}

      <div className="actionPanel-foot">
        {state === "error" ? (
          <>
            <span className="actionErrorMsg">Something went wrong — try again</span>
            <button className="actionConfirmBtn" onClick={handleRetry}>Retry</button>
            <button className="actionDismissBtn" onClick={handleDismiss}>Dismiss</button>
          </>
        ) : (
          <>
            <button className="actionConfirmBtn" onClick={handleConfirm} disabled={busy}>
              {busy ? "Working…" : "✓ " + confirmLabel(proposal)}
            </button>
            <button className="actionDismissBtn" onClick={handleDismiss} disabled={busy}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function confirmLabel(proposal: ActionProposal): string {
  // The label field from Alphalpha doubles as section heading;
  // derive a verb phrase from the variant.
  if (isStructured(proposal)) return "Apply change";
  const p = proposal.preview as NarrativePreview;
  const count = p.tags?.length ?? 1;
  return count === 1 ? "Do this" : "Do all of this";
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3.3: Commit**

```bash
git add components/ActionPanel.tsx
git commit -m "feat: add ActionPanel component — structured/narrative variants, idle/loading/done/error states"
```

---

## Task 4: Update `buildSystemPrompt()` to instruct Alphalpha

**Files:**
- Modify: `components/ThreadDrawer.tsx` — `buildSystemPrompt()` function only

- [ ] **Step 4.1: Add action-block instructions to `buildSystemPrompt()`**

Open `components/ThreadDrawer.tsx`. Find the `buildSystemPrompt` function. Replace the last line of the `lines` array:

```typescript
// BEFORE:
`Be concise, warm, and concrete. Use mobile-readable plain text: short paragraphs, at most 5 bullets, no markdown tables, no long ticker dumps unless asked. Help Alex decide, act, or think more clearly.`,
```

```typescript
// AFTER:
`Be concise, warm, and concrete. Use mobile-readable plain text: short paragraphs, at most 5 bullets, no markdown tables, no long ticker dumps unless asked. Help Alex decide, act, or think more clearly.`,
`
ACTIONS: When the conversation clearly warrants a concrete, reversible workspace action, append a fenced action block after your text response. Rules:
- Only propose when an action is genuinely needed — not speculatively.
- Use variant "structured" for a single field change (status, conviction, priority, snooze date). Use variant "narrative" for multi-step or ambiguous actions.
- The "signal" field must be one of: done, snooze, skip, add-loop, review-action, automation-action, investment-action.
- The "payload" must match what /api/signal expects for that signal type.
- If Alex pushes back, revise your response in plain text first — do not immediately re-propose.
- If no action is warranted, respond with plain text only. Never include an empty or speculative action block.

Format (append after your text, no extra commentary):
\`\`\`action
{"variant":"structured"|"narrative","label":"<section heading>","signal":"<type>","payload":{...},"preview":{...}}
\`\`\`

Structured preview shape: {"item":"...","field":"...","from":"...","to":"..."}
Narrative preview shape:  {"summary":"plain sentence describing all actions","tags":["Tag1","Tag2"]}
`,
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4.3: Commit**

```bash
git add components/ThreadDrawer.tsx
git commit -m "feat: instruct Alphalpha to emit action blocks in system prompt"
```

---

## Task 5: Wire `ActionPanel` into `ThreadDrawer`

**Files:**
- Modify: `components/ThreadDrawer.tsx`

This task has three parts: (a) add `pendingAction` state, (b) strip the fence during streaming and parse at stream end, (c) render `<ActionPanel>` in the message list.

- [ ] **Step 5.1: Add imports and `pendingAction` state**

At the top of `ThreadDrawer.tsx`, add the import:

```typescript
import { parseActionBlock, stripPartialActionFence, type ActionProposal } from "@/lib/actions";
import ActionPanel from "./ActionPanel";
```

Inside the `ThreadDrawer` component, alongside the existing `useState` declarations, add:

```typescript
const [pendingAction, setPendingAction] = useState<ActionProposal | null>(null);
```

- [ ] **Step 5.2: Clear `pendingAction` when the item changes or a new thread starts**

Inside the `useEffect` that fires on `thread?.id` change (the one that calls `startFresh`), add `setPendingAction(null)` right after the early returns:

```typescript
useEffect(() => {
  if (!thread) return;
  if (thread.id === prevItemId.current) return;
  prevItemId.current = thread.id;
  setPendingAction(null);   // ← add this line
  setView("chat");
  // ... rest unchanged
}, [thread?.id, startFresh]);
```

Also add `setPendingAction(null)` at the top of `handleNewThread` so a stale card doesn't linger when the user starts a fresh thread on the same item:

```typescript
const handleNewThread = async () => {
  if (!thread || loading) return;
  setPendingAction(null);   // ← add this line
  await startFresh(thread);
  // ... rest unchanged
};
```

- [ ] **Step 5.3: Strip the partial fence during live streaming**

Inside the `send()` function, find the line that updates messages during streaming:

```typescript
// BEFORE:
setMessages([...history, { role: "assistant", content: accumulated }]);
```

```typescript
// AFTER:
setMessages([...history, { role: "assistant", content: stripPartialActionFence(accumulated) }]);
```

- [ ] **Step 5.4: Parse the action block after the stream ends**

Inside `send()`, find the block that runs after the stream completes:

```typescript
// BEFORE:
if (!accumulated) throw new Error("Empty response");

// Persist the completed exchange to KV.
const finalMessages = [...history, { role: "assistant", content: accumulated }];
setMessages(finalMessages);
```

```typescript
// AFTER:
if (!accumulated) throw new Error("Empty response");

// Parse and strip any action proposal from the completed response.
const { cleaned, proposal } = parseActionBlock(accumulated);
setPendingAction(proposal);

// Persist the completed exchange to KV (store cleaned text, not the raw fence).
const finalMessages = [...history, { role: "assistant", content: cleaned }];
setMessages(finalMessages);
```

- [ ] **Step 5.5: Also clear `pendingAction` when a new user message is sent**

At the very top of the `send()` function, add:

```typescript
const send = async () => {
  if (!thread || !threadId || !input.trim() || loading) return;
  setPendingAction(null);   // ← add this line — clears any stale card
  const userMsg: Message = { role: "user", content: input.trim() };
  // ... rest unchanged
```

- [ ] **Step 5.6: Render `<ActionPanel>` in the chat view**

Find the JSX for the chat message list in the return statement. It looks like:

```tsx
<div className="threadMessages" ref={scrollRef}>
  {messages.map((msg, i) => (
    <div key={i} className={`threadMsgRow threadMsgRow--${msg.role}`}>
      ...
    </div>
  ))}
</div>
```

Add `<ActionPanel>` after the message map, inside the same scrollable div:

```tsx
<div className="threadMessages" ref={scrollRef}>
  {messages.map((msg, i) => (
    <div key={i} className={`threadMsgRow threadMsgRow--${msg.role}`}>
      {msg.role === "assistant" && <div className="threadAvatarSm">α</div>}
      <div className={`threadBubble${msg.content === "· · ·" ? " threadLoading" : ""}`}>
        {renderMessageContent(msg.content)}
      </div>
    </div>
  ))}
  {pendingAction && (
    <ActionPanel
      proposal={pendingAction}
      itemId={thread.id}
      onDismiss={() => setPendingAction(null)}
    />
  )}
</div>
```

- [ ] **Step 5.7: Verify TypeScript compiles**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 5.8: Commit**

```bash
git add components/ThreadDrawer.tsx
git commit -m "feat: wire ActionPanel into ThreadDrawer — parse action blocks, render cards, clear on new message"
```

---

## Task 6: Smoke test end-to-end

- [ ] **Step 6.1: Start the dev server**

```bash
npm run dev
```

Open the dashboard in the browser.

- [ ] **Step 6.2: Test the structured variant**

Open any investing item (e.g. a ticker). In the thread, type something like:

> "Reset conviction to High — Q2 earnings confirmed the thesis."

If Alphalpha proposes an action, you should see:
- An action card appear below its message (NOT inside the bubble)
- The card shows a `actionPanel-head` label, field rows (Item / Field / Change), and Confirm + Dismiss buttons
- The thread input remains enabled while the card is visible

Click **Confirm**:
- Buttons disable, border pulses (loading)
- On success: green receipt with check bounce + shimmer
- Receipt shows e.g. "Conviction updated to High" + item name + time

- [ ] **Step 6.3: Test the narrative variant**

Open a project item. Ask Alphalpha to do multiple things at once, e.g.:

> "Flag this as an open loop and add a reminder for next week."

Confirm: receipt shows "2 actions queued" with tag list.

- [ ] **Step 6.4: Test dismiss**

Trigger a proposal, then click **Dismiss** — the card should fade/collapse out. The input stays enabled throughout. Sending another message should not re-show the dismissed card.

- [ ] **Step 6.5: Test error state**

Temporarily break `/api/signal` to return an error (e.g. add `return NextResponse.json({ error: "test" }, { status: 500 })` at the top of the POST handler). Confirm a proposal — should see amber border, "Something went wrong — try again", and buttons re-enable. Revert the change.

- [ ] **Step 6.6: Run tests one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6.7: Final commit**

```bash
git add -A
git commit -m "feat: thread action cards and receipts — complete"
```

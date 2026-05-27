# Signal Failed — Error Awareness & Inline Discussion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Signal failed" pill in the masthead informative (hover tooltip with human-readable error) and actionable (click to open ThreadDrawer pre-seeded with failure context so alphalpha can diagnose and help resolve it).

**Architecture:** A pure `categorizeSignalError()` helper in `lib/` maps raw error strings to a structured `ErrorDetail` shape. `Dashboard.tsx` attaches `errorDetail` to the `SignalReceipt` on failure and renders a clickable pill that opens the `ThreadDrawer` with a new `"signalFailure"` thread type. `ThreadDrawer.tsx` handles the new type with a tailored opener message and a small error context banner. CSS tooltip is pure CSS via `data-tooltip` + `::after`.

**Tech Stack:** TypeScript, React, Next.js, Vitest (tests), CSS custom properties (no new libraries)

---

## File Map

| File | Change |
|---|---|
| `lib/signal-error.ts` | **Create** — pure `categorizeSignalError()` helper + `ErrorDetail` type |
| `lib/signal-error.test.ts` | **Create** — Vitest unit tests for the helper |
| `components/Dashboard.tsx` | **Modify** — extend `SignalReceipt` + `ThreadContext` types; import helper; update `dispatchSignal` catch; update pill render |
| `components/ThreadDrawer.tsx` | **Modify** — add `"signalFailure"` opener; add error context banner |
| `app/globals.css` | **Modify** — add `.signalReceipt--clickable` + CSS tooltip + `.threadErrorBanner` styles |

---

## Task 1: Create `lib/signal-error.ts` with tests (TDD)

**Files:**
- Create: `lib/signal-error.ts`
- Create: `lib/signal-error.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/signal-error.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { categorizeSignalError } from "./signal-error";

describe("categorizeSignalError", () => {
  it("categorizes 401 as auth", () => {
    const r = categorizeSignalError("Signal failed (401)", "done", "item-1");
    expect(r.category).toBe("auth");
    expect(r.humanLabel).toBe("auth error");
    expect(r.rawMessage).toBe("Signal failed (401)");
    expect(r.signalType).toBe("done");
    expect(r.itemId).toBe("item-1");
  });

  it("categorizes 403 as auth", () => {
    const r = categorizeSignalError("Signal failed (403)");
    expect(r.category).toBe("auth");
    expect(r.humanLabel).toBe("auth error");
  });

  it("categorizes 502 as connection", () => {
    const r = categorizeSignalError("Signal failed (502)");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 503 as connection", () => {
    const r = categorizeSignalError("Signal failed (503)");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 'unreachable' keyword as connection", () => {
    const r = categorizeSignalError("OpenClaw unreachable");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes 'unavailable' keyword as connection", () => {
    const r = categorizeSignalError("Signal unavailable");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("server unreachable");
  });

  it("categorizes timeout as connection", () => {
    const r = categorizeSignalError("Request timed out");
    expect(r.category).toBe("connection");
    expect(r.humanLabel).toBe("request timed out");
  });

  it("categorizes 500 as server error", () => {
    const r = categorizeSignalError("Signal failed (500)");
    expect(r.category).toBe("server");
    expect(r.humanLabel).toBe("server error");
  });

  it("categorizes unknown errors", () => {
    const r = categorizeSignalError("Something weird happened");
    expect(r.category).toBe("unknown");
    expect(r.humanLabel).toBe("unexpected error");
  });

  it("preserves signalType and itemId when provided", () => {
    const r = categorizeSignalError("Signal failed (502)", "refresh-dashboard", "dashboard");
    expect(r.signalType).toBe("refresh-dashboard");
    expect(r.itemId).toBe("dashboard");
  });

  it("leaves signalType and itemId undefined when not provided", () => {
    const r = categorizeSignalError("Signal failed (502)");
    expect(r.signalType).toBeUndefined();
    expect(r.itemId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/alex/Documents/software-projects/openclaw/alphalpha-dashboard
npx vitest run lib/signal-error.test.ts
```

Expected: **FAIL** — `Cannot find module './signal-error'`

- [ ] **Step 3: Implement `lib/signal-error.ts`**

```ts
// lib/signal-error.ts

export type ErrorDetail = {
  category: "auth" | "connection" | "server" | "unknown";
  humanLabel: string;
  rawMessage: string;
  signalType?: string;
  itemId?: string;
};

export function categorizeSignalError(
  rawMessage: string,
  signalType?: string,
  itemId?: string,
): ErrorDetail {
  const m = rawMessage.toLowerCase();
  let category: ErrorDetail["category"] = "unknown";
  let humanLabel = "unexpected error";

  if (m.includes("401") || m.includes("403") || m.includes("auth")) {
    category = "auth";
    humanLabel = "auth error";
  } else if (m.includes("timeout") || m.includes("timed out")) {
    category = "connection";
    humanLabel = "request timed out";
  } else if (
    m.includes("502") || m.includes("503") ||
    m.includes("unreachable") || m.includes("unavailable")
  ) {
    category = "connection";
    humanLabel = "server unreachable";
  } else if (/\(5\d\d\)/.test(m) || m.includes("500")) {
    category = "server";
    humanLabel = "server error";
  }

  return { category, humanLabel, rawMessage, signalType, itemId };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/signal-error.test.ts
```

Expected: **PASS** — 11 tests, all green

- [ ] **Step 5: Commit**

```bash
git add lib/signal-error.ts lib/signal-error.test.ts
git commit -m "feat: add categorizeSignalError helper with tests"
```

---

## Task 2: Extend types in `Dashboard.tsx`

**Files:**
- Modify: `components/Dashboard.tsx:28-46`

- [ ] **Step 1: Add import for `categorizeSignalError` and `ErrorDetail` at the top of `Dashboard.tsx`**

After the existing imports (after line 16 `import StatusBar from "./StatusBar";`), add:

```ts
import { categorizeSignalError, type ErrorDetail } from "@/lib/signal-error";
```

- [ ] **Step 2: Update `SignalReceipt` to include `errorDetail`**

Replace the existing `SignalReceipt` type (lines 28–32):

```ts
// Before:
type SignalReceipt = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};
```

With:

```ts
// After:
type SignalReceipt = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
  errorDetail?: ErrorDetail;
};
```

- [ ] **Step 3: Add `"signalFailure"` to `ThreadContext.type`**

Replace the existing `ThreadContext` type union (line 36):

```ts
// Before:
type: "decision" | "loop" | "project" | "ticker" | "digest" | "systemDoc" | "queueItem";
```

With:

```ts
// After:
type: "decision" | "loop" | "project" | "ticker" | "digest" | "systemDoc" | "queueItem" | "signalFailure";
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors — the new import, optional `errorDetail` field, and expanded union are all backward-compatible

- [ ] **Step 5: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: extend SignalReceipt and ThreadContext types for signal failure"
```

---

## Task 3: Wire up `dispatchSignal` + clickable pill in `Dashboard.tsx`

**Files:**
- Modify: `components/Dashboard.tsx:107-109` (catch block)
- Modify: `components/Dashboard.tsx:266` (receipt render)

- [ ] **Step 1: Update `dispatchSignal` catch block**

Find this block (around line 107–109):

```ts
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signal failed";
      setReceipt({ id: key, tone: "error", message });
      throw error;
    }
```

Replace with:

```ts
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Signal failed";
      const errorDetail = categorizeSignalError(rawMessage, type, itemId);
      setReceipt({ id: key, tone: "error", message: "Signal failed", errorDetail });
      throw error;
    }
```

- [ ] **Step 2: Update the receipt pill render**

Find this line (around line 266):

```tsx
          {receipt && <div className={`signalReceipt signalReceipt--${receipt.tone}`} role="status" aria-live="polite">{receipt.message}</div>}
```

Replace with:

```tsx
          {receipt && (
            receipt.errorDetail ? (
              <button
                type="button"
                className="signalReceipt signalReceipt--error signalReceipt--clickable"
                aria-label={`Signal failed — ${receipt.errorDetail.humanLabel}. Click to discuss with alphalpha.`}
                data-tooltip={`${receipt.errorDetail.humanLabel}\n${receipt.errorDetail.rawMessage}\n\nClick to discuss →`}
                onClick={() => {
                  const d = receipt.errorDetail!;
                  openThread({
                    id: `signal-failure-${receipt.id}`,
                    type: "signalFailure",
                    title: `Signal failed · ${d.humanLabel}`,
                    summary: d.rawMessage,
                    category: d.signalType,
                  });
                }}
              >
                Signal failed ↗
              </button>
            ) : (
              <div className={`signalReceipt signalReceipt--${receipt.tone}`} role="status" aria-live="polite">{receipt.message}</div>
            )
          )}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: wire dispatchSignal error detail and clickable pill"
```

---

## Task 4: Add CSS styles in `globals.css`

**Files:**
- Modify: `app/globals.css` (after line 949, after `.signalReceipt--info` rule)

- [ ] **Step 1: Add `.signalReceipt--clickable` and tooltip styles**

After the `.signalReceipt--info` rule (around line 949), insert:

```css
.signalReceipt--clickable {
  cursor: pointer;
  position: relative;
  overflow: visible;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-color: rgba(168,64,48,.45);
  background: rgba(168,64,48,.12);
  user-select: none;
  font-family: 'DM Sans', sans-serif;
  /* reset button defaults */
  appearance: none; -webkit-appearance: none;
  text-align: left;
}
.signalReceipt--clickable:hover { background: rgba(168,64,48,.18); border-color: rgba(168,64,48,.60); }
.signalReceipt--clickable::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 9px);
  right: 0;
  background: var(--dark-fill);
  color: var(--dark-fill-text);
  font-size: 11px;
  line-height: 1.5;
  padding: 8px 11px;
  border-radius: 7px;
  white-space: pre-wrap;
  width: max-content;
  max-width: 300px;
  box-shadow: 0 4px 14px rgba(0,0,0,.22);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 100;
}
.signalReceipt--clickable:hover::after { opacity: 1; }
.signalReceipt--clickable::before {
  content: '';
  position: absolute;
  top: calc(100% + 4px);
  right: 18px;
  border: 5px solid transparent;
  border-bottom-color: var(--dark-fill);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 101;
}
.signalReceipt--clickable:hover::before { opacity: 1; }
```

- [ ] **Step 2: Add `.threadErrorBanner` styles**

In the same edit pass, find the `.threadDrawer` block (search for `threadDrawer` in globals.css) and append after the last thread-related rule:

```css
.threadErrorBanner {
  margin: 8px 12px 0;
  padding: 9px 11px;
  background: rgba(168,64,48,.07);
  border: 1px solid rgba(168,64,48,.22);
  border-radius: 7px;
  flex-shrink: 0;
}
.threadErrorBannerLabel {
  display: block;
  font-family: 'DM Sans', sans-serif;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent-high);
  margin-bottom: 4px;
}
.threadErrorBannerMsg {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  color: var(--ink-2);
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add clickable signal receipt and thread error banner CSS"
```

---

## Task 5: Update `ThreadDrawer.tsx` — opener + error banner

**Files:**
- Modify: `components/ThreadDrawer.tsx:87-101` (`openerFor` function)
- Modify: `components/ThreadDrawer.tsx:316-345` (header render area)

- [ ] **Step 1: Add `"signalFailure"` case to `openerFor()`**

Find the `openerFor` function (around line 87). Add a new case before the `default`:

```ts
// Before (the default case, around line 99):
    default:         return `Want to think through "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" together?`;
```

Add above it:

```ts
    case "signalFailure": return `It looks like a signal just failed — ${ctx.summary ? `"${ctx.summary}"` : "I can see the error details above"}. Let me help you figure out what went wrong and how to fix it.`;
```

The full `openerFor` switch after the change (for reference — only the `signalFailure` case is new):

```ts
function openerFor(ctx: ThreadContext): string {
  const t = ctx.title;
  switch (ctx.type) {
    case "decision":      return `On "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — what's your thinking? I can help you decide or draft the next step.`;
    case "loop":          return `This loop has been open for a while. Want to close it, snooze it, or think through what's blocking it?`;
    case "project":       return ctx.ocOwned
      ? `I'm actively managing this one. What aspect of "${t}" do you want to think through?`
      : `This is a manually-tracked project. What aspect of "${t}" do you want to think through?`;
    case "ticker":        return `${t} — ${ctx.theme ?? ""}. Want to think through the thesis, timing, or what would change your mind?`;
    case "digest":        return `"${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — want to dig into this, connect it to other threads, or decide what to do with it?`;
    case "systemDoc":     return `This is one of Alphalpha's source documents. Want to inspect the policy, revise it, or turn part of it into an action?`;
    case "queueItem":     return `Want to read/watch this soon, save it for later, or use it as a recommendation seed?`;
    case "signalFailure": return `It looks like a signal just failed — ${ctx.summary ? `"${ctx.summary}"` : "I can see the error details above"}. Let me help you figure out what went wrong and how to fix it.`;
    default:              return `Want to think through "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" together?`;
  }
}
```

- [ ] **Step 2: Add the error context banner to the drawer render**

In the `ThreadDrawer` return JSX, find the `threadHeader` block (around line 316). The structure is:

```tsx
<aside className={...}>
  {thread && (
    <>
      <div className="threadHeader">
        ...
      </div>

      {view === "history" ? ( ... ) : ( ... )}

      <div className="threadFooter"> ... </div>
    </>
  )}
</aside>
```

After the closing `</div>` of `threadHeader` and before the `{view === "history" ? ...}` ternary, insert:

```tsx
          {thread.type === "signalFailure" && thread.summary && (
            <div className="threadErrorBanner">
              <span className="threadErrorBannerLabel">Error context</span>
              <p className="threadErrorBannerMsg">{thread.summary}</p>
            </div>
          )}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors — `"signalFailure"` is now a valid `ThreadContext.type`

- [ ] **Step 4: Run all lib tests to confirm nothing regressed**

```bash
npx vitest run
```

Expected: all tests pass including the new `signal-error` tests

- [ ] **Step 5: Commit**

```bash
git add components/ThreadDrawer.tsx
git commit -m "feat: add signalFailure thread opener and error context banner"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Confirm it starts on http://localhost:3000 with no errors in the terminal.

- [ ] **Step 2: Trigger a signal failure**

Open the app in a browser. Temporarily break the signal endpoint by editing `app/api/signal/route.ts` to always return a 502:

```ts
// Temporary test — add at the top of the POST handler, before any logic:
return NextResponse.json({ error: "Signal failed" }, { status: 502 });
```

Click any action on the Today tab (e.g., mark an item done). The masthead should show a red pill labelled **"Signal failed ↗"**.

- [ ] **Step 3: Verify hover tooltip**

Hover over the pill. A dark tooltip should appear below it showing:
- Line 1: `server unreachable` (the human label for 502)
- Line 2: `Signal failed (502)` (the raw message)
- Line 3: `Click to discuss →`

- [ ] **Step 4: Verify drawer opens with correct context**

Click the pill. The ThreadDrawer should open with:
- Header showing type `signalFailure` and title `Signal failed · server unreachable`
- A red-tinted **Error context** banner showing the raw error message
- An opening assistant message starting with "It looks like a signal just failed…"

- [ ] **Step 5: Revert the temporary 502**

Remove the temporary `return` you added to `route.ts`. Confirm the server still starts cleanly.

- [ ] **Step 6: Final commit**

```bash
git add -p   # review any lingering changes
git commit -m "feat: signal failed error awareness and inline discussion

Clickable error pill with hover tooltip (humanLabel + rawMessage).
Click opens ThreadDrawer pre-seeded with failure context for
alphalpha to diagnose and help resolve signal failures inline."
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Extend `SignalReceipt` with `errorDetail` | Task 2 |
| `categorizeSignalError()` with all 5 categories | Task 1 |
| `dispatchSignal` catch populates `errorDetail` | Task 3 |
| Pill stays "Signal failed" label, adds ↗ icon | Task 3 |
| Hover tooltip: humanLabel + rawMessage + CTA | Task 4 |
| Click opens `ThreadDrawer` via `openThread()` | Task 3 |
| `ThreadContext` seeded with title/summary/category | Task 3 |
| `"signalFailure"` type added to union | Task 2 |
| Tailored opener in `ThreadDrawer` for `signalFailure` | Task 5 |
| Error context banner shown in drawer | Task 5 |
| No changes to `app/api/signal/route.ts` or `lib/data.ts` | ✓ (not touched) |

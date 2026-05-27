# Signal Failed — Error Awareness & Inline Discussion

**Date:** 2026-05-26  
**Status:** Approved  
**Scope:** `components/Dashboard.tsx`, `app/globals.css`

---

## Problem

The "Signal failed" pill in the masthead gives no information about what went wrong or how to resolve it. Users cannot tell whether the failure was a transient network blip, an auth issue, or a server-side problem — and have no path to discuss it with alphalpha.

---

## Approach

**Error-aware threading (Approach B):** Parse the signal error into a human-readable category, surface it as a CSS tooltip on hover, and make the pill clickable to open the ThreadDrawer pre-seeded with the failure context.

---

## Design

### 1. Data layer — extend `SignalReceipt`

Add an optional `errorDetail` field to the existing `SignalReceipt` type in `Dashboard.tsx`:

```ts
type SignalReceipt = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
  errorDetail?: {
    category: "auth" | "connection" | "server" | "unknown";
    humanLabel: string;   // e.g. "server unreachable", "auth error"
    rawMessage: string;   // original error string
    signalType?: string;  // e.g. "refresh-dashboard", "done"
    itemId?: string;
  };
};
```

Add a `categorizeSignalError()` helper (< 15 lines) that maps HTTP codes and keywords to a category + human label:

| Condition | category | humanLabel |
|---|---|---|
| 401, 403, "auth" in message | `"auth"` | `"auth error"` |
| 502, 503, "unreachable", "unavailable" | `"connection"` | `"server unreachable"` |
| 500–599 (other) | `"server"` | `"server error"` |
| timeout / "timed out" | `"connection"` | `"request timed out"` |
| anything else | `"unknown"` | `"unexpected error"` |

Update `dispatchSignal`'s catch block to call `categorizeSignalError()` and attach `errorDetail` to the receipt:

```ts
} catch (error) {
  const rawMessage = error instanceof Error ? error.message : "Signal failed";
  const errorDetail = categorizeSignalError(rawMessage, type, itemId);
  setReceipt({ id: key, tone: "error", message: "Signal failed", errorDetail });
  throw error;
}
```

### 2. UI layer — pill tooltip + click handler

When `receipt.errorDetail` is present, render a clickable pill variant instead of the plain `<div>`:

- **Label:** `"Signal failed"` (unchanged) + a subtle `↗` icon
- **Cursor:** `pointer`
- **Hover tooltip:** dark popover styled with CSS `::after` using a `data-tooltip` attribute. First line: `humanLabel`. Second line: `rawMessage`. Third line: `"Click to discuss →"`. No JS library — pure CSS.
- **Click:** calls `openThread(ctx)` (see §3)
- **Keyboard:** `onKeyDown` handles `Enter` for accessibility
- **`role="button"`** and descriptive `aria-label`

The pill is visually identical to the current error state when not hovered — no layout shift, no new persistent chrome.

#### New CSS classes in `globals.css`

```css
.signalReceipt--clickable {
  cursor: pointer;
  /* slightly stronger border/bg to hint interactivity */
}
.signalReceipt--clickable:hover { ... }

/* Tooltip via data-tooltip attribute */
.signalReceipt--clickable[data-tooltip]::after {
  /* dark popover, absolute positioned below pill */
}
.signalReceipt--clickable[data-tooltip]::before {
  /* arrow caret */
}
```

### 3. ThreadDrawer seeding

`openThread()` is called with:

```ts
{
  id: `signal-failure-${receipt.id}`,
  type: "systemDoc",                      // reuses existing type; no backend changes
  title: `Signal failed · ${errorDetail.humanLabel}`,
  summary: errorDetail.rawMessage,
  category: errorDetail.signalType,       // e.g. "refresh-dashboard"
}
```

The ThreadDrawer already renders context metadata at the top of the drawer. **At implementation time, verify** that `ThreadDrawer.tsx` renders `context.title` and `context.summary` visibly (not just passed as a seed prompt). If it doesn't currently show a context card, add a small error-context card (tinted red, showing title + summary) when `context.type === "systemDoc"` and `context.title` starts with `"Signal failed"` — or, preferably, when a new `context.isError === true` flag is present. This is a minor addition to `ThreadDrawer.tsx` only if needed.

**Future consideration:** If OpenClaw adds explicit routing by thread type, a dedicated `"signalFailure"` type would give better diagnosis prompts. This is a backend concern and out of scope here.

---

## Files Changed

| File | Change |
|---|---|
| `components/Dashboard.tsx` | Extend `SignalReceipt` type; add `categorizeSignalError()`; update `dispatchSignal` catch block; update receipt pill render |
| `app/globals.css` | Add `.signalReceipt--clickable` hover state + CSS tooltip styles |
| `components/ThreadDrawer.tsx` | Possibly: add error context card if context metadata isn't already rendered visibly (verify at implementation time) |

No changes to `app/api/signal/route.ts` or any data types in `lib/data.ts`.

---

## Out of Scope

- Error history / dropdown of recent failures (Approach C — overkill for current usage)
- Dedicated `"signalFailure"` ThreadContext type (backend concern)
- Changes to how OpenClaw processes the thread on the backend

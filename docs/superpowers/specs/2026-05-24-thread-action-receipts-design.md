# Thread Action Cards & Receipts — Design Spec
_2026-05-24_

## Overview

When a thread conversation leads to a concrete next step, Alphalpha surfaces an inline **action card** in the drawer. The user confirms (or dismisses) it; on confirmation the card waits for the backend signal to resolve, then animates into a **receipt** showing what happened. The thread input stays enabled throughout so the user can keep talking or push back on a bad proposal.

---

## Trigger Mechanism

No OpenClaw backend changes required. Alphalpha embeds a structured JSON block at the end of its response, fenced with a marker the client detects and strips before display:

```
I'll update your conviction to High and log the rationale.

```action
{
  "variant": "structured",
  "label": "Proposed change",
  "signal": "investment-action",
  "payload": { "action": "update-conviction", "thesisId": "nvda", "value": "high" },
  "preview": { "item": "NVDA thesis", "field": "Conviction", "from": "Medium", "to": "High" }
}
```
```

For the narrative variant, replace `preview` with:
```json
{
  "summary": "Draft research note, flag deck loop, queue review reminder",
  "tags": ["Research note", "Loop", "Reminder"]
}
```

The system prompt in `buildSystemPrompt()` instructs Alphalpha when to emit these blocks and which variant to use. Plain text responses (no action warranted) remain unchanged.

---

## Two Action Card Variants

Both share the same panel shell, animations, and receipt state. Alphalpha picks the variant based on what it's doing.

### Variant 1 — Structured (field change)
Used when there is a clear before → after mapping: status, conviction level, priority, snooze date, etc.

Renders a compact table:
```
Item    NVDA thesis
Field   Conviction
Change  Medium → High
```

Receipt copy: `"Conviction updated to High"` + `"NVDA thesis · logged 2:34 PM"`

### Variant 2 — Narrative (open-ended)
Used when the action is multi-step, complex, or doesn't map to a single field.

Renders a quoted plain-language summary plus type tags:
```
"Draft research note, flag the deck loop, and queue a review reminder for next Friday."
[Research note] [Loop] [Reminder]
```

Receipt copy: `"3 actions queued"` + `"Research note · loop flagged · reminder set · 2:34 PM"`

---

## Component Design

### `ActionPanel` (new component)
- Positioned in the message list, `margin-left: 29px` (aligned with assistant bubbles)
- Props: `variant`, `label`, `preview | summary+tags`, `onConfirm`, `onDismiss`
- Two render paths keyed on `variant`
- Confirm/dismiss buttons in a `panel-foot`
- Internal state: `"idle" | "loading" | "done" | "error"`

### `ThreadDrawer` changes
- After the stream ends, run a regex to peel off the fenced `action` block from the accumulated response text
- If found: store parsed proposal in state, render `<ActionPanel>` after the final message bubble
- At most one action card visible at a time (a new response replaces any pending card)
- Thread input **remains enabled** throughout — the user can keep talking or push back before confirming

---

## Confirm Flow

```
User clicks "Confirm"
  → buttons disable, panel shows loading state (pulsing border or spinner)
  → POST /api/signal { type, itemId, payload }
      ↓ success
        → panel animates to receipt state (green bg, shimmer, check bounce)
        → receipt copy reflects what actually happened
      ↓ failure
        → panel border goes red/amber
        → copy: "Something went wrong — try again"
        → buttons re-enable so the user can retry
```

The receipt animation is **earned** — it only plays after confirmed API success, never speculatively on click.

## Dismiss Flow

- Panel fades out smoothly; no signal sent
- No message added to the thread; conversation continues normally

---

## Animations

All animations share a consistent feel — subtle, physical, not showy.

| Moment | Animation |
|---|---|
| Loading | Pulsing panel border (opacity 0.4 → 1 → 0.4, 1s loop) |
| Receipt entry | Panel scales 0.96 → 1.015 → 1 over 450ms (`cubic-bezier(0.16,1,0.3,1)`) |
| Shimmer | Single left-to-right light sweep, 650ms |
| Check mark | Scale 0 → 1 with slight overshoot (`cubic-bezier(0.34,1.56,0.64,1)`), 400ms, 150ms delay |
| Dismiss | Fade + collapse (`opacity` + `max-height`) over 300ms |

---

## System Prompt Changes

`buildSystemPrompt()` in `ThreadDrawer.tsx` gains a new section instructing Alphalpha:

- **When to propose**: only when a concrete, reversible action is clearly warranted by the conversation — not speculatively
- **Which variant**: structured when there's a single field change; narrative for multi-step or ambiguous actions
- **Tone of confirm label**: match the action ("Apply change", "Do all of this", "Mark as done")
- **No double-proposing**: if the user pushes back on a proposal, revise in text first, don't immediately re-propose

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Signal API returns error | Red/amber panel border, "Something went wrong — try again", buttons re-enable |
| Network timeout | Same as above |
| Malformed action block in AI response | Silently discard — render text only, no card |
| User dismisses then wants to confirm | Must re-ask Alphalpha; dismissed proposals don't resurface |

---

## Files Changed

| File | Change |
|---|---|
| `components/ActionPanel.tsx` | New component — both variants, all states |
| `components/ThreadDrawer.tsx` | Parse action block from stream, render `<ActionPanel>`, pass `onConfirm`/`onDismiss` |
| `app/globals.css` | New classes: `.actionPanel`, `.actionPanel--loading`, `.actionPanel--done`, `.actionPanel--error`, `.receiptShimmer`, `.checkBounce`, and narrative/structured sub-classes |
| `lib/actions.ts` | New file — `ActionProposal` type + `parseActionBlock()` parsing utility |
| No new API routes | Reuses existing `/api/signal` |

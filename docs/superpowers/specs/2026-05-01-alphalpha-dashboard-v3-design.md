# Alphalpha Dashboard v3 — Design Spec

**Date:** 2026-05-01  
**Branch:** claude/hardcore-ishizaka-3fbf39

---

## For the implementing agent: design fidelity instructions

The full design handoff package is committed at `docs/design_handoff/`. Before implementing any component or style, cross-reference these files:

| File | When to consult |
|---|---|
| `docs/design_handoff/Alphalpha Dashboard v3.html` | **Primary reference.** Serve it locally (`python3 -m http.server 8765` from `docs/design_handoff/`) and open in a browser to interact with every tab, the thread drawer, snooze picker, hover states, and animations before writing any code for that component. |
| `docs/design_handoff/README.md` | Design tokens (exact hex values, px sizes, font weights), spacing rules, responsive breakpoints, interaction table, and thread system prompt spec. Treat as authoritative for any pixel-level decision. |
| `docs/design_handoff/data.js` | Canonical data shape and sample values. Use as a secondary check against `lib/data.ts` types defined in this spec. |
| `docs/design_handoff/Design Directions.html` | Background only — shows the three early explorations (Paper / Terminal / Focus) that were synthesized into v3. Useful if the rationale behind a design choice is unclear. |

**Note:** `Alphalpha Dashboard v3.html` depends on `data.js` (loaded as a sibling script) and a `tweaks-panel.jsx` stub. Create the stub before serving:
```bash
cat > docs/design_handoff/tweaks-panel.jsx << 'EOF'
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  const setTweak = (key, val) => setValues(prev => ({ ...prev, [key]: val }));
  return [values, setTweak];
}
function TweaksPanel({ children }) { return null; }
function TweakSection({ children }) { return null; }
function TweakRadio({ children }) { return null; }
EOF
```

**Fidelity standard:** The README calls this "high-fidelity." Match exact hex colors, font sizes, border radii, spacing values, and animation timings from the README's design token tables. When in doubt, inspect the prototype's rendered CSS in DevTools rather than estimating.

---

---

## Overview

Redesign the Alphalpha dashboard from a static dark-mode scrolling page into a calm, editorial, focus-first interface. The new design uses a warm parchment palette (Playfair Display + Lora + DM Sans typography), tab navigation across five views, a one-item-at-a-time focus mode on Today, and a universal α thread drawer that opens contextual Alphalpha conversations seeded with item-specific context.

State mutations (Done, Snooze, Skip, Quick Add) are optimistic on the client and signal back to OpenClaw for durable persistence. The thread drawer is fully built but returns stub responses until OpenClaw wires up its streaming endpoint.

---

## Architecture & Data Flow

```
Context markdown files (PROJECTS.md, OPEN_LOOPS.md, etc.)
        ↓
scripts/generate-dashboard-data.mjs   [updated schema + ocOwned]
        ↓
lib/generated-data.json
        ↓
app/page.tsx                          [Server Component]
  — imports data, renders shell HTML, loads Google Fonts
  — passes DashboardData as props to ↓
        ↓
components/Dashboard.tsx              ["use client" — root interactive component]
  — owns all UI state
  — renders Masthead, active tab, ThreadDrawer, StatusBar
        ↓
    ┌──────────────────────────────────────────┐
    │  Tab components (data passed as props)    │
    │   <TodayTab>                             │
    │     <FocusCard>   Done / Snooze / Skip   │
    │     <ContextColumn>                      │
    │       <QuickAdd>                         │
    │       <LoopList> (collapsible)           │
    │   <LoopsTab>                             │
    │   <ProjectGrid>                          │
    │   <InvestingTab>                         │
    │   <DigestsTab>                           │
    └──────────────────────────────────────────┘
        ↓  openThread(ctx)
components/ThreadDrawer.tsx           [always mounted, slides in/out]
        ↓
app/api/thread/route.ts               [STUB — placeholder response]
app/api/signal/route.ts               [STUB — logs, no-ops]
```

### State owned by Dashboard.tsx

| State | Type | Initial value |
|---|---|---|
| `activeTab` | `string` | `"today"` |
| `actions` | `Action[]` | `data.topActions` |
| `loops` | `Loop[]` | `data.openLoops` |
| `focusIdx` | `number` | `0` |
| `thread` | `ThreadContext \| null` | `null` |

Mutations on `actions` and `loops` are optimistic: update React state immediately, then fire `POST /api/signal` in the background (fire-and-forget). The UI never waits for the signal response.

### Font loading

In `app/layout.tsx`, add `<link>` preconnect + stylesheet tags for Google Fonts:
- `Playfair Display` — weights 400, 700 (italic variants)
- `Lora` — weights 400, 600 (italic variants)
- `DM Sans` — weights 400, 500, 600

No font package needed.

---

## Data Schema Migration

### New `lib/data.ts` types

```ts
export type Priority   = "HIGH" | "MEDIUM" | "LOW";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Status     = "ACTIVE" | "SNOOZED";

export type Action = {
  id:           string;
  priority:     Priority;
  title:        string;
  context:      string;
  next:         string;
  project:      string;
  due:          string;
  done:         boolean;
  snoozed:      boolean;
  snoozeLabel:  string | null;
};

export type Loop = {
  id:       string;
  text:     string;
  project:  string;
  priority: Priority;
  done?:    boolean;
  snoozed?: boolean;
  snoozeLabel?: string | null;
};

export type Project = {
  id:           string;
  name:         string;
  status:       Status;
  category:     string;
  lastActivity: string;
  summary:      string;
  ocOwned:      boolean;
  loops?:       Loop[];         // up to 2 inline loops for Projects tab (populated by generate script by matching loop.project === project.name)
  highPriCount?: number;        // count of HIGH priority loops for this project (computed in generate script)
};

export type Ticker = {
  ticker:     string;
  theme:      string;
  stance:     string;
  confidence: Confidence;
};

export type Digest = {
  id:       string;
  date:     string;
  category: string;
  title:    string;
  summary:  string;
  tags:     string[];
};

export type DashboardData = {
  meta: {
    generatedAt:   string;
    posture:       string;
    postureDetail: string;
  };
  stats: {
    openLoops:       number;
    activeProjects:  number;
    highPriority:    number;
    uncertainties:   number;
    investingSignals: number;
  };
  topActions: Action[];
  openLoops:  Loop[];
  projects:   Project[];
  investing:  Ticker[];
  digests:    Digest[];
};
```

### `openclaw.config.json` (repo root)

Controls which projects display the "α OpenClaw" ownership badge:

```json
{
  "managedProjects": [
    "Alphalpha",
    "OpenClaw migration and orchestration",
    "Obsidian / GitHub-backed personal knowledge system"
  ]
}
```

`generate-dashboard-data.mjs` reads this file and sets `ocOwned: true` on matching projects. OpenClaw can update this file when it assumes ownership of a new project, then push to GitHub.

### `generate-dashboard-data.mjs` changes

- Output shape changes to match `DashboardData` above
- `attentionQueue` → `topActions`; each item gets `id`, `done: false`, `snoozed: false`, `snoozeLabel: null`, `due`
- `metrics` (label/value/detail/tone) → `stats` (named integer fields)
- `investingCandidates` → `investing`
- `openLoops` items get `id` field
- `projects` items get `id`, `summary`, `ocOwned` (from `openclaw.config.json`); drop `blocker`, `source`
- `digests` items get `id`, `category` field (derived from source name)
- `meta.posture` and `meta.postureDetail` sourced from a new `POSTURE.md` context file (first non-empty line = posture, remaining lines = postureDetail). If the file is absent, fall back to hardcoded defaults matching the sample data ("Build the dashboard, then connect live sources." / "Phase 1 is intentionally file-backed…")
- All existing markdown parsing logic preserved; only output shape changes

---

## Component Designs

### `components/Dashboard.tsx`

Root `"use client"` component. Receives `DashboardData` as a prop (passed from the server page). Manages all state. Computes derived values:

```ts
const activeActions  = actions.filter(a => !a.done && !a.snoozed);
const snoozedActions = actions.filter(a => a.snoozed);
const current        = activeActions[focusIdx % Math.max(activeActions.length, 1)];
```

Renders:
1. `<Masthead>` — tab nav, always visible
2. A `<main>` wrapper with `style={{ marginRight: thread ? 360 : 0 }}` transitioning via CSS
3. Active tab component (switched by `activeTab`)
4. `<ThreadDrawer thread={thread} onClose={closeThread} />`
5. `<StatusBar>` — desktop only

Handlers:
- `handleDone(id)` — marks done in `actions`, resets `focusIdx` to 0, POSTs signal
- `handleSnooze(id, label)` — marks snoozed in `actions`, resets `focusIdx`, POSTs signal
- `handleSkip()` — increments `focusIdx`
- `handleAdd(text)` — prepends new loop to `loops`, POSTs signal
- `handleLoopDone(id)` — marks loop done in `loops`, POSTs signal
- `handleLoopSnooze(id, label)` — marks loop snoozed, POSTs signal
- `handleWake(id)` — sets `snoozed: false, snoozeLabel: null` on an action, POSTs signal `{ type: "wake", itemId: id }`
- `openThread(ctx)` — sets `thread`
- `closeThread()` — sets `thread` to null

Signal POST helper (used by all handlers):
```ts
async function postSignal(type: string, itemId: string, payload?: object) {
  // OPENCLAW: This posts to /api/signal which is currently a stub.
  // When OpenClaw wires up the real endpoint, no changes needed here —
  // only app/api/signal/route.ts needs to be updated.
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, itemId, payload }),
  }).catch(() => {}); // fire-and-forget, never throw
}
```

---

### `components/FocusCard.tsx`

Receives: `actions`, `focusIdx`, `onDone`, `onSnooze`, `onSkip`, `onDiscuss`, `snoozedActions`.

Local state: `snoozeOpen: boolean`, `exiting: boolean`.

**Exit animation:** When Done/Snooze/Skip is triggered, set `exiting: true` (adds CSS class `focusCard--exiting`: opacity 0, translateY 8px, 260ms ease), then in `setTimeout(260)` call the parent handler (which advances state). This prevents the next card rendering mid-animation.

**Progress dots:** One dot per non-snoozed action. Active dot: 22×6px pill (#1c1814). Done dots: 6×6px (#c8bc9e). Pending dots: 6×6px (#ddd4be). `transition: width 0.3s ease` on all dots.

**Priority tag:** Format `"● NEEDS A DECISION · PROJECT"` (HIGH) or `"● NEXT UP · PROJECT"` (MEDIUM/LOW). Colors from `--accent-high` / `--accent-medium`.

**Snooze picker:** Absolutely positioned dropdown, closes on outside click (document click listener in useEffect, cleaned up on unmount). Options: Later today (4 hrs) / Tomorrow (24 hrs) / In 3 days (72 hrs) / Next week (7 days) / Cancel.

**Snoozed strip:** Rendered below the focus stage when `snoozedActions.length > 0`. Each chip: `"💤 truncated title · label"` with ✕ wake button that calls `onWake(id)` (sets `snoozed: false` in Dashboard).

---

### `components/ThreadDrawer.tsx`

Always mounted. Controlled by `thread: ThreadContext | null`.

```ts
type ThreadContext = {
  id:        string;           // item id — used for localStorage thread persistence
  type:      "decision" | "loop" | "project" | "ticker" | "digest";
  title:     string;
  project?:  string;
  priority?: string;
  next?:     string;
  theme?:    string;
  stance?:   string;
  summary?:  string;
  category?: string;
  ocOwned?:  boolean;
};

type Message = { role: "assistant" | "user"; content: string };
```

Local state: `messages: Message[]`, `input: string`, `loading: boolean`.

**On `thread` change:** Reset `messages` to `[{ role: "assistant", content: openerFor(thread) }]`. Auto-focus input.

**System prompt construction** (client-side, from `thread` context):
```ts
function buildSystemPrompt(ctx: ThreadContext, today: string): string {
  // OPENCLAW: This system prompt is sent to /api/thread on every message.
  // When you wire up your AI endpoint, this is the full context you'll receive.
  // Modify the prompt template here if you want Alphalpha's personality adjusted.
  const lines = [
    `You are Alphalpha, Alex's personal AI chief of staff. Today is ${today}.`,
    `You are discussing a ${ctx.type} item.`,
    `Title: "${ctx.title}"`,
    ctx.project   && `Project: ${ctx.project}`,
    ctx.priority  && `Priority: ${ctx.priority}`,
    ctx.next      && `Suggested next step: ${ctx.next}`,
    ctx.theme     && `Investment theme: ${ctx.theme}`,
    ctx.stance    && `Stance: ${ctx.stance}`,
    ctx.summary   && `Summary: ${ctx.summary}`,
    ctx.category  && `Category: ${ctx.category}`,
    ctx.ocOwned   && `This item is actively managed by OpenClaw.`,
    `Be concise (≤3 sentences), warm, and concrete. Help Alex decide, act, or think more clearly.`,
  ];
  return lines.filter(Boolean).join("\n");
}
```

**Opener messages by type:**
```ts
function openerFor(ctx: ThreadContext): string {
  switch (ctx.type) {
    case "decision": return `On "${ctx.title.slice(0, 60)}…" — what's your thinking? I can help you decide or draft the next step.`;
    case "loop":     return `This loop has been open for a while. Want to close it, snooze it, or think through what's blocking it?`;
    case "project":  return ctx.ocOwned
      ? `I'm actively managing this one. What aspect of "${ctx.title}" do you want to think through?`
      : `This is a manually-tracked project. What aspect of "${ctx.title}" do you want to think through?`;
    case "ticker":   return `${ctx.title} — ${ctx.theme}. Want to think through the thesis, timing, or what would change your mind?`;
    case "digest":   return `"${ctx.title.slice(0, 60)}" — want to dig into this, connect it to other threads, or decide what to do with it?`;
  }
}
```

**Send flow:**
1. Append user message to `messages`, set `loading: true`, show `"· · ·"` assistant bubble
2. POST `/api/thread` with `{ systemPrompt, messages }`
3. Append assistant response, set `loading: false`

Currently non-streaming (stub returns full text at once). When OpenClaw wires streaming, the client-side send flow will need to switch to `ReadableStream` consumption — see the `// OPENCLAW:` comment in the route.

**Layout:**
- Desktop: `position: fixed; right: 0; top: 0; bottom: 0; width: 360px`. Slides via `transform: translateX(100%)` → `translateX(0)`, `transition: transform 0.28s ease`.
- Mobile (≤640px): `position: fixed; left: 0; right: 0; bottom: 0; height: 65vh; border-radius: 14px 14px 0 0`.

**Header:** α avatar circle + type label + truncated title (60 chars) + project name + "OpenClaw managed" badge if `ocOwned` + ✕ close button.

**Thread persistence note:**
```ts
// OPENCLAW: Thread conversations currently reset on every item change.
// To persist threads across navigation, key messages to localStorage by item id:
//   localStorage.setItem(`thread-${ctx.id}`, JSON.stringify(messages))
// This is intentionally deferred — implement once the real AI endpoint is wired.
```

---

### `components/ContextColumn.tsx`

Right panel on Today tab. Receives `data` (posture, loops, investing, digests slice) and `onDiscuss`. Sections: posture block, QuickAdd, then three collapsible sections (Open Loops, Investing, Digests). Each section tracks its own `open` state (loops open by default, others closed).

Collapsible toggle: `▾` character, `transform: rotate(-90deg)` when closed, `transition: transform 0.2s`.

---

### `components/QuickAdd.tsx`

Two render states:
- **Collapsed:** `"+ Capture a loop"` outlined button
- **Expanded:** inline input (Lora 13px) + Save button. Enter to save, Esc to cancel.

On save: calls `onAdd(text)`, collapses, clears input.

---

### `components/StatusBar.tsx`

Desktop only (`display: none` at ≤640px). Receives `stats`, `generatedAt`, `drawerOpen`. Animates `margin-right: 360px` in sync with drawer.

Displays: `N open loops · N projects · N high priority` — high priority count turns `--accent-high` (#a84030) when > 0. Right side: italic Lora "Generated [timestamp]".

---

### Tab components

All thin — no local state except hover tracking for inline actions.

**`components/TodayTab.tsx`** — two-column layout (focus stage 55% + context column 300px fixed). At ≤640px stacks vertically.

**`components/LoopsTab.tsx`** — single column, max-width 720px. Each loop row: priority dot + Lora text + project label. Hover reveals ✓ / 💤 / α Discuss inline. Done state: strikethrough + opacity 0.35. Snoozed state: dimmed italic + wake button.

**`components/ProjectGrid.tsx`** — `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, gap 14px. Legend at top. Each card shows category label, "α OpenClaw" badge (if `ocOwned`), status badge, name (Playfair Display 17px), summary (Lora italic), last activity + high-priority loop count, up to 2 inline loops, α Discuss button.

**`components/InvestingTab.tsx`** — single column, max-width 800px. Each row: ticker (monospace) / theme / stance / confidence / α Discuss (hover-revealed). Row hover bg: #faf6ee.

**`components/DigestsTab.tsx`** — single column, max-width 720px. Each item: category / date / title / summary / tags / α Discuss (bottom-right).

---

## API Routes

### `app/api/signal/route.ts`

```ts
// OPENCLAW: Wire up bidirectional communication here.
//
// This route receives action signals from the dashboard and should:
//   1. Authenticate the request (add OPENCLAW_API_KEY check)
//   2. Forward the payload to OpenClaw's signal endpoint:
//      POST ${OPENCLAW_URL}/signal  with the action payload
//   3. OpenClaw should then update the relevant context file:
//      - "done" / "snooze" / "skip" → update OPEN_LOOPS.md or PROJECTS.md
//      - "add-loop" → prepend to OPEN_LOOPS.md
//   4. Optionally: trigger a GitHub push to rebuild the dashboard data
//
// Payload shape the dashboard sends:
//   { type: "done" | "snooze" | "skip" | "add-loop", itemId: string, payload?: object }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: returns { ok: true } immediately (no-op).
```

### `app/api/thread/route.ts`

```ts
// OPENCLAW: Wire up AI streaming here.
//
// This route receives thread messages and should:
//   1. Authenticate (OPENCLAW_API_KEY)
//   2. Forward to OpenClaw's streaming chat endpoint:
//      POST ${OPENCLAW_URL}/chat/stream  with { systemPrompt, messages }
//   3. Pipe the streaming response back to the client as a ReadableStream.
//      Use Next.js streaming: return new Response(stream, { headers: { "Content-Type": "text/event-stream" } })
//
// The client-side ThreadDrawer currently reads the full response body at once.
// When you switch to streaming, update ThreadDrawer's send() to consume
// the ReadableStream chunk by chunk and append to the last assistant message.
// Look for the comment "// OPENCLAW: Switch to streaming here" in ThreadDrawer.tsx.
//
// Request shape the dashboard sends:
//   { systemPrompt: string, messages: Array<{ role: "user"|"assistant", content: string }> }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: returns a canned placeholder response after 600ms delay.
```

---

## Styling

`app/globals.css` is fully replaced. Structure:

```
1.  Google Fonts @import
2.  Design tokens (:root custom properties — all colors, radii, shadows)
3.  Reset + base (box-sizing, body, a, scroll-behavior)
4.  Layout (masthead, main wrapper, drawer margin shift)
5.  Masthead + tab nav (active underline, inactive muted color)
6.  Today tab (focus stage, context column, split layout)
7.  Focus card (progress dots, priority tag, title, buttons, snooze picker, snoozed strip)
8.  Loops tab (loop row, hover actions, done/snoozed states)
9.  Projects tab (grid, project card, OpenClaw badge, status badge, inline loops)
10. Investing tab (ticker row, hover reveal)
11. Digests tab (digest item, tags)
12. Thread drawer (desktop panel, mobile bottom sheet, messages, input row)
13. Quick add
14. Status bar
15. Animations (exit fade, drawer slide, progress dot width, chevron rotate)
16. Responsive ≤640px breakpoint
```

Key design tokens (full set in the implemented file):
```css
:root {
  --bg:           #f4efe4;
  --bg-side:      #ede8db;
  --card:         #faf6ee;
  --card-hover:   #fff8f0;
  --ink:          #1c1714;
  --ink-2:        #2c2418;
  --ink-muted:    #7a6f62;
  --ink-faint:    #b0a080;
  --accent-high:  #a84030;
  --accent-med:   #8a6a3a;
  --accent-low:   #5a7a5a;
  --accent-link:  #9a6a3a;
  --border:       #d8cebb;
  --border-strong:#c8bc9e;
  --border-faint: #e8e0d0;
  --dark-fill:    #1c1814;
  --dark-fill-text:#f4efe4;
  --radius-card:  12px;
  --radius-btn:   9px;
  --radius-pill:  99px;
}
```

---

## Files Created / Modified

| File | Change |
|---|---|
| `app/layout.tsx` | Add Google Fonts `<link>` tags |
| `app/page.tsx` | Server component — import data, pass to `<Dashboard>` |
| `app/globals.css` | Full replacement with new design system |
| `app/api/signal/route.ts` | New — stub signal handler |
| `app/api/thread/route.ts` | New — stub thread handler |
| `lib/data.ts` | New type definitions (DashboardData v3 schema) |
| `lib/generated-data.json` | Regenerated on build |
| `scripts/generate-dashboard-data.mjs` | Updated to emit new schema + ocOwned |
| `openclaw.config.json` | New — managed project names |
| `components/Dashboard.tsx` | New — root client component |
| `components/FocusCard.tsx` | New |
| `components/ThreadDrawer.tsx` | New |
| `components/ContextColumn.tsx` | New |
| `components/QuickAdd.tsx` | New |
| `components/StatusBar.tsx` | New |
| `components/TodayTab.tsx` | New |
| `components/LoopsTab.tsx` | New |
| `components/ProjectGrid.tsx` | New |
| `components/InvestingTab.tsx` | New |
| `components/DigestsTab.tsx` | New |

---

## OpenClaw Handoff Prompt

> Hand this prompt to OpenClaw when the dashboard is deployed and you are ready to wire up the live API integration.

---

**To: OpenClaw**

The Alphalpha Dashboard v3 is now deployed at `alphalpha-dashboard.vercel.app`. The UI is complete. Your job is to wire up the two API routes that are currently stubbed out, and configure bidirectional state sync.

**What's built and working:**
- Full tab UI (Today, Open Loops, Projects, Investing, Digests)
- Focus card with Done / Snooze / Skip (optimistic UI, signals fire-and-forget)
- α Thread drawer on every card type (UI complete, returns placeholder response)
- OpenClaw ownership badges driven by `openclaw.config.json` in the repo root
- Status bar with live counts

**What you need to implement:**

**1. Signal endpoint — `app/api/signal/route.ts`**
This file has a detailed `// OPENCLAW:` comment explaining exactly what to do. Summary:
- The dashboard POSTs `{ type, itemId, payload }` to this route on every Done/Snooze/Skip/QuickAdd
- You should receive it, authenticate with `OPENCLAW_API_KEY`, forward to your internal signal handler, update the relevant context file (`OPEN_LOOPS.md`, `PROJECTS.md`), and push to GitHub to trigger a Vercel redeploy
- Set `OPENCLAW_URL` and `OPENCLAW_API_KEY` as Vercel environment variables

**2. Thread streaming — `app/api/thread/route.ts`**
This file has a detailed `// OPENCLAW:` comment. Summary:
- The dashboard POSTs `{ systemPrompt, messages }` to this route
- You should forward it to your AI endpoint and stream the response back
- The `systemPrompt` is already fully constructed client-side with all item context — you receive it as-is
- After switching to streaming, also update `components/ThreadDrawer.tsx` at the comment `// OPENCLAW: Switch to streaming here` to consume the `ReadableStream` chunk by chunk

**3. `openclaw.config.json`**
Update this file whenever you assume ownership of a new project. Push to GitHub — Vercel will redeploy and the badge will appear automatically.

**4. Thread persistence (optional but recommended)**
See the `// OPENCLAW:` comment in `components/ThreadDrawer.tsx` for the localStorage approach. Implement once the streaming endpoint is live.

**Environment variables to set in Vercel:**
```
OPENCLAW_URL=http://your-vps:PORT
OPENCLAW_API_KEY=your-secret-key
```

All `// OPENCLAW:` comments in the codebase mark exactly where your integration points are. Search for them with `grep -r "OPENCLAW:" .` to find every one.

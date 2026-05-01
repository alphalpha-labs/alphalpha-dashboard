# Handoff: Alphalpha Dashboard Redesign

## Overview

This is a redesign of the Alphalpha "Chief of Staff" dashboard — a personal command center that helps Alex stay organized across projects, open loops, ideas, and life domains. It is bi-directionally connected to an OpenClaw instance that feeds it data and can receive conversational replies via inline threads.

The design moves away from an information-dense, scrolling page toward a **calm, editorial, focus-first interface** inspired by newspaper broadsheets (warm parchment palette, Playfair Display + Lora serif typography) combined with a **one-item-at-a-time focus mode** that surfaces the single most important decision at any moment.

---

## About the Design Files

The files in this bundle are **high-fidelity design references built in HTML/React** — working interactive prototypes showing intended look, behavior, and data structure. They are **not production code to ship directly**.

Your task is to **recreate these designs in the target codebase** (Next.js on Vercel, since the original `alphalpha-dashboard.vercel.app` is already there) using its established patterns, component library, and data-fetching approach.

**Key reference file:** `Alphalpha Dashboard v3.html` — this is the final design. Open it in a browser to interact with it fully.

**Supporting file:** `Design Directions.html` — shows three early visual explorations (Paper / Terminal / Focus) that were synthesized into v3. Useful for understanding the design rationale.

**Data file:** `data.js` — defines the full data schema (`window.DASHBOARD_DATA`) used throughout the prototype. This is the shape your API/openclaw data source should conform to.

---

## Fidelity

**High-fidelity.** The prototype uses final colors, typography, spacing, and interactions. Implement pixel-faithfully using the codebase's component patterns.

---

## Design Tokens

### Colors
```
Background (warm):     #f4efe4   — main page background
Background (side):     #ede8db   — sidebar / context column
Card background:       #faf6ee   — cards, thread drawer
Card hover:            #fff8f0
Panel/inset:           #ede8de

Text primary:          #1c1714
Text secondary:        #2c2418
Text muted:            #7a6f62
Text faint:            #b0a080

Accent (high):         #a84030   — HIGH priority, urgent
Accent (medium):       #8a6a3a   — MEDIUM priority
Accent (low):          #5a7a5a   — LOW priority
Accent (link):         #9a6a3a   — "view all" links

Border default:        #d8cebb
Border strong:         #c8bc9e
Border faint:          #e8e0d0

Dark fill:             #1c1814   — primary buttons, done state, chat bubbles
Dark fill text:        #f4efe4

Status (active):       bg #e8f0e4 / text #3a6a3a
Status (snoozed):      bg #e8e0d0 / text #7a6a5a
```

### Typography
```
Headings / display:    'Playfair Display', Georgia, serif
  — page titles, card titles, focus card main text, logo

Body / prose:          'Lora', serif
  — loop text, summaries, posture copy, chat messages, italic annotations

UI chrome:             'DM Sans', sans-serif
  — nav tabs, labels, badges, buttons, metadata, tags

Monospace:             system monospace
  — ticker symbols (TICKER column)
```

### Type Scale
```
Page title (tab header):    26px Playfair Display, color #1c1714
Focus card title:           28px Playfair Display (22px mobile)
Project card title:         17-18px Playfair Display
Card title (digest):        13px Lora 600
Section labels:             9-11px DM Sans 600, uppercase, 0.12em tracking
Body / loop text:           13px Lora, line-height 1.45-1.55
Metadata / tags:            10-11px DM Sans
Ticker symbol:              13px monospace 600
```

### Spacing
```
Page padding (desktop):     32px horizontal, 32px top
Page padding (mobile):      16px horizontal
Card padding:               18-20px
Section gap:                14-20px between cards/rows
Collapsible padding:        12px top/bottom
Thread drawer width:        360px (fixed, slides in from right)
Context column width:       300px (fixed, desktop)
Bottom status bar:          7px vertical padding
```

### Border Radius
```
Cards:                  12px
Buttons (primary):      9px
Buttons (small):        6-7px
Pills / badges:         99px (fully rounded)
Chat bubbles:           11px, 3px on tail side
Snooze picker:          10px
Dot indicators:         50% (circle)
```

### Shadows
```
Thread drawer (mobile): 0 -8px 32px rgba(28,24,20,0.12)
Snooze picker:          0 4px 24px rgba(28,24,20,0.14)
```

---

## Screens / Views

### 1. Masthead (persistent header)
- Full-width, `border-bottom: 1.5px solid #1c1714`
- **Left:** "Alphalpha" in Playfair Display 700 20px + "Chief of Staff" label 10px DM Sans uppercase
- **Center:** Tab nav — Today / Open loops / Projects / Investing / Digests. Active tab has `border-bottom: 2px solid #1c1714`, font-weight 500. Inactive: color #9a8f7a.
- **Right:** Date string, 11px DM Sans, color #b0a080
- **Mobile:** Logo row stacks above scrollable tab nav. Date moves inline with logo.

---

### 2. Today Tab (default view)
Two-column layout: **focus stage** (left, flex 55%) + **context column** (right, fixed 300px).

#### 2a. Focus Stage (left panel)
Centers one decision/action at a time vertically in the available space.

**Progress dots**
- Row of dots, one per non-snoozed action
- Active dot: 22px wide × 6px, #1c1814
- Done dots: 6px × 6px, #c8bc9e
- Pending dots: 6px × 6px, #ddd4be
- `transition: width 0.3s ease` on the active dot

**Priority tag** (above title)
- 10px DM Sans 600, uppercase, 0.13em tracking
- HIGH: color #a84030 + dot
- MEDIUM: color #8a6a3a + dot
- Format: `"Needs a decision · ProjectName"` or `"Next up · ProjectName"`

**Title**
- Playfair Display, 28px desktop / 22px mobile, color #1c1714, line-height 1.3, centered, max-width 500px

**Next step**
- Lora italic, 13px, color #8a7f6a, centered, max-width 400px
- Format: `"Next → [next step text]"`

**Action buttons** (row, centered, gap 10px)
- **Done ✓** — filled dark: bg #1c1814, color #f4efe4, padding 11px 26px, radius 9px, DM Sans 500
- **Snooze 💤** — outlined: bg transparent, border 1px #d8cebb, color #7a6f62, same padding
  - Clicking opens SnoozePicker dropdown (see below)
- **Skip →** — same style as Snooze

**Discuss button** (below action row, margin-top 22px)
- `"α Discuss with Alphalpha"` — transparent bg, border 1px #d8cebb, color #9a8f7a, DM Sans 12px, radius 9px, padding 8px 16px
- α glyph in Playfair Display 13px

**Remaining count** — `"N more waiting"`, 11px DM Sans, color #c0b49a, margin-top 18px

**Snoozed strip** (bottom of focus stage, `border-top: 1px solid #d8cebb`, bg #ede8db)
- Label "SNOOZED" + chips showing `💤 truncated title · snooze label` + ✕ wake button
- Each chip: bg #e8e0d0, borderRadius 6, 11px DM Sans

**Exit animation on card transition:** opacity 0 + translateY(8px), duration 260ms ease

#### 2b. Context Column (right panel, bg #ede8db)
Scrollable, padding 22px 20px.

**Today's posture block**
- Label: 9px DM Sans 600 uppercase #b0a080
- Quote: Playfair Display 14px italic #1c1714
- Body: Lora 12px #7a6f62 line-height 1.6
- `border-bottom: 1px solid #d8cebb`, margin-bottom 18px

**Quick add loop** (see QuickAdd component)

**Collapsible sections** — Open loops / Investing / Digests (collapsed by default except loops)
- Header: DM Sans 11px 600 uppercase + count badge
- Toggle: ▾ rotates -90deg when closed

---

### 3. Open Loops Tab
Single column, max-width 720px, centered.

**Header:** Playfair Display 26px + Lora italic subtitle

**Loop items:**
- Dot indicator (7px circle, color by priority) + Lora 13px text + project label 10px DM Sans #b0a080
- On hover: ✓ done button, 💤 snooze button, **α Discuss** button appear inline
- Done: strikethrough + opacity 0.35
- Snoozed: dimmed italic with wake button

---

### 4. Projects Tab
Grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`, gap 14px.

**Legend** at top: "α = OpenClaw managed · manually tracked = you own it"

**Project card** (bg #faf6ee, border 1px #d8cebb, radius 12px, padding 18px 20px):
- **Category label:** 9px DM Sans 600 uppercase #b0a080
- **OpenClaw badge** (if applicable): `"α OpenClaw"` — bg rgba(28,24,20,0.08), color #5a5040, 9px DM Sans 600, radius 99px. Shown top-right.
- **Status badge:** `"ACTIVE"` — bg #e8f0e4, color #3a6a3a, 9px uppercase
- **Name:** Playfair Display 17px #1c1714
- **Summary:** Lora italic 12px #7a6f62, line-height 1.5
- **Meta row:** last activity + high priority count (red dot + count if > 0)
- **Inline loops** (up to 2): dot + Lora 12px text, `border-top: 1px solid #e8e0d0`
- **α Discuss button:** bottom-right, always visible

**OpenClaw ownership data** (implement in your codebase):
The following projects are OpenClaw-managed (set by your data source):
- Alphalpha
- OpenClaw migration and orchestration
- Obsidian / GitHub-backed personal knowledge system

---

### 5. Investing Tab
Single column table, max-width 800px.

**Row layout** (border-bottom 1px #ede8de, padding 10px 0):
- Ticker: monospace 13px 600 #2c2418, width 44px
- Theme: Lora 12px #5a5040, flex 1
- Stance: DM Sans 11px #7a6f62
- Confidence: 9px DM Sans 600 uppercase — HIGH: #a84030, MEDIUM: #8a6a3a
- **α Discuss**: appears on hover (right-aligned)
- Row bg on hover: #faf6ee

---

### 6. Digests Tab
Single column, max-width 720px.

**Digest item** (border-bottom 1px #ede8de, padding 14px 0):
- Category: 9px DM Sans 600 uppercase #9a6a3a
- Date: 10px DM Sans #c0b49a (right-aligned)
- Title: Lora 13px 600 #2c2418
- Summary: Lora italic 12px #7a6f62, line-height 1.5
- Tags: 10px DM Sans, bg #f0ebe0, color #8a7f6a, radius 4px
- **α Discuss**: bottom-right

---

### 7. Thread Drawer (universal)
A persistent panel that opens when any "α Discuss" button is clicked.

**Desktop:** Fixed, right: 0, top: 0, bottom: 0, width: 360px. The main content area's `margin-right` animates to 360px (`transition: margin-right 0.28s ease`) to push content rather than overlay.

**Mobile:** Fixed, left: 0, right: 0, bottom: 0, height: 65vh, `border-radius: 14px 14px 0 0`, box-shadow upward.

**Header** (bg #f4efe4, border-bottom 1px #e8e0d0, padding 14px 18px):
- α avatar (24px circle, bg #1c1814, Playfair Display 12px #f4efe4)
- Type label: 10px DM Sans 600 uppercase #b0a080 (Decision / Open loop / Project / Investing / Digest)
- Item title truncated to 60 chars, Playfair Display 13px #1c1714
- Project name + "OpenClaw managed" badge (if applicable)
- ✕ close button

**Messages area** (flex 1, overflow-y auto, padding 16px 18px, gap 12px):
- Assistant messages: left-aligned, α avatar (22px), bg #ede8de, color #2c2418, radius 11px 11px 11px 3px
- User messages: right-aligned, bg #1c1814, color #f4efe4, radius 11px 11px 3px 11px
- Font: Lora 13px, line-height 1.55
- Loading: `"· · ·"` in assistant bubble

**Input row** (bg #f4efe4, border-top 1px #e8e0d0, padding 10px 14px 16px):
- Input: Lora 13px, bg #fff8f0, border 1px #d8cebb, radius 9px, padding 9px 14px
- Send button: bg #1c1814, color #f4efe4, radius 9px, 15px arrow ↑

**Thread seeding — system prompt construction:**
Each thread type gets a different system prompt and opener. Build the system prompt from:
```
You are Alphalpha, Alex's personal AI chief of staff. Today is [date].
You are discussing a [type] item.
Title: "[title]"
Project: [project]
Priority: [priority]           // if applicable
Suggested next step: [next]    // if applicable
Investment theme: [theme]      // if applicable
Stance: [stance]               // if applicable
Summary: [summary]             // if applicable
Category: [category]           // if applicable
This item is actively managed by OpenClaw.  // if ocOwned
Be concise (≤3 sentences), warm, and concrete. Help Alex decide, act, or think more clearly.
```

**Opener messages by type:**
- `decision`: `"On '[title]'… — what's your thinking? I can help you decide or draft the next step."`
- `loop`: `"This loop has been open for a while. Want to close it, snooze it, or think through what's blocking it?"`
- `project` (ocOwned): `"I'm actively managing this one. What aspect of '[name]' do you want to think through?"`
- `project` (manual): `"This is a manually-tracked project. What aspect of '[name]' do you want to think through?"`
- `ticker`: `"[TICKER] — [theme]. Want to think through the thesis, timing, or what would change your mind?"`
- `digest`: `"'[title]' — want to dig into this, connect it to other threads, or decide what to do with it?"`

Thread state resets (new opener) whenever the thread context changes (new item selected).

---

### 8. Snooze Picker
Dropdown anchored `top: 100%, right: 0` from its trigger button.

Options: **Later today (4 hrs) / Tomorrow (24 hrs) / In 3 days (72 hrs) / Next week (7 days)**

Style: bg #faf6ee, border 1px #d8cebb, radius 10px, padding 6px 4px, shadow `0 4px 24px rgba(28,24,20,0.14)`.
Each option: 12px DM Sans, hover bg #ede8de.

---

### 9. Quick Add Loop
Default state: `"+ Capture a loop"` button — outlined, 12px DM Sans.
Expanded: inline input (Lora 13px) + Save button (bg #1c1814), `border: 1px solid #c8bc9e`, bg #fff8f0.
Enter to save, Esc to cancel.

---

### 10. Status Bar (desktop only)
`border-top: 1px solid #d8cebb`, padding 7px 32px, bg #ede8db.
Shows: `N open loops · N projects · N high priority` (high priority turns #a84030 when > 0).
Right: italic Lora "Generated [timestamp]".
Animates `margin-right` in sync with thread drawer.

---

## Data Schema

See `data.js` for the full structure. Key shape:
```js
{
  meta: { generatedAt, posture, postureDetail },
  stats: { openLoops, activeProjects, highPriority, uncertainties, investingSignals },
  topActions: [{ id, priority, title, context, next, project, due, done, snoozed, snoozeLabel }],
  openLoops:  [{ id, text, project, priority }],
  projects:   [{ id, name, status, category, lastActivity, summary }],
  investing:  [{ ticker, theme, stance, confidence }],
  digests:    [{ id, date, category, title, summary, tags }],
}
```

**OpenClaw ownership** is not currently in the data schema — it's hardcoded in the prototype. You should add an `ocOwned: boolean` field to the project schema and drive it from your data source.

---

## Interactions & Behavior

| Interaction | Behavior |
|---|---|
| Done ✓ on focus card | Mark action `done: true`, animate card out (opacity 0 + translateY 8px, 260ms), advance to next |
| Snooze on focus card | Open picker → set `snoozed: true, snoozeLabel`, animate card out, show in snoozed strip |
| Skip → | Advance `focusIdx` to next active action, animate card out |
| Wake chip ✕ | Set `snoozed: false, snoozeLabel: null` |
| Discuss button | Open thread drawer with seeded context, auto-focus input |
| Thread ✕ | Close drawer, slide content back |
| Collapsible header | Toggle open/closed, ▾ rotates |
| Tab nav | Switch view, thread drawer persists |
| Quick add | Enter saves, Esc cancels, adds to top of loops list |
| Loop ✓ | Mark done, strikethrough + opacity 0.35 |
| Loop 💤 | Open snooze picker, then show snoozed state |

---

## Responsive Behavior

**Breakpoint: 640px**

| Element | Desktop | Mobile |
|---|---|---|
| Body overflow | hidden | auto |
| Masthead | single row | 2 rows (logo + nav) |
| Today: focus + context | side-by-side | stacked vertically |
| Focus stage min-height | fills viewport | 70vh |
| Focus card padding | 40px 60px | 28px 20px |
| Focus title size | 28px | 22px |
| Thread drawer | right panel, 360px wide | bottom sheet, 65vh |
| Status bar | visible | hidden |
| Discuss button | hover-only | always visible |
| Context column width | 300px | 100% |

---

## AI / Claude Integration

The prototype calls `window.claude.complete({ messages: [...] })` — this is a built-in helper in the design environment. In your production implementation, replace this with your actual OpenClaw API call.

The thread should POST to OpenClaw with:
- The system prompt (built from item context)
- The full message history
- Streaming response preferred for UX

---

## Assets

No external images or icons. All visual elements are CSS/SVG primitives:
- Priority dots: CSS `border-radius: 50%` circles
- α avatar: CSS circle with Playfair Display "α"
- Progress dots: CSS `border-radius: 3px` rectangles
- ▾ chevron: Unicode character, CSS `transform: rotate()`

---

## Files in This Bundle

| File | Purpose |
|---|---|
| `Alphalpha Dashboard v3.html` | **Final design reference** — open in browser to interact |
| `data.js` | Data schema and sample data |
| `Design Directions.html` | Early explorations (Paper / Terminal / Focus modes) |
| `README.md` | This document |

---

## Implementation Notes for Claude Code

1. **Start from the HTML file** — open it in a browser, interact with every tab and thread type before writing any code.
2. The existing Next.js app at `alphalpha-dashboard.vercel.app` should be the target. Match its existing routing and data-fetching patterns.
3. The `data.js` schema is the contract between your openclaw data pipeline and the frontend — implement the API to return this shape.
4. Add `ocOwned` to the project schema in your data source (driven by openclaw config, not hardcoded).
5. Replace `window.claude.complete()` with your real OpenClaw streaming API — the thread UX expects streaming for the `"· · ·"` loading state to feel natural.
6. The thread drawer is stateless in the prototype (resets on item change). In production, consider persisting threads to localStorage keyed by item ID so conversations survive navigation.

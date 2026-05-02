# Scaling & Animations Design

**Date:** 2026-05-02
**Status:** Approved

## Problem

At large viewport widths (~2000px+) the dashboard looks too small — fixed pixel dimensions leave dead whitespace and make type feel cramped relative to the screen. The app also lacks animation polish: tab switches are instant, items disappear without feedback, and interactive elements feel static.

## Decisions

- **Scaling approach:** `clamp()` fluid values on key declarations in `globals.css`. Surgical — no rem migration, no architectural changes.
- **Animation approach:** Pure CSS keyframes + transitions. Zero new dependencies. Consistent with the existing `focusCardContent--exiting` pattern. JS class-toggling triggers animations where needed.

---

## Part 1: Fluid Scaling

All changes are in `app/globals.css`. The `clamp(min, preferred-vw, max)` pattern means the layout feels close to current at 1440px and breathes out proportionally at 2000px+.

| Element | Current | Fluid value |
|---|---|---|
| Masthead height | `52px` | `clamp(48px, 3.8vh, 64px)` |
| Masthead wordmark font-size | `20px` | `clamp(18px, 1.4vw, 26px)` |
| Focus card title font-size | `28px` | `clamp(24px, 2.2vw, 42px)` |
| Focus stage padding | `40px 60px` | `clamp(28px, 4vw, 72px)` vertical, `clamp(40px, 5vw, 80px)` horizontal |
| Context column width | `300px` | `clamp(260px, 20vw, 380px)` |
| Tab page max-width | `720px` | `clamp(640px, 56vw, 960px)` |
| Tab page padding | `32px` | `clamp(24px, 3vw, 56px)` |
| Body / loop text font-size | `13px` | `clamp(13px, 0.9vw, 15px)` |

The `todayLayout` height calc references masthead height — must update it to use the same CSS variable if masthead height becomes fluid. Use a CSS custom property `--masthead-h` set on `:root` and referenced in both `.masthead { height }` and `.todayLayout { height: calc(100vh - var(--masthead-h) - 36px) }`.

---

## Part 2: Animations

### Keyframes (added to `globals.css`)

```css
@keyframes tabEnter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes cardEnter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes itemCollapse {
  0%   { opacity: 1; max-height: 120px; }
  40%  { opacity: 0; }
  100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
}

@keyframes pickerIn {
  from { opacity: 0; transform: scale(0.94) translateY(-4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

### State Transitions

**Tab content entrance** — `Dashboard.tsx` wraps each tab's content in a `<div key={activeTab}>` so React remounts it on switch. The wrapper gets class `.tabContent` with `animation: tabEnter 280ms cubic-bezier(0.16,1,0.3,1) both`.

**Focus card entrance** — `FocusCard.tsx` adds class `.focusCardContent--entering` on mount (via `useEffect` + `useState`), which plays `cardEnter 320ms cubic-bezier(0.16,1,0.3,1) both`. This complements the existing `.focusCardContent--exiting` exit animation.

**Loop / action item done** — `.loopRow` and `.actionRow` gain `.loopRow--collapsing` on done/snooze. That class applies `animation: itemCollapse 300ms cubic-bezier(0.4,0,0.2,1) forwards`. `onAnimationEnd` removes the item from state.

**Snooze picker entrance** — `.snoozePicker` is conditionally rendered; add `animation: pickerIn 180ms cubic-bezier(0.16,1,0.3,1) both` when it mounts.

**Thread drawer** — existing `transform: translateX` transition kept; no change needed.

### Micro-interactions (CSS only, no JS)

**Button press scale** — `:active { transform: scale(0.96); }` on `.btnDone`, `.btnOutlined`, `.btnDiscuss`, `.btnAlphaDiscuss`. Transition: `transform 80ms ease`.

**Outlined button hover** — `.btnOutlined:hover { background: var(--card-hover); border-color: var(--border-strong); }` — transition already partially exists, extend to cover `border-color`.

**Project card hover lift** — `.projectCard { transition: transform 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms ..., border-color 180ms ease; }` `.projectCard:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(28,24,20,0.10); border-color: var(--border-strong); }`

**α Discuss button hover** — add `color` and `transform` to `.btnAlphaDiscuss` transitions; `:active { transform: scale(0.96); }`.

**Snooze option hover** — `.snoozeOption:hover` already has `background`; transition it: `transition: background 100ms ease`.

**Ticker / loop action reveal** — already uses `opacity` transition; no change needed.

---

## Files Changed

| File | Changes |
|---|---|
| `app/globals.css` | Fluid `clamp()` values; `--masthead-h` custom property; 4 new keyframes; micro-interaction transitions on buttons, project cards |
| `components/Dashboard.tsx` | Wrap tab content in `<div key={activeTab} className="tabContent">` |
| `components/FocusCard.tsx` | Add `.focusCardContent--entering` class on mount |
| `components/LoopsTab.tsx` | `--collapsing` class + `onAnimationEnd` state removal |
| `components/TodayTab.tsx` | Same collapse animation for `activeActions` items |

---

## Out of Scope

- Framer Motion or any new npm dependencies
- Mobile-specific animation changes (mobile already shows actions without hover; collapse animation is safe there)
- Staggered list entrance (adds complexity; defer until validated)

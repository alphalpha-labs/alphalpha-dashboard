# Dashboard Aesthetic Redesign — Design Spec
*2026-05-26*

## Overview

Apply a warm, ambient visual treatment to the Alphalpha dashboard inspired by the existing parchment palette and a set of AI-generated Eastern/Austin imagery. The goal is to make the dashboard feel more alive and delightful without compromising readability or adding visual noise.

Scope is limited to aesthetic changes only — no behavioral or UX changes in this pass.

---

## Aesthetic Direction: Amber Atelier

Push the existing warm parchment design further with real imagery used as ambient layers at low opacity. The effect should feel like the dashboard is printed on richly textured paper — the imagery present but subordinate to content.

**Design tokens (unchanged from existing)**
- Background: `#f0e8d4` (parchment)
- Sidebar: `#e8dfc8`
- Ink: `#1c1714`
- Accent: `#a84030`
- Typography: Playfair Display (headings/titles), Lora (body/italic), DM Sans (UI labels)

---

## Changes

### 1. Focus Stage — Ambient Image Layers (Today tab only)

Two absolutely-positioned layers sit behind all content in the focus stage. No other tabs are affected.

**Layer 1 — Texture**
- Image: `meditation-ripple.png` (monk + gold/blue woodblock ripple water)
- Opacity: 8%
- Sizing: `background-size: 110% auto`, centered
- Animation: slow drift — `background-position` shifts over 40s ease-in-out (alternate), giving a gentle breathing quality
- Blend mode: none (plain opacity)

**Layer 2 — Landscape**
- Image: `austin-river.png` (Austin river, two people, golden hour)
- Opacity: 35%
- Sizing: `object-fit: cover`, `object-position: center 30%` (crops to the interesting upper portion)
- Animation: none (static)
- Blend mode: none (plain opacity)

Both layers use `position: absolute; inset: 0; pointer-events: none` and sit below all focus-stage content in z-index.

**Image files**
Place in `/public/aesthetics/` and reference via Next.js static paths:
- `austin-river.png` — from `docs/aesthetics/a_l_p_a_Austin_Texas_--sref...(a30d)_0.png`
- `meditation-ripple.png` — from `docs/aesthetics/a_l_p_a_...Meditation...(7aae)_2.png`

---

### 2. Context Column Sidebar — Rotating Header Image

The sidebar header (currently `170px` tall) displays a randomly selected image from the inspiration pool. The selection happens once at page load and persists for the session (no auto-cycling).

**Image pool** (7 images, all from `/public/aesthetics/`):
| File | Source |
|------|--------|
| `austin-river.png` | `a30d_0` — two people, golden hour |
| `austin-golden.png` | `a30d_3` — silhouette, golden river |
| `austin-tree.png` | `ac04` — gnarled tree + skyline |
| `waves-castle.png` | wave rider + Asian castle |
| `zendo-circle.png` | glowing circular window + tree |
| `meditation-ripple.png` | monk + gold/blue ripple |
| `meditation-city.png` | monk + Austin + swirling ripple |

**Behavior**
- Image is selected once via `useState(() => images[Math.floor(Math.random() * images.length)])` — the initializer runs only on first mount, not on re-renders
- Render as `object-fit: cover`, `object-position: center 40%`
- Fade in with a 400ms opacity transition on mount (avoids pop-in)
- Caption overlay (existing): location/mood label in italic Lora, fades in with image

---

### 3. Animations

All animations are CSS-only (no JS timers beyond the existing interaction handlers).

| Animation | Trigger | Behavior |
|-----------|---------|----------|
| `texture-drift` | Always | `background-position` 0%→60% over 40s, ease-in-out, alternate |
| `card-exit` | Done / Skip / Snooze | Fade up + slight scale-down over 360ms |
| `card-enter` | After card-exit | Fade in from below + scale up over 420ms, cubic spring |
| `dot-spring` | Card change | Active dot stretches wide then settles (640ms spring) |
| `ripple-ring` | Done only | 4 concentric ellipses expand and fade over 900ms, staggered delays |
| `chip-in` | Snooze | Chip scales up from 82% with spring (300ms) |

---

## Files to Change

| File | Change |
|------|--------|
| `app/globals.css` | Add keyframe animations, `.layer-texture`, `.layer-landscape` styles, sidebar image fade-in |
| `components/Dashboard.tsx` | Add layer divs inside focus stage; add random image selection logic for sidebar |
| `public/aesthetics/` | Add 7 image files (copy from `docs/aesthetics/`) |

No new components needed. No API or data changes.

---

## What's Explicitly Out of Scope

- Other tabs (Open loops, Projects, Investing, Digests) — unchanged
- Masthead, status bar — unchanged
- Any functional / UX behavior changes
- Per-tab imagery (deferred — may revisit as a follow-on)
- Halo and wave image layers (explored, rejected as too heavy-handed)

---

## Reference

Visual demo at `.superpowers/brainstorm/10434-1779824104/content/real-images-demo.html` shows the approved look at the correct layer opacities. Use it as the source of truth for the exact CSS values.

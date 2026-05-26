# Dashboard Aesthetic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ambient image layers to the Today tab focus stage and a per-session random header image to the context column sidebar.

**Architecture:** Images live in `/public/aesthetics/` (served by Next.js). Two absolutely-positioned CSS layers sit behind focus stage content using negative z-index inside an isolated stacking context. The sidebar picks one image from a pool on component mount via `useState` initializer.

**Tech Stack:** Next.js 14, React, TypeScript, plain CSS (globals.css)

**Spec:** `docs/superpowers/specs/2026-05-26-dashboard-aesthetic-design.md`
**Reference demo:** `.superpowers/brainstorm/10434-1779824104/content/real-images-demo.html`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `public/aesthetics/` | Create | 7 image files for ambient layers and sidebar pool |
| `app/globals.css` | Modify | `textureDrift` keyframe, `.layerTexture`, `.layerLandscape`, `.focusStage` isolation, `.sidebarHero`, text color overrides |
| `components/FocusCard.tsx` | Modify | Add `.layerTexture` and `.layerLandscape` divs inside `.focusStage` |
| `components/ContextColumn.tsx` | Modify | `useState` image pick, `.sidebarHero` JSX with fade-in `onLoad` |

---

## Task 1: Copy images to `/public/aesthetics/`

**Files:**
- Create: `public/aesthetics/` (directory + 7 files)

- [ ] **Step 1: Create the directory and copy images**

```bash
mkdir -p public/aesthetics

cp "docs/aesthetics/a_l_p_a_Austin_Texas_--sref_httpss.mj.runyjq01gTnuoA_--profil_a30d1e11-1b34-40a8-b0fa-1552a07740a2_0.png" \
   public/aesthetics/austin-river.png

cp "docs/aesthetics/a_l_p_a_Austin_Texas_--sref_httpss.mj.runyjq01gTnuoA_--profil_a30d1e11-1b34-40a8-b0fa-1552a07740a2_3.png" \
   public/aesthetics/austin-golden.png

cp "docs/aesthetics/a_l_p_a_Austin_Texas_--chaos_45_--ar_32_--sref_httpss.mj.runy_ac043bd6-2651-4f32-810c-785d4c9be23e_0.png" \
   public/aesthetics/austin-tree.png

cp "docs/aesthetics/a_l_p_a_Waves_on_castles_--chaos_60_--ar_32_--sref_httpss.mj._a62aa94a-85ea-42b9-a665-4b94d4e31c2a_2.png" \
   public/aesthetics/waves-castle.png

cp "docs/aesthetics/a_l_p_a_Zendo_Dance_--chaos_45_--ar_32_--sref_httpss.mj.runAl_87cd1b7b-c372-457a-8f36-d68046507577_0.png" \
   public/aesthetics/zendo-circle.png

cp "docs/aesthetics/a_l_p_a_httpss.mj.runFjQ7Q_L8hlM_Meditation_on_refinemnet_--c_7aae118a-870d-4ebe-8a19-fabc5936f594_2.png" \
   public/aesthetics/meditation-ripple.png

cp "docs/aesthetics/a_l_p_a_httpss.mj.runFjQ7Q_L8hlM_Meditation_on_refinemnet_--c_f0bd697f-7634-4376-9170-23ffa33d6776_2.png" \
   public/aesthetics/meditation-city.png
```

- [ ] **Step 2: Verify all 7 files are present**

```bash
ls -lh public/aesthetics/
```

Expected: 7 `.png` files, each 1–10 MB.

- [ ] **Step 3: Commit**

```bash
git add public/aesthetics/
git commit -m "feat: add ambient imagery to public/aesthetics"
```

---

## Task 2: Add CSS — keyframe, layer styles, text color fixes, sidebar hero

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add `textureDrift` keyframe**

Find the block of existing `@keyframes` declarations (around line 52). Add the new keyframe immediately after the last existing one (`panelDismiss` or similar):

```css
@keyframes textureDrift {
  0%   { background-position: 0% 0%; }
  100% { background-position: 60% 40%; }
}
```

- [ ] **Step 2: Add `position: relative; isolation: isolate;` to `.focusStage`**

The current `.focusStage` rule (around line 118) reads:
```css
.focusStage {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: clamp(28px, 4vw, 72px) clamp(40px, 5vw, 80px); min-height: 0; overflow-y: auto;
}
```

Replace it with:
```css
.focusStage {
  position: relative; isolation: isolate;
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: clamp(28px, 4vw, 72px) clamp(40px, 5vw, 80px); min-height: 0; overflow-y: auto;
}
```

`isolation: isolate` creates a self-contained stacking context so the negative-z-index layers don't bleed behind the page background.

- [ ] **Step 3: Add layer styles immediately after `.focusStage`**

```css
/* Ambient image layers — Today tab focus stage */
.layerTexture {
  position: absolute; inset: 0; pointer-events: none; z-index: -2;
  background-image: url('/aesthetics/meditation-ripple.png');
  background-size: 110% auto;
  background-position: center center;
  opacity: 0.08;
  animation: textureDrift 40s ease-in-out infinite alternate;
}
.layerLandscape {
  position: absolute; inset: 0; pointer-events: none; z-index: -1; overflow: hidden;
}
.layerLandscape img {
  width: 100%; height: 100%; object-fit: cover;
  object-position: center 30%;
  opacity: 0.35;
}
```

- [ ] **Step 4: Darken muted text colors in the focus stage**

Find `.focusNext` (around line 157) and `.focusRemaining` (around line 185). Update their `color` values:

```css
.focusNext {
  font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 13px;
  color: #5e4535; text-align: center; max-width: 400px; margin: 0 0 28px;
}
```

```css
.focusRemaining { font-family: 'DM Sans', sans-serif; font-size: 11px; color: #7a6a50; margin-top: 18px; }
```

- [ ] **Step 5: Add sidebar hero styles**

Add after the `.contextColumn` rule (around line 122):

```css
/* Sidebar header image */
.sidebarHero {
  height: 170px; flex-shrink: 0; overflow: hidden;
  margin: -22px -20px 22px;
  border-bottom: 1px solid var(--border);
}
.sidebarHeroImg {
  width: 100%; height: 100%; object-fit: cover;
  object-position: center 40%;
  opacity: 0;
  transition: opacity 400ms ease;
}
.sidebarHeroImg--loaded { opacity: 1; }
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "feat: add ambient layer CSS and sidebar hero styles"
```

---

## Task 3: Add ambient layers to FocusCard

**Files:**
- Modify: `components/FocusCard.tsx`

The `focusStage` div appears twice in this file — once in the empty-state return (line ~60) and once in the normal return (line ~74). Both need the layers.

- [ ] **Step 1: Add layers to the empty-state return**

Find this block (around line 58–66):
```tsx
  if (!current) {
    return (
      <div className="focusStage">
        <p style={{ fontFamily: "'Lora', serif", fontStyle: "italic", color: "var(--ink-muted)" }}>
          All done for now. Add a loop to continue.
        </p>
        {snoozedActions.length > 0 && <SnoozedStrip snoozedActions={snoozedActions} onWake={onWake} />}
      </div>
    );
  }
```

Replace with:
```tsx
  if (!current) {
    return (
      <div className="focusStage">
        <div className="layerTexture" aria-hidden="true" />
        <div className="layerLandscape" aria-hidden="true">
          <img src="/aesthetics/austin-river.png" alt="" />
        </div>
        <p style={{ fontFamily: "'Lora', serif", fontStyle: "italic", color: "var(--ink-muted)" }}>
          All done for now. Add a loop to continue.
        </p>
        {snoozedActions.length > 0 && <SnoozedStrip snoozedActions={snoozedActions} onWake={onWake} />}
      </div>
    );
  }
```

- [ ] **Step 2: Add layers to the normal return**

Find the normal return's opening tag (around line 73–74):
```tsx
  return (
    <div className="focusStage">
      {/* Progress dots */}
      <div className="progressDots">
```

Replace with:
```tsx
  return (
    <div className="focusStage">
      <div className="layerTexture" aria-hidden="true" />
      <div className="layerLandscape" aria-hidden="true">
        <img src="/aesthetics/austin-river.png" alt="" />
      </div>
      {/* Progress dots */}
      <div className="progressDots">
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Visual check**

```bash
npm run dev
```

Open http://localhost:3000. The Today tab focus stage should show:
- Austin river image at ~35% opacity as a full-bleed wash behind the card
- Subtle ripple texture slowly drifting at 8% opacity
- All text legible; "Next →" italic and remaining count are darker than before

- [ ] **Step 5: Commit**

```bash
git add components/FocusCard.tsx
git commit -m "feat: add ambient image layers to focus stage"
```

---

## Task 4: Add random sidebar header image to ContextColumn

**Files:**
- Modify: `components/ContextColumn.tsx`

- [ ] **Step 1: Add the image pool constant and random selection state**

At the top of `components/ContextColumn.tsx`, add the pool constant after the imports:

```tsx
const SIDEBAR_IMAGES = [
  '/aesthetics/austin-river.png',
  '/aesthetics/austin-golden.png',
  '/aesthetics/austin-tree.png',
  '/aesthetics/waves-castle.png',
  '/aesthetics/zendo-circle.png',
  '/aesthetics/meditation-ripple.png',
  '/aesthetics/meditation-city.png',
] as const;
```

Inside the `ContextColumn` function, add the state (the initializer runs only on first mount):

```tsx
const [sidebarImage] = useState(
  () => SIDEBAR_IMAGES[Math.floor(Math.random() * SIDEBAR_IMAGES.length)]
);
const [heroLoaded, setHeroLoaded] = useState(false);
```

- [ ] **Step 2: Add the hero image JSX at the top of the aside**

The current return starts with:
```tsx
  return (
    <aside className="contextColumn">
      <div className="postureBlock">
```

Add the hero before `postureBlock`:
```tsx
  return (
    <aside className="contextColumn">
      <div className="sidebarHero">
        <img
          className={`sidebarHeroImg${heroLoaded ? ' sidebarHeroImg--loaded' : ''}`}
          src={sidebarImage}
          alt=""
          onLoad={() => setHeroLoaded(true)}
        />
      </div>
      <div className="postureBlock">
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Visual check**

Refresh http://localhost:3000. The sidebar should show:
- A full-bleed image header (170px tall) that fades in over 400ms on load
- A different image appears on each hard refresh (session-random)
- Image is cropped to `center 40%` — shows the interesting part of each image
- No layout shift — the sidebar dimensions are unchanged below the hero

- [ ] **Step 5: Commit**

```bash
git add components/ContextColumn.tsx
git commit -m "feat: add per-session random image header to sidebar"
```

---

## Verification Checklist

After all tasks are complete, run through these manually:

- [ ] Today tab focus stage shows the Austin river wash at ~35% opacity
- [ ] Texture layer drifts slowly (wait 5–10s to see movement)
- [ ] "Next →" italic text and remaining count are visibly darker than before
- [ ] Sidebar shows a full-bleed image that fades in on load
- [ ] Hard-refreshing a few times shows different sidebar images
- [ ] Open Loops, Projects, Investing, Digests tabs are visually unchanged
- [ ] `npm run build` exits cleanly with no TypeScript or lint errors

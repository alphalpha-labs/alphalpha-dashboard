# Scaling & Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard scale fluidly at large viewports and add subtle CSS animations across all major interactions.

**Architecture:** All scaling changes live in `app/globals.css` via `clamp()` fluid values. All animations are pure CSS keyframes + transitions, triggered by JS class-toggling that matches the existing `focusCardContent--exiting` pattern. No new npm dependencies.

**Tech Stack:** Next.js App Router, CSS Modules-free (single `globals.css`), React 18 with hooks

---

## Files Modified

| File | What changes |
|---|---|
| `app/globals.css` | `--masthead-h` custom property; `clamp()` on 8 key values; 4 keyframes; `.tabContent`, `.focusCardContent--entering`, `.loopRow--collapsing` classes; button/card micro-interaction transitions |
| `components/Dashboard.tsx` | Wrap tab content in `<div key={activeTab} className="tabContent">` |
| `components/FocusCard.tsx` | Add `entering` state + `useEffect` to play card entrance on `current.id` change |
| `components/LoopsTab.tsx` | Add `collapsing` + `pendingAction` to `LoopRow`; delay parent callbacks until `onAnimationEnd` |

---

## Task 1: Fluid scaling — CSS custom property + `clamp()` values

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add `--masthead-h` to `:root` and wire it up**

  In `globals.css`, add `--masthead-h` to the `:root` block (after the existing custom properties) and update the two places that hard-code `52px`:

  ```css
  /* In :root block — add after --shadow-picker: */
  --masthead-h: clamp(48px, 3.8vh, 64px);
  ```

  Find line 55 (`.masthead { ... height: 52px; ...}`) and change the height:
  ```css
  /* Before: */
  padding: 0 32px; height: 52px; flex-shrink: 0;
  /* After: */
  padding: 0 32px; height: var(--masthead-h); flex-shrink: 0;
  ```

  Find line 93 (`.todayLayout`) and update the calc:
  ```css
  /* Before: */
  .todayLayout { display: flex; height: calc(100vh - 52px - 36px); }
  /* After: */
  .todayLayout { display: flex; height: calc(100vh - var(--masthead-h) - 36px); }
  ```

  Also update the tab button height on line 71 to match:
  ```css
  /* Before: */
  color: var(--ink-muted); padding: 0 16px; height: 52px;
  /* After: */
  color: var(--ink-muted); padding: 0 16px; height: var(--masthead-h);
  ```

- [ ] **Step 2: Apply `clamp()` to font sizes and layout dimensions**

  Apply each change individually. Use exact line references from the grep output:

  **Line 62 — masthead wordmark:**
  ```css
  /* Before: */ font-weight: 700; font-size: 20px; color: var(--ink); letter-spacing: -0.02em;
  /* After:  */ font-weight: 700; font-size: clamp(18px, 1.4vw, 26px); color: var(--ink); letter-spacing: -0.02em;
  ```

  **Line 96 — focus stage padding:**
  ```css
  /* Before: */ justify-content: center; padding: 40px 60px; min-height: 0; overflow-y: auto;
  /* After:  */ justify-content: center; padding: clamp(28px, 4vw, 72px) clamp(40px, 5vw, 80px); min-height: 0; overflow-y: auto;
  ```

  **Line 99 — context column width:**
  ```css
  /* Before: */ width: 300px; flex-shrink: 0; background: var(--bg-side);
  /* After:  */ width: clamp(260px, 20vw, 380px); flex-shrink: 0; background: var(--bg-side);
  ```

  **Line 126 — focus title font size:**
  ```css
  /* Before: */ font-family: 'Playfair Display', Georgia, serif; font-size: 28px;
  /* After:  */ font-family: 'Playfair Display', Georgia, serif; font-size: clamp(24px, 2.2vw, 42px);
  ```

  **Line 236 — tab page max-width and padding:**
  ```css
  /* Before: */ .tabPage { max-width: 720px; margin: 0 auto; padding: 32px 32px 64px; }
  /* After:  */ .tabPage { max-width: clamp(640px, 56vw, 960px); margin: 0 auto; padding: clamp(24px, 3vw, 56px) clamp(24px, 3vw, 56px) 64px; }
  ```

  **Line 295 — investing page padding (same rhythm as tabPage):**
  ```css
  /* Before: */ .investingPage { max-width: 800px; margin: 0 auto; padding: 32px 32px 64px; }
  /* After:  */ .investingPage { max-width: clamp(700px, 60vw, 1040px); margin: 0 auto; padding: clamp(24px, 3vw, 56px) clamp(24px, 3vw, 56px) 64px; }
  ```

  **Line 251 — loop text font size:**
  ```css
  /* Before: */ .loopText { font-family: 'Lora', Georgia, serif; font-size: 13px; color: var(--ink-2); line-height: 1.45; }
  /* After:  */ .loopText { font-family: 'Lora', Georgia, serif; font-size: clamp(13px, 0.9vw, 15px); color: var(--ink-2); line-height: 1.45; }
  ```

- [ ] **Step 3: Verify scaling visually**

  Start the dev server if not running:
  ```bash
  npm run dev
  ```

  Open http://localhost:3000 and resize the browser window from ~1280px to ~2200px wide. Confirm:
  - Masthead, focus title, loop text, and padding all grow smoothly with the viewport
  - No element jumps or breaks at any intermediate width
  - The sidebar and tab content proportions widen together

- [ ] **Step 4: Commit**

  ```bash
  git add app/globals.css
  git commit -m "feat: fluid viewport scaling via clamp() on key dimensions"
  ```

---

## Task 2: CSS keyframes + micro-interactions

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add keyframes**

  Add the following block to `globals.css` after the `/* 3. Reset + base */` section (after line 46, before `/* 4. App shell */`):

  ```css
  /* 3b. Keyframes */
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

- [ ] **Step 2: Add animation trigger classes**

  Add `.tabContent` after the `/* 4. App shell */` block (after `.appShell`):
  ```css
  .tabContent { animation: tabEnter 280ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  ```

  Append the entering variant alongside the existing `.focusCardContent--exiting` rule (around line 110):
  ```css
  .focusCardContent--entering > * {
    animation: cardEnter 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  ```

  Add the collapse class after `.loopRow--done` (around line 260):
  ```css
  .loopRow--collapsing {
    animation: itemCollapse 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    overflow: hidden;
  }
  ```

  Add pickerIn to the existing `.snoozePicker` rule — append `animation` property:
  ```css
  /* Find .snoozePicker and add: */
  animation: pickerIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
  ```

- [ ] **Step 3: Add button micro-interactions**

  Find `.btnDone` (around line 136) and append a `transition`:
  ```css
  .btnDone {
    background: var(--dark-fill); color: var(--dark-fill-text);
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    padding: 11px 26px; border-radius: var(--radius-btn); cursor: pointer;
    transition: transform 80ms ease;
  }
  .btnDone:active { transform: scale(0.96); }
  ```

  Find `.btnOutlined` (around line 141) and extend its transition + add `:hover` and `:active`:
  ```css
  .btnOutlined {
    background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
    font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 11px 26px;
    border-radius: var(--radius-btn); position: relative; cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, transform 80ms ease;
  }
  .btnOutlined:hover  { background: var(--card-hover); border-color: var(--border-strong); }
  .btnOutlined:active { transform: scale(0.97); }
  ```

  Find `.btnDiscuss` (around line 146) and add press:
  ```css
  .btnDiscuss {
    background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
    font-family: 'DM Sans', sans-serif; font-size: 12px; padding: 8px 16px;
    border-radius: var(--radius-btn); margin-top: 22px; cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, transform 80ms ease;
  }
  .btnDiscuss:hover  { background: var(--card-hover); border-color: var(--border-strong); }
  .btnDiscuss:active { transform: scale(0.96); }
  ```

  Find `.btnAlphaDiscuss` (around line 83) and extend:
  ```css
  .btnAlphaDiscuss {
    background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
    font-family: 'DM Sans', sans-serif; font-size: 11px; padding: 5px 10px;
    border-radius: var(--radius-sm); display: inline-flex; align-items: center;
    gap: 4px; white-space: nowrap; cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 80ms ease;
  }
  .btnAlphaDiscuss:hover  { background: var(--card-hover); border-color: var(--border-strong); color: var(--ink-2); }
  .btnAlphaDiscuss:active { transform: scale(0.96); }
  ```

- [ ] **Step 4: Add project card hover lift**

  Find `.projectCard` (around line 268) and add transition + hover:
  ```css
  .projectCard {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card);
    padding: 18px 20px; display: flex; flex-direction: column;
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
                border-color 180ms ease;
  }
  .projectCard:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(28, 24, 20, 0.10);
    border-color: var(--border-strong);
  }
  ```

- [ ] **Step 5: Smooth snooze option hover**

  Find `.snoozeOption` (around line 163) and add transition:
  ```css
  .snoozeOption {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px;
    color: var(--ink-2); border-radius: 6px; width: 100%; text-align: left; cursor: pointer;
    transition: background 100ms ease;
  }
  ```

- [ ] **Step 6: Verify animations visually**

  With `npm run dev` running, open http://localhost:3000 and check:
  - Click between tabs — content fades and slides up on each switch
  - Hover buttons — subtle background/border change
  - Press and hold Done, Skip, Snooze — they scale down slightly on press
  - Hover project cards on the Projects tab — cards lift 3px with a shadow
  - Click Snooze button on focus card — picker appears with a scale-in pop
  - Hover α Discuss buttons — background and color transition smoothly

- [ ] **Step 7: Commit**

  ```bash
  git add app/globals.css
  git commit -m "feat: add CSS keyframes and micro-interaction transitions"
  ```

---

## Task 3: Tab content entrance animation — Dashboard.tsx

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Wrap tab content in a keyed div**

  In `Dashboard.tsx`, find the `<main className="mainContent" ...>` block (around line 120). The tab conditionals are rendered directly inside `<main>`. Wrap them all in a single `<div>` with `key={activeTab}` and `className="tabContent"`:

  ```tsx
  <main className="mainContent" style={{ marginRight: drawerOpen ? 360 : 0 }}>
    <div key={activeTab} className="tabContent">
      {activeTab === "today" && (
        <TodayTab
          data={data}
          activeActions={activeActions}
          snoozedActions={snoozedActions}
          loops={loops}
          focusIdx={focusIdx}
          onDone={handleDone}
          onSnooze={handleSnooze}
          onSkip={handleSkip}
          onWake={handleWake}
          onAdd={handleAdd}
          onDiscuss={openThread}
        />
      )}
      {activeTab === "loops" && (
        <LoopsTab
          loops={loops}
          onDone={handleLoopDone}
          onSnooze={handleLoopSnooze}
          onAdd={handleAdd}
          onDiscuss={openThread}
        />
      )}
      {activeTab === "projects" && (
        <ProjectGrid projects={data.projects} loops={loops} onDiscuss={openThread} />
      )}
      {activeTab === "investing" && (
        <InvestingTab investing={data.investing} onDiscuss={openThread} />
      )}
      {activeTab === "digests" && (
        <DigestsTab digests={data.digests} onDiscuss={openThread} />
      )}
    </div>
  </main>
  ```

  The `key={activeTab}` forces React to unmount and remount the div on every tab switch, which causes `.tabContent`'s `tabEnter` animation to replay.

- [ ] **Step 2: Verify**

  With `npm run dev` running, click rapidly between tabs and confirm each tab's content fades and slides in from 10px below. The animation should be ~280ms — noticeable but not sluggish.

- [ ] **Step 3: Commit**

  ```bash
  git add components/Dashboard.tsx
  git commit -m "feat: animate tab content entrance on switch"
  ```

---

## Task 4: Focus card entrance animation — FocusCard.tsx

**Files:**
- Modify: `components/FocusCard.tsx`

- [ ] **Step 1: Add `entering` state and effect**

  In `FocusCard.tsx`, the component already imports `useState`, `useRef`, and `useEffect`. Add an `entering` state and a `useEffect` that detects when `current.id` changes (meaning the card has advanced to a new item):

  Add after the existing state declarations (after line 27 `const [exiting, setExiting] = useState(false);`):

  ```tsx
  const [entering, setEntering] = useState(true);
  const prevIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (current?.id === prevIdRef.current) return;
    prevIdRef.current = current?.id;
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 320);
    return () => clearTimeout(t);
  }, [current?.id]);
  ```

  `entering` starts as `true` so the card animates in on the very first render too. The effect re-triggers whenever the shown item changes, replaying the entrance animation.

- [ ] **Step 2: Apply the class to `focusCardContent`**

  Find the div on line 75:
  ```tsx
  <div className={`focusCardContent${exiting ? " focusCardContent--exiting" : ""}`}>
  ```

  Replace with:
  ```tsx
  <div className={[
    "focusCardContent",
    exiting  ? "focusCardContent--exiting"  : "",
    entering ? "focusCardContent--entering" : "",
  ].filter(Boolean).join(" ")}>
  ```

- [ ] **Step 3: Verify**

  With `npm run dev` running:
  - Reload the page — the focus card content should fade+slide in on load
  - Click Done or Skip — the current card should exit (fade+slide down per existing animation), then the next card's content should fade+slide in
  - Confirm the entering and exiting classes never appear simultaneously (exit fires first, then state updates trigger the next render with entering)

- [ ] **Step 4: Commit**

  ```bash
  git add components/FocusCard.tsx
  git commit -m "feat: animate focus card entrance on mount and item advance"
  ```

---

## Task 5: Loop item collapse animation — LoopsTab.tsx

**Files:**
- Modify: `components/LoopsTab.tsx`

- [ ] **Step 1: Add local animation state to `LoopRow`**

  In `LoopsTab.tsx`, the `LoopRow` component (starting at line 80) handles done and snooze for each loop. Currently it calls `onDone` and `onSnooze` immediately. We need to:
  1. Track a `collapsing` state and a `pendingAction` ref
  2. On Done/Snooze click, set `collapsing = true` and store the callback
  3. On `animationEnd`, fire the stored callback

  Replace the `LoopRow` function with:

  ```tsx
  function LoopRow({ loop, snoozing, onOpenSnooze, onCloseSnooze, onDone, onSnooze, onDiscuss }: {
    loop: Loop;
    snoozing: boolean;
    onOpenSnooze: () => void;
    onCloseSnooze: () => void;
    onDone:    (id: string) => void;
    onSnooze:  (id: string, label: string) => void;
    onDiscuss: (ctx: ThreadContext) => void;
  }) {
    const snoozeRef    = useRef<HTMLDivElement>(null);
    const pendingRef   = useRef<(() => void) | null>(null);
    const [collapsing, setCollapsing] = useState(false);

    useEffect(() => {
      if (!snoozing) return;
      const handle = (e: MouseEvent) => {
        if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) onCloseSnooze();
      };
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }, [snoozing, onCloseSnooze]);

    const handleDone = () => {
      pendingRef.current = () => onDone(loop.id);
      setCollapsing(true);
    };

    const handleSnooze = (label: string) => {
      pendingRef.current = () => onSnooze(loop.id, label);
      onCloseSnooze();
      setCollapsing(true);
    };

    const handleAnimationEnd = () => {
      if (pendingRef.current) {
        pendingRef.current();
        pendingRef.current = null;
      }
    };

    return (
      <div
        className={`loopRow${collapsing ? " loopRow--collapsing" : ""}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <span className={`loopDot loopDot--${loop.priority}`} />
        <div className="loopBody">
          <div className="loopText">{loop.text}</div>
          <div className="loopProject">{loop.project}</div>
        </div>
        <div className="loopActions">
          <button className="loopActionBtn" onClick={handleDone}>✓</button>
          <div className="loopSnoozeWrap" ref={snoozeRef}>
            <button className="loopActionBtn" onClick={onOpenSnooze}>💤</button>
            {snoozing && (
              <div className="snoozePicker" style={{ right: "auto", left: 0 }}>
                <div className="snoozePickerLabel">Snooze until</div>
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className="snoozeOption"
                    onClick={() => handleSnooze(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
                <button className="snoozeOption" onClick={onCloseSnooze}>Cancel</button>
              </div>
            )}
          </div>
          <button
            className="loopActionBtn"
            onClick={() => onDiscuss({ id: loop.id, type: "loop", title: loop.text, project: loop.project, priority: loop.priority })}
          >
            α Discuss
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify**

  With `npm run dev` running, go to the Open Loops tab:
  - Click ✓ on any loop — the row should smoothly collapse (fade out + shrink to zero height over 300ms) before disappearing and reappearing in the Done section
  - Click 💤 and pick a snooze option — same collapse before moving to the Snoozed section
  - Confirm no jank or flash — the row should disappear cleanly without jumping other rows

- [ ] **Step 3: Commit**

  ```bash
  git add components/LoopsTab.tsx
  git commit -m "feat: animate loop row collapse on done and snooze"
  ```

---

## Task 6: Final verification pass

- [ ] **Step 1: Full walkthrough**

  With `npm run dev` running, walk through every interaction:

  | Interaction | Expected |
  |---|---|
  | Resize browser 1280px → 2200px | Layout, type, and spacing grow proportionally |
  | Switch tabs | Content fades + slides up (280ms) |
  | Page load | Focus card content fades + slides up |
  | Click Done on focus card | Card content exits (existing), next card enters (new) |
  | Click Skip | Same exit + enter |
  | Click Snooze → pick option | Card exits; snooze picker appears with scale pop |
  | Click Snooze button only | Picker appears with scale-in pop |
  | Mark loop done (Loops tab) | Row collapses, reappears in Done section |
  | Snooze a loop | Row collapses, reappears in Snoozed section |
  | Hover project cards | Cards lift 3px with shadow |
  | Press Done / Skip / Snooze buttons | Subtle scale-down on press |
  | Hover α Discuss buttons | Smooth bg + border + color transition |

- [ ] **Step 2: Check mobile responsiveness**

  Resize to ≤640px (or use browser DevTools mobile emulation). Confirm:
  - `clamp()` values hit their minimums gracefully
  - Animations still play correctly on touch
  - No layout breaks

- [ ] **Step 3: Push and update PR**

  ```bash
  git push
  ```

  The PR at https://github.com/alphalpha-labs/alphalpha-dashboard/pull/1 will update automatically.

# Alphalpha Dashboard v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Alphalpha dashboard from a static dark-mode scrolling page into a warm-parchment, focus-first interface with tab navigation, focus cards, and a universal α thread drawer wired to stub API routes ready for OpenClaw integration.

**Architecture:** `app/page.tsx` (server component) loads `lib/generated-data.json` and passes `DashboardData` to `components/Dashboard.tsx` (`"use client"`), which owns all UI state and renders the masthead, active tab, thread drawer, and status bar. Twelve focused component files handle distinct UI regions. Two stub API routes (`/api/signal`, `/api/thread`) accept real OpenClaw wiring later via `// OPENCLAW:` comments.

**Tech Stack:** Next.js 15, React 19, TypeScript, plain CSS (`app/globals.css`), Google Fonts via `<link>` CDN tags.

**Design fidelity:** Before implementing any component, serve the prototype locally:
```bash
cd docs/design_handoff
cat > tweaks-panel.jsx << 'EOF'
function useTweaks(d){const[v,s]=React.useState(d);return[v,(k,val)=>s(p=>({...p,[k]:val}))]}
function TweaksPanel(){return null}
function TweakSection(){return null}
function TweakRadio(){return null}
EOF
python3 -m http.server 8765
# open http://localhost:8765/Alphalpha%20Dashboard%20v3.html
```
Cross-reference `docs/design_handoff/README.md` for exact token values. Use browser DevTools to inspect rendered CSS when in doubt.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/data.ts` | Modify | DashboardData v3 TypeScript types |
| `openclaw.config.json` | Create | OpenClaw-managed project names |
| `scripts/generate-dashboard-data.mjs` | Modify | Emit new schema + ocOwned + ids |
| `scripts/generate-dashboard-data.test.mjs` | Create | Verify output shape |
| `app/layout.tsx` | Modify | Google Fonts `<link>` tags |
| `app/globals.css` | Replace | Full warm-parchment design system |
| `app/page.tsx` | Replace | Server component → pass data to Dashboard |
| `app/api/signal/route.ts` | Create | Stub action signal handler |
| `app/api/thread/route.ts` | Create | Stub thread response handler |
| `components/Dashboard.tsx` | Create | Root client component, all state, masthead |
| `components/StatusBar.tsx` | Create | Desktop footer with live counts |
| `components/TodayTab.tsx` | Create | Two-column Today layout |
| `components/FocusCard.tsx` | Create | Focus stage, progress dots, actions, snooze |
| `components/ContextColumn.tsx` | Create | Right panel: posture + collapsibles |
| `components/QuickAdd.tsx` | Create | Inline loop capture |
| `components/LoopsTab.tsx` | Create | Full loop list with hover actions |
| `components/ProjectGrid.tsx` | Create | Project card grid with ocOwned badges |
| `components/InvestingTab.tsx` | Create | Ticker list with hover discuss |
| `components/DigestsTab.tsx` | Create | Digest list with tags |
| `components/ThreadDrawer.tsx` | Create | Sliding AI thread panel |

---

## Task 1: Update TypeScript types in lib/data.ts

**Files:**
- Modify: `lib/data.ts`

- [ ] **Replace the entire file with the v3 schema:**

```ts
export type Priority   = "HIGH" | "MEDIUM" | "LOW";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type Action = {
  id:          string;
  priority:    Priority;
  title:       string;
  context:     string;
  next:        string;
  project:     string;
  due:         string;
  done:        boolean;
  snoozed:     boolean;
  snoozeLabel: string | null;
};

export type Loop = {
  id:          string;
  text:        string;
  project:     string;
  priority:    Priority;
  done?:       boolean;
  snoozed?:    boolean;
  snoozeLabel?: string | null;
};

export type Project = {
  id:           string;
  name:         string;
  status:       "ACTIVE" | "SNOOZED";
  category:     string;
  lastActivity: string;
  summary:      string;
  ocOwned:      boolean;
  loops?:       Loop[];
  highPriCount?: number;
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
    openLoops:        number;
    activeProjects:   number;
    highPriority:     number;
    uncertainties:    number;
    investingSignals: number;
  };
  topActions: Action[];
  openLoops:  Loop[];
  projects:   Project[];
  investing:  Ticker[];
  digests:    Digest[];
};

import generated from "./generated-data.json";
export const dashboardData = generated as DashboardData;
```

- [ ] **Commit:**
```bash
git add lib/data.ts
git commit -m "feat: update DashboardData types to v3 schema"
```

---

## Task 2: Create openclaw.config.json and POSTURE.md

**Files:**
- Create: `openclaw.config.json`
- Create: `../context/POSTURE.md` (relative to repo root, in context dir)

- [ ] **Create `openclaw.config.json` at repo root:**

```json
{
  "managedProjects": [
    "Alphalpha",
    "OpenClaw migration and orchestration",
    "Obsidian / GitHub-backed personal knowledge system"
  ]
}
```

- [ ] **Create the POSTURE.md in the context directory** (path: `../context/POSTURE.md` relative to repo root, or wherever `ALPHALPHA_CONTEXT_DIR` points). If the context directory doesn't exist yet, create it:
```bash
mkdir -p ../context
cat > ../context/POSTURE.md << 'EOF'
Build the dashboard, then connect live sources.

Phase 1 is intentionally file-backed and readable. Phase 2 can pull Obsidian, GitHub, cron, and Thesis Baskets data directly.
EOF
```

- [ ] **Commit:**
```bash
git add openclaw.config.json
git commit -m "feat: add openclaw.config.json with managed project names"
```

---

## Task 3: Update generate-dashboard-data.mjs to emit v3 schema

**Files:**
- Modify: `scripts/generate-dashboard-data.mjs`

- [ ] **Replace the entire file:**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, 'lib', 'generated-data.json');
const contextRoot = process.env.ALPHALPHA_CONTEXT_DIR
  ? path.resolve(process.env.ALPHALPHA_CONTEXT_DIR)
  : path.resolve(repoRoot, '..', 'context');

function read(rel) {
  const p = path.join(contextRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}
function mtime(rel) {
  const p = path.join(contextRoot, rel);
  return fs.existsSync(p) ? fs.statSync(p).mtime.toISOString() : null;
}
function readOcConfig() {
  const p = path.join(repoRoot, 'openclaw.config.json');
  if (!fs.existsSync(p)) return { managedProjects: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { managedProjects: [] }; }
}
function stripMarkdown(line) {
  return line
    .replace(/^#+\s*/, '').replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')
    .replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}
function firstSentence(text, fallback = '') {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] || cleaned).slice(0, 220);
}
function lines(md) { return md.split(/\r?\n/).map(l => l.trimEnd()); }
function extractSection(md, heading) {
  const all = lines(md);
  const start = all.findIndex(l => l.trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return '';
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const end = all.findIndex((l, i) => i > start && /^#+\s+/.test(l) && (l.match(/^#+/)?.[0].length ?? 99) <= level);
  return all.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
function extractBullets(md, { checkedOnly = false } = {}) {
  return lines(md)
    .filter(l => checkedOnly ? /^- \[ \]\s+/.test(l.trim()) : /^-\s+/.test(l.trim()))
    .map(l => stripMarkdown(l.replace(/^- \[ \]\s+/, '- ')))
    .filter(Boolean);
}
function priorityFor(text) {
  const lower = text.toLowerCase();
  if (/(urgent|fix|blocked|credential|source-of-truth|approval policy)/.test(lower)) return 'HIGH';
  if (/(high)/.test(lower)) return 'HIGH';
  return 'MEDIUM';
}
function nextActionFor(item) {
  const lower = item.toLowerCase();
  if (lower.includes('source-of-truth')) return 'Pick canonical source model and encode it in MEMORY_PROTOCOL.';
  if (lower.includes('dashboard')) return 'Read context markdown and emit dashboard JSON before build.';
  if (lower.includes('approval')) return 'Define which actions require explicit approval.';
  if (lower.includes('working copy')) return 'Create one reliable iOS capture → commit → push path.';
  if (lower.includes('voice')) return 'Prototype minimum viable dictated note append flow.';
  if (lower.includes('invest')) return 'Create structured watchlist/thesis file with triggers and invalidations.';
  return 'Review, clarify owner, and move into the right project file.';
}
function parsePosture(postureMd) {
  if (!postureMd) return {
    posture: 'Build the dashboard, then connect live sources.',
    postureDetail: 'Phase 1 is intentionally file-backed and readable. Phase 2 can pull Obsidian, GitHub, cron, and Thesis Baskets data directly.',
  };
  const all = lines(postureMd).filter(l => l.trim());
  const posture = stripMarkdown(all[0] || '');
  const postureDetail = all.slice(1).map(l => stripMarkdown(l)).filter(Boolean).join(' ');
  return { posture, postureDetail: postureDetail || posture };
}
function parseOpenLoops(openLoopsMd) {
  const allLoops = extractBullets(openLoopsMd, { checkedOnly: true });
  return allLoops.slice(0, 12).map((item, idx) => ({
    id: `l${idx + 1}`,
    text: item.replace(/\s+_Status:.*$/, '').trim(),
    project: item.toLowerCase().includes('invest') ? 'Investing'
      : item.toLowerCase().includes('obsidian') || item.toLowerCase().includes('working copy') ? 'Obsidian/GitHub'
      : item.toLowerCase().includes('openclaw') ? 'OpenClaw'
      : item.toLowerCase().includes('austin') ? 'Austin events'
      : 'Alphalpha',
    priority: priorityFor(item),
  }));
}
function domainFor(name) {
  const lower = name.toLowerCase();
  if (lower.includes('invest') || lower.includes('etf')) return 'Investing';
  if (lower.includes('obsidian')) return 'Knowledge management';
  if (lower.includes('openclaw')) return 'Orchestration';
  if (lower.includes('austin')) return 'Local events';
  return 'Personal AI chief of staff';
}
function parseProjects(projectsMd, allLoops, ocConfig) {
  const all = lines(projectsMd);
  const starts = [];
  all.forEach((line, idx) => { if (/^##\s+\d+\.\s+/.test(line)) starts.push(idx); });
  return starts.slice(0, 6).map((start, idx) => {
    const end = starts[idx + 1] ?? all.length;
    const block = all.slice(start, end).join('\n');
    const rawTitle = stripMarkdown(all[start]).replace(/^\d+\.\s+/, '');
    const [namePart, subtitle] = rawTitle.split(/\s+—\s+|\s+-\s+/);
    const name = namePart.trim();
    const goal = extractSection(block, '**Goal:**') || '';
    const openLoopSection = extractBullets(extractSection(block, '**Open loops:**'))[0];
    const known = extractBullets(extractSection(block, '**Known context:**'))[0];
    const summary = openLoopSection || firstSentence(goal, known || 'Review and update project context.');
    const projLoops = allLoops.filter(l => l.project === name || name.toLowerCase().includes(l.project.toLowerCase().split('/')[0]));
    const highPriCount = projLoops.filter(l => l.priority === 'HIGH').length;
    const isOcOwned = ocConfig.managedProjects.some(mp => mp.toLowerCase() === name.toLowerCase());
    return {
      id: `p${idx + 1}`,
      name,
      status: 'ACTIVE',
      category: (subtitle || domainFor(name)).trim(),
      lastActivity: idx === 0 ? 'today' : 'recent memory',
      summary,
      ocOwned: isOcOwned,
      loops: projLoops.slice(0, 2),
      highPriCount,
    };
  });
}
function parseInvesting(openLoopsMd) {
  const tickerLine = lines(openLoopsMd).find(l => l.includes('EME, FIX')) || '';
  const tickers = tickerLine.match(/[A-Z]{2,5}(?:\.[A-Z])?/g) || ['EME', 'PWR', 'BWXT', 'CIEN', 'DHR', 'KTOS'];
  const themes = {
    EME: 'Grid/data-center construction', FIX: 'Building systems + electrification',
    PWR: 'Transmission/grid hardening', BWXT: 'Nuclear services + defense nuclear',
    HWM: 'Aerospace/defense supply chain', HEI: 'Aerospace components',
    KTOS: 'Defense modernization / drones', AVAV: 'Autonomous systems / drones',
    CIEN: 'AI optical/network bandwidth', GLW: 'Glass/fiber/materials',
  };
  return tickers.slice(0, 10).map(ticker => ({
    ticker,
    theme: themes[ticker] || 'Research candidate',
    stance: /^(PWR|BWXT|EME)$/.test(ticker) ? 'High-priority research' : 'Research first',
    confidence: /^(PWR|BWXT|EME)$/.test(ticker) ? 'HIGH' : 'MEDIUM',
  }));
}
function fileDigest(id, title, source, rel, summary, tags) {
  const stamp = mtime(rel);
  return {
    id,
    date: (stamp || new Date().toISOString()).slice(0, 10),
    category: source,
    title,
    summary,
    tags,
  };
}
function buildData() {
  const postureMd   = read('POSTURE.md');
  const projectsMd  = read('PROJECTS.md');
  const openLoopsMd = read('OPEN_LOOPS.md');
  const about       = read('ABOUT.md');
  const decisions   = read('DECISIONS.md');
  const protocol    = read('MEMORY_PROTOCOL.md');
  const ocConfig    = readOcConfig();

  if (!projectsMd || !openLoopsMd) {
    if (fs.existsSync(outputPath)) {
      console.log(`Context not found at ${contextRoot}; keeping existing generated-data.json.`);
      return null;
    }
    throw new Error(`Missing context files at ${contextRoot} and no generated data exists.`);
  }

  const { posture, postureDetail } = parsePosture(postureMd);
  const openLoops = parseOpenLoops(openLoopsMd);
  const projects  = parseProjects(projectsMd, openLoops, ocConfig);
  const checked   = extractBullets(openLoopsMd, { checkedOnly: true });
  const highPri   = checked.filter(item => priorityFor(item) === 'HIGH');
  const uncertain = extractBullets(read('UNCERTAINTIES.md')).length;

  const topActions = openLoops.slice(0, 7).map((loop, idx) => ({
    id: `a${idx + 1}`,
    priority: loop.priority,
    title: loop.text,
    context: `Imported from ${loop.priority === 'HIGH' ? 'near-term' : 'backlog'} Alphalpha open loops.`,
    next: nextActionFor(loop.text),
    project: loop.project,
    due: loop.priority === 'HIGH' ? 'This week' : 'Later',
    done: false,
    snoozed: false,
    snoozeLabel: null,
  }));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      posture,
      postureDetail,
    },
    stats: {
      openLoops:        checked.length,
      activeProjects:   projects.length,
      highPriority:     highPri.length,
      uncertainties:    uncertain,
      investingSignals: parseInvesting(openLoopsMd).length,
    },
    topActions,
    openLoops,
    projects,
    investing: parseInvesting(openLoopsMd),
    digests: [
      fileDigest('d1', 'ChatGPT brain dump converted to canonical context', 'Context import', 'imports/2026-05-01-chatgpt-braindump.md', 'Raw import preserved and split into durable Alphalpha files.', ['#memory', '#context', '#import']),
      fileDigest('d2', 'About + preference context available', 'About/Preferences', 'ABOUT.md', firstSentence(extractSection(about, '## Stable context')) || 'Stable personal context and preferences available.', ['#about', '#preferences']),
      fileDigest('d3', 'Project registry and open loops are now source files', 'Projects/Open loops', 'PROJECTS.md', `Dashboard generated from ${projects.length} project entries and ${checked.length} open loops.`, ['#projects', '#open-loops']),
      fileDigest('d4', 'Memory protocol drafted', 'Memory protocol', 'MEMORY_PROTOCOL.md', firstSentence(extractSection(protocol, '## Goal')) || 'Protocol separates imports, durable context, daily memory, and dashboard-facing open loops.', ['#memory', '#protocol']),
      fileDigest('d5', 'Durable decisions captured', 'Decisions', 'DECISIONS.md', firstSentence(extractSection(decisions, '## Personal AI / knowledge system')) || 'Key architecture decisions captured for Alphalpha and OpenClaw.', ['#decisions', '#architecture']),
    ],
  };
}

const data = buildData();
if (data) {
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${contextRoot}`);
}
```

- [ ] **Commit:**
```bash
git add scripts/generate-dashboard-data.mjs
git commit -m "feat: update generate script to emit v3 schema with ocOwned and ids"
```

---

## Task 4: Write and run generate script test

**Files:**
- Create: `scripts/generate-dashboard-data.test.mjs`

- [ ] **Create the test file:**

```js
#!/usr/bin/env node
// Run: node scripts/generate-dashboard-data.test.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

execSync('node scripts/generate-dashboard-data.mjs', { stdio: 'inherit' });
const data = JSON.parse(readFileSync('lib/generated-data.json', 'utf8'));

assert.ok(typeof data.meta?.generatedAt === 'string',  'meta.generatedAt missing');
assert.ok(typeof data.meta?.posture === 'string',       'meta.posture missing');
assert.ok(typeof data.stats?.openLoops === 'number',    'stats.openLoops missing');
assert.ok(typeof data.stats?.highPriority === 'number', 'stats.highPriority missing');
assert.ok(Array.isArray(data.topActions),               'topActions missing');
assert.ok(Array.isArray(data.openLoops),                'openLoops missing');
assert.ok(Array.isArray(data.projects),                 'projects missing');
assert.ok(Array.isArray(data.investing),                'investing missing');
assert.ok(Array.isArray(data.digests),                  'digests missing');

if (data.topActions.length > 0) {
  const a = data.topActions[0];
  assert.ok(typeof a.id === 'string',        'action.id missing');
  assert.ok(typeof a.done === 'boolean',     'action.done missing');
  assert.ok(typeof a.snoozed === 'boolean',  'action.snoozed missing');
  assert.ok(['HIGH','MEDIUM','LOW'].includes(a.priority), 'action.priority invalid');
}
if (data.openLoops.length > 0) {
  const l = data.openLoops[0];
  assert.ok(typeof l.id === 'string',  'loop.id missing');
  assert.ok(typeof l.text === 'string','loop.text missing');
}
if (data.projects.length > 0) {
  const p = data.projects[0];
  assert.ok(typeof p.id === 'string',       'project.id missing');
  assert.ok(typeof p.ocOwned === 'boolean', 'project.ocOwned missing');
  assert.ok(typeof p.summary === 'string',  'project.summary missing');
}
if (data.digests.length > 0) {
  const d = data.digests[0];
  assert.ok(typeof d.id === 'string',       'digest.id missing');
  assert.ok(typeof d.category === 'string', 'digest.category missing');
}
if (data.investing.length > 0) {
  assert.ok(['HIGH','MEDIUM','LOW'].includes(data.investing[0].confidence), 'ticker.confidence invalid');
}

console.log('✓ All assertions passed');
```

- [ ] **Run the test:**
```bash
node scripts/generate-dashboard-data.test.mjs
```
Expected output:
```
Generated lib/generated-data.json from .../context
✓ All assertions passed
```

- [ ] **Commit:**
```bash
git add scripts/generate-dashboard-data.test.mjs lib/generated-data.json
git commit -m "feat: add generate script test; regenerate data with v3 schema"
```

---

## Task 5: Update app/layout.tsx with Google Fonts

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Replace the file:**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alphalpha · Chief of Staff",
  description: "Focus-first command center for decisions, open loops, projects, investing, and digests.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Commit:**
```bash
git add app/layout.tsx
git commit -m "feat: add Google Fonts (Playfair Display, Lora, DM Sans)"
```

---

## Task 6: Replace globals.css with warm-parchment design system

**Files:**
- Replace: `app/globals.css`

- [ ] **Replace the entire file** (cross-reference `docs/design_handoff/README.md` §Design Tokens for exact values):

```css
/* 1. Fonts */
/* Loaded via <link> in layout.tsx */

/* 2. Design tokens */
:root {
  --bg:             #f4efe4;
  --bg-side:        #ede8db;
  --card:           #faf6ee;
  --card-hover:     #fff8f0;
  --ink:            #1c1714;
  --ink-2:          #2c2418;
  --ink-muted:      #7a6f62;
  --ink-faint:      #b0a080;
  --accent-high:    #a84030;
  --accent-med:     #8a6a3a;
  --accent-low:     #5a7a5a;
  --accent-link:    #9a6a3a;
  --border:         #d8cebb;
  --border-strong:  #c8bc9e;
  --border-faint:   #e8e0d0;
  --dark-fill:      #1c1814;
  --dark-fill-text: #f4efe4;
  --status-active-bg:    #e8f0e4;
  --status-active-text:  #3a6a3a;
  --status-snoozed-bg:   #e8e0d0;
  --status-snoozed-text: #7a6a5a;
  --radius-card: 12px;
  --radius-btn:  9px;
  --radius-sm:   6px;
  --radius-pill: 99px;
  --shadow-drawer: 0 -8px 32px rgba(28,24,20,0.12);
  --shadow-picker: 0 4px 24px rgba(28,24,20,0.14);
}

/* 3. Reset + base */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Lora', Georgia, serif;
  overflow: hidden;
}
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; border: none; background: none; padding: 0; }
input { font-family: inherit; }

/* 4. App shell */
.appShell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* 5. Masthead */
.masthead {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 32px; height: 52px; flex-shrink: 0;
  border-bottom: 1.5px solid var(--ink);
  background: var(--bg); gap: 20px;
}
.mastheadLogo { display: flex; align-items: baseline; gap: 8px; flex-shrink: 0; }
.mastheadWordmark {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700; font-size: 20px; color: var(--ink); letter-spacing: -0.02em;
}
.mastheadSub {
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600;
  color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.12em;
}
.tabNav { display: flex; }
.tabBtn {
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 400;
  color: var(--ink-muted); padding: 0 16px; height: 52px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.tabBtn--active { color: var(--ink); font-weight: 500; border-bottom-color: var(--ink); }
.tabBtn:hover:not(.tabBtn--active) { color: var(--ink-2); }
.mastheadDate { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--ink-faint); flex-shrink: 0; }

/* 6. Main content wrapper */
.mainContent { flex: 1; overflow-y: auto; transition: margin-right 0.28s ease; }

/* 7. Shared alpha discuss button */
.btnAlphaDiscuss {
  background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
  font-family: 'DM Sans', sans-serif; font-size: 11px; padding: 5px 10px;
  border-radius: var(--radius-sm); display: inline-flex; align-items: center;
  gap: 4px; white-space: nowrap; cursor: pointer;
}
.btnAlphaDiscuss:hover { background: var(--card-hover); border-color: var(--border-strong); }
.alphaGlyph { font-family: 'Playfair Display', Georgia, serif; font-size: 12px; }

/* 8. Today tab layout */
.todayLayout { display: flex; height: calc(100vh - 52px - 36px); }
.focusStage {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 40px 60px; min-height: 0; overflow-y: auto;
}
.contextColumn {
  width: 300px; flex-shrink: 0; background: var(--bg-side);
  border-left: 1px solid var(--border); padding: 22px 20px; overflow-y: auto;
}

/* 9. Focus card */
.progressDots { display: flex; gap: 6px; align-items: center; margin-bottom: 32px; }
.dot { height: 6px; border-radius: 3px; background: var(--border-faint); transition: width 0.3s ease, background 0.3s ease; width: 6px; }
.dot--active { width: 22px; background: var(--dark-fill); }
.dot--done { background: var(--border-strong); }

.focusCardContent { display: contents; }
.focusCardContent--exiting > * {
  opacity: 0; transform: translateY(8px);
  transition: opacity 260ms ease, transform 260ms ease;
}

.priorityTag {
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.13em; margin-bottom: 16px;
  display: flex; align-items: center; gap: 6px;
}
.priorityTag--high { color: var(--accent-high); }
.priorityTag--med  { color: var(--accent-med); }
.priorityTag--low  { color: var(--accent-low); }
.priorityDot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.focusTitle {
  font-family: 'Playfair Display', Georgia, serif; font-size: 28px;
  line-height: 1.3; color: var(--ink); text-align: center;
  max-width: 500px; margin: 0 0 14px;
}
.focusNext {
  font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 13px;
  color: #8a7f6a; text-align: center; max-width: 400px; margin: 0 0 28px;
}
.focusActions { display: flex; gap: 10px; align-items: center; }
.btnDone {
  background: var(--dark-fill); color: var(--dark-fill-text);
  font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
  padding: 11px 26px; border-radius: var(--radius-btn); cursor: pointer;
}
.btnOutlined {
  background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
  font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 11px 26px;
  border-radius: var(--radius-btn); position: relative; cursor: pointer;
}
.btnDiscuss {
  background: transparent; border: 1px solid var(--border); color: var(--ink-muted);
  font-family: 'DM Sans', sans-serif; font-size: 12px; padding: 8px 16px;
  border-radius: var(--radius-btn); margin-top: 22px; cursor: pointer;
}
.focusRemaining { font-family: 'DM Sans', sans-serif; font-size: 11px; color: #c0b49a; margin-top: 18px; }

/* 10. Snooze picker */
.snoozePicker {
  position: absolute; top: calc(100% + 4px); right: 0;
  background: var(--card); border: 1px solid var(--border); border-radius: 10px;
  padding: 6px 4px; box-shadow: var(--shadow-picker); z-index: 100; min-width: 190px;
}
.snoozePickerLabel {
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint);
  padding: 4px 12px 2px;
}
.snoozeOption {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; font-family: 'DM Sans', sans-serif; font-size: 12px;
  color: var(--ink-2); border-radius: 6px; width: 100%; text-align: left; cursor: pointer;
}
.snoozeOption:hover { background: var(--bg-side); }
.snoozeHrs { color: var(--ink-faint); font-size: 11px; }

/* 11. Snoozed strip */
.snoozedStrip {
  border-top: 1px solid var(--border); background: var(--bg-side);
  padding: 8px 60px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.snoozedStripLabel {
  font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint);
}
.snoozedChip {
  display: flex; align-items: center; gap: 4px; background: var(--status-snoozed-bg);
  border-radius: 6px; padding: 3px 8px; font-family: 'DM Sans', sans-serif;
  font-size: 11px; color: var(--ink-muted);
}
.snoozedWake { margin-left: 4px; color: var(--ink-faint); font-size: 14px; line-height: 1; cursor: pointer; }
.snoozedWake:hover { color: var(--ink); }

/* 12. Context column */
.postureBlock { border-bottom: 1px solid var(--border); margin-bottom: 18px; padding-bottom: 18px; }
.postureLabel {
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-faint); margin: 0 0 8px;
}
.postureQuote {
  font-family: 'Playfair Display', Georgia, serif; font-style: italic;
  font-size: 14px; color: var(--ink); line-height: 1.4; margin: 0 0 8px;
}
.postureBody { font-family: 'Lora', Georgia, serif; font-size: 12px; color: var(--ink-muted); line-height: 1.6; margin: 0; }

.collapsibleHeader {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; cursor: pointer; user-select: none;
}
.collapsibleTitle { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-muted); display: flex; align-items: center; gap: 8px; }
.collapsibleCount { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-faint); background: var(--border-faint); border-radius: 99px; padding: 1px 7px; }
.collapsibleChevron { color: var(--ink-faint); font-size: 12px; transition: transform 0.2s; flex-shrink: 0; }
.collapsibleChevron--closed { transform: rotate(-90deg); }

.ctxLoopItem { padding: 6px 0; border-bottom: 1px solid var(--border-faint); }
.ctxLoopText { font-family: 'Lora', Georgia, serif; font-size: 12px; color: var(--ink-2); line-height: 1.4; cursor: pointer; }
.ctxLoopText:hover { color: var(--accent-link); }
.ctxLoopProject { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-faint); }
.ctxViewAll { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--accent-link); margin-top: 8px; display: block; }

/* 13. Quick add */
.quickAddBtn {
  width: 100%; text-align: left; padding: 8px 10px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif; font-size: 12px;
  color: var(--accent-link); margin-bottom: 12px; cursor: pointer; background: transparent;
}
.quickAddExpanded {
  display: flex; gap: 6px; margin-bottom: 12px; border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); background: var(--card-hover); padding: 6px 8px; align-items: center;
}
.quickAddInput {
  flex: 1; border: none; background: none; font-family: 'Lora', Georgia, serif;
  font-size: 13px; color: var(--ink); outline: none;
}
.quickAddInput::placeholder { color: var(--ink-faint); }
.quickAddSave {
  background: var(--dark-fill); color: var(--dark-fill-text);
  font-family: 'DM Sans', sans-serif; font-size: 11px; padding: 4px 10px; border-radius: 5px; cursor: pointer;
}

/* 14. Tab pages (shared layout) */
.tabPage { max-width: 720px; margin: 0 auto; padding: 32px 32px 64px; }
.tabPageWide { padding: 32px 32px 64px; }
.tabTitle { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; color: var(--ink); margin: 0 0 4px; }
.tabSubtitle { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 14px; color: var(--ink-muted); margin: 0 0 24px; }

/* 15. Loops tab */
.loopRow {
  display: flex; align-items: flex-start; gap: 10px; padding: 11px 0;
  border-bottom: 1px solid var(--border-faint); position: relative;
}
.loopDot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.loopDot--HIGH   { background: var(--accent-high); }
.loopDot--MEDIUM { background: var(--accent-med); }
.loopDot--LOW    { background: var(--accent-low); }
.loopBody { flex: 1; min-width: 0; }
.loopText { font-family: 'Lora', Georgia, serif; font-size: 13px; color: var(--ink-2); line-height: 1.45; }
.loopProject { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-faint); margin-top: 2px; }
.loopActions { display: flex; gap: 4px; opacity: 0; pointer-events: none; transition: opacity 0.15s; flex-shrink: 0; }
.loopRow:hover .loopActions { opacity: 1; pointer-events: auto; }
.loopActionBtn {
  padding: 3px 8px; border: 1px solid var(--border); border-radius: 5px;
  font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--ink-muted);
  background: var(--card); cursor: pointer;
}
.loopRow--done .loopText { text-decoration: line-through; opacity: 0.35; }
.loopRow--snoozed .loopText { font-style: italic; opacity: 0.5; }
.loopSnoozeWrap { position: relative; }

/* 16. Projects tab */
.projectLegend { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--ink-muted); margin-bottom: 16px; }
.projectGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.projectCard {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card);
  padding: 18px 20px; display: flex; flex-direction: column;
}
.projectCardTop { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.projectCategory { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-faint); }
.projectBadges { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.badgeOC {
  background: rgba(28,24,20,0.08); color: #5a5040;
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  border-radius: var(--radius-pill); padding: 2px 7px; display: flex; align-items: center; gap: 2px;
}
.badgeStatus {
  font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600;
  text-transform: uppercase; border-radius: var(--radius-pill); padding: 2px 7px;
}
.badgeStatus--ACTIVE  { background: var(--status-active-bg); color: var(--status-active-text); }
.badgeStatus--SNOOZED { background: var(--status-snoozed-bg); color: var(--status-snoozed-text); }
.projectName { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: var(--ink); line-height: 1.25; margin: 8px 0 4px; }
.projectSummary { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 12px; color: var(--ink-muted); line-height: 1.5; margin: 0 0 8px; }
.projectMeta { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-faint); display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.projectHighPri { color: var(--accent-high); display: flex; align-items: center; gap: 3px; }
.projectLoops { border-top: 1px solid var(--border-faint); padding-top: 8px; display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
.projectLoop { display: flex; gap: 6px; align-items: flex-start; font-family: 'Lora', Georgia, serif; font-size: 12px; color: var(--ink-muted); }
.projectLoopDot { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-faint); flex-shrink: 0; margin-top: 4px; }
.projectDiscuss { margin-top: auto; align-self: flex-end; }

/* 17. Investing tab */
.investingPage { max-width: 800px; margin: 0 auto; padding: 32px 32px 64px; }
.tickerRow { display: flex; align-items: center; padding: 10px 8px; border-bottom: 1px solid var(--border-faint); position: relative; border-radius: 6px; }
.tickerRow:hover { background: var(--card-hover); }
.tickerSymbol { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 600; color: var(--ink-2); width: 52px; flex-shrink: 0; }
.tickerTheme { font-family: 'Lora', Georgia, serif; font-size: 12px; color: #5a5040; flex: 1; }
.tickerStance { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--ink-muted); width: 160px; flex-shrink: 0; }
.tickerConf { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; width: 56px; flex-shrink: 0; }
.tickerConf--HIGH   { color: var(--accent-high); }
.tickerConf--MEDIUM { color: var(--accent-med); }
.tickerDiscuss { opacity: 0; pointer-events: none; transition: opacity 0.15s; }
.tickerRow:hover .tickerDiscuss { opacity: 1; pointer-events: auto; }

/* 18. Digests tab */
.digestItem { border-bottom: 1px solid var(--border-faint); padding: 14px 0; }
.digestTop { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.digestCategory { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-link); }
.digestDate { font-family: 'DM Sans', sans-serif; font-size: 10px; color: #c0b49a; }
.digestTitle { font-family: 'Lora', Georgia, serif; font-size: 13px; font-weight: 600; color: var(--ink-2); margin: 0 0 4px; }
.digestSummary { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 12px; color: var(--ink-muted); line-height: 1.5; margin: 0 0 8px; }
.digestTags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.digestTag { font-family: 'DM Sans', sans-serif; font-size: 10px; color: #8a7f6a; background: #f0ebe0; border-radius: 4px; padding: 2px 6px; }

/* 19. Thread drawer */
.threadDrawer {
  position: fixed; right: 0; top: 0; bottom: 0; width: 360px;
  background: var(--card); border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  transform: translateX(100%); transition: transform 0.28s ease; z-index: 200;
}
.threadDrawer--open { transform: translateX(0); }
.threadHeader {
  padding: 14px 18px; border-bottom: 1px solid var(--border-faint);
  background: var(--bg); display: flex; align-items: flex-start; gap: 10px; flex-shrink: 0;
}
.threadAvatar {
  width: 24px; height: 24px; border-radius: 50%; background: var(--dark-fill);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', Georgia, serif; font-size: 12px;
  color: var(--dark-fill-text); flex-shrink: 0;
}
.threadMeta { flex: 1; min-width: 0; }
.threadType { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); }
.threadItemTitle { font-family: 'Playfair Display', Georgia, serif; font-size: 13px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.threadProject { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--ink-muted); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
.threadClose { color: var(--ink-muted); font-size: 20px; line-height: 1; flex-shrink: 0; padding: 0 2px; cursor: pointer; }
.threadClose:hover { color: var(--ink); }
.threadMessages { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.threadMsgRow { display: flex; gap: 8px; align-items: flex-start; }
.threadMsgRow--user { flex-direction: row-reverse; }
.threadAvatarSm {
  width: 22px; height: 22px; border-radius: 50%; background: var(--dark-fill);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', Georgia, serif; font-size: 11px;
  color: var(--dark-fill-text); flex-shrink: 0; margin-top: 2px;
}
.threadBubble { padding: 9px 12px; font-family: 'Lora', Georgia, serif; font-size: 13px; line-height: 1.55; max-width: 260px; }
.threadMsgRow--assistant .threadBubble { background: var(--bg-side); color: var(--ink-2); border-radius: 11px 11px 11px 3px; }
.threadMsgRow--user .threadBubble { background: var(--dark-fill); color: var(--dark-fill-text); border-radius: 11px 11px 3px 11px; }
.threadLoading { letter-spacing: 0.2em; opacity: 0.6; }
.threadInputRow {
  padding: 10px 14px 16px; border-top: 1px solid var(--border-faint);
  background: var(--bg); display: flex; gap: 8px; align-items: center; flex-shrink: 0;
}
.threadInput {
  flex: 1; background: var(--card-hover); border: 1px solid var(--border);
  border-radius: var(--radius-btn); padding: 9px 14px;
  font-family: 'Lora', Georgia, serif; font-size: 13px; color: var(--ink); outline: none;
}
.threadInput::placeholder { color: var(--ink-faint); }
.threadSend {
  background: var(--dark-fill); color: var(--dark-fill-text);
  border-radius: var(--radius-btn); padding: 9px 12px; font-size: 15px; line-height: 1; cursor: pointer;
}

/* 20. Status bar */
.statusBar {
  height: 36px; border-top: 1px solid var(--border); background: var(--bg-side);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 32px; font-family: 'DM Sans', sans-serif; font-size: 11px;
  color: var(--ink-muted); flex-shrink: 0; transition: margin-right 0.28s ease;
}
.statusHighPri { color: var(--accent-high); }
.statusGenerated { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 11px; color: var(--ink-faint); }

/* 21. Responsive ≤640px */
@media (max-width: 640px) {
  body { overflow: auto; }
  .appShell { height: auto; overflow: visible; }
  .masthead { flex-wrap: wrap; height: auto; padding: 10px 16px 0; gap: 6px; }
  .mastheadDate { order: -1; }
  .tabNav { overflow-x: auto; width: 100%; }
  .mainContent { margin-right: 0 !important; }
  .todayLayout { flex-direction: column; height: auto; }
  .focusStage { padding: 28px 20px; min-height: 70vh; }
  .focusTitle { font-size: 22px; }
  .contextColumn { width: 100%; border-left: none; border-top: 1px solid var(--border); }
  .statusBar { display: none; }
  .threadDrawer {
    top: auto; width: auto; height: 65vh; border-radius: 14px 14px 0 0;
    box-shadow: var(--shadow-drawer); border-left: none;
    transform: translateY(100%);
  }
  .threadDrawer--open { transform: translateY(0); }
  .tabPage, .investingPage, .tabPageWide { padding: 20px 16px 48px; }
  .snoozedStrip { padding: 8px 20px; }
  .loopActions { opacity: 1; pointer-events: auto; }
  .tickerDiscuss { opacity: 1; pointer-events: auto; }
  .tickerStance { display: none; }
}
```

- [ ] **Commit:**
```bash
git add app/globals.css
git commit -m "feat: replace globals.css with warm-parchment design system"
```

---

## Task 7: Update app/page.tsx to server component shell

**Files:**
- Replace: `app/page.tsx`

- [ ] **Replace the entire file:**

```tsx
import { dashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return <Dashboard data={dashboardData} />;
}
```

- [ ] **Commit:**
```bash
git add app/page.tsx
git commit -m "feat: convert page.tsx to thin server shell passing data to Dashboard"
```

---

## Task 8: Create app/api/signal/route.ts stub

**Files:**
- Create: `app/api/signal/route.ts`

- [ ] **Create the file:**

```ts
import { NextRequest, NextResponse } from "next/server";

// OPENCLAW: Wire up bidirectional communication here.
//
// This route receives action signals from the dashboard and should:
//   1. Authenticate: check Authorization header against OPENCLAW_API_KEY env var
//   2. Forward payload to OpenClaw's signal endpoint:
//      POST ${process.env.OPENCLAW_URL}/signal  with the action payload
//   3. OpenClaw updates the relevant context file:
//      - "done" / "snooze" / "skip" / "wake" → update OPEN_LOOPS.md or PROJECTS.md
//      - "add-loop" → prepend new item to OPEN_LOOPS.md
//   4. Optionally trigger a GitHub push to rebuild dashboard data on Vercel
//
// Payload shape the dashboard sends:
//   { type: "done" | "snooze" | "skip" | "wake" | "add-loop", itemId: string, payload?: object }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: logs the payload and returns { ok: true } immediately.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  console.log("[signal stub]", body);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Commit:**
```bash
git add app/api/signal/route.ts
git commit -m "feat: add stub /api/signal route with OPENCLAW integration instructions"
```

---

## Task 9: Create app/api/thread/route.ts stub

**Files:**
- Create: `app/api/thread/route.ts`

- [ ] **Create the file:**

```ts
import { NextRequest, NextResponse } from "next/server";

// OPENCLAW: Wire up AI streaming here.
//
// This route receives thread messages and should:
//   1. Authenticate: check Authorization header against OPENCLAW_API_KEY env var
//   2. Forward to OpenClaw's streaming chat endpoint:
//      POST ${process.env.OPENCLAW_URL}/chat/stream  with { systemPrompt, messages }
//   3. Pipe the streaming response back to the client as a ReadableStream:
//      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } })
//
// After switching to streaming, update ThreadDrawer.tsx at the comment
// "// OPENCLAW: Switch to streaming here" to consume chunks instead of reading the full body.
//
// Request shape the dashboard sends:
//   { systemPrompt: string, messages: Array<{ role: "user" | "assistant", content: string }> }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: waits 600ms then returns a canned placeholder.

export async function POST(req: NextRequest) {
  await req.json().catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  return NextResponse.json({
    content: "I'm Alphalpha — your AI chief of staff. This thread will be powered by OpenClaw once connected. For now, I'm a placeholder.",
  });
}
```

- [ ] **Commit:**
```bash
git add app/api/thread/route.ts
git commit -m "feat: add stub /api/thread route with OPENCLAW streaming instructions"
```

---

## Task 10: Create components/Dashboard.tsx

**Files:**
- Create: `components/Dashboard.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState, useCallback } from "react";
import type { DashboardData, Action, Loop, ThreadContext } from "@/lib/data";
import TodayTab from "./TodayTab";
import LoopsTab from "./LoopsTab";
import ProjectGrid from "./ProjectGrid";
import InvestingTab from "./InvestingTab";
import DigestsTab from "./DigestsTab";
import ThreadDrawer from "./ThreadDrawer";
import StatusBar from "./StatusBar";

export type ThreadContext = {
  id:        string;
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

const TABS = [
  { id: "today",     label: "Today" },
  { id: "loops",     label: "Open loops" },
  { id: "projects",  label: "Projects" },
  { id: "investing", label: "Investing" },
  { id: "digests",   label: "Digests" },
] as const;

// OPENCLAW: This helper posts action signals to /api/signal (currently a stub).
// When OpenClaw wires up the real endpoint, no changes needed here —
// only app/api/signal/route.ts needs to be updated.
async function postSignal(type: string, itemId: string, payload?: object) {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, itemId, payload }),
  }).catch(() => {});
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<string>("today");
  const [actions, setActions]     = useState<Action[]>(data.topActions);
  const [loops, setLoops]         = useState<Loop[]>(data.openLoops);
  const [focusIdx, setFocusIdx]   = useState(0);
  const [thread, setThread]       = useState<ThreadContext | null>(null);

  const activeActions  = actions.filter(a => !a.done && !a.snoozed);
  const snoozedActions = actions.filter(a => a.snoozed);

  const handleDone = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: true } : a));
    setFocusIdx(0);
    postSignal("done", id);
  }, []);

  const handleSnooze = useCallback((id: string, label: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: true, snoozeLabel: label } : a));
    setFocusIdx(0);
    postSignal("snooze", id, { label });
  }, []);

  const handleSkip = useCallback(() => {
    setFocusIdx(i => (i + 1) % Math.max(activeActions.length, 1));
  }, [activeActions.length]);

  const handleWake = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: false, snoozeLabel: null } : a));
    postSignal("wake", id);
  }, []);

  const handleAdd = useCallback((text: string) => {
    const newLoop: Loop = { id: `l${Date.now()}`, text, project: "Inbox", priority: "MEDIUM" };
    setLoops(prev => [newLoop, ...prev]);
    postSignal("add-loop", newLoop.id, { text });
  }, []);

  const handleLoopDone = useCallback((id: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, done: true } : l));
    postSignal("done", id);
  }, []);

  const handleLoopSnooze = useCallback((id: string, label: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, snoozed: true, snoozeLabel: label } : l));
    postSignal("snooze", id, { label });
  }, []);

  const openThread  = useCallback((ctx: ThreadContext) => setThread(ctx), []);
  const closeThread = useCallback(() => setThread(null), []);

  const drawerOpen = !!thread;

  return (
    <div className="appShell">
      <header className="masthead">
        <div className="mastheadLogo">
          <span className="mastheadWordmark">Alphalpha</span>
          <span className="mastheadSub">Chief of Staff</span>
        </div>
        <nav className="tabNav" aria-label="Dashboard sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tabBtn${activeTab === tab.id ? " tabBtn--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mastheadDate" aria-hidden="true">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </header>

      <main className="mainContent" style={{ marginRight: drawerOpen ? 360 : 0 }}>
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
      </main>

      <ThreadDrawer thread={thread} onClose={closeThread} />
      <StatusBar stats={data.stats} generatedAt={data.meta.generatedAt} drawerOpen={drawerOpen} />
    </div>
  );
}
```

- [ ] **Run the dev server to confirm it compiles** (will show import errors for missing components — expected):
```bash
npm run dev 2>&1 | head -30
```

- [ ] **Commit:**
```bash
git add components/Dashboard.tsx
git commit -m "feat: add Dashboard client component with state management and masthead"
```

---

## Task 11: Create components/StatusBar.tsx

**Files:**
- Create: `components/StatusBar.tsx`

- [ ] **Create the file:**

```tsx
import type { DashboardData } from "@/lib/data";

interface Props {
  stats:       DashboardData["stats"];
  generatedAt: string;
  drawerOpen:  boolean;
}

export default function StatusBar({ stats, generatedAt, drawerOpen }: Props) {
  const date = new Date(generatedAt);
  const formatted = date.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  }) + " · " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  return (
    <footer className="statusBar" style={{ marginRight: drawerOpen ? 360 : 0 }}>
      <span>
        {stats.openLoops} open loops · {stats.activeProjects} projects ·{" "}
        {stats.highPriority > 0
          ? <span className="statusHighPri">{stats.highPriority} high priority</span>
          : <span>{stats.highPriority} high priority</span>}
      </span>
      <span className="statusGenerated">Generated {formatted}</span>
    </footer>
  );
}
```

- [ ] **Commit:**
```bash
git add components/StatusBar.tsx
git commit -m "feat: add StatusBar component"
```

---

## Task 12: Create components/QuickAdd.tsx

**Files:**
- Create: `components/QuickAdd.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  onAdd: (text: string) => void;
}

export default function QuickAdd({ onAdd }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const save = () => {
    const text = value.trim();
    if (text) { onAdd(text); }
    setValue("");
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <button className="quickAddBtn" onClick={() => setExpanded(true)}>
        + Capture a loop
      </button>
    );
  }

  return (
    <div className="quickAddExpanded">
      <input
        ref={inputRef}
        className="quickAddInput"
        placeholder="What's open?"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setValue(""); setExpanded(false); }
        }}
      />
      <button className="quickAddSave" onClick={save}>Save</button>
    </div>
  );
}
```

- [ ] **Commit:**
```bash
git add components/QuickAdd.tsx
git commit -m "feat: add QuickAdd component"
```

---

## Task 13: Create components/ContextColumn.tsx

**Files:**
- Create: `components/ContextColumn.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState } from "react";
import type { DashboardData, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import QuickAdd from "./QuickAdd";

interface Props {
  meta:      DashboardData["meta"];
  loops:     Loop[];
  investing: DashboardData["investing"];
  digests:   DashboardData["digests"];
  onAdd:     (text: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function ContextColumn({ meta, loops, investing, digests, onAdd, onDiscuss }: Props) {
  const [loopsOpen,    setLoopsOpen]    = useState(true);
  const [investOpen,   setInvestOpen]   = useState(false);
  const [digestsOpen,  setDigestsOpen]  = useState(false);

  const activeLoops = loops.filter(l => !l.done && !l.snoozed);

  return (
    <aside className="contextColumn">
      <div className="postureBlock">
        <p className="postureLabel">Today&apos;s Posture</p>
        <p className="postureQuote">&ldquo;{meta.posture}&rdquo;</p>
        <p className="postureBody">{meta.postureDetail}</p>
      </div>

      <QuickAdd onAdd={onAdd} />

      {/* Open Loops */}
      <div>
        <div className="collapsibleHeader" onClick={() => setLoopsOpen(o => !o)}>
          <span className="collapsibleTitle">
            Open loops
            <span className="collapsibleCount">{activeLoops.length}</span>
          </span>
          <span className={`collapsibleChevron${loopsOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {loopsOpen && (
          <div>
            {activeLoops.slice(0, 6).map(loop => (
              <div key={loop.id} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: loop.id, type: "loop", title: loop.text, project: loop.project, priority: loop.priority })}
                >
                  {loop.text}
                </div>
                <div className="ctxLoopProject">{loop.project}</div>
              </div>
            ))}
            {activeLoops.length > 6 && (
              <span className="ctxViewAll">View all {activeLoops.length} →</span>
            )}
          </div>
        )}
      </div>

      {/* Investing */}
      <div>
        <div className="collapsibleHeader" onClick={() => setInvestOpen(o => !o)}>
          <span className="collapsibleTitle">
            Investing
            <span className="collapsibleCount">{investing.length}</span>
          </span>
          <span className={`collapsibleChevron${investOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {investOpen && (
          <div>
            {investing.slice(0, 5).map(t => (
              <div key={t.ticker} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: t.ticker, type: "ticker", title: t.ticker, theme: t.theme, stance: t.stance })}
                >
                  <strong style={{ fontFamily: "monospace" }}>{t.ticker}</strong> — {t.theme}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digests */}
      <div>
        <div className="collapsibleHeader" onClick={() => setDigestsOpen(o => !o)}>
          <span className="collapsibleTitle">
            Digests
            <span className="collapsibleCount">{digests.length}</span>
          </span>
          <span className={`collapsibleChevron${digestsOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {digestsOpen && (
          <div>
            {digests.slice(0, 4).map(d => (
              <div key={d.id} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: d.id, type: "digest", title: d.title, summary: d.summary, category: d.category })}
                >
                  {d.title}
                </div>
                <div className="ctxLoopProject">{d.category}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Commit:**
```bash
git add components/ContextColumn.tsx
git commit -m "feat: add ContextColumn with posture, quick add, and collapsible sections"
```

---

## Task 14: Create components/FocusCard.tsx

**Files:**
- Create: `components/FocusCard.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import type { Action } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

const SNOOZE_OPTIONS = [
  { label: "Later today",  hrs: "4 hrs",  value: "Later today"  },
  { label: "Tomorrow",     hrs: "24 hrs", value: "Tomorrow"     },
  { label: "In 3 days",    hrs: "72 hrs", value: "In 3 days"    },
  { label: "Next week",    hrs: "7 days", value: "Next week"    },
];

interface Props {
  current:       Action | undefined;
  activeActions: Action[];
  focusIdx:      number;
  snoozedActions:Action[];
  onDone:        (id: string) => void;
  onSnooze:      (id: string, label: string) => void;
  onSkip:        () => void;
  onWake:        (id: string) => void;
  onDiscuss:     (ctx: ThreadContext) => void;
}

export default function FocusCard({ current, activeActions, focusIdx, snoozedActions, onDone, onSnooze, onSkip, onWake, onDiscuss }: Props) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [exiting,    setExiting]    = useState(false);
  const snoozeRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!snoozeOpen) return;
    const handle = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) setSnoozeOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [snoozeOpen]);

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  const triggerExit = (cb: () => void) => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setExiting(true);
    exitTimer.current = setTimeout(() => { setExiting(false); cb(); }, 260);
  };

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

  const priorityClass = current.priority === "HIGH" ? "high" : current.priority === "MEDIUM" ? "med" : "low";
  const tagLabel = current.priority === "HIGH" ? "Needs a decision" : "Next up";
  const remaining = activeActions.length - 1;

  return (
    <div className="focusStage">
      {/* Progress dots */}
      <div className="progressDots">
        {activeActions.map((a, i) => {
          const isDone    = actions_done_lookup(a);
          const isActive  = i === focusIdx % Math.max(activeActions.length, 1);
          return (
            <span
              key={a.id}
              className={`dot${isActive ? " dot--active" : isDone ? " dot--done" : ""}`}
            />
          );
        })}
      </div>

      <div className={`focusCardContent${exiting ? " focusCardContent--exiting" : ""}`}>
        <div className={`priorityTag priorityTag--${priorityClass}`}>
          <span className="priorityDot" />
          {tagLabel.toUpperCase()} · {current.project.toUpperCase()}
        </div>
        <h1 className="focusTitle">{current.title}</h1>
        <p className="focusNext">Next → {current.next}</p>

        <div className="focusActions">
          <button className="btnDone" onClick={() => triggerExit(() => onDone(current.id))}>
            Done ✓
          </button>
          <div style={{ position: "relative" }} ref={snoozeRef}>
            <button className="btnOutlined" onClick={() => setSnoozeOpen(o => !o)}>
              Snooze 💤
            </button>
            {snoozeOpen && (
              <div className="snoozePicker">
                <div className="snoozePickerLabel">Snooze until</div>
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className="snoozeOption"
                    onClick={() => { setSnoozeOpen(false); triggerExit(() => onSnooze(current.id, opt.value)); }}
                  >
                    {opt.label} <span className="snoozeHrs">{opt.hrs}</span>
                  </button>
                ))}
                <button className="snoozeOption" onClick={() => setSnoozeOpen(false)}>Cancel</button>
              </div>
            )}
          </div>
          <button className="btnOutlined" onClick={() => triggerExit(onSkip)}>
            Skip →
          </button>
        </div>

        <button
          className="btnDiscuss"
          onClick={() => onDiscuss({ id: current.id, type: "decision", title: current.title, project: current.project, priority: current.priority, next: current.next })}
        >
          <span className="alphaGlyph">α</span> Discuss with Alphalpha
        </button>

        {remaining > 0 && (
          <p className="focusRemaining">{remaining} more waiting</p>
        )}
      </div>

      {snoozedActions.length > 0 && <SnoozedStrip snoozedActions={snoozedActions} onWake={onWake} />}
    </div>
  );
}

// Progress dot helper — actions in view are non-done, non-snoozed
function actions_done_lookup(_a: Action) { return false; }

function SnoozedStrip({ snoozedActions, onWake }: { snoozedActions: Action[]; onWake: (id: string) => void }) {
  return (
    <div className="snoozedStrip" style={{ marginTop: 32, width: "100%" }}>
      <span className="snoozedStripLabel">Snoozed</span>
      {snoozedActions.map(a => (
        <span key={a.id} className="snoozedChip">
          💤 {a.title.slice(0, 30)}{a.title.length > 30 ? "…" : ""} · {a.snoozeLabel}
          <button className="snoozedWake" onClick={() => onWake(a.id)}>✕</button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Commit:**
```bash
git add components/FocusCard.tsx
git commit -m "feat: add FocusCard with progress dots, snooze picker, and exit animation"
```

---

## Task 15: Create components/TodayTab.tsx

**Files:**
- Create: `components/TodayTab.tsx`

- [ ] **Create the file:**

```tsx
import type { DashboardData, Action, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import FocusCard from "./FocusCard";
import ContextColumn from "./ContextColumn";

interface Props {
  data:          DashboardData;
  activeActions: Action[];
  snoozedActions:Action[];
  loops:         Loop[];
  focusIdx:      number;
  onDone:        (id: string) => void;
  onSnooze:      (id: string, label: string) => void;
  onSkip:        () => void;
  onWake:        (id: string) => void;
  onAdd:         (text: string) => void;
  onDiscuss:     (ctx: ThreadContext) => void;
}

export default function TodayTab({ data, activeActions, snoozedActions, loops, focusIdx, onDone, onSnooze, onSkip, onWake, onAdd, onDiscuss }: Props) {
  const current = activeActions[focusIdx % Math.max(activeActions.length, 1)];

  return (
    <div className="todayLayout">
      <FocusCard
        current={current}
        activeActions={activeActions}
        focusIdx={focusIdx}
        snoozedActions={snoozedActions}
        onDone={onDone}
        onSnooze={onSnooze}
        onSkip={onSkip}
        onWake={onWake}
        onDiscuss={onDiscuss}
      />
      <ContextColumn
        meta={data.meta}
        loops={loops}
        investing={data.investing}
        digests={data.digests}
        onAdd={onAdd}
        onDiscuss={onDiscuss}
      />
    </div>
  );
}
```

- [ ] **Start dev server and check Today tab renders correctly:**
```bash
npm run dev
```
Open http://localhost:3000. Cross-reference `docs/design_handoff/Alphalpha Dashboard v3.html` Today tab. Verify: masthead with active "Today" underline, focus card centered with progress dots, context column on right with parchment background.

- [ ] **Commit:**
```bash
git add components/TodayTab.tsx
git commit -m "feat: add TodayTab with FocusCard and ContextColumn"
```

---

## Task 16: Create components/LoopsTab.tsx

**Files:**
- Create: `components/LoopsTab.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import type { Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import QuickAdd from "./QuickAdd";

const SNOOZE_OPTIONS = [
  { label: "Later today", value: "Later today" },
  { label: "Tomorrow",    value: "Tomorrow"    },
  { label: "In 3 days",   value: "In 3 days"   },
  { label: "Next week",   value: "Next week"   },
];

interface Props {
  loops:     Loop[];
  onDone:    (id: string) => void;
  onSnooze:  (id: string, label: string) => void;
  onAdd:     (text: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function LoopsTab({ loops, onDone, onSnooze, onAdd, onDiscuss }: Props) {
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const active  = loops.filter(l => !l.done && !l.snoozed);
  const snoozed = loops.filter(l => l.snoozed);
  const done    = loops.filter(l => l.done);

  return (
    <div className="tabPage">
      <h1 className="tabTitle">Open loops</h1>
      <p className="tabSubtitle">{active.length} items in flight</p>
      <QuickAdd onAdd={onAdd} />
      {active.map(loop => (
        <LoopRow
          key={loop.id}
          loop={loop}
          snoozing={snoozingId === loop.id}
          onOpenSnooze={() => setSnoozingId(loop.id)}
          onCloseSnooze={() => setSnoozingId(null)}
          onDone={onDone}
          onSnooze={onSnooze}
          onDiscuss={onDiscuss}
        />
      ))}
      {snoozed.length > 0 && (
        <>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 24 }}>Snoozed</p>
          {snoozed.map(loop => (
            <div key={loop.id} className="loopRow loopRow--snoozed">
              <span className={`loopDot loopDot--${loop.priority}`} />
              <div className="loopBody">
                <div className="loopText">{loop.text}</div>
                <div className="loopProject">{loop.project} · {loop.snoozeLabel}</div>
              </div>
              <div className="loopActions" style={{ opacity: 1 }}>
                <button className="loopActionBtn" onClick={() => onSnooze(loop.id, "")}>Wake</button>
              </div>
            </div>
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 24 }}>Done</p>
          {done.map(loop => (
            <div key={loop.id} className="loopRow loopRow--done">
              <span className={`loopDot loopDot--${loop.priority}`} />
              <div className="loopBody">
                <div className="loopText">{loop.text}</div>
                <div className="loopProject">{loop.project}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function LoopRow({ loop, snoozing, onOpenSnooze, onCloseSnooze, onDone, onSnooze, onDiscuss }: {
  loop: Loop;
  snoozing: boolean;
  onOpenSnooze: () => void;
  onCloseSnooze: () => void;
  onDone:    (id: string) => void;
  onSnooze:  (id: string, label: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}) {
  const snoozeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snoozing) return;
    const handle = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) onCloseSnooze();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [snoozing, onCloseSnooze]);

  return (
    <div className="loopRow">
      <span className={`loopDot loopDot--${loop.priority}`} />
      <div className="loopBody">
        <div className="loopText">{loop.text}</div>
        <div className="loopProject">{loop.project}</div>
      </div>
      <div className="loopActions">
        <button className="loopActionBtn" onClick={() => onDone(loop.id)}>✓</button>
        <div className="loopSnoozeWrap" ref={snoozeRef}>
          <button className="loopActionBtn" onClick={onOpenSnooze}>💤</button>
          {snoozing && (
            <div className="snoozePicker" style={{ right: "auto", left: 0 }}>
              <div className="snoozePickerLabel">Snooze until</div>
              {SNOOZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className="snoozeOption"
                  onClick={() => { onCloseSnooze(); onSnooze(loop.id, opt.value); }}
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

- [ ] **Switch to Open loops tab in browser and verify** hover actions, snooze picker, done state (strikethrough).

- [ ] **Commit:**
```bash
git add components/LoopsTab.tsx
git commit -m "feat: add LoopsTab with hover actions and snooze picker"
```

---

## Task 17: Create components/ProjectGrid.tsx

**Files:**
- Create: `components/ProjectGrid.tsx`

- [ ] **Create the file:**

```tsx
import type { Project, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  projects:  Project[];
  loops:     Loop[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function ProjectGrid({ projects, loops, onDiscuss }: Props) {
  return (
    <div className="tabPageWide">
      <h1 className="tabTitle">Projects</h1>
      <p className="tabSubtitle">{projects.length} active workstreams</p>
      <p className="projectLegend">
        <span className="alphaGlyph">α</span> = OpenClaw managed &nbsp;·&nbsp; manually tracked = you own it
      </p>
      <div className="projectGrid">
        {projects.map(project => {
          const projLoops = loops.filter(l => l.project === project.name && !l.done && !l.snoozed);
          const highPri   = projLoops.filter(l => l.priority === "HIGH").length;
          const inlineLoops = (project.loops?.length ? project.loops : projLoops).slice(0, 2);
          return (
            <article key={project.id} className="projectCard">
              <div className="projectCardTop">
                <span className="projectCategory">{project.category}</span>
                <div className="projectBadges">
                  {project.ocOwned && (
                    <span className="badgeOC">
                      <span className="alphaGlyph">α</span> OpenClaw
                    </span>
                  )}
                  <span className={`badgeStatus badgeStatus--${project.status}`}>{project.status}</span>
                </div>
              </div>
              <h2 className="projectName">{project.name}</h2>
              <p className="projectSummary">{project.summary}</p>
              <div className="projectMeta">
                <span>Last: {project.lastActivity}</span>
                {highPri > 0 && (
                  <span className="projectHighPri">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                    {highPri} urgent
                  </span>
                )}
              </div>
              {inlineLoops.length > 0 && (
                <div className="projectLoops">
                  {inlineLoops.map((loop, i) => (
                    <div key={loop.id ?? i} className="projectLoop">
                      <span className="projectLoopDot" />
                      {loop.text}
                    </div>
                  ))}
                  {projLoops.length > 2 && (
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--accent-link)" }}>
                      +{projLoops.length - 2} more loops
                    </div>
                  )}
                </div>
              )}
              <div className="projectDiscuss">
                <button
                  className="btnAlphaDiscuss"
                  onClick={() => onDiscuss({ id: project.id, type: "project", title: project.name, summary: project.summary, ocOwned: project.ocOwned })}
                >
                  <span className="alphaGlyph">α</span> Discuss
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Switch to Projects tab and verify** OpenClaw badges on correct projects, grid layout, inline loops.

- [ ] **Commit:**
```bash
git add components/ProjectGrid.tsx
git commit -m "feat: add ProjectGrid with ocOwned badges and inline loops"
```

---

## Task 18: Create components/InvestingTab.tsx

**Files:**
- Create: `components/InvestingTab.tsx`

- [ ] **Create the file:**

```tsx
import type { Ticker } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  investing: Ticker[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function InvestingTab({ investing, onDiscuss }: Props) {
  return (
    <div className="investingPage">
      <h1 className="tabTitle">Investing candidates</h1>
      <p className="tabSubtitle">Research queue · {investing.length} tickers · hover to discuss</p>
      {investing.map(t => (
        <div key={t.ticker} className="tickerRow">
          <span className="tickerSymbol">{t.ticker}</span>
          <span className="tickerTheme">{t.theme}</span>
          <span className="tickerStance">{t.stance}</span>
          <span className={`tickerConf tickerConf--${t.confidence}`}>{t.confidence}</span>
          <span className="tickerDiscuss">
            <button
              className="btnAlphaDiscuss"
              onClick={() => onDiscuss({ id: t.ticker, type: "ticker", title: t.ticker, theme: t.theme, stance: t.stance })}
            >
              <span className="alphaGlyph">α</span> Discuss
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit:**
```bash
git add components/InvestingTab.tsx
git commit -m "feat: add InvestingTab with ticker rows and hover discuss"
```

---

## Task 19: Create components/DigestsTab.tsx

**Files:**
- Create: `components/DigestsTab.tsx`

- [ ] **Create the file:**

```tsx
import type { Digest } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  digests:   Digest[];
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function DigestsTab({ digests, onDiscuss }: Props) {
  return (
    <div className="tabPage">
      <h1 className="tabTitle">Digests</h1>
      <p className="tabSubtitle">Syntheses and source trail</p>
      {digests.map(d => (
        <article key={d.id} className="digestItem">
          <div className="digestTop">
            <span className="digestCategory">{d.category}</span>
            <span className="digestDate">{d.date}</span>
          </div>
          <p className="digestTitle">{d.title}</p>
          <p className="digestSummary">{d.summary}</p>
          <div className="digestTags">
            {d.tags.map(tag => <span key={tag} className="digestTag">{tag}</span>)}
          </div>
          <button
            className="btnAlphaDiscuss"
            onClick={() => onDiscuss({ id: d.id, type: "digest", title: d.title, summary: d.summary, category: d.category })}
          >
            <span className="alphaGlyph">α</span> Discuss
          </button>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Commit:**
```bash
git add components/DigestsTab.tsx
git commit -m "feat: add DigestsTab with discuss buttons"
```

---

## Task 20: Create components/ThreadDrawer.tsx

**Files:**
- Create: `components/ThreadDrawer.tsx`

- [ ] **Create the file:**

```tsx
"use client";
import { useState, useRef, useEffect } from "react";
import type { ThreadContext } from "./Dashboard";

type Message = { role: "assistant" | "user"; content: string };

function buildSystemPrompt(ctx: ThreadContext): string {
  // OPENCLAW: This system prompt is sent to /api/thread on every message.
  // When you wire up your AI endpoint, this is the full context you'll receive.
  // Modify the prompt template here if you want Alphalpha's personality adjusted.
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const lines = [
    `You are Alphalpha, Alex's personal AI chief of staff. Today is ${today}.`,
    `You are discussing a ${ctx.type} item.`,
    `Title: "${ctx.title}"`,
    ctx.project  && `Project: ${ctx.project}`,
    ctx.priority && `Priority: ${ctx.priority}`,
    ctx.next     && `Suggested next step: ${ctx.next}`,
    ctx.theme    && `Investment theme: ${ctx.theme}`,
    ctx.stance   && `Stance: ${ctx.stance}`,
    ctx.summary  && `Summary: ${ctx.summary}`,
    ctx.category && `Category: ${ctx.category}`,
    ctx.ocOwned  && `This item is actively managed by OpenClaw.`,
    `Be concise (≤3 sentences), warm, and concrete. Help Alex decide, act, or think more clearly.`,
  ];
  return lines.filter(Boolean).join("\n");
}

function openerFor(ctx: ThreadContext): string {
  const t = ctx.title;
  switch (ctx.type) {
    case "decision": return `On "${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — what's your thinking? I can help you decide or draft the next step.`;
    case "loop":     return `This loop has been open for a while. Want to close it, snooze it, or think through what's blocking it?`;
    case "project":  return ctx.ocOwned
      ? `I'm actively managing this one. What aspect of "${t}" do you want to think through?`
      : `This is a manually-tracked project. What aspect of "${t}" do you want to think through?`;
    case "ticker":   return `${t} — ${ctx.theme ?? ""}. Want to think through the thesis, timing, or what would change your mind?`;
    case "digest":   return `"${t.slice(0, 60)}${t.length > 60 ? "…" : ""}" — want to dig into this, connect it to other threads, or decide what to do with it?`;
  }
}

interface Props {
  thread:  ThreadContext | null;
  onClose: () => void;
}

export default function ThreadDrawer({ thread, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!thread) return;
    if (thread.id === prevId.current) return;
    prevId.current = thread.id;
    setMessages([{ role: "assistant", content: openerFor(thread) }]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 320);
  }, [thread?.id]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!thread || !input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "· · ·" }]);
    setInput("");
    setLoading(true);

    try {
      // OPENCLAW: Switch to streaming here once /api/thread returns a ReadableStream.
      // Replace the fetch + json() below with a streaming reader:
      //   const reader = res.body?.getReader();
      //   while(true) { const { done, value } = await reader.read(); ... append chunks }
      const res  = await fetch("/api/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: buildSystemPrompt(thread), messages: history }),
      });
      const data = await res.json();
      setMessages([...history, { role: "assistant", content: data.content ?? "…" }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  // OPENCLAW: Thread conversations currently reset on every item change.
  // To persist threads across navigation, key messages to localStorage by item id:
  //   localStorage.setItem(`thread-${ctx.id}`, JSON.stringify(messages))
  // Implement once the real AI endpoint is wired.

  const isOpen = !!thread;

  return (
    <aside className={`threadDrawer${isOpen ? " threadDrawer--open" : ""}`} aria-hidden={!isOpen}>
      {thread && (
        <>
          <div className="threadHeader">
            <div className="threadAvatar">α</div>
            <div className="threadMeta">
              <div className="threadType">{thread.type}</div>
              <div className="threadItemTitle" title={thread.title}>
                {thread.title.slice(0, 60)}{thread.title.length > 60 ? "…" : ""}
              </div>
              {(thread.project || thread.ocOwned) && (
                <div className="threadProject">
                  {thread.project}
                  {thread.ocOwned && <span className="badgeOC"><span className="alphaGlyph">α</span> OpenClaw managed</span>}
                </div>
              )}
            </div>
            <button className="threadClose" onClick={onClose} aria-label="Close thread">✕</button>
          </div>

          <div className="threadMessages" ref={messagesRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`threadMsgRow threadMsgRow--${msg.role}`}>
                {msg.role === "assistant" && <div className="threadAvatarSm">α</div>}
                <div className={`threadBubble${msg.content === "· · ·" ? " threadLoading" : ""}`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="threadInputRow">
            <input
              ref={inputRef}
              className="threadInput"
              placeholder="Share your thinking, ask a question…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={loading}
            />
            <button className="threadSend" onClick={send} disabled={loading} aria-label="Send">↑</button>
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Commit:**
```bash
git add components/ThreadDrawer.tsx
git commit -m "feat: add ThreadDrawer with seeded context, stub send, and OPENCLAW comments"
```

---

## Task 21: Full visual verification against prototype

- [ ] **Serve prototype for side-by-side reference:**
```bash
# In a separate terminal:
cd docs/design_handoff && python3 -m http.server 8766
# open http://localhost:8766/Alphalpha%20Dashboard%20v3.html
```

- [ ] **Run the dashboard:**
```bash
npm run dev
# open http://localhost:3000
```

- [ ] **Verify each tab matches the prototype** — check against `docs/design_handoff/README.md` §Screens:
  - [ ] **Today:** Masthead active underline, progress dots, priority tag color, focus title (Playfair Display), next step italic, Done/Snooze/Skip buttons, α Discuss button, context column parchment background, collapsibles, Quick Add
  - [ ] **Open loops:** Loop list with hover actions (✓/💤/α Discuss), snooze picker opens and closes, done state = strikethrough
  - [ ] **Projects:** Grid layout, "α OpenClaw" badge on Alphalpha/OpenClaw/Obsidian projects only, ACTIVE badge, inline loops
  - [ ] **Investing:** Ticker (monospace), theme, confidence color (HIGH=red, MEDIUM=brown), α Discuss on hover
  - [ ] **Digests:** Category label, date right-aligned, italic summary, tags

- [ ] **Verify thread drawer** — click α Discuss on each tab type, confirm: seeded opener message matches README §Thread Drawer, "· · ·" loading state, reply appears, ✕ closes drawer, content margin shifts

- [ ] **Verify responsive** — resize browser to < 640px: stacked layout, bottom sheet drawer, no status bar

- [ ] **Run the data generate test:**
```bash
node scripts/generate-dashboard-data.test.mjs
```
Expected: `✓ All assertions passed`

- [ ] **Commit all remaining files and push:**
```bash
git add -A
git commit -m "feat: complete Alphalpha dashboard v3 redesign

- Warm-parchment design system replacing dark-mode
- Tab navigation (Today, Open loops, Projects, Investing, Digests)
- Focus card with progress dots, snooze picker, exit animation
- Universal α thread drawer seeded with item context
- OpenClaw ownership badges driven by openclaw.config.json
- Stub API routes with OPENCLAW: integration instructions
- v3 data schema with ids, ocOwned, posture, stats"

git push origin claude/hardcore-ishizaka-3fbf39
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Tab navigation (Today/Loops/Projects/Investing/Digests) → Tasks 10, 12–19
- [x] Focus card: progress dots, priority tag, Done/Snooze/Skip, exit animation → Task 14
- [x] Snooze picker with 4 options → Tasks 14, 16
- [x] Snoozed strip with wake button → Task 14
- [x] Context column: posture, quick add, collapsibles → Tasks 12, 13
- [x] Quick Add: expand/collapse, Enter to save, Esc to cancel → Task 12
- [x] Thread drawer: seeded context, opener by type, stub send → Task 20
- [x] System prompt construction per README spec → Task 20
- [x] `ocOwned` badges on Projects → Tasks 2, 3, 17
- [x] `openclaw.config.json` drives ocOwned → Tasks 2, 3
- [x] API route stubs with `// OPENCLAW:` comments → Tasks 8, 9
- [x] `postSignal` helper with `// OPENCLAW:` comment → Task 10
- [x] Status bar with high-priority red count → Task 11
- [x] Responsive ≤640px breakpoint → Task 6 (CSS)
- [x] Data schema v3 (topActions, stats, ocOwned, ids) → Tasks 1, 3, 4
- [x] `POSTURE.md` sourcing with fallback → Task 3
- [x] Google Fonts (Playfair Display, Lora, DM Sans) → Task 5
- [x] Design handoff cross-reference instructions → Header + Task 21
- [x] OpenClaw handoff prompt → In spec doc (already written)

**Type consistency check:**
- `ThreadContext` defined in `Dashboard.tsx`, imported by all tab components ✓
- `DashboardData`, `Action`, `Loop`, `Project`, `Ticker`, `Digest` from `lib/data.ts` ✓
- `onDiscuss: (ctx: ThreadContext) => void` consistent across all components ✓
- `onDone`, `onSnooze`, `onSkip`, `onWake` signatures consistent ✓
- `postSignal` called with same signature in all handlers ✓

**Note on FocusCard progress dots:** The `actions_done_lookup` stub function in FocusCard.tsx (Task 14) should be removed — it's unused. The dots use `focusIdx` to determine active dot. Clean up:

In `FocusCard.tsx`, replace the dot rendering with:
```tsx
{activeActions.map((_, i) => (
  <span
    key={i}
    className={`dot${i === focusIdx % Math.max(activeActions.length, 1) ? " dot--active" : ""}`}
  />
))}
```
And remove the `actions_done_lookup` function entirely.

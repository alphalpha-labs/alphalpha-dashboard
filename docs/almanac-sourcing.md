# The Almanac — Curation & Sourcing Pipeline Plan

Status: **planning / not yet implemented**
Owner decisions baked in: **OpenClaw cron trigger · workspace-first data · deterministic tiles first**

This document specifies how each section of the daily Almanac edition gets
sourced, ranked, composed, and validated — turning the current single
hand-written fixture into a personalized, source-backed daily edition.

---

## 1. Architecture

### 1.1 What already exists (the backbone)

- **Immutable editions in KV** — `alphalpha:almanac:edition:{YYYY-MM-DD}`, write-once
  (enforced by `app/api/almanac/editions/route.ts` POST). Archive replay reads
  these back; a missing snapshot falls back to fixture recompute.
- **Per-date feedback in KV** — `alphalpha:almanac:feedback:{YYYY-MM-DD}` with
  `{ keeps, tunes }` (`app/api/almanac/feedback/route.ts`). This is the raw
  personalization signal: `✦ Keep`, `↑ More`/`↓ Less`, nuance chips, free-text notes.
- **Build-time generator** — `scripts/generate-dashboard-data.mjs` already reads
  workspace markdown + `memory/**/latest-manifest.json` snapshots and emits
  `lib/generated-data.json` (including the `daily` fixture block).
- **OpenClaw LLM proxy** — `lib/openclaw.ts` (`streamThread`, `sendSignal`) routes
  all model calls through OpenClaw; no direct Anthropic/OpenAI key in the repo.
- **Manifest pattern** — upstream OpenClaw automations write
  `memory/<domain>/latest-manifest.json`; the dashboard ingests them. The Almanac
  generator follows the same shape.

### 1.2 The generation model

Every tile is a four-stage pipeline:

```
Sourcer  →  Ranker  →  Composer  →  Validator
(gather)    (score)    (LLM shape)   (zod + fallback)
```

| Stage | Responsibility | Notes |
|-------|----------------|-------|
| **Sourcer** | Gather raw candidates from workspace manifests + zero-key public APIs. | Pure I/O, cacheable, no personalization. |
| **Ranker** | Score candidates by (a) active open loops / projects, (b) **keep/tune feedback weights**, (c) recency dedup vs. recent editions. | Deterministic. Where the personalization loop closes. |
| **Composer** | LLM (via OpenClaw) writes the typed prose fields — `dek`, `why`, `note`, `caption`, `curator`. | Deterministic tiles (quotes, "You" chart) skip this entirely. |
| **Validator** | zod schema + sanity checks. On **any** failure, fall back to the fixture rotation for that tile. | The edition is never empty or half-built. |

### 1.3 Orchestration & trigger — **OpenClaw cron**

A daily OpenClaw automation (~5:00am local, same mechanism that produces the
existing `latest-manifest.json` files) runs the Almanac generator and writes the
day's `DailyData` to the editions KV key.

- Generator lives at **`scripts/generate-almanac.mjs`** (callable standalone and
  from the OpenClaw automation runner).
- Flags: `--date=YYYY-MM-DD` (default: tomorrow), `--dry-run` (compose + validate,
  print, don't write), `--force` (overwrite — normally blocked by immutability).
- LLM-composed fields are produced via the **OpenClaw `/v1/responses` proxy**
  (`lib/openclaw.ts`), so no new API key is introduced.
- Writes once to `alphalpha:almanac:edition:{date}`; the dashboard reads it. If the
  job hasn't run, the component's existing fixture recompute is the fallback — so a
  missed cron degrades gracefully instead of breaking.

```
OpenClaw cron (daily 5am)
   └─ node scripts/generate-almanac.mjs --date=<tomorrow>
        ├─ load feedback weights      (KV: feedback:*)
        ├─ load edition history       (KV: recent edition item-ids)
        ├─ per tile: Sourcer→Ranker→Composer→Validator
        ├─ assemble DailyData, validate (zod)
        └─ POST snapshot              (KV: edition:{date}, write-once)
```

### 1.4 Data policy — **workspace-first**

Phase 1 leans on data already in the workspace plus **zero-key public APIs only**.
Paid / rate-limited market-data APIs (FRED, EIA, news APIs, recipe APIs) are
**deferred** to a later phase and explicitly flagged per tile below.

---

## 2. Cross-cutting infrastructure (Phase 0 — build once)

1. **`lib/almanac-schema.ts`** — zod schema for `DailyData` and each tile sub-shape;
   the single validation gate. Mirrors the types in `lib/data.ts`.
2. **`lib/almanac-feedback-weights.ts`** — reads all `feedback:*` KV keys and
   aggregates into a per-genre weight vector:
   - per-source / per-sector / per-form affinity from `✦ Keep`
   - `↑ More` / `↓ Less` reactions
   - nuance-chip tallies ("love the source", "seen it", "go deeper", "too long", …)
   - free-text notes (passed to Composer as steering context)
3. **Edition history / dedup** — a rolling KV set of recently-used item IDs per
   genre (`alphalpha:almanac:history:{genre}`), so the Ranker never repeats a
   recent article / image / surprise.
4. **Generator harness** — `scripts/generate-almanac.mjs` with per-tile modules,
   `--dry-run` / `--date` / `--force`, and **graceful per-tile fixture fallback**.
5. **Provenance** — each composed item stores its source URL(s) / citations
   (feeds the "Sourcing & method live in the export brief" line in the UI).
6. **OpenClaw automation manifest** — register the cron job in the workspace
   `memory/automations/` registry so it shows up in the dashboard's automations view.

---

## 3. Per-tile pipelines

### 3.1 Reading (article)
- **Sourcer:** reuse the workspace **Article Queue** + **article-candidates**
  already parsed by `buildQueues()` in the dashboard generator. (Phase 2: add RSS
  pulls for kept sources, e.g. Works in Progress.)
- **Ranker:** overlap with current open loops / projects + source-affinity from
  kept articles; dedup vs. recent editions.
- **Composer:** LLM writes `dek` + `why` (ties the piece to a *current* loop);
  `readTime` computed from word count.
- **Feedback:** "love the source" ↑ source weight; "seen it" / "too long" ↓.
- **Workspace-first:** ✅ uses existing queue; RSS deferred.

### 3.2 Venture (refreshes every 3 days — UI already rotates)
- **Sourcer:** investing themes (thesis baskets, watchlist), project registry,
  AI-tooling manifest — all already in the workspace.
- **Composer:** LLM generates the full `DailyVenture` incl. `research`
  (TAM / growth / wedge / competitors / signals).
- **Grounding (critical):** TAM / CAGR must not be hallucinated. Phase 1 grounds in
  workspace investing notes and labels figures as estimates; **Phase 2** adds a
  web-search grounding step + stored citations. Validate competitor names.
- **Workspace-first:** ✅ Phase 1 grounded in notes; external market-sizing deferred.

### 3.3 Signal (chart) — mixed
- **"You" chart:** computed **directly from workspace activity manifests**
  (loops-closed-per-week from the activity digest). **No LLM, fully deterministic,
  honest.** Build this first (see §4).
- **Investing / AI charts:** Phase 1 uses a **curated, quarterly-refreshed dataset**
  committed to the repo (`lib/almanac-datasets/*.json`) with the LLM writing only
  `note` + `why`. Projection points keep the `'28e` "e" suffix → outlined-bar
  convention (already implemented in `BarChart`). **Phase 2:** wire FRED / EIA.
- **Workspace-first:** ✅ "You" from manifests; market series from committed dataset.

### 3.4 Look (image) — **requires a data-contract change**
- **Contract gap:** `daily.image` currently has no URL. Add `url`, `srcLink`,
  `tags` to the `DailyData["image"]` type in `lib/data.ts` (and the placeholder in
  `ImageBlock`).
- **Sourcer:** **Met Museum** + **Art Institute of Chicago** Open Access APIs —
  free, no key, public-domain, searchable by medium / classification / color.
  Matches the stated taste ("Parrish skies, Hudson-River light"). Plus a
  user-dropped override stored in KV.
- **Ranker:** taste vector learned from kept images.
- **Composer:** LLM writes `caption` + `curator` note.
- **Workspace-first:** ✅ Met/AIC are zero-key public APIs.

### 3.5 Surprise — most LLM-driven
- **Sourcer:** rotating form pool (Word / Provocation / Artifact / Recipe); pick a
  form not used recently (history dedup).
- **Composer:** LLM generates `body` + `note` tying to the user's current context
  (notes, posture). Phase 1: Word/Provocation/Artifact from LLM + a small curated
  artifact list; **Recipe API deferred**.
- **Workspace-first:** ✅ LLM + curated lists; external word/recipe APIs deferred.

### 3.6 Colophon quotes (mind + parenting) — lowest risk
- **Sourcer:** a curated, growing `lib/almanac-datasets/quotes.json` tagged by
  theme; deterministic rotation with dedup vs. recent editions.
- **Attribution guard:** verify / flag attributions; keep the existing "attributed"
  hedge discipline. No LLM required (optional: LLM picks the most resonant given
  today's posture).
- **Workspace-first:** ✅ fully local.

---

## 4. Build order

| Phase | Work | Risk | Why |
|-------|------|------|-----|
| **0** | Infra: zod schema, feedback-weights aggregator, history/dedup store, generator harness, OpenClaw automation registration | low | Foundation for every tile. |
| **1** | **Quotes** + **"You" chart** | none | Deterministic, zero external APIs — proves generate→validate→KV→dedup→feedback end to end. |
| **2** | **Article** tile | low | Highest daily value; uses existing article queue. |
| **3** | **Look** (image) | low–med | Contract change + Met/AIC public APIs. |
| **4** | **Venture** | med | LLM + grounding discipline. |
| **5** | **Surprise** | med | Mostly LLM, form rotation. |
| **6** | Investing / AI charts: wire FRED / EIA; Article: add RSS; Venture: web-search grounding | med | External data sources, rate limits, keys. |

## 5. Open contract changes required

- `lib/data.ts` → `DailyData["image"]`: add `url: string`, `srcLink?: string`,
  `tags?: string[]`. Update `ImageBlock` to render the real image with the existing
  placeholder as fallback.
- Optional per-item `provenance?: { label: string; url: string }[]` across tiles to
  power the export-brief sourcing line.

## 6. Failure & cost posture

- **One generation per day**, cached as an immutable snapshot — bounded LLM cost.
- **Per-tile fallback** to fixture rotation: a failed sourcer/LLM never blanks the
  edition.
- **Provider responses cached** within a run to avoid duplicate calls.
- **Missed cron** degrades to the component's existing fixture recompute.

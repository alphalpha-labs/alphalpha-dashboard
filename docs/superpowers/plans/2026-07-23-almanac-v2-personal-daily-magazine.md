# Almanac V2 — Personal Daily Magazine

Status: approved; Phase 0–3 shipped 2026-07-23
Owner: Alex
Implementation home: `alphalpha-labs/alphalpha-dashboard`
Primary route: `/`  
Primary generation path: `scripts/generate-almanac.mjs`

## 1. Product outcome

Every morning, Alphalpha should deliver a small, evolving personal magazine that
reliably teaches Alex something, sparks an idea, and gives him something worth
exploring.

The Almanac is the dashboard's center of gravity. Operational information remains
available, but it should not compete with the morning edition unless something
truly requires attention.

### Daily jobs to be done

1. Find three genuinely worthwhile things to read.
2. Surface one investment idea or material development.
3. Inspire Alex to make more music.
4. Introduce one useful surprise beyond established tastes.
5. Learn from every exposure and interaction with minimal effort.

### Product rules agreed with Alex

- Open the dashboard first thing in the morning.
- Offer three differentiated reading options.
- Target a combined reading budget of 20–45 minutes.
- Cover both new investment ideas and developments affecting current holdings or
  theses.
- Rotate music inspiration intelligently among songs/riffs, production
  breakdowns, samples/sounds, creative constraints, and short exercises.
- Reserve about 25% of recommendations for deliberate taste expansion.
- Use one-click feedback: `More like this`, `Not for me`, `Save`, `Go deeper`.
- Automatically save strong recommendations into the correct durable queue and
  show a visible receipt.
- Treat stale material, repetition, and obvious recommendations as primary
  product failures.
- Handle safe internal tasks automatically.

## 2. Success criteria

### Edition quality

- Exactly three reading recommendations, each with a distinct editorial role.
- Estimated total reading time between 20 and 45 minutes when source metadata
  permits.
- No exact URL previously exposed inside the active cooldown window.
- No near-duplicate of a recently exposed item above the configured similarity
  threshold.
- At least one recommendation is fresh unless the edition explicitly labels an
  evergreen selection and explains why it deserves attention now.
- Roughly one in four recommendations is an intentional exploration pick.
- Each recommendation explains:
  - why it is worth Alex's time;
  - why it is fresh or intentionally evergreen;
  - why it fits the edition;
  - whether it is familiar or exploratory;
  - where it came from.

### Interaction quality

- The four core feedback actions work in one click.
- Saves and automatic saves produce a receipt naming the durable destination.
- `Go deeper` opens a contextual Alphalpha thread seeded with the item, source,
  rationale, and relevant prior interests.
- Feedback changes future ranking behavior and is visible in a bounded audit
  history.

### Reliability

- A failed live source does not blank the edition.
- A failed optional lane degrades to an explicit, source-backed fallback.
- The generator validates the complete edition before publishing.
- The previous valid edition remains available when a new run fails.
- Generation has a bounded crawl, bounded model usage, and a run receipt.

### Initial product metrics

Track these without turning the product into an analytics console:

- open rate by lane;
- save rate;
- `Go deeper` rate;
- `More like this` / `Not for me` ratio;
- repeated-item rejection count;
- near-duplicate rejection count;
- fresh-discovery share;
- exploration share;
- automatic-save acceptance/reversal rate;
- consecutive days with a valid edition.

Do not optimize blindly for clicks. A saved or deeply explored item is a stronger
signal than an open; passive exposure is still important for deduplication.

## 3. Editorial structure

### Morning sequence

1. **Cover**
   - Edition number/date.
   - One-sentence editorial posture.
   - Freshness and source-health disclosure.

2. **Three worth your time**
   - `Anchor`: highest-confidence piece aligned with a durable interest.
   - `Lens`: a piece that adds a different discipline, argument, or worldview.
   - `Frontier`: the 25% exploration candidate when the quality gate is met.
   - The three selections must be diverse by subject, source, and editorial
     purpose—not merely the top three scalar scores.

3. **Investment lens**
   - Alternate or combine:
     - material update to an active thesis/holding;
     - new idea worth monitoring;
     - contradiction or invalidation evidence;
     - valuation/patience opportunity.
   - Always distinguish observation, interpretation, and possible action.
   - Never imply trade authority.

4. **Make something**
   - Select the strongest available music prompt format for the day.
   - End with a concrete action that can begin in 5–15 minutes.

5. **Off your usual path**
   - A high-quality adjacent or unfamiliar recommendation.
   - Explain the bridge from known interests.
   - Never use low relevance as a substitute for surprise.

6. **Continue exploring**
   - Saved items, open `Go deeper` threads, or unfinished recommendations from
     recent editions.
   - Keep this bounded to the most relevant two or three items.

7. **Quiet system footer**
   - Generation time, source coverage, degraded sources, automatic-save receipts.
   - Operational alerts appear only when action is required.

## 4. Information architecture

### Primary routes

- `/` — latest Almanac edition; default dashboard home.
- `/almanac/[date]` — immutable edition archive/detail.
- `/investing` — deeper investing workspace.
- `/projects`, `/open-loops` — operational workspaces.
- `/system` — automation, review, queues, sources, and health.

The current Briefing view should move behind an intentional workspace affordance
or be folded into `/system`. It should not remain the default once Almanac V2 is
ready.

### Progressive disclosure

- Card: title, source, read time, freshness, editorial role, concise why.
- Expanded card/drawer: richer summary, provenance, similarity/exposure note,
  feedback history, save destination, and Alphalpha discussion.
- Source: exact external article or artifact.

## 5. Core data model

Add a V2 schema beside the existing `DailyData` contract, then migrate the UI
without breaking archived V1 editions.

```ts
type RecommendationLane =
  | "reading"
  | "investing"
  | "music"
  | "exploration";

type EditorialRole =
  | "anchor"
  | "lens"
  | "frontier"
  | "thesis-update"
  | "new-idea"
  | "music-spark"
  | "wildcard";

type Recommendation = {
  id: string;
  canonicalUrl?: string;
  title: string;
  source: string;
  sourceUrl?: string;
  lane: RecommendationLane;
  role: EditorialRole;
  summary: string;
  whyNow: string;
  whyForAlex: string;
  readMinutes?: number;
  publishedAt?: string;
  freshness:
    | "new"
    | "recent"
    | "evergreen"
    | "unknown";
  exploration: boolean;
  topics: string[];
  entities: string[];
  sourceKind: string;
  provenance: Array<{
    label: string;
    url?: string;
    observedAt: string;
  }>;
  scorecard: {
    quality: number;
    tasteFit: number;
    novelty: number;
    freshness: number;
    timeliness: number;
    diversity: number;
    confidence: number;
    penalties: string[];
  };
  savePolicy: {
    mode: "automatic" | "suggest" | "never";
    destination?: string;
    reason: string;
  };
};

type ExposureEvent = {
  id: string;
  recommendationId: string;
  canonicalUrl?: string;
  titleFingerprint: string;
  semanticFingerprint?: string;
  source: string;
  topics: string[];
  editionDate: string;
  event:
    | "shown"
    | "opened"
    | "saved"
    | "auto-saved"
    | "more-like-this"
    | "not-for-me"
    | "go-deeper"
    | "dismissed";
  at: string;
};

type AlmanacEditionV2 = {
  schemaVersion: "2026-07-23.1";
  date: string;
  edition: string;
  generatedAt: string;
  posture: string;
  readingBudget: {
    minimumMinutes: 20;
    maximumMinutes: 45;
    selectedMinutes?: number;
  };
  reading: [Recommendation, Recommendation, Recommendation];
  investing?: Recommendation;
  music?: Recommendation;
  exploration?: Recommendation;
  continueExploring: Recommendation[];
  runHealth: {
    status: "healthy" | "degraded";
    sourcesAttempted: number;
    sourcesSucceeded: number;
    warnings: string[];
  };
};
```

### Durable stores

- Immutable editions:
  `alphalpha:almanac:edition:{YYYY-MM-DD}`.
- Exposure ledger:
  `alphalpha:almanac:exposure:v2` or a bounded per-period equivalent.
- Per-date feedback remains:
  `alphalpha:almanac:feedback:{YYYY-MM-DD}`.
- Existing per-genre history remains as a compatibility/fallback layer.
- Automatic-save receipts use the existing dashboard signal/audit pattern.
- Local test fixtures live in `lib/almanac-datasets/` and must not contain private
  memory excerpts.

The exposure ledger should be compact, bounded, and projection-friendly. Store
fingerprints and metadata, not full article text.

## 6. Candidate and ranking architecture

### Candidate funnel

```text
Connected sources
  → normalize
  → exact dedup
  → exposure rejection
  → near-duplicate rejection
  → quality/source gate
  → lane scoring
  → portfolio selection
  → compose explanations
  → validate complete edition
  → publish + record exposure + save receipts
```

### Source families

Use existing integrations first:

- RSS and web discovery.
- Obsidian/article queues and saved candidates.
- Almanac curated datasets.
- Prior feedback and exposure history.
- Investing artifacts, Thesis Baskets projections, current holdings, thesis
  reviews, invalidation evidence, and ranked action queue.
- Music riff/production datasets and trusted video discovery.
- Relevant email/newsletter sources when a bounded, privacy-safe projection is
  available.
- Calendar and current projects only as contextual ranking signals, not as
  content by default.

### Hard gates

Reject before scoring when:

- URL is blocked, generic, malformed, or not the actual item.
- Item is a list/index/archive/subscription page.
- Source has no attributable content.
- Exact canonical URL exists inside the cooldown.
- Title fingerprint matches a recent exposure.
- Semantic similarity to a recent exposure exceeds the rejection threshold.
- Publication date is implausibly future-dated.
- Item cannot support its claimed freshness or thesis.
- Article is likely already present in queues, Instapaper, saved candidates, or
  completed reading history.

### Scoring

Use transparent sub-scores rather than one unexplained confidence number.

Initial reading score:

```text
quality       25%
taste fit     20%
novelty       20%
freshness     15%
timeliness    10%
source value   5%
serendipity    5%
```

Then apply:

- exposure penalty;
- near-duplicate penalty;
- repeated-source penalty;
- repeated-topic penalty;
- obviousness penalty;
- poor-format/source-health penalty;
- negative-feedback penalty.

An item with a hard-gate failure cannot be rescued by a high taste-fit score.

### Obviousness heuristic

Treat an item as potentially obvious when several of these are true:

- source or author appears frequently in recent editions;
- subject has appeared repeatedly;
- item is broadly viral or already prominent in connected queues;
- title/entities closely match recently exposed material;
- item restates a known thesis without new evidence;
- recommendation reason cannot say what is new.

Obvious material may still be used only when it is materially important, and the
card must explain why it survived the penalty.

### Three-read portfolio selector

Do not select the top three scalar scores independently. Select a portfolio:

1. Choose the highest-quality eligible `Anchor`.
2. Choose a `Lens` maximizing quality plus topic/source distance from the Anchor.
3. Choose a `Frontier` from the exploration pool when it clears the minimum
   quality and bridge-relevance gates.
4. Search combinations whose total estimated read time is 20–45 minutes.
5. Prefer three distinct source hosts.
6. Reject a set if two items make substantially the same argument.

When only two items clear the quality gate, publish two strong reads and label the
edition degraded rather than padding it with a weak third choice. The UI may
preserve the three-slot layout with an honest “still looking” state.

## 7. Personalization and feedback

### Signal strength

Suggested initial ordering:

1. `Not for me` — strongest negative.
2. `Go deeper` — strongest positive interest.
3. `Save` / automatic save retained — strong positive.
4. `More like this` — positive.
5. Open — weak positive.
6. Shown — exposure only, not preference.

Never infer dislike from a recommendation merely not being opened.

### Exploration policy

- Target 25% over a rolling 14- or 28-day window, not mechanically every day.
- Exploration requires a bridge to a known interest, question, project, or
  aesthetic.
- Track exploration acceptance separately.
- If exploration receives repeated negative feedback, adjust the bridge and
  source strategy—not simply eliminate exploration.

### Automatic save policy

Automatically save when:

- the item clears a high quality threshold;
- it is not already present in the destination;
- destination is unambiguous;
- saving is reversible and does not send a public/external message;
- the edition records a receipt.

Default destinations:

- reading → Obsidian reading candidates + Instapaper workflow where already
  approved;
- investing → research queue or thesis-specific evidence inbox, never execution;
- music → music inspiration/experiment queue;
- exploration → reading or inspiration queue based on item type.

If the destination is ambiguous, use `suggest` instead of `automatic`.

## 8. Phased implementation

### Phase 0 — Baseline, fixtures, and evaluation harness

Goal: make quality measurable before changing selection behavior.

Implementation status: foundation complete. `npm run almanac:evaluate` now produces
a deterministic candidate/exposure report, and the novelty fixture suite covers
canonical URLs, title fingerprints, near-duplicates, source saturation, exposure
compaction, and rejection summaries. Broader 14-day replay comparison remains part
of the Phase 2 pre-release gate.

Deliverables:

- Capture a representative fixture corpus from recent candidates and editions.
- Add a replay command for a chosen historical date without publishing.
- Produce a baseline report:
  - exact repeats;
  - near-duplicates;
  - source/topic concentration;
  - estimated reading-time distribution;
  - freshness distribution;
  - feedback coverage;
  - missing/invalid source metadata.
- Define the initial similarity and cooldown thresholds in configuration.
- Add fixture tests for known stale, repetitive, obvious, and high-quality items.

Acceptance gate:

- Historical replay is deterministic with web discovery disabled.
- Baseline report can compare old and new selectors against the same pool.
- No live editions or user queues are mutated.

### Phase 1 — Exposure ledger and novelty defenses

Goal: prevent the most important failure modes before expanding content.

Implementation status: complete for the current Reading lane. The generator seeds
a compact exposure ledger from recent immutable editions, rejects exact URL/title
and cross-source near-duplicate exposures, penalizes repeated sources, records
shown Reading/Long Read items after publication, and adds bounded novelty results
to run receipts. These controls become shared inputs to the three-read selector in
Phase 2.

Deliverables:

- Canonical URL normalization.
- Title/topic/entity fingerprints.
- Bounded exposure ledger and compact history projection.
- Exact exposure rejection.
- Cross-source near-duplicate detection.
- Queue/Instapaper/saved-candidate membership checks.
- Obviousness and repeated-source/topic penalties.
- Explainable rejection logs in dry-run output.
- Migration that seeds the ledger from recent immutable editions and available
  reading history.

Implementation targets:

- `scripts/generate-almanac.mjs`
- `scripts/lib/almanac-feedback-selection.mjs`
- new focused library such as `scripts/lib/almanac-novelty.mjs`
- schemas/tests in `lib/`

Acceptance gate:

- Known repeats and near-duplicates in fixtures are rejected.
- False-positive review of a bounded fixture sample is acceptable.
- Exposure store contains no full private article text.
- Existing V1 edition generation still succeeds.

### Phase 2 — Three-read editorial portfolio

Goal: ship the first visible V2 improvement.

Implementation status: complete. The live candidate pipeline now selects a
portfolio with Anchor/Lens/Frontier roles, a 20–45 minute target, source/topic
diversity, and one explicitly exploratory pick. V2 editions carry typed reading
and portfolio metadata; the Almanac renders a magazine-style “Three worth your
time” opening while archived V1 editions retain their legacy layout. The first
KV-backed dry-run produced a healthy 30-minute portfolio across three sources.

Deliverables:

- `Recommendation` and `AlmanacEditionV2` schemas.
- Candidate normalization across primary Reading and Long Read pools.
- Read-time normalization.
- Anchor/Lens/Frontier role classification.
- Three-read portfolio selection with 20–45 minute budget.
- 25% rolling exploration allocation.
- Distinct `whyNow`, `whyForAlex`, freshness, and exploration explanations.
- New “Three worth your time” opening UI.
- Compatibility renderer for archived V1 editions.

Acceptance gate:

- Replay over at least 14 historical dates.
- Each healthy replay contains three differentiated recommendations.
- Budget and diversity constraints pass.
- No known exact repeats.
- Manual editorial review finds no generic/index URLs or unsupported claims.
- Local test, typecheck, build, and responsive smoke checks pass.

Rollout:

- Deploy behind an internal V2 feature flag or date-scoped preview.
- Review three to seven generated editions before making V2 the default.

### Phase 3 — Feedback, automatic saves, and continuation

Goal: close the learning loop with minimal effort.

Implementation status: complete for the V2 Reading portfolio. Every reading card
now exposes the agreed one-click actions, direct feedback writes explain how
future ranking changes, the Anchor is automatically saved to a bounded Almanac
reading queue, manual/automatic saves share duplicate-safe idempotency keys, save
receipts name their destination, and saves can be removed. The latest three saves
form a bounded `Continue exploring` shelf. Automatic saves are disabled when
browsing readonly archived editions.

Deliverables:

- Standardize the four one-click actions across all V2 recommendation cards.
- Persist feedback to the existing bounded feedback history.
- Add automatic-save policy evaluation.
- Add durable save receipts and duplicate-safe idempotency keys.
- Add `Continue exploring` from saves and active discussion threads.
- Add user-visible “why this changed future editions” feedback receipts.
- Add a reversible way to remove or correct an automatic save.

Acceptance gate:

- Every action has success/error feedback.
- Retries do not duplicate saved items.
- Automatic save never performs a trade, purchase, public send, or ambiguous
  write.
- A feedback fixture demonstrably changes subsequent ranking.

### Phase 4 — Investment lens

Goal: turn investing data into one daily decision-relevant editorial item.

Deliverables:

- Candidate adapters for:
  - active thesis/holding changes;
  - new ideas;
  - invalidation evidence;
  - valuation or accumulation reviews;
  - material portfolio concentration/drift.
- Balance new ideas and existing-thesis developments over a rolling window.
- Rank by materiality, evidence quality, freshness, and decision relevance.
- Render observation, interpretation, open question, and next research action.
- Automatic saves go only to research/evidence queues.

Acceptance gate:

- No trade execution or language implying execution.
- Every material claim has provenance and an as-of time.
- Stale/degraded investing inputs are visible and penalized.
- Duplicate thesis updates are suppressed unless evidence changed materially.

### Phase 5 — Music inspiration engine

Goal: produce a daily prompt that makes starting music easier.

Deliverables:

- Normalize five music formats:
  - song/riff;
  - production breakdown;
  - sample/sound;
  - creative constraint;
  - 5–15 minute exercise.
- Rotate formats based on candidate quality, recent history, and feedback—not a
  rigid calendar.
- Use existing taste anchors and learned genre/technique preferences.
- Every card ends with a concrete “Try this now” action.
- Save accepted items to a music inspiration/experiment queue.

Acceptance gate:

- No recent format/item repetition.
- Links resolve to the intended media.
- Exercises are specific, short, and feasible.
- Rotation remains flexible enough to choose the best available material.

### Phase 6 — Magazine-first home and operational quieting

Goal: make the finished product feel like a daily magazine and interactive
workspace.

Deliverables:

- Make Almanac V2 the `/` default.
- Refine cover, typography, rhythm, and responsive sequencing.
- Move Briefing/operations behind Workspace/System.
- Add quiet generation/source-health footer.
- Surface only actionable system failures in the edition.
- Improve archive navigation and edition-to-edition continuity.
- Add loading, empty, degraded, and stale-edition states.

Acceptance gate:

- Mobile and desktop screenshot review.
- Keyboard and screen-reader navigation smoke checks.
- The opening viewport contains useful editorial content, not system metrics.
- Stale data is impossible to mistake for a current healthy edition.

### Phase 7 — Adaptive anticipation

Goal: let interests evolve without producing a black-box recommender.

Deliverables:

- Rolling interest profile by topic, source, format, and exploration acceptance.
- Time decay so old preferences do not dominate forever.
- Detect emerging interests from repeated saves/discussions across sources.
- Detect saturation and intentionally widen adjacent discovery.
- Add a compact “What Alphalpha is learning” view with correction controls.
- Periodic editorial audit comparing intended vs. observed diversity.

Acceptance gate:

- Profile changes are explainable and correctable.
- Private source excerpts are not exposed in dashboard payloads.
- No preference is inferred from a single weak event.
- Exploration remains bounded and quality-gated.

## 9. Component plan

Likely new or revised components:

- `AlmanacV2`
- `EditionCover`
- `ReadingPortfolio`
- `RecommendationCard`
- `RecommendationDetail`
- `FeedbackBar`
- `SaveReceipt`
- `InvestmentLens`
- `MusicSpark`
- `ExplorationCard`
- `ContinueExploring`
- `EditionHealth`

Reuse:

- existing thread drawer/discussion flow;
- existing Almanac feedback API patterns;
- existing signal action/receipt patterns;
- existing responsive visual language where it supports the magazine.

Avoid a new component library unless the current primitives prove insufficient.

## 10. Verification strategy

### Unit tests

- URL canonicalization.
- exact and near-duplicate detection.
- exposure cooldown.
- freshness classification.
- obviousness penalties.
- exploration allocation.
- read-time portfolio constraints.
- source/topic diversity.
- feedback weight changes.
- automatic-save eligibility.
- idempotent receipt handling.

### Replay/evaluation tests

- Run old and new selectors across at least 14 historical dates.
- Compare repeat rate, source concentration, freshness, and reading budget.
- Keep a small human-reviewed gold fixture:
  - should select;
  - should reject;
  - acceptable exploration;
  - too obvious;
  - near-duplicate.

### Integration tests

- dry-run edition generation;
- V1 archive compatibility;
- feedback persistence;
- automatic save with a temporary destination;
- no-op duplicate save;
- degraded source fallback;
- failed generation retains previous valid edition.

### Release checks

- `npm test`
- `npm run build`
- local authenticated route smoke test when possible;
- mobile and desktop visual verification;
- push `main` to GitHub;
- production deploy;
- verify `/` redirect/auth and authenticated edition rendering;
- record commit, deployment, and route evidence.

## 11. Rollout and checkpoints

Recommended delivery slices:

1. **Foundation slice:** Phase 0 + Phase 1.
2. **First product slice:** Phase 2 behind preview.
3. **Learning slice:** Phase 3.
4. **Domain slices:** Phase 4 and Phase 5 independently.
5. **Default-home slice:** Phase 6.
6. **Adaptive layer:** Phase 7 after enough real interaction data exists.

Checkpoint with Alex after:

- first replay report;
- first three V2 preview editions;
- first week of feedback/automatic-save behavior;
- investment and music lane previews;
- two weeks after V2 becomes the homepage.

## 12. Risks and mitigations

### Discovery quality is weaker than the UI

Mitigation: quality gate before slot-filling; honest degraded edition; evaluate
against replay fixtures.

### Similarity rejects distinct arguments on the same topic

Mitigation: combine URL/title/entity checks with bounded semantic similarity;
record rejection reasons; maintain reviewed counterexamples.

### Automatic saves create clutter

Mitigation: high threshold, duplicate-safe writes, explicit destination receipts,
reversible correction, acceptance-rate monitoring.

### Exploration becomes random

Mitigation: require a bridge to a known interest and the same quality floor as
familiar recommendations.

### Investing lane becomes convoluted

Mitigation: one item per edition, one open question, one research action; push
detail into the investing workspace.

### Always-on context becomes expensive

Mitigation: consume bounded projections and deltas, not raw private documents;
keep the exposure ledger compact; use deterministic ranking before model
composition.

### Model-generated explanations overclaim

Mitigation: compose only from normalized candidate/provenance fields; validate
attribution; separate observation from interpretation.

## 13. Explicit deferrals

Do not include in the first product slice:

- a generalized recommendation platform;
- vector infrastructure unless simpler fingerprints prove insufficient;
- social sharing or public profiles;
- trade execution;
- broad email ingestion in the browser payload;
- a complex preference-settings panel;
- optimization for engagement time;
- dozens of new Almanac lanes;
- a complete rebuild of unrelated dashboard sections.

## 14. Definition of done

Almanac V2 is complete when:

- it is the default morning homepage;
- it reliably produces a fresh, coherent edition;
- three reading options fit the intended time budget and serve distinct roles;
- investment and music lanes are useful and source-backed;
- exploration averages about 25% without feeling random;
- previously shown or saved material is strongly suppressed;
- feedback and automatic saves are low-friction, durable, and visible;
- interests can evolve through explainable signals;
- stale, repeated, or obvious recommendations are exceptional and diagnosable;
- production operation is reliable, bounded, and recoverable.

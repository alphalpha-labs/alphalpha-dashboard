#!/usr/bin/env node
/**
 * Daily Almanac generator — Phase 0 + Phase 1
 *
 * Usage:
 *   node scripts/generate-almanac.mjs [--date=YYYY-MM-DD] [--dry-run] [--force]
 *
 * Flags:
 *   --date=YYYY-MM-DD  Target date (default: tomorrow in local time)
 *   --dry-run          Compose + validate, print result, do NOT write to KV
 *   --force            Overwrite an existing edition (normally immutable)
 *
 * Each tile follows: Sourcer → Ranker → Composer → Validator
 * Any tile failure falls back to the fixture so the edition is never empty.
 *
 * Phase 1 tiles (deterministic, zero external APIs):
 *   - Quotes (mind + parenting): curated dataset with dedup rotation
 *   - "You" chart: computed from workspace activity manifests
 * All other tiles fall back to fixture in Phase 1.
 *
 * Registration: see scripts/almanac-automation.json for the OpenClaw cron descriptor.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Path setup ───────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(repoRoot, '..');

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const force   = args.includes('--force');
const dateArg = args.find(a => a.startsWith('--date='))?.slice('--date='.length);

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const targetDate = dateArg ?? tomorrow();
if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error(`Invalid date: ${targetDate}. Expected YYYY-MM-DD.`);
  process.exit(1);
}

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[almanac] ${msg}`); }
function warn(msg) { console.warn(`[almanac] WARN: ${msg}`); }

// ── Edition number (days since 2025-10-31, 1-indexed) ───────────────────────

const EPOCH = new Date('2025-10-31T00:00:00Z');

function editionNumber(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const daysDiff = Math.round((d - EPOCH) / 86_400_000);
  return `No. ${daysDiff}`;
}

// ── KV client (optional — fails gracefully when env vars absent) ─────────────

let redis = null;

async function initKV() {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    warn('KV_REST_API_URL / KV_REST_API_TOKEN not set — running KV-less (dry-run only).');
    return;
  }
  try {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({ url, token });
  } catch (e) {
    warn(`@upstash/redis unavailable: ${e.message}`);
  }
}

async function kvGet(key) {
  if (!redis) return null;
  try { return await redis.get(key); } catch { return null; }
}

async function kvSet(key, value) {
  if (!redis) throw new Error('KV not initialised');
  await redis.set(key, value);
}

async function kvScan(pattern) {
  if (!redis) return [];
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(next);
    keys.push(...batch);
  } while (cursor !== 0);
  return keys;
}

// ── Fixture fallback ─────────────────────────────────────────────────────────

function loadFixture() {
  const p = path.join(repoRoot, 'lib', 'generated-data.json');
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data?.daily ?? null;
  } catch { return null; }
}

// ── Validation (plain-JS gate matching lib/almanac-schema.ts shapes) ─────────

function validateQuotes(arr) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('must be non-empty array');
  for (const q of arr) {
    if (!q.text?.trim())   throw new Error('quote missing text');
    if (!q.source?.trim()) throw new Error('quote missing source');
  }
}

function validateChart(c) {
  if (!c.topic?.trim())  throw new Error('chart missing topic');
  if (!c.title?.trim())  throw new Error('chart missing title');
  if (!Array.isArray(c.series) || c.series.length === 0)
    throw new Error('chart series must be non-empty');
  for (const pt of c.series) {
    if (typeof pt.label !== 'string') throw new Error('series point missing label');
    if (typeof pt.value !== 'number') throw new Error('series point value must be number');
  }
}

function validateDailyData(data) {
  if (!data || typeof data !== 'object') throw new Error('not an object');
  if (!data.edition?.trim())   throw new Error('missing edition');
  if (!data.image  || typeof data.image   !== 'object') throw new Error('missing image');
  if (!data.article || typeof data.article !== 'object') throw new Error('missing article');
  if (!data.article.title?.trim()) throw new Error('article missing title');
  if (!data.article.dek?.trim())   throw new Error('article missing dek');
  if (!data.article.why?.trim())   throw new Error('article missing why');
  if (!Array.isArray(data.ventures))     throw new Error('ventures must be array');
  if (!Array.isArray(data.charts))       throw new Error('charts must be array');
  if (!Array.isArray(data.surprises))    throw new Error('surprises must be array');
  validateQuotes(data.quotes);
  validateQuotes(data.parentingQuotes);
  for (const c of data.charts) validateChart(c);
}

// ── KV helpers (feedback weights + history) ───────────────────────────────────

async function loadFeedbackWeights() {
  const weights = {};
  try {
    const keys = await kvScan('alphalpha:almanac:feedback:*');
    const records = await Promise.all(keys.map(k => kvGet(k)));
    for (const rec of records) {
      if (!rec) continue;
      for (const keep of Object.values(rec.keeps ?? {})) {
        const genre = keep.genre ?? 'article';
        if (!weights[genre]) weights[genre] = { keepScore: 0, moreScore: 0, lessScore: 0, chipTallies: {}, notes: [], sourceAffinity: {} };
        weights[genre].keepScore += 1;
        if (keep.sub) weights[genre].sourceAffinity[keep.sub] = (weights[genre].sourceAffinity[keep.sub] ?? 0) + 1;
      }
      for (const tune of Object.values(rec.tunes ?? {})) {
        const genre = tune.itemId?.split('-')[0] ?? 'article';
        if (!weights[genre]) weights[genre] = { keepScore: 0, moreScore: 0, lessScore: 0, chipTallies: {}, notes: [], sourceAffinity: {} };
        if (tune.reaction === 'more') weights[genre].moreScore += 1;
        if (tune.reaction === 'less') weights[genre].lessScore += 1;
        for (const chip of tune.chips ?? []) weights[genre].chipTallies[chip] = (weights[genre].chipTallies[chip] ?? 0) + 1;
        if (tune.note?.trim()) weights[genre].notes.push(tune.note.trim());
      }
    }
  } catch (e) {
    warn(`loadFeedbackWeights failed: ${e.message}`);
  }
  return weights;
}

async function getRecentIds(genre, withinDays = 14) {
  try {
    const entries = await kvGet(`alphalpha:almanac:history:${genre}`);
    if (!entries) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - withinDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return (entries).filter(e => e.date >= cutStr).map(e => e.id);
  } catch { return []; }
}

async function recordUsed(genre, ids, date) {
  try {
    const key = `alphalpha:almanac:history:${genre}`;
    const existing = (await kvGet(key)) ?? [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutStr = cutoff.toISOString().slice(0, 10);
    const kept  = existing.filter(e => e.date >= cutStr);
    const fresh = ids.map(id => ({ id, date }));
    await kvSet(key, [...kept, ...fresh]);
  } catch (e) {
    warn(`recordUsed(${genre}) failed: ${e.message}`);
  }
}

// ── Dataset loader ────────────────────────────────────────────────────────────

function loadQuotesDataset() {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', 'quotes.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

function isoWeekKey(date) {
  // Returns "YYYY-WNN" for the ISO week containing `date`.
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Shift so Monday = 0
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Deterministic offset from date string — keeps the same date → same rotation.
function dateHash(dateStr) {
  let h = 0;
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// ── Phase 1 Tile: Quotes ─────────────────────────────────────────────────────

async function tileQuotes(targetDate, allQuotes, recentMindIds, recentParentingIds) {
  const mindPool      = allQuotes.filter(q => q.genre === 'mind');
  const parentingPool = allQuotes.filter(q => q.genre === 'parenting');

  function pickQuotes(pool, recentIds, count, seed) {
    // Rank: never-seen first, then recently-seen; deterministic tie-break by seed.
    const scored = pool.map((q, i) => ({
      q,
      fresh: !recentIds.includes(q.id),
      tieBreak: (dateHash(seed + q.id)) % pool.length,
      idx: i,
    }));
    scored.sort((a, b) =>
      (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || a.tieBreak - b.tieBreak
    );
    return scored.slice(0, count).map(s => ({ text: s.q.text, source: s.q.source }));
  }

  if (mindPool.length === 0 || parentingPool.length === 0) {
    throw new Error('quotes dataset missing mind or parenting entries');
  }

  const quotes         = pickQuotes(mindPool,      recentMindIds,      4, `${targetDate}-mind`);
  const parentingQuotes = pickQuotes(parentingPool, recentParentingIds, 4, `${targetDate}-parenting`);

  validateQuotes(quotes);
  validateQuotes(parentingQuotes);

  return { quotes, parentingQuotes };
}

// ── Phase 1 Tile: "You" chart ─────────────────────────────────────────────────

function tileYouChart(targetDate) {
  // Read workspace activity manifest: memory/dashboard/action-state.json
  // Falls back to null if the file is absent (generator caller will use fixture).
  const manifestPath = path.join(workspaceRoot, 'memory', 'dashboard', 'action-state.json');
  if (!fs.existsSync(manifestPath)) return null;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch { return null; }

  const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
  // "Done" actions are those that close a loop: action === 'done' or type === 'done',
  // and the entry was successfully applied (no error).
  const doneActions = actions.filter(a => {
    const isDone = a.action === 'done' || a.type === 'done';
    const failed = Boolean(a.error || a.result?.error || a.status === 'failed');
    return isDone && !failed;
  });

  if (doneActions.length < 2) return null; // too sparse to chart meaningfully

  // Group by ISO week
  const weekCounts = {};
  for (const a of doneActions) {
    const at = a.at || a.timestamp;
    if (!at) continue;
    const d = new Date(at);
    if (isNaN(d.getTime())) continue;
    const wk = isoWeekKey(d);
    weekCounts[wk] = (weekCounts[wk] ?? 0) + 1;
  }

  const sortedWeeks = Object.keys(weekCounts).sort();
  // Use last 5 complete weeks preceding or containing targetDate
  const targetWeek = isoWeekKey(new Date(`${targetDate}T00:00:00Z`));
  const relevantWeeks = sortedWeeks.filter(w => w <= targetWeek).slice(-5);
  if (relevantWeeks.length < 2) return null;

  const series = relevantWeeks.map((wk, i) => ({
    label: `W${i + 1}`,
    value: weekCounts[wk],
  }));

  // Dynamic note: compare last week vs. previous
  const last = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  const trend = last > prev ? 'Up from last week' : last < prev ? 'Down from last week' : 'Same as last week';

  const chart = {
    topic:  'You',
    title:  'Open loops you closed per week',
    unit:   'loops / week',
    note:   `${trend} — the system is working on you, not just your money.`,
    why:    'A quiet personal metric — proof the system is working.',
    series,
  };

  validateChart(chart);
  return chart;
}

// ── Tile pipeline runner ─────────────────────────────────────────────────────

async function runTile(name, fn, fallbackValue) {
  try {
    const result = await fn();
    if (result === null || result === undefined) {
      log(`  ${name}: no data — using fixture fallback`);
      return fallbackValue;
    }
    log(`  ${name}: OK`);
    return result;
  } catch (e) {
    warn(`  ${name}: ${e.message} — using fixture fallback`);
    return fallbackValue;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Generating edition for ${targetDate}${dryRun ? ' (dry-run)' : ''}${force ? ' (force)' : ''}`);

  await initKV();

  const editionKey = `alphalpha:almanac:edition:${targetDate}`;

  // Check immutability unless --force
  if (!dryRun && !force) {
    const existing = await kvGet(editionKey);
    if (existing) {
      log(`Edition ${targetDate} already exists. Use --force to overwrite.`);
      return;
    }
  }

  // Load inputs
  const [feedbackWeights, allQuotes, fixture] = await Promise.all([
    loadFeedbackWeights(),
    Promise.resolve(loadQuotesDataset()),
    Promise.resolve(loadFixture()),
  ]);

  if (!fixture) {
    console.error('[almanac] ERROR: fixture fallback unavailable — lib/generated-data.json missing or has no daily block');
    process.exit(1);
  }

  const [recentMindIds, recentParentingIds, recentChartIds] = await Promise.all([
    getRecentIds('quote-mind'),
    getRecentIds('quote-parenting'),
    getRecentIds('chart'),
  ]);

  log(`Feedback genres with signal: ${Object.keys(feedbackWeights).join(', ') || 'none yet'}`);
  log(`Recent mind IDs: ${recentMindIds.length}, parenting: ${recentParentingIds.length}`);

  // ── Phase 1 tiles ────────────────────────────────────────────────────────

  log('Running tile pipeline…');

  // Quotes (deterministic, no LLM)
  const { quotes, parentingQuotes } = await runTile(
    'quotes',
    () => tileQuotes(targetDate, allQuotes, recentMindIds, recentParentingIds),
    { quotes: fixture.quotes, parentingQuotes: fixture.parentingQuotes },
  );

  // "You" chart (computed from activity manifest, no LLM)
  const youChart = await runTile(
    '"You" chart',
    () => tileYouChart(targetDate),
    null, // null means: keep fixture charts as-is (see assembly below)
  );

  // ── Phase 1 fallback tiles (fixture pass-through) ────────────────────────

  const image     = fixture.image;
  const article   = fixture.article;
  const ventures  = fixture.ventures ?? [];
  const surprises = fixture.surprises ?? [];

  // Charts: replace/inject the "You" chart if we have live data; otherwise keep fixture.
  let charts;
  if (youChart) {
    // Replace the existing "You" topic chart if present, else append.
    const others = (fixture.charts ?? []).filter(c => c.topic !== 'You');
    charts = [...others, youChart];
  } else {
    charts = fixture.charts ?? [];
  }

  // ── Assemble ─────────────────────────────────────────────────────────────

  const edition = {
    edition:         editionNumber(targetDate),
    image,
    article,
    ventures,
    charts,
    quotes,
    parentingQuotes,
    surprises,
  };

  // Final validation gate
  try {
    validateDailyData(edition);
  } catch (e) {
    console.error(`[almanac] FATAL: final validation failed: ${e.message}`);
    console.error('[almanac] Aborting — edition NOT written.');
    process.exit(1);
  }

  log(`Edition assembled: ${edition.edition}`);
  log(`  quotes: ${edition.quotes.length} mind, ${edition.parentingQuotes.length} parenting`);
  log(`  charts: ${edition.charts.length} (You chart: ${youChart ? 'live' : 'fixture'})`);

  if (dryRun) {
    log('Dry-run — printing edition and exiting without writing to KV.');
    console.log(JSON.stringify(edition, null, 2));
    return;
  }

  // Write to KV (immutable unless --force)
  if (!redis) {
    console.error('[almanac] ERROR: KV not available. Cannot write edition. Use --dry-run to preview.');
    process.exit(1);
  }

  await kvSet(editionKey, edition);
  log(`Written to KV: ${editionKey}`);

  // Record used IDs in history for dedup
  const usedMindIds = edition.quotes
    .map(q => allQuotes.find(aq => aq.text === q.text && aq.genre === 'mind')?.id)
    .filter(Boolean);
  const usedParentingIds = edition.parentingQuotes
    .map(q => allQuotes.find(aq => aq.text === q.text && aq.genre === 'parenting')?.id)
    .filter(Boolean);
  const usedChartIds = youChart ? [`you-chart-${targetDate}`] : [];

  await Promise.all([
    recordUsed('quote-mind',      usedMindIds,      targetDate),
    recordUsed('quote-parenting', usedParentingIds, targetDate),
    recordUsed('chart',           usedChartIds,     targetDate),
  ]);

  log(`History updated. Done.`);
}

main().catch(e => {
  console.error('[almanac] Unhandled error:', e);
  process.exit(1);
});

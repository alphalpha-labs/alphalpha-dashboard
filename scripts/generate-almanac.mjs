#!/usr/bin/env node
/**
 * Daily Almanac generator — Phase 0–6
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
 *
 * Phase 2 tiles (workspace data + LLM via OpenClaw):
 *   - Article: sourced from Obsidian article-candidates dir; LLM writes dek + why
 *     (falls back gracefully when OpenClaw env vars are absent)
 *
 * Phase 3 tiles (open-license APIs + optional LLM captions):
 *   - Image / Look: prefers tasteful AI / generative art from Wikimedia Commons,
 *     then falls back to Met Museum + Art Institute of Chicago zero-key APIs;
 *     LLM writes caption + curator note (falls back to candidate metadata)
 *
 * Phase 4 tiles (workspace candidates + LLM; 21-day dedup window):
 *   - Ventures: sourced from workspace VENTURES.md / Obsidian vault / memory manifests;
 *     LLM generates full DailyVenture struct with TAM/growth labeled as estimates;
 *     competitor names must be real companies; falls back to fixture array
 *
 * Phase 5 tiles (LLM + curated artifact list; 7-day form rotation):
 *   - Surprise: rotating forms (Word / Provocation / Artifact); Artifact picks from
 *     lib/almanac-datasets/artifacts.json; LLM writes body + note; Recipe deferred
 *
 * Phase 6 tiles (curated dataset + RSS; no external paid API keys):
 *   - Signal / chart code remains available, but the shipped Almanac suppresses
 *     chart tiles until the lane earns its space again.
 *   - Article RSS: supplementary sourcer fetches public RSS feeds for known publications;
 *     merged with workspace candidates before ranking; FRED/EIA wiring deferred
 *
 * All other tiles fall back to fixture.
 *
 * Registration: see scripts/almanac-automation.json for the OpenClaw cron descriptor.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  callOpenClaw,
  createWebDiscovery,
  feedbackHints,
  extractYouTubeId,
  htmlToText,
  hostOf,
} from './lib/web-discovery.mjs';
import {
  articleFeedbackProfile,
  imageFeedbackProfile,
  isBlockedReadingUrl,
  isAiFocusedText,
  isAiToolingText,
  isArticleIndexText,
  isGenericReadingUrl,
  isReadingBadFormatText,
  isReadingAlreadyUsedStatus,
  normalizeReadingPublishedDate,
  readingSelectionSignalSummary,
  readingFreshnessScore,
  readingSourceQualityFit,
  readingProvenanceFit,
  readableSourceLabel,
  articleDayFit,
  austinExploreSeasonFit,
  longReadDayFit,
  readingLaneBalanceFit,
  isVideoHost,
  wantsLessAiFocus,
  workshopNoteTerms,
} from './lib/almanac-feedback-selection.mjs';
import {
  assessCandidateNovelty,
  buildExposureEvent,
  compactExposureLedger,
  evaluateNoveltyPool,
} from './lib/almanac-novelty.mjs';
import {
  selectReadingPortfolio,
  toReadingRecommendation,
} from './lib/almanac-reading-portfolio.mjs';
import {
  buildInvestmentLensCandidates,
  selectInvestmentLens,
} from './lib/almanac-investment-lens.mjs';
import {
  buildMusicSparkCandidates,
  selectMusicSpark,
} from './lib/almanac-music-spark.mjs';

// Feedback-honed web discovery, initialised in main(). null until then; tile
// sourcers check `webDiscovery?.available` and fall back to curated sources.
let webDiscovery = null;

// ── Path setup ───────────────────────────────────────────────────────────────

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const repoRoot      = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(repoRoot, '..');

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const force   = args.includes('--force');
const dateArg = args.find(a => a.startsWith('--date='))?.slice('--date='.length);

const ALMANAC_TIME_ZONE = 'America/Chicago';
const almanacDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ALMANAC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function almanacTodayIso(now = new Date()) {
  const parts = almanacDateFormatter.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not format Almanac date');
  return `${year}-${month}-${day}`;
}

function addDaysToIso(dateIso, days) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

function tomorrow() {
  return addDaysToIso(almanacTodayIso(), 1);
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
  return `No. ${daysDiff + 1}`; // 1-indexed: epoch day = No. 1
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

async function kvSetBestEffort(key, value) {
  if (!redis) return;
  try { await redis.set(key, value); } catch {}
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

const runStatusKey = `alphalpha:almanac:run:${targetDate}`;
const runStartedAt = new Date().toISOString();

async function setRunStatus(status, phase, extra = {}) {
  await kvSetBestEffort(runStatusKey, {
    date: targetDate,
    status,
    phase,
    provider: process.env.ALMANAC_SEARCH_PROVIDER || 'auto',
    dryRun,
    force,
    startedAt: runStartedAt,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

// ── Fixture fallback ─────────────────────────────────────────────────────────

function loadFixture() {
  for (const file of ['generated-data.local.json', 'generated-data.snapshot.json']) {
    const p = path.join(repoRoot, 'lib', file);
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data?.daily) return data.daily;
    } catch {}
  }
  return null;
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
  if (!c.topic?.trim()) throw new Error('chart missing topic');
  if (!c.title?.trim()) throw new Error('chart missing title');
  if (!Array.isArray(c.series) || c.series.length === 0)
    throw new Error('chart series must be non-empty');
  for (const pt of c.series) {
    if (typeof pt.label !== 'string') throw new Error('series point missing label');
    if (typeof pt.value !== 'number') throw new Error('series point value must be number');
  }
}

function validateDailyData(data) {
  if (!data || typeof data !== 'object') throw new Error('not an object');
  if (!data.edition?.trim())    throw new Error('missing edition');
  if (!data.image  || typeof data.image   !== 'object') throw new Error('missing image');
  if (!data.article || typeof data.article !== 'object') throw new Error('missing article');
  if (!data.article.title?.trim()) throw new Error('article missing title');
  if (!data.article.dek?.trim())   throw new Error('article missing dek');
  if (!data.article.why?.trim())   throw new Error('article missing why');
  if (!Array.isArray(data.ventures))  throw new Error('ventures must be array');
  if (!Array.isArray(data.charts))    throw new Error('charts must be array');
  if (!Array.isArray(data.surprises)) throw new Error('surprises must be array');
  if (data.riffs && !Array.isArray(data.riffs)) throw new Error('riffs must be array');
  if (data.productionClips && !Array.isArray(data.productionClips)) throw new Error('productionClips must be array');
  validateQuotes(data.quotes);
  validateQuotes(data.parentingQuotes);
  if (data.reading?.length) {
    if (data.reading.length !== 3) throw new Error('reading portfolio must contain exactly three items when present');
    const roles = data.reading.map(item => item.role);
    if (new Set(roles).size !== 3 || !['anchor', 'lens', 'frontier'].every(role => roles.includes(role))) {
      throw new Error('reading portfolio must contain anchor, lens, and frontier roles');
    }
    if (data.readingPortfolio?.status === 'healthy') {
      const minutes = data.reading.reduce((sum, item) => sum + Number(item.readMinutes || 0), 0);
      if (minutes < 20 || minutes > 45) throw new Error(`healthy reading portfolio outside 20–45 minute budget: ${minutes}`);
    }
  }
  if (data.investmentLens) {
    for (const field of ['id', 'kind', 'title', 'observation', 'interpretation', 'openQuestion', 'nextResearchAction', 'posture', 'asOf']) {
      if (!String(data.investmentLens[field] || '').trim()) throw new Error(`investment lens missing ${field}`);
    }
    if (!/no trade|no allocation|research|observation/i.test(data.investmentLens.posture)) {
      throw new Error('investment lens must state its non-execution boundary');
    }
  }
  if (data.musicSpark) {
    if (!data.musicSpark.title?.trim() || !data.musicSpark.tryThisNow?.trim()) throw new Error('music spark missing title or action');
    if (data.musicSpark.durationMinutes < 5 || data.musicSpark.durationMinutes > 15) throw new Error('music spark action must take 5–15 minutes');
  }
  for (const c of data.charts) validateChart(c);
  runAlmanacQa(data);
}

function runAlmanacQa(data) {
  const failures = [];
  const macroRead = data.macroRead ?? data.longReads?.[0] ?? null;

  if (data.article?.url && isBlockedReadingUrl(data.article.url)) {
    failures.push(`Society & Ideas article uses blocked source: ${data.article.url}`);
  }
  if (data.article?.url && isGenericReadingUrl(data.article.url)) {
    failures.push(`Society & Ideas article needs an exact article URL, not a generic publication page: ${data.article.url}`);
  }
  if (macroRead?.url && isBlockedReadingUrl(macroRead.url)) {
    failures.push(`Macro / Investing read uses blocked source: ${macroRead.url}`);
  }
  if (data.charts?.length) failures.push('Signal/chart tile is disabled but charts were emitted');
  if (!data.article?.title?.trim()) failures.push('Society & Ideas read is missing');
  if (!macroRead?.title?.trim()) failures.push('Macro / Investing read is missing');
  if (macroRead?.title && data.article?.title && titleKey(macroRead.title) === titleKey(data.article.title)) {
    failures.push('Society & Ideas and Macro / Investing reads selected the same title');
  }

  if (failures.length) throw new Error(`QA failed: ${failures.join('; ')}`);
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
      const tunesBySignal = new Map();
      const addTune = (tune) => {
        if (!tune?.itemId) return;
        const key = `${tune.itemId}:${tune.at ?? ''}:${tune.note ?? ''}`;
        tunesBySignal.set(key, tune);
      };
      for (const entry of Object.values(rec.history ?? {}).flat()) {
        if (entry?.type === 'tune') addTune(entry);
      }
      for (const tune of Object.values(rec.tunes ?? {})) addTune(tune);

      for (const tune of tunesBySignal.values()) {
        // itemId from Almanac.tsx: "article:Title", "image:daily", "surprise:Title" etc.
        // Split on colon or hyphen to handle both "article:..." and legacy "quote-mind-3".
        const genre = tune.genre ?? tune.itemId?.split(/[:-]/)[0] ?? 'article';
        if (!weights[genre]) weights[genre] = { keepScore: 0, moreScore: 0, lessScore: 0, chipTallies: {}, notes: [], sourceAffinity: {} };
        if (tune.reaction === 'more') weights[genre].moreScore += 1;
        if (tune.reaction === 'less') weights[genre].lessScore += 1;
        for (const chip of tune.chips ?? []) weights[genre].chipTallies[chip] = (weights[genre].chipTallies[chip] ?? 0) + 1;
        if (tune.note?.trim()) weights[genre].notes.push(tune.note.trim());
        if (tune.interpretation?.trim()) weights[genre].notes.push(tune.interpretation.trim());
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
    return entries.filter(e => e.date >= cutStr).map(e => e.id);
  } catch { return []; }
}

function titleKey(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}

function linkKey(url = '') {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const param of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(param)) u.searchParams.delete(param);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return String(url).replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function articleQueueHistoryIds() {
  const rel = path.join('obsidian-vault', 'Alphalpha', 'Syntheses', 'Reading', 'Article Queue.md');
  let text = '';
  for (const base of [workspaceRoot, path.dirname(workspaceRoot)]) {
    const p = path.join(base, rel);
    if (fs.existsSync(p)) {
      text = fs.readFileSync(p, 'utf8');
      break;
    }
  }
  if (!text) return [];

  const ids = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/weekly-pick|kindle packet|delivery audit|weekly-article-audit/i.test(line)) continue;
    const wikiTitle = line.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)?.[1];
    if (wikiTitle) ids.add(`title:${titleKey(wikiTitle)}`);
    for (const url of line.match(/https?:\/\/[^\s|)]+/g) ?? []) ids.add(linkKey(url));
  }
  return [...ids];
}

async function recordUsed(genre, ids, date) {
  try {
    const key      = `alphalpha:almanac:history:${genre}`;
    const existing = (await kvGet(key)) ?? [];
    const cutoff   = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutStr = cutoff.toISOString().slice(0, 10);
    const kept   = existing.filter(e => e.date >= cutStr);
    const fresh  = ids.map(id => ({ id, date }));
    await kvSet(key, [...kept, ...fresh]);
  } catch (e) {
    warn(`recordUsed(${genre}) failed: ${e.message}`);
  }
}

const exposureLedgerKey = 'alphalpha:almanac:exposure:v2';

async function loadExposureLedger() {
  const stored = (await kvGet(exposureLedgerKey)) ?? [];
  if (!redis) return compactExposureLedger(Array.isArray(stored) ? stored : []);

  // Seed/mend the compact ledger from recent immutable editions. This makes the
  // novelty layer useful on its first live run without requiring a separate migration.
  const editionKeys = (await kvScan('alphalpha:almanac:edition:*'))
    .sort()
    .slice(-90);
  const editions = await Promise.all(editionKeys.map(key => kvGet(key)));
  const seeded = [];
  for (let index = 0; index < editions.length; index += 1) {
    const edition = editions[index];
    if (!edition || typeof edition !== 'object') continue;
    const editionDate = edition.date
      || editionKeys[index]?.split(':').pop()
      || '';
    const readingItems = [
      edition.article,
      edition.macroRead,
      ...(edition.longReads ?? []),
      ...(edition.reading ?? []),
    ].filter(Boolean);
    for (const item of readingItems) seeded.push(buildExposureEvent(item, editionDate));
  }
  return compactExposureLedger([
    ...(Array.isArray(stored) ? stored : []),
    ...seeded,
  ]);
}

async function recordExposures(items, date) {
  if (!redis || !items.length) return;
  try {
    const existing = (await kvGet(exposureLedgerKey)) ?? [];
    const fresh = items.map(item => buildExposureEvent(item, date));
    await kvSet(exposureLedgerKey, compactExposureLedger([
      ...(Array.isArray(existing) ? existing : []),
      ...fresh,
    ]));
  } catch (e) {
    warn(`recordExposures failed: ${e.message}`);
  }
}

// ── Dataset loader ────────────────────────────────────────────────────────────

function loadQuotesDataset() {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', 'quotes.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function loadWorkspaceJson(relativePath) {
  const p = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// ── Markdown parsing helpers ──────────────────────────────────────────────────
// Mirrors the subset used in generate-dashboard-data.mjs.

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

function mdLines(md) { return md.split(/\r?\n/).map(l => l.trimEnd()); }

function extractSection(md, heading) {
  const all   = mdLines(md);
  const start = all.findIndex(l => l.trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return '';
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const end   = all.findIndex((l, i) => i > start && /^#+\s+/.test(l) && (l.match(/^#+/)?.[0].length ?? 99) <= level);
  return all.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

function extractBullets(md) {
  return mdLines(md)
    .filter(l => /^-\s+/.test(l.trim()))
    .map(l => stripMarkdown(l));
}

function parseFrontmatter(md) {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  let current  = null;
  for (const row of match[1].split(/\r?\n/)) {
    const kv = row.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) { current = kv[1]; result[current] = kv[2] || ''; continue; }
    const li = row.match(/^\s+-\s+(.*)$/);
    if (li && current) {
      if (!Array.isArray(result[current])) result[current] = result[current] ? [result[current]] : [];
      result[current].push(li[1]);
    }
  }
  return result;
}

function parseMarkdownLink(text) {
  const link = text?.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (link) return link[2];
  const bare = text?.match(/https?:\/\/\S+/);
  return bare ? bare[0] : null;
}

// ── OpenClaw LLM proxy ────────────────────────────────────────────────────────
// callOpenClaw now lives in scripts/lib/web-discovery.mjs (single implementation,
// shared by the composer and the web_search-tool provider) and is imported above.

// ── Context reader (open loops + projects from workspace) ─────────────────────

function readContextFiles() {
  const contextRoot = process.env.ALPHALPHA_CONTEXT_DIR
    ? path.resolve(process.env.ALPHALPHA_CONTEXT_DIR)
    : path.join(workspaceRoot, 'context');

  function readFile(rel) {
    const p = path.join(contextRoot, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  }

  return {
    openLoopsText: readFile('OPEN_LOOPS.md'),
    projectsText:  readFile('PROJECTS.md'),
    postureText:   readFile('POSTURE.md'),
  };
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

function isoWeekKey(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day      = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - day + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Deterministic offset from date string — same date always yields same picks.
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
    const scored = pool.map(q => ({
      q,
      fresh:    !recentIds.includes(q.id),
      tieBreak: dateHash(seed + q.id) % pool.length,
    }));
    scored.sort((a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || a.tieBreak - b.tieBreak);
    return scored.slice(0, count).map(s => ({ text: s.q.text, source: s.q.source }));
  }

  if (mindPool.length === 0 || parentingPool.length === 0)
    throw new Error('quotes dataset missing mind or parenting entries');

  const quotes          = pickQuotes(mindPool,      recentMindIds,      4, `${targetDate}-mind`);
  const parentingQuotes = pickQuotes(parentingPool, recentParentingIds, 4, `${targetDate}-parenting`);

  validateQuotes(quotes);
  validateQuotes(parentingQuotes);
  return { quotes, parentingQuotes };
}

// ── Phase 1 Tile: "You" chart ─────────────────────────────────────────────────

function tileYouChart(targetDate) {
  const manifestPath = path.join(workspaceRoot, 'memory', 'dashboard', 'action-state.json');
  if (!fs.existsSync(manifestPath)) return null;

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch { return null; }

  const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
  const doneActions = actions.filter(a => {
    const isDone = a.action === 'done' || a.type === 'done';
    const failed = Boolean(a.error || a.result?.error || a.status === 'failed');
    return isDone && !failed;
  });

  if (doneActions.length < 2) return null;

  const weekCounts = {};
  for (const a of doneActions) {
    const at = a.at || a.timestamp;
    if (!at) continue;
    const d = new Date(at);
    if (isNaN(d.getTime())) continue;
    const wk = isoWeekKey(d);
    weekCounts[wk] = (weekCounts[wk] ?? 0) + 1;
  }

  const targetWeek   = isoWeekKey(new Date(`${targetDate}T00:00:00Z`));
  const relevantWeeks = Object.keys(weekCounts).sort().filter(w => w <= targetWeek).slice(-5);
  if (relevantWeeks.length < 2) return null;

  const series = relevantWeeks.map((wk, i) => ({ label: `W${i + 1}`, value: weekCounts[wk] }));
  const last  = series[series.length - 1].value;
  const prev  = series[series.length - 2].value;
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

// ── Phase 2 Tile: Article ─────────────────────────────────────────────────────

function sourceArticleCandidates() {
  // Mirror parseArticleCandidates() from generate-dashboard-data.mjs.
  const candidatesDir = (() => {
    const rel = path.join('obsidian-vault', 'Alphalpha', 'Syntheses', 'Reading', 'Candidates');
    for (const base of [workspaceRoot, path.dirname(workspaceRoot)]) {
      const p = path.join(base, rel);
      if (fs.existsSync(p)) return p;
    }
    return path.join(workspaceRoot, rel); // canonical; will fail gracefully below
  })();

  if (!fs.existsSync(candidatesDir)) return [];

  return fs.readdirSync(candidatesDir)
    .filter(n => n.endsWith('.md') && !n.startsWith('.'))
    .sort()
    .map((name, idx) => {
      const full = path.join(candidatesDir, name);
      const text = fs.readFileSync(full, 'utf8');
      const fm   = parseFrontmatter(text);
      const title = stripMarkdown((text.match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, '')).trim());
      // Use same heading text as the dashboard builder.
      const why = firstSentence(
        extractSection(text, '## Why it might fit Alex') || text,
        'Article candidate.',
      );
      return {
        id:     `articles-${idx + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`,
        title,
        status: fm.status || 'Queued',
        source: fm.source || fm.publication || null,
        link:   fm.url || parseMarkdownLink(text) || null,
        publishedAt: normalizeReadingPublishedDate(fm.publishedAt || fm.published || fm.date || ''),
        why,
        themes: Array.isArray(fm.themes) ? fm.themes : [],
      };
    })
    // Skip anything already read, sent, dismissed, or picked by the weekly recommender.
    .filter(c => !isReadingAlreadyUsedStatus(c.status))
    .filter(c => !c.link || !isBlockedReadingUrl(c.link))
    .filter(c => !c.link || !isGenericReadingUrl(c.link))
    .filter(c => !isArticleIndexText(`${c.title} ${c.why} ${c.link ?? ''}`))
    .filter(c => !isReadingBadFormatText(`${c.title} ${c.why} ${c.link ?? ''}`));
}

function sourceSocietyArticleCandidates() {
  const dataset = loadWorkshopDataset('long-reads.json');
  const macroRe = /\b(macro|investing|investment|markets|finance|rates|portfolio|sector|qje|akerlof|lynalden|pinebrook|diff|byrne hobart)\b/i;
  return dataset
    .filter(read => {
      const blob = `${read.title} ${read.source} ${read.frame} ${read.thesis} ${read.why} ${(read.tags ?? []).join(' ')}`;
      return !macroRe.test(blob);
    })
    .map((read, idx) => ({
      id:     `society-curated-${read.id ?? idx}`,
      title:  read.title,
      status: 'Queued',
      source: read.source,
      link:   read.url,
      publishedAt: normalizeReadingPublishedDate(read.publishedAt || read.date || ''),
      why:    read.thesis || read.why,
      themes: read.tags ?? [],
    }))
    .filter(c => c.title && (!c.link || (!isBlockedReadingUrl(c.link) && !isGenericReadingUrl(c.link))));
}

function rankArticle(candidates, feedbackWeights, recentIds, exposureLedger, openLoopsText, projectsText) {
  if (candidates.length === 0) return { best: null, rankedCandidates: [], report: evaluateNoveltyPool([], exposureLedger, { targetDate }) };

  const aw = feedbackWeights.article ?? {};
  const feedbackProfile = articleFeedbackProfile(aw);
  const report = evaluateNoveltyPool(candidates, exposureLedger, { targetDate });
  const assessments = new Map(report.assessments.map(item => [item.id, item]));

  // Keywords from open loops and project names for overlap scoring.
  const loopKeywords = extractBullets(openLoopsText)
    .flatMap(l => l.toLowerCase().split(/\W+/))
    .filter(w => w.length > 4);
  const projectNames = (projectsText.match(/^##\s+\d+\.\s+(.+)$/gm) ?? [])
    .map(l => stripMarkdown(l).replace(/^\d+\.\s+/, '').toLowerCase());
  const societyTerms = [
    'religion', 'religious', 'church', 'faith', 'politics', 'political',
    'society', 'social', 'culture', 'cultural', 'human', 'family',
    'class', 'community', 'institutions', 'governance', 'cities',
    'education', 'psychology', 'philosophy', 'moral', 'ethics',
  ];
  const macroTechTerms = [
    'semiconductor', 'chips', 'lithography', 'ai', 'llm', 'machine learning',
    'startup', 'venture', 'markets', 'investing', 'portfolio', 'crypto',
    'software', 'developer', 'infrastructure',
  ];

  const scored = candidates.map(c => {
    let score = 1.0;
    const candidateTitleKey = `title:${titleKey(c.title)}`;
    const candidateLinkKey = c.link ? linkKey(c.link) : null;
    const blob = `${c.title} ${c.why} ${c.themes.join(' ')}`.toLowerCase();
    const novelty = assessments.get(c.id)
      ?? assessCandidateNovelty(c, exposureLedger, { targetDate });

    // Dedup: reject anything seen in the last 14 days by id, canonical link, or normalized title.
    if (recentIds.includes(c.id) || recentIds.includes(candidateTitleKey) || (candidateLinkKey && recentIds.includes(candidateLinkKey)))
      score -= 100;
    if (!novelty.eligible) score -= 100;
    else score += novelty.noveltyScore - novelty.penalty;

    // Hard user preference: when feedback says less/no AI-focused Reading, AI/ML/LLM pieces are out.
    if (feedbackProfile.avoidAiFocused && isAiFocusedText(blob)) score -= 100;
    if (feedbackProfile.avoidAiTooling && isAiToolingText(`${blob} ${c.source ?? ''} ${c.link ?? ''}`)) score -= 100;

    // Source affinity learned from kept articles.
    if (c.source) score += (aw.sourceAffinity?.[c.source] ?? 0) * 0.2;
    score += readingProvenanceFit(c).score;
    score += readingFreshnessScore(c, targetDate);
    score += readingSourceQualityFit(c).score;
    if (c.link && isVideoHost(hostOf(c.link))) score -= 100;
    if (c.link && isBlockedReadingUrl(c.link)) score -= 100;
    if (c.link && isGenericReadingUrl(c.link)) score -= 100;
    if (isArticleIndexText(`${c.title} ${c.why} ${c.link ?? ''}`)) score -= 100;
    if (isReadingBadFormatText(`${c.title} ${c.why} ${c.link ?? ''}`)) score -= 100;
    if (c.link && feedbackProfile.avoidHosts.some(h => hostOf(c.link).endsWith(h))) score -= 3;

    // Nuance-chip signals from feedback.
    if ((aw.chipTallies?.['love the source']  ?? 0) > 0) score += 0.3;
    if ((aw.chipTallies?.['seen it']          ?? 0) > 0) score -= 0.3;
    if ((aw.chipTallies?.['too long']         ?? 0) > 0) score -= 0.2;
    if ((aw.chipTallies?.['go deeper']        ?? 0) > 0) score += 0.1;

    // Open-loop keyword overlap.
    score += articleDayFit(c, targetDate).score;
    score += feedbackProfile.preferTerms.filter(term => blob.includes(term)).length * 0.65;
    const societyHits = societyTerms.filter(term => blob.includes(term)).length;
    score += societyHits * 0.55;
    if (societyHits === 0) score -= 2.5;
    if (macroTechTerms.some(term => blob.includes(term)) && societyHits === 0) score -= 4;
    score += loopKeywords.filter(kw => blob.includes(kw)).length * 0.1;

    // Project-name overlap.
    score += projectNames.filter(pn => blob.includes(pn)).length * 0.15;

    return { ...c, score, novelty };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    best: scored[0].score < -5 ? null : scored[0],
    rankedCandidates: scored.filter(candidate => candidate.score >= -5),
    report: {
      ...report,
      selectedId: scored[0].score < -5 ? null : scored[0].id,
      selectedNovelty: scored[0].score < -5 ? null : scored[0].novelty,
    },
  };
}

function formatReadingDate(dateIso) {
  if (!dateIso) return '';
  const d = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function readingAgeDays(dateIso, relativeDateIso = targetDate) {
  if (!dateIso || !relativeDateIso) return null;
  const published = new Date(`${dateIso}T00:00:00Z`);
  const relative = new Date(`${relativeDateIso}T00:00:00Z`);
  if (Number.isNaN(published.getTime()) || Number.isNaN(relative.getTime())) return null;
  return Math.max(0, Math.round((relative - published) / 86_400_000));
}

function describeReadingAge(publishedAt) {
  const days = readingAgeDays(publishedAt);
  if (days === null) return 'evergreen';
  if (days === 0) return 'published today';
  if (days === 1) return '1 day old';
  if (days < 45) return `${days} days old`;
  const months = Math.max(1, Math.round(days / 30));
  return `${months} months old`;
}

function readingProvenanceLabel(candidate) {
  return readingProvenanceFit(candidate).label;
}

function articleSourceContext(candidate, publishedAt, articleWeights = {}) {
  const age = describeReadingAge(publishedAt);
  const provenance = readingProvenanceLabel(candidate);
  const themeHint = (candidate?.themes ?? []).slice(0, 2).join(', ');
  const dayFit = articleDayFit(candidate, targetDate).label.replace(/\.+$/, '');
  const sourceQuality = readingSourceQualityFit(candidate).label.replace(/\.+$/, '');
  const signals = readingSelectionSignalSummary(articleWeights);
  const suffix = [
    dayFit,
    sourceQuality,
    themeHint ? `themes: ${themeHint}` : '',
    signals ? `signals: ${signals}` : '',
  ].filter(Boolean).join('; ');
  return `${provenance}; ${age}; ranked for Society & Ideas fit${suffix ? `; ${suffix}` : ''}.`;
}

function withReadingDate(readTime, publishedLabel) {
  const cleanReadTime = String(readTime || '8 min').trim();
  if (!publishedLabel || cleanReadTime.includes(publishedLabel)) return cleanReadTime;
  return `${cleanReadTime} · ${publishedLabel}`;
}

async function composeArticle(candidate, contextFiles, articleWeights = {}) {
  const { openLoopsText, projectsText } = contextFiles;

  // Estimate read time from source type when LLM is unavailable.
  const longForm = ['works in progress', 'the atlantic', 'new yorker', 'aeon',
                    'foreign affairs', 'n+1', 'harpers', 'london review'];
  const isLong = longForm.some(s => candidate.source?.toLowerCase().includes(s));
  const fallbackReadTime = isLong ? '12 min' : '8 min';
  const publishedAt = normalizeReadingPublishedDate(candidate.publishedAt || candidate.date || '');
  const publishedLabel = formatReadingDate(publishedAt);

  const loops    = extractBullets(openLoopsText).slice(0, 8).join('\n') || '(none available)';
  const projects = (projectsText.match(/^##\s+\d+\.\s+(.+)$/gm) ?? [])
    .map(l => stripMarkdown(l).replace(/^\d+\.\s+/, '')).slice(0, 6).join(', ') || '(none available)';

  const systemPrompt =
`You are the editorial voice of Alphalpha, a personal AI chief-of-staff daily brief.
Write two short copy fields for today's Reading pick. Be specific and direct — no filler.
Attribution discipline: describe only what the candidate note confirms; do not fabricate the article's argument.`;

  const userPrompt =
`Article: "${candidate.title}"
Source: ${candidate.source ?? 'Unknown'}
Why it might fit: ${candidate.why}${candidate.themes.length ? `\nThemes: ${candidate.themes.join(', ')}` : ''}

Alex's open loops (top 8):
${loops}

Active projects: ${projects}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"dek":"<1-2 sentences, what the piece is about, neutral, ≤200 chars>","why":"<1 sentence tying to ONE open loop or project, ≤120 chars>","readTime":"<e.g. '8 min'>"}`;

  let composed = null;
  try {
    const raw = await callOpenClaw(systemPrompt, userPrompt);
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) composed = JSON.parse(jsonMatch[0]);
    }
    if (composed) log('  article composer: LLM OK');
    else           log('  article composer: no LLM output — using candidate text');
  } catch (e) {
    warn(`article composer LLM failed: ${e.message} — using candidate text`);
  }

  const article = {
    kicker:   'Society & Ideas',
    source:   candidate.source ?? 'Unknown',
    readTime: withReadingDate(composed?.readTime ?? fallbackReadTime, publishedLabel),
    title:    candidate.title,
    dek:      composed?.dek ?? candidate.why,
    why:      composed?.why ?? 'Relevant to your current open loops and projects.',
    freshnessLabel: publishedAt ? `Published ${publishedLabel}` : 'Evergreen read',
    sourceContext: articleSourceContext(candidate, publishedAt, articleWeights),
  };
  // Link out to the source so the Reading tile is clickable (RSS/workspace candidates carry a URL).
  if (publishedAt) article.publishedAt = publishedAt;
  if (candidate.link && /^https?:\/\//.test(candidate.link)) {
    article.url = candidate.link;
    article.sourceLabel = readableSourceLabel(candidate);
  }
  return article;
}

async function tileArticle(feedbackWeights, recentIds, exposureLedger, contextFiles) {
  // Merge workspace candidates (primary), RSS, and feedback-honed web discovery.
  const [wsResult, rssResult, webResult] = await Promise.allSettled([
    Promise.resolve(sourceArticleCandidates()),
    sourceRSSCandidates(feedbackWeights),
    webSourceArticles(feedbackWeights, contextFiles),
  ]);
  const candidates = [
    ...sourceSocietyArticleCandidates(),
    ...(wsResult.status  === 'fulfilled' ? wsResult.value  : []),
    ...(rssResult.status === 'fulfilled' ? rssResult.value : []),
    ...(webResult.status === 'fulfilled' ? webResult.value : []),
  ];
  if (candidates.length === 0) return null;

  const articleRecentIds = [...new Set([...recentIds, ...articleQueueHistoryIds()])];
  const { best, rankedCandidates, report } = rankArticle(
    candidates, feedbackWeights, articleRecentIds, exposureLedger,
    contextFiles.openLoopsText, contextFiles.projectsText,
  );
  log(`  article novelty: ${report.eligibleCount}/${report.candidateCount} eligible; rejected=${report.rejectedCount}; reasons=${JSON.stringify(report.rejectionReasons)}`);
  if (!best) return { article: null, sourceIds: [], noveltyReport: report };

  const portfolio = selectReadingPortfolio(rankedCandidates, {
    minMinutes: 20,
    maxMinutes: 45,
  });
  const selectedCandidates = portfolio.selected.length >= 3
    ? portfolio.selected
    : [{ ...best, role: 'anchor', exploration: false, readMinutes: 10 }];
  const composedArticles = await Promise.all(
    selectedCandidates.map(candidate => composeArticle(candidate, contextFiles, feedbackWeights.article ?? {})),
  );
  const article = composedArticles[0];
  if (!article.title?.trim()) throw new Error('article missing title after compose');
  if (!article.dek?.trim())   throw new Error('article missing dek after compose');
  const reading = portfolio.selected.length >= 3
    ? selectedCandidates.map((candidate, index) => toReadingRecommendation(candidate, composedArticles[index]))
    : [];
  log(`  reading portfolio: ${portfolio.status}; ${portfolio.totalMinutes} min; ${portfolio.uniqueSources ?? 0} sources; roles=${reading.map(item => item.role).join('/') || 'legacy-anchor'}`);

  // Prefer stable link over file-based ID for dedup — links survive renames.
  const sourceIds = selectedCandidates.flatMap(candidate => [
    candidate.id,
    `title:${titleKey(candidate.title)}`,
    candidate.link ? linkKey(candidate.link) : null,
  ]).filter(Boolean);
  return {
    article,
    reading,
    readingPortfolio: {
      status: portfolio.status,
      totalMinutes: portfolio.totalMinutes,
      minimumMinutes: 20,
      maximumMinutes: 45,
      candidateCount: portfolio.candidateCount,
      uniqueSources: portfolio.uniqueSources ?? 0,
      reason: portfolio.reason,
    },
    sourceIds,
    noveltyReport: report,
    selectedCandidates,
  };
}

// ── Phase 3 Tile: Look (image) ────────────────────────────────────────────────

const IMAGE_QUERIES = [
  'landscape painting oil',
  'impressionist light trees',
  'Hudson River School panorama',
  'serene lake mountains watercolor',
  'golden hour pastoral field',
  'coastal seascape calm',
  'garden flowers soft light',
  'autumn foliage trees path',
  'winter snow quiet village',
  'dawn mist river reflection',
];

const IMAGE_ARCHIVE_SCAN_RE = /\b(internet archive|medical heritage library|california digital library|biodiversity heritage library|\bia\b|dictionary|book|scan|page|plate|volume|text)\b/i;
const GENERATIVE_ART_RE = /\b(ai|artificial intelligence|generative|algorithmic|algorithm|computer[- ]generated|neural|fractal|digital)\b/i;

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const AIC_BASE = 'https://api.artic.edu/api/v1';

async function sourceMetMuseum(targetDate) {
  const seed  = dateHash(targetDate + '-met');
  const query = IMAGE_QUERIES[seed % IMAGE_QUERIES.length];

  const searchUrl =
    `${MET_BASE}/search?q=${encodeURIComponent(query)}&hasImages=true&isPublicDomain=true&medium=Paintings`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
  if (!searchRes.ok) throw new Error(`Met Museum search ${searchRes.status}`);
  const searchData = await searchRes.json();

  const ids = (searchData.objectIDs ?? []).slice(0, 40);
  if (ids.length === 0) return [];

  // Sample deterministically so the same date always yields the same picks.
  const picks = [];
  for (let i = 0; i < Math.min(8, ids.length); i++) {
    picks.push(ids[(seed * (i + 1)) % ids.length]);
  }
  const uniquePicks = [...new Set(picks)].slice(0, 5);

  const results = await Promise.allSettled(
    uniquePicks.map(id =>
      fetch(`${MET_BASE}/objects/${id}`, { signal: AbortSignal.timeout(6_000) })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );

  const candidates = [];
  for (const r of results) {
    const obj = r.status === 'fulfilled' ? r.value : null;
    if (!obj || !obj.primaryImageSmall || !obj.isPublicDomain) continue;
    candidates.push({
      source:  'met',
      id:      `met-${obj.objectID}`,
      title:   obj.title || 'Untitled',
      artist:  obj.artistDisplayName || obj.artistDisplayBio || 'Unknown artist',
      date:    obj.objectDate || '',
      medium:  obj.medium || '',
      url:     obj.primaryImageSmall,
      srcLink: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
      tags:    [obj.department, obj.culture, obj.period].filter(Boolean),
    });
  }
  return candidates.filter(c =>
    !isBlockedReadingUrl(c.link) &&
    !isArticleIndexText(`${c.title} ${c.why} ${c.link}`) &&
    !isReadingBadFormatText(`${c.title} ${c.why} ${c.link}`)
  );
}

async function sourceAIC(targetDate) {
  const seed  = dateHash(targetDate + '-aic');
  const query = IMAGE_QUERIES[(seed + 3) % IMAGE_QUERIES.length]; // offset so AIC picks differ

  const searchUrl =
    `${AIC_BASE}/artworks/search?q=${encodeURIComponent(query)}&fields=id,title,image_id,artist_display,medium_display,date_display,subject_titles,style_title,is_public_domain&limit=20`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
  if (!searchRes.ok) throw new Error(`AIC search ${searchRes.status}`);
  const searchData = await searchRes.json();

  const works = (searchData.data ?? []).filter(w => w.is_public_domain && w.image_id);
  return works.map(w => ({
    source:  'aic',
    id:      `aic-${w.id}`,
    title:   w.title || 'Untitled',
    artist:  w.artist_display || 'Unknown artist',
    date:    w.date_display || '',
    medium:  w.medium_display || '',
    url:     `https://www.artic.edu/iiif/2/${w.image_id}/full/843,/0/default.jpg`,
    srcLink: `https://www.artic.edu/artworks/${w.id}`,
    tags:    [w.style_title, ...(w.subject_titles ?? [])].filter(Boolean).slice(0, 5),
  }));
}

async function sourceGenerativeArtCommons(targetDate, feedbackWeights) {
  if (process.env.ALMANAC_DISABLE_WEB === '1') return [];
  const hints = feedbackHints(feedbackWeights.image ?? {});
  const seed  = dateHash(targetDate + '-ai-art');
  const base  = [
    'tasteful AI generated art',
    'generative art luminous abstract',
    'algorithmic art minimal',
    'computer generated art soft light',
    'neural network art abstract',
    'fractal art elegant',
    'digital generative artwork refined',
  ];
  const prefer = hints.prefer.find(h => /ai|generative|algorithm|digital|fractal|abstract/i.test(h));
  const term = prefer ?? base[seed % base.length];
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrnamespace=6&gsrlimit=16&gsrsearch=${encodeURIComponent(term)}` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&origin=*`;
  try {
    const res = await fetch(api, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const d = await res.json();
    const out = [];
    for (const p of Object.values(d.query?.pages ?? {})) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const meta    = info.extmetadata ?? {};
      const license = (meta.LicenseShortName?.value ?? '').toLowerCase();
      if (!/public domain|cc0|cc by|pd-|pd /.test(license)) continue;
      const title = (p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '').trim() || 'Untitled';
      const description = htmlToText(meta.ImageDescription?.value ?? '', 160);
      const blob = `${title} ${description} ${term}`.toLowerCase();
      if (IMAGE_ARCHIVE_SCAN_RE.test(blob)) continue;
      if (!GENERATIVE_ART_RE.test(blob)) continue;
      const artist = htmlToText(meta.Artist?.value ?? '', 80) || 'Unknown artist';
      out.push({
        source:      'ai-art',
        id:          `ai-art-${p.pageid}`,
        title,
        artist,
        date:        htmlToText(meta.DateTimeOriginal?.value ?? '', 20),
        medium:      'AI / generative art',
        url:         info.thumburl,
        srcLink:     info.descriptionurl || `https://commons.wikimedia.org/?curid=${p.pageid}`,
        creditLabel: `${artist} · Wikimedia Commons (${meta.LicenseShortName?.value ?? 'open license'})`,
        tags:        [term, 'generative art', 'AI art'],
      });
    }
    return out;
  } catch (e) {
    warn(`AI art commons sourcer failed: ${e.message}`);
    return [];
  }
}

function rankImage(candidates, feedbackWeights, recentIds) {
  if (candidates.length === 0) return null;

  const iw = feedbackWeights.image ?? {};
  const imageProfile = imageFeedbackProfile(iw);

  const TASTE_KEYWORDS = [
    'landscape', 'light', 'hudson river', 'pastoral', 'impressi',
    'serene', 'quiet', 'nature', 'watercolor', 'plein air', 'golden',
    'mist', 'autumn', 'coast', 'garden', 'reflection', 'dawn', 'dusk',
    'generative', 'algorithmic', 'ai', 'neural', 'digital', 'fractal',
    'abstract', 'soft', 'minimal', 'luminous',
  ];

  const scored = candidates.map(c => {
    let score = 1.0;

    if (recentIds.includes(c.id)) score -= 10;

    if (c.source === 'ai-art') score += 2.0;
    if (imageProfile.avoidCommons && (c.source === 'ai-art' || c.source === 'wikimedia')) score -= 10;
    score += (iw.sourceAffinity?.[c.source] ?? 0) * 0.3;

    const blob = `${c.title} ${c.medium} ${c.tags.join(' ')}`.toLowerCase();
    if (IMAGE_ARCHIVE_SCAN_RE.test(blob)) score -= 8;
    score += TASTE_KEYWORDS.filter(kw => blob.includes(kw)).length * 0.4;

    // Era preference: 1800–1940 sweet spot.
    const yearMatch = c.date.match(/\b(1[0-9]{3})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 1800 && year <= 1940) score += 1.0;
      else if (year < 1800)             score += 0.3;
    }

    if ((iw.chipTallies?.['love the vibe'] ?? 0) > 0) score += 0.3;
    if ((iw.chipTallies?.['not my taste']  ?? 0) > 0) score -= 0.3;

    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best.score < -5 ? null : best;
}

async function composeImage(candidate) {
  const systemPrompt =
`You are the visual editor of Alphalpha, a personal AI daily brief with a refined aesthetic sensibility.
Write two short copy fields for the Look tile: a caption and a one-sentence curator note.
Be specific and evocative — notice light, mood, or craft. No generic filler.`;

  const userPrompt =
`Artwork: "${candidate.title}"
Artist: ${candidate.artist}
Date: ${candidate.date}
Medium: ${candidate.medium}
Tags: ${candidate.tags.join(', ') || 'none'}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"caption":"<1-2 sentences, what draws the eye, ≤200 chars>","curator":"<1 sentence why it's today's pick, ≤120 chars>"}`;

  let composed = null;
  try {
    const raw = await callOpenClaw(systemPrompt, userPrompt);
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) composed = JSON.parse(jsonMatch[0]);
    }
    if (composed) log('  image composer: LLM OK');
    else           log('  image composer: no LLM output — using candidate text');
  } catch (e) {
    warn(`image composer LLM failed: ${e.message} — using candidate text`);
  }

  const museumLabel = candidate.source === 'met'
    ? 'The Metropolitan Museum of Art'
    : candidate.source === 'aic' ? 'Art Institute of Chicago'
    : candidate.source === 'ai-art' ? 'Wikimedia Commons'
    : 'Wikimedia Commons';
  const credit = candidate.creditLabel
    ?? (candidate.artist
      ? `${candidate.artist}${candidate.date ? `, ${candidate.date}` : ''} · ${museumLabel}`
      : museumLabel);

  return {
    kicker:  candidate.source === 'ai-art' ? 'AI Look' : 'Look',
    title:   candidate.title,
    caption: composed?.caption
      ?? `${candidate.title} — ${candidate.medium || candidate.artist || 'a quiet study in light and form'}.`,
    credit,
    curator: composed?.curator
      ?? (candidate.source === 'ai-art'
        ? 'Selected from openly licensed generative art matching your aesthetic taste.'
        : 'Selected from public-domain works matching your aesthetic taste.'),
    url:     candidate.url,
    srcLink: candidate.srcLink,
    tags:    candidate.tags,
  };
}

async function tileImage(feedbackWeights, recentIds) {
  // Editors can pin a specific image by setting this KV key.
  const override = await kvGet('alphalpha:almanac:image-override');
  if (override && override.url) {
    log('  image: using KV override');
    return { image: override, sourceId: override.id ?? 'override' };
  }

  // Prefer openly licensed AI / generative art. Museum APIs remain graceful fallbacks.
  const [aiArtResult, metResult, aicResult, wikiResult] = await Promise.allSettled([
    sourceGenerativeArtCommons(targetDate, feedbackWeights),
    sourceMetMuseum(targetDate),
    sourceAIC(targetDate),
    sourceWikimediaCommons(targetDate, feedbackWeights),
  ]);

  if (aiArtResult.status === 'rejected')
    warn(`AI art sourcer failed: ${aiArtResult.reason?.message}`);
  if (metResult.status === 'rejected')
    warn(`Met Museum sourcer failed: ${metResult.reason?.message}`);
  if (aicResult.status === 'rejected')
    warn(`AIC sourcer failed: ${aicResult.reason?.message}`);

  const aiArt = aiArtResult.status === 'fulfilled' ? aiArtResult.value : [];
  const fallback = [
    ...(metResult.status  === 'fulfilled' ? metResult.value  : []),
    ...(aicResult.status  === 'fulfilled' ? aicResult.value  : []),
    ...(wikiResult.status === 'fulfilled' ? wikiResult.value : []),
  ];
  const all = [...aiArt, ...fallback];
  if (all.length === 0) return null;

  const best = rankImage(all, feedbackWeights, recentIds);
  if (!best) return null;

  const image = await composeImage(best);
  return { image, sourceId: best.id };
}

// ── Phase 4 Tile: Venture ────────────────────────────────────────────────────

function validateVenture(v) {
  if (!v.name?.trim())  throw new Error('venture missing name');
  if (!v.title?.trim()) throw new Error('venture missing title');
  if (!v.pitch?.trim()) throw new Error('venture missing pitch');
  if (!v.why?.trim())   throw new Error('venture missing why');
  if (!v.research || typeof v.research !== 'object') throw new Error('venture missing research');
  if (!v.research.tam?.trim())   throw new Error('venture research missing tam');
  if (!v.research.model?.trim()) throw new Error('venture research missing model');
  if (!Array.isArray(v.research.competitors)) throw new Error('venture research.competitors must be array');
  if (!Array.isArray(v.research.signals))     throw new Error('venture research.signals must be array');
}

function sourceVentureCandidates(contextFiles) {
  const contextRoot = process.env.ALPHALPHA_CONTEXT_DIR
    ? path.resolve(process.env.ALPHALPHA_CONTEXT_DIR)
    : path.join(workspaceRoot, 'context');

  const candidates = [];
  const seen = new Set();

  function add(c) { if (!seen.has(c.id)) { seen.add(c.id); candidates.push(c); } }

  // 1. Dedicated context file — first match wins.
  for (const fname of ['VENTURES.md', 'VENTURE_IDEAS.md', 'INVESTING.md']) {
    const p = path.join(contextRoot, fname);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const lines = mdLines(text);
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(/^##\s+(.+)$/);
      if (m) {
        const name = stripMarkdown(m[1]);
        const bodyLines = [];
        i++;
        while (i < lines.length && !/^##\s/.test(lines[i])) { bodyLines.push(lines[i]); i++; }
        const body = bodyLines.join('\n').trim();
        if (name && body) {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
          add({ id: `ctx-venture-${slug}`, name, description: body.slice(0, 1200), themes: [], effort: '' });
        }
      } else { i++; }
    }
    if (candidates.length > 0) break;
  }

  // 2. Obsidian-vault venture directories.
  for (const rel of [
    'obsidian-vault/Alphalpha/Ventures',
    'obsidian-vault/Alphalpha/Ideas',
    'obsidian-vault/Alphalpha/Startups',
  ]) {
    const dir = path.join(workspaceRoot, rel);
    if (!fs.existsSync(dir)) continue;
    for (const fname of fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('.')).sort()) {
      const text  = fs.readFileSync(path.join(dir, fname), 'utf8');
      const fm    = parseFrontmatter(text);
      const title = stripMarkdown((text.match(/^#\s+(.+)$/m)?.[1] || fname.replace(/\.md$/, '')));
      const body  = text.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      const slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      add({
        id:          `vault-venture-${slug}`,
        name:        title,
        description: body.slice(0, 1200),
        themes:      Array.isArray(fm.themes) ? fm.themes : [],
        effort:      fm.effort || '',
      });
    }
  }

  // 3. Memory ventures manifest.
  const manifestPath = path.join(workspaceRoot, 'memory', 'ventures', 'latest-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      for (const v of (manifest.ventures ?? [])) {
        if (!v.name) continue;
        const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        add({
          id:          `manifest-venture-${slug}`,
          name:        v.name,
          description: [v.pitch, v.description, v.notes].filter(Boolean).join('\n'),
          themes:      v.themes ?? [],
          effort:      v.effort ?? '',
        });
      }
    } catch {}
  }

  // 4. Broad-market prompts prevent the lane from merely mirroring current work.
  const broadMarkets = [
    {
      id: 'taxonomy-healthcare-admin',
      name: 'Healthcare Admin Relief',
      description: 'Vertical workflow software for clinics, specialists, and small practices drowning in prior auth, billing, staffing, and patient follow-up.',
      themes: ['healthcare', 'vertical SaaS', 'local services'],
      effort: 'Fundable wedge',
    },
    {
      id: 'taxonomy-insurance-ops',
      name: 'Insurance Ops Copilot',
      description: 'Claims, underwriting, and broker workflow tools for insurance niches where legacy systems and email still coordinate high-value decisions.',
      themes: ['insurance', 'workflow', 'fintech infrastructure'],
      effort: 'Worth studying',
    },
    {
      id: 'taxonomy-home-services-rollup',
      name: 'Home Services Operating Layer',
      description: 'Scheduling, quoting, financing, and technician enablement for fragmented HVAC, plumbing, roofing, landscaping, and maintenance operators.',
      themes: ['local services', 'SMB software', 'real estate operations'],
      effort: 'Fundable wedge',
    },
    {
      id: 'taxonomy-climate-resilience',
      name: 'Climate Resilience Ledger',
      description: 'Risk, compliance, and procurement software for heat, water, wildfire, grid reliability, and insurance adaptation decisions.',
      themes: ['climate resilience', 'infrastructure', 'risk'],
      effort: 'Worth studying',
    },
    {
      id: 'taxonomy-logistics-exceptions',
      name: 'Logistics Exception Desk',
      description: 'Exception-management and customer communication layer for freight, field service, construction supply, and regional distribution networks.',
      themes: ['logistics', 'operations', 'B2B SaaS'],
      effort: 'Fundable wedge',
    },
    {
      id: 'taxonomy-education-career',
      name: 'Career Mobility OS',
      description: 'Tools for adults, schools, and employers to translate skills, credentials, apprenticeships, and local labor demand into concrete mobility paths.',
      themes: ['education', 'labor', 'credentialing'],
      effort: 'Worth studying',
    },
    {
      id: 'taxonomy-creator-business-services',
      name: 'Creator Back Office',
      description: 'Finance, contracts, merchandising, sponsorship, and operations software for creators who have become small media businesses.',
      themes: ['creator economy', 'business services', 'fintech'],
      effort: 'Side project',
    },
  ];
  const seed = dateHash(`${targetDate}-venture-taxonomy`);
  broadMarkets
    .map((c, i) => ({ ...c, sortKey: (seed + i * 17) % broadMarkets.length }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 4)
    .forEach(({ sortKey, ...candidate }) => add(candidate));

  // 5. Derive from build/product-flavored open loops as last resort.
  if (candidates.length < 2) {
    extractBullets(contextFiles.openLoopsText)
      .filter(l => /build|launch|ship|product|market|revenue|startup|automate|tool|solve|scale/i.test(l))
      .slice(0, 4)
      .forEach(loop => {
        const slug = `loop-${(dateHash(loop) >>> 0).toString(16).slice(0, 8)}`;
        add({ id: `derived-venture-${slug}`, name: loop.slice(0, 60), description: loop, themes: [], effort: '' });
      });
  }

  return candidates;
}

function rankVentures(candidates, feedbackWeights, recentIds, contextFiles) {
  if (candidates.length === 0) return [];

  const vw = feedbackWeights.venture ?? {};
  const loopKeywords = extractBullets(contextFiles.openLoopsText)
    .flatMap(l => l.toLowerCase().split(/\W+/))
    .filter(w => w.length > 4);

  const scored = candidates.map(c => {
    let score = 1.0;

    if (recentIds.includes(c.id)) score -= 10;

    score += (vw.keepScore  ?? 0) * 0.15;
    score += (vw.moreScore  ?? 0) * 0.10;
    score -= (vw.lessScore  ?? 0) * 0.10;
    if ((vw.chipTallies?.['love this idea']   ?? 0) > 0) score += 0.4;
    if ((vw.chipTallies?.['too speculative']  ?? 0) > 0) score -= 0.3;
    if ((vw.chipTallies?.['already building'] ?? 0) > 0) score += 0.5;

    const blob = `${c.name} ${c.description} ${c.themes.join(' ')}`.toLowerCase();
    score += loopKeywords.filter(kw => blob.includes(kw)).length * 0.03;
    if (c.id.startsWith('taxonomy-')) score += 1.2;

    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(c => c.score >= -5);
}

async function composeVenture(candidate, contextFiles) {
  const { openLoopsText, projectsText, postureText } = contextFiles;

  const loops    = extractBullets(openLoopsText).slice(0, 6).join('\n') || '(none)';
  const projects = (projectsText.match(/^##\s+\d+\.\s+(.+)$/gm) ?? [])
    .map(l => stripMarkdown(l).replace(/^\d+\.\s+/, '')).slice(0, 5).join(', ') || '(none)';
  const posture  = firstSentence(postureText, '');

  const systemPrompt =
`You are the venture-intelligence editor of Alphalpha, a personal AI chief-of-staff daily brief.
Generate a complete venture brief. Write concisely and specifically; no filler.
CRITICAL RULES:
- All market-size figures (TAM, CAGR) must be labeled as estimates using "est." in the label field. Never state them as confirmed facts.
- Competitor names must be real, publicly known companies or credibly plausible; do not invent fictional firms.
- Do not overfit to AI tooling or the user's current build loops. Broaden toward large durable markets when the candidate points there.
- Ground "why" in the user's taste and operating leverage, but make the market stand on its own.`;

  const userPrompt =
`Venture idea: "${candidate.name}"
${candidate.description ? `\nBackground:\n${candidate.description.slice(0, 700)}` : ''}
${candidate.effort ? `\nEffort framing: ${candidate.effort}` : ''}

Alex's open loops (top 6):
${loops}

Active projects: ${projects}
${posture ? `\nCurrent posture: ${posture}` : ''}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{
  "name": "<short company name, ≤20 chars>",
  "effort": "<one of: Fundable wedge | Side project | Weekend prototype | Worth studying>",
  "title": "<name — tagline, ≤90 chars>",
  "pitch": "<2-3 sentences, core insight and market, ≤280 chars>",
  "why": "<1 sentence tying to one of Alex's open loops or projects, ≤120 chars>",
  "research": {
    "tam": "<dollar figure, e.g. $8B>",
    "tamLabel": "<market description + ' est.', e.g. 'US wealth-tech TAM est.'>",
    "growth": "<percentage, e.g. 22%>",
    "growthLabel": "<e.g. 'CAGR est. 2024–29'>",
    "model": "<business model, ≤80 chars>",
    "whyNow": "<market timing, ≤120 chars>",
    "wedge": "<beachhead, ≤120 chars>",
    "competitors": [{"name":"<real company>","note":"<what they miss, ≤60 chars>"}, ...],
    "signals": ["<market signal, ≤80 chars>", ...]
  }
}

Include 2–3 competitors and 3–4 signals.`;

  let composed = null;
  try {
    const raw = await callOpenClaw(systemPrompt, userPrompt);
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) composed = JSON.parse(jsonMatch[0]);
    }
    if (composed) log(`  venture composer: LLM OK — "${composed.name}"`);
    else          log('  venture composer: no LLM output — skipping candidate');
  } catch (e) {
    warn(`venture composer LLM failed: ${e.message}`);
  }

  if (!composed && candidate.id?.startsWith('taxonomy-')) {
    composed = fallbackTaxonomyVenture(candidate);
    log(`  venture composer: deterministic taxonomy fallback — "${composed.name}"`);
  }

  if (!composed) return null;

  // Normalise arrays and fill defaults so the schema validator passes.
  composed.effort = composed.effort || 'Worth studying';
  composed.research = composed.research ?? {};
  composed.research.tam         = composed.research.tam         ?? '';
  composed.research.tamLabel    = composed.research.tamLabel    ?? '';
  composed.research.growth      = composed.research.growth      ?? '';
  composed.research.growthLabel = composed.research.growthLabel ?? '';
  composed.research.model       = composed.research.model       ?? '';
  composed.research.whyNow      = composed.research.whyNow      ?? '';
  composed.research.wedge       = composed.research.wedge       ?? '';
  composed.research.competitors = Array.isArray(composed.research.competitors)
    ? composed.research.competitors.filter(c => c?.name && c?.note)
    : [];
  composed.research.signals = Array.isArray(composed.research.signals)
    ? composed.research.signals.filter(Boolean)
    : [];

  try { validateVenture(composed); } catch (e) {
    warn(`venture validation failed: ${e.message}`);
    return null;
  }

  return composed;
}

function fallbackTaxonomyVenture(candidate) {
  const themes = candidate.themes ?? [];
  const primary = themes[0] ?? 'B2B operations';
  const shortName = candidate.name
    .replace(/\b(Operating Layer|Copilot|Relief|Ledger|Desk|OS)\b/gi, '')
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('');
  return {
    name: shortName.slice(0, 20) || 'OpsLayer',
    effort: candidate.effort || 'Worth studying',
    title: `${candidate.name} — ${primary} wedge`,
    pitch: firstSentence(candidate.description, `${candidate.name} targets a large, fragmented operational market.`).slice(0, 280),
    why: `Broadens the Almanac venture lane into ${primary}, beyond current project loops.`,
    research: {
      tam: 'TBD',
      tamLabel: `${primary} TAM est. pending source check`,
      growth: 'TBD',
      growthLabel: 'growth est. pending source check',
      model: 'Vertical SaaS plus workflow/payment take rates',
      whyNow: 'Legacy workflows, labor pressure, and AI-native coordination make the category timely.',
      wedge: candidate.description.slice(0, 120),
      competitors: [
        { name: 'ServiceTitan', note: 'Shows vertical workflow appetite' },
        { name: 'Toast', note: 'Proof of SMB operating-system economics' },
      ],
      signals: [
        `${primary} remains fragmented and workflow-heavy`,
        'Operators are under pressure to do more with fewer staff',
        'Vertical software can bundle workflow, payments, and data',
      ],
    },
  };
}

async function tileVentures(feedbackWeights, recentIds, contextFiles) {
  const candidates = sourceVentureCandidates(contextFiles);
  if (candidates.length === 0) return null;

  const ranked = rankVentures(candidates, feedbackWeights, recentIds, contextFiles);
  const picks  = ranked.slice(0, 2); // max 2 live ventures per edition
  if (picks.length === 0) return null;

  const results = await Promise.allSettled(picks.map(c => composeVenture(c, contextFiles)));

  const ventures = [];
  const usedIds  = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      ventures.push(r.value);
      usedIds.push(picks[i].id);
    } else if (r.status === 'rejected') {
      warn(`venture compose[${i}] threw: ${r.reason?.message}`);
    }
  }

  // Web-augment the lead venture's market signals with cited, recent evidence.
  if (ventures.length > 0) {
    try { await webAugmentVentureSignals(ventures[0]); }
    catch (e) { warn(`venture web-augment failed: ${e.message}`); }
  }

  return ventures.length > 0 ? { ventures, usedIds } : null;
}

// ── Phase 5 Tile: Surprise ────────────────────────────────────────────────────

const SURPRISE_FORMS = ['Word', 'Provocation', 'Artifact'];

function loadArtifactsDataset() {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', 'artifacts.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function sourceSurpriseForm(targetDate, recentIds) {
  // Determine which forms appeared in recent history.
  const recentForms = new Set(
    recentIds
      .map(id => id.match(/^form-(word|provocation|artifact)/i)?.[1])
      .filter(Boolean)
      .map(f => f.charAt(0).toUpperCase() + f.slice(1).toLowerCase())
  );
  const recentArtifactIds = new Set(
    recentIds.filter(id => id.startsWith('artifact-'))
  );

  const hash = dateHash(targetDate);

  // Rank forms: prefer ones not used recently; tiebreak by dateHash.
  const ranked = SURPRISE_FORMS.map((form, i) => ({
    form,
    fresh:    !recentForms.has(form),
    tieBreak: (hash + i) % SURPRISE_FORMS.length,
  }));
  ranked.sort((a, b) => (b.fresh ? 1 : 0) - (a.fresh ? 1 : 0) || a.tieBreak - b.tieBreak);

  const chosen = ranked[0].form;

  if (chosen === 'Artifact') {
    const artifacts = loadArtifactsDataset();
    const fresh = artifacts.filter(a => !recentArtifactIds.has(`artifact-${a.id}`));
    const pool  = fresh.length > 0 ? fresh : artifacts;
    if (pool.length > 0) {
      const artifact = pool[hash % pool.length];
      return { form: 'Artifact', artifact, formId: 'form-artifact', artifactId: `artifact-${artifact.id}` };
    }
    // No artifacts available; fall back to Provocation.
    return { form: 'Provocation', artifact: null, formId: 'form-provocation', artifactId: null };
  }

  return { form: chosen, artifact: null, formId: `form-${chosen.toLowerCase()}`, artifactId: null };
}

async function composeSurprise(form, artifact, contextFiles) {
  const { openLoopsText, postureText } = contextFiles;

  const loops   = extractBullets(openLoopsText).slice(0, 5).join('\n') || '(none)';
  const posture = firstSentence(postureText, '');

  let systemPrompt = '';
  let userPrompt   = '';

  if (form === 'Word') {
    systemPrompt =
`You are a lexicographer and essayist writing for a personal daily brief.
Pick one unusual or underused English word that resonates with the reader's current focus. Write a brief gloss: etymology, core meaning, and why it's interesting. Keep it tight — this is a moment of quiet pleasure, not a lecture.`;
    userPrompt =
`Alex's current open loops:
${loops}
${posture ? `\nCurrent posture: ${posture}` : ''}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"title":"<the word, capitalized>","body":"<etymology + meaning + why it's interesting, ≤220 chars>","note":"<1 sentence tying the word to one of Alex's loops or posture, ≤100 chars>"}`;

  } else if (form === 'Provocation') {
    systemPrompt =
`You are an editor writing for a personal daily brief. Write one sharp provocation — a question or observation the reader should sit with today, rooted in their actual focus. Avoid generic wisdom. Cut to something specific.`;
    userPrompt =
`Alex's current open loops:
${loops}
${posture ? `\nCurrent posture: ${posture}` : ''}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"title":"<the provocation, ≤90 chars>","body":"<2-3 sentences expanding the thought, ≤240 chars>","note":""}`;

  } else {
    // Artifact
    systemPrompt =
`You are a curator writing for a personal daily brief. Write a brief, evocative piece about the given artifact — what it is, why it's remarkable, what it teaches. Be specific; don't over-explain. Then tie it to the reader's current focus.`;
    userPrompt =
`Artifact: "${artifact.name}"
Context: ${artifact.context}
Themes: ${artifact.themes.join(', ')}

Alex's current open loops:
${loops}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"title":"<artifact name, ≤70 chars>","body":"<what it is + why remarkable + what it teaches, ≤250 chars>","note":"<1 sentence tying it to one of Alex's loops, ≤100 chars>"}`;
  }

  let composed = null;
  try {
    const raw = await callOpenClaw(systemPrompt, userPrompt);
    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) composed = JSON.parse(jsonMatch[0]);
    }
    if (composed) log(`  surprise composer: LLM OK (${form})`);
    else          log(`  surprise composer: no LLM output`);
  } catch (e) {
    warn(`surprise composer LLM failed: ${e.message}`);
  }

  // Source link for the Artifact form so the Surprise tile can point at its source.
  const artifactSource = (form === 'Artifact' && artifact?.sourceUrl)
    ? { sourceUrl: artifact.sourceUrl, sourceLabel: artifact.sourceLabel ?? 'Read more' }
    : {};

  if (!composed?.title?.trim() || !composed?.body?.trim()) {
    // Non-LLM fallback for Artifact: use curated metadata directly.
    if (form === 'Artifact' && artifact) {
      return {
        form:  'Artifact',
        title: artifact.name,
        body:  artifact.context.slice(0, 250),
        note:  '',
        ...artifactSource,
      };
    }
    return null; // Word / Provocation have no non-LLM fallback → fixture
  }

  return {
    form,
    title: composed.title,
    body:  composed.body,
    note:  composed.note ?? '',
    ...artifactSource,
  };
}

async function tileSurprise(feedbackWeights, recentIds, contextFiles) {
  let { form, artifact, formId, artifactId } = sourceSurpriseForm(targetDate, recentIds);
  // Prefer a freshly web-discovered artifact (with a real source) over the dataset.
  if (form === 'Artifact') {
    try {
      const web = await webSourceArtifact(feedbackWeights);
      if (web?.name) { artifact = web; artifactId = web.id; }
    } catch (e) { warn(`artifact web discovery failed: ${e.message}`); }
  }
  const surprise = await composeSurprise(form, artifact, contextFiles);
  if (!surprise) return null;

  // Collect IDs to record: the form + the specific artifact if applicable.
  const usedIds = [formId, artifactId].filter(Boolean);
  return { surprise, usedIds };
}

// ── Phase 6 Tile: Curated Investing / AI charts ───────────────────────────────

function loadChartsDataset() {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', 'charts.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

async function composeChartNote(chart, contextFiles) {
  const { openLoopsText, projectsText } = contextFiles;

  const loops    = extractBullets(openLoopsText).slice(0, 4).join('\n') || '(none)';
  const projects = (projectsText.match(/^##\s+\d+\.\s+(.+)$/gm) ?? [])
    .map(l => stripMarkdown(l).replace(/^\d+\.\s+/, '')).slice(0, 4).join(', ') || '(none)';

  const seriesSummary = chart.series
    .map(p => `${p.label}: ${p.value}`)
    .join(', ');

  const systemPrompt =
`You are a data analyst writing for a personal daily brief. Interpret the chart and write two short prose fields. Be specific and direct — reference the actual numbers. No generic filler.`;

  const userPrompt =
`Chart: "${chart.title}"
Data: ${seriesSummary}
Unit: ${chart.unit}

Alex's open loops: ${loops}
Active projects: ${projects}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{"note":"<1-2 sentences interpreting the trend, referencing specific numbers, ≤200 chars>","why":"<1 sentence tying the chart to one of Alex's loops or projects, ≤120 chars>"}`;

  try {
    const raw = await callOpenClaw(systemPrompt, userPrompt);
    if (raw) {
      const m = raw.match(/\{[\s\S]*?\}/);
      if (m) {
        const composed = JSON.parse(m[0]);
        if (composed.note?.trim() && composed.why?.trim()) return composed;
      }
    }
  } catch (e) {
    warn(`chart note composer failed (${chart.id}): ${e.message}`);
  }
  return null;
}

async function tileCuratedCharts(feedbackWeights, recentIds, contextFiles) {
  const dataset = loadChartsDataset();
  const chartProfile = chartFeedbackProfile(feedbackWeights.chart ?? {});

  function pickChart(topic) {
    const pool  = dataset.filter(c => c.topic === topic && !isRejectedChart(c, chartProfile));
    const fresh = pool.filter(c => !recentIds.includes(c.id));
    return fresh.length > 0 ? fresh[0] : (pool.length > 0 ? pool[0] : null);
  }

  // Prefer a freshly web-discovered, source-cited chart; fall back to the dataset.
  const [investingWeb, aiWeb] = await Promise.all([
    webSourceChart(feedbackWeights, 'Investing').catch(() => null),
    chartProfile.avoidAiFocused ? Promise.resolve(null) : webSourceChart(feedbackWeights, 'AI').catch(() => null),
  ]);
  const investingRaw = isRejectedChart(investingWeb, chartProfile) ? pickChart('Investing') : (investingWeb ?? pickChart('Investing'));
  const aiRaw        = chartProfile.avoidAiFocused ? null : (aiWeb ?? pickChart('AI'));

  if (!investingRaw && !aiRaw) return null;

  // Web picks already carry note/why; only dataset picks need the LLM note step.
  const [investingNoteResult, aiNoteResult] = await Promise.allSettled([
    (!investingWeb && investingRaw) ? composeChartNote(investingRaw, contextFiles) : Promise.resolve(null),
    (!aiWeb        && aiRaw)        ? composeChartNote(aiRaw,        contextFiles) : Promise.resolve(null),
  ]);

  function applyNote(raw, noteResult) {
    if (!raw) return null;
    const composed = noteResult.status === 'fulfilled' ? noteResult.value : null;
    return {
      ...raw,
      note: composed?.note ?? raw.note ?? '',
      why:  composed?.why  ?? raw.why  ?? '',
    };
  }

  return {
    investing:    applyNote(investingRaw, investingNoteResult),
    investingId:  investingRaw?.id ?? null,
    ai:           applyNote(aiRaw, aiNoteResult),
    aiId:         aiRaw?.id ?? null,
    aiSuppressed: chartProfile.avoidAiFocused,
  };
}

function chartFeedbackProfile(weights = {}) {
  const notes = (weights.notes ?? []).join(' ').toLowerCase();
  return { avoidAiFocused: wantsLessAiFocus(notes) };
}

function isRejectedChart(chart, profile) {
  if (!chart) return false;
  if (!profile?.avoidAiFocused) return false;
  return chart.topic === 'AI' || isAiFocusedText(`${chart.title} ${chart.note ?? ''} ${chart.why ?? ''} ${chart.sourceLabel ?? ''}`);
}

// ── Phase 7/8 Tiles: Workshop (guitar riff + production clip of the day) ───────

const DIFFICULTY_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

function loadWorkshopDataset(file) {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', file);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

// Feedback-weighted ranker shared by both workshop tiles. Learns toward genres /
// techniques the reader reacts well to ("more blues", kept items) and away from
// recently-shown clips. `matchKeys` are the candidate fields prefs are matched against.
function rankWorkshop(candidates, genreWeights, recentIds, idPrefix, matchKeys, options = {}) {
  if (candidates.length === 0) return null;
  const w = genreWeights ?? {};
  const chipTallies = w.chipTallies ?? {};
  const notes = (w.notes ?? []).join(' ').toLowerCase();
  const noteTerms = workshopNoteTerms(notes);

  // "more <thing>" chips + kept-item affinity build a preference vector.
  const pref = {};
  for (const [k, v] of Object.entries(chipTallies)) {
    const m = k.match(/^more (.+)$/i);
    if (m) pref[m[1].toLowerCase()] = (pref[m[1].toLowerCase()] ?? 0) + v;
  }
  for (const [src, v] of Object.entries(w.sourceAffinity ?? {})) {
    pref[src.toLowerCase()] = (pref[src.toLowerCase()] ?? 0) + v;
  }

  // Difficulty drift from too-easy / too-hard / too-advanced signals.
  const levelDrift = (chipTallies['too easy'] ?? 0) + (/\btoo beginner\b|\bbeginner oriented\b/.test(notes) ? 1 : 0)
    - (chipTallies['too hard'] ?? 0) - (chipTallies['too advanced'] ?? 0);

  const hash = dateHash(targetDate);
  const scored = candidates.map((c, i) => {
    let score = 1.0;

    // Dedup: penalise anything shown in the recent window (by id or videoId).
    if (recentIds.includes(`${idPrefix}-${c.id}`) || (c.videoId && recentIds.includes(c.videoId)))
      score -= 10;

    // Preference overlap across the candidate's descriptive fields.
    const blob = [
      c.title,
      c.source,
      c.sourceLabel,
      c.url,
      ...(Array.isArray(c.tags) ? c.tags : []),
      ...matchKeys.map(k => c[k] ?? ''),
    ].join(' ').toLowerCase();
    for (const [p, v] of Object.entries(pref)) {
      if (p && blob.includes(p)) score += v * 0.4;
    }
    score += noteTerms.prefer.filter(term => blob.includes(term)).length * 1.2;
    score -= noteTerms.avoid.filter(term => blob.includes(term)).length * 4;

    if (idPrefix === 'longread') {
      const primarySourceDisliked = /too primary|primary source|primary-source/.test(notes);
      if (primarySourceDisliked && /\bfederal reserve\b|\bbis\b|\bbank for international settlements\b|\bpdf\b/.test(blob)) {
        score -= 6;
      }
      if (/ai\b|artificial intelligence|llm|machine learning|macro|markets|finance|investing/.test(blob)) {
        score += /macro|markets|finance|investing|investment-thesis|secondary-analysis/.test(blob) ? 1.8 : -0.9;
      }
      if (/culture|institutions|housing|cities|public-health|psychology|religion|anthropology|political-economy|governance|software|craft|defense|osint|progress-studies|systems|provocative/.test(blob)) {
        score += 0.4;
      }
      if (/secondary macro|macro analysis|single[-\s]?threaded|deep dive|investment thesis|sector|lyn alden|byrne hobart|david cervantes/.test(notes)) {
        if (/lyn alden|byrne hobart|the diff|david cervantes|pinebrook|newsletter|secondary-analysis|deep-dive|investment-thesis|sector/.test(blob)) {
          score += 5;
        }
      }
    }

    // Nudge difficulty toward the drift when the candidate declares one.
    if (c.difficulty) {
      const dr = DIFFICULTY_RANK[String(c.difficulty).toLowerCase()] ?? 1;
      const target = levelDrift > 0 ? 2 : levelDrift < 0 ? 0 : 1;
      score += (2 - Math.abs(dr - target)) * 0.8;
      if (levelDrift > 0 && dr === 0) score -= 3;
      if (levelDrift < 0 && dr === 2) score -= 3;
    }

    if (typeof options.adjustScore === 'function') {
      score += options.adjustScore(c, { blob, idPrefix });
    }

    // Deterministic daily rotation as the tiebreak.
    score += ((hash + i) % candidates.length) * 0.001;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const allCandidatesWereRecent = candidates.every(c =>
    recentIds.includes(`${idPrefix}-${c.id}`) || (c.videoId && recentIds.includes(c.videoId))
  );
  return scored[0].score < -5 && !allCandidatesWereRecent ? null : scored[0];
}

function toEditionItem(candidate) {
  // Strip generator-only fields (id, tags, score) — the edition stores the schema shape.
  const { id, tags, score, ...item } = candidate;
  return item;
}

function decorateLongReadMetadata(read, candidate, selectedArticle = null) {
  const publishedAt = normalizeReadingPublishedDate(candidate?.publishedAt || candidate?.date || read.publishedAt || read.date || '');
  const freshnessLabel = publishedAt
    ? `Published ${formatReadingDate(publishedAt)}`
    : 'Evergreen read';
  const age = describeReadingAge(publishedAt);
  const tidyClause = value => String(value || '').replace(/\.+$/, '');
  const dayFit = tidyClause(longReadDayFit(candidate, targetDate).label);
  const sourceNote = sharesReadingSource(candidate, selectedArticle)
    ? "source overlaps with today's Reading pick"
    : "source distinct from today's Reading pick";
  const mixFit = tidyClause(readingLaneBalanceFit(candidate, selectedArticle).label);
  return {
    ...read,
    ...(publishedAt ? { publishedAt } : {}),
    freshnessLabel,
    sourceLabel: readableSourceLabel({ ...candidate, ...read }),
    sourceContext: `curated macro/investing library; ${age}; ${sourceNote}${dayFit ? `; ${dayFit}` : ''}${mixFit ? `; ${mixFit}` : ''}.`,
  };
}

function normalizedReadingSourceKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|co|io|ai)$/, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function readingSourceKeys(read) {
  const keys = new Set();
  for (const value of [read?.source, read?.sourceLabel]) {
    const key = normalizedReadingSourceKey(value);
    if (key) keys.add(key);
  }
  const url = read?.url ?? read?.link;
  if (url) {
    const host = normalizedReadingSourceKey(hostOf(url));
    if (host) keys.add(host);
  }
  return keys;
}

function sharesReadingSource(candidate, selectedRead) {
  const selectedKeys = readingSourceKeys(selectedRead);
  if (selectedKeys.size === 0) return false;
  return [...readingSourceKeys(candidate)].some(key => selectedKeys.has(key));
}

async function tileRiff(feedbackWeights, recentIds) {
  const dataset = loadWorkshopDataset('riffs.json');
  const web = await webSourceRiffs(feedbackWeights).catch(() => []);
  const pool = [...web, ...dataset];
  if (pool.length === 0) return null;
  const best = rankWorkshop(pool, feedbackWeights.riff, recentIds, 'riff', ['genre', 'difficulty']);
  if (!best) return null;
  const riff = toEditionItem(best);
  if (!riff.videoId || !riff.title) throw new Error('riff missing videoId/title after rank');
  return { riff, usedId: `riff-${best.id}` };
}

async function tileProduction(feedbackWeights, recentIds) {
  const dataset = loadWorkshopDataset('production.json');
  const web = await webSourceProduction(feedbackWeights).catch(() => []);
  const pool = [...web, ...dataset];
  if (pool.length === 0) return null;
  const best = rankWorkshop(pool, feedbackWeights.production, recentIds, 'production', ['daw', 'technique']);
  if (!best) return null;
  const clip = toEditionItem(best);
  if (!clip.videoId || !clip.title) throw new Error('production clip missing videoId/title after rank');
  return { clip, usedId: `production-${best.id}` };
}

async function tilePoem(feedbackWeights, recentIds) {
  const dataset = loadWorkshopDataset('poems.json');
  if (dataset.length === 0) return null;
  const best = rankWorkshop(dataset, feedbackWeights.poem, recentIds, 'poem', ['poet', 'era', 'note', 'why']);
  if (!best) return null;
  const poem = toEditionItem(best);
  if (!poem.title || !poem.poet || !poem.excerpt) throw new Error('poem missing title/poet/excerpt after rank');
  return { poem, usedId: `poem-${best.id}` };
}

async function tileLongRead(feedbackWeights, recentIds, selectedArticle = null) {
  const dataset = loadWorkshopDataset('long-reads.json');
  if (dataset.length === 0) return null;
  const macroPool = dataset.filter(c => {
    const blob = `${c.title} ${c.source} ${c.frame} ${c.thesis} ${c.why} ${(c.tags ?? []).join(' ')}`.toLowerCase();
    return /\b(macro|investing|investment|markets|finance|rates|energy|portfolio|capital allocation|sector|economics)\b/.test(blob);
  });
  const pool = macroPool.length ? macroPool : dataset;
  const best = rankWorkshop(pool, feedbackWeights.longread, recentIds, 'longread', ['source', 'frame', 'thesis', 'why'], {
    adjustScore: candidate => (
      (sharesReadingSource(candidate, selectedArticle) ? -4 : 0)
      + longReadDayFit(candidate, targetDate).score
      + readingLaneBalanceFit(candidate, selectedArticle).score
    ),
  });
  if (!best) return null;
  const longRead = decorateLongReadMetadata(toEditionItem(best), best, selectedArticle);
  if (!longRead.title || !longRead.source || !longRead.thesis) throw new Error('long read missing title/source/thesis after rank');
  return { longRead, usedId: `longread-${best.id}` };
}

async function tileAustinExplore(feedbackWeights, recentIds) {
  const dataset = loadWorkshopDataset('austin-explore.json');
  if (dataset.length === 0) return null;
  const best = rankWorkshop(dataset, feedbackWeights.austin ?? feedbackWeights.explore, recentIds, 'austin', ['category', 'area', 'vibe', 'prompt', 'why'], {
    adjustScore: candidate => austinExploreSeasonFit(candidate, targetDate).score,
  });
  if (!best) return null;
  const seasonalFit = austinExploreSeasonFit(best, targetDate).label;
  const austinExplore = {
    ...toEditionItem(best),
    ...(seasonalFit ? { seasonalFit } : {}),
  };
  if (!austinExplore.title || !austinExplore.prompt || !austinExplore.why) throw new Error('Austin explore missing title/prompt/why after rank');
  return { austinExplore, usedId: `austin-${best.id}` };
}

// ── Phase 6 Article sourcer: RSS feeds ────────────────────────────────────────

const KNOWN_FEEDS = {
  'compact':             'https://www.compactmag.com/rss/',
  'aeon':                'https://aeon.co/feed.rss',
  'works in progress':   'https://worksinprogress.co/rss.xml',
  'marginal revolution': 'https://marginalrevolution.com/feed',
  'astral codex ten':    'https://astralcodexten.substack.com/feed',
  'stratechery':         'https://stratechery.com/feed/',
  'the diff':            'https://diff.substack.com/feed',
};

function parseRSSItems(xml) {
  const items = [];
  const re = /<(?:item|entry)(?: [^>]*)?>([\s\S]*?)<\/(?:item|entry)>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = (
      block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? ''
    ).trim();
    // Atom feeds emit multiple <link> elements; prefer rel="alternate" (the article URL).
    const link = (
      block.match(/<link[^>]*\brel="alternate"[^>]*\bhref="([^"]+)"/)?.[1] ??
      block.match(/<link[^>]*\bhref="([^"]+)"[^>]*\brel="alternate"/)?.[1] ??
      block.match(/<link[^>]*\bhref="([^"]+)"/)?.[1] ??
      block.match(/<link[^>]*>([^<\s]+)<\/link>/)?.[1] ??
      ''
    ).trim();
    const desc = (
      block.match(/<(?:description|summary|content:encoded)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content:encoded)>/)?.[1] ?? ''
    ).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').slice(0, 300).trim();
    const publishedAt = normalizeReadingPublishedDate(
      block.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/)?.[1] ?? ''
    );

    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim(),
        link,
        desc,
        publishedAt,
      });
    }
  }
  return items;
}

async function sourceRSSCandidates(feedbackWeights) {
  const aw = feedbackWeights.article ?? {};

  // Build prioritised feed list: kept sources first, then always-on.
  const tryFeeds = [];
  const seen = new Set();
  for (const [src, affinity] of Object.entries(aw.sourceAffinity ?? {})) {
    const key = src.toLowerCase();
    const url = KNOWN_FEEDS[key];
    if (url && !seen.has(key)) { seen.add(key); tryFeeds.push({ url, source: src, priority: affinity }); }
  }
  for (const [src, url] of Object.entries(KNOWN_FEEDS)) {
    if (!seen.has(src)) { seen.add(src); tryFeeds.push({ url, source: src, priority: 0 }); }
  }
  tryFeeds.sort((a, b) => b.priority - a.priority);

  const results = await Promise.allSettled(
    tryFeeds.slice(0, 3).map(async ({ url, source }) => {
      const res = await fetch(url, {
        signal:  AbortSignal.timeout(5_000),
        headers: { 'User-Agent': 'AlphalphaDashboard/1.0 almanac-generator' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return { source, items: parseRSSItems(xml).slice(0, 5) };
    })
  );

  const candidates = [];
  let idx = 0;
  for (const r of results) {
    if (r.status === 'rejected') {
      warn(`RSS fetch failed: ${r.reason?.message}`);
      continue;
    }
    const { source, items } = r.value;
    for (const item of items) {
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48);
      candidates.push({
        id:     `rss-${idx++}-${slug}`,
        title:  item.title,
        status: 'Queued',
        source,
        link:   item.link,
        publishedAt: item.publishedAt,
        why:    item.desc || `Recent piece from ${source}.`,
        themes: [],
      });
    }
  }

  return candidates.filter(c => !c.link || !isGenericReadingUrl(c.link));
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

// ── Web discovery sourcers (feedback-honed; every one degrades to fallback) ───

const UA = 'AlphalphaDashboard/1.0 almanac-discovery';

function titleCase(s) { return String(s || '').replace(/\b\w/g, c => c.toUpperCase()); }

// Pull a few salient keywords from the workspace context to focus queries.
function topicKeywords(contextFiles, max = 3) {
  const text = `${contextFiles.openLoopsText}\n${contextFiles.projectsText}`.toLowerCase();
  const stop = new Set(['should','context','project','projects','almanac','dashboard','status',
    'update','review','decision','workflow','system','source','build','build','current','about']);
  const freq = {};
  for (const w of text.match(/[a-z][a-z-]{5,}/g) ?? []) {
    if (!stop.has(w)) freq[w] = (freq[w] ?? 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

// Reading — discover fresh long-form beyond the hardcoded RSS list.
async function webSourceArticles(feedbackWeights, contextFiles) {
  if (!webDiscovery?.available) return [];
  const hints  = feedbackHints(feedbackWeights.article ?? {});
  const profile = articleFeedbackProfile(feedbackWeights.article ?? {});
  const topics = topicKeywords(contextFiles, 3);
  const prefer = hints.prefer.slice(0, 2);
  const avoidAi = profile.avoidAiFocused ? ' -AI -LLM -GenAI non-AI' : '';
  const queries = [
    `recent long-form essay politics religion society culture human interest 2026 ${prefer[0] ?? ''}${avoidAi}`.trim(),
    profile.preferredQuery ? `fresh long-form ${profile.preferredQuery} society culture politics religion essay 2026${avoidAi}` : null,
    topics[0] ? `in-depth social political cultural essay ${topics[0]} ${prefer[0] ?? ''}${avoidAi}`.trim() : null,
  ].filter(Boolean);
  const results = await webDiscovery.searchMany(queries, { perQuery: 5 });
  return results
    .filter(r => !profile.avoidHosts.some(h => hostOf(r.url).endsWith(h)))
    .filter(r => !isVideoHost(hostOf(r.url)))
    .filter(r => !isBlockedReadingUrl(r.url))
    .filter(r => !isGenericReadingUrl(r.url))
    .map((r, i) => ({
      id:     `web-article-${hostOf(r.url)}-${i}`,
      title:  r.title,
      status: 'Queued',
      source: hostOf(r.url),
      link:   r.url,
      publishedAt: normalizeReadingPublishedDate(r.date || ''),
      why:    (r.snippet || '').slice(0, 200) || 'Surfaced via daily web discovery.',
      themes: [],
    }))
    .filter(c => c.title && c.link)
    .filter(c => !isArticleIndexText(`${c.title} ${c.why} ${c.link}`))
    .filter(c => !isReadingBadFormatText(`${c.title} ${c.why} ${c.link}`))
    .filter(c => !(profile.avoidAiFocused && isAiFocusedText(`${c.title} ${c.why}`)));
}

// Riff — search YouTube for fresh tutorials in the reader's preferred genres.
const RIFF_DEFAULT_GENRES = ['blues', 'funk', 'fingerstyle'];
async function webSourceRiffs(feedbackWeights) {
  if (!webDiscovery?.available) return [];
  const hints  = feedbackHints(feedbackWeights.riff ?? {});
  const genres = (hints.prefer.length ? hints.prefer : RIFF_DEFAULT_GENRES).slice(0, 3);
  const queries = genres.map(g => `${g} guitar riff lesson tutorial site:youtube.com`);
  const results = await webDiscovery.searchMany(queries, { perQuery: 5 });
  const out = [];
  for (const r of results) {
    const vid = extractYouTubeId(r.url);
    if (!vid) continue;
    const blob = `${r.title} ${r.snippet}`.toLowerCase();
    const g = genres.find(x => blob.includes(x)) ?? genres[0];
    out.push({
      id:         `web-${vid}`,
      title:      r.title || 'Guitar riff',
      artist:     r.source || 'YouTube',
      genre:      titleCase(g),
      difficulty: 'Intermediate',
      videoId:    vid,
      why:        (r.snippet || '').slice(0, 140) || `A ${g} riff worth learning today.`,
      sourceUrl:  `https://www.youtube.com/watch?v=${vid}`,
    });
  }
  return out;
}

// Production — search YouTube for fresh technique/inspiration clips (Ableton-leaning).
async function webSourceProduction(feedbackWeights) {
  if (!webDiscovery?.available) return [];
  const hints = feedbackHints(feedbackWeights.production ?? {});
  const prefs = hints.prefer.length ? hints.prefer : ['ableton sound design', 'ableton arrangement', 'electronic music production technique'];
  const queries = prefs.slice(0, 3).map(p => `${p} tutorial site:youtube.com`);
  const results = await webDiscovery.searchMany(queries, { perQuery: 5 });
  const out = [];
  for (const r of results) {
    const vid = extractYouTubeId(r.url);
    if (!vid) continue;
    const blob = `${r.title} ${r.snippet}`.toLowerCase();
    out.push({
      id:        `web-${vid}`,
      title:     r.title || 'Production technique',
      creator:   r.source || 'YouTube',
      daw:       blob.includes('ableton') ? 'Ableton Live' : 'DAW-agnostic',
      technique: blob.includes('sound design') ? 'Sound design'
        : /arrang/.test(blob) ? 'Arrangement'
        : /\bmix/.test(blob) ? 'Mixing' : 'Technique',
      videoId:   vid,
      why:       (r.snippet || '').slice(0, 140) || 'A production idea to try in your next session.',
      sourceUrl: `https://www.youtube.com/watch?v=${vid}`,
    });
  }
  return out;
}

// Surprise (Artifact form) — discover a fresh remarkable object with a real source.
async function webSourceArtifact(feedbackWeights) {
  if (!webDiscovery?.available) return null;
  const hints = feedbackHints(feedbackWeights.surprise ?? {});
  const q = `fascinating little-known historical artifact OR object ${hints.prefer.slice(0, 2).join(' ')}`.trim();
  const results = await webDiscovery.search(q, { count: 6 });
  if (!results.length) return null;
  const picked = await webDiscovery.curate({
    task: 'Choose one genuinely remarkable, lesser-known historical artifact or object to feature today.',
    candidates: results,
    hints,
    responseShape: '{"name":"…","context":"≤250 chars: what it is + why it is remarkable","url":"<one candidate url>"}',
  });
  if (!picked?.name || !picked?.url || !results.some(r => r.url === picked.url)) return null;
  return {
    id: `web-artifact-${hostOf(picked.url)}`,
    name: picked.name,
    context: (picked.context ?? '').slice(0, 250),
    themes: [],
    sourceUrl: picked.url,
    sourceLabel: hostOf(picked.url),
  };
}

// Signal — discover a citable trend and build a small chart from STATED figures only.
async function webSourceChart(feedbackWeights, topic) {
  if (!webDiscovery?.available) return null;
  const hints = feedbackHints(feedbackWeights.chart ?? {});
  const profile = chartFeedbackProfile(feedbackWeights.chart ?? {});
  if (topic === 'AI' && profile.avoidAiFocused) return null;
  const q = `${topic} trend statistics 2024 2025 2026 report figures ${hints.prefer.slice(0, 1).join(' ')}${profile.avoidAiFocused ? ' non-AI' : ''}`.trim();
  const results = await webDiscovery.search(q, { count: 6 });
  if (!results.length) return null;
  // Enrich top results with page text so the model has real figures to quote.
  for (const r of results.slice(0, 3)) {
    const text = await webDiscovery.fetchText(r.url, { maxChars: 1200 });
    if (text) r.snippet = `${r.snippet}\n${text}`.slice(0, 1400);
  }
  const picked = await webDiscovery.curate({
    task: `Build one small ${topic} bar chart from a single credible source. Use ONLY numeric figures explicitly stated in the candidate text — never invent or estimate numbers. If no concrete figures are present, skip.${profile.avoidAiFocused ? ' Do not select an AI-focused, GenAI, LLM, or machine-learning chart.' : ''}`,
    candidates: results,
    hints,
    context: `Topic: ${topic}.`,
    responseShape: '{"title":"≤60 chars","unit":"e.g. $ bn","series":[{"label":"2024","value":110}, …3-7 points],"note":"≤200 chars","why":"≤120 chars","url":"<one candidate url>"}',
  });
  if (!picked) return null;
  const series = Array.isArray(picked.series)
    ? picked.series.filter(p => p && typeof p.value === 'number' && p.label).slice(0, 7)
    : [];
  if (series.length < 2) return null;
  if (!picked.title || !picked.url || !results.some(r => r.url === picked.url)) return null;
  const chart = {
    id: `web-chart-${hostOf(picked.url)}`,
    topic,
    title: picked.title,
    unit: picked.unit ?? '',
    note: picked.note ?? '',
    why: picked.why ?? '',
    series,
    sourceUrl: picked.url,
    sourceLabel: hostOf(picked.url),
  };
  return isRejectedChart(chart, profile) ? null : chart;
}

// Look — discover a fresh public-domain / CC image via Wikimedia Commons (zero-key).
async function sourceWikimediaCommons(targetDate, feedbackWeights) {
  if (process.env.ALMANAC_DISABLE_WEB === '1') return [];
  const hints = feedbackHints(feedbackWeights.image ?? {});
  const seed  = dateHash(targetDate + '-wiki');
  const base  = ['landscape painting', 'impressionist landscape', 'pastoral landscape', 'seascape painting', 'plein air landscape'];
  const term  = hints.prefer[0] ?? base[seed % base.length];
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(term + ' painting')}` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1000&origin=*`;
  try {
    const res = await fetch(api, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const d = await res.json();
    const out = [];
    for (const p of Object.values(d.query?.pages ?? {})) {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const meta    = info.extmetadata ?? {};
      const license = (meta.LicenseShortName?.value ?? '').toLowerCase();
      // Public-domain / Creative-Commons only.
      if (!/public domain|cc0|cc by|pd-|pd /.test(license)) continue;
      const artist = htmlToText(meta.Artist?.value ?? '', 80) || 'Unknown artist';
      const title = (p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, '').trim() || 'Untitled';
      const blob = `${title} ${artist} ${term}`.toLowerCase();
      if (IMAGE_ARCHIVE_SCAN_RE.test(blob)) continue;
      out.push({
        source:      'wikimedia',
        id:          `wiki-${p.pageid}`,
        title,
        artist,
        date:        htmlToText(meta.DateTimeOriginal?.value ?? '', 20),
        medium:      '',
        url:         info.thumburl,
        srcLink:     info.descriptionurl || `https://commons.wikimedia.org/?curid=${p.pageid}`,
        creditLabel: `${artist} · Wikimedia Commons (${meta.LicenseShortName?.value ?? 'public domain'})`,
        tags:        [term],
      });
    }
    return out;
  } catch (e) {
    warn(`wikimedia sourcer failed: ${e.message}`);
    return [];
  }
}

// Venture — web-augment the brief with 1-2 source-tagged market signals.
async function webAugmentVentureSignals(venture) {
  if (!webDiscovery?.available || !venture) return;
  const q = `${venture.title} market size growth competitors 2025 2026`;
  const results = await webDiscovery.search(q, { count: 5 });
  if (!results.length) return;
  const picked = await webDiscovery.curate({
    task: 'Extract up to 2 concrete, recent market signals for this venture, each grounded in a candidate. Do not invent figures.',
    candidates: results,
    context: `Venture: ${venture.title}. Pitch: ${venture.pitch}`,
    responseShape: '{"signals":[{"text":"≤90 chars","url":"<one candidate url>"}]}',
  });
  const adds = Array.isArray(picked?.signals) ? picked.signals : [];
  for (const s of adds.slice(0, 2)) {
    if (s?.text && s?.url && results.some(r => r.url === s.url)) {
      venture.research.signals.push(`${s.text} (${hostOf(s.url)})`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Generating edition for ${targetDate}${dryRun ? ' (dry-run)' : ''}${force ? ' (force)' : ''}`);

  await initKV();
  await setRunStatus('running', 'Starting');

  const editionKey = `alphalpha:almanac:edition:${targetDate}`;

  if (!dryRun && !force) {
    const existing = await kvGet(editionKey);
    if (existing) {
      log(`Edition ${targetDate} already exists. Use --force to overwrite.`);
      await setRunStatus('done', 'Existing edition kept', { completedAt: new Date().toISOString() });
      return;
    }
  }

  // Load everything that's needed synchronously / in parallel.
  const [feedbackWeights, allQuotes, fixture, exposureLedger] = await Promise.all([
    loadFeedbackWeights(),
    Promise.resolve(loadQuotesDataset()),
    Promise.resolve(loadFixture()),
    loadExposureLedger(),
  ]);

  if (!fixture) {
    console.error('[almanac] ERROR: fixture fallback unavailable — generated-data.local.json / generated-data.snapshot.json missing or has no daily block');
    process.exit(1);
  }

  const contextFiles = readContextFiles();

  // Feedback-honed web discovery layer (pluggable provider; budgeted per run).
  webDiscovery = createWebDiscovery({ log, warn });
  log(`Web discovery: ${webDiscovery.provider}${webDiscovery.available ? ' (active)' : ' (fallback — curated sources)'}`);
  await setRunStatus('running', `Discovery via ${webDiscovery.provider}`);

  const [recentMindIds, recentParentingIds, recentChartIds, recentArticleIds, recentImageIds, recentVentureIds, recentSurpriseIds, recentRiffIds, recentProductionIds, recentMusicSparkIds, recentPoemIds, recentLongReadIds, recentAustinExploreIds] = await Promise.all([
    getRecentIds('quote-mind'),
    getRecentIds('quote-parenting'),
    getRecentIds('chart'),
    getRecentIds('article'),
    getRecentIds('image'),
    getRecentIds('venture', 21),  // ventures cycle slowly; 21-day window
    getRecentIds('surprise', 7),  // 7-day window — 3 forms cycle in ~3 days each
    getRecentIds('riff', 7),      // riff pool rotates daily; 7-day no-repeat window
    getRecentIds('production', 4),// smaller pool; 4-day no-repeat window
    getRecentIds('music-spark', 10),
    getRecentIds('poem', 14),
    getRecentIds('longread', 14),
    getRecentIds('austin', 14),
  ]);

  log(`Feedback genres with signal: ${Object.keys(feedbackWeights).join(', ') || 'none yet'}`);
  log(`Context files: loops=${contextFiles.openLoopsText.length}b projects=${contextFiles.projectsText.length}b`);
  log(`Reading exposure ledger: ${exposureLedger.length} compact events`);
  log(`Recent IDs — mind:${recentMindIds.length} parenting:${recentParentingIds.length} article:${recentArticleIds.length} image:${recentImageIds.length} venture:${recentVentureIds.length} surprise:${recentSurpriseIds.length} riff:${recentRiffIds.length} production:${recentProductionIds.length} music:${recentMusicSparkIds.length}`);

  // ── Tile pipeline ────────────────────────────────────────────────────────

  log('Running tile pipeline…');
  await setRunStatus('running', 'Running tile pipeline');

  // Phase 1 — Quotes (deterministic, no LLM)
  const { quotes, parentingQuotes } = await runTile(
    'quotes',
    () => tileQuotes(targetDate, allQuotes, recentMindIds, recentParentingIds),
    { quotes: fixture.quotes, parentingQuotes: fixture.parentingQuotes },
  );

  // Phase 1 — "You" chart (activity manifest, no LLM)
  const youChart = await runTile(
    '"You" chart',
    () => tileYouChart(targetDate),
    null,
  );

  // Phase 2 — Article (Sourcer → Ranker → Composer; returns {article, sourceId} or null)
  let article       = fixture.article;
  let usedArticleIds = [];
  let articleNoveltyReport = null;
  let reading = [];
  let readingPortfolio = null;
  try {
    const result = await tileArticle(feedbackWeights, recentArticleIds, exposureLedger, contextFiles);
    articleNoveltyReport = result?.noveltyReport ?? null;
    if (result?.article) {
      article = result.article;
      reading = result.reading ?? [];
      readingPortfolio = result.readingPortfolio ?? null;
      usedArticleIds = result.sourceIds ?? [];
      log(`  article: OK — "${article.title.slice(0, 60)}…"`);
    } else {
      log('  article: no candidates — using fixture fallback');
    }
  } catch (e) {
    warn(`  article: ${e.message} — using fixture fallback`);
  }

  // Phase 3 — Image / Look (AI/generative art first, public-domain APIs as fallback)
  let image       = fixture.image;
  let usedImageId = null;
  try {
    const result = await tileImage(feedbackWeights, recentImageIds);
    if (result) {
      ({ image, sourceId: usedImageId } = result);
      log(`  image: OK — "${image.title.slice(0, 60)}"`);
    } else {
      log('  image: no candidates — using fixture fallback');
    }
  } catch (e) {
    warn(`  image: ${e.message} — using fixture fallback`);
  }

  // Phase 4 — Ventures (workspace candidates + LLM; 21-day dedup window)
  let ventures       = fixture.ventures ?? [];
  let usedVentureIds = [];
  try {
    const result = await tileVentures(feedbackWeights, recentVentureIds, contextFiles);
    if (result) {
      ({ ventures, usedIds: usedVentureIds } = result);
      log(`  ventures: OK — ${ventures.length} live (${ventures.map(v => v.name).join(', ')})`);
    } else {
      log('  ventures: no candidates — using fixture fallback');
    }
  } catch (e) {
    warn(`  ventures: ${e.message} — using fixture fallback`);
  }

  // Phase 5 — Surprise (form rotation: Word / Provocation / Artifact; 7-day dedup)
  let surprises       = fixture.surprises ?? [];
  let usedSurpriseIds = [];
  try {
    const result = await tileSurprise(feedbackWeights, recentSurpriseIds, contextFiles);
    if (result) {
      ({ usedIds: usedSurpriseIds } = result);
      surprises = [result.surprise];
      log(`  surprise: OK — form=${result.surprise.form} title="${result.surprise.title.slice(0, 50)}"`);
    } else {
      log('  surprise: no output — using fixture fallback');
    }
  } catch (e) {
    warn(`  surprise: ${e.message} — using fixture fallback`);
  }

  // Phase 6 — Signal / chart tile disabled by policy until it earns its space.
  const chartUsedIds = [];
  const charts = [];
  log('  charts: suppressed by Almanac policy');

  // Phase 7 — Guitar riff of the day (curated dataset + feedback-weighted rank)
  let riffs       = fixture.riffs ?? [];
  let usedRiffIds = [];
  try {
    const result = await tileRiff(feedbackWeights, recentRiffIds);
    if (result) {
      riffs = [result.riff];
      usedRiffIds = [result.usedId];
      log(`  riff: OK — "${result.riff.title.slice(0, 50)}" (${result.riff.genre})`);
    } else {
      log('  riff: no dataset — using fixture fallback');
    }
  } catch (e) {
    warn(`  riff: ${e.message} — using fixture fallback`);
  }

  // Phase 8 — Production technique / inspiration clip of the day
  let productionClips       = fixture.productionClips ?? [];
  let usedProductionIds     = [];
  try {
    const result = await tileProduction(feedbackWeights, recentProductionIds);
    if (result) {
      productionClips = [result.clip];
      usedProductionIds = [result.usedId];
      log(`  production: OK — "${result.clip.title.slice(0, 50)}" (${result.clip.daw})`);
    } else {
      log('  production: no dataset — using fixture fallback');
    }
  } catch (e) {
    warn(`  production: ${e.message} — using fixture fallback`);
  }

  const musicSpark = selectMusicSpark(buildMusicSparkCandidates({
    riff: riffs[0],
    production: productionClips[0],
  }), {
    recentIds: recentMusicSparkIds,
    feedback: feedbackWeights.music,
  }) ?? fixture.musicSpark;
  if (musicSpark) log(`  music spark: OK — ${musicSpark.format} · "${musicSpark.title.slice(0, 50)}"`);

  // Phase 9 — Poem of the day (curated source-backed dataset)
  let poems       = fixture.poems ?? [];
  let usedPoemIds = [];
  try {
    const result = await tilePoem(feedbackWeights, recentPoemIds);
    if (result) {
      poems = [result.poem];
      usedPoemIds = [result.usedId];
      log(`  poem: OK — "${result.poem.title.slice(0, 50)}" (${result.poem.poet})`);
    } else {
      log('  poem: no dataset — using fixture fallback');
    }
  } catch (e) {
    warn(`  poem: ${e.message} — using fixture fallback`);
  }

  // Phase 10 — Macro / investment long read (curated source-backed dataset)
  let longReads       = fixture.longReads ?? [];
  let usedLongReadIds = [];
  try {
    const result = await tileLongRead(feedbackWeights, recentLongReadIds, article);
    if (result) {
      longReads = [result.longRead];
      usedLongReadIds = [result.usedId];
      log(`  long read: OK — "${result.longRead.title.slice(0, 50)}" (${result.longRead.source})`);
    } else {
      log('  long read: no dataset — using fixture fallback');
    }
  } catch (e) {
    warn(`  long read: ${e.message} — using fixture fallback`);
  }

  // Phase 11 — Explore Austin (curated local place/activity)
  let austinExplores       = fixture.austinExplores ?? [];
  let usedAustinExploreIds = [];
  try {
    const result = await tileAustinExplore(feedbackWeights, recentAustinExploreIds);
    if (result) {
      austinExplores = [result.austinExplore];
      usedAustinExploreIds = [result.usedId];
      log(`  Austin explore: OK — "${result.austinExplore.title.slice(0, 50)}" (${result.austinExplore.category})`);
    } else {
      log('  Austin explore: no dataset — using fixture fallback');
    }
  } catch (e) {
    warn(`  Austin explore: ${e.message} — using fixture fallback`);
  }

  // ── Assemble & validate ───────────────────────────────────────────────────

  const investmentLens = selectInvestmentLens(buildInvestmentLensCandidates({
    marketBrief: loadWorkspaceJson('memory/investing/daily-market-brief/latest.json'),
    ideaFarm: loadWorkspaceJson('memory/investing/idea-farm/latest.json'),
    thesisReview: loadWorkspaceJson('memory/investing/portfolio-thesis-review/latest.json'),
  }), targetDate) ?? fixture.investmentLens;

  const edition = {
    edition: editionNumber(targetDate),
    image,
    article,
    reading,
    readingPortfolio,
    investmentLens,
    ventures,
    charts,
    quotes,
    parentingQuotes,
    surprises,
    riffs,
    productionClips,
    musicSpark,
    poems,
    macroRead: longReads[0] ?? fixture.macroRead ?? fixture.longReads?.[0],
    longReads,
    austinExplores,
  };

  try {
    validateDailyData(edition);
  } catch (e) {
    console.error(`[almanac] FATAL: final validation failed: ${e.message}`);
    console.error('[almanac] Aborting — edition NOT written.');
    process.exit(1);
  }

  log(`Edition assembled: ${edition.edition}`);
  log(`  image: ${image.title}${usedImageId ? ' (live)' : ' (fixture)'}`);
  log(`  article: ${article.source}${usedArticleIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  reading portfolio: ${reading.length || 1} item(s)${readingPortfolio ? ` · ${readingPortfolio.totalMinutes} min · ${readingPortfolio.status}` : ' · legacy'}`);
  log(`  investment lens: ${edition.investmentLens?.kind ?? 'none'} · ${edition.investmentLens?.title?.slice(0, 50) ?? 'none'}`);
  log(`  ventures: ${edition.ventures.length}${usedVentureIds.length ? ` live (${usedVentureIds.join(', ')})` : ' (fixture)'}`);
  log(`  surprise: form=${edition.surprises[0]?.form ?? 'none'}${usedSurpriseIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  quotes: ${edition.quotes.length} mind, ${edition.parentingQuotes.length} parenting`);
  log(`  charts: ${edition.charts.length} (suppressed)`);
  log(`  riff: ${edition.riffs[0]?.title?.slice(0, 40) ?? 'none'}${usedRiffIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  production: ${edition.productionClips[0]?.title?.slice(0, 40) ?? 'none'}${usedProductionIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  music spark: ${edition.musicSpark?.format ?? 'none'} · ${edition.musicSpark?.title?.slice(0, 40) ?? 'none'}`);
  log(`  poem: ${edition.poems?.[0]?.title?.slice(0, 40) ?? 'none'}${usedPoemIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  long read: ${edition.longReads?.[0]?.title?.slice(0, 40) ?? 'none'}${usedLongReadIds.length ? ' (live)' : ' (fixture)'}`);
  log(`  Austin explore: ${edition.austinExplores?.[0]?.title?.slice(0, 40) ?? 'none'}${usedAustinExploreIds.length ? ' (live)' : ' (fixture)'}`);

  if (dryRun) {
    log('Dry-run — printing edition, not writing to KV.');
    await setRunStatus('done', 'Dry-run complete', { completedAt: new Date().toISOString() });
    console.log(JSON.stringify(edition, null, 2));
    return;
  }

  if (!redis) {
    console.error('[almanac] ERROR: KV not available. Use --dry-run to preview.');
    process.exit(1);
  }

  await setRunStatus('running', 'Writing edition');
  // Force regenerates only replace the edition and history records. Feedback lives
  // under alphalpha:almanac:feedback:* and is read for tuning, never overwritten here.
  await kvSet(editionKey, edition);
  log(`Written to KV: ${editionKey}`);

  // Record used IDs for future dedup.
  const usedMindIds = edition.quotes
    .map(q => allQuotes.find(aq => aq.text === q.text && aq.genre === 'mind')?.id)
    .filter(Boolean);
  const usedParentingIds = edition.parentingQuotes
    .map(q => allQuotes.find(aq => aq.text === q.text && aq.genre === 'parenting')?.id)
    .filter(Boolean);

  await Promise.all([
    recordUsed('quote-mind',      usedMindIds,      targetDate),
    recordUsed('quote-parenting', usedParentingIds, targetDate),
    chartUsedIds.length > 0        ? recordUsed('chart',    chartUsedIds,    targetDate) : Promise.resolve(),
    usedArticleIds.length > 0      ? recordUsed('article',  usedArticleIds, targetDate) : Promise.resolve(),
    usedImageId                    ? recordUsed('image',    [usedImageId],   targetDate) : Promise.resolve(),
    usedVentureIds.length > 0      ? recordUsed('venture',  usedVentureIds,  targetDate) : Promise.resolve(),
    usedSurpriseIds.length > 0     ? recordUsed('surprise', usedSurpriseIds, targetDate) : Promise.resolve(),
    usedRiffIds.length > 0         ? recordUsed('riff',     usedRiffIds,     targetDate) : Promise.resolve(),
    usedProductionIds.length > 0   ? recordUsed('production', usedProductionIds, targetDate) : Promise.resolve(),
    edition.musicSpark ? recordUsed('music-spark', [`${edition.musicSpark.format}:${edition.musicSpark.id}`], targetDate) : Promise.resolve(),
    usedPoemIds.length > 0         ? recordUsed('poem', usedPoemIds, targetDate) : Promise.resolve(),
    usedLongReadIds.length > 0     ? recordUsed('longread', usedLongReadIds, targetDate) : Promise.resolve(),
    usedAustinExploreIds.length > 0 ? recordUsed('austin', usedAustinExploreIds, targetDate) : Promise.resolve(),
    recordExposures([
      ...(reading.length ? reading : [article]),
      ...longReads,
    ].filter(Boolean), targetDate),
  ]);

  log('History updated. Done.');
  await setRunStatus('done', 'Complete', {
    completedAt: new Date().toISOString(),
    novelty: articleNoveltyReport ? {
      candidates: articleNoveltyReport.candidateCount,
      eligible: articleNoveltyReport.eligibleCount,
      rejected: articleNoveltyReport.rejectedCount,
      reasons: articleNoveltyReport.rejectionReasons,
    } : null,
  });
}

main().catch(async e => {
  await setRunStatus('error', 'Failed', {
    error: e?.message ?? String(e),
    completedAt: new Date().toISOString(),
  });
  console.error('[almanac] Unhandled error:', e);
  process.exit(1);
});

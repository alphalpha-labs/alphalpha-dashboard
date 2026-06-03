#!/usr/bin/env node
/**
 * Daily Almanac generator — Phase 0 + Phase 1 + Phase 2 + Phase 3
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
 * Phase 3 tiles (public-domain APIs + optional LLM captions):
 *   - Image / Look: sourced from Met Museum + Art Institute of Chicago zero-key APIs;
 *     LLM writes caption + curator note (falls back to candidate metadata)
 *
 * All other tiles fall back to fixture.
 *
 * Registration: see scripts/almanac-automation.json for the OpenClaw cron descriptor.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    return entries.filter(e => e.date >= cutStr).map(e => e.id);
  } catch { return []; }
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

// ── Dataset loader ────────────────────────────────────────────────────────────

function loadQuotesDataset() {
  const p = path.join(repoRoot, 'lib', 'almanac-datasets', 'quotes.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
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

async function callOpenClaw(systemPrompt, userPrompt) {
  const baseUrl = process.env.OPENCLAW_BASE_URL;
  const token   = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!baseUrl || !token) return null; // silently skip — caller decides fallback

  const model = process.env.ALMANAC_COMPOSER_MODEL ?? 'claude-haiku-4-5-20251001';

  const res = await fetch(`${baseUrl}/v1/responses`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input:  [{ type: 'message', role: 'user', content: userPrompt }],
      stream: false,
      user:   'dashboard:almanac-generator:article',
    }),
  });

  if (!res.ok) throw new Error(`OpenClaw ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  // Try OpenAI Responses API shape, then Anthropic Messages shape.
  return (
    data.output?.[0]?.content?.[0]?.text ??
    data.output_text ??
    data.content?.[0]?.text ??
    null
  );
}

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
        why,
        themes: Array.isArray(fm.themes) ? fm.themes : [],
      };
    })
    // Skip anything already read or dismissed.
    .filter(c => !/^(read|done|dismissed)/i.test(c.status));
}

function rankArticle(candidates, feedbackWeights, recentIds, openLoopsText, projectsText) {
  if (candidates.length === 0) return null;

  const aw = feedbackWeights.article ?? {};

  // Keywords from open loops and project names for overlap scoring.
  const loopKeywords = extractBullets(openLoopsText)
    .flatMap(l => l.toLowerCase().split(/\W+/))
    .filter(w => w.length > 4);
  const projectNames = (projectsText.match(/^##\s+\d+\.\s+(.+)$/gm) ?? [])
    .map(l => stripMarkdown(l).replace(/^\d+\.\s+/, '').toLowerCase());

  const scored = candidates.map(c => {
    let score = 1.0;

    // Dedup: penalise anything seen in the last 14 days (by id or link).
    if (recentIds.includes(c.id) || (c.link && recentIds.includes(c.link)))
      score -= 10;

    // Source affinity learned from kept articles.
    if (c.source) score += (aw.sourceAffinity?.[c.source] ?? 0) * 0.2;

    // Nuance-chip signals from feedback.
    if ((aw.chipTallies?.['love the source']  ?? 0) > 0) score += 0.3;
    if ((aw.chipTallies?.['seen it']          ?? 0) > 0) score -= 0.3;
    if ((aw.chipTallies?.['too long']         ?? 0) > 0) score -= 0.2;
    if ((aw.chipTallies?.['go deeper']        ?? 0) > 0) score += 0.1;

    // Open-loop keyword overlap.
    const blob = `${c.title} ${c.why} ${c.themes.join(' ')}`.toLowerCase();
    score += loopKeywords.filter(kw => blob.includes(kw)).length * 0.1;

    // Project-name overlap.
    score += projectNames.filter(pn => blob.includes(pn)).length * 0.15;

    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].score < -5 ? null : scored[0]; // all deduped → null → fixture
}

async function composeArticle(candidate, contextFiles) {
  const { openLoopsText, projectsText } = contextFiles;

  // Estimate read time from source type when LLM is unavailable.
  const longForm = ['works in progress', 'the atlantic', 'new yorker', 'aeon',
                    'foreign affairs', 'n+1', 'harpers', 'london review'];
  const isLong = longForm.some(s => candidate.source?.toLowerCase().includes(s));
  const fallbackReadTime = isLong ? '12 min' : '8 min';

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

  return {
    kicker:   'Reading',
    source:   candidate.source ?? 'Unknown',
    readTime: composed?.readTime ?? fallbackReadTime,
    title:    candidate.title,
    dek:      composed?.dek ?? candidate.why,
    why:      composed?.why ?? 'Relevant to your current open loops and projects.',
  };
}

async function tileArticle(feedbackWeights, recentIds, contextFiles) {
  const candidates = sourceArticleCandidates();
  if (candidates.length === 0) return null;

  const best = rankArticle(
    candidates, feedbackWeights, recentIds,
    contextFiles.openLoopsText, contextFiles.projectsText,
  );
  if (!best) return null;

  const article = await composeArticle(best, contextFiles);
  if (!article.title?.trim()) throw new Error('article missing title after compose');
  if (!article.dek?.trim())   throw new Error('article missing dek after compose');

  // Prefer stable link over file-based ID for dedup — links survive renames.
  const sourceId = best.link ?? best.id;
  return { article, sourceId };
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
  return candidates;
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

function rankImage(candidates, feedbackWeights, recentIds) {
  if (candidates.length === 0) return null;

  const iw = feedbackWeights.image ?? {};

  const TASTE_KEYWORDS = [
    'landscape', 'light', 'hudson river', 'pastoral', 'impressi',
    'serene', 'quiet', 'nature', 'watercolor', 'plein air', 'golden',
    'mist', 'autumn', 'coast', 'garden', 'reflection', 'dawn', 'dusk',
  ];

  const scored = candidates.map(c => {
    let score = 1.0;

    if (recentIds.includes(c.id)) score -= 10;

    score += (iw.sourceAffinity?.[c.source] ?? 0) * 0.3;

    const blob = `${c.title} ${c.medium} ${c.tags.join(' ')}`.toLowerCase();
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
    : 'Art Institute of Chicago';
  const credit = candidate.artist
    ? `${candidate.artist}${candidate.date ? `, ${candidate.date}` : ''} · ${museumLabel}`
    : museumLabel;

  return {
    kicker:  'Look',
    title:   candidate.title,
    caption: composed?.caption
      ?? `${candidate.title} — ${candidate.medium || candidate.artist || 'a quiet study in light and form'}.`,
    credit,
    curator: composed?.curator
      ?? 'Selected from public-domain works matching your aesthetic taste.',
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

  // Source from both APIs concurrently.
  const [metResult, aicResult] = await Promise.allSettled([
    sourceMetMuseum(targetDate),
    sourceAIC(targetDate),
  ]);

  if (metResult.status === 'rejected')
    warn(`Met Museum sourcer failed: ${metResult.reason?.message}`);
  if (aicResult.status === 'rejected')
    warn(`AIC sourcer failed: ${aicResult.reason?.message}`);

  const all = [
    ...(metResult.status === 'fulfilled' ? metResult.value : []),
    ...(aicResult.status === 'fulfilled' ? aicResult.value : []),
  ];
  if (all.length === 0) return null;

  const best = rankImage(all, feedbackWeights, recentIds);
  if (!best) return null;

  const image = await composeImage(best);
  return { image, sourceId: best.id };
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

  if (!dryRun && !force) {
    const existing = await kvGet(editionKey);
    if (existing) {
      log(`Edition ${targetDate} already exists. Use --force to overwrite.`);
      return;
    }
  }

  // Load everything that's needed synchronously / in parallel.
  const [feedbackWeights, allQuotes, fixture] = await Promise.all([
    loadFeedbackWeights(),
    Promise.resolve(loadQuotesDataset()),
    Promise.resolve(loadFixture()),
  ]);

  if (!fixture) {
    console.error('[almanac] ERROR: fixture fallback unavailable — lib/generated-data.json missing or has no daily block');
    process.exit(1);
  }

  const contextFiles = readContextFiles();

  const [recentMindIds, recentParentingIds, recentChartIds, recentArticleIds, recentImageIds] = await Promise.all([
    getRecentIds('quote-mind'),
    getRecentIds('quote-parenting'),
    getRecentIds('chart'),
    getRecentIds('article'),
    getRecentIds('image'),
  ]);

  log(`Feedback genres with signal: ${Object.keys(feedbackWeights).join(', ') || 'none yet'}`);
  log(`Context files: loops=${contextFiles.openLoopsText.length}b projects=${contextFiles.projectsText.length}b`);
  log(`Recent IDs — mind:${recentMindIds.length} parenting:${recentParentingIds.length} article:${recentArticleIds.length} image:${recentImageIds.length}`);

  // ── Tile pipeline ────────────────────────────────────────────────────────

  log('Running tile pipeline…');

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
  let usedArticleId = null;
  try {
    const result = await tileArticle(feedbackWeights, recentArticleIds, contextFiles);
    if (result) {
      ({ article, sourceId: usedArticleId } = result);
      log(`  article: OK — "${article.title.slice(0, 60)}…"`);
    } else {
      log('  article: no candidates — using fixture fallback');
    }
  } catch (e) {
    warn(`  article: ${e.message} — using fixture fallback`);
  }

  // Phase 3 — Image / Look (public-domain APIs + optional LLM caption)
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

  // Phase 1–fallback tiles (pass-through from fixture)
  const ventures  = fixture.ventures  ?? [];
  const surprises = fixture.surprises ?? [];

  // Charts: inject live "You" chart if available; keep fixture otherwise.
  let charts;
  if (youChart) {
    const others = (fixture.charts ?? []).filter(c => c.topic !== 'You');
    charts = [...others, youChart];
  } else {
    charts = fixture.charts ?? [];
  }

  // ── Assemble & validate ───────────────────────────────────────────────────

  const edition = {
    edition: editionNumber(targetDate),
    image,
    article,
    ventures,
    charts,
    quotes,
    parentingQuotes,
    surprises,
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
  log(`  article: ${article.source}${usedArticleId ? ' (live)' : ' (fixture)'}`);
  log(`  quotes: ${edition.quotes.length} mind, ${edition.parentingQuotes.length} parenting`);
  log(`  charts: ${edition.charts.length} (You chart: ${youChart ? 'live' : 'fixture'})`);

  if (dryRun) {
    log('Dry-run — printing edition, not writing to KV.');
    console.log(JSON.stringify(edition, null, 2));
    return;
  }

  if (!redis) {
    console.error('[almanac] ERROR: KV not available. Use --dry-run to preview.');
    process.exit(1);
  }

  await kvSet(editionKey, edition);
  log(`Written to KV: ${editionKey}`);

  // Record used IDs for future dedup.
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
    usedArticleId ? recordUsed('article', [usedArticleId], targetDate) : Promise.resolve(),
    usedImageId   ? recordUsed('image',   [usedImageId],   targetDate) : Promise.resolve(),
  ]);

  log('History updated. Done.');
}

main().catch(e => {
  console.error('[almanac] Unhandled error:', e);
  process.exit(1);
});

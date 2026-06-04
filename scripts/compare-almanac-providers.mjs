#!/usr/bin/env node
/**
 * Dry-run Tavily vs OpenClaw web_search Almanac generation and write a compact
 * side-by-side report for human review. This never writes an edition to KV.
 *
 * Usage:
 *   node scripts/compare-almanac-providers.mjs --date=YYYY-MM-DD
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dateArg = args.find(a => a.startsWith('--date='))?.slice('--date='.length);
const date = dateArg ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Invalid date: ${date}. Expected YYYY-MM-DD.`);
  process.exit(1);
}

const outDir = path.join(repoRoot, 'artifacts', 'almanac-bakeoff');
fs.mkdirSync(outDir, { recursive: true });
const tavilyUsagePath = path.resolve(repoRoot, '..', 'memory', 'almanac', 'tavily-usage.json');

function extractJson(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return null;
  }
}

function runProvider(provider) {
  const res = spawnSync(process.execPath, ['scripts/generate-almanac.mjs', '--dry-run', `--date=${date}`], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ALMANAC_SEARCH_PROVIDER: provider,
      ALMANAC_SEARCH_MAX: process.env.ALMANAC_SEARCH_MAX ?? '12',
      ALMANAC_FETCH_MAX: process.env.ALMANAC_FETCH_MAX ?? '8',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    provider,
    ok: res.status === 0,
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    edition: extractJson(res.stdout),
  };
}

function host(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function readJsonMaybe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function searchStats(run) {
  const lines = run.stdout.split('\n');
  const matches = lines
    .map(line => line.match(/\[almanac\]\s+web:\s+".*?"\s+→\s+(\d+)\s+via\s+(\w+)/))
    .filter(Boolean);
  const searches = matches.length;
  const usableResults = matches.reduce((sum, m) => sum + Number(m[1] || 0), 0);
  const usableSearches = matches.filter(m => Number(m[1] || 0) > 0).length;
  return {
    searches,
    usableSearches,
    usableResults,
    providerHits: [...new Set(matches.map(m => m[2]))],
  };
}

function liveFixtureMap(run) {
  const out = run.stdout;
  const charts = out.match(/\[almanac\]\s+charts:.*\(You:(live|fix) Investing:(live|fix) AI:(live|fix)\)/);
  return {
    Read: /\[almanac\]\s+article:/.test(out) ? (/\[almanac\]\s+article:.*\(live\)/.test(out) ? 'live' : 'fixture') : 'unknown',
    Look: /\[almanac\]\s+image:.*\(live\)/.test(out) ? 'live' : 'fixture',
    Venture: /\[almanac\]\s+ventures:.*live/.test(out) ? 'live' : 'fixture',
    Signal: charts ? `You:${charts[1]} Investing:${charts[2]} AI:${charts[3]}` : 'unknown',
    Surprise: /\[almanac\]\s+surprise:.*\(live\)/.test(out) ? 'live' : 'fixture',
    Poem: /\[almanac\]\s+poem:.*\(live\)/.test(out) ? 'live' : 'fixture',
    'Long Read': /\[almanac\]\s+long read:.*\(live\)/.test(out) ? 'live' : 'fixture',
    Riff: /\[almanac\]\s+riff:.*\(live\)/.test(out) ? 'live' : 'fixture',
    Studio: /\[almanac\]\s+production:.*\(live\)/.test(out) ? 'live' : 'fixture',
  };
}

function youtubeStatus(url) {
  const id = (url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (!id) return 'not YouTube';
  return `embeddable candidate: https://www.youtube.com/embed/${id}`;
}

function titleFor(providerRun, tile) {
  const e = providerRun.edition;
  if (!e) return { title: 'generation failed', source: providerRun.stderr.split('\n').find(Boolean) ?? 'no JSON output', url: '' };
  if (tile === 'Read') return { title: e.article?.title, source: e.article?.source, url: e.article?.url };
  if (tile === 'Look') return { title: e.image?.title, source: e.image?.credit, url: e.image?.srcLink || e.image?.url };
  if (tile === 'Venture') return { title: e.ventures?.[0]?.title, source: e.ventures?.[0]?.research?.signals?.[0], url: '' };
  if (tile === 'Signal') return { title: e.charts?.find(c => c.topic !== 'You')?.title, source: e.charts?.find(c => c.topic !== 'You')?.sourceLabel, url: e.charts?.find(c => c.topic !== 'You')?.sourceUrl };
  if (tile === 'Surprise') return { title: e.surprises?.[0]?.title, source: e.surprises?.[0]?.sourceLabel, url: e.surprises?.[0]?.sourceUrl };
  if (tile === 'Riff') return { title: e.riffs?.[0]?.title, source: e.riffs?.[0]?.artist, url: e.riffs?.[0]?.sourceUrl };
  if (tile === 'Studio') return { title: e.productionClips?.[0]?.title, source: e.productionClips?.[0]?.creator, url: e.productionClips?.[0]?.sourceUrl };
  if (tile === 'Poem') return { title: e.poems?.[0]?.title, source: e.poems?.[0]?.poet, url: e.poems?.[0]?.sourceUrl };
  if (tile === 'Long Read') return { title: e.longReads?.[0]?.title, source: e.longReads?.[0]?.source, url: e.longReads?.[0]?.url };
  return { title: '', source: '', url: '' };
}

function summaryLines(run) {
  return run.stdout
    .split('\n')
    .filter(line => /^\[almanac\]\s{2}/.test(line) || /Web discovery:|Feedback genres|Dry-run/.test(line))
    .slice(0, 40);
}

const runs = [runProvider('tavily'), runProvider('openclaw')];
const [tavily, openclaw] = runs;
const tiles = ['Read', 'Look', 'Venture', 'Signal', 'Surprise', 'Poem', 'Long Read', 'Riff', 'Studio'];
const usage = readJsonMaybe(tavilyUsagePath);
const runDiagnostics = Object.fromEntries(runs.map(r => [r.provider, {
  searches: searchStats(r),
  liveFixture: liveFixtureMap(r),
}]));
const tavilyBurn = searchStats(tavily).searches;

const jsonPath = path.join(outDir, `${date}.json`);
fs.writeFileSync(jsonPath, JSON.stringify({
  date,
  generatedAt: new Date().toISOString(),
  diagnostics: {
    criteria: {
      Read: 'Honors feedback: avoid x.com; prefer socio-political, economic, religious-cultural analysis.',
      Signal: 'Real source-backed chart/data source vs curated/fixture fallback.',
      'Riff / Studio': 'Real, embeddable, relevant YouTube URLs.',
      Surprise: 'Fresh with a working source URL.',
      Poem: 'Curated poem has a real source URL and fits the day rather than feeling decorative.',
      'Long Read': 'Macro/investment thesis is substantial, source-backed, and worth the time cost.',
      Overall: 'Live-source quality improvement worth Tavily credit burn.',
    },
    runs: runDiagnostics,
    tavilyCreditBurn: {
      estimatedCreditsThisBakeoff: tavilyBurn,
      usageLedger: usage ? {
        updatedAt: usage.updatedAt,
        startingCredits: usage.startingCredits,
        cumulativeSearches: usage.cumulativeSearches,
        estCreditsRemaining: usage.estCreditsRemaining,
        estDaysLeft: usage.estDaysLeft,
        projectedExhaustionDateAt12PerDay: usage.projectedExhaustionDateAt12PerDay,
      } : null,
    },
  },
  runs: runs.map(r => ({
    provider: r.provider,
    ok: r.ok,
    status: r.status,
    summary: summaryLines(r),
    edition: r.edition,
    stderr: r.stderr,
  })),
}, null, 2));

const table = tiles.map(tile => {
  const a = titleFor(tavily, tile);
  const b = titleFor(openclaw, tile);
  const aLive = runDiagnostics.tavily.liveFixture[tile] ?? 'unknown';
  const bLive = runDiagnostics.openclaw.liveFixture[tile] ?? 'unknown';
  return `| ${tile} | ${a.title || ''}<br>${a.url ? host(a.url) : (a.source || '')}<br><small>${aLive}</small> | ${b.title || ''}<br>${b.url ? host(b.url) : (b.source || '')}<br><small>${bLive}</small> |  |  |  |  |`;
}).join('\n');

const youtubeRows = ['Riff', 'Studio'].map(tile => {
  const a = titleFor(tavily, tile);
  const b = titleFor(openclaw, tile);
  return `| ${tile} | ${a.url || ''} | ${youtubeStatus(a.url)} | ${b.url || ''} | ${youtubeStatus(b.url)} |`;
}).join('\n');

function providerDiag(provider) {
  const d = runDiagnostics[provider];
  return [
    `Searches issued: ${d.searches.searches}`,
    `Usable search result batches: ${d.searches.usableSearches}/${d.searches.searches}`,
    `Total usable result URLs: ${d.searches.usableResults}`,
    `Provider hits: ${d.searches.providerHits.join(', ') || 'none'}`,
    `Tiles: ${Object.entries(d.liveFixture).map(([k, v]) => `${k}=${v}`).join('; ')}`,
  ];
}

const tavilyRunway = usage
  ? [
      `Estimated bakeoff burn: ${tavilyBurn} Tavily credits/searches.`,
      `Ledger remaining: ${usage.estCreditsRemaining} credits; projected runway ${usage.estDaysLeft} days at 12/day; projected exhaustion ${usage.projectedExhaustionDateAt12PerDay}.`,
      `Ledger updated: ${usage.updatedAt}.`,
    ].join('\n')
  : `Estimated bakeoff burn: ${tavilyBurn} Tavily credits/searches. No local Tavily usage ledger found at ${path.relative(repoRoot, tavilyUsagePath)}.`;

const md = `# Almanac A/B Bake-off — ${date}

Generated: ${new Date().toISOString()}

Dry-run only. No edition was written to KV and no tuning feedback was changed. Provider selection was forced once per run with \`ALMANAC_SEARCH_PROVIDER=tavily\` and \`ALMANAC_SEARCH_PROVIDER=openclaw\`; Tavily failures do not fall through to model-native search.

## How to Score

Use 1-5 scores:

- Read: did it honor feedback, especially avoiding x.com and surfacing more socio-political, economic, religious-cultural analysis?
- Signal: did it find a real source-backed chart/data source, or fall back to curated/fixture data?
- Riff / Studio: are YouTube URLs real, embeddable, and relevant?
- Surprise: is it genuinely fresh with a working source URL?
- Poem / Long Read: are the source URLs real, relevant, and worth the attention cost?
- Overall: did one provider materially improve live-source quality enough to justify credit burn?

| Tile | Tavily | OpenClaw web_search | Relevance | Freshness | Source quality | Winner |
|---|---|---|---|---|---|---|
${table}

## Diagnostics

### Tavily

${providerDiag('tavily').map(l => `- ${l}`).join('\n')}

### OpenClaw web_search

${providerDiag('openclaw').map(l => `- ${l}`).join('\n')}

### YouTube Checks

| Tile | Tavily URL | Tavily embed check | OpenClaw URL | OpenClaw embed check |
|---|---|---|---|---|
${youtubeRows}

### Tavily Credit Burn

${tavilyRunway}

## Provider Logs

### Tavily

${summaryLines(tavily).map(l => `- ${l}`).join('\n') || '- No summary lines captured.'}

### OpenClaw web_search

${summaryLines(openclaw).map(l => `- ${l}`).join('\n') || '- No summary lines captured.'}

## Feedback Loop

After picking winners, use the live dashboard's Tune controls on today's visible tile for durable taste feedback. This report is for provider/source comparison; the persistent tuning store remains \`alphalpha:almanac:feedback:YYYY-MM-DD\`.

Raw JSON: \`${path.relative(repoRoot, jsonPath)}\`
`;

const mdPath = path.join(outDir, `${date}.md`);
fs.writeFileSync(mdPath, md);

console.log(`Wrote ${path.relative(repoRoot, mdPath)}`);
console.log(`Wrote ${path.relative(repoRoot, jsonPath)}`);

if (runs.some(r => !r.ok || !r.edition)) process.exitCode = 1;

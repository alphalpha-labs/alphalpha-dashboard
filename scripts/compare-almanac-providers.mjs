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
const tiles = ['Read', 'Look', 'Venture', 'Signal', 'Surprise', 'Riff', 'Studio'];

const jsonPath = path.join(outDir, `${date}.json`);
fs.writeFileSync(jsonPath, JSON.stringify({
  date,
  generatedAt: new Date().toISOString(),
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
  return `| ${tile} | ${a.title || ''}<br>${a.url ? host(a.url) : (a.source || '')} | ${b.title || ''}<br>${b.url ? host(b.url) : (b.source || '')} |  |  |  |  |`;
}).join('\n');

const md = `# Almanac A/B Bake-off — ${date}

Generated: ${new Date().toISOString()}

Dry-run only. No edition was written to KV and no tuning feedback was changed.

## How to Score

Use 1-5 scores. Relevance means "would I actually want this in my daily Almanac?" Freshness means "does this feel timely or non-stale?" Source quality means "is the source real, inspectable, and better than fixture filler?"

| Tile | Tavily | OpenClaw web_search | Relevance | Freshness | Source quality | Winner |
|---|---|---|---|---|---|---|
${table}

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

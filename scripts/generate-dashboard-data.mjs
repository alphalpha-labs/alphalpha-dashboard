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
  if (/(low|minor|someday|nice-to-have)/.test(lower)) return 'LOW';
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, 'lib', 'generated-data.json');
const contextRoot = process.env.ALPHALPHA_CONTEXT_DIR
  ? path.resolve(process.env.ALPHALPHA_CONTEXT_DIR)
  : path.resolve(repoRoot, '..', 'context');

function read(rel) {
  const filePath = path.join(contextRoot, rel);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function mtime(rel) {
  const filePath = path.join(contextRoot, rel);
  return fs.existsSync(filePath) ? fs.statSync(filePath).mtime.toISOString() : null;
}

function stripMarkdown(line) {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function firstSentence(text, fallback = '') {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] || cleaned).slice(0, 220);
}

function lines(md) {
  return md.split(/\r?\n/).map((line) => line.trimEnd());
}

function extractSection(md, heading) {
  const all = lines(md);
  const start = all.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return '';
  const level = heading.match(/^#+/)?.[0].length ?? 2;
  const end = all.findIndex((line, idx) => idx > start && /^#+\s+/.test(line) && (line.match(/^#+/)?.[0].length ?? 99) <= level);
  return all.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

function extractBullets(md, { checkedOnly = false } = {}) {
  return lines(md)
    .filter((line) => checkedOnly ? /^- \[ \]\s+/.test(line.trim()) : /^-\s+/.test(line.trim()))
    .map((line) => stripMarkdown(line.replace(/^- \[ \]\s+/, '- ')))
    .filter(Boolean);
}

function priorityFor(text) {
  const lower = text.toLowerCase();
  if (/(urgent|high|fix|blocked|credential|source-of-truth|approval policy)/.test(lower)) return 'high';
  if (/(later|low|clarify|decide)/.test(lower)) return 'medium';
  return 'medium';
}

function parseProjects(projectsMd) {
  const all = lines(projectsMd);
  const starts = [];
  all.forEach((line, index) => {
    if (/^##\s+\d+\.\s+/.test(line)) starts.push(index);
  });

  return starts.slice(0, 6).map((start, idx) => {
    const end = starts[idx + 1] ?? all.length;
    const block = all.slice(start, end).join('\n');
    const rawTitle = stripMarkdown(all[start]).replace(/^\d+\.\s+/, '');
    const [namePart, subtitle] = rawTitle.split(/\s+—\s+|\s+-\s+/);
    const goal = extractSection(block, '**Goal:**') || '';
    const openLoop = extractBullets(extractSection(block, '**Open loops:**'))[0];
    const known = extractBullets(extractSection(block, '**Known context:**'))[0];
    const status = /waiting|blocked|fix|credential|permission/i.test(openLoop || '') ? 'waiting' : 'active';

    return {
      name: namePart.trim(),
      domain: (subtitle || domainFor(namePart)).trim(),
      status,
      lastActivity: idx === 0 ? 'today' : 'recent memory',
      nextAction: openLoop || firstSentence(goal, known || 'Review and update project context.'),
      blocker: status === 'waiting' ? 'Needs source/permission decision' : null,
      source: 'context/PROJECTS.md',
    };
  });
}

function domainFor(name) {
  const lower = name.toLowerCase();
  if (lower.includes('invest')) return 'Investing';
  if (lower.includes('obsidian')) return 'Knowledge management';
  if (lower.includes('openclaw')) return 'Orchestration';
  if (lower.includes('austin')) return 'Local events';
  if (lower.includes('landscap')) return 'Home operations';
  if (lower.includes('health')) return 'Family finance';
  return 'Agentic OS';
}

function parseOpenLoops(openLoopsMd) {
  const allLoops = extractBullets(openLoopsMd, { checkedOnly: true });
  return allLoops.slice(0, 8).map((item) => ({
    item: item.replace(/\s+_Status:.*$/, '').trim(),
    owner: item.toLowerCase().includes('alex') ? 'Alex' : 'Alphalpha',
    due: /dashboard|context|source-of-truth|capture|working copy/i.test(item) ? 'This week' : 'Later',
    priority: priorityFor(item),
    next: nextActionFor(item),
  }));
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

function parseInvesting(openLoopsMd) {
  const tickerLine = lines(openLoopsMd).find((line) => line.includes('EME, FIX')) || '';
  const tickers = tickerLine.match(/[A-Z]{2,5}(?:\.[A-Z])?/g) || ['EME', 'PWR', 'BWXT', 'CIEN', 'DHR', 'KTOS'];
  const themes = {
    EME: 'Grid/data-center construction', FIX: 'Building systems + electrification', PWR: 'Transmission/grid hardening', BWXT: 'Nuclear services + defense nuclear',
    HWM: 'Aerospace/defense supply chain', HEI: 'Aerospace components', KTOS: 'Defense modernization / drones', AVAV: 'Autonomous systems / drones',
    CIEN: 'AI optical/network bandwidth', GLW: 'Glass/fiber/materials', DHR: 'Healthcare tools / boring quality', BSX: 'Medical devices',
    MUFG: 'Japan financials', SMFG: 'Japan financials', CCJ: 'Uranium / nuclear fuel cycle',
  };
  return tickers.slice(0, 10).map((ticker) => ({
    ticker,
    theme: themes[ticker] || 'Research candidate from imported watchlist',
    stance: /^(PWR|BWXT|EME)$/.test(ticker) ? 'High-priority research' : 'Research first',
    confidence: /^(PWR|BWXT|EME)$/.test(ticker) ? 'high' : 'medium',
    trigger: 'Add valuation, crowding, catalyst, and entry trigger.',
    contradiction: 'Thesis may already be priced or instrument exposure may be impure.',
  }));
}

function fileDigest(title, source, rel, summary, tags) {
  const stamp = mtime(rel);
  return {
    title,
    source,
    date: (stamp || new Date().toISOString()).slice(0, 10),
    summary,
    tags,
  };
}

function buildData() {
  const about = read('ABOUT.md');
  const prefs = read('PREFERENCES.md');
  const projectsMd = read('PROJECTS.md');
  const openLoopsMd = read('OPEN_LOOPS.md');
  const decisions = read('DECISIONS.md');
  const protocol = read('MEMORY_PROTOCOL.md');

  if (!projectsMd || !openLoopsMd) {
    if (fs.existsSync(outputPath)) {
      console.log(`Context not found at ${contextRoot}; keeping existing ${path.relative(repoRoot, outputPath)}.`);
      return null;
    }
    throw new Error(`Missing context files at ${contextRoot} and no generated data exists.`);
  }

  const openLoops = parseOpenLoops(openLoopsMd);
  const projects = parseProjects(projectsMd);
  const checked = extractBullets(openLoopsMd, { checkedOnly: true });
  const highPriority = checked.filter((item) => priorityFor(item) === 'high');
  const uncertain = extractBullets(read('UNCERTAINTIES.md')).length;

  return {
    generatedAt: new Date().toISOString(),
    metrics: [
      { label: 'Open loops', value: String(checked.length), detail: 'from context/OPEN_LOOPS.md', tone: 'amber' },
      { label: 'Active projects', value: String(projects.length), detail: 'from context/PROJECTS.md', tone: 'green' },
      { label: 'High priority', value: String(highPriority.length), detail: 'needs review/action', tone: 'red' },
      { label: 'Uncertainties', value: String(uncertain), detail: 'explicitly flagged', tone: 'blue' },
      { label: 'Investing signals', value: String(parseInvesting(openLoopsMd).length), detail: 'candidate tickers saved', tone: 'purple' },
    ],
    attentionQueue: openLoops.slice(0, 4).map((loop) => ({
      title: loop.item,
      reason: `Imported from ${loop.due === 'This week' ? 'near-term' : 'backlog'} Alphalpha open loops.`,
      priority: loop.priority,
      age: 'from context',
      confidence: 'high',
      action: loop.next,
    })),
    projects,
    openLoops,
    investingCandidates: parseInvesting(openLoopsMd),
    digests: [
      fileDigest('ChatGPT brain dump converted to canonical context', 'Context import', 'imports/2026-05-01-chatgpt-braindump.md', 'Raw import is preserved and split into durable Alphalpha files for source-backed dashboarding.', ['memory', 'context', 'import']),
      fileDigest('About + preference context available', 'ABOUT/PREFERENCES', 'ABOUT.md', firstSentence(extractSection(about, '## Stable context')) || 'Stable personal context and communication preferences are available.', ['about', 'preferences']),
      fileDigest('Project registry and open loops are now source files', 'PROJECTS/OPEN_LOOPS', 'PROJECTS.md', `Dashboard generated from ${projects.length} project entries and ${checked.length} open loops.`, ['projects', 'open-loops']),
      fileDigest('Memory protocol drafted', 'MEMORY_PROTOCOL', 'MEMORY_PROTOCOL.md', firstSentence(extractSection(protocol, '## Goal')) || 'Protocol separates imports, durable context, daily memory, and dashboard-facing open loops.', ['memory', 'protocol']),
      fileDigest('Durable decisions captured', 'DECISIONS', 'DECISIONS.md', firstSentence(extractSection(decisions, '## Personal AI / knowledge system')) || 'Key architecture decisions captured for Alphalpha and OpenClaw.', ['decisions', 'architecture']),
    ],
    sourceHealth: {
      contextRoot,
      files: ['ABOUT.md', 'PREFERENCES.md', 'PROJECTS.md', 'OPEN_LOOPS.md', 'DECISIONS.md', 'MEMORY_PROTOCOL.md'].map((rel) => ({ rel, updatedAt: mtime(rel) })),
    },
  };
}

const data = buildData();
if (data) {
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${contextRoot}`);
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
function readJsonAbsolute(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function readWorkspaceManifest(rel) {
  const candidates = [
    path.resolve(contextRoot, '..', rel),
    path.resolve(repoRoot, '..', rel),
  ];
  for (const candidate of candidates) {
    const parsed = readJsonAbsolute(candidate, null);
    if (parsed) return { ...parsed, path: candidate };
  }
  return null;
}
function readContextIndex() {
  return readWorkspaceManifest(path.join('memory', 'context', 'index.json'));
}
function readSourceManifests() {
  return {
    context: readContextIndex(),
    events: readWorkspaceManifest(path.join('memory', 'events', 'latest-manifest.json')),
    aiTooling: readWorkspaceManifest(path.join('memory', 'ai-tooling', 'latest-manifest.json')),
    investing: readWorkspaceManifest(path.join('memory', 'investing', 'latest-watchlist.json')),
    obsidian: readWorkspaceManifest(path.join('memory', 'obsidian', 'proposed-updates', 'latest-manifest.json')),
    automations: readWorkspaceManifest(path.join('memory', 'automations', 'latest-manifest.json')),
    reviewQueue: readWorkspaceManifest(path.join('memory', 'review-queue', 'latest-manifest.json')),
    thesisBaskets: readWorkspaceManifest(path.join('memory', 'thesis-baskets-ingestion-state.json')),
    investmentDecisionDigest: readWorkspaceManifest(path.join('memory', 'thesis-baskets', 'latest-decision-digest.json')),
  };
}
function runGit(repoPath, args) {
  try {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
  } catch {
    return null;
  }
}
function gitRepoStatus(repoPath, label) {
  if (!fs.existsSync(path.join(repoPath, '.git'))) return null;
  const branch = runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
  const commit = runGit(repoPath, ['rev-parse', '--short', 'HEAD']) || 'unknown';
  const lastCommitIso = runGit(repoPath, ['log', '-1', '--format=%cI']) || null;
  const statusArgs = repoPath === repoRoot
    ? ['status', '--porcelain', '--untracked-files=no', '--', ':!lib/generated-data.json', ':!.next']
    : ['status', '--porcelain', '--untracked-files=no'];
  const status = runGit(repoPath, statusArgs) || '';
  const upstream = runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const divergence = upstream ? runGit(repoPath, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]) : null;
  const [ahead = 0, behind = 0] = (divergence || '').split(/\s+/).map(Number);
  return {
    label,
    path: path.relative(repoRoot, repoPath),
    branch,
    commit,
    lastCommitIso,
    dirtyFiles: status ? status.split('\n').filter(Boolean).length : 0,
    upstream: upstream || null,
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}
function githubStatus() {
  const workspaceRoot = path.resolve(repoRoot, '..');
  const repos = [
    [workspaceRoot, 'Alphalpha workspace'],
    [repoRoot, 'Alphalpha dashboard'],
    [path.join(workspaceRoot, 'obsidian-vault'), 'Obsidian vault'],
    [path.join(workspaceRoot, 'openclaw-workspace'), 'OpenClaw workspace'],
  ].map(([repoPath, label]) => gitRepoStatus(repoPath, label)).filter(Boolean);
  if (!repos.length) return null;
  const lastCommitIso = repos.map(r => r.lastCommitIso).filter(Boolean).sort().at(-1) || null;
  return {
    generatedAt: new Date().toISOString(),
    lastCommitIso,
    totals: {
      repos: repos.length,
      dirtyRepos: repos.filter(r => r.dirtyFiles > 0).length,
      dirtyFiles: repos.reduce((sum, r) => sum + r.dirtyFiles, 0),
      ahead: repos.reduce((sum, r) => sum + r.ahead, 0),
      behind: repos.reduce((sum, r) => sum + r.behind, 0),
    },
    repos,
  };
}


function readActivity() {
  const workspaceRoot = path.resolve(repoRoot, '..');
  const sources = [
    ['dashboard', path.join(workspaceRoot, 'memory', 'dashboard', 'action-state.json')],
    ['review', path.join(workspaceRoot, 'memory', 'review-queue', 'action-state.json')],
    ['automation', path.join(workspaceRoot, 'memory', 'dashboard', 'automation-actions.json')],
    ['event-feedback', path.join(workspaceRoot, 'memory', 'events', 'feedback-manifest.json')],
  ];
  const rows = [];
  for (const [source, file] of sources) {
    const data = readJsonAbsolute(file, null);
    if (!data) continue;
    const actions = Array.isArray(data.actions) ? data.actions : Array.isArray(data.feedback) ? data.feedback : [];
    actions.slice(0, 80).forEach((action, idx) => {
      const failed = Boolean(action.error || action.result?.error || action.status === 'failed');
      rows.push({
        id: `${source}-${action.at || action.timestamp || idx}-${action.itemId || action.jobId || action.eventKey || idx}`,
        at: action.at || action.timestamp || data.updatedAt || data.generatedAt || new Date().toISOString(),
        kind: source,
        title: action.title || action.action || action.type || action.feedbackType || action.jobId || action.eventKey || source,
        status: failed ? 'failed' : 'applied',
        summary: action.mutation || action.result?.mutation || action.action || action.type || action.feedbackType || 'recorded',
        source,
      });
    });
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
}

function deploymentMeta() {
  const local = gitRepoStatus(repoRoot, 'Alphalpha dashboard');
  return {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || local?.commit || 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF || local?.branch || 'unknown',
    generatedAt: new Date().toISOString(),
    deployUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    productionUrl: 'https://alphalpha-dashboard.vercel.app',
    dirtyFiles: local?.dirtyFiles ?? 0,
  };
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
    posture: 'Keep the dashboard live, source-backed, and reviewable.',
    postureDetail: 'Phase 2 is underway: the build consumes context files plus Obsidian, GitHub, cron, review queue, investing, and Thesis Baskets manifests when available.',
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
function contextHealthFromIndex(index) {
  if (!index) return null;
  const largestActive = (index.items || [])
    .filter(item => item.category !== 'archive')
    .sort((a, b) => (b.words || 0) - (a.words || 0))
    .slice(0, 5)
    .map(item => ({
      path: item.path,
      words: item.words,
      estimatedTokens: item.estimatedTokens,
      readPolicy: item.readPolicy,
    }));
  return {
    generatedAt: index.generatedAt,
    sourcePath: index.path ? path.relative(repoRoot, index.path) : 'memory/context/index.json',
    files: index.totals?.files ?? 0,
    words: index.totals?.words ?? 0,
    estimatedTokens: index.totals?.estimatedTokens ?? 0,
    activeFiles: index.activeTotals?.files ?? 0,
    activeWords: index.activeTotals?.words ?? 0,
    activeEstimatedTokens: index.activeTotals?.estimatedTokens ?? 0,
    archiveFiles: index.totals?.byCategory?.archive?.files ?? 0,
    archiveWords: index.totals?.byCategory?.archive?.words ?? 0,
    largestActive,
  };
}
function ageHours(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 36e5) : Infinity;
}
function ageLabel(iso) {
  const hoursRaw = ageHours(iso);
  if (!Number.isFinite(hoursRaw)) return 'unknown';
  const hours = Math.round(hoursRaw);
  if (hours < 24) return `${hours}h old`;
  return `${Math.round(hours / 24)}d old`;
}
function statusFor(iso, { staleHours, failingHours, empty = false, proposal = false } = {}) {
  if (!iso || empty) return 'FAILING';
  if (proposal) return 'PROPOSAL';
  const hours = ageHours(iso);
  if (hours >= failingHours) return 'FAILING';
  if (hours >= staleHours) return 'STALE';
  return 'OK';
}
function eventCandidatesFromManifest(events) {
  if (!events) return [];
  const family = (events.latest?.family?.topCandidates || []).slice(0, 3).map((event, idx) => ({ ...event, id: `family-${idx + 1}`, kind: 'family' }));
  const music = (events.latest?.music?.topCandidates || []).slice(0, 3).map((event, idx) => ({ ...event, id: `music-${idx + 1}`, kind: 'music' }));
  return [...family, ...music];
}
function sourceHealthFromManifests(manifests, contextHealth) {
  const rows = [];
  const git = githubStatus();
  rows.push({
    id: 'context', label: 'Context index', status: statusFor(contextHealth?.generatedAt, { staleHours: 48, failingHours: 168, empty: !contextHealth }), age: ageLabel(contextHealth?.generatedAt),
    summary: contextHealth ? `${contextHealth.activeFiles} active files / ${contextHealth.activeWords} words` : 'manifest missing',
    detail: contextHealth ? `${contextHealth.archiveWords} words archived` : 'Run node scripts/index-context.mjs', path: 'memory/context/index.json',
    details: contextHealth?.largestActive?.map(item => ({ label: item.path, value: `${item.words} words · ${item.readPolicy}` })) || [],
    staleAfterHours: 48, failingAfterHours: 168,
  });
  rows.push({
    id: 'events', label: 'Austin events', status: statusFor(manifests.events?.generatedAt, { staleHours: 36, failingHours: 72, empty: !manifests.events }), age: ageLabel(manifests.events?.generatedAt),
    summary: manifests.events ? `${manifests.events.totals?.latestFamilyEvents ?? 0} family / ${manifests.events.totals?.latestMusicEvents ?? 0} music latest` : 'manifest missing',
    detail: manifests.events ? `${manifests.events.totals?.files ?? 0} crawl artifacts indexed` : 'Run node scripts/index-events.mjs', path: 'memory/events/latest-manifest.json',
    details: eventCandidatesFromManifest(manifests.events).slice(0, 6).map(event => ({ label: event.title, value: `${event.kind} · ${event.source || 'source unknown'}${event.distanceMiles != null ? ` · ${event.distanceMiles} mi` : ''}` })),
    staleAfterHours: 36, failingAfterHours: 72,
  });
  rows.push({
    id: 'ai-tooling', label: 'AI tooling', status: statusFor(manifests.aiTooling?.generatedAt, { staleHours: 72, failingHours: 168, empty: !manifests.aiTooling }), age: ageLabel(manifests.aiTooling?.generatedAt),
    summary: manifests.aiTooling ? `${manifests.aiTooling.totals?.selectedItems ?? 0} selected / ${manifests.aiTooling.totals?.recentDedupedItems ?? 0} recent deduped` : 'manifest missing',
    detail: manifests.aiTooling ? `${manifests.aiTooling.totals?.totalItems ?? 0} raw items` : 'Run node scripts/index-ai-tooling.mjs', path: 'memory/ai-tooling/latest-manifest.json',
    details: Object.entries(manifests.aiTooling?.totals || {}).slice(0, 8).map(([label, value]) => ({ label, value: String(value) })),
    staleAfterHours: 72, failingAfterHours: 168,
  });
  rows.push({
    id: 'investing', label: 'Investing watchlist', status: statusFor(manifests.investing?.generatedAt, { staleHours: 72, failingHours: 168, empty: !manifests.investing }), age: ageLabel(manifests.investing?.generatedAt),
    summary: manifests.investing ? `${manifests.investing.totals?.tickers ?? 0} tickers / ${manifests.investing.totals?.themes ?? 0} themes` : 'manifest missing',
    detail: manifests.investing ? `${manifests.investing.totals?.highPriority ?? 0} high-priority research candidates` : 'Run node scripts/index-investing-watchlist.mjs', path: 'memory/investing/latest-watchlist.json',
    details: (manifests.investing?.tickers || []).slice(0, 8).map(t => ({ label: t.ticker, value: `${t.theme || 'research'} · ${t.stance || 'n/a'}` })),
    staleAfterHours: 72, failingAfterHours: 168,
  });
  rows.push({
    id: 'obsidian', label: 'Obsidian proposals', status: statusFor(manifests.obsidian?.generatedAt, { staleHours: 48, failingHours: 96, empty: !manifests.obsidian, proposal: manifests.obsidian?.mode === 'proposal-only' }), age: ageLabel(manifests.obsidian?.generatedAt),
    summary: manifests.obsidian ? `${manifests.obsidian.proposalCount ?? 0} proposed updates` : 'manifest missing',
    detail: manifests.obsidian?.mode || 'Run Obsidian synthesis review', path: 'memory/obsidian/proposed-updates/latest-manifest.json',
    details: (manifests.obsidian?.proposals || manifests.obsidian?.items || []).slice(0, 6).map(item => ({ label: item.targetVaultPath || item.target || item.type || 'proposal', value: item.proposalPath || item.summary || manifests.obsidian.mode || 'proposal' })),
    staleAfterHours: 48, failingAfterHours: 96,
  });
  rows.push({
    id: 'automations', label: 'Automations', status: statusFor(manifests.automations?.generatedAt, { staleHours: 24, failingHours: 72, empty: !manifests.automations }), age: ageLabel(manifests.automations?.generatedAt),
    summary: manifests.automations ? `${manifests.automations.totals?.enabled ?? 0} enabled / ${manifests.automations.totals?.disabled ?? 0} paused` : 'manifest missing',
    detail: manifests.automations ? `${manifests.automations.totals?.jobs ?? 0} cron jobs indexed` : 'Run node scripts/index-automations.mjs', path: 'memory/automations/latest-manifest.json',
    details: (manifests.automations?.jobs || []).filter(j => !j.enabled || (j.lastStatus && j.lastStatus !== 'ok')).slice(0, 8).map(job => ({ label: job.name, value: `${job.enabled ? 'enabled' : 'paused'} · ${job.lastStatus || 'no last status'} · next ${job.nextRunAt || 'n/a'}` })),
    staleAfterHours: 24, failingAfterHours: 72,
  });
  rows.push({
    id: 'github', label: 'GitHub repos', status: statusFor(git?.generatedAt, { staleHours: 24, failingHours: 72, empty: !git || git.totals.behind > 0 }), age: ageLabel(git?.generatedAt),
    summary: git ? `${git.totals.repos} repos / ${git.totals.dirtyRepos} dirty / ${git.totals.behind} behind` : 'git status unavailable',
    detail: git ? git.repos.map(r => `${r.label}: ${r.branch}@${r.commit}${r.dirtyFiles ? `, ${r.dirtyFiles} dirty` : ''}${r.behind ? `, ${r.behind} behind` : ''}`).join(' · ') : 'Check local GitHub-backed repos', path: 'local git repositories',
    details: git?.repos.map(r => ({ label: r.label, value: `${r.branch}@${r.commit} · ${r.dirtyFiles} dirty · ${r.ahead} ahead · ${r.behind} behind` })) || [],
    staleAfterHours: 24, failingAfterHours: 72,
  });
  const thesis = manifests.thesisBaskets;
  const thesisStream = thesis?.streams?.['thesis_baskets.ingestion_events'];
  rows.push({
    id: 'thesis-baskets', label: 'Thesis Baskets', status: statusFor(thesis?.updated_at, { staleHours: 72, failingHours: 168, empty: !thesis }), age: ageLabel(thesis?.updated_at),
    summary: thesisStream ? `${thesisStream.last_new_events ?? 0} new / ${thesisStream.last_events_scanned ?? 0} scanned` : 'ingestion state missing',
    detail: thesisStream ? `last event ${thesisStream.last_event_time || 'n/a'}` : 'Run node scripts/ingest-thesis-baskets.mjs --lookback-days=7 --limit=5000', path: 'memory/thesis-baskets-ingestion-state.json',
    details: thesisStream ? [
      { label: 'Last run', value: thesisStream.last_run_at || thesis.updated_at || 'n/a' },
      { label: 'Last event', value: thesisStream.last_event_time || 'n/a' },
      { label: 'New events', value: String(thesisStream.last_new_events ?? 0) },
      { label: 'Scanned events', value: String(thesisStream.last_events_scanned ?? 0) },
    ] : [],
    staleAfterHours: 72, failingAfterHours: 168,
  });
  rows.push({
    id: 'review-queue', label: 'Review queue', status: statusFor(manifests.reviewQueue?.generatedAt, { staleHours: 24, failingHours: 72, empty: !manifests.reviewQueue }), age: ageLabel(manifests.reviewQueue?.generatedAt),
    summary: manifests.reviewQueue ? `${manifests.reviewQueue.totals?.pending ?? 0} pending / ${manifests.reviewQueue.totals?.high ?? 0} high` : 'manifest missing',
    detail: manifests.reviewQueue ? `${manifests.reviewQueue.totals?.items ?? 0} review items indexed` : 'Run node scripts/index-review-queue.mjs', path: 'memory/review-queue/latest-manifest.json',
    details: (manifests.reviewQueue?.items || []).slice(0, 8).map(item => ({ label: item.title, value: `${item.priority} · ${item.status} · ${item.actionHint || item.kind}` })),
    staleAfterHours: 24, failingAfterHours: 72,
  });
  return rows;
}
function buildData() {
  const postureMd   = read('POSTURE.md');
  const projectsMd  = read('PROJECTS.md');
  const openLoopsMd = read('OPEN_LOOPS.md');
  const about       = read('ABOUT.md');
  const decisions   = read('DECISIONS.md');
  const protocol    = read('MEMORY_PROTOCOL.md');
  const ocConfig    = readOcConfig();
  const sourceManifests = readSourceManifests();
  const contextHealth = contextHealthFromIndex(sourceManifests.context);
  const sourceHealth = sourceHealthFromManifests(sourceManifests, contextHealth);

  if (!projectsMd || !openLoopsMd) {
    if (fs.existsSync(outputPath)) {
      const existing = readJsonAbsolute(outputPath, null);
      if (existing?.meta) {
        existing.meta.deployment = deploymentMeta();
        fs.writeFileSync(outputPath, `${JSON.stringify(existing, null, 2)}\n`);
        console.log(`Context not found at ${contextRoot}; refreshed deployment metadata in generated-data.json.`);
        return null;
      }
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
      deployment: deploymentMeta(),
      contextHealth,
      sourceHealth,
      eventCandidates: eventCandidatesFromManifest(sourceManifests.events),
      activity: readActivity(),
      investmentDecisionDigest: sourceManifests.investmentDecisionDigest || null,
    },
    stats: {
      openLoops:        checked.length,
      activeProjects:   projects.length,
      highPriority:     highPri.length,
      uncertainties:    uncertain,
      investingSignals: Math.max(parseInvesting(openLoopsMd).length, (sourceManifests.investmentDecisionDigest?.top_decisions || []).length),
      contextActiveFiles: contextHealth?.activeFiles ?? null,
      contextActiveWords: contextHealth?.activeWords ?? null,
      contextArchiveWords: contextHealth?.archiveWords ?? null,
    },
    topActions,
    openLoops,
    projects,
    investing: parseInvesting(openLoopsMd),
    automations: sourceManifests.automations?.jobs || [],
    reviewQueue: sourceManifests.reviewQueue?.items || [],
    digests: [
      fileDigest('d1', 'ChatGPT brain dump converted to canonical context', 'Context import', 'imports/2026-05-01-chatgpt-braindump.md', 'Raw import preserved and split into durable Alphalpha files.', ['#memory', '#context', '#import']),
      fileDigest('d2', 'About + preference context available', 'About/Preferences', 'ABOUT.md', firstSentence(extractSection(about, '## Stable context')) || 'Stable personal context and preferences available.', ['#about', '#preferences']),
      fileDigest('d3', 'Project registry and open loops are now source files', 'Projects/Open loops', 'PROJECTS.md', `Dashboard generated from ${projects.length} project entries and ${checked.length} open loops.`, ['#projects', '#open-loops']),
      fileDigest('d4', 'Memory protocol drafted', 'Memory protocol', 'MEMORY_PROTOCOL.md', firstSentence(extractSection(protocol, '## Goal')) || 'Protocol separates imports, durable context, daily memory, and dashboard-facing open loops.', ['#memory', '#protocol']),
      fileDigest('d5', 'Durable decisions captured', 'Decisions', 'DECISIONS.md', firstSentence(extractSection(decisions, '## Personal AI / knowledge system')) || 'Key architecture decisions captured for Alphalpha and OpenClaw.', ['#decisions', '#architecture']),
      ...(contextHealth ? [{
        id: 'd6',
        date: contextHealth.generatedAt.slice(0, 10),
        category: 'Context health',
        title: 'Context index available for bounded reads',
        summary: `${contextHealth.activeFiles} active context files / ${contextHealth.activeWords} active words; ${contextHealth.archiveWords} words archived.`,
        tags: ['#context-budget', '#manifest'],
      }] : []),
      ...sourceHealth.filter(s => s.id !== 'context').map((source, idx) => ({
        id: `source-${idx + 1}`,
        date: new Date().toISOString().slice(0, 10),
        category: 'Source health',
        title: `${source.label}: ${source.summary}`,
        summary: `${source.detail} · ${source.age} · ${source.path}`,
        tags: ['#source-health', '#manifest'],
      })),
    ],
  };
}

const data = buildData();
if (data) {
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Generated ${path.relative(repoRoot, outputPath)} from ${contextRoot}`);
}

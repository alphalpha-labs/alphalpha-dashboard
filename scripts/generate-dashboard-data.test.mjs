#!/usr/bin/env node
// Run: node scripts/generate-dashboard-data.test.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

execSync('node scripts/generate-dashboard-data.mjs', { stdio: 'inherit' });
const data = JSON.parse(readFileSync('lib/generated-data.json', 'utf8'));

assert.ok(typeof data.meta?.generatedAt === 'string',        'meta.generatedAt missing');
assert.ok(typeof data.meta?.posture === 'string',             'meta.posture missing');
assert.ok(typeof data.meta?.postureDetail === 'string',       'meta.postureDetail missing');
assert.ok(typeof data.stats?.openLoops === 'number',          'stats.openLoops missing');
assert.ok(typeof data.stats?.activeProjects === 'number',     'stats.activeProjects missing');
assert.ok(typeof data.stats?.highPriority === 'number',       'stats.highPriority missing');
assert.ok(typeof data.stats?.uncertainties === 'number',      'stats.uncertainties missing');
assert.ok(typeof data.stats?.investingSignals === 'number',   'stats.investingSignals missing');
assert.ok(Array.isArray(data.topActions),               'topActions missing');
assert.ok(Array.isArray(data.openLoops),                'openLoops missing');
assert.ok(Array.isArray(data.projects),                 'projects missing');
assert.ok(Array.isArray(data.investing),                'investing missing');
assert.ok(Array.isArray(data.digests),                  'digests missing');

if (data.topActions.length > 0) {
  const a = data.topActions[0];
  assert.ok(typeof a.id === 'string',        'action.id missing');
  assert.ok(typeof a.done === 'boolean',     'action.done missing');
  assert.ok(typeof a.snoozed === 'boolean',  'action.snoozed missing');
  assert.ok(['HIGH','MEDIUM','LOW'].includes(a.priority), 'action.priority invalid');
}
if (data.openLoops.length > 0) {
  const l = data.openLoops[0];
  assert.ok(typeof l.id === 'string',  'loop.id missing');
  assert.ok(typeof l.text === 'string','loop.text missing');
}
if (data.projects.length > 0) {
  const p = data.projects[0];
  assert.ok(typeof p.id === 'string',       'project.id missing');
  assert.ok(typeof p.ocOwned === 'boolean', 'project.ocOwned missing');
  assert.ok(typeof p.summary === 'string',  'project.summary missing');
}
if (data.digests.length > 0) {
  const d = data.digests[0];
  assert.ok(typeof d.id === 'string',       'digest.id missing');
  assert.ok(typeof d.category === 'string', 'digest.category missing');
}
if (data.investing.length > 0) {
  assert.ok(['HIGH','MEDIUM','LOW'].includes(data.investing[0].confidence), 'ticker.confidence invalid');
}

console.log('✓ All assertions passed');

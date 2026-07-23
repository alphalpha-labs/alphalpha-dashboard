#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExposureEvent,
  evaluateNoveltyPool,
} from './lib/almanac-novelty.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const candidateFile = args.find(arg => arg.startsWith('--candidates='))?.slice('--candidates='.length)
  || path.join(repoRoot, 'lib', 'almanac-datasets', 'long-reads.json');
const requestedEditionFiles = args
  .filter(arg => arg.startsWith('--edition='))
  .map(arg => arg.slice('--edition='.length));
const editionFiles = requestedEditionFiles.length
  ? requestedEditionFiles
  : [path.join(repoRoot, 'lib', 'generated-data.snapshot.json')];
const targetDate = args.find(arg => arg.startsWith('--date='))?.slice('--date='.length)
  || new Date().toISOString().slice(0, 10);
const jsonOnly = args.includes('--json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

const candidates = readJson(candidateFile).map((item, index) => ({
  id: item.id || `candidate-${index + 1}`,
  title: item.title,
  source: item.source || item.sourceLabel || '',
  link: item.url || item.link || '',
}));

const exposures = [];
for (const file of editionFiles) {
  const raw = readJson(file);
  const edition = raw.daily || raw;
  const date = edition.date || targetDate;
  for (const item of [
    edition.article,
    edition.macroRead,
    ...(edition.longReads || []),
    ...(edition.reading || []),
  ].filter(Boolean)) {
    exposures.push(buildExposureEvent(item, date));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  targetDate,
  candidateFile: path.relative(repoRoot, path.resolve(candidateFile)),
  editionFiles: editionFiles.map(file => path.relative(repoRoot, path.resolve(file))),
  ...evaluateNoveltyPool(candidates, exposures, { targetDate }),
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Almanac novelty evaluation · ${targetDate}`);
  console.log(`Candidates: ${report.candidateCount}`);
  console.log(`Eligible: ${report.eligibleCount}`);
  console.log(`Rejected: ${report.rejectedCount}`);
  console.log(`Reasons: ${JSON.stringify(report.rejectionReasons)}`);
  console.log(`Repeated-source penalties: ${report.repeatedSourcePenaltyCount}`);
}

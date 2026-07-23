const TRACKING_QUERY_KEYS = /^(utm_.+|fbclid|gclid|dclid|mc_.+|ref|referrer|source|campaign|campaignid|vero_.+)$/i;
const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'how', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'their',
  'this', 'to', 'was', 'what', 'when', 'where', 'which', 'who', 'why', 'with',
]);

export function canonicalizeUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

export function titleTokens(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bcan['’]t\b/g, 'cannot')
    .replace(/\bwon['’]t\b/g, 'will not')
    .replace(/\b([a-z0-9]+)['’]s\b/g, '$1')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(token => token === 'american' ? 'america' : token)
    .map(token => token.length > 4 && token.endsWith('ies') ? `${token.slice(0, -3)}y` : token)
    .map(token => token.length > 4 && token.endsWith('s') && !/(ss|ics|us)$/.test(token) ? token.slice(0, -1) : token)
    .filter(token => token.length > 1 && !TITLE_STOP_WORDS.has(token));
}

export function titleFingerprint(value = '') {
  return titleTokens(value).join('-').slice(0, 160);
}

export function tokenSimilarity(left = '', right = '') {
  const a = new Set(titleTokens(left));
  const b = new Set(titleTokens(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function exposureDate(exposure) {
  return exposure?.at || exposure?.editionDate || exposure?.date || '';
}

function insideCooldown(exposure, targetDate, cooldownDays) {
  const raw = exposureDate(exposure);
  if (!raw || !targetDate) return true;
  const then = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  const target = new Date(`${targetDate}T23:59:59Z`);
  if (Number.isNaN(then.getTime()) || Number.isNaN(target.getTime())) return true;
  const days = (target - then) / 86_400_000;
  return days >= 0 && days <= cooldownDays;
}

export function assessCandidateNovelty(candidate, exposures = [], options = {}) {
  const {
    targetDate = new Date().toISOString().slice(0, 10),
    cooldownDays = 60,
    similarityThreshold = 0.72,
    repeatedSourceWindow = 14,
  } = options;
  const canonicalUrl = canonicalizeUrl(candidate?.link || candidate?.url || candidate?.canonicalUrl || '');
  const fingerprint = titleFingerprint(candidate?.title || '');
  const source = String(candidate?.source || '').trim().toLowerCase();
  const recent = exposures.filter(exposure => insideCooldown(exposure, targetDate, cooldownDays));

  const exactUrl = canonicalUrl && recent.find(exposure =>
    canonicalizeUrl(exposure.canonicalUrl || exposure.url || '') === canonicalUrl
  );
  if (exactUrl) {
    return {
      eligible: false,
      noveltyScore: 0,
      penalty: 100,
      reason: 'exact-url-exposure',
      matchedTitle: exactUrl.title || '',
      canonicalUrl,
      titleFingerprint: fingerprint,
      similarity: 1,
    };
  }

  const exactTitle = fingerprint && recent.find(exposure =>
    titleFingerprint(exposure.title || exposure.titleFingerprint || '') === fingerprint
  );
  if (exactTitle) {
    return {
      eligible: false,
      noveltyScore: 0,
      penalty: 100,
      reason: 'exact-title-exposure',
      matchedTitle: exactTitle.title || '',
      canonicalUrl,
      titleFingerprint: fingerprint,
      similarity: 1,
    };
  }

  let closest = null;
  for (const exposure of recent) {
    const similarity = tokenSimilarity(candidate?.title || '', exposure.title || exposure.titleFingerprint || '');
    if (!closest || similarity > closest.similarity) closest = { exposure, similarity };
  }
  if (closest && closest.similarity >= similarityThreshold) {
    return {
      eligible: false,
      noveltyScore: Math.max(0, 1 - closest.similarity),
      penalty: 100,
      reason: 'near-duplicate-title',
      matchedTitle: closest.exposure.title || '',
      canonicalUrl,
      titleFingerprint: fingerprint,
      similarity: Number(closest.similarity.toFixed(3)),
    };
  }

  const repeatedSourceCount = source
    ? exposures.filter(exposure =>
      String(exposure.source || '').trim().toLowerCase() === source
      && insideCooldown(exposure, targetDate, repeatedSourceWindow)
    ).length
    : 0;
  const similarity = closest?.similarity || 0;
  const similarityPenalty = similarity >= 0.45 ? similarity * 1.5 : 0;
  const sourcePenalty = Math.min(1.5, repeatedSourceCount * 0.35);
  const noveltyScore = Math.max(0, 5 - similarityPenalty - sourcePenalty);

  return {
    eligible: true,
    noveltyScore: Number(noveltyScore.toFixed(3)),
    penalty: Number((similarityPenalty + sourcePenalty).toFixed(3)),
    reason: repeatedSourceCount >= 3 ? 'repeated-source-penalty' : 'novel',
    matchedTitle: closest?.exposure?.title || '',
    canonicalUrl,
    titleFingerprint: fingerprint,
    similarity: Number(similarity.toFixed(3)),
    repeatedSourceCount,
  };
}

export function buildExposureEvent(item, editionDate, event = 'shown', at = new Date().toISOString()) {
  return {
    id: `${editionDate}:${event}:${titleFingerprint(item?.title || item?.id || 'item')}`,
    recommendationId: item?.id || titleFingerprint(item?.title || ''),
    canonicalUrl: canonicalizeUrl(item?.link || item?.url || item?.canonicalUrl || ''),
    title: String(item?.title || ''),
    titleFingerprint: titleFingerprint(item?.title || ''),
    source: String(item?.source || item?.sourceLabel || ''),
    topics: Array.isArray(item?.themes) ? item.themes.slice(0, 12) : [],
    editionDate,
    event,
    at,
  };
}

export function compactExposureLedger(exposures = [], options = {}) {
  const { maxEntries = 2000, retentionDays = 180, now = new Date() } = options;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const deduped = new Map();
  for (const exposure of exposures) {
    const date = new Date(exposureDate(exposure));
    if (!Number.isNaN(date.getTime()) && date < cutoff) continue;
    const key = exposure.id || `${exposure.editionDate}:${exposure.event}:${exposure.titleFingerprint}`;
    deduped.set(key, exposure);
  }
  return [...deduped.values()]
    .sort((a, b) => String(exposureDate(b)).localeCompare(String(exposureDate(a))))
    .slice(0, maxEntries);
}

export function evaluateNoveltyPool(candidates = [], exposures = [], options = {}) {
  const assessments = candidates.map(candidate => ({
    id: candidate.id || '',
    title: candidate.title || '',
    source: candidate.source || '',
    ...assessCandidateNovelty(candidate, exposures, options),
  }));
  const rejected = assessments.filter(item => !item.eligible);
  const reasons = {};
  for (const item of rejected) reasons[item.reason] = (reasons[item.reason] || 0) + 1;
  return {
    candidateCount: assessments.length,
    eligibleCount: assessments.length - rejected.length,
    rejectedCount: rejected.length,
    rejectionReasons: reasons,
    repeatedSourcePenaltyCount: assessments.filter(item => item.reason === 'repeated-source-penalty').length,
    assessments,
  };
}

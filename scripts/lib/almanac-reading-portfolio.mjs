import { canonicalizeUrl, titleTokens, tokenSimilarity } from './almanac-novelty.mjs';

function sourceKey(candidate) {
  try {
    return new URL(candidate.link || candidate.url || '').hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(candidate.source || '').trim().toLowerCase();
  }
}

export function estimateReadMinutes(candidate) {
  const explicit = Number(candidate.readMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const text = String(candidate.readTime || '');
  const match = text.match(/(\d{1,3})\s*(?:min|minute)/i);
  if (match) return Number(match[1]);
  const wordCount = Number(candidate.wordCount);
  if (Number.isFinite(wordCount) && wordCount > 0) return Math.max(3, Math.round(wordCount / 230));
  return 10;
}

function topicSet(candidate) {
  return new Set([
    ...(candidate.themes || []).flatMap(theme => titleTokens(theme)),
    ...titleTokens(`${candidate.title || ''} ${candidate.why || ''}`),
  ]);
}

function topicDistance(left, right) {
  const a = topicSet(left);
  const b = topicSet(right);
  if (!a.size || !b.size) return 1;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return 1 - shared / Math.min(a.size, b.size);
}

function pairDiversity(items) {
  let score = 0;
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      score += topicDistance(items[left], items[right]);
      score += sourceKey(items[left]) !== sourceKey(items[right]) ? 0.75 : -1.5;
      score -= tokenSimilarity(items[left].title, items[right].title) * 2;
    }
  }
  return score;
}

function combinations(items, size) {
  const out = [];
  const visit = (start, selected) => {
    if (selected.length === size) {
      out.push(selected);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      visit(index + 1, [...selected, items[index]]);
    }
  };
  visit(0, []);
  return out;
}

export function selectReadingPortfolio(candidates = [], options = {}) {
  const {
    minMinutes = 20,
    maxMinutes = 45,
    minimumScore = -4,
    poolSize = 14,
  } = options;
  const eligible = candidates
    .filter(candidate => candidate?.novelty?.eligible !== false)
    .filter(candidate => Number(candidate.score ?? 0) >= minimumScore)
    .map(candidate => ({ ...candidate, readMinutes: estimateReadMinutes(candidate) }))
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, poolSize);

  if (eligible.length < 3) {
    return {
      status: 'degraded',
      reason: 'fewer-than-three-quality-candidates',
      selected: eligible,
      totalMinutes: eligible.reduce((sum, item) => sum + item.readMinutes, 0),
      candidateCount: eligible.length,
    };
  }

  const viable = combinations(eligible, 3)
    .map(items => {
      const totalMinutes = items.reduce((sum, item) => sum + item.readMinutes, 0);
      const uniqueSources = new Set(items.map(sourceKey).filter(Boolean)).size;
      const score = items.reduce((sum, item) => sum + Number(item.score ?? 0), 0)
        + pairDiversity(items)
        + uniqueSources * 0.5
        - (totalMinutes < minMinutes ? (minMinutes - totalMinutes) * 2 : 0)
        - (totalMinutes > maxMinutes ? (totalMinutes - maxMinutes) * 2 : 0);
      return { items, totalMinutes, uniqueSources, score };
    })
    .sort((a, b) => b.score - a.score);

  const choice = viable.find(item =>
    item.totalMinutes >= minMinutes
    && item.totalMinutes <= maxMinutes
    && item.uniqueSources >= 2
  ) || viable[0];

  const anchor = [...choice.items].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0];
  const remainder = choice.items.filter(item => item.id !== anchor.id);
  const frontier = [...remainder].sort((a, b) => {
    const aDistance = topicDistance(anchor, a) + (sourceKey(anchor) !== sourceKey(a) ? 0.5 : 0);
    const bDistance = topicDistance(anchor, b) + (sourceKey(anchor) !== sourceKey(b) ? 0.5 : 0);
    return bDistance - aDistance;
  })[0];
  const lens = remainder.find(item => item.id !== frontier.id) || remainder[0];

  const selected = [
    { ...anchor, role: 'anchor', exploration: false },
    { ...lens, role: 'lens', exploration: false },
    { ...frontier, role: 'frontier', exploration: true },
  ];

  return {
    status: choice.totalMinutes >= minMinutes && choice.totalMinutes <= maxMinutes ? 'healthy' : 'degraded',
    reason: choice.totalMinutes > maxMinutes ? 'reading-budget-over' : choice.totalMinutes < minMinutes ? 'reading-budget-under' : 'portfolio-selected',
    selected,
    totalMinutes: choice.totalMinutes,
    candidateCount: eligible.length,
    uniqueSources: choice.uniqueSources,
  };
}

export function toReadingRecommendation(candidate, article) {
  return {
    id: candidate.id,
    role: candidate.role,
    exploration: Boolean(candidate.exploration),
    readMinutes: candidate.readMinutes,
    kicker: candidate.role === 'anchor' ? 'The anchor' : candidate.role === 'lens' ? 'A different lens' : 'Off your usual path',
    source: article.source,
    readTime: article.readTime,
    title: article.title,
    dek: article.dek,
    why: article.why,
    whyNow: article.sourceContext || article.why,
    publishedAt: article.publishedAt,
    freshnessLabel: article.freshnessLabel,
    sourceContext: article.sourceContext,
    url: article.url ? canonicalizeUrl(article.url) : undefined,
    sourceLabel: article.sourceLabel,
    topics: candidate.themes || [],
    novelty: candidate.novelty ? {
      score: candidate.novelty.noveltyScore,
      reason: candidate.novelty.reason,
      closestTitle: candidate.novelty.matchedTitle || undefined,
    } : undefined,
  };
}

export function articleFeedbackProfile(weights = {}) {
  const notes = (weights.notes ?? []).join(' ').toLowerCase();
  const avoidHosts = [...BLOCKED_READING_HOSTS];
  if (/\bx\.com\b|twitter\.com|twitter as a source/.test(notes)) {
    avoidHosts.push('x.com', 'twitter.com');
  }
  if (/reddit/.test(notes) && /\b(wouldn'?t|never|avoid|not)\b/.test(notes)) {
    avoidHosts.push('reddit.com');
  }

  const preferTerms = [];
  if (/socio[-\s]?political|politics|political/.test(notes)) preferTerms.push('political', 'socio-political');
  if (/economic|economics/.test(notes)) preferTerms.push('economic', 'economics');
  if (/religious|religion/.test(notes)) preferTerms.push('religious', 'religion');
  if (/cultural|culture/.test(notes)) preferTerms.push('cultural', 'culture');
  if (/social theory/.test(notes)) preferTerms.push('social theory', 'sociology');
  if (/philosophy|philosophical/.test(notes)) preferTerms.push('philosophy', 'philosophical');
  if (/analysis|essay|long[-\s]?form|thought[-\s]?provoking/.test(notes)) preferTerms.push('analysis', 'essay', 'long-form');

  const preferred = [...new Set(preferTerms)];
  return {
    avoidHosts: [...new Set(avoidHosts)],
    avoidAiFocused: wantsLessAiFocus(notes),
    avoidAiTooling: wantsLessAiTooling(notes),
    preferTerms: preferred,
    preferredQuery: preferred.length ? preferred.join(' ') : '',
  };
}

export function readingSelectionSignalSummary(weights = {}) {
  const profile = articleFeedbackProfile(weights);
  const notes = (weights.notes ?? []).join(' ').toLowerCase();
  const parts = [];

  const preferred = profile.preferTerms
    .filter(term => !['analysis', 'essay', 'long-form'].includes(term))
    .slice(0, 3);
  if (preferred.length) parts.push(`feedback prefers ${preferred.join(', ')}`);

  const avoided = [];
  if (profile.avoidAiTooling) avoided.push('AI tooling');
  else if (profile.avoidAiFocused) avoided.push('AI-heavy reads');
  if (/reddit/.test(notes) && /\b(wouldn'?t|never|avoid|not)\b/.test(notes)) avoided.push('Reddit');
  if (/\bx\.com\b|twitter\.com|twitter as a source/.test(notes)) avoided.push('X/Twitter');
  if (avoided.length) parts.push(`avoids ${[...new Set(avoided)].join(', ')}`);

  const topSource = Object.entries(weights.sourceAffinity ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([source]) => source)
    .find(Boolean);
  if (topSource) parts.push(`kept-source affinity: ${topSource}`);

  return parts.slice(0, 2).join('; ');
}

export const BLOCKED_READING_HOSTS = [
  'facebook.com',
  'm.facebook.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'instagram.com',
  'threads.net',
  'linkedin.com',
  'quora.com',
  'medium.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
];

export function isBlockedReadingUrl(url = '') {
  let host = '';
  let path = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {
    const lower = String(url).toLowerCase();
    host = lower;
    path = lower;
  }

  if (BLOCKED_READING_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`))) return true;
  if (/\/(?:groups|events|pages|profile|people)\//.test(path) && /facebook/.test(host)) return true;
  if (/\.(?:pdf|ppt|pptx|doc|docx)(?:$|[?#])/.test(path)) return true;
  return false;
}

export function isGenericReadingUrl(url = '') {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const path = parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
  if (!path) return true;

  const segments = path.split('/').filter(Boolean).map(segment => segment.toLowerCase());
  if (segments.length === 0) return true;
  if (/^(category|categories|search|tag|tags|topic|topics)$/.test(segments[0])) return true;
  if (segments.length > 1) return false;

  return /^(about|archive|archives|articles?|authors?|blog|category|columns?|contributors?|essays?|features?|ideas|issue|issues|login|magazine|newsletter|newsletters|news|opinion|posts?|search|sections?|subscribe|subscription|tag|tags|topics?)$/.test(segments[0]);
}

export function wantsLessAiFocus(notes = '') {
  return /\b(less|no|not|avoid|stop)\s+(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)[-\s]*(?:focused|centric|articles?|signals?|charts?|states?|stuff|content)?\b/.test(notes)
    || (/\b(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)[-\s]*(?:focused|centric)\b/.test(notes) && /\b(less|no|not|avoid|stop)\b/.test(notes))
    || (/\b(?:too|still|less|no|not|avoid|stop)\b/.test(notes) && /\b(?:ai tooling|ai tools?|ai-oriented|ai oriented)\b/.test(notes))
    || (/\bbeyond\b|\bnot just\b|\bmore than\b|\bdeeper than\b/.test(notes) && /\b(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)\b/.test(notes) && /\b(?:adoption|infrastructure|stats?|statistics|state)\b/.test(notes));
}

export function wantsLessAiTooling(notes = '') {
  return wantsLessAiFocus(notes)
    || (/\b(?:too|still|less|no|not|avoid|stop)\b/.test(notes) && /\b(?:ai tooling|tooling|developer tools?|obsidian|vector dbs?|vector databases?|memory agents?|rag|embeddings?)\b/.test(notes));
}

export function isAiFocusedText(text = '') {
  const lower = String(text).toLowerCase();
  return /\b(ai|a\.i\.|artificial intelligence|genai|generative ai|llm|llms|large language model|machine learning|frontier model|open-weight model)\b/.test(lower);
}

export function isAiToolingText(text = '') {
  const lower = String(text).toLowerCase();
  return isAiFocusedText(lower)
    || /\b(?:ai tooling|developer tools?|obsidian|vector dbs?|vector databases?|memory agents?|rag|embeddings?|towardsdatascience|medium\.com)\b/.test(lower);
}

export function isVideoHost(host = '') {
  return /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$|(^|\.)tiktok\.com$/.test(String(host).toLowerCase());
}

export function isArticleIndexText(text = '') {
  const lower = String(text).toLowerCase();
  return /\b(?:\d{3,}|best|great|favorite|top)\s+(?:longform|long-form|articles?|essays?)\b/.test(lower)
    || /\b(?:list|index|directory|archive|collection|menu)\s+of\s+(?:longform|long-form|articles?|essays?)\b/.test(lower)
    || /\/menu\d*\b/.test(lower);
}

export function isReadingBadFormatText(text = '') {
  const lower = String(text).toLowerCase();
  return /\b(?:pdf|textbook|worksheet|syllabus|course packet|lecture notes|contemporary introduction|encyclopedia entry)\b/.test(lower)
    || /\b(?:internet encyclopedia of philosophy|stanford encyclopedia of philosophy|iep\.utm\.edu|plato\.stanford\.edu)\b/.test(lower)
    || /\b(?:topics?|ideas?)\s+for\s+(?:papers?|essays?)\b/.test(lower)
    || /\b(?:essay examples?|paper examples?|research paper topics?|writing prompts?)\b/.test(lower)
    || /\b(?:newsletter|newsletters|archive|archives)\s*(?:home|index|landing|signup|sign-up|subscribe|subscription|page)\b/.test(lower)
    || /\b(?:all|latest|recent|browse|view)\s+(?:articles?|essays?|issues?|newsletters|posts?)\b/.test(lower)
    || /\b(?:sign up|signup|subscribe)\s+(?:for|to)\s+(?:our|the)?\s*(?:newsletter|updates?)\b/.test(lower)
    || /\b(?:edubirdie|gradesfixer|studycorgi|ivypanda|essaypro|papersowl)\b/.test(lower)
    || /\.pdf(?:$|[?#])/.test(lower);
}

export function isReadingAlreadyUsedStatus(status = '') {
  return /\b(?:read|done|dismissed|weekly-pick|sent|delivered|kindle packet|instapaper)\b/i.test(String(status ?? ''));
}

export function normalizeReadingPublishedDate(value = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const relative = raw.toLowerCase().match(/\b(\d{1,3})\s+(day|week|month|year)s?\s+ago\b/);
  if (!relative) return null;

  const amount = Number(relative[1]);
  const unit = relative[2];
  const days = unit === 'year' ? amount * 365
    : unit === 'month' ? amount * 30
    : unit === 'week' ? amount * 7
    : amount;
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function readingFreshnessScore(candidate = {}, targetDate = new Date().toISOString().slice(0, 10)) {
  const publishedAt = normalizeReadingPublishedDate(candidate.publishedAt ?? candidate.date ?? '');
  if (!publishedAt) return 0;

  const published = new Date(`${publishedAt}T00:00:00Z`).getTime();
  const target = new Date(`${targetDate}T00:00:00Z`).getTime();
  if (Number.isNaN(published) || Number.isNaN(target)) return 0;

  const ageDays = Math.round((target - published) / 86_400_000);
  if (ageDays < -7) return -1.5;
  if (ageDays < 0) return 0.3;
  if (ageDays <= 3) return 1.8;
  if (ageDays <= 14) return 1.2;
  if (ageDays <= 45) return 0.6;
  if (ageDays <= 120) return 0.15;
  if (ageDays > 540) return -0.8;
  return 0;
}

export function readingSourceQualityFit(candidate = {}) {
  const link = String(candidate.url ?? candidate.link ?? '').trim();
  const source = String(candidate.sourceLabel ?? candidate.source ?? '').trim();
  const publishedAt = normalizeReadingPublishedDate(candidate.publishedAt ?? candidate.date ?? '');
  const blob = [
    candidate.title,
    candidate.source,
    candidate.sourceLabel,
    candidate.frame,
    candidate.thesis,
    candidate.dek,
    candidate.why,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
    ...(Array.isArray(candidate.themes) ? candidate.themes : []),
  ].join(' ').toLowerCase();

  let score = 0;
  const signals = [];

  if (link) {
    try {
      const parsed = new URL(link);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const articleLikePath = segments.length >= 2
        || segments.some(segment => segment.length >= 18 || /\b\d{4}\b/.test(segment));
      if (articleLikePath) {
        score += 0.55;
        signals.push('specific link');
      } else {
        score -= 0.25;
        signals.push('shallow link');
      }
    } catch {
      score -= 0.25;
      signals.push('unparsed link');
    }
  } else {
    score -= 0.7;
    signals.push('no link');
  }

  if (publishedAt) {
    score += 0.25;
    signals.push('dated');
  }
  if (source && !/^(unknown|source)$/i.test(source)) {
    score += 0.2;
    signals.push('named source');
  }
  if (/\b(?:roundup|links worth reading|some thoughts|reflections on|notes on|interesting article|good piece|worth reading|latest links)\b/.test(blob)) {
    score -= 0.55;
    signals.push('generic framing');
  }

  const label = signals.length
    ? `Source quality: ${[...new Set(signals)].slice(0, 3).join(' + ')}.`
    : '';
  return { score, label };
}

export function readingProvenanceFit(candidate = {}) {
  const id = String(candidate?.id || '');
  if (id.startsWith('web-article-')) {
    return { score: 0.7, label: 'fresh web discovery' };
  }
  if (id.startsWith('rss-')) {
    return { score: 0.55, label: 'fresh RSS source' };
  }
  if (id.startsWith('articles-')) {
    return { score: 0.25, label: 'saved reading queue' };
  }
  if (id.startsWith('society-curated-')) {
    return { score: 0, label: 'curated society library' };
  }
  return { score: 0, label: 'curated source' };
}

export function austinExploreSeasonFit(candidate = {}, targetDate = new Date().toISOString().slice(0, 10)) {
  const month = Number(String(targetDate).slice(5, 7));
  const blob = [
    candidate.title,
    candidate.category,
    candidate.area,
    candidate.duration,
    candidate.bestTime,
    candidate.vibe,
    candidate.prompt,
    candidate.why,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
  ].join(' ').toLowerCase();

  const has = re => re.test(blob);
  let score = 0;
  let label = '';

  if (month >= 6 && month <= 9) {
    const summerSignals = [
      has(/\b(?:shade|shaded|tree|trees|creek|water|swim|pool|lake)\b/) ? 'shade/water' : '',
      has(/\b(?:museum|indoors?|galleries|gallery|bookstore)\b/) ? 'indoor option' : '',
      has(/\b(?:morning|evening|sunset|golden hour|hot afternoon|cool morning)\b/) ? 'heat-aware timing' : '',
    ].filter(Boolean);
    score += summerSignals.length * 0.7;
    if (has(/\b(?:swim|pool|creek|water|lake)\b/)) score += 0.45;
    if (has(/\b(?:museum|indoors?|galleries|gallery)\b/)) score += 0.35;
    if (has(/\b(?:midday|noon)\b/)) score -= 1.2;
    label = summerSignals.length
      ? `Summer fit: ${[...new Set(summerSignals)].slice(0, 2).join(' + ')}.`
      : 'Summer fit: check heat before going.';
  } else if (month >= 3 && month <= 5) {
    const springSignals = [
      has(/\b(?:garden|botanical|greenbelt|preserve|trail|park|outdoors?)\b/) ? 'outdoor season' : '',
      has(/\b(?:flower|flowers|pond|lake|creek|wildlife|nature)\b/) ? 'spring texture' : '',
    ].filter(Boolean);
    score += springSignals.length * 0.45;
    label = springSignals.length ? `Spring fit: ${[...new Set(springSignals)].join(' + ')}.` : '';
  } else if (month === 12 || month <= 2) {
    const winterSignals = [
      has(/\b(?:museum|indoors?|galleries|gallery|bookstore)\b/) ? 'indoor fallback' : '',
      has(/\b(?:short|30-60|20-45|45-90)\b/) ? 'short outing' : '',
      has(/\b(?:trail|walk|park|outdoors?)\b/) ? 'mild-day walk' : '',
    ].filter(Boolean);
    score += winterSignals.length * 0.35;
    label = winterSignals.length ? `Winter fit: ${[...new Set(winterSignals)].slice(0, 2).join(' + ')}.` : '';
  }

  return { score, label };
}

export function longReadDayFit(candidate = {}, targetDate = new Date().toISOString().slice(0, 10)) {
  const day = new Date(`${targetDate}T00:00:00Z`).getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const blob = [
    candidate.title,
    candidate.source,
    candidate.frame,
    candidate.thesis,
    candidate.why,
    candidate.readTime,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
  ].join(' ').toLowerCase();

  const has = re => re.test(blob);
  const reflectiveSignals = [
    has(/\b(?:essay|classic|evergreen|systems|institutions|philosophy|anthropology|culture|political-economy)\b/) ? 'evergreen frame' : '',
    has(/\b(?:deep-dive|worldview|lens|information systems|market failure|state capacity)\b/) ? 'slow-read lens' : '',
  ].filter(Boolean);
  const practicalSignals = [
    has(/\b(?:macro|markets|rates|energy|portfolio|allocation|sector|newsletter|investment-thesis)\b/) ? 'market-relevant' : '',
    has(/\b(?:jobs data|policy|liquidity|risk appetite|fiscal|geopolitical|stagflation)\b/) ? 'current decision frame' : '',
  ].filter(Boolean);

  let score = 0;
  if (isWeekend) {
    score += reflectiveSignals.length * 0.55;
    score -= has(/\b(?:newsletter|jobs data|latest|daily|weekly)\b/) ? 0.45 : 0;
  } else {
    score += practicalSignals.length * 0.55;
    score -= has(/\b(?:classic|evergreen)\b/) && !practicalSignals.length ? 0.35 : 0;
  }

  const labelSignals = isWeekend ? reflectiveSignals : practicalSignals;
  const label = labelSignals.length
    ? `${isWeekend ? 'Weekend' : 'Weekday'} fit: ${[...new Set(labelSignals)].slice(0, 2).join(' + ')}.`
    : '';
  return { score, label };
}

export function articleDayFit(candidate = {}, targetDate = new Date().toISOString().slice(0, 10)) {
  const day = new Date(`${targetDate}T00:00:00Z`).getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const blob = [
    candidate.kicker,
    candidate.title,
    candidate.source,
    candidate.sourceLabel,
    candidate.frame,
    candidate.thesis,
    candidate.dek,
    candidate.why,
    candidate.url,
    candidate.link,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
    ...(Array.isArray(candidate.themes) ? candidate.themes : []),
  ].join(' ').toLowerCase();

  const has = re => re.test(blob);
  const reflectiveSignals = [
    has(/\b(?:essay|long-form|longform|classic|evergreen|philosophy|religion|religious|culture|cultural|psychology|moral|ethics)\b/) ? 'reflective Society read' : '',
    has(/\b(?:social theory|community|family|institutions?|civil society|class)\b/) ? 'social lens' : '',
  ].filter(Boolean);
  const practicalSignals = [
    has(/\b(?:cities|housing|education|governance|policy|politics|political|institutions?|state capacity)\b/) ? 'civic decision frame' : '',
    has(/\b(?:current|today|now|recent|new|reported|analysis)\b/) ? 'fresh analysis' : '',
  ].filter(Boolean);

  let score = 0;
  if (isWeekend) {
    score += reflectiveSignals.length * 0.45;
    score -= has(/\b(?:breaking|latest|daily|market update|newsletter roundup)\b/) ? 0.35 : 0;
  } else {
    score += practicalSignals.length * 0.45;
    score -= has(/\b(?:classic|evergreen)\b/) && !practicalSignals.length ? 0.25 : 0;
  }

  const labelSignals = isWeekend ? reflectiveSignals : practicalSignals;
  const label = labelSignals.length
    ? `${isWeekend ? 'Weekend' : 'Weekday'} fit: ${[...new Set(labelSignals)].slice(0, 2).join(' + ')}.`
    : '';
  return { score, label };
}

function readingLane(candidate = {}) {
  const blob = [
    candidate.kicker,
    candidate.title,
    candidate.source,
    candidate.sourceLabel,
    candidate.frame,
    candidate.thesis,
    candidate.dek,
    candidate.why,
    candidate.url,
    candidate.link,
    ...(Array.isArray(candidate.tags) ? candidate.tags : []),
    ...(Array.isArray(candidate.themes) ? candidate.themes : []),
  ].join(' ').toLowerCase();

  const lanes = [
    {
      id: 'ai-tooling',
      label: 'AI/tooling',
      re: /\b(?:ai tooling|developer tools?|obsidian|vector dbs?|rag|embeddings?|llms?|frontier models?|machine learning)\b/,
    },
    {
      id: 'macro',
      label: 'macro/investing',
      re: /\b(?:macro|markets?|invest(?:ing|ment)?|portfolio|capital allocation|rates?|energy|finance|fiscal|liquidity|risk appetite|sector|crypto|semiconductors?|gold|commodit(?:y|ies))\b/,
    },
    {
      id: 'society',
      label: 'society/culture',
      re: /\b(?:society|social|culture|cultural|religion|religious|politics|political|class|community|institutions?|governance|cities|education|psychology|philosophy|moral|ethics)\b/,
    },
    {
      id: 'software',
      label: 'software/systems',
      re: /\b(?:software|systems?|infrastructure|engineering|interfaces?|protocols?|operating systems?)\b/,
    },
  ];

  return lanes.find(lane => lane.re.test(blob)) ?? { id: '', label: '' };
}

export function readingLaneBalanceFit(candidate = {}, selectedRead = null) {
  if (!selectedRead) return { score: 0, label: '' };
  const candidateLane = readingLane(candidate);
  const selectedLane = readingLane(selectedRead);
  if (!candidateLane.id || !selectedLane.id) return { score: 0, label: '' };

  if (candidateLane.id === selectedLane.id) {
    return {
      score: -1.25,
      label: `Reading mix: same ${candidateLane.label} lane as today's Reading pick.`,
    };
  }

  const isClassicBalance = candidateLane.id === 'macro' && selectedLane.id === 'society';
  return {
    score: isClassicBalance ? 0.45 : 0.25,
    label: `Reading mix: adds ${candidateLane.label} beside today's ${selectedLane.label} pick.`,
  };
}

const SOURCE_LABEL_OVERRIDES = new Map([
  ['aeon', 'Aeon'],
  ['aeon.co', 'Aeon'],
  ['compact', 'Compact'],
  ['compactmag.com', 'Compact'],
  ['cato unbound', 'Cato Unbound'],
  ['cato-unbound.org', 'Cato Unbound'],
  ['guernica', 'Guernica'],
  ['guernicamag.com', 'Guernica'],
  ['new york times', 'The New York Times'],
  ['nytimes.com', 'The New York Times'],
  ['the atlantic', 'The Atlantic'],
  ['theatlantic.com', 'The Atlantic'],
  ['works in progress', 'Works in Progress'],
  ['worksinprogress.co', 'Works in Progress'],
  ['lyn alden', 'Lyn Alden'],
  ['lynalden.com', 'Lyn Alden'],
  ['the diff', 'The Diff'],
  ['thediff.co', 'The Diff'],
  ['idle words', 'Idle Words'],
  ['idlewords.com', 'Idle Words'],
]);

function hostFromUrl(url = '') {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function titleCaseHost(host = '') {
  return String(host)
    .replace(/^www\./, '')
    .split('.')[0]
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function readableSourceLabel(candidate = {}) {
  const existing = String(candidate.sourceLabel ?? '').trim();
  if (existing && !existing.includes('.')) return existing;

  const source = String(candidate.source ?? '').trim();
  const publication = source.includes('/') ? source.split('/').pop().trim() : source;
  const normalizedPublication = publication.toLowerCase();
  if (publication && !publication.includes('.')) {
    return SOURCE_LABEL_OVERRIDES.get(normalizedPublication) ?? publication;
  }

  const host = hostFromUrl(candidate.url ?? candidate.link ?? '');
  if (!host) return existing || source || '';
  return SOURCE_LABEL_OVERRIDES.get(host) ?? titleCaseHost(host);
}

export function imageFeedbackProfile(weights = {}) {
  const notes = (weights.notes ?? []).join(' ').toLowerCase();
  return {
    avoidCommons: /\b(?:wikimedia|wikipedia commons|commons)\b/.test(notes)
      || (/\b(?:blank|black|broken|source this differently|source differently|sourcing .*off|source .*off)\b/.test(notes) && /\b(?:link|image|source|sourcing|commons|wikipedia)\b/.test(notes)),
  };
}

export function workshopNoteTerms(notes = '') {
  const prefer = [];
  const avoid = [];

  const addFrom = (target, re) => {
    const match = notes.match(re);
    if (!match?.[1]) return;
    for (const term of match[1].split(/[,/;]|\band\b|\bor\b/)) {
      const t = term.trim().replace(/^(more|less|not|no|avoid|stop|about|like)\s+/, '');
      if (t.length >= 3 && t.length <= 40) target.push(t);
    }
  };

  addFrom(prefer, /\bmore (?:about |like |of )?([^.!?]+?)(?=,\s*(?:less|not|no|avoid|stop)\b|$)/);
  addFrom(avoid, /\b(?:less|not|no|avoid|stop) (?:about |like |of )?([^.!?]+)/);

  return {
    prefer: [...new Set(prefer)],
    avoid: [...new Set(avoid)],
  };
}

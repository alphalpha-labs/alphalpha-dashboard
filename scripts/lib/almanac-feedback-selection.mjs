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

  return /^(archive|archives|articles?|blog|category|columns?|essays?|features?|ideas|issue|issues|magazine|news|opinion|posts?|search|sections?|tag|tags|topics?)$/.test(segments[0]);
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

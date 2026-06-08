export function articleFeedbackProfile(weights = {}) {
  const notes = (weights.notes ?? []).join(' ').toLowerCase();
  const avoidHosts = [];
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
  return /\b(?:pdf|textbook|worksheet|syllabus|course packet|lecture notes|contemporary introduction)\b/.test(lower)
    || /\b(?:topics?|ideas?)\s+for\s+(?:papers?|essays?)\b/.test(lower)
    || /\b(?:essay examples?|paper examples?|research paper topics?|writing prompts?)\b/.test(lower)
    || /\b(?:edubirdie|gradesfixer|studycorgi|ivypanda|essaypro|papersowl)\b/.test(lower)
    || /\.pdf(?:$|[?#])/.test(lower);
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

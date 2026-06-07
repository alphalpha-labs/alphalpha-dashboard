const GENRE_LABELS: Record<string, string> = {
  article: "Reading",
  venture: "Venture",
  image: "Look",
  chart: "Signal",
  surprise: "Surprise",
  riff: "Riff",
  production: "Studio",
  poem: "Poem",
  longread: "Long read",
  austin: "Explore Austin",
};

export type AlmanacInterpretationInput = {
  genre: string;
  title?: string;
  sub?: string;
  reaction?: "more" | "less" | null;
  chips?: string[];
  note?: string;
  kept?: boolean;
};

function sentence(items: string[]) {
  return items.filter(Boolean).join(" ");
}

function sourceDirective(note: string, genreLabel: string) {
  const lower = note.toLowerCase();
  const blocked: string[] = [];
  if (/\breddit\b/.test(lower)) blocked.push("Reddit posts");
  if (/\bx\.com\b|\btwitter\b/.test(lower)) blocked.push("X/Twitter posts");
  if (/\bhacker news\b|\bhn\b/.test(lower)) blocked.push("Hacker News threads");
  if (blocked.length === 0) return null;
  return `Exclude ${blocked.join(" and ")} as selected ${genreLabel} sources; use them only as background leads, not as the tile itself.`;
}

function positiveDirective(note: string, genre: string, genreLabel: string) {
  const lower = note.toLowerCase();
  const wantsLessAiFocus = /\b(less|no|not|avoid|stop)\s+(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)[-\s]*(?:focused|centric|articles?|signals?|charts?|states?|stuff|content)?\b/.test(lower)
    || (/\b(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)[-\s]*(?:focused|centric)\b/.test(lower) && /\b(less|no|not|avoid|stop)\b/.test(lower))
    || (/\bbeyond\b|\bnot just\b|\bmore than\b|\bdeeper than\b/.test(lower) && /\b(?:ai|a\.i\.|artificial intelligence|genai|llm|machine learning)\b/.test(lower) && /\b(?:adoption|infrastructure|stats?|statistics|state)\b/.test(lower));
  if (wantsLessAiFocus && (genre === "article" || genre === "chart")) {
    return `Treat AI-focused ${genreLabel} candidates as a hard avoid; AI can be background context only when the selected tile is really about another subject.`;
  }

  const wantsLong = /\blong\b|\blongform\b|\blong-form\b|\bessay\b|\bessays\b/.test(lower);
  const wantsProvoking = /\bthought provoking\b|\bthought-provoking\b|\bprovoking\b|\bdeep\b|\bserious\b/.test(lower);
  const wantsSocial = /\bsocial\b|\bcultural\b|\bpolitical\b|\bsociety\b|\bculture\b|\bpolitics\b/.test(lower);
  const wantsEvergreen = /\bevergreen\b|\bfrom whenever\b|\bwhenever\b/.test(lower);
  const wantsRecent = /\brecent\b|\btimely\b|\bcurrent\b/.test(lower);

  if (genre === "article" && (wantsLong || wantsProvoking || wantsSocial || wantsEvergreen || wantsRecent)) {
    const traits: string[] = [];
    if (wantsLong) traits.push("long-form");
    if (wantsProvoking) traits.push("thought-provoking");
    if (wantsSocial) traits.push("social/cultural/political");
    const recency = wantsRecent && wantsEvergreen
      ? "Prefer recent pieces, but allow older evergreen work when it is still unusually valuable."
      : wantsRecent
        ? "Prefer recent pieces."
        : wantsEvergreen
          ? "Allow older evergreen work when it is still unusually valuable."
          : "";
    return sentence([
      `Rank ${traits.length ? traits.join(", ") : "substantive"} essays and reported pieces higher for Reading.`,
      recency,
    ]);
  }

  if (/\bbeyond\b|\bnot just\b|\bmore than\b|\bdeeper than\b/.test(lower)) {
    if (genre === "chart") {
      return "Do not treat AI adoption stats alone as a strong Signal; prefer charts that connect AI to markets, labor, culture, policy, product behavior, or other second-order effects.";
    }
    return `Require a sharper angle, stronger consequence, or less obvious source before selecting similar ${genreLabel} tiles.`;
  }

  if (/\bsource\b|\bsourcing\b|\bcredible\b|\bbacked\b|\bdata\b/.test(lower)) {
    return `Require stronger sourcing for future ${genreLabel} candidates; prefer primary or clearly attributed material over thin summaries.`;
  }

  if (/\bvibe\b|\btone\b|\bbeautiful\b|\baesthetic\b|\bstyle\b/.test(lower)) {
    return `Preserve the useful topic, but retune the ${genreLabel} feel, style, and presentation before ranking similar candidates.`;
  }

  if (/\bpractical\b|\baction\b|\buseful\b|\bdo\b|\btry\b/.test(lower)) {
    return `Favor future ${genreLabel} tiles that turn the idea into a more usable takeaway, experiment, or decision aid.`;
  }

  if (/\bfamiliar\b|\bseen\b|\bobvious\b|\bstale\b/.test(lower)) {
    return `Down-rank familiar versions of this ${genreLabel} lane; search for fresher sources, more surprising examples, or less recycled framing.`;
  }

  return null;
}

export function buildAlmanacFeedbackInterpretation(input: AlmanacInterpretationInput) {
  const genreLabel = GENRE_LABELS[input.genre] ?? input.genre;
  const note = input.note?.trim() ?? "";
  const directives: string[] = [];

  if (input.kept) {
    directives.push(`Keep this ${genreLabel} lane in contention${input.sub ? `, especially ${input.sub}-style sources` : ""}.`);
  }
  if (input.reaction === "more") {
    directives.push(`Raise candidates that satisfy this preference; do not merely repeat the same topic.`);
  }
  if (input.reaction === "less") {
    directives.push(`Lower candidates that resemble this tile unless they fix the specific objection.`);
  }
  if (input.chips?.length) {
    directives.push(`Use chip weights: ${input.chips.slice(0, 3).join(", ")}.`);
  }
  if (note) {
    const source = sourceDirective(note, genreLabel);
    const positive = positiveDirective(note, input.genre, genreLabel);
    if (source) directives.push(source);
    if (positive) directives.push(positive);
    if (!source && !positive) {
      directives.push(`Apply the note as a selection rule for future ${genreLabel} candidates, and compare candidates against it before drafting.`);
    }
  }

  if (directives.length === 0) {
    return "Save a reaction, chip, note, or keep signal to steer future editions.";
  }

  return `Understood: ${directives.join(" ")}`;
}

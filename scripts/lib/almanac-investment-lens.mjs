const SEVERITY = {
  "material-change": 5,
  "pay-attention": 4,
  watch: 3,
  monitor: 2,
};

function dateMs(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}

function sourceNotes(brief, limit = 3) {
  return (brief?.sourceNotes || [])
    .filter(source => source?.title && source?.url)
    .slice(0, limit)
    .map(source => ({
      label: source.title,
      url: source.url,
      observedAt: brief.generatedAt,
    }));
}

function relatedText(items, seed, fallback) {
  const terms = new Set(String(seed).toLowerCase().match(/[a-z]{4,}/g) || []);
  return [...(items || [])]
    .map((text, index) => ({
      text,
      score: (String(text).toLowerCase().match(/[a-z]{4,}/g) || [])
        .reduce((sum, term) => sum + (terms.has(term) ? 1 : 0), 0) - index * 0.01,
    }))
    .sort((a, b) => b.score - a.score)[0]?.text || fallback;
}

export function buildInvestmentLensCandidates({ marketBrief, ideaFarm, thesisReview } = {}) {
  const candidates = [];

  const change = [...(marketBrief?.changedSincePrevious || [])]
    .sort((a, b) => (SEVERITY[b.severity] || 0) - (SEVERITY[a.severity] || 0))[0];
  if (change) {
    const attention = marketBrief.payAttention?.[0];
    candidates.push({
      id: `thesis-update:${change.id}`,
      kind: "thesis-update",
      kicker: "Existing thesis development",
      title: change.title,
      observation: change.summary,
      interpretation: marketBrief.portfolioImplication,
      openQuestion: attention?.reason || marketBrief.discussionPrompt,
      nextResearchAction: attention?.title || "Test whether this change persists beyond the first market reaction.",
      posture: marketBrief.actionPosture || "Observation only; no trade recommendation.",
      asOf: marketBrief.generatedAt,
      freshness: "current",
      relatedSymbols: marketBrief.marketDrivers?.flatMap(driver => driver.relatedSymbols || []).slice(0, 8) || [],
      relatedTheses: marketBrief.marketDrivers?.flatMap(driver => driver.relatedTheses || []).slice(0, 6) || [],
      provenance: sourceNotes(marketBrief),
      score: 8 + (SEVERITY[change.severity] || 0),
    });
  }

  const ideaTitle = ideaFarm?.newsletter?.subject || ideaFarm?.newsletter?.title;
  const insight = ideaFarm?.insights?.[0];
  if (ideaTitle && insight) {
    const ideaSeed = `${ideaTitle} ${insight}`;
    const interpretation = relatedText(ideaFarm.implications, ideaSeed, "This is a research lead, not a portfolio conclusion.");
    const openQuestion = relatedText(ideaFarm.contradictions, `${ideaSeed} ${interpretation}`, "What would make the apparent opportunity a value trap?");
    const nextResearchAction = relatedText(
      ideaFarm.watchItems,
      `${ideaSeed} ${interpretation} ${openQuestion}`,
      "Find fresh earnings, valuation, and policy evidence before forming a thesis.",
    );
    const provenance = (ideaFarm.sourcesCrawled || [])
      .filter(source => source?.url && /extracted|fetched/i.test(source.status || ""))
      .slice(0, 3)
      .map(source => ({ label: source.title, url: source.url, observedAt: ideaFarm.generatedAt }));
    candidates.push({
      id: `new-idea:${String(ideaTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind: "new-idea",
      kicker: "New idea worth testing",
      title: ideaTitle,
      observation: insight,
      interpretation,
      openQuestion,
      nextResearchAction,
      posture: "Research queue only; no trade recommendation.",
      asOf: ideaFarm.generatedAt,
      freshness: "recent",
      relatedSymbols: [],
      relatedTheses: [],
      provenance,
      score: 9,
    });
  }

  const thesis = thesisReview?.thesisBasketsContext?.thesisChanges?.[0];
  if (thesis) {
    candidates.push({
      id: `thesis-review:${thesis.basket}`,
      kind: "invalidation-check",
      kicker: "Thesis stress test",
      title: `${thesis.basket}: evidence must catch up to conviction`,
      observation: thesis.why_it_matters,
      interpretation: `Conviction is ${thesis.conviction}/10 and ${thesis.trend}; freshness is ${thesis.freshness}.`,
      openQuestion: `What current evidence would invalidate—or re-earn—this ${thesis.conviction}/10 conviction?`,
      nextResearchAction: thesisReview.nextActions?.[0] || "Refresh the evidence packet before changing posture.",
      posture: "Evidence review only; no allocation authority.",
      asOf: thesisReview.generatedAt,
      freshness: thesis.freshness || "unknown",
      relatedSymbols: [],
      relatedTheses: [thesis.basket],
      provenance: [],
      score: 7,
    });
  }

  return candidates;
}

export function selectInvestmentLens(candidates, targetDate) {
  if (!candidates?.length) return null;
  const day = Number(String(targetDate).slice(-2));
  const preferredKind = day % 2 === 0 ? "new-idea" : "thesis-update";
  return [...candidates].sort((a, b) => {
    const aPreferred = a.kind === preferredKind ? 6 : 0;
    const bPreferred = b.kind === preferredKind ? 6 : 0;
    const freshnessDelta = Math.sign(dateMs(b.asOf) - dateMs(a.asOf));
    return (b.score + bPreferred) - (a.score + aPreferred) || freshnessDelta;
  })[0];
}

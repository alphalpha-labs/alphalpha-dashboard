import { describe, expect, it } from "vitest";
// @ts-expect-error generator helper is authored as ESM JavaScript.
import { buildInvestmentLensCandidates, selectInvestmentLens } from "../scripts/lib/almanac-investment-lens.mjs";

const marketBrief = {
  generatedAt: "2026-07-23T17:00:00Z",
  actionPosture: "observe; no trade recommendation",
  portfolioImplication: "Existing energy exposure is already large.",
  changedSincePrevious: [{ id: "oil", title: "Oil changed the rates picture", summary: "Brent crossed $100.", severity: "material-change" }],
  payAttention: [{ title: "Persistence of oil", reason: "A one-day shock is not a cash-flow change." }],
  sourceNotes: [{ title: "Primary source", url: "https://example.com/source" }],
};
const ideaFarm = {
  generatedAt: "2026-07-22T12:00:00Z",
  newsletter: { subject: "The world's cheapest country" },
  insights: ["Japan's price level is unusually low."],
  implications: ["Treat cheapness as a watch signal."],
  contradictions: ["Cheapness may persist if the currency remains weak."],
  watchItems: ["Earnings breadth"],
  sourcesCrawled: [{ title: "World Prices", url: "https://example.com/report.pdf", status: "extracted" }],
};

describe("Almanac investment lens", () => {
  it("normalizes thesis developments and new ideas with provenance and action boundaries", () => {
    const candidates = buildInvestmentLensCandidates({ marketBrief, ideaFarm });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].kind).toBe("thesis-update");
    expect(candidates[0].provenance[0].url).toBe("https://example.com/source");
    expect(candidates[1].posture).toContain("no trade");
  });

  it("balances new ideas and thesis updates over alternating dates", () => {
    const candidates = buildInvestmentLensCandidates({ marketBrief, ideaFarm });
    expect(selectInvestmentLens(candidates, "2026-07-24").kind).toBe("new-idea");
    expect(selectInvestmentLens(candidates, "2026-07-24").interpretation).toContain("cheapness");
    expect(selectInvestmentLens(candidates, "2026-07-25").kind).toBe("thesis-update");
  });
});

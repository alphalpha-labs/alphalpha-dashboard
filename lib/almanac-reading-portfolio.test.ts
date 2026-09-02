import { describe, expect, it } from "vitest";
// @ts-expect-error mjs helper module is used by the generator script.
import {
  estimateReadMinutes,
  selectReadingPortfolio,
  toReadingRecommendation,
} from "../scripts/lib/almanac-reading-portfolio.mjs";

function candidate(id: string, score: number, minutes: number, source: string, themes: string[]) {
  return {
    id,
    title: `${themes.join(" ")} essay ${id}`,
    why: `A specific argument about ${themes.join(" and ")}`,
    source,
    link: `https://${source.toLowerCase().replace(/\s/g, "")}.example/${id}`,
    themes,
    score,
    readMinutes: minutes,
    novelty: { eligible: true, noveltyScore: 5, penalty: 0 },
  };
}

describe("Almanac three-read portfolio", () => {
  it("normalizes explicit and textual read times", () => {
    expect(estimateReadMinutes({ readMinutes: 12 })).toBe(12);
    expect(estimateReadMinutes({ readTime: "18 min · Jul 20" })).toBe(18);
    expect(estimateReadMinutes({ wordCount: 2300 })).toBe(10);
    expect(estimateReadMinutes({})).toBe(10);
  });

  it("selects three diverse roles inside the reading budget", () => {
    const result = selectReadingPortfolio([
      candidate("a", 12, 10, "Civic Review", ["politics", "cities"]),
      candidate("b", 11, 12, "Culture Journal", ["religion", "culture"]),
      candidate("c", 10, 15, "Progress Notes", ["science", "health"]),
      candidate("d", 9, 30, "Civic Review", ["politics", "institutions"]),
    ]);

    expect(result.status).toBe("healthy");
    expect(result.selected).toHaveLength(3);
    expect(result.totalMinutes).toBeGreaterThanOrEqual(20);
    expect(result.totalMinutes).toBeLessThanOrEqual(45);
    expect(result.selected.map((item: { role: string }) => item.role)).toEqual(["anchor", "lens", "frontier"]);
    expect(result.selected.filter((item: { exploration: boolean }) => item.exploration)).toHaveLength(1);
    expect(new Set(result.selected.map((item: { source: string }) => item.source)).size).toBeGreaterThanOrEqual(2);
  });

  it("returns an honest degraded result instead of padding a weak pool", () => {
    const result = selectReadingPortfolio([
      candidate("a", 10, 10, "One", ["politics"]),
      candidate("b", 9, 10, "Two", ["culture"]),
      { ...candidate("c", 8, 10, "Three", ["science"]), novelty: { eligible: false } },
    ]);
    expect(result.status).toBe("degraded");
    expect(result.reason).toBe("fewer-than-three-quality-candidates");
    expect(result.selected).toHaveLength(2);
  });

  it("prefers a timely portfolio over an all-evergreen mix when quality is close", () => {
    const result = selectReadingPortfolio([
      candidate("evergreen-a", 10, 10, "Civic Review", ["politics"]),
      candidate("evergreen-b", 10, 10, "Culture Journal", ["culture"]),
      candidate("evergreen-c", 10, 10, "Science Notes", ["science"]),
      { ...candidate("dated-a", 9.5, 10, "City Journal", ["cities"]), publishedAt: "2026-08-10" },
      { ...candidate("dated-b", 9.5, 10, "Public Square", ["religion"]), publishedAt: "2026-08-09" },
    ], { targetDate: "2026-08-12" });

    expect(result.status).toBe("healthy");
    expect(result.datedReads).toBeGreaterThanOrEqual(2);
  });

  it("does not mistake old publication dates for timely reads", () => {
    const result = selectReadingPortfolio([
      candidate("anchor", 10, 10, "Civic Review", ["politics"]),
      candidate("lens", 10, 10, "Culture Journal", ["culture"]),
      { ...candidate("old", 10, 10, "Archive Review", ["history"]), publishedAt: "2022-08-10" },
      { ...candidate("recent", 9.75, 10, "City Journal", ["cities"]), publishedAt: "2026-08-10" },
    ], { targetDate: "2026-08-12" });

    expect(result.selected.map((item: { id: string }) => item.id)).toContain("recent");
    expect(result.selected.map((item: { id: string }) => item.id)).not.toContain("old");
  });

  it("maps selected candidates into a stable UI recommendation", () => {
    const mapped = toReadingRecommendation(
      { ...candidate("a", 10, 9, "Review", ["cities"]), role: "anchor", exploration: false },
      {
        source: "Review",
        readTime: "9 min",
        title: "City limits",
        dek: "A reported essay.",
        why: "Useful for thinking about governance.",
        sourceContext: "Independent reporting; published this week; ranked for Society & Ideas fit.",
        url: "https://www.review.example/city?utm_source=x",
      },
    );
    expect(mapped.role).toBe("anchor");
    expect(mapped.kicker).toBe("The anchor");
    expect(mapped.whyNow).toBe("Useful for thinking about governance.");
    expect(mapped.sourceContext).toBe("Independent reporting; published this week; ranked for Society & Ideas fit.");
    expect(mapped.url).toBe("https://review.example/city");
  });
});

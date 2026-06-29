import { describe, expect, it } from "vitest";
// @ts-expect-error mjs helper module is used by the generator script.
import {
  articleFeedbackProfile,
  isBlockedReadingUrl,
  imageFeedbackProfile,
  isAiToolingText,
  isArticleIndexText,
  isGenericReadingUrl,
  isReadingBadFormatText,
  isReadingAlreadyUsedStatus,
  isVideoHost,
  normalizeReadingPublishedDate,
  readingFreshnessScore,
  readingSelectionSignalSummary,
  austinExploreSeasonFit,
  longReadDayFit,
  readingLaneBalanceFit,
  workshopNoteTerms,
} from "../scripts/lib/almanac-feedback-selection.mjs";

describe("almanac feedback selection gates", () => {
  it("turns Reading notes into strong anti-AI-tooling and pro-social-theory signals", () => {
    const profile = articleFeedbackProfile({
      notes: [
        "This is still too oriented toward AI tooling, please make this more about religion/politics/social theory/philosophy",
        "I would not ever use a Reddit post for this tile.",
      ],
    });

    expect(profile.avoidAiFocused).toBe(true);
    expect(profile.avoidAiTooling).toBe(true);
    expect(profile.avoidHosts).toContain("reddit.com");
    expect(profile.preferTerms).toEqual(expect.arrayContaining(["religious", "political", "social theory", "philosophy"]));
    expect(isAiToolingText("I replaced vector DBs with Google's Memory Agent Pattern in Obsidian")).toBe(true);
  });

  it("summarizes learned Reading taste signals without raw feedback prose", () => {
    const summary = readingSelectionSignalSummary({
      notes: [
        "This is still too oriented toward AI tooling; make it more about religion, politics, and social theory.",
        "I would not ever use a Reddit post for this tile.",
      ],
      sourceAffinity: { Compact: 2 },
    });

    expect(summary).toContain("feedback prefers");
    expect(summary).toContain("religious");
    expect(summary).toContain("political");
    expect(summary).toContain("avoids AI tooling");
    expect(summary).toContain("Reddit");
    expect(summary).not.toContain("This is still");
  });

  it("rejects non-article Reading formats", () => {
    expect(isVideoHost("youtube.com")).toBe(true);
    expect(isArticleIndexText("1,000 Great Longform Articles and Essays https://tetw.org/menu2")).toBe(true);
    expect(isReadingBadFormatText("[PDF] Social and Political Philosophy: A Contemporary Introduction")).toBe(true);
    expect(isReadingBadFormatText("250+ Political Science Topics for 2025: Ideas for Papers & Essays edubirdie.com")).toBe(true);
    expect(isReadingBadFormatText("Religion and Politics | Internet Encyclopedia of Philosophy iep.utm.edu")).toBe(true);
    expect(isBlockedReadingUrl("https://www.facebook.com/groups/austinreadingclub")).toBe(true);
    expect(isBlockedReadingUrl("https://reddit.com/r/PoliticalDiscussion/comments/abc")).toBe(true);
    expect(isBlockedReadingUrl("https://www.theatlantic.com/ideas/archive/example")).toBe(false);
  });

  it("rejects generic publication pages as Reading source links", () => {
    expect(isGenericReadingUrl("https://worksinprogress.co/")).toBe(true);
    expect(isGenericReadingUrl("https://example.com/ideas")).toBe(true);
    expect(isGenericReadingUrl("https://example.com/tag/politics")).toBe(true);
    expect(isGenericReadingUrl("https://example.com/newsletters")).toBe(true);
    expect(isGenericReadingUrl("https://example.com/subscribe")).toBe(true);
    expect(isGenericReadingUrl("https://www.guernicamag.com/rebecca-solnit-men-explain-things-to-me/")).toBe(false);
    expect(isGenericReadingUrl("https://www.theatlantic.com/ideas/archive/2022/01/scarcity-crisis-college-housing-health-care/621221/")).toBe(false);
    expect(isGenericReadingUrl("https://example.com/newsletter/the-politics-of-attention")).toBe(false);
  });

  it("rejects newsletter/archive landing pages without rejecting real essays", () => {
    expect(isReadingBadFormatText("Subscribe to our newsletter for weekly essays https://example.com/subscribe")).toBe(true);
    expect(isReadingBadFormatText("Latest newsletters | The Atlantic https://www.theatlantic.com/newsletters/")).toBe(true);
    expect(isReadingBadFormatText("Archive index page for politics essays https://compactmag.com/archive")).toBe(true);
    expect(isReadingBadFormatText("The Politics of Attention is a reported essay on family, media, and institutions")).toBe(false);
  });

  it("treats previously delivered Reading statuses as spent inventory", () => {
    expect(isReadingAlreadyUsedStatus("weekly-pick-2026-06-19")).toBe(true);
    expect(isReadingAlreadyUsedStatus("Kindle packet only")).toBe(true);
    expect(isReadingAlreadyUsedStatus("Queued")).toBe(false);
  });

  it("turns image sourcing complaints into a Commons avoidance signal", () => {
    expect(imageFeedbackProfile({
      notes: ["I think we need to source this differently the Wikipedia commons links are often blank or black"],
    }).avoidCommons).toBe(true);

    expect(imageFeedbackProfile({
      notes: ["The sourcing here looks quite off; the caption does not match the image."],
    }).avoidCommons).toBe(true);
  });

  it("normalizes and scores Reading freshness", () => {
    expect(normalizeReadingPublishedDate("Tue, 16 Jun 2026 12:00:00 GMT")).toBe("2026-06-16");
    expect(normalizeReadingPublishedDate("2026-06-01T08:30:00-05:00")).toBe("2026-06-01");
    expect(normalizeReadingPublishedDate("not a date")).toBeNull();

    expect(readingFreshnessScore({ publishedAt: "2026-06-17" }, "2026-06-18")).toBeGreaterThan(
      readingFreshnessScore({ publishedAt: "2026-03-01" }, "2026-06-18"),
    );
    expect(readingFreshnessScore({ publishedAt: "2024-01-01" }, "2026-06-18")).toBeLessThan(0);
  });

  it("nudges Austin Explore picks toward seasonal usefulness", () => {
    const summerPool = {
      title: "Deep Eddy Pool",
      category: "Swim reset",
      bestTime: "Hot weekday morning",
      vibe: "Historic pool, cold water, simple Austin ritual.",
      tags: ["swim", "summer", "family"],
    };
    const exposedView = {
      title: "Covert Park at Mount Bonnell",
      category: "Viewpoint",
      bestTime: "Clear evening",
      vibe: "Stone steps, river bend, classic Austin view.",
      tags: ["view", "classic", "short"],
    };
    const museum = {
      title: "Blanton Museum of Art",
      category: "Museum hour",
      bestTime: "Hot afternoon",
      vibe: "Quiet galleries, campus energy.",
      tags: ["museum", "art", "indoors"],
    };

    expect(austinExploreSeasonFit(summerPool, "2026-06-26").score).toBeGreaterThan(
      austinExploreSeasonFit(exposedView, "2026-06-26").score,
    );
    expect(austinExploreSeasonFit(museum, "2026-07-12").label).toContain("Summer fit");
    expect(austinExploreSeasonFit({ title: "Side-street wander", tags: ["books"] }, "2026-07-12").label).not.toContain("shade/water");
    expect(austinExploreSeasonFit({ title: "Zilker Botanical Garden", tags: ["garden", "outdoors"] }, "2026-04-15").label).toContain("Spring fit");
  });

  it("nudges long reads toward the day's reading rhythm", () => {
    const reflectiveEssay = {
      title: "Finance as a Scale-Invariant Global Computer",
      frame: "Markets as information systems",
      thesis: "A conceptual essay about markets, time horizons, and capital allocation.",
      tags: ["markets", "systems", "essay", "deep-dive"],
    };
    const tacticalNote = {
      title: "A New Trilemma",
      frame: "Macro policy trilemma",
      thesis: "Jobs data, geopolitical shock, rates, energy, and risk appetite.",
      tags: ["macro", "rates", "energy", "investment-thesis"],
    };

    expect(longReadDayFit(reflectiveEssay, "2026-06-27").score).toBeGreaterThan(
      longReadDayFit(tacticalNote, "2026-06-27").score,
    );
    expect(longReadDayFit(tacticalNote, "2026-06-29").score).toBeGreaterThan(
      longReadDayFit(reflectiveEssay, "2026-06-29").score,
    );
    expect(longReadDayFit(reflectiveEssay, "2026-06-27").label).toContain("Weekend fit");
    expect(longReadDayFit(tacticalNote, "2026-06-29").label).toContain("Weekday fit");
  });

  it("keeps the main Reading and macro read from stacking the same lane", () => {
    const societyArticle = {
      title: "Faith and the Future of Civic Life",
      kicker: "Society & Ideas",
      dek: "A cultural essay about religion, institutions, and community trust.",
    };
    const macroRead = {
      title: "A New Trilemma",
      frame: "Macro policy trilemma",
      thesis: "Jobs data, rates, energy, and risk appetite are creating a harder allocation backdrop.",
      tags: ["macro", "rates", "energy", "investment-thesis"],
    };
    const secondMacroRead = {
      title: "Markets in the New Rate Regime",
      frame: "Macro allocation",
      thesis: "A portfolio note on rates, liquidity, markets, and sector risk.",
      tags: ["macro", "markets"],
    };

    expect(readingLaneBalanceFit(macroRead, societyArticle).score).toBeGreaterThan(0);
    expect(readingLaneBalanceFit(macroRead, societyArticle).label).toContain("adds macro/investing");
    expect(readingLaneBalanceFit(secondMacroRead, macroRead).score).toBeLessThan(0);
    expect(readingLaneBalanceFit(secondMacroRead, macroRead).label).toContain("same macro/investing lane");
  });

  it("extracts simple more/less terms from workshop notes", () => {
    expect(workshopNoteTerms("more funk and fingerstyle, less beginner blues")).toEqual({
      prefer: ["funk", "fingerstyle"],
      avoid: ["beginner blues"],
    });
  });
});

import { describe, expect, it } from "vitest";
// @ts-expect-error mjs helper module is used by the generator script.
import {
  articleFeedbackProfile,
  isBlockedReadingUrl,
  imageFeedbackProfile,
  isAiToolingText,
  isArticleIndexText,
  isReadingBadFormatText,
  isReadingAlreadyUsedStatus,
  isVideoHost,
  normalizeReadingPublishedDate,
  readingFreshnessScore,
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

  it("extracts simple more/less terms from workshop notes", () => {
    expect(workshopNoteTerms("more funk and fingerstyle, less beginner blues")).toEqual({
      prefer: ["funk", "fingerstyle"],
      avoid: ["beginner blues"],
    });
  });
});

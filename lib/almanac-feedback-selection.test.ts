import { describe, expect, it } from "vitest";
// @ts-expect-error mjs helper module is used by the generator script.
import {
  articleFeedbackProfile,
  imageFeedbackProfile,
  isAiToolingText,
  isArticleIndexText,
  isReadingBadFormatText,
  isVideoHost,
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
  });

  it("turns image sourcing complaints into a Commons avoidance signal", () => {
    expect(imageFeedbackProfile({
      notes: ["I think we need to source this differently the Wikipedia commons links are often blank or black"],
    }).avoidCommons).toBe(true);

    expect(imageFeedbackProfile({
      notes: ["The sourcing here looks quite off; the caption does not match the image."],
    }).avoidCommons).toBe(true);
  });

  it("extracts simple more/less terms from workshop notes", () => {
    expect(workshopNoteTerms("more funk and fingerstyle, less beginner blues")).toEqual({
      prefer: ["funk", "fingerstyle"],
      avoid: ["beginner blues"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildAlmanacFeedbackInterpretation } from "./almanac-feedback-interpretation";

describe("buildAlmanacFeedbackInterpretation", () => {
  it("turns source exclusions and positive reading preferences into concrete curation directives", () => {
    const interpretation = buildAlmanacFeedbackInterpretation({
      genre: "article",
      title: "Taking notes with AI",
      sub: "Reddit",
      reaction: "more",
      note: "I wouldn't ever use a Reddit post for this tile. I would like more like long thought provoking social/cultural/political interest pieces. Preferably recent but can be from whenever if truly evergreen and valuable.",
    });

    expect(interpretation).toContain("Exclude Reddit posts");
    expect(interpretation).toContain("long-form");
    expect(interpretation).toContain("thought-provoking");
    expect(interpretation).toContain("social/cultural/political");
    expect(interpretation).toContain("Prefer recent pieces");
    expect(interpretation).toContain("older evergreen work");
    expect(interpretation).not.toContain("composer guidance");
  });

  it("treats less/no AI feedback as a hard avoid for reading and signal tiles", () => {
    const article = buildAlmanacFeedbackInterpretation({
      genre: "article",
      title: "AI After Drug Development",
      reaction: "less",
      note: "Less AI focused articles, ideally no AI articles for a while.",
    });
    const chart = buildAlmanacFeedbackInterpretation({
      genre: "chart",
      title: "The State of AI",
      reaction: "less",
      note: "Not AI focused for signal either.",
    });

    expect(article).toContain("hard avoid");
    expect(article).toContain("AI-focused Society & Ideas");
    expect(chart).toContain("hard avoid");
    expect(chart).toContain("AI-focused Signal");
  });

  it("upgrades beyond-AI-adoption chart feedback from a soft nudge to a hard avoid", () => {
    const interpretation = buildAlmanacFeedbackInterpretation({
      genre: "chart",
      title: "AI-assisted code, % of new code written with AI tools",
      note: "Lets make this signal/chart range beyond just stats on AI adoption and infrastructure",
    });

    expect(interpretation).toContain("hard avoid");
    expect(interpretation).toContain("AI-focused Signal");
  });
});

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
});

import { describe, expect, it } from "vitest";
import { mergedTuneSignals } from "./almanac-feedback-weights";

describe("mergedTuneSignals", () => {
  it("keeps legacy tune records when a feedback day also has partial history", () => {
    const signals = mergedTuneSignals({
      keeps: {},
      tunes: {
        "riff:abc": {
          itemId: "riff:abc",
          reaction: null,
          chips: [],
          note: "Too beginner oriented",
          at: 1,
        },
        "article:Reddit": {
          itemId: "article:Reddit",
          reaction: null,
          chips: [],
          note: "No Reddit sources",
          at: 2,
        },
      },
      history: {
        "article:Reddit": [
          {
            type: "tune",
            itemId: "article:Reddit",
            genre: "article",
            reaction: null,
            chips: [],
            note: "No Reddit sources",
            at: 2,
          },
        ],
      },
    });

    expect(signals.map(signal => signal.itemId).sort()).toEqual([
      "article:Reddit",
      "riff:abc",
    ]);
  });
});

import { describe, expect, it } from "vitest";
// @ts-expect-error generator helper is authored as ESM JavaScript.
import { buildMusicSparkCandidates, selectMusicSpark } from "../scripts/lib/almanac-music-spark.mjs";

const riff = { title: "Funk phrase", artist: "Teacher", genre: "Funk", difficulty: "Intermediate", videoId: "riff1", why: "Pocket.", note: "Mute between stabs." };
const production = { title: "Resampling", creator: "Producer", daw: "Ableton Live", technique: "Sound design", videoId: "prod1", why: "Texture.", note: "Resample twice." };

describe("Almanac music spark", () => {
  it("creates all five actionable formats from strong source material", () => {
    const candidates = buildMusicSparkCandidates({ riff, production });
    expect(new Set(candidates.map((item: { format: string }) => item.format)).size).toBe(5);
    expect(candidates.every((item: { tryThisNow: string; durationMinutes: number }) => item.tryThisNow && item.durationMinutes <= 15)).toBe(true);
  });

  it("avoids recently used formats instead of following a rigid calendar", () => {
    const candidates = buildMusicSparkCandidates({ riff, production });
    const selected = selectMusicSpark(candidates, {
      recentIds: ["creative-constraint:old", "riff:old", "production-breakdown:old", "sound-experiment:old"],
    });
    expect(selected.format).toBe("short-exercise");
  });
});

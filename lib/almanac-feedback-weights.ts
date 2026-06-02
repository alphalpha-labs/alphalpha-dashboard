// Server-only. Never import from client components.
// Reads all alphalpha:almanac:feedback:* KV keys and aggregates into a per-genre
// weight vector used by the Ranker stage of each tile pipeline.
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Minimal shape that mirrors AlmanacFeedback in app/api/almanac/feedback/route.ts
// without creating a cross-layer import.
type StoredKeep = {
  itemId:  string;
  genre:   string;
  sub?:    string;
  keptAt?: number;
  [k: string]: unknown;
};

type StoredTune = {
  itemId:   string;
  reaction: "more" | "less" | null;
  chips:    string[];
  note:     string;
  [k: string]: unknown;
};

type StoredFeedback = {
  keeps: Record<string, StoredKeep>;
  tunes: Record<string, StoredTune>;
};

export type GenreWeights = {
  /** Count of ✦ Keep signals for items of this genre. */
  keepScore:      number;
  /** Count of ↑ More reactions. */
  moreScore:      number;
  /** Count of ↓ Less reactions. */
  lessScore:      number;
  /** Nuance-chip name → tally (e.g. "go deeper" → 3). */
  chipTallies:    Record<string, number>;
  /** Free-text notes collected for Composer steering context. */
  notes:          string[];
  /** Source / sub-field → keep count (e.g. "Works in Progress" → 2). */
  sourceAffinity: Record<string, number>;
};

export type FeedbackWeights = Record<string, GenreWeights>;

function empty(): GenreWeights {
  return {
    keepScore:      0,
    moreScore:      0,
    lessScore:      0,
    chipTallies:    {},
    notes:          [],
    sourceAffinity: {},
  };
}

/**
 * Aggregate all historical feedback records into a per-genre weight vector.
 * Returns an empty object (no bias) when KV is unavailable or has no feedback.
 */
export async function loadFeedbackWeights(): Promise<FeedbackWeights> {
  const weights: FeedbackWeights = {};

  // Scan all feedback keys with a cursor loop.
  let cursor = 0;
  const allKeys: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "alphalpha:almanac:feedback:*",
      count: 100,
    });
    cursor = Number(nextCursor);
    allKeys.push(...(keys as string[]));
  } while (cursor !== 0);

  if (allKeys.length === 0) return weights;

  const records = await Promise.all(
    allKeys.map(key => redis.get<StoredFeedback>(key))
  );

  for (const record of records) {
    if (!record) continue;

    for (const keep of Object.values(record.keeps ?? {})) {
      const genre = keep.genre ?? "article";
      if (!weights[genre]) weights[genre] = empty();
      weights[genre].keepScore += 1;
      if (keep.sub) {
        weights[genre].sourceAffinity[keep.sub] =
          (weights[genre].sourceAffinity[keep.sub] ?? 0) + 1;
      }
    }

    for (const tune of Object.values(record.tunes ?? {})) {
      // Genre is inferred from the itemId prefix, e.g. "quote-mind-3" → "quote"
      const genre = tune.itemId.split("-")[0] ?? "article";
      if (!weights[genre]) weights[genre] = empty();
      if (tune.reaction === "more") weights[genre].moreScore += 1;
      if (tune.reaction === "less") weights[genre].lessScore += 1;
      for (const chip of tune.chips ?? []) {
        weights[genre].chipTallies[chip] =
          (weights[genre].chipTallies[chip] ?? 0) + 1;
      }
      if (tune.note?.trim()) weights[genre].notes.push(tune.note.trim());
    }
  }

  return weights;
}

// Server-only. Never import from client components.
// Rolling KV store of recently-used item IDs per genre.
// Used by the Ranker stage to avoid repeating recent picks.
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export type HistoryEntry = { id: string; date: string };

const historyKey = (genre: string) => `alphalpha:almanac:history:${genre}`;
const MAX_HISTORY_DAYS = 60;

/**
 * Return item IDs used within the last `withinDays` days for `genre`.
 */
export async function getRecentIds(
  genre:      string,
  withinDays = 14,
): Promise<string[]> {
  const entries = await redis.get<HistoryEntry[]>(historyKey(genre));
  if (!entries) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries
    .filter(e => e.date >= cutoffStr)
    .map(e => e.id);
}

/**
 * Append ids as used on `date` and prune entries older than MAX_HISTORY_DAYS.
 */
export async function recordUsed(
  genre: string,
  ids:   string[],
  date:  string,
): Promise<void> {
  const existing = (await redis.get<HistoryEntry[]>(historyKey(genre))) ?? [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_HISTORY_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const kept = existing.filter(e => e.date >= cutoffStr);
  const fresh = ids.map(id => ({ id, date }));
  await redis.set(historyKey(genre), [...kept, ...fresh]);
}

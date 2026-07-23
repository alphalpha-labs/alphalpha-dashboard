import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SAVES_KEY = "alphalpha:almanac:saves:v2";
const HISTORY_KEY = "alphalpha:almanac:saves:history:v2";

export type AlmanacSave = {
  id: string;
  idempotencyKey: string;
  recommendationId: string;
  editionDate: string;
  title: string;
  source: string;
  url?: string;
  summary?: string;
  role?: string;
  topics: string[];
  lane: "reading" | "investing";
  mode: "automatic" | "manual";
  destination: "Almanac reading queue" | "Investment research queue";
  savedAt: string;
};

async function readSaves() {
  return (await redis.get<Record<string, AlmanacSave>>(SAVES_KEY)) ?? {};
}

export async function GET(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const saves = await readSaves();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 3, 12);
  const excludeDate = req.nextUrl.searchParams.get("excludeDate");
  const lane = req.nextUrl.searchParams.get("lane");
  return NextResponse.json({
    saves: Object.values(saves)
      .filter(save => !excludeDate || save.editionDate !== excludeDate)
      .filter(save => !lane || (save.lane ?? "reading") === lane)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, limit),
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body?.recommendationId || !body?.editionDate || !body?.title) {
    return NextResponse.json(
      { error: "recommendationId, editionDate, and title required" },
      { status: 400 },
    );
  }

  const idempotencyKey = `${body.editionDate}:${body.recommendationId}`;
  const saves = await readSaves();

  if (body.remove === true) {
    const existing = saves[idempotencyKey];
    delete saves[idempotencyKey];
    await redis.set(SAVES_KEY, saves);
    await appendHistory({
      action: "removed",
      idempotencyKey,
      at: new Date().toISOString(),
      title: existing?.title ?? body.title,
    });
    return NextResponse.json({
      ok: true,
      removed: true,
      receipt: `Removed “${existing?.title ?? body.title}” from the Almanac reading queue.`,
    });
  }

  if (saves[idempotencyKey]) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      save: saves[idempotencyKey],
      receipt: `Already saved to ${saves[idempotencyKey].destination}.`,
    });
  }

  const savedAt = new Date().toISOString();
  const save: AlmanacSave = {
    id: idempotencyKey,
    idempotencyKey,
    recommendationId: body.recommendationId,
    editionDate: body.editionDate,
    title: body.title,
    source: body.source ?? "",
    url: body.url,
    summary: body.summary,
    role: body.role,
    topics: Array.isArray(body.topics) ? body.topics.slice(0, 12) : [],
    lane: body.lane === "investing" ? "investing" : "reading",
    mode: body.mode === "automatic" ? "automatic" : "manual",
    destination: body.lane === "investing" ? "Investment research queue" : "Almanac reading queue",
    savedAt,
  };
  saves[idempotencyKey] = save;
  const bounded = Object.fromEntries(
    Object.entries(saves)
      .sort(([, a], [, b]) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, 200),
  );
  await redis.set(SAVES_KEY, bounded);
  await appendHistory({ action: "saved", idempotencyKey, at: savedAt, mode: save.mode, title: save.title });

  return NextResponse.json({
    ok: true,
    save,
    receipt: `${save.mode === "automatic" ? "Automatically saved" : "Saved"} to ${save.destination}.`,
  });
}

async function appendHistory(entry: Record<string, unknown>) {
  const history = (await redis.get<Record<string, unknown>[]>(HISTORY_KEY)) ?? [];
  await redis.set(HISTORY_KEY, [entry, ...history].slice(0, 300));
}

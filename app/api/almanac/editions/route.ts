import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";
import type { DailyData } from "@/lib/data";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const editionKey = (date: string) => `alphalpha:almanac:edition:${date}`;

// GET /api/almanac/editions?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const edition = await redis.get<DailyData>(editionKey(date));
  if (!edition) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ edition });
}

// POST /api/almanac/editions  body: { date: string, edition: DailyData }
// Immutable — only writes if no snapshot exists for that date yet.
export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body?.date || !body?.edition) {
    return NextResponse.json({ error: "date and edition required" }, { status: 400 });
  }

  const key = editionKey(body.date);
  const existing = await redis.get(key);
  if (!existing) {
    await redis.set(key, body.edition);
  }
  return NextResponse.json({ ok: true });
}

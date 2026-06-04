import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const statusKey = (date: string) => `alphalpha:almanac:run:${date}`;

export async function GET(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "valid date required" }, { status: 400 });
  }

  const status = await redis.get(statusKey(date)).catch(() => null);
  return NextResponse.json(status ?? { date, status: "idle" });
}

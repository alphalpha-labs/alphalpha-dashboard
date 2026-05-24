import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";
import type { StoredThread } from "@/lib/threads";

// Vercel's KV/Upstash integration injects KV_REST_API_URL + KV_REST_API_TOKEN.
const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const itemKey = (itemId: string) => `alphalpha:threads:${itemId}`;

async function readThreads(itemId: string): Promise<StoredThread[]> {
  const data = await redis.get<StoredThread[]>(itemKey(itemId));
  return data ?? [];
}

async function writeThreads(itemId: string, threads: StoredThread[]): Promise<void> {
  await redis.set(itemKey(itemId), threads);
}

// GET /api/threads?itemId=xxx
export async function GET(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const threads = await readThreads(itemId);
  const sorted  = threads.sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ threads: sorted });
}

// POST /api/threads  body: StoredThread
export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const thread: StoredThread = await req.json().catch(() => null);
  if (!thread?.id || !thread?.itemId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const threads  = await readThreads(thread.itemId);
  const existing = threads.find(t => t.id === thread.id);
  // Preserve the original startedAt so timestamps don't drift on re-saves
  const record   = existing ? { ...thread, startedAt: existing.startedAt } : thread;
  await writeThreads(thread.itemId, [...threads.filter(t => t.id !== thread.id), record]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/threads?id=xxx&itemId=xxx
export async function DELETE(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const id     = req.nextUrl.searchParams.get("id");
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!id || !itemId) {
    return NextResponse.json({ error: "id and itemId required" }, { status: 400 });
  }

  const threads = await readThreads(itemId);
  await writeThreads(itemId, threads.filter(t => t.id !== id));

  return NextResponse.json({ ok: true });
}

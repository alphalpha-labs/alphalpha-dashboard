import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export type AlmanacKeep = {
  itemId:  string;
  genre:   string;
  title:   string;
  sub?:    string;
  keptAt:  number;
  date:    string; // YYYY-MM-DD
};

export type AlmanacTune = {
  itemId:   string;
  reaction: "more" | "less" | null;
  chips:    string[];
  note:     string;
  at:       number;
  date:     string; // YYYY-MM-DD
};

export type AlmanacFeedback = {
  keeps: Record<string, AlmanacKeep>;  // keyed by itemId
  tunes: Record<string, AlmanacTune>;  // keyed by itemId
};

const feedbackKey = (date: string) => `alphalpha:almanac:feedback:${date}`;

async function readFeedback(date: string): Promise<AlmanacFeedback> {
  const data = await redis.get<AlmanacFeedback>(feedbackKey(date));
  return data ?? { keeps: {}, tunes: {} };
}

// GET /api/almanac/feedback?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const feedback = await readFeedback(date);
  return NextResponse.json(feedback);
}

// POST /api/almanac/feedback  body: { date, type: "keep"|"tune", itemId, ...data }
export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (!body?.date || !body?.type || !body?.itemId) {
    return NextResponse.json({ error: "date, type, itemId required" }, { status: 400 });
  }

  const feedback = await readFeedback(body.date);

  if (body.type === "keep") {
    if (body.remove) {
      delete feedback.keeps[body.itemId];
    } else {
      feedback.keeps[body.itemId] = {
        itemId:  body.itemId,
        genre:   body.genre ?? "article",
        title:   body.title ?? "",
        sub:     body.sub,
        keptAt:  body.keptAt ?? Date.now(),
        date:    body.date,
      };
    }
  } else if (body.type === "tune") {
    feedback.tunes[body.itemId] = {
      itemId:   body.itemId,
      reaction: body.reaction ?? null,
      chips:    body.chips ?? [],
      note:     body.note ?? "",
      at:       body.at ?? Date.now(),
      date:     body.date,
    };
  } else {
    return NextResponse.json({ error: "type must be keep or tune" }, { status: 400 });
  }

  await redis.set(feedbackKey(body.date), feedback);
  return NextResponse.json({ ok: true });
}

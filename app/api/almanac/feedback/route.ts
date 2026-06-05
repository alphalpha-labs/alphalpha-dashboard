import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireDashboardSession } from "@/lib/auth";
import { buildAlmanacFeedbackInterpretation } from "@/lib/almanac-feedback-interpretation";

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
  interpretation?: string;
  at:       number;
  date:     string; // YYYY-MM-DD
};

export type AlmanacFeedbackHistoryItem = {
  id:       string;
  type:     "keep" | "tune";
  action?:  "added" | "removed";
  itemId:   string;
  genre:    string;
  title:    string;
  sub?:     string;
  reaction?: "more" | "less" | null;
  chips?:   string[];
  note?:    string;
  interpretation?: string;
  at:       number;
  date:     string; // YYYY-MM-DD
};

export type AlmanacFeedback = {
  keeps: Record<string, AlmanacKeep>;  // keyed by itemId
  tunes: Record<string, AlmanacTune>;  // keyed by itemId
  history?: Record<string, AlmanacFeedbackHistoryItem[]>; // keyed by itemId
};

const feedbackKey = (date: string) => `alphalpha:almanac:feedback:${date}`;

async function readFeedback(date: string): Promise<AlmanacFeedback> {
  const data = await redis.get<AlmanacFeedback>(feedbackKey(date));
  return {
    keeps: data?.keeps ?? {},
    tunes: data?.tunes ?? {},
    history: data?.history ?? {},
  };
}

function historyId(type: AlmanacFeedbackHistoryItem["type"], itemId: string, at: number) {
  return `${type}:${itemId}:${at}`;
}

function appendHistory(feedback: AlmanacFeedback, item: AlmanacFeedbackHistoryItem) {
  const history = feedback.history ?? {};
  const list = history[item.itemId] ?? [];
  feedback.history = {
    ...history,
    [item.itemId]: [item, ...list].slice(0, 24),
  };
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
    const at = body.keptAt ?? Date.now();
    if (body.remove) {
      delete feedback.keeps[body.itemId];
      appendHistory(feedback, {
        id: historyId("keep", body.itemId, at),
        type: "keep",
        action: "removed",
        itemId: body.itemId,
        genre: body.genre ?? "article",
        title: body.title ?? "",
        sub: body.sub,
        at,
        date: body.date,
      });
    } else {
      feedback.keeps[body.itemId] = {
        itemId:  body.itemId,
        genre:   body.genre ?? "article",
        title:   body.title ?? "",
        sub:     body.sub,
        keptAt:  at,
        date:    body.date,
      };
      appendHistory(feedback, {
        id: historyId("keep", body.itemId, at),
        type: "keep",
        action: "added",
        itemId: body.itemId,
        genre: body.genre ?? "article",
        title: body.title ?? "",
        sub: body.sub,
        at,
        date: body.date,
      });
    }
  } else if (body.type === "tune") {
    const at = body.at ?? Date.now();
    const genre = body.genre ?? String(body.itemId).split(/[:-]/)[0] ?? "article";
    const interpretation = buildAlmanacFeedbackInterpretation({
      genre,
      title: body.title ?? "",
      sub: body.sub,
      reaction: body.reaction ?? null,
      chips: body.chips ?? [],
      note: body.note ?? "",
    });
    feedback.tunes[body.itemId] = {
      itemId:   body.itemId,
      reaction: body.reaction ?? null,
      chips:    body.chips ?? [],
      note:     body.note ?? "",
      interpretation,
      at,
      date:     body.date,
    };
    appendHistory(feedback, {
      id: historyId("tune", body.itemId, at),
      type: "tune",
      itemId: body.itemId,
      genre,
      title: body.title ?? "",
      sub: body.sub,
      reaction: body.reaction ?? null,
      chips: body.chips ?? [],
      note: body.note ?? "",
      interpretation,
      at,
      date: body.date,
    });
  } else {
    return NextResponse.json({ error: "type must be keep or tune" }, { status: 400 });
  }

  await redis.set(feedbackKey(body.date), feedback);
  return NextResponse.json({ ok: true, feedback });
}

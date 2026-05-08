import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/auth";
import { streamThread } from "@/lib/openclaw";

export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.systemPrompt !== "string" ||
    !Array.isArray(body.messages)
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await streamThread(
      body.threadType ?? "unknown",
      body.threadId   ?? "unknown",
      body.systemPrompt,
      body.messages,
    );
  } catch (err) {
    console.error("[thread] OpenClaw unavailable:", err);
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    console.error("[thread] upstream error:", upstream.status, text);
    return NextResponse.json(
      { error: "AI unavailable", upstreamStatus: upstream.status, detail: text },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

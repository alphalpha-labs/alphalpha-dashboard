import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/auth";
import { sendSignal } from "@/lib/openclaw";

const VALID_TYPES = new Set(["done", "snooze", "skip", "wake", "add-loop", "event-feedback", "automation-action", "review-action", "investment-action", "refresh-dashboard"]);

export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.type !== "string" ||
    !VALID_TYPES.has(body.type) ||
    typeof body.itemId !== "string"
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const res = await sendSignal(
      body.type,
      body.itemId,
      body.payload ?? {},
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[signal] upstream error:", res.status, text);
      return NextResponse.json({ error: "Signal failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("[signal] OpenClaw unavailable:", err);
    return NextResponse.json({ error: "Signal unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

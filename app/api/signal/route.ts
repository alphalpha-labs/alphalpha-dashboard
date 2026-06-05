import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/auth";
import { sendSignal } from "@/lib/openclaw";

const VALID_TYPES = new Set(["done", "snooze", "skip", "wake", "add-loop", "event-feedback", "automation-action", "review-action", "investment-action", "refresh-dashboard", "almanac-regenerate", "article-save"]);

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
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("[signal] upstream error:", res.status, text);
      return NextResponse.json({ error: "Signal failed" }, { status: 502 });
    }
    const upstream = parseMaybeJson(text);
    return NextResponse.json({
      ok: true,
      type: body.type,
      itemId: body.itemId,
      acceptedAt: new Date().toISOString(),
      receipt: receiptFor(body.type, body.itemId, body.payload),
      upstream,
    });
  } catch (err) {
    console.error("[signal] OpenClaw unavailable:", err);
    return NextResponse.json({ error: "Signal unavailable" }, { status: 503 });
  }
}

function receiptFor(type: string, itemId: string, payload: unknown) {
  const p = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (type === "investment-action" && (p.action === "stage-taxonomy-decision" || p.action === "stage-manual-investing-decision")) {
    return `Decision saved for ${p.decisionPointId || itemId}: ${p.choiceId || "choice recorded"}.`;
  }
  if (type === "review-action") return `Review action ${p.action || "recorded"} accepted for ${itemId}.`;
  if (type === "automation-action") return `Automation action ${p.action || "recorded"} accepted.`;
  if (type === "refresh-dashboard") return "Refresh request accepted.";
  if (type === "almanac-regenerate") return `Almanac recrawl accepted for ${p.date || "today"}.`;
  if (type === "article-save") return `Queue + Instapaper request accepted for “${p.title || itemId}”.`;
  return `Dashboard action ${type} accepted.`;
}

function parseMaybeJson(text: string) {
  if (!text) return undefined;
  try { return JSON.parse(text); }
  catch { return { text }; }
}

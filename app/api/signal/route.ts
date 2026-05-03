import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth";

// OPENCLAW: Wire up bidirectional communication here.
//
// This route receives action signals from the dashboard and should:
//   1. Forward payload to OpenClaw's signal endpoint:
//      POST ${process.env.OPENCLAW_URL}/signal  with the action payload
//   2. OpenClaw updates the relevant context file:
//      - "done" / "snooze" / "skip" / "wake" → update OPEN_LOOPS.md or PROJECTS.md
//      - "add-loop" → prepend new item to OPEN_LOOPS.md
//   3. Optionally trigger a GitHub push to rebuild dashboard data on Vercel
//
// Payload shape the dashboard sends:
//   { type: "done" | "snooze" | "skip" | "wake" | "add-loop", itemId: string, payload?: object }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: logs the payload and returns { ok: true } immediately.

export async function POST(req: NextRequest) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  console.log("[signal stub]", body);
  return NextResponse.json({ ok: true });
}

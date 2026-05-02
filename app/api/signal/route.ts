import { NextRequest, NextResponse } from "next/server";

// OPENCLAW: Wire up bidirectional communication here.
//
// This route receives action signals from the dashboard and should:
//   1. Authenticate: check Authorization header against OPENCLAW_API_KEY env var
//   2. Forward payload to OpenClaw's signal endpoint:
//      POST ${process.env.OPENCLAW_URL}/signal  with the action payload
//   3. OpenClaw updates the relevant context file:
//      - "done" / "snooze" / "skip" / "wake" → update OPEN_LOOPS.md or PROJECTS.md
//      - "add-loop" → prepend new item to OPEN_LOOPS.md
//   4. Optionally trigger a GitHub push to rebuild dashboard data on Vercel
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
  const body = await req.json().catch(() => ({}));
  console.log("[signal stub]", body);
  return NextResponse.json({ ok: true });
}

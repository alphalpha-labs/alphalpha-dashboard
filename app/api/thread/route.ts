import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth";

// OPENCLAW: Wire up AI streaming here.
//
// This route receives thread messages and should:
//   1. Forward to OpenClaw's streaming chat endpoint:
//      POST ${process.env.OPENCLAW_URL}/chat/stream  with { systemPrompt, messages }
//   2. Pipe the streaming response back to the client as a ReadableStream:
//      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } })
//
// After switching to streaming, update ThreadDrawer.tsx at the comment
// "// OPENCLAW: Switch to streaming here" to consume chunks instead of reading the full body.
//
// Request shape the dashboard sends:
//   { systemPrompt: string, messages: Array<{ role: "user" | "assistant", content: string }> }
//
// Environment variables needed:
//   OPENCLAW_URL=http://your-vps:PORT
//   OPENCLAW_API_KEY=your-key
//
// Until wired: waits 600ms then returns a canned placeholder.

export async function POST(req: NextRequest) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await req.json().catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  return NextResponse.json({
    content: "I'm Alphalpha — your AI chief of staff. This thread will be powered by OpenClaw once connected. For now, I'm a placeholder.",
  });
}

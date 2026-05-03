# OpenClaw ↔ Alphalpha Dashboard Integration

## What this is

Alphalpha is Alex's personal AI chief-of-staff dashboard, deployed on Vercel. It reads structured context files (managed by OpenClaw) and renders them as an interactive daily brief — decisions to make, open loops to close, projects, investments, digests.

The dashboard is currently read-only. This document describes the final integration step: wiring it up so that actions Alex takes in the UI (closing a loop, snoozing a decision, chatting about an item) actually write back to the context files that OpenClaw manages, and so the AI thread drawer is powered by a real model instead of a stub.

Once wired, the loop is complete:

```
OpenClaw writes context files
        ↓
GitHub push triggers Vercel rebuild
        ↓
Alphalpha dashboard shows Alex's world
        ↓
Alex takes action (done / snooze / chat)
        ↓
Dashboard posts signal to /api/signal
        ↓
OpenClaw receives signal, updates context files
        ↓
GitHub push → Vercel rebuild → dashboard refreshes
```

---

## Authentication

Every request from OpenClaw to the dashboard uses a shared API key:

```
Authorization: Bearer <OPENCLAW_API_KEY>
```

Both API routes verify this key as their first statement before doing anything else. Requests without a valid key return `401`. The browser UI uses a separate passkey/JWT cookie flow and never touches these routes.

**Grep for the verification logic:**
```bash
grep -n "verifyApiKey" lib/auth.ts
```

---

## Route 1: POST `/api/signal`

**File:** `app/api/signal/route.ts`

**Purpose:** Receives action signals from the dashboard when Alex taps a card action. This is how Alex's UI decisions write back to the context files OpenClaw manages.

**Grep for the stub to replace:**
```bash
grep -n "OPENCLAW" app/api/signal/route.ts
```

**Payload shape the dashboard sends:**
```json
{
  "type": "done" | "snooze" | "skip" | "wake" | "add-loop",
  "itemId": "string",
  "payload": {}
}
```

**What each signal type means:**

| type | triggered when | expected OpenClaw action |
|------|---------------|--------------------------|
| `done` | Alex marks a decision or loop as complete | Remove or strike-through the item in `OPEN_LOOPS.md` or `PROJECTS.md` |
| `snooze` | Alex snoozes an item | Mark it snoozed with a wake date in the relevant context file |
| `skip` | Alex skips the current focus card | No persistent change needed — dashboard handles UI state |
| `wake` | Alex wakes a snoozed item | Remove the snooze marker, bring the item back to active |
| `add-loop` | Alex adds a new open loop from the UI | Prepend a new item to `OPEN_LOOPS.md` |

**After handling the signal,** OpenClaw should push the updated context file to GitHub so Vercel rebuilds the dashboard with the change reflected.

**Current stub behavior:** logs the payload and returns `{ "ok": true }` immediately — no file changes, no rebuild.

**Dashboard side note:** No changes are needed in the dashboard to wire this up. The signal posting is already implemented in `components/Dashboard.tsx`. When OpenClaw handles the signal properly, the dashboard will reflect the change on next rebuild.

```bash
grep -n "OPENCLAW" components/Dashboard.tsx
# → postSignal() helper — posts to /api/signal. No dashboard changes needed.
```

---

## Route 2: POST `/api/thread`

**File:** `app/api/thread/route.ts`

**Purpose:** Powers the AI thread drawer. When Alex opens a thread on any item and sends a message, the dashboard POSTs the full conversation to this route. Currently returns a canned stub response after 600ms.

**Grep for the stub to replace:**
```bash
grep -n "OPENCLAW" app/api/thread/route.ts
```

**Payload shape the dashboard sends:**
```json
{
  "systemPrompt": "string",
  "messages": [
    { "role": "user" | "assistant", "content": "string" }
  ]
}
```

The system prompt is assembled by the dashboard from the item's context fields (title, project, priority, next step, theme, stance, summary, category, whether OpenClaw manages it). It also includes today's date. See the full prompt template:

```bash
grep -n "OPENCLAW" components/ThreadDrawer.tsx
# → buildSystemPrompt() at line 8 — full prompt template shown in comments
```

**What to implement:**

Forward to OpenClaw's streaming chat endpoint and pipe the response back:

```typescript
// Inside the POST handler in app/api/thread/route.ts:
const upstream = await fetch(`${process.env.OPENCLAW_URL}/chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ systemPrompt: body.systemPrompt, messages: body.messages }),
});
return new Response(upstream.body, {
  headers: { 'Content-Type': 'text/event-stream' },
});
```

**Dashboard streaming upgrade:** Once `/api/thread` returns a `ReadableStream`, update the client side to consume chunks instead of waiting for the full response. The exact location is marked:

```bash
grep -n "Switch to streaming" components/ThreadDrawer.tsx
# → line 79: shows the streaming reader pattern to uncomment
```

**Thread persistence note:** Conversations currently reset when Alex navigates between items. Once the real AI endpoint is wired, persisting threads to `localStorage` keyed by item ID would be a nice follow-up. The location is marked:

```bash
grep -n "persist threads" components/ThreadDrawer.tsx
# → line 97: shows the localStorage pattern to implement
```

---

## Environment variables

| Var | Where | Purpose |
|-----|-------|---------|
| `OPENCLAW_API_KEY` | Both sides (OpenClaw + Vercel) | Shared secret for machine-to-machine auth |
| `OPENCLAW_URL` | Vercel env vars | Base URL of OpenClaw's HTTP server (e.g. `http://your-vps:PORT`) |
| `SESSION_SECRET` | Vercel only | Signs the browser JWT session cookies — OpenClaw never touches this |
| `PASSWORD_HASH` | Vercel only | Bcrypt hash of Alex's fallback password — OpenClaw never touches this |
| `PASSKEY_CREDENTIAL` | Vercel only | Alex's registered passkey — OpenClaw never touches this |

---

## Quick smoke test once wired

```bash
DOMAIN=https://your-vercel-domain
KEY=your-openclaw-api-key

# Signal route: no key → 401
curl -s -o /dev/null -w "%{http_code}" -X POST $DOMAIN/api/signal \
  -H "Content-Type: application/json" -d '{}'

# Signal route: correct key → 200 {"ok":true}
curl -s -w "\n" -X POST $DOMAIN/api/signal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"type":"done","itemId":"test-123"}'

# Thread route: correct key → streaming response (or stub JSON until wired)
curl -s -w "\n" -X POST $DOMAIN/api/thread \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"systemPrompt":"You are Alphalpha.","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Summary of files to touch

| File | What to do |
|------|------------|
| `app/api/signal/route.ts` | Replace stub body with real signal handling (forward to OpenClaw, trigger GitHub push) |
| `app/api/thread/route.ts` | Replace stub body with streaming proxy to `/chat/stream` |
| `components/ThreadDrawer.tsx` | Uncomment streaming reader at line 79; optionally add localStorage persistence at line 97 |

Everything else is already wired. The dashboard sends the right payloads, the auth is enforced, and the comment markers show exactly where each change goes.

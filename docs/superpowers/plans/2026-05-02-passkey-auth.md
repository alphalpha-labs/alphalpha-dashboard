# Passkey Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passkey + password-fallback authentication for the browser UI and API-key authentication for OpenClaw, using only env vars and no external auth service.

**Architecture:** Next.js edge middleware checks a signed 7-day JWT cookie on every page request; browser users authenticate via WebAuthn passkey (primary) or env-var bcrypt-hashed password (fallback); OpenClaw hits `/api/signal` and `/api/thread` with an `Authorization: Bearer` API key; all credentials live in Vercel env vars.

**Tech Stack:** `@simplewebauthn/server` + `@simplewebauthn/browser` v13, `jose` v5 (JWT, edge-safe), `bcryptjs` v3 (password hashing, Node runtime only), Next.js 15 App Router middleware.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/auth.ts` | Create | Edge-safe utilities: issue/verify JWT, read credential, verify API key, cookie header strings |
| `middleware.ts` | Create | Next.js edge middleware — check session cookie, redirect unauthenticated page requests |
| `app/api/auth/register-options/route.ts` | Create | GET — generate WebAuthn registration challenge, set challenge cookie |
| `app/api/auth/register/route.ts` | Create | POST — verify attestation, return credential JSON blob |
| `app/api/auth/login-options/route.ts` | Create | GET — generate WebAuthn authentication challenge, set challenge cookie |
| `app/api/auth/login/route.ts` | Create | POST — verify passkey OR bcrypt password, issue session cookie |
| `app/api/auth/logout/route.ts` | Create | POST — clear session cookie |
| `app/api/signal/route.ts` | Modify | Prepend `verifyApiKey` guard |
| `app/api/thread/route.ts` | Modify | Prepend `verifyApiKey` guard |
| `app/globals.css` | Modify | Append auth page CSS |
| `app/login/page.tsx` | Create | Login UI (client component — passkey button + password form) |
| `app/setup/page.tsx` | Create | Server wrapper — redirects to /login if credential already registered |
| `app/setup/SetupClient.tsx` | Create | Setup UI (client component — register passkey, display credential JSON) |
| `scripts/auth.test.ts` | Create | Unit tests for `lib/auth.ts` |
| `package.json` | Modify | Add deps + `test:auth` script |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production dependencies**

```bash
npm install @simplewebauthn/server@^13 @simplewebauthn/browser@^13 jose@^5 bcryptjs@^3
```

Expected: packages installed with no peer dependency errors. `package-lock.json` updated.

- [ ] **Step 2: Install dev dependency**

```bash
npm install --save-dev tsx@^4
```

- [ ] **Step 3: Add test:auth script to package.json**

`package.json` currently has:
```json
"scripts": {
  "generate:data": "node scripts/generate-dashboard-data.mjs",
  "dev": "npm run generate:data && next dev",
  "build": "npm run generate:data && next build",
  "start": "next start",
  "lint": "next lint"
}
```

Add `"test:auth"` (keep all existing scripts):
```json
"scripts": {
  "generate:data": "node scripts/generate-dashboard-data.mjs",
  "dev": "npm run generate:data && next dev",
  "build": "npm run generate:data && next build",
  "start": "next start",
  "lint": "next lint",
  "test:auth": "npx tsx scripts/auth.test.ts"
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install auth dependencies: simplewebauthn, jose, bcryptjs, tsx"
```

---

### Task 2: lib/auth.ts core utilities

**Files:**
- Create: `lib/auth.ts`
- Create: `scripts/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/auth.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { issueSession, verifySession, getCredential, verifyApiKey, sessionCookie, clearCookie } from '../lib/auth';

// Set env vars before calling auth functions (functions read them lazily, not at module init)
process.env.SESSION_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env.OPENCLAW_API_KEY = 'test-api-key-12345';
process.env.PASSKEY_CREDENTIAL = JSON.stringify({ id: 'cred-id-abc', publicKey: 'pubkey-xyz', counter: 0 });

function fakeReq(auth?: string): Request {
  return { headers: { get: (h: string) => (h === 'authorization' ? (auth ?? null) : null) } } as unknown as Request;
}

// verifyApiKey
assert.equal(verifyApiKey(fakeReq('Bearer test-api-key-12345')), true, 'valid API key should pass');
assert.equal(verifyApiKey(fakeReq('Bearer wrong-key')), false, 'wrong key should fail');
assert.equal(verifyApiKey(fakeReq()), false, 'missing key should fail');

// issueSession + verifySession
const token = await issueSession();
assert.equal(typeof token, 'string', 'issueSession should return string');
assert.ok(token.split('.').length === 3, 'token should be a 3-part JWT');
assert.equal(await verifySession(token), true, 'fresh token should verify');
assert.equal(await verifySession('bad.jwt.token'), false, 'invalid token should not verify');
assert.equal(await verifySession(''), false, 'empty string should not verify');

// getCredential
const cred = getCredential();
assert.deepEqual(cred, { id: 'cred-id-abc', publicKey: 'pubkey-xyz', counter: 0 }, 'getCredential should parse env var JSON');

// sessionCookie
const cookie = sessionCookie(token);
assert.ok(cookie.startsWith('session='), 'cookie should start with session=');
assert.ok(cookie.includes('HttpOnly'), 'cookie should be HttpOnly');
assert.ok(cookie.includes('SameSite=Strict'), 'cookie should have SameSite=Strict');
assert.ok(cookie.includes('Max-Age=604800'), 'cookie should have 7-day max-age');

// clearCookie
assert.ok(clearCookie.startsWith('session='), 'clearCookie should target session cookie');
assert.ok(clearCookie.includes('Max-Age=0'), 'clearCookie should expire immediately');

console.log('✓ All auth assertions passed');
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm run test:auth
```

Expected: error like `Cannot find module '../lib/auth'`

- [ ] **Step 3: Implement lib/auth.ts**

Create `lib/auth.ts`:

```typescript
import { SignJWT, jwtVerify } from 'jose';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 604800 seconds

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not set');
  return new TextEncoder().encode(s);
}

export async function issueSession(): Promise<string> {
  return new SignJWT({ sub: 'alex' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function getCredential(): { id: string; publicKey: string; counter: number } | null {
  const raw = process.env.PASSKEY_CREDENTIAL;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function verifyApiKey(req: Request): boolean {
  const key = req.headers.get('authorization')?.replace('Bearer ', '');
  return !!key && key === process.env.OPENCLAW_API_KEY;
}

export function sessionCookie(token: string): string {
  const parts = [
    `session=${token}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export const clearCookie = 'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict';
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm run test:auth
```

Expected output:
```
✓ All auth assertions passed
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts scripts/auth.test.ts package.json
git commit -m "Add lib/auth.ts utilities with passing unit tests"
```

---

### Task 3: middleware.ts

**Files:**
- Create: `middleware.ts` (project root, next to `package.json`)

- [ ] **Step 1: Create .env.local for local dev**

Create `.env.local` in the project root (already gitignored by Next.js):

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output. Then create `.env.local`:

```
SESSION_SECRET=<output from above>
OPENCLAW_API_KEY=test-key-local
PASSWORD_HASH=<generate below>
```

Generate `PASSWORD_HASH`:
```bash
node -e "require('bcryptjs').hash('testpassword', 12).then(console.log)"
```

Add to `.env.local`. This file is never committed.

- [ ] **Step 2: Create middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value ?? '';
  if (await verifySession(token)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!login|setup|api|_next/static|_next/image|favicon\\.ico).*)'],
};
```

- [ ] **Step 3: Build to check TypeScript**

```bash
npm run build
```

Expected: build completes with no TypeScript errors. (The generate:data step will fall back to existing `lib/generated-data.json` if context files are absent.)

- [ ] **Step 4: Manual redirect verification**

```bash
npm run dev
```

Open `http://localhost:3000` in browser. Expected: browser redirects to `http://localhost:3000/login` (shows 404 or blank — the redirect itself is what we're verifying).

Open browser DevTools → Network tab → confirm 307 redirect from `/` to `/login`.

Stop dev server (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "Add edge middleware to protect page routes via JWT session cookie"
```

---

### Task 4: Registration API routes

**Files:**
- Create: `app/api/auth/register-options/route.ts`
- Create: `app/api/auth/register/route.ts`

- [ ] **Step 1: Create register-options route**

Create `app/api/auth/register-options/route.ts`:

```typescript
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];

  const options = await generateRegistrationOptions({
    rpName: 'Alphalpha',
    rpID,
    userName: 'alex',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const res = NextResponse.json(options);
  res.cookies.set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });
  return res;
}
```

- [ ] **Step 2: Create register route**

Create `app/api/auth/register/route.ts`:

```typescript
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (getCredential()) {
    return NextResponse.json({ error: 'Already registered' }, { status: 409 });
  }

  const challenge = req.cookies.get('webauthn_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge missing or expired' }, { status: 400 });
  }

  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${proto}://${host}`;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: await req.json(),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const credentialJSON = JSON.stringify({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
  });

  const res = NextResponse.json({ credential: credentialJSON });
  res.cookies.set('webauthn_challenge', '', { maxAge: 0, path: '/' });
  return res;
}
```

- [ ] **Step 3: Build to check TypeScript**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 4: Smoke test register-options**

```bash
npm run dev
```

```bash
curl -s http://localhost:3000/api/auth/register-options | python3 -m json.tool | head -20
```

Expected: JSON with `challenge`, `rp`, `user`, `pubKeyCredParams` fields.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/register-options/route.ts app/api/auth/register/route.ts
git commit -m "Add WebAuthn registration API routes"
```

---

### Task 5: Login and logout API routes

**Files:**
- Create: `app/api/auth/login-options/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Create login-options route**

Create `app/api/auth/login-options/route.ts`:

```typescript
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const storedCredential = getCredential();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    ...(storedCredential
      ? { allowCredentials: [{ id: storedCredential.id, type: 'public-key' }] }
      : {}),
  });

  const res = NextResponse.json(options);
  res.cookies.set('webauthn_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });
  return res;
}
```

- [ ] **Step 2: Create login route**

Create `app/api/auth/login/route.ts`:

```typescript
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCredential, issueSession, sessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Password fallback path — triggered when request body has a "password" key
  if ('password' in body) {
    const hash = process.env.PASSWORD_HASH;
    if (!hash) {
      return NextResponse.json({ error: 'No password configured' }, { status: 401 });
    }
    const valid = await bcrypt.compare(body.password as string, hash);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
    const token = await issueSession();
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', sessionCookie(token));
    return res;
  }

  // Passkey path — request body is a WebAuthn AuthenticationResponseJSON
  const storedCredential = getCredential();
  if (!storedCredential) {
    return NextResponse.json({ error: 'No passkey registered' }, { status: 401 });
  }

  const challenge = req.cookies.get('webauthn_challenge')?.value;
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge missing or expired' }, { status: 400 });
  }

  const host = req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = `${proto}://${host}`;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.id,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: storedCredential.counter,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 401 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 401 });
  }

  const token = await issueSession();
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', sessionCookie(token));
  // Clear the challenge cookie
  res.headers.append('Set-Cookie', 'webauthn_challenge=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  return res;
}
```

- [ ] **Step 3: Create logout route**

Create `app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { clearCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearCookie);
  return res;
}
```

- [ ] **Step 4: Build to check TypeScript**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 5: Smoke test password login**

```bash
npm run dev
```

Replace `YOUR_PASSWORD_HASH` with the hash from your `.env.local`. Test password login via curl (use the actual password you set in `.env.local`):

```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"testpassword"}'
```

Expected: response body `{"ok":true}` with HTTP status `200`, and `Set-Cookie` header in the response.

Test wrong password:
```bash
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}'
```

Expected: `{"error":"Incorrect password"}` with HTTP status `401`.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/login-options/route.ts app/api/auth/login/route.ts app/api/auth/logout/route.ts
git commit -m "Add login-options, login, and logout API routes"
```

---

### Task 6: API key guard on signal and thread routes

**Files:**
- Modify: `app/api/signal/route.ts`
- Modify: `app/api/thread/route.ts`

- [ ] **Step 1: Rewrite signal route with API key guard**

Replace the entire contents of `app/api/signal/route.ts` with:

```typescript
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
```

- [ ] **Step 2: Rewrite thread route with API key guard**

Replace the entire contents of `app/api/thread/route.ts` with:

```typescript
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
```

- [ ] **Step 3: Manual API key verification**

```bash
npm run dev
```

Test without key (expect 401):
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/signal \
  -H "Content-Type: application/json" -d '{}'
```
Expected: `401`

Test with correct key (expect 200):
```bash
curl -s -w "\n" -X POST http://localhost:3000/api/signal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key-local" \
  -d '{"type":"test"}'
```
Expected: `{"ok":true}`

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/api/signal/route.ts app/api/thread/route.ts
git commit -m "Add API key guard to signal and thread routes"
```

---

### Task 7: Auth page CSS

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append auth styles**

Open `app/globals.css`. The file currently ends at line 403 (closing `}` of the `@media` block). Append the following after that closing brace:

```css

/* === Auth pages (login, setup) === */
.authPage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg);
}
.authCard {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-card);
  padding: 48px 40px;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.authTitle {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
}
.authSubtitle {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  font-size: 15px;
  color: var(--ink-muted);
  margin: 4px 0 0;
}
.authBtn {
  width: 100%;
  padding: 12px 20px;
  border-radius: var(--radius-btn);
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.authBtn:disabled { opacity: 0.5; cursor: not-allowed; }
.authBtn--primary {
  background: var(--accent-high);
  color: #fff;
}
.authBtn--primary:hover:not(:disabled) { opacity: 0.88; }
.authBtn--secondary {
  background: transparent;
  color: var(--ink);
  border: 1.5px solid var(--border-strong);
}
.authBtn--secondary:hover:not(:disabled) { background: var(--bg-side); }
.authDivider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ink-muted);
  font-size: 13px;
}
.authDivider::before,
.authDivider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.authInput {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-btn);
  background: var(--card);
  color: var(--ink);
  font-size: 15px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
  box-sizing: border-box;
}
.authInput:focus { border-color: var(--ink); }
.authError {
  font-family: 'Lora', Georgia, serif;
  font-style: italic;
  font-size: 13px;
  color: var(--accent-high);
  margin: 0;
}
.authCredentialBox {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: var(--bg-side);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  word-break: break-all;
  user-select: all;
  cursor: text;
  line-height: 1.5;
}
.authInstructions {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.6;
  margin: 0;
}
.authInstructions code {
  font-family: 'Courier New', monospace;
  background: var(--bg-side);
  padding: 1px 4px;
  border-radius: 3px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "Add auth page CSS (login card, passkey button, form styles)"
```

---

### Task 8: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `app/login/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasskey() {
    setError('');
    setLoading(true);
    try {
      const optRes = await fetch('/api/auth/login-options');
      if (!optRes.ok) throw new Error('options failed');
      const options = await optRes.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (verifyRes.ok) {
        window.location.href = '/';
      } else {
        setError('Passkey failed — try your password');
      }
    } catch {
      setError('Passkey failed — try your password');
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Incorrect password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div>
          <h1 className="authTitle">Alphalpha</h1>
          <p className="authSubtitle">Chief of Staff</p>
        </div>
        <button
          className="authBtn authBtn--primary"
          onClick={handlePasskey}
          disabled={loading}
        >
          Sign in with Passkey
        </button>
        <div className="authDivider">or</div>
        <form
          onSubmit={handlePassword}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <input
            type="password"
            className="authInput"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="authBtn authBtn--secondary"
            disabled={loading || !password}
          >
            Sign in
          </button>
        </form>
        {error && <p className="authError">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to check TypeScript**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```

Navigate to `http://localhost:3000/login`. Verify:
- Parchment background (`#f4efe4`), centered card
- "Alphalpha" in Playfair Display, "Chief of Staff" italic below
- Red "Sign in with Passkey" button (full width)
- "or" divider with horizontal rules
- Password input + "Sign in" button below
- No JS console errors

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "Add login page with passkey button and password fallback"
```

---

### Task 9: Setup page

**Files:**
- Create: `app/setup/page.tsx`
- Create: `app/setup/SetupClient.tsx`

- [ ] **Step 1: Create setup server page**

Create `app/setup/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import SetupClient from './SetupClient';

export default function SetupPage() {
  if (process.env.PASSKEY_CREDENTIAL) {
    redirect('/login');
  }
  return <SetupClient />;
}
```

- [ ] **Step 2: Create setup client component**

Create `app/setup/SetupClient.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export default function SetupClient() {
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      const optRes = await fetch('/api/auth/register-options');
      if (!optRes.ok) throw new Error('options failed');
      const options = await optRes.json();
      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      const data = await verifyRes.json();
      if (verifyRes.ok) {
        setCredential(data.credential);
      } else {
        setError(data.error ?? 'Registration failed');
      }
    } catch {
      setError('Registration failed — try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(credential);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <div>
          <h1 className="authTitle">Register Passkey</h1>
          <p className="authSubtitle">One-time setup for your authenticator.</p>
        </div>
        {!credential ? (
          <button
            className="authBtn authBtn--primary"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Registering…' : 'Register with Passkey'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="authInstructions">
              Copy this JSON and paste it into Vercel as{' '}
              <code>PASSKEY_CREDENTIAL</code>, then redeploy and navigate to /login.
            </p>
            <div className="authCredentialBox">{credential}</div>
            <button className="authBtn authBtn--secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        )}
        {error && <p className="authError">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build to check TypeScript**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 4: Visual verification**

```bash
npm run dev
```

Navigate to `http://localhost:3000/setup`. Verify:
- "Register Passkey" heading, subtitle
- "Register with Passkey" red button
- Consistent parchment styling matching login page
- No JS console errors

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/setup/page.tsx app/setup/SetupClient.tsx
git commit -m "Add setup page for one-time passkey registration"
```

---

### Task 10: Push and end-to-end verification

**Files:** none (git + Vercel operations)

- [ ] **Step 1: Push to remote**

```bash
git push origin HEAD:main
```

- [ ] **Step 2: Set Vercel env vars**

In the Vercel dashboard for this project (Environment Variables tab), add:

| Name | Value |
|------|-------|
| `SESSION_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PASSWORD_HASH` | output of `node -e "require('bcryptjs').hash('YOUR_ACTUAL_PASSWORD', 12).then(console.log)"` |
| `PASSKEY_CREDENTIAL` | *(leave empty for now — set after running /setup)* |

Trigger a Vercel redeploy after setting the vars.

- [ ] **Step 3: Run through the full setup flow**

1. Navigate to `https://your-vercel-domain/` — verify redirect to `/login`
2. Navigate to `/setup` — verify registration UI appears
3. Click "Register with Passkey" — follow browser/device authenticator prompt
4. After registration, copy the displayed JSON blob
5. In Vercel dashboard, set `PASSKEY_CREDENTIAL` to the copied JSON
6. Trigger redeploy (Vercel auto-redeploys on env var change, or use CLI: `vercel --prod`)

- [ ] **Step 4: Verify full auth flow**

After redeploy:

1. `/setup` → should redirect to `/login` (credential now set)
2. `/login` → click "Sign in with Passkey" → authenticator prompt → success → redirected to dashboard
3. Verify dashboard loads fully (all tabs work)
4. Test logout: open browser console, run `fetch('/api/auth/logout', { method: 'POST' })` → navigate to `/` → redirected to `/login`
5. `/login` → enter password → success → redirected to dashboard

- [ ] **Step 5: Verify OpenClaw API key gate**

From any machine with `curl`:

```bash
# No key → 401
curl -s -o /dev/null -w "%{http_code}" -X POST https://your-vercel-domain/api/signal \
  -H "Content-Type: application/json" -d '{}'

# Correct key → 200
curl -s -w "\n" -X POST https://your-vercel-domain/api/signal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENCLAW_API_KEY" \
  -d '{"type":"test"}'
```

Expected: `401` then `{"ok":true}`

# Passkey Authentication — Design Spec

**Date:** 2026-05-02
**Status:** Approved

---

## Goal

Add passkey-based authentication to the Alphalpha dashboard so that only Alex can access the UI, while OpenClaw retains full access to API routes via an API key. No external auth service, no database.

---

## Architecture

Two auth paths, zero external services:

```
Browser user                OpenClaw machine
     │                            │
     ▼                            ▼
Passkey / password         OPENCLAW_API_KEY header
     │                            │
     ▼                            ▼
Signed JWT cookie       ──── API routes only ────
     │
     ▼
Next.js middleware
 (checks cookie on every page request)
     │
     ├─ valid → serve page
     └─ invalid → redirect /login
```

**Middleware** runs on every request except `/login`, `/setup`, and `/api/*`. It reads the `session` cookie, verifies the JWT signature using `SESSION_SECRET`, and redirects to `/login` on failure.

**API routes** (`/api/signal`, `/api/thread`) skip the cookie check entirely — they gate on `Authorization: Bearer <OPENCLAW_API_KEY>`. Middleware excludes `/api/*` so cookie auth never fires on these routes.

**Session** is a signed JWT (HS256 via `jose`) with 7-day expiry, stored as an HttpOnly, Secure, SameSite=Strict cookie named `session`. No refresh logic needed for a single-user personal tool.

---

## New Files & Routes

```
app/
  login/
    page.tsx                        # Login UI — passkey button + password fallback
  setup/
    page.tsx                        # One-time registration page
  api/
    auth/
      register-options/route.ts     # GET  — WebAuthn registration challenge
      register/route.ts             # POST — verify + return credential JSON
      login-options/route.ts        # GET  — WebAuthn authentication challenge
      login/route.ts                # POST — verify passkey OR password, issue JWT cookie
      logout/route.ts               # POST — clear session cookie
middleware.ts                       # Edge middleware — protect all page routes
lib/
  auth.ts                           # verifySession(), issueSession(), getCredential(), verifyPassword(), verifyApiKey()
```

No new UI components beyond the two pages. All crypto lives in `lib/auth.ts`.

---

## Credential & Session Storage

Four env vars managed in Vercel dashboard:

| Var | Content | When to set |
|-----|---------|-------------|
| `PASSKEY_CREDENTIAL` | JSON blob `{"id":"…","publicKey":"…","counter":0}` | After running `/setup` |
| `PASSWORD_HASH` | bcrypt hash of fallback password (cost factor 12) | Before first deploy |
| `SESSION_SECRET` | 32-byte random hex string | Before first deploy |
| `OPENCLAW_API_KEY` | Already in use by API route stubs | Already set |

**Counter tradeoff:** WebAuthn counters are stored as `0` and never validated. Since env vars can't be updated at runtime in Vercel, and the threat model for a personal dashboard doesn't include cloned authenticators, this is acceptable.

**Generating `PASSWORD_HASH`:**
```bash
node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"
```
Paste the output into Vercel. Never commit to the repo.

**Generating `SESSION_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Login UI

Centered card on parchment background (`--bg: #f4efe4`). No username field (single resident-key passkey).

Layout:
- Playfair Display heading: "Alphalpha"
- Lora italic subheading: "Chief of Staff"
- Primary button (`--accent-high` background): "Sign in with Passkey" — calls `startAuthentication()` from `@simplewebauthn/browser` on click
- Divider "or"
- Password input + "Sign in" button (always visible, no toggle)
- Error area below buttons (Lora italic, `--accent-high` color)
  - Passkey failure: "Passkey failed — try your password"
  - Wrong password: "Incorrect password"

No "remember me" toggle — the 7-day JWT handles persistence. No link to `/setup` in the UI; accessed by direct navigation only.

---

## Setup Flow

Accessed by navigating to `/setup` directly.

**Guards:**
- If `PASSKEY_CREDENTIAL` env var is populated → redirect to `/login` immediately (prevents re-registration without explicit env var clearance)
- If not populated → show registration UI

**Registration steps:**
1. Page loads, shows "Register Passkey" heading and a single "Register with Passkey" button
2. Button calls `startRegistration()` from `@simplewebauthn/browser`
3. Client POSTs attestation response to `/api/auth/register`
4. Server verifies with `@simplewebauthn/server`, returns credential JSON
5. Page displays the JSON blob in a monospace selectable box with a "Copy to clipboard" button
6. Instructions: "Paste this into Vercel as PASSKEY_CREDENTIAL, then redeploy and navigate to /login"

The credential JSON is never stored server-side — it's displayed once and Alex pastes it into Vercel env vars manually.

---

## OpenClaw API Key Enforcement

`lib/auth.ts` exports:

```typescript
export function verifyApiKey(req: Request): boolean {
  const key = req.headers.get('authorization')?.replace('Bearer ', '');
  return !!key && key === process.env.OPENCLAW_API_KEY;
}
```

Both `/api/signal` and `/api/thread` call `verifyApiKey(request)` as their first statement and return `401` immediately on failure. The existing `// OPENCLAW:` comment stubs remain untouched beyond prepending this guard.

OpenClaw sends `Authorization: Bearer <OPENCLAW_API_KEY>` on every API call.

---

## Dependencies

```
@simplewebauthn/server    ^13.x   (server-side WebAuthn)
@simplewebauthn/browser   ^13.x   (client-side WebAuthn, browser only)
jose                      ^5.x    (JWT sign/verify, already available in edge runtime)
bcryptjs                  ^3.x    (password hashing — Node runtime only, not edge)
```

`jose` runs in the edge runtime (middleware). `bcryptjs` runs in the Node runtime (API routes). The login API route must therefore use `export const runtime = 'nodejs'`.

---

## Security Notes

- Session cookie: HttpOnly, Secure, SameSite=Strict, 7-day max-age
- `/setup` is self-protecting: once `PASSKEY_CREDENTIAL` is set, the route redirects away
- Middleware runs before any page render — no page content leaks to unauthenticated requests
- API routes are excluded from middleware to avoid cookie overhead on machine-to-machine calls
- `SESSION_SECRET` rotation invalidates all active sessions (acceptable for single user)
- No CSRF token needed: state-changing API routes check the API key, not the cookie

---

## Out of Scope

- Multi-device passkey support (single credential only)
- Session refresh / sliding expiry
- Rate limiting on `/api/auth/login` (acceptable for personal tool)
- Audit logging

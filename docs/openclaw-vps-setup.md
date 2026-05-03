# OpenClaw VPS Setup — Connecting Vercel to Docker on a VPS

The flow is:

```
Browser (Vercel) → /api/thread or /api/signal
                  → VPS public IP/domain (Docker port mapping)
                  → OpenClaw container
```

---

## Step 1 — Expose OpenClaw's port on the VPS

OpenClaw is a process inside a Docker container. Vercel can only reach it if the VPS host is listening on a public port.

**Find out what port OpenClaw listens on inside the container:**
```bash
docker inspect <container-name> | grep -A5 '"Ports"'
# or
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**If the port isn't already mapped to the host, re-run with `-p`:**
```bash
docker run -p 8765:8765 ... your-openclaw-image
# or in docker-compose.yml:
ports:
  - "8765:8765"
```

**Open that port in the VPS firewall** (example for ufw):
```bash
ufw allow 8765/tcp
```

**Verify from your laptop:**
```bash
curl http://<vps-ip>:8765/health   # or whatever health endpoint OpenClaw exposes
```

---

## Environment variables

### `OPENCLAW_BASE_URL`

**Value:** `http://<vps-public-ip>:<port>` or `https://<your-domain>` if you have a reverse proxy in front.

**How to find your VPS public IP:**
```bash
# on the VPS:
curl -s ifconfig.me
# or
hostname -I | awk '{print $1}'
```

**Example:**
```
OPENCLAW_BASE_URL=http://123.45.67.89:8765
```

> **Strongly recommended:** Put nginx or Caddy in front so you get HTTPS. Vercel → plain HTTP over the public internet means tokens travel unencrypted. With Caddy it's one line:
> ```
> openclaw.yourdomain.com {
>   reverse_proxy localhost:8765
> }
> ```
> Then: `OPENCLAW_BASE_URL=https://openclaw.yourdomain.com`

---

### `OPENCLAW_GATEWAY_TOKEN`

**What it is:** The bearer token OpenClaw requires on incoming requests to `/v1/responses`.

**How to find/set it:** OpenClaw almost certainly reads this from its own environment. Look at how you currently start the container:

```bash
docker inspect <container-name> | grep -i "token\|key\|secret\|auth"
# or look at your docker-compose.yml / run script for -e flags
```

If OpenClaw uses a specific env var name (e.g. `API_KEY`, `GATEWAY_TOKEN`), the value you set there is what you paste into Vercel as `OPENCLAW_GATEWAY_TOKEN`.

**If you need to set it for the first time**, add it to the container and to Vercel with the same random secret:
```bash
openssl rand -hex 32   # generate a token — use this value for both sides
```

```yaml
# docker-compose.yml
environment:
  - GATEWAY_TOKEN=<the-value-you-generated>
```

```
# Vercel env var
OPENCLAW_GATEWAY_TOKEN=<the-same-value>
```

---

### `OPENCLAW_SIGNAL_URL`

**What it is:** The full URL the dashboard `POST`s action signals to.

**Value:** Append the hook path to your base URL:
```
OPENCLAW_SIGNAL_URL=http://123.45.67.89:8765/hooks/dashboard-signal
```

The path `/hooks/dashboard-signal` is what the dashboard sends to — OpenClaw needs to register a handler at that path. If OpenClaw already uses a different path, use that instead.

---

### `OPENCLAW_HOOK_TOKEN`

**What it is:** The bearer token OpenClaw checks on incoming signal/hook requests.

This can be the same value as `OPENCLAW_GATEWAY_TOKEN` (one shared secret) or a separate one if OpenClaw distinguishes between its chat gateway and its webhook receiver. Check your OpenClaw config to see if it expects the same or separate token for hook endpoints.

If separate, generate another one the same way:
```bash
openssl rand -hex 32
```

Set it in the container env and in Vercel with the same value.

---

## Step 2 — Add all four to Vercel

In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Name | Example value |
|------|---------------|
| `OPENCLAW_BASE_URL` | `https://openclaw.yourdomain.com` |
| `OPENCLAW_GATEWAY_TOKEN` | `a3f9c2...` (32-byte hex) |
| `OPENCLAW_SIGNAL_URL` | `https://openclaw.yourdomain.com/hooks/dashboard-signal` |
| `OPENCLAW_HOOK_TOKEN` | `b7e1d4...` (32-byte hex, same or different) |

Set scope to **Production** (and Preview if you want to test on preview deploys). Then redeploy once so Vercel picks them up.

---

## Step 3 — Smoke test end-to-end from the VPS

Before touching the browser, confirm the port is reachable and the token works:

```bash
# From the VPS itself first (sanity check):
curl -s -X POST http://localhost:8765/v1/responses \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"instructions":"ping","input":[{"type":"message","role":"user","content":"hi"}],"stream":false}'

# Then confirm the port is reachable externally (from your laptop):
curl -s -X POST http://<vps-ip>:8765/v1/responses \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"instructions":"ping","input":[{"type":"message","role":"user","content":"hi"}],"stream":false}'
```

If you get a response from the second command, Vercel will too.

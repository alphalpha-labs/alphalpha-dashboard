# Alphalpha Dashboard

Chief-of-staff dashboard for Alphalpha: open loops, active projects, investing research candidates, synthesis digests, and the daily Almanac edition.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Designed for Vercel. Once `VERCEL_TOKEN` and `VERCEL_TEAM_ID` are available, deploy under the `alphalpha-labs` team.

## Daily Almanac

The Almanac tab shows a curated daily edition — quotes, article pick, look/image, venture, surprise, and charts.

### Generator

```bash
node scripts/generate-almanac.mjs --date=YYYY-MM-DD   # generate for a specific date
node scripts/generate-almanac.mjs --dry-run            # preview without writing to KV
```

The cron descriptor lives in `scripts/almanac-automation.json` (runs at 5 am CT for the next day's edition).

### Required environment variables

| Variable | Required | Description |
|---|---|---|
| `KV_REST_API_URL` | Yes | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Yes | Upstash Redis REST token |
| `OPENCLAW_BASE_URL` | Yes | OpenClaw proxy base URL (LLM calls) |
| `OPENCLAW_GATEWAY_TOKEN` | Yes | Bearer token for OpenClaw |
| `ALMANAC_COMPOSER_MODEL` | No | Claude model for tile composition (default: `claude-haiku-4-5-20251001`) |
| `ALPHALPHA_CONTEXT_DIR` | No | Path to workspace context files for Surprise + You-chart sourcing |

All env vars are also used at runtime by the API routes (`/api/almanac/*`). Set them in Vercel project settings or a local `.env.local` file.

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

#### Web discovery (optional — feedback-honed daily crawl)

Every tile can source fresh material from the web each day, honed by your Keep/Tune
feedback. The provider is pluggable; the first one with a key set wins, otherwise the
generator falls back to its curated/RSS/workspace sources (so nothing breaks when
none are set). See `docs/almanac-sourcing.md` for the full design.

| Variable | Required | Description |
|---|---|---|
| `TAVILY_API_KEY` | No | Use Tavily as the search backend (preferred) |
| `EXA_API_KEY` | No | Use Exa as the search backend |
| `BRAVE_SEARCH_API_KEY` | No | Use Brave Search as the backend |
| `SERPER_API_KEY` | No | Use Serper (Google) as the backend |
| `ALMANAC_SEARCH_PROVIDER` | No | Force a provider: `tavily` \| `exa` \| `brave` \| `serper` \| `openclaw` |
| `ALMANAC_SEARCH_MAX` | No | Max web searches per daily run (default 12) |
| `ALMANAC_FETCH_MAX` | No | Max page fetches per daily run (default 8) |
| `ALMANAC_DISABLE_WEB` | No | Set to `1` to force curated-only (no web calls) |

If no dedicated key is set but the OpenClaw gateway is configured, the generator
attempts the model's own `web_search` tool (`openclaw` provider). Wikimedia Commons
image discovery is zero-key and runs unless `ALMANAC_DISABLE_WEB=1`.

All env vars are also used at runtime by the API routes (`/api/almanac/*`). Set them in Vercel project settings or a local `.env.local` file.

# Alphalpha Dashboard

Chief-of-staff dashboard for Alphalpha: open loops, active projects, investing research candidates, and synthesis digests.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Designed for Vercel. Once `VERCEL_TOKEN` and `VERCEL_TEAM_SLUG=alphalpha-labs` are available to OpenClaw, link/deploy this repo under the `alphalpha-labs` Vercel team.

## Data sources

Phase 1 uses typed seed data in `lib/data.ts`. Phase 2 should load from Obsidian/GitHub files and Thesis Baskets read-only views.

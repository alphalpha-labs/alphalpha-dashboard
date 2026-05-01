export type Priority = "urgent" | "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type ProjectStatus = "active" | "blocked" | "waiting" | "shaping";

export const generatedAt = "2026-05-01T13:30:00Z";

export const metrics = [
  { label: "Open loops", value: "18", detail: "6 need review", tone: "amber" },
  { label: "Blocked", value: "3", detail: "waiting on access/merge", tone: "red" },
  { label: "Due this week", value: "7", detail: "2 recurring audits", tone: "blue" },
  { label: "Stale >14d", value: "4", detail: "needs prune or owner", tone: "amber" },
  { label: "Investing signals", value: "15", detail: "candidate tickers saved", tone: "purple" },
];

export const attentionQueue = [
  {
    title: "Add Vercel deploy credentials",
    reason: "Required before Alphalpha can deploy dashboard/apps independently.",
    priority: "urgent" as Priority,
    age: "today",
    confidence: "high" as Confidence,
    action: "Add VERCEL_TOKEN and VERCEL_TEAM_SLUG to OpenClaw host env, then restart gateway.",
  },
  {
    title: "Promote investing research candidates into a durable watchlist",
    reason: "Alternative tickers should not be lost while DB write access remains intentionally read-only.",
    priority: "high" as Priority,
    age: "today",
    confidence: "high" as Confidence,
    action: "Create Obsidian-backed Alphalpha research watchlist, then later sync to thesis-baskets if write path is approved.",
  },
  {
    title: "Resolve thesis-baskets autonomous write safety",
    reason: "Main branch protection on private personal repo needs GitHub Pro/org/ruleset alternative.",
    priority: "medium" as Priority,
    age: "2d",
    confidence: "medium" as Confidence,
    action: "Pick safety model: GitHub Pro, org migration, rulesets, or softer PR discipline.",
  },
  {
    title: "Wire Obsidian as primary knowledge surface",
    reason: "PR-based writes work, but direct vault workflows and dashboard data extraction are still incomplete.",
    priority: "medium" as Priority,
    age: "ongoing",
    confidence: "medium" as Confidence,
    action: "Define first file-backed data contract under Alphalpha/ for dashboard ingestion.",
  },
];

export const projects = [
  {
    name: "Chief-of-Staff Dashboard",
    domain: "Agentic OS",
    status: "active" as ProjectStatus,
    lastActivity: "today",
    nextAction: "Ship first Next.js/Vercel-ready dashboard app in alphalpha-labs.",
    blocker: "Vercel token pending",
    source: "OpenClaw workspace + alphalpha-os",
  },
  {
    name: "Thesis Baskets ingestion",
    domain: "Investing",
    status: "active" as ProjectStatus,
    lastActivity: "yesterday",
    nextAction: "Use selected synthesis artifacts in future digests and surface contradiction alerts.",
    blocker: null,
    source: "Supabase read-only views + Obsidian PRs",
  },
  {
    name: "Obsidian Knowledge Surface",
    domain: "Knowledge management",
    status: "waiting" as ProjectStatus,
    lastActivity: "this week",
    nextAction: "Create Alphalpha/Investing/Research Watchlist.md and dashboard data summaries.",
    blocker: "Direct write workflow not finalized",
    source: "adonesky1/obsidian-vault",
  },
  {
    name: "Agentic OS Interview + Audits",
    domain: "Operating system",
    status: "active" as ProjectStatus,
    lastActivity: "this week",
    nextAction: "Continue one-question cadence and Monday executive brief.",
    blocker: null,
    source: "context/agentic-os-survey.md",
  },
];

export const openLoops = [
  { item: "Add Vercel token/team slug to OpenClaw", owner: "Alex", due: "Today", priority: "urgent" as Priority, next: "Restart gateway and let Alphalpha verify." },
  { item: "Research watchlist persistence", owner: "Alphalpha", due: "This week", priority: "high" as Priority, next: "Create Obsidian candidate watchlist." },
  { item: "Vercel dashboard repo", owner: "Alphalpha", due: "Today", priority: "high" as Priority, next: "Push scaffold to alphalpha-labs." },
  { item: "Thesis-baskets write access design", owner: "Alex + Alphalpha", due: "Later", priority: "medium" as Priority, next: "Define scoped write role/API after dashboard MVP." },
  { item: "ChatGPT/Claude brain dump flow", owner: "Alex", due: "Later", priority: "low" as Priority, next: "Export/paste summaries when ready." },
];

export const investingCandidates = [
  { ticker: "EME", theme: "Grid/data-center construction", stance: "Research first", confidence: "high" as Confidence, trigger: "Pullback or valuation check vs backlog growth", contradiction: "Cyclical construction slowdown." },
  { ticker: "PWR", theme: "Transmission/grid hardening", stance: "High-quality candidate", confidence: "high" as Confidence, trigger: "Entry on de-rating; compare to EME/FIX", contradiction: "Premium valuation already discounts bottleneck." },
  { ticker: "BWXT", theme: "Nuclear services + defense nuclear", stance: "High-conviction research", confidence: "high" as Confidence, trigger: "Confirm backlog/valuation durability", contradiction: "Quality premium and project concentration." },
  { ticker: "CIEN", theme: "AI optical/network bandwidth", stance: "Underfollowed AI derivative", confidence: "medium" as Confidence, trigger: "Evidence AI/data-center demand offsets telecom cyclicality", contradiction: "Demand timing can be lumpy." },
  { ticker: "DHR", theme: "Boring quality / healthcare tools", stance: "Diversifier", confidence: "medium" as Confidence, trigger: "Life-science funding cycle recovery", contradiction: "Recovery may be slow." },
  { ticker: "KTOS", theme: "Defense modernization / drones", stance: "Higher upside, higher volatility", confidence: "medium" as Confidence, trigger: "Contract momentum and margin path", contradiction: "Speculative valuation and execution risk." },
];

export const digests = [
  {
    title: "Macro regime still favors hard assets, but liquidity fragility caps upside",
    source: "Thesis Baskets synthesis",
    date: "2026-04-26",
    summary: "Energy, power, nuclear, defense, and selected real assets remain supported, but China stress, dollar funding, and pricing saturation weaken the clean scarcity narrative.",
    tags: ["macro", "hard assets", "liquidity", "contradictions"],
  },
  {
    title: "Selected synthesis artifacts now included",
    source: "Thesis Baskets ingestion",
    date: "2026-04-30",
    summary: "Digest flow now includes selected AI-generated artifacts while excluding raw prompt artifacts by default.",
    tags: ["pipeline", "obsidian", "investing"],
  },
  {
    title: "Dashboard + deployment layer",
    source: "Agentic OS",
    date: "2026-05-01",
    summary: "Visual command center should become the primary surface for open loops, project state, investing candidates, and source health.",
    tags: ["dashboard", "vercel", "chief-of-staff"],
  },
];

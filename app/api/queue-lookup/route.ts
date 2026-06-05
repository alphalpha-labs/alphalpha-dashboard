import { NextRequest, NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/auth";
import { completeJson } from "@/lib/openclaw";

const VALID_KINDS = new Set(["books", "shows", "movies"]);

type QueueLookupSuggestion = {
  title: string;
  creator: string;
  year?: string | null;
  status: string;
  priority: string;
  why: string;
  link?: string | null;
  sourceLabel?: string | null;
  notes?: string | null;
  confidence: "high" | "medium" | "low";
};

export async function POST(req: NextRequest) {
  const authError = await requireDashboardSession(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind ?? "").toLowerCase();
  const query = String(body?.query ?? "").trim();
  if (!VALID_KINDS.has(kind) || query.length < 2) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const raw = await completeJson(
      lookupInstructions(kind),
      `Look up this ${kind.slice(0, -1)} queue candidate: ${query}`,
      `dashboard:queue-lookup:${kind}`,
      { timeoutMs: 55_000 },
    );
    const suggestions = normalizeSuggestions(raw);
    return NextResponse.json({ ok: true, kind, query, suggestions });
  } catch (err) {
    console.error("[queue-lookup] failed:", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}

function lookupInstructions(kind: string) {
  const shape = `{"suggestions":[{"title":"string","creator":"string","year":"string|null","status":"To consider","priority":"High|Medium|Low","why":"one sentence fit rationale","link":"https://...|null","sourceLabel":"Official|IMDb|Publisher|...","notes":"short useful metadata","confidence":"high|medium|low"}]}`;
  const label = kind === "books" ? "book" : kind === "shows" ? "TV/streaming show" : "movie";
  return `You help maintain Alex's personal ${kind} queue. Use web search if needed to identify likely ${label} matches.
Return ONLY valid JSON matching ${shape}.
Give 1-3 suggestions, ordered by confidence. Use real public links only, preferably official, publisher, IMDb, Letterboxd, JustWatch, network/streamer, or serious review pages.
For books, creator is the author. For shows, creator is creator/network when known. For movies, creator is the director.
The why field should explain why it may fit Alex's queue, not a plot summary. Preserve ambiguity with low confidence rather than guessing.`;
}

function normalizeSuggestions(raw: unknown): QueueLookupSuggestion[] {
  const obj = raw as { suggestions?: unknown };
  const arr = Array.isArray(obj?.suggestions) ? obj.suggestions : Array.isArray(raw) ? raw : [];
  return arr
    .map(item => normalizeSuggestion(item))
    .filter((item): item is QueueLookupSuggestion => !!item)
    .slice(0, 3);
}

function normalizeSuggestion(raw: unknown): QueueLookupSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const title = clean(item.title);
  if (!title) return null;
  const link = clean(item.link);
  return {
    title,
    creator: clean(item.creator) || "Unknown",
    year: clean(item.year) || null,
    status: clean(item.status) || "To consider",
    priority: normalizePriority(clean(item.priority)),
    why: clean(item.why) || "Looks like a plausible queue candidate worth triaging.",
    link: link && /^https?:\/\//.test(link) ? link : null,
    sourceLabel: clean(item.sourceLabel) || null,
    notes: clean(item.notes) || null,
    confidence: normalizeConfidence(clean(item.confidence)),
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 600) : "";
}

function normalizePriority(value: string) {
  const lower = value.toLowerCase();
  if (lower.startsWith("high")) return "High";
  if (lower.startsWith("low")) return "Low";
  return "Medium";
}

function normalizeConfidence(value: string): QueueLookupSuggestion["confidence"] {
  const lower = value.toLowerCase();
  if (lower.startsWith("high")) return "high";
  if (lower.startsWith("low")) return "low";
  return "medium";
}

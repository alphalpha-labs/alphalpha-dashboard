"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { DailyData, DailyVenture, DailyRiff, DailyProductionClip, DailyPoem, DailyLongRead, DailyAustinExplore } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import { almanacEditionNumber, almanacIsoForOffset, daysSinceAlmanacEpoch, localDateFromIso } from "@/lib/almanac-date";
import { buildAlmanacFeedbackInterpretation } from "@/lib/almanac-feedback-interpretation";
import longReadDataset from "@/lib/almanac-datasets/long-reads.json";
import austinExploreDataset from "@/lib/almanac-datasets/austin-explore.json";

// ── Genre tokens ─────────────────────────────────────────────────────────────
const GENRE = {
  article:   { label: "Reading",  color: "oklch(0.55 0.08 70)" },
  venture:   { label: "Venture",  color: "oklch(0.55 0.08 150)" },
  image:     { label: "Look",     color: "oklch(0.55 0.09 30)" },
  chart:     { label: "Signal",   color: "oklch(0.55 0.08 250)" },
  surprise:  { label: "Surprise", color: "oklch(0.62 0.10 70)" },
  riff:      { label: "Riff",     color: "oklch(0.55 0.12 25)" },
  production:{ label: "Studio",   color: "oklch(0.52 0.11 305)" },
  poem:      { label: "Poem",     color: "oklch(0.50 0.08 325)" },
  longread:  { label: "Long read", color: "oklch(0.48 0.09 215)" },
  austin:    { label: "Explore Austin", color: "oklch(0.52 0.09 165)" },
} as const;
type Genre = keyof typeof GENRE;

const DEFAULT_DEPT_ITEMS: Array<"article" | "venture" | "chart"> = ["article", "venture", "chart"];

type AlmanacHeroImage = {
  title: string;
  location: string;
  url: string;
  sourceUrl: string;
  credit: string;
  fit?: "cover" | "contain";
  position?: string;
};

const AUSTIN_HERO_IMAGES: AlmanacHeroImage[] = [
  {
    title: "Barton Creek Greenbelt",
    location: "Gus Fruh",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Barton%20Creek%20Greenbelt%20-%20Gus%20Fruh%20Park%20-%20panoramio.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Barton_Creek_Greenbelt_-_Gus_Fruh_Park_-_panoramio.jpg",
    credit: "Wikimedia Commons / CC BY-SA",
    position: "center 50%",
  },
  {
    title: "Barton Creek Greenbelt",
    location: "Austin",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Barton%20Creek%20Greenbelt-19.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Barton_Creek_Greenbelt-19.jpg",
    credit: "LoneStarMike / Wikimedia Commons",
    position: "center 52%",
  },
  {
    title: "Texas Hill Country Bluebonnets",
    location: "Near Marble Falls",
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/A%20pretty%20field%20of%20bluebonnets,%20the%20Texas%20State%20Flower,%20near%20Marble%20Falls%20in%20Burnet%20County%20in%20the%20Texas%20Hill%20Country%20LCCN2014632953.tif",
    sourceUrl: "https://commons.wikimedia.org/wiki/Category:Texas_Hill_Country",
    credit: "Carol M. Highsmith / Library of Congress",
    position: "center 50%",
  },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WDAYS_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function dateForOffset(o: number): Date {
  return localDateFromIso(almanacIsoForOffset(o));
}
function fmtLong(d: Date) {
  return `${WDAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtShort(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}
function fmtIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function offsetForDate(d: Date) {
  const today = dateForOffset(0);
  return Math.round((d.getTime() - today.getTime()) / 864e5);
}
function pick<T>(arr: T[], idx: number): T {
  return arr[((idx % arr.length) + arr.length) % arr.length];
}
function heroImageForDate(dayIdx: number) {
  return pick(AUSTIN_HERO_IMAGES, dayIdx);
}

function hasCuratedImage(image: DailyData["image"] | undefined) {
  return !!image?.url;
}

// ── Toast ────────────────────────────────────────────────────────────────────
type ToastFn = (msg: string) => void;
const toastSubs = new Set<ToastFn>();
function showToast(msg: string) { toastSubs.forEach(fn => fn(msg)); }

function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const fn: ToastFn = (m) => {
      setMsg(m);
      clearTimeout((fn as ToastFn & { _t?: ReturnType<typeof setTimeout> })._t);
      (fn as ToastFn & { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setMsg(null), 2100);
    };
    toastSubs.add(fn);
    return () => {
      toastSubs.delete(fn);
    };
  }, []);
  return (
    <div className={`almanacToast${msg ? " almanacToast--visible" : ""}`}>
      <span className="almanacToast__text">{msg}</span>
    </div>
  );
}

// ── Feedback persistence ──────────────────────────────────────────────────────
type KeepRecord = { itemId: string; genre: string; title: string; sub?: string; keptAt: number; date: string; editionDate?: string; recordedAt?: string };
type TuneRecord  = { itemId: string; reaction: "more" | "less" | null; chips: string[]; note: string; interpretation?: string; at: number; date: string; editionDate?: string; recordedAt?: string };
type FeedbackHistoryItem = {
  id: string;
  type: "keep" | "tune";
  action?: "added" | "removed";
  itemId: string;
  genre: string;
  title: string;
  sub?: string;
  reaction?: "more" | "less" | null;
  chips?: string[];
  note?: string;
  interpretation?: string;
  at: number;
  date: string;
};
type FeedbackState = {
  keeps: Record<string, KeepRecord>;
  tunes: Record<string, TuneRecord>;
  history: Record<string, FeedbackHistoryItem[]>;
};
type RecrawlStatus = "idle" | "working" | "done" | "error";
type AlmanacRunStatus = {
  status?: "idle" | "queued" | "running" | "done" | "error";
  phase?: string;
  provider?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string;
};

const feedbackCache: Partial<Record<string, FeedbackState>> = {};
const feedbackInflight: Partial<Record<string, Promise<FeedbackState>>> = {};
const feedbackSubs = new Set<() => void>();

function emptyFeedback(): FeedbackState {
  return { keeps: {}, tunes: {}, history: {} };
}

function normalizeFeedback(data: Partial<FeedbackState> | null | undefined): FeedbackState {
  return {
    keeps: data?.keeps ?? {},
    tunes: data?.tunes ?? {},
    history: data?.history ?? {},
  };
}

async function loadFeedback(date: string): Promise<FeedbackState> {
  if (feedbackCache[date]) return feedbackCache[date];
  if (feedbackInflight[date]) return feedbackInflight[date];
  const p = (async () => {
    try {
      const res = await fetch(`/api/almanac/feedback?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        feedbackCache[date] = normalizeFeedback(data);
        return feedbackCache[date];
      }
    } catch {}
    feedbackCache[date] = emptyFeedback();
    return feedbackCache[date];
  })();
  feedbackInflight[date] = p;
  try { return await p; } finally { delete feedbackInflight[date]; }
}

async function persistKeep(date: string, keep: KeepRecord | null, itemId: string, item?: { genre: string; title: string; sub?: string }): Promise<FeedbackState | null> {
  const body = keep
    ? { ...keep, date, type: "keep", itemId }
    : { date, type: "keep", itemId, remove: true, genre: item?.genre, title: item?.title, sub: item?.sub };
  const res = await fetch("/api/almanac/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return normalizeFeedback(data?.feedback);
}

async function persistTune(date: string, tune: TuneRecord, item: { genre: string; title: string; sub?: string }): Promise<FeedbackState | null> {
  const res = await fetch("/api/almanac/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...tune, date, type: "tune", genre: item.genre, title: item.title, sub: item.sub }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return normalizeFeedback(data?.feedback);
}

function useFeedback(date: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(x => x + 1);
    feedbackSubs.add(fn);
    loadFeedback(date).then(() => force(x => x + 1));
    return () => {
      feedbackSubs.delete(fn);
    };
  }, [date]);
  return feedbackCache[date] ?? emptyFeedback();
}

async function toggleKeep(date: string, item: { id: string; genre: string; title: string; sub?: string }) {
  const state = feedbackCache[date] ?? emptyFeedback();
  const existing = state.keeps[item.id];
  if (existing) {
    const next = await persistKeep(date, null, item.id, item).catch(() => null);
    if (!next) {
      showToast("Could not update feedback. Please try again.");
      return;
    }
    feedbackCache[date] = next;
  } else {
    const keptAt = Date.now();
    const rec: KeepRecord = {
      itemId: item.id,
      genre: item.genre,
      title: item.title,
      sub: item.sub,
      keptAt,
      date,
      editionDate: date,
      recordedAt: new Date(keptAt).toISOString(),
    };
    const next = await persistKeep(date, rec, item.id, item).catch(() => null);
    if (!next) {
      showToast("Could not save feedback. Please try again.");
      return;
    }
    feedbackCache[date] = next;
    showToast("Saved: kept to your Almanac feedback store");
  }
  feedbackSubs.forEach(fn => fn());
}

async function saveTune(date: string, tune: TuneRecord, item: { genre: string; title: string; sub?: string }): Promise<boolean> {
  const next = await persistTune(date, tune, item).catch(() => null);
  if (!next) return false;
  feedbackCache[date] = next;
  feedbackSubs.forEach(fn => fn());
  return true;
}

async function postAlmanacRegenerate(date: string) {
  const res = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "almanac-regenerate",
      itemId: `almanac:${date}`,
      payload: {
        date,
        provider: "tavily",
        force: true,
        requestedAction: "recrawl-and-regenerate-todays-almanac",
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Signal failed (${res.status})`);
  return json;
}

async function fetchAlmanacRunStatus(date: string): Promise<AlmanacRunStatus> {
  const res = await fetch(`/api/almanac/status?date=${date}&t=${Date.now()}`);
  if (!res.ok) throw new Error(`Status fetch failed (${res.status})`);
  return res.json();
}

async function postArticleSave(itemId: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "article-save", itemId, payload }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Article save failed (${res.status})`);
  return json;
}

// ── Kicker ───────────────────────────────────────────────────────────────────
function Kicker({ genre, extra }: { genre: Genre; extra?: string }) {
  const g = GENRE[genre];
  return (
    <div className="almanacKicker">
      <span className="almanacKicker__dot" style={{ background: g.color }} />
      <span className="almanacKicker__label" style={{ color: g.color }}>{g.label}</span>
      {extra && <span className="almanacKicker__extra">· {extra}</span>}
    </div>
  );
}

// ── WhyLine ──────────────────────────────────────────────────────────────────
function WhyLine({ text, label }: { text: string; label?: string }) {
  return (
    <div className="almanacWhyLine">
      <span className="almanacWhyLine__alpha">α</span>
      <span className="almanacWhyLine__text">
        {label && <b className="almanacWhyLine__label">{label} </b>}
        {text}
      </span>
    </div>
  );
}

// ── KeepBtn ──────────────────────────────────────────────────────────────────
function KeepBtn({ kept, onClick }: { kept: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`almanacKeepBtn${kept ? " almanacKeepBtn--kept" : ""}`} title={kept ? "Kept" : "Keep this"}>
      <span>{kept ? "✦" : "✧"}</span>{kept ? "Kept" : "Keep"}
    </button>
  );
}

// ── TuneStrip ────────────────────────────────────────────────────────────────
const NUANCE_CHIPS = ["too long","wrong vibe","seen it","love the source","go deeper","more practical","more beautiful"];
// Genre-specific tuning vocab — these steer tomorrow's pick via almanac-feedback-weights.
const RIFF_CHIPS = ["more blues","more funk","more fingerstyle","too hard","too easy","love this riff"];
const PRODUCTION_CHIPS = ["more Ableton","more sound design","more arrangement","too advanced","inspiring","not for me"];
const POEM_CHIPS = ["more modernist","more religious","more political","too familiar","more beautiful"];
const LONG_READ_CHIPS = ["more macro","more investing","more source-backed","too long","go deeper"];
const AUSTIN_CHIPS = ["more family","more outdoors","more beautiful","closer to home","less obvious"];

function fmtFeedbackTime(ms?: number) {
  if (!ms) return "saved";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeFeedbackReceipt(saved: TuneRecord | null, kept: boolean) {
  const parts: string[] = [];
  if (kept) parts.push("kept");
  if (saved?.reaction === "more") parts.push("more like this");
  if (saved?.reaction === "less") parts.push("less like this");
  if (saved?.chips?.length) parts.push(saved.chips.join(", "));
  if (saved?.note?.trim()) parts.push(`"${saved.note.trim()}"`);
  return parts.length ? parts.join(" · ") : "No feedback saved yet.";
}

function describeFeedbackInterpretation(saved: TuneRecord | null, kept: boolean, item: { genre: string; title: string; sub?: string }) {
  if (saved?.interpretation) return saved.interpretation;
  return buildAlmanacFeedbackInterpretation({
    genre: item.genre,
    title: item.title,
    sub: item.sub,
    reaction: saved?.reaction ?? null,
    chips: saved?.chips ?? [],
    note: saved?.note ?? "",
    kept,
  });
}

function describeHistoryItem(entry: FeedbackHistoryItem) {
  if (entry.type === "keep") {
    return entry.action === "removed" ? "Removed keep signal" : "Kept this tile";
  }
  const parts: string[] = [];
  if (entry.reaction === "more") parts.push("more like this");
  if (entry.reaction === "less") parts.push("less like this");
  if (entry.chips?.length) parts.push(entry.chips.join(", "));
  if (entry.note?.trim()) parts.push(`"${entry.note.trim()}"`);
  return parts.length ? parts.join(" · ") : "Tune saved";
}

const FALLBACK_POEMS: DailyPoem[] = [
  {
    title: "Sunday Morning",
    poet: "Wallace Stevens",
    era: "1915 / modernist",
    excerpt: "Complacencies of the peignoir, and late coffee and oranges",
    note: "A Sunday poem about replacing inherited heaven with the difficult, sensuous world in front of you.",
    why: "It sits between religious-cultural analysis and lived appetite: belief, doubt, breakfast, mortality.",
    sourceUrl: "https://www.poetryfoundation.org/poetrymagazine/poems/13261/sunday-morning",
    sourceLabel: "Poetry Foundation",
  },
];

const FALLBACK_LONG_READS: DailyLongRead[] = longReadDataset.map(({ id, tags, ...read }) => read);

const FALLBACK_AUSTIN_EXPLORES = austinExploreDataset as DailyAustinExplore[];

interface TuneStripProps {
  visibility: "hover" | "always" | "compact" | "readonly" | "none";
  compact?: boolean;
  item: { id: string; genre: string; title: string; sub?: string };
  date: string;
  chips?: string[];
  onDiscuss?: () => void;
}

function TuneStrip({ visibility, compact, item, date, chips: chipVocab = NUANCE_CHIPS, onDiscuss }: TuneStripProps) {
  const feedback = useFeedback(date);
  const kept = !!feedback.keeps[item.id];
  const saved = feedback.tunes[item.id] ?? null;

  const [open, setOpen] = useState(false);
  const [reaction, setReaction] = useState<"more" | "less" | null>(saved?.reaction ?? null);
  const [chips, setChips] = useState<Set<string>>(() => new Set(saved?.chips ?? []));
  const [note, setNote] = useState(saved?.note ?? "");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Sync from loaded state
  useEffect(() => {
    setReaction(saved?.reaction ?? null);
    setChips(new Set(saved?.chips ?? []));
    setNote(saved?.note ?? "");
  }, [saved?.reaction, saved?.chips?.join(","), saved?.note]);

  if (visibility === "readonly" || visibility === "none") return null;

  const toggleChip = (c: string) => setChips(prev => {
    const n = new Set(prev);
    n.has(c) ? n.delete(c) : n.add(c);
    return n;
  });

  const submit = async () => {
    if (!reaction && chips.size === 0 && !note.trim()) { setOpen(false); return; }
    setSaveState("saving");
    const ok = await saveTune(date, { itemId: item.id, reaction, chips: [...chips], note: note.trim(), at: Date.now(), date }, item);
    if (!ok) {
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    setReceiptOpen(true);
    showToast("Saved: feedback recorded for future Almanac editions");
    setTimeout(() => { setOpen(false); setTimeout(() => setSaveState("idle"), 300); }, 1600);
  };

  const compactMode = visibility === "compact";
  const wrapCls = visibility === "always" ? "almanacTuneRow almanacTuneRow--on" : `almanacTuneRow${compactMode ? " almanacTuneRow--compact" : ""}`;
  const history = feedback.history[item.id] ?? [];
  const hasReceipt = kept || !!saved || history.length > 0;
  const historyCount = Math.max(history.length, hasReceipt ? 1 : 0);

  const keepEl = (
    <KeepBtn kept={kept} onClick={() => { void toggleKeep(date, { id: item.id, genre: item.genre, title: item.title, sub: item.sub }); }} />
  );

  const tuneBtn = (
    <button onClick={() => setOpen(o => !o)} className={`almanacTuneBtn${saved ? " almanacTuneBtn--tuned" : ""}${open ? " almanacTuneBtn--open" : ""}`}>
      {saved && <span className="almanacTuneBtn__dot">●</span>}
      {saved ? "Tuned" : "Tune"}
      <span className={`almanacTuneBtn__caret${open ? " almanacTuneBtn__caret--open" : ""}`}>▾</span>
    </button>
  );

  const discussBtn = onDiscuss && (
    <button onClick={onDiscuss} className="almanacDiscussBtn">
      <span className="almanacDiscussBtn__alpha">α</span>Discuss
    </button>
  );

  const receiptBtn = hasReceipt && (
    <button
      type="button"
      onClick={() => setReceiptOpen(o => !o)}
      className={`almanacReceiptBtn${receiptOpen ? " almanacReceiptBtn--open" : ""}`}
      aria-expanded={receiptOpen}
    >
      Feedback{historyCount > 1 ? ` ${historyCount}` : ""}
      <span className={`almanacTuneBtn__caret${receiptOpen ? " almanacTuneBtn__caret--open" : ""}`}>▾</span>
    </button>
  );

  return (
    <div style={{ marginTop: compact ? 12 : 18 }}>
      <div className={wrapCls}>
        {visibility !== "hover" && !compactMode && keepEl}
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {visibility === "hover" && keepEl}
          {tuneBtn}
          {(!compactMode || hasReceipt) && receiptBtn}
          {!compactMode && discussBtn}
        </span>
      </div>
      {receiptOpen && hasReceipt && (
        <div className="almanacFeedbackReceipt">
          <div className="almanacFeedbackReceipt__top">
            <span className="almanacFeedbackReceipt__status">Saved</span>
            <span className="almanacFeedbackReceipt__time">{fmtFeedbackTime(saved?.at ?? (kept ? feedback.keeps[item.id]?.keptAt : undefined))}</span>
          </div>
          <div className="almanacFeedbackReceipt__row">
            <span>Feedback</span>
            <p>{describeFeedbackReceipt(saved, kept)}</p>
          </div>
          <div className="almanacFeedbackReceipt__row">
            <span>Interpretation</span>
            <p>{describeFeedbackInterpretation(saved, kept, item)}</p>
          </div>
          <div className="almanacFeedbackReceipt__row">
            <span>History</span>
            {history.length ? (
              <ol className="almanacFeedbackReceipt__history">
                {history.slice(0, 5).map(entry => (
                  <li key={entry.id}>
                    <time>{fmtFeedbackTime(entry.at)}</time>
                    <p>{describeHistoryItem(entry)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Older feedback was saved before history tracking; new saves will appear here.</p>
            )}
          </div>
        </div>
      )}
      {open && (
        <div className="almanacTunePanel">
          {saveState === "saved" ? (
            <div className="almanacTunePanel__confirm">
              <span>✓</span> Saved to the feedback store. Future editions will use the receipt below.
            </div>
          ) : (
            <>
              <div className="almanacTunePanel__header">Tune tomorrow&apos;s edition</div>
              {compactMode && (
                <div className="almanacTunePanel__mobileActions">
                  {keepEl}
                  {discussBtn}
                </div>
              )}
              <div className="almanacTunePanel__reactions">
                {(["more","less"] as const).map(r => (
                  <button key={r} onClick={() => setReaction(p => p === r ? null : r)}
                    className={`almanacTunePanel__reaction${reaction === r ? " almanacTunePanel__reaction--on" : ""}`}>
                    {r === "more" ? "↑ More like this" : "↓ Less like this"}
                  </button>
                ))}
              </div>
              <div className="almanacTunePanel__chips">
                {chipVocab.map(c => (
                  <button key={c} onClick={() => toggleChip(c)}
                    className={`almanacChip${chips.has(c) ? " almanacChip--on" : ""}`}>{c}</button>
                ))}
              </div>
              <div className="almanacTunePanel__noteRow">
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  onFocus={() => setNoteExpanded(true)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                  placeholder="tell Alphalpha why… (optional)"
                  className={`almanacTunePanel__noteInput${noteExpanded || note.length > 80 ? " almanacTunePanel__noteInput--expanded" : ""}`}
                  rows={noteExpanded || note.length > 80 ? 5 : 2} />
                <button onClick={submit} className="almanacTunePanel__save" disabled={saveState === "saving"}>
                  {saveState === "saving" ? "Saving..." : saved ? "Update" : "Save"}
                </button>
              </div>
              {saveState === "error" && (
                <div className="almanacTunePanel__error">Not saved. Check the connection and try again.</div>
              )}
              <div className="almanacTunePanel__storageHint">Writes to /api/almanac/feedback before this tile marks it saved.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── BarChart ─────────────────────────────────────────────────────────────────
function BarChart({ series, size }: { series: { label: string; value: number }[]; size: "lead" | "dept" }) {
  const max = Math.max(...series.map(s => s.value));
  const H = size === "lead" ? 132 : 58;
  const accent = GENRE.chart.color;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: size === "lead" ? 16 : 8, height: H + (size === "lead" ? 40 : 18) }}>
      {series.map((s, i) => {
        const est = /e/.test(s.label);
        const h = Math.max((s.value / max) * H, 3);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            {size === "lead" && (
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: est ? accent : "#7a6f62" }}>{s.value}</span>
            )}
            <div style={{ width: "100%", height: h, borderRadius: "4px 4px 0 0",
              background: est ? `color-mix(in oklch, ${accent} 16%, transparent)` : "#cdbfa3",
              border: est ? `1.5px solid ${accent}` : "none", transition: "height .7s ease" }} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#b0a080" }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Card blocks ───────────────────────────────────────────────────────────────
interface BlockProps {
  d: DailyData;
  size: "lead" | "dept";
  visibility: "hover" | "always" | "compact" | "readonly" | "none";
  date: string;
  openThread?: (ctx: ThreadContext) => void;
  openVenture?: (v: DailyVenture) => void;
}

function ArticleBlock({ d, size, visibility, date, openThread }: BlockProps) {
  const lead = size === "lead";
  const item = { id: "article:" + d.article.title, genre: "article" as Genre, title: d.article.title, sub: d.article.source };
  const disc = () => openThread?.({ type: "digest", id: "daily-article", title: d.article.title, summary: d.article.dek, category: "Daily reading" });
  const url = d.article.url;
  return (
    <div className="card-hoverable">
      <Kicker genre="article" extra={lead ? `${d.article.source} · ${d.article.readTime}` : d.article.source} />
      {url ? (
        <a className={`almanacHeadline almanacHeadline--${size} almanacHeadlineLink`} href={url} target="_blank" rel="noopener noreferrer">{d.article.title}</a>
      ) : (
        <div className={`almanacHeadline almanacHeadline--${size}`}>{d.article.title}</div>
      )}
      <div className={`almanacDek almanacDek--${size}`}>{d.article.dek}</div>
      {lead && <WhyLine text={d.article.why} />}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`almanacReadLink${lead ? "" : " almanacReadLink--dept"}`}>
          {lead ? "Read the full piece →" : "Read →"}
        </a>
      )}
      {url && (
        <ArticleSaveButton
          itemId={item.id}
          payload={{
            kind: "almanac-article",
            title: d.article.title,
            url,
            source: d.article.source,
            summary: d.article.dek,
            why: d.article.why,
            date,
            themes: ["article", "daily reading"],
          }}
          compact={!lead}
        />
      )}
      <TuneStrip visibility={visibility} compact={!lead} item={item} date={date} onDiscuss={lead ? disc : undefined} />
    </div>
  );
}

function VentureBlock({ d, size, visibility, date, openThread, openVenture }: BlockProps) {
  const lead = size === "lead";
  const venture = d.ventures[0]; // resolved by parent via pick()
  const item = { id: "venture:" + venture.name, genre: "venture" as Genre, title: venture.name, sub: venture.effort };
  const disc = () => openThread?.({ type: "digest", id: "daily-venture", title: venture.title, summary: venture.pitch, category: "Daily venture" });
  return (
    <div className="card-hoverable almanacVentureCard" onClick={() => openVenture?.(venture)}>
      <Kicker genre="venture" extra={`${venture.effort} · refreshes every 3 days`} />
      <div className={`almanacHeadline almanacHeadline--${lead ? "venture-lead" : "dept"}`}>{venture.title}</div>
      <div className={`almanacDek almanacDek--${size}`}>{venture.pitch}</div>
      {lead ? (
        <>
          <WhyLine text={venture.why} />
          <div className="almanacVentureLink">Open the brief & market research <span>→</span></div>
        </>
      ) : (
        <div className="almanacVentureLink almanacVentureLink--dept">Open the brief →</div>
      )}
      <div onClick={e => e.stopPropagation()}>
        <TuneStrip visibility={visibility} compact={!lead} item={item} date={date} onDiscuss={lead ? disc : undefined} />
      </div>
    </div>
  );
}

function ChartBlock({ d, size, visibility, date, openThread }: BlockProps) {
  const lead = size === "lead";
  const chart = d.charts[0]; // resolved by parent
  const item = { id: "chart:" + chart.title, genre: "chart" as Genre, title: chart.title, sub: chart.topic };
  const disc = () => openThread?.({ type: "ticker", id: "daily-signal", title: chart.title, theme: chart.note, stance: "Daily signal", project: chart.topic === "Investing" ? "Investing" : "Signals" });
  return (
    <div className="card-hoverable">
      <Kicker genre="chart" extra={lead ? `${chart.topic} · ${chart.unit}` : chart.topic} />
      <div className={`almanacHeadline almanacHeadline--chart-${size}`}>{chart.title}</div>
      <BarChart series={chart.series} size={size} />
      {lead && (
        <>
          <div className="almanacChartNote">{chart.note}</div>
          <WhyLine text={chart.why} />
        </>
      )}
      {chart.sourceUrl && (
        <a href={chart.sourceUrl} target="_blank" rel="noopener noreferrer" className={`almanacReadLink${lead ? "" : " almanacReadLink--dept"}`}>
          {chart.sourceLabel ? `Source — ${chart.sourceLabel} →` : (lead ? "See the source data →" : "Source →")}
        </a>
      )}
      <TuneStrip visibility={visibility} compact={!lead} item={item} date={date} onDiscuss={lead ? disc : undefined} />
    </div>
  );
}

function ImageBlock({ d, size, visibility, date }: BlockProps) {
  const lead = size === "lead";
  const title = d.image.title || "Today's image";
  const tagText = (d.image.tags ?? []).join(" ").toLowerCase();
  const sourceText = `${d.image.kicker} ${d.image.credit} ${tagText}`.toLowerCase();
  const isGenerative = /\b(ai|generative|algorithmic|neural|fractal)\b/.test(sourceText);
  const item = { id: "image:daily", genre: "image" as Genre, title, sub: isGenerative ? "Tasteful AI-generated art" : "Curated for your taste" };
  const hasImage = !!d.image.url;
  return (
    <div className="card-hoverable">
      <Kicker genre="image" extra={lead ? (isGenerative ? "Tasteful AI-generated art" : "Curated for your taste") : (isGenerative ? "AI-generated art" : "for your taste")} />
      <div className={`almanacImageSlot almanacImageSlot--${size}`}>
        {hasImage ? (
          d.image.srcLink ? (
            <a
              className="almanacImageLink"
              href={d.image.srcLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={title}
            >
              <img className="almanacImageReal" src={d.image.url} alt={title} />
            </a>
          ) : (
            <img className="almanacImageReal" src={d.image.url} alt={title} />
          )
        ) : (
          <div className="almanacImagePlaceholder">
            <span className="almanacImagePlaceholder__text">α chose this for your eye</span>
          </div>
        )}
      </div>
      {lead ? (
        <>
          <div className="almanacImageCaption">
            {d.image.caption}
            <span className="almanacImageCredit">{d.image.credit}</span>
          </div>
          <WhyLine text={d.image.curator} />
        </>
      ) : (
        <div className="almanacImageDeptNote">{hasImage ? d.image.caption : "α chose this for your eye — drop your own to retune."}</div>
      )}
      <TuneStrip visibility={visibility} compact={!lead} item={item} date={date} />
    </div>
  );
}

// ── Surprise band ─────────────────────────────────────────────────────────────
interface SurpriseProps {
  s: DailyData["surprises"][0];
  visibility: "hover" | "always" | "compact" | "readonly" | "none";
  date: string;
  isMobile: boolean;
  openThread?: (ctx: ThreadContext) => void;
}

function SurpriseBand({ s, visibility, date, isMobile, openThread }: SurpriseProps) {
  const item = { id: "surprise:" + s.title, genre: "surprise" as Genre, title: s.title, sub: s.form };
  const disc = () => openThread?.({ type: "digest", id: "daily-surprise", title: s.title, summary: s.body, category: "Surprise" });
  return (
    <div className={`card-hoverable almanacSurprise${isMobile ? " almanacSurprise--mobile" : ""}`}>
      <div className="almanacSurprise__header">
        <span className="almanacSurprise__star">✦</span>
        <span className="almanacSurprise__label">Surprise me</span>
        <span className="almanacSurprise__sub">· α picked this in any form, just for today · {s.form}</span>
      </div>
      <div className={`almanacSurprise__body${isMobile ? " almanacSurprise__body--mobile" : ""}`}>
        <div className="almanacSurprise__title">{s.title}</div>
        <div>
          <div className="almanacSurprise__text">{s.body}</div>
          <div className="almanacSurprise__why">
            <span className="almanacSurprise__alpha">α</span>
            <span className="almanacSurprise__note">{s.note}</span>
          </div>
          {s.sourceUrl && (
            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="almanacReadLink almanacReadLink--dept">
              {s.sourceLabel ? `${s.sourceLabel} →` : "Go to the source →"}
            </a>
          )}
        </div>
      </div>
      <div className="surprise-tune">
        <TuneStrip visibility={visibility} compact onDiscuss={disc} item={item} date={date} />
      </div>
    </div>
  );
}

// ── YouTube embed ─────────────────────────────────────────────────────────────
function YouTubeEmbed({ videoId, start, title }: { videoId: string; start?: number; title: string }) {
  // youtube-nocookie keeps the privacy-enhanced mode; rel=0 keeps suggestions on-channel.
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (start && start > 0) params.set("start", String(start));
  return (
    <div className="almanacVideo">
      <iframe
        className="almanacVideo__frame"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

// ── Workshop blocks: guitar riff + production clip ────────────────────────────
function RiffBlock({ riff, visibility, date, openThread }: { riff: DailyRiff; visibility: BlockProps["visibility"]; date: string; openThread?: (ctx: ThreadContext) => void }) {
  const item = { id: "riff:" + riff.videoId, genre: "riff" as Genre, title: riff.title, sub: riff.genre };
  const url = riff.sourceUrl || `https://youtu.be/${riff.videoId}`;
  const disc = () => openThread?.({ type: "digest", id: "daily-riff", title: riff.title, summary: riff.why, category: "Guitar riff" });
  return (
    <div className="card-hoverable almanacWorkshopCard">
      <Kicker genre="riff" extra={`${riff.genre} · ${riff.difficulty}`} />
      <div className="almanacWorkshopTitle">{riff.title}</div>
      <div className="almanacWorkshopByline">{riff.artist}</div>
      <YouTubeEmbed videoId={riff.videoId} start={riff.start} title={riff.title} />
      {riff.note && <div className="almanacWorkshopNote">{riff.note}</div>}
      <WhyLine text={riff.why} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="almanacReadLink">Watch &amp; learn on YouTube →</a>
      <TuneStrip visibility={visibility} compact item={item} date={date} chips={RIFF_CHIPS} onDiscuss={disc} />
    </div>
  );
}

function ProductionBlock({ clip, visibility, date, openThread }: { clip: DailyProductionClip; visibility: BlockProps["visibility"]; date: string; openThread?: (ctx: ThreadContext) => void }) {
  const item = { id: "production:" + clip.videoId, genre: "production" as Genre, title: clip.title, sub: clip.technique };
  const url = clip.sourceUrl || `https://youtu.be/${clip.videoId}`;
  const disc = () => openThread?.({ type: "digest", id: "daily-production", title: clip.title, summary: clip.why, category: "Production clip" });
  return (
    <div className="card-hoverable almanacWorkshopCard">
      <Kicker genre="production" extra={`${clip.daw} · ${clip.technique}`} />
      <div className="almanacWorkshopTitle">{clip.title}</div>
      <div className="almanacWorkshopByline">{clip.creator}</div>
      <YouTubeEmbed videoId={clip.videoId} start={clip.start} title={clip.title} />
      {clip.note && <div className="almanacWorkshopNote">{clip.note}</div>}
      <WhyLine text={clip.why} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="almanacReadLink">Open on YouTube →</a>
      <TuneStrip visibility={visibility} compact item={item} date={date} chips={PRODUCTION_CHIPS} onDiscuss={disc} />
    </div>
  );
}

function PoemBlock({ poem, visibility, date, openThread }: { poem: DailyPoem; visibility: BlockProps["visibility"]; date: string; openThread?: (ctx: ThreadContext) => void }) {
  const item = { id: "poem:" + poem.title, genre: "poem" as Genre, title: poem.title, sub: poem.poet };
  const disc = () => openThread?.({ type: "digest", id: "daily-poem", title: poem.title, summary: poem.note, category: "Poem" });
  const excerpt = <blockquote className="almanacPoemExcerpt">&ldquo;{poem.excerpt}&rdquo;</blockquote>;
  return (
    <div className="card-hoverable almanacShelfCard almanacShelfCard--poem">
      <Kicker genre="poem" extra={poem.era || poem.poet} />
      <div className="almanacShelfTitle">{poem.title}</div>
      <div className="almanacShelfByline">{poem.poet}</div>
      {poem.sourceUrl ? (
        <a href={poem.sourceUrl} target="_blank" rel="noopener noreferrer" className="almanacPoemExcerptLink" aria-label={`Read ${poem.title} by ${poem.poet}`}>
          {excerpt}
        </a>
      ) : excerpt}
      <TuneStrip visibility={visibility} compact item={item} date={date} chips={POEM_CHIPS} onDiscuss={disc} />
    </div>
  );
}

function QuoteCard({ quote, label }: { quote: { text: string; source: string }; label: string }) {
  return (
    <div className="almanacQuoteCard">
      <div className="almanac__colophonLabel">{label}</div>
      <div className="almanac__colophonText">&ldquo;{quote.text}&rdquo;</div>
      <div className="almanac__colophonSource">{quote.source}</div>
    </div>
  );
}

function ArticleSaveButton({ itemId, payload, compact = false }: { itemId: string; payload: Record<string, unknown>; compact?: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const disabled = state === "saving" || typeof payload.url !== "string" || !payload.url;
  const label = state === "saving" ? "Saving..." : state === "saved" ? "Queued + sent" : state === "error" ? "Retry save" : "Queue + Instapaper";

  const save = async () => {
    if (disabled) return;
    setState("saving");
    try {
      await postArticleSave(itemId, payload);
      setState("saved");
      showToast("Article save request accepted");
    } catch {
      setState("error");
      showToast("Article save failed");
    }
  };

  return (
    <button
      type="button"
      className={`almanacArticleSaveBtn${compact ? " almanacArticleSaveBtn--compact" : ""} almanacArticleSaveBtn--${state}`}
      onClick={save}
      disabled={disabled}
    >
      <span aria-hidden="true">{state === "saved" ? "✓" : "+"}</span>
      <span>{label}</span>
    </button>
  );
}

function LongReadBlock({ read, visibility, date, openThread, compact = false }: { read: DailyLongRead; visibility: BlockProps["visibility"]; date: string; openThread?: (ctx: ThreadContext) => void; compact?: boolean }) {
  const item = { id: "longread:" + read.title, genre: "longread" as Genre, title: read.title, sub: read.source };
  const disc = () => openThread?.({ type: "digest", id: "daily-longread", title: read.title, summary: read.thesis, category: "Macro / investment thesis" });
  return (
    <div className={`card-hoverable${compact ? "" : " almanacShelfCard"}`}>
      <Kicker genre="longread" extra={`${read.source} · ${read.readTime}`} />
      <div className="almanacShelfTitle">{read.title}</div>
      <div className="almanacShelfByline">{read.frame}</div>
      <p className="almanacShelfThesis">{read.thesis}</p>
      <WhyLine text={read.why} />
      {read.url && (
        <a href={read.url} target="_blank" rel="noopener noreferrer" className="almanacReadLink">
          {read.sourceLabel ? `Open ${read.sourceLabel} →` : "Open the long read →"}
        </a>
      )}
      {read.url && (
        <ArticleSaveButton
          itemId={item.id}
          payload={{
            kind: "almanac-longread",
            title: read.title,
            url: read.url,
            source: read.source,
            summary: read.thesis,
            why: read.why,
            date,
            themes: ["macro", "investing", "long read"],
          }}
          compact={compact}
        />
      )}
      <TuneStrip visibility={visibility} compact item={item} date={date} chips={LONG_READ_CHIPS} onDiscuss={disc} />
    </div>
  );
}

function mapEmbedUrl(explore: DailyAustinExplore) {
  if (typeof explore.latitude !== "number" || typeof explore.longitude !== "number") return null;
  const lat = explore.latitude;
  const lon = explore.longitude;
  const delta = 0.012;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
}

function AustinExploreBlock({ explore, visibility, date, openThread }: { explore: DailyAustinExplore; visibility: BlockProps["visibility"]; date: string; openThread?: (ctx: ThreadContext) => void }) {
  const item = { id: "austin:" + explore.title, genre: "austin" as Genre, title: explore.title, sub: explore.area };
  const disc = () => openThread?.({ type: "digest", id: "daily-austin-explore", title: explore.title, summary: explore.why, category: "Explore Austin" });
  const mapUrl = explore.mapUrl || (typeof explore.latitude === "number" && typeof explore.longitude === "number" ? `https://www.openstreetmap.org/?mlat=${explore.latitude}&mlon=${explore.longitude}#map=15/${explore.latitude}/${explore.longitude}` : undefined);
  const mapEmbed = mapEmbedUrl(explore);
  return (
    <div className="card-hoverable almanacExplore">
      <div className="almanacExplore__meta">
        <Kicker genre="austin" extra={`${explore.category} · ${explore.area}`} />
        <div className="almanacExplore__time">{explore.duration} · {explore.bestTime}</div>
      </div>
      <div className="almanacExplore__body">
        <div>
          <div className="almanacExplore__title">{explore.title}</div>
          <p className="almanacExplore__vibe">{explore.vibe}</p>
        </div>
        <div className="almanacExplore__prompt">
          <span>Try this</span>
          <p>{explore.prompt}</p>
        </div>
      </div>
      {(explore.imageUrl || mapEmbed) && (
        <div className="almanacExplore__media">
          {explore.imageUrl && (
            <a
              className="almanacExplore__imageLink"
              href={explore.imageSourceUrl || explore.url || explore.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open image source for ${explore.title}`}
            >
              <img className="almanacExplore__image" src={explore.imageUrl} alt={explore.imageAlt || explore.title} />
              {explore.imageCredit && <span className="almanacExplore__imageCredit">{explore.imageCredit}</span>}
            </a>
          )}
          {mapEmbed && (
            <div className="almanacExplore__mapWrap">
              <iframe
                className="almanacExplore__map"
                src={mapEmbed}
                title={`${explore.title} map`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="almanacExplore__mapLink">
                  Open map
                </a>
              )}
            </div>
          )}
        </div>
      )}
      <WhyLine text={explore.why} />
      <div className="almanacExplore__actions">
        {explore.url && (
          <a href={explore.url} target="_blank" rel="noopener noreferrer" className="almanacReadLink">
            {explore.sourceLabel ? `Open ${explore.sourceLabel} →` : "Open source →"}
          </a>
        )}
        <TuneStrip visibility={visibility} compact item={item} date={date} chips={AUSTIN_CHIPS} onDiscuss={disc} />
      </div>
    </div>
  );
}

// ── Venture modal ─────────────────────────────────────────────────────────────
interface VentureModalProps {
  venture: DailyVenture | null;
  date: string;
  readonly?: boolean;
  onClose: () => void;
  openThread?: (ctx: ThreadContext) => void;
}

function VentureModal({ venture, date, readonly, onClose, openThread }: VentureModalProps) {
  const feedback = useFeedback(date);
  const item = venture ? { id: "venture:" + venture.name, genre: "venture" as Genre, title: venture.name, sub: venture.effort } : null;
  const kept = item ? !!feedback.keeps[item.id] : false;

  // Trap focus + close on Escape
  useEffect(() => {
    if (!venture) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [venture, onClose]);

  if (!venture || !item) return null;
  const r = venture.research;

  return (
    <div className="almanacModalScrim" onClick={onClose}>
      <div className="almanacModal" onClick={e => e.stopPropagation()}>
        <div className="almanacModal__header">
          <button onClick={onClose} className="almanacModal__close">✕</button>
          <Kicker genre="venture" extra="The brief · refreshes every 3 days" />
          <div className="almanacModal__title">{venture.title}</div>
          <div className="almanacModal__pitch">{venture.pitch}</div>
        </div>
        <div className="almanacModal__body">
          <div className="almanacModal__stats">
            {[
              { label: "Market (TAM)", value: r.tam, sub: r.tamLabel },
              { label: "Growth",       value: r.growth, sub: r.growthLabel },
              { label: "Model",        value: r.model },
            ].map(cell => (
              <div key={cell.label} className="almanacStatCell">
                <div className="almanacStatCell__label">{cell.label}</div>
                <div className="almanacStatCell__value">{cell.value}</div>
                {cell.sub && <div className="almanacStatCell__sub">{cell.sub}</div>}
              </div>
            ))}
          </div>

          <div>
            <div className="almanacSectionLabel">Why now</div>
            <div className="almanacModal__prose">{r.whyNow}</div>
          </div>

          <div className="almanacWedge">
            <div className="almanacWedge__label">The wedge</div>
            <div className="almanacModal__prose">{r.wedge}</div>
          </div>

          <div>
            <div className="almanacSectionLabel">Landscape</div>
            <div className="almanacModal__competitors">
              {r.competitors.map(c => (
                <div key={c.name} className="almanacCompetitor">
                  <span className="almanacCompetitor__name">{c.name}</span>
                  <span className="almanacCompetitor__note">{c.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="almanacSectionLabel">Signals worth noting</div>
            <div className="almanacModal__signals">
              {r.signals.map((s, i) => (
                <div key={i} className="almanacSignal">
                  <span className="almanacSignal__dot" style={{ background: GENRE.venture.color }} />
                  <span className="almanacSignal__text">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <WhyLine label="Why I surfaced this:" text={venture.why} />

          <div className="almanacModal__footer">
            {!readonly && <KeepBtn kept={kept} onClick={() => item && toggleKeep(date, item)} />}
            <button
              onClick={() => {
                openThread?.({ type: "digest", id: "venture-" + venture.name, title: venture.title, summary: venture.pitch, category: "Venture brief" });
                onClose();
              }}
              className="almanacDiscussBtn almanacDiscussBtn--modal"
            >
              <span className="almanacDiscussBtn__alpha">α</span>Discuss the build
            </button>
            <span className="almanacModal__sourcing">Sourcing & method live in the export brief</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edition navigator ─────────────────────────────────────────────────────────
function EditionNav({ offset, setOffset, isMobile }: { offset: number; setOffset: (o: number) => void; isMobile: boolean }) {
  const [calOpen, setCalOpen] = useState(false);
  const cur = dateForOffset(offset);
  const [view, setView] = useState(() => new Date(cur.getFullYear(), cur.getMonth(), 1));
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = dateForOffset(offset);
    setView(new Date(c.getFullYear(), c.getMonth(), 1));
  }, [offset]);

  const isToday = offset === 0;

  const arrow = (label: string, delta: number, disabled: boolean, title: string) => (
    <button onClick={() => setOffset(offset + delta)} disabled={disabled} title={title} className={`almanacNavArrow${disabled ? " almanacNavArrow--disabled" : ""}`}>{label}</button>
  );

  // calendar cells
  const startPad = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let n = 1; n <= dim; n++) cells.push(new Date(view.getFullYear(), view.getMonth(), n));

  return (
    <div style={{ position: "relative" }}>
      <div className="almanacNav">
        {arrow("‹", -1, false, "Previous edition")}
        <button onClick={() => setCalOpen(o => !o)} className={`almanacNavDate${calOpen ? " almanacNavDate--open" : ""}`}>
          <span>🗓</span>
          {isMobile ? fmtShort(cur) : fmtLong(cur)}
          <span className={`almanacNavDate__caret${calOpen ? " almanacNavDate__caret--open" : ""}`}>▾</span>
        </button>
        {arrow("›", +1, isToday, isToday ? "This is the latest edition" : "Next edition")}
        {!isToday && (
          <button onClick={() => setOffset(0)} className="almanacNavToday">Today →</button>
        )}
      </div>

      {calOpen && (
        <>
          <div onClick={() => setCalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div ref={calRef} className="almanacCal">
            <div className="almanacCal__header">
              <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="almanacCal__arrow">‹</button>
              <span className="almanacCal__month">{MONTHS_LONG[view.getMonth()]} {view.getFullYear()}</span>
              <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="almanacCal__arrow">›</button>
            </div>
            <div className="almanacCal__weekdays">
              {WDAYS_SHORT.map(w => <div key={w} className="almanacCal__weekday">{w[0]}</div>)}
            </div>
            <div className="almanacCal__grid">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const o = offsetForDate(d);
                const future = o > 0;
                const selected = o === offset;
                const isT = o === 0;
                return (
                  <button key={i} disabled={future} onClick={() => { setOffset(o); setCalOpen(false); }}
                    className={`almanacCal__day${selected ? " almanacCal__day--selected" : ""}${isT ? " almanacCal__day--today" : ""}${future ? " almanacCal__day--future" : ""}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="almanacCal__footer">Archived editions are read-only</div>
          </div>
        </>
      )}
    </div>
  );
}

// ── useIsMobile ───────────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return mobile;
}

// ── Almanac main component ────────────────────────────────────────────────────
interface AlmanacProps {
  daily: DailyData;
  openThread?: (ctx: ThreadContext) => void;
}

export default function Almanac({ daily, openThread }: AlmanacProps) {
  const isMobile = useIsMobile();
  const [venture, setVenture] = useState<DailyVenture | null>(null);
  const [offset, setOffset] = useState(0);
  const [archiveEdition, setArchiveEdition] = useState<DailyData | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [liveEdition, setLiveEdition] = useState<DailyData | null>(null);
  const [recrawlStatus, setRecrawlStatus] = useState<RecrawlStatus>("idle");
  const [recrawlPhase, setRecrawlPhase] = useState<string>("");

  const loadTodayEdition = useCallback(async () => {
    const today = fmtIso(dateForOffset(0));
    const res = await fetch(`/api/almanac/editions?date=${today}&t=${Date.now()}`);
    if (!res.ok) throw new Error(`Edition fetch failed (${res.status})`);
    const data = await res.json();
    if (data?.edition) setLiveEdition(data.edition);
  }, []);

  // Fetch live KV edition for today — supersedes the static fixture when the generator has run
  useEffect(() => {
    loadTodayEdition()
      .catch(() => {});
  }, [loadTodayEdition]);

  // Fetch stored immutable snapshot when navigating to a past date
  useEffect(() => {
    if (offset >= 0) {
      setArchiveEdition(null);
      return;
    }
    const d = fmtIso(dateForOffset(offset));
    setArchiveLoading(true);
    fetch(`/api/almanac/editions?date=${d}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (data?.edition) setArchiveEdition(data.edition); })
      .catch(() => {})
      .finally(() => setArchiveLoading(false));
  }, [offset]);

  const isToday = offset === 0;
  const date = almanacIsoForOffset(offset);
  const dayIdx = daysSinceAlmanacEpoch(date);
  const vis: "hover" | "compact" | "readonly" = isToday ? (isMobile ? "compact" : "hover") : "readonly";

  // Priority: archive snapshot (past) > live KV edition (today) > static fixture (fallback)
  const rawBase = offset < 0 && archiveEdition ? archiveEdition
    : offset === 0 && liveEdition ? liveEdition
    : daily;

  const base: DailyData = {
    ...rawBase,
    image: hasCuratedImage(rawBase.image) ? rawBase.image : daily.image,
    poems: rawBase.poems?.length ? rawBase.poems : daily.poems,
    longReads: rawBase.longReads?.length ? rawBase.longReads : daily.longReads,
    austinExplores: rawBase.austinExplores?.length ? rawBase.austinExplores : daily.austinExplores,
  };

  const lead = "image" as const;
  const rest = DEFAULT_DEPT_ITEMS;

  // Build resolved daily with the right picks for this dayIdx
  const resolved: DailyData = {
    ...base,
    ventures: [base.ventures[((Math.floor(dayIdx / 3) % base.ventures.length) + base.ventures.length) % base.ventures.length]],
    charts: [pick(base.charts, dayIdx)],
    surprises: [pick(base.surprises, dayIdx)],
  };

  const quote = pick(base.quotes, dayIdx);
  const parentQuote = pick(base.parentingQuotes, dayIdx);
  const surprise = pick(base.surprises, dayIdx);

  // Workshop row — fall back to the fixture pools when an archived edition predates the feature.
  const riffPool = base.riffs?.length ? base.riffs : (daily.riffs ?? []);
  const clipPool = base.productionClips?.length ? base.productionClips : (daily.productionClips ?? []);
  const poemPool = base.poems?.length ? base.poems : (daily.poems?.length ? daily.poems : FALLBACK_POEMS);
  const longReadPool = base.longReads?.length ? base.longReads : (daily.longReads?.length ? daily.longReads : FALLBACK_LONG_READS);
  const austinExplorePool = base.austinExplores?.length ? base.austinExplores : (daily.austinExplores?.length ? daily.austinExplores : FALLBACK_AUSTIN_EXPLORES);
  const riff = riffPool.length ? pick(riffPool, dayIdx) : null;
  const clip = clipPool.length ? pick(clipPool, dayIdx) : null;
  const poem = poemPool.length ? pick(poemPool, dayIdx) : null;
  const longRead = longReadPool.length ? pick(longReadPool, dayIdx) : null;
  const austinExplore = austinExplorePool.length ? pick(austinExplorePool, dayIdx) : null;
  const deptItems: Array<"article" | "venture" | "chart" | "longread-card"> = longRead ? ["article", "longread-card", "venture", "chart"] : rest;
  const editionNo = resolved.edition || almanacEditionNumber(date);
  const curDate = dateForOffset(offset);
  const heroImage = heroImageForDate(dayIdx);

  const applyRunStatus = useCallback(async (run: AlmanacRunStatus, announceDone = false) => {
    const providerSuffix = run.provider ? ` · ${run.provider}` : "";
    if (run.status === "queued" || run.status === "running") {
      setRecrawlStatus("working");
      setRecrawlPhase(`${run.phase || "Running"}${providerSuffix}`);
      return;
    }
    if (run.status === "done") {
      await loadTodayEdition().catch(() => {});
      if (!announceDone) return;
      setRecrawlStatus("done");
      setRecrawlPhase(`${run.phase || "Updated"}${providerSuffix}`);
      showToast("Today's Almanac has been regenerated");
      window.setTimeout(() => {
        setRecrawlStatus("idle");
        setRecrawlPhase("");
      }, 3200);
      return;
    }
    if (run.status === "error") {
      setRecrawlStatus("error");
      setRecrawlPhase(run.error || run.phase || "Failed");
    }
  }, [loadTodayEdition]);

  const recrawlToday = async () => {
    if (recrawlStatus === "working") return;
    const today = fmtIso(dateForOffset(0));
    setRecrawlStatus("working");
    setRecrawlPhase("Queued");
    try {
      await postAlmanacRegenerate(today);
      showToast("Today's Almanac recrawl is running");
    } catch {
      setRecrawlStatus("error");
      setRecrawlPhase("");
      showToast("Could not start the Almanac recrawl");
    }
  };

  // Pick up recrawls queued by another session so the dashboard still shows
  // progress when it is opened after the job has started.
  useEffect(() => {
    if (!isToday) return;
    const today = fmtIso(dateForOffset(0));
    fetchAlmanacRunStatus(today)
      .then(run => applyRunStatus(run, false))
      .catch(() => {});
  }, [applyRunStatus, isToday]);

  useEffect(() => {
    if (!isToday || recrawlStatus !== "working") return;
    let cancelled = false;
    const today = fmtIso(dateForOffset(0));
    const poll = async () => {
      try {
        const run = await fetchAlmanacRunStatus(today);
        if (cancelled) return;
        await applyRunStatus(run, true);
      } catch {
        if (!cancelled) setRecrawlPhase("Waiting for status");
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [applyRunStatus, isToday, recrawlStatus]);

  // Snapshot today's edition to the archive on first render
  useEffect(() => {
    fetch("/api/almanac/editions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: fmtIso(dateForOffset(0)), edition: daily }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderBlock = (type: Genre, size: "lead" | "dept") => {
    const props: BlockProps = { d: resolved, size, visibility: vis, date, openThread, openVenture: setVenture };
    switch (type) {
      case "article": return <ArticleBlock {...props} />;
      case "venture": return <VentureBlock {...props} />;
      case "chart":   return <ChartBlock {...props} />;
      case "image":   return <ImageBlock {...props} />;
      default:        return null;
    }
  };

  if (archiveLoading) {
    return (
      <div className="almanac">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240, fontFamily: "'Lora',serif", fontStyle: "italic", color: "#9a8f7a", fontSize: 15 }}>
          Loading edition…
        </div>
      </div>
    );
  }

  return (
    <div className="almanac">
      {/* Masthead */}
      <div className={`almanac__masthead${isMobile ? " almanac__masthead--mobile" : ""}`}>
        <figure className={`almanacHero${isMobile ? " almanacHero--mobile" : ""}`}>
          <a
            className="almanacHero__link"
            href={heroImage.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${heroImage.title}, ${heroImage.location}. ${heroImage.credit}`}
            title={`${heroImage.title}, ${heroImage.location} · ${heroImage.credit}`}
          >
            <img
              className="almanacHero__image"
              src={heroImage.url}
              alt={`${heroImage.title}, ${heroImage.location}`}
              style={{ objectPosition: heroImage.position ?? "center" }}
            />
          </a>
          <figcaption className="almanacHero__caption almanacHero__caption--sr">
            <span className="almanacHero__label">Austin view of the day</span>
            <span className="almanacHero__place">{heroImage.title} · {heroImage.location}</span>
            <a className="almanacHero__credit" href={heroImage.sourceUrl} target="_blank" rel="noreferrer">
              {heroImage.credit}
            </a>
          </figcaption>
        </figure>
        <div className="almanac__titleRow">
          <div className="almanac__titleGroup">
            <span className={`almanac__title${isMobile ? " almanac__title--mobile" : ""}`}>The Almanac</span>
            <span className="almanac__eyebrow">{isToday ? "Curated for you · today's edition" : "From the archive"}</span>
            {isToday && (
              <button
                type="button"
                className={`almanacRecrawlBtn almanacRecrawlBtn--${recrawlStatus}`}
                onClick={recrawlToday}
                disabled={recrawlStatus === "working"}
                title="Ask OpenClaw to recrawl and regenerate today's Almanac"
                aria-live="polite"
              >
                {recrawlStatus === "working" && <span className="almanacRecrawlBtn__spinner" aria-hidden="true" />}
                <span>
                  {recrawlStatus === "working" ? (recrawlPhase || "Recrawling...") : recrawlStatus === "done" ? "Recrawl updated" : recrawlStatus === "error" ? "Retry recrawl" : "Recrawl today"}
                </span>
              </button>
            )}
          </div>
          <EditionNav offset={offset} setOffset={setOffset} isMobile={isMobile} />
        </div>
        <div className="almanac__rule">
          <span className="almanac__edition">{editionNo} · {fmtLong(curDate)}</span>
          {!isToday && <span className="almanac__archiveNote">↩ a past edition — feedback is closed</span>}
        </div>
      </div>

      {/* Lead */}
      <div className={`almanac__content${isMobile ? " almanac__content--mobile" : ""}`}>
        {austinExplore && (
          <div className="almanacExploreWrap almanacExploreWrap--top">
            <AustinExploreBlock explore={austinExplore} visibility={vis} date={date} openThread={openThread} />
          </div>
        )}

        {(poem || quote || parentQuote) && (
          <div className={`almanacOpeningStack${isMobile ? " almanacOpeningStack--mobile" : ""}`}>
            <QuoteCard quote={quote} label="On the mind" />
            <QuoteCard quote={parentQuote} label="On raising them" />
            {poem && <PoemBlock poem={poem} visibility={vis} date={date} openThread={openThread} />}
          </div>
        )}

        <div className="almanac__lead">
          {renderBlock(lead, "lead")}
        </div>

        {/* Departments */}
        <div className={`almanac__depts${longRead ? " almanac__depts--withLongRead" : ""}${isMobile ? " almanac__depts--mobile" : ""}`}>
          {deptItems.map((t, i) => (
            <div key={t} className={`almanac__dept${!isMobile && i > 0 ? " almanac__dept--divided" : ""}`}>
              {t === "longread-card"
                ? (longRead ? <LongReadBlock read={longRead} visibility={vis} date={date} openThread={openThread} compact /> : null)
                : renderBlock(t, "dept")}
            </div>
          ))}
        </div>

        {/* Surprise */}
        <div className="almanac__surpriseWrap">
          <SurpriseBand s={surprise} visibility={vis} date={date} isMobile={isMobile} openThread={openThread} />
        </div>

        {/* Workshop — guitar riff + production clip of the day */}
        {(riff || clip) && (
          <div className="almanac__workshopWrap">
            <div className="almanac__workshopHead">
              <span className="almanac__workshopKicker">The Workshop</span>
              <span className="almanac__workshopSub">· something to learn &amp; save for later</span>
            </div>
            <div className={`almanac__workshop${isMobile ? " almanac__workshop--mobile" : ""}`}>
              {riff && <RiffBlock riff={riff} visibility={vis} date={date} openThread={openThread} />}
              {clip && <ProductionBlock clip={clip} visibility={vis} date={date} openThread={openThread} />}
            </div>
          </div>
        )}

      </div>

      <VentureModal venture={venture} date={date} readonly={!isToday} onClose={() => setVenture(null)} openThread={openThread} />
      <ToastHost />
    </div>
  );
}

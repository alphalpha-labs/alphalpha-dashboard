"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { DailyData, DailyVenture, DailyRiff, DailyProductionClip } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

// ── Genre tokens ─────────────────────────────────────────────────────────────
const GENRE = {
  article:   { label: "Reading",  color: "oklch(0.55 0.08 70)" },
  venture:   { label: "Venture",  color: "oklch(0.55 0.08 150)" },
  image:     { label: "Look",     color: "oklch(0.55 0.09 30)" },
  chart:     { label: "Signal",   color: "oklch(0.55 0.08 250)" },
  surprise:  { label: "Surprise", color: "oklch(0.62 0.10 70)" },
  riff:      { label: "Riff",     color: "oklch(0.55 0.12 25)" },
  production:{ label: "Studio",   color: "oklch(0.52 0.11 305)" },
} as const;
type Genre = keyof typeof GENRE;

const LEAD_ORDER: Genre[] = ["image", "article", "venture", "chart"];
const TODAY_DAY = Math.floor(Date.now() / 864e5);

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WDAYS_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function dateForOffset(o: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + o);
  return d;
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
type KeepRecord = { itemId: string; genre: string; title: string; sub?: string; keptAt: number; date: string };
type TuneRecord  = { itemId: string; reaction: "more" | "less" | null; chips: string[]; note: string; at: number; date: string };
type FeedbackState = { keeps: Record<string, KeepRecord>; tunes: Record<string, TuneRecord> };
type RecrawlStatus = "idle" | "working" | "done" | "error";
type AlmanacRunStatus = {
  status?: "idle" | "running" | "done" | "error";
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

async function loadFeedback(date: string): Promise<FeedbackState> {
  if (feedbackCache[date]) return feedbackCache[date];
  if (feedbackInflight[date]) return feedbackInflight[date];
  const p = (async () => {
    try {
      const res = await fetch(`/api/almanac/feedback?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        feedbackCache[date] = data;
        return data;
      }
    } catch {}
    feedbackCache[date] = { keeps: {}, tunes: {} };
    return feedbackCache[date];
  })();
  feedbackInflight[date] = p;
  try { return await p; } finally { delete feedbackInflight[date]; }
}

async function persistKeep(date: string, keep: KeepRecord | null, itemId: string) {
  const body = keep
    ? { ...keep, date, type: "keep", itemId }
    : { date, type: "keep", itemId, remove: true };
  await fetch("/api/almanac/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

async function persistTune(date: string, tune: TuneRecord) {
  await fetch("/api/almanac/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...tune, date, type: "tune" }),
  }).catch(() => {});
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
  return feedbackCache[date] ?? { keeps: {}, tunes: {} };
}

function toggleKeep(date: string, item: { id: string; genre: string; title: string; sub?: string }) {
  const state = feedbackCache[date] ?? { keeps: {}, tunes: {} };
  const existing = state.keeps[item.id];
  const next = { ...state };
  if (existing) {
    const n = { ...next.keeps };
    delete n[item.id];
    next.keeps = n;
    feedbackCache[date] = next;
    persistKeep(date, null, item.id);
  } else {
    const rec: KeepRecord = { itemId: item.id, genre: item.genre, title: item.title, sub: item.sub, keptAt: Date.now(), date };
    next.keeps = { ...next.keeps, [item.id]: rec };
    feedbackCache[date] = next;
    persistKeep(date, rec, item.id);
    showToast("✦ Kept to your collection");
  }
  feedbackSubs.forEach(fn => fn());
}

function saveTune(date: string, tune: TuneRecord) {
  const state = feedbackCache[date] ?? { keeps: {}, tunes: {} };
  feedbackCache[date] = { ...state, tunes: { ...state.tunes, [tune.itemId]: tune } };
  persistTune(date, tune);
  feedbackSubs.forEach(fn => fn());
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

interface TuneStripProps {
  visibility: "hover" | "always" | "readonly" | "none";
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
  const [done, setDone] = useState(false);

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

  const submit = () => {
    if (!reaction && chips.size === 0 && !note.trim()) { setOpen(false); return; }
    saveTune(date, { itemId: item.id, reaction, chips: [...chips], note: note.trim(), at: Date.now(), date });
    setDone(true);
    setTimeout(() => { setOpen(false); setTimeout(() => setDone(false), 300); }, 1600);
  };

  const wrapCls = visibility === "always" ? "almanacTuneRow almanacTuneRow--on" : "almanacTuneRow";

  const keepEl = (
    <KeepBtn kept={kept} onClick={() => toggleKeep(date, { id: item.id, genre: item.genre, title: item.title, sub: item.sub })} />
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

  return (
    <div style={{ marginTop: compact ? 12 : 18 }}>
      <div className={wrapCls}>
        {visibility !== "hover" && keepEl}
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {visibility === "hover" && keepEl}
          {tuneBtn}
          {discussBtn}
        </span>
      </div>
      {open && (
        <div className="almanacTunePanel">
          {done ? (
            <div className="almanacTunePanel__confirm">
              <span>✓</span> Noted — tomorrow&apos;s edition will lean that way.
            </div>
          ) : (
            <>
              <div className="almanacTunePanel__header">Tune tomorrow&apos;s edition</div>
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
                <input value={note} onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submit(); }}
                  placeholder="tell Alphalpha why… (optional)"
                  className="almanacTunePanel__noteInput" />
                <button onClick={submit} className="almanacTunePanel__save">
                  {saved ? "Update" : "Save"}
                </button>
              </div>
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
  visibility: "hover" | "always" | "readonly" | "none";
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
  const item = { id: "image:daily", genre: "image" as Genre, title, sub: "Curated for your taste" };
  const hasImage = !!d.image.url;
  return (
    <div className="card-hoverable">
      <Kicker genre="image" extra={lead ? "Curated for your taste" : "for your taste"} />
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
  visibility: "hover" | "always" | "readonly" | "none";
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

  const dayIdx = TODAY_DAY + offset;
  const isToday = offset === 0;
  const date = fmtIso(dateForOffset(offset));
  const vis: "hover" | "always" | "readonly" = isToday ? (isMobile ? "always" : "hover") : "readonly";

  // Priority: archive snapshot (past) > live KV edition (today) > static fixture (fallback)
  const base = offset < 0 && archiveEdition ? archiveEdition
    : offset === 0 && liveEdition ? liveEdition
    : daily;

  const lead = LEAD_ORDER[((dayIdx % LEAD_ORDER.length) + LEAD_ORDER.length) % LEAD_ORDER.length];
  const rest = LEAD_ORDER.filter(t => t !== lead);

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
  const riff = riffPool.length ? pick(riffPool, dayIdx) : null;
  const clip = clipPool.length ? pick(clipPool, dayIdx) : null;
  const editionNo = resolved.edition || `No. ${214 + offset}`;
  const curDate = dateForOffset(offset);

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

  useEffect(() => {
    if (!isToday || recrawlStatus !== "working") return;
    let cancelled = false;
    const today = fmtIso(dateForOffset(0));
    const poll = async () => {
      try {
        const run = await fetchAlmanacRunStatus(today);
        if (cancelled) return;
        setRecrawlPhase(run.phase || (run.status === "running" ? "Running" : ""));
        if (run.status === "done") {
          await loadTodayEdition().catch(() => {});
          if (!cancelled) {
            setRecrawlStatus("done");
            setRecrawlPhase("Updated");
            showToast("Today's Almanac has been regenerated");
            window.setTimeout(() => {
              setRecrawlStatus("idle");
              setRecrawlPhase("");
            }, 3200);
          }
        } else if (run.status === "error") {
          setRecrawlStatus("error");
          setRecrawlPhase(run.error || "Failed");
        }
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
  }, [isToday, loadTodayEdition, recrawlStatus]);

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
        <div className="almanac__lead">
          {renderBlock(lead, "lead")}
        </div>

        {/* Departments */}
        <div className={`almanac__depts${isMobile ? " almanac__depts--mobile" : ""}`}>
          {rest.map((t, i) => (
            <div key={t} className={`almanac__dept${!isMobile && i > 0 ? " almanac__dept--divided" : ""}`}>
              {renderBlock(t, "dept")}
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

        {/* Colophon */}
        <div className={`almanac__colophon${isMobile ? " almanac__colophon--mobile" : ""}`}>
          {[{ q: quote, label: "On the mind" }, { q: parentQuote, label: "On raising them" }].map(({ q, label }, i) => (
            <div key={label} className="almanac__colophonGroup" style={{ display: "contents" }}>
              {i === 1 && !isMobile && <div className="almanac__colophonRule" />}
              {i === 1 && isMobile && <div className="almanac__colophonRuleMobile" />}
              <div className="almanac__colophonQuote">
                <div className="almanac__colophonLabel">{label}</div>
                <div className="almanac__colophonText">&ldquo;{q.text}&rdquo;</div>
                <div className="almanac__colophonSource">{q.source}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <VentureModal venture={venture} date={date} readonly={!isToday} onClose={() => setVenture(null)} openThread={openThread} />
      <ToastHost />
    </div>
  );
}

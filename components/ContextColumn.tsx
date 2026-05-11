"use client";
import { useState } from "react";
import type { DashboardData, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import QuickAdd from "./QuickAdd";
import ActivityPanel from "./ActivityPanel";

interface Props {
  meta:      DashboardData["meta"];
  loops:     Loop[];
  investing: DashboardData["investing"];
  digests:   DashboardData["digests"];
  onAdd:           (input: import("./QuickAdd").CaptureInput) => void;
  onEventFeedback: (eventId: string, feedbackType: string, payload: object) => void;
  onDiscuss:       (ctx: ThreadContext) => void;
}

export default function ContextColumn({ meta, loops, investing, digests, onAdd, onEventFeedback, onDiscuss }: Props) {
  const [loopsOpen,   setLoopsOpen]   = useState(true);
  const [investOpen,  setInvestOpen]  = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [sourceDetail, setSourceDetail] = useState<string | null>(null);
  const [eventsOpen,  setEventsOpen]  = useState(false);
  const [digestsOpen, setDigestsOpen] = useState(false);

  const activeLoops = loops.filter(l => !l.done && !l.snoozed);
  const sourceHealth = meta.sourceHealth || [];
  const eventCandidates = meta.eventCandidates || [];

  return (
    <aside className="contextColumn">
      <div className="postureBlock">
        <p className="postureLabel">Today&apos;s Posture</p>
        <p className="postureQuote">&ldquo;{meta.posture}&rdquo;</p>
        <p className="postureBody">{meta.postureDetail}</p>
        {meta.deployment && (
          <div className="deploymentMini">
            <span>Deploy</span>
            <strong>{meta.deployment.branch}@{meta.deployment.commit}</strong>
            <em>{formatDate(meta.deployment.generatedAt)}</em>
          </div>
        )}
      </div>

      <QuickAdd onAdd={onAdd} />

      <ActivityPanel activity={meta.activity} />

      {/* Open Loops */}
      <div>
        <div className="collapsibleHeader" onClick={() => setLoopsOpen(o => !o)}>
          <span className="collapsibleTitle">
            Open loops
            <span className="collapsibleCount">{activeLoops.length}</span>
          </span>
          <span className={`collapsibleChevron${loopsOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {loopsOpen && (
          <div>
            {activeLoops.slice(0, 6).map(loop => (
              <div key={loop.id} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: loop.id, type: "loop", title: loop.text, project: loop.project, priority: loop.priority })}
                >
                  {loop.text}
                </div>
                <div className="ctxLoopProject">{loop.project}</div>
              </div>
            ))}
            {activeLoops.length > 6 && (
              <span className="ctxViewAll">View all {activeLoops.length} →</span>
            )}
          </div>
        )}
      </div>

      {/* Investing */}
      <div>
        <div className="collapsibleHeader" onClick={() => setInvestOpen(o => !o)}>
          <span className="collapsibleTitle">
            Investing
            <span className="collapsibleCount">{investing.length}</span>
          </span>
          <span className={`collapsibleChevron${investOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {investOpen && (
          <div>
            {investing.slice(0, 5).map(t => (
              <div key={t.ticker} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: t.ticker, type: "ticker", title: t.ticker, theme: t.theme, stance: t.stance })}
                >
                  <strong style={{ fontFamily: "monospace" }}>{t.ticker}</strong> — {t.theme}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source health */}
      <div>
        <div className="collapsibleHeader" onClick={() => setSourcesOpen(o => !o)}>
          <span className="collapsibleTitle">
            Source health
            <span className="collapsibleCount">{sourceHealth.length}</span>
          </span>
          <span className={`collapsibleChevron${sourcesOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {sourcesOpen && (
          <div>
            {sourceHealth.map(source => (
              <div key={source.id} className="ctxLoopItem">
                <div className="ctxLoopText" onClick={() => setSourceDetail(sourceDetail === source.id ? null : source.id)}>
                  <strong>{source.label}</strong> — {source.summary}
                </div>
                <div className="ctxLoopProject">{source.status} · {source.age} · {source.path}</div>
                {sourceDetail === source.id && (
                  <div className="sourceDetails">
                    <p>{source.detail}</p>
                    {(source.details || []).length > 0 ? source.details?.map((detail, idx) => (
                      <div key={`${source.id}-${idx}`} className="sourceDetailRow">
                        <span>{detail.label}</span>
                        <strong>{detail.value}</strong>
                      </div>
                    )) : <p>No drill-down rows available yet.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event feedback */}
      <div>
        <div className="collapsibleHeader" onClick={() => setEventsOpen(o => !o)}>
          <span className="collapsibleTitle">
            Event feedback
            <span className="collapsibleCount">{eventCandidates.length}</span>
          </span>
          <span className={`collapsibleChevron${eventsOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {eventsOpen && (
          <div>
            {eventCandidates.slice(0, 6).map(event => (
              <div key={`${event.kind}-${event.id}`} className="ctxLoopItem">
                <div className="ctxLoopText">{event.title}</div>
                <div className="ctxLoopProject">
                  {event.kind} · {event.source || "source unknown"}{event.distanceMiles != null ? ` · ${event.distanceMiles} mi` : ""}
                </div>
                <div className="ctxFeedbackActions">
                  <button
                    className="ctxFeedbackBtn"
                    onClick={() => onEventFeedback(event.id, "more-like-this", event)}
                  >More like this</button>
                  <button
                    className="ctxFeedbackBtn"
                    onClick={() => onEventFeedback(event.id, event.kind === "family" ? "not-kid-appropriate" : "not-my-music", event)}
                  >Not fit</button>
                  <button
                    className="ctxFeedbackBtn"
                    onClick={() => onEventFeedback(event.id, "too-far", event)}
                  >Too far</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Digests */}
      <div>
        <div className="collapsibleHeader" onClick={() => setDigestsOpen(o => !o)}>
          <span className="collapsibleTitle">
            Digests
            <span className="collapsibleCount">{digests.length}</span>
          </span>
          <span className={`collapsibleChevron${digestsOpen ? "" : " collapsibleChevron--closed"}`}>▾</span>
        </div>
        {digestsOpen && (
          <div>
            {digests.slice(0, 4).map(d => (
              <div key={d.id} className="ctxLoopItem">
                <div
                  className="ctxLoopText"
                  onClick={() => onDiscuss({ id: d.id, type: "digest", title: d.title, summary: d.summary, category: d.category })}
                >
                  {d.title}
                </div>
                <div className="ctxLoopProject">{d.category}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

"use client";
import { useState } from "react";
import type { DashboardData, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import QuickAdd from "./QuickAdd";

interface Props {
  meta:      DashboardData["meta"];
  loops:     Loop[];
  investing: DashboardData["investing"];
  digests:   DashboardData["digests"];
  onAdd:     (text: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function ContextColumn({ meta, loops, investing, digests, onAdd, onDiscuss }: Props) {
  const [loopsOpen,   setLoopsOpen]   = useState(true);
  const [investOpen,  setInvestOpen]  = useState(false);
  const [digestsOpen, setDigestsOpen] = useState(false);

  const activeLoops = loops.filter(l => !l.done && !l.snoozed);

  return (
    <aside className="contextColumn">
      <div className="postureBlock">
        <p className="postureLabel">Today&apos;s Posture</p>
        <p className="postureQuote">&ldquo;{meta.posture}&rdquo;</p>
        <p className="postureBody">{meta.postureDetail}</p>
      </div>

      <QuickAdd onAdd={onAdd} />

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

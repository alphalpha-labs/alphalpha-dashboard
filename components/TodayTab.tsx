"use client";
import { useState, useEffect } from "react";
import type { DashboardData, Action, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import FocusCard from "./FocusCard";
import ContextColumn from "./ContextColumn";
import Almanac from "./Almanac";
import DailyBriefing from "./DailyBriefing";

const STORAGE_KEY = "alphalpha.todayView.v2";

interface Props {
  data:            DashboardData;
  activeActions:   Action[];
  snoozedActions:  Action[];
  loops:           Loop[];
  focusIdx:        number;
  onDone:          (id: string) => void;
  onSnooze:        (id: string, label: string) => void;
  onSkip:          () => void;
  onWake:          (id: string) => void;
  onAdd:           (input: import("./QuickAdd").CaptureInput) => void;
  onEventFeedback: (eventId: string, feedbackType: string, payload: object) => void;
  onDiscuss:       (ctx: ThreadContext) => void;
  mode?:           "almanac" | "workspace";
}

export default function TodayTab({ data, activeActions, snoozedActions, loops, focusIdx, onDone, onSnooze, onSkip, onWake, onAdd, onEventFeedback, onDiscuss, mode = "almanac" }: Props) {
  const current = activeActions[focusIdx % Math.max(activeActions.length, 1)];
  const highCount = activeActions.filter(a => a.priority === "HIGH").length;

  const [view, setView] = useState<"briefing" | "desk">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "briefing" || saved === "desk") return saved;
    }
    return "briefing";
  });

  const switchView = (v: "briefing" | "desk") => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, v);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%" }}>
      {mode === "almanac" ? (
        <div style={{ flex: 1, overflowY: "auto", width: "100%" }}>
          {data.daily
            ? <Almanac daily={data.daily} openThread={onDiscuss} />
            : (
              <div className="almanacState almanacState--empty" role="status">
                <span className="almanacState__kicker">Edition unavailable</span>
                <h1>There is no Almanac to open yet.</h1>
                <p>The previous dashboard data remains safe. Open System to regenerate the edition.</p>
              </div>
            )}
        </div>
      ) : (
        <>

      <div className="todayToggleBar">
        <div className="todayToggle">
          {(["briefing", "desk"] as const).map(v => {
            const on = view === v;
            return (
              <button key={v} onClick={() => switchView(v)} className={`todayToggle__btn${on ? " todayToggle__btn--on" : ""}`}>
                {v === "briefing" ? "Briefing" : "Focus"}
                {v === "desk" && highCount > 0 && (
                  <span className={`todayToggle__badge${on ? " todayToggle__badge--on" : ""}`}>{highCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {view === "briefing" && (
        <div className="todayScroll">
          <DailyBriefing
            data={data}
            actions={activeActions}
            loops={loops}
            onDone={onDone}
            onAdd={onAdd}
            onDiscuss={onDiscuss}
            onOpenDesk={() => switchView("desk")}
          />
        </div>
      )}

      {/* Desk — existing focus stage */}
      {view === "desk" && (
        <div className="todayLayout">
          <FocusCard
            current={current}
            activeActions={activeActions}
            focusIdx={focusIdx}
            snoozedActions={snoozedActions}
            onDone={onDone}
            onSnooze={onSnooze}
            onSkip={onSkip}
            onWake={onWake}
            onDiscuss={onDiscuss}
          />
          <ContextColumn
            meta={data.meta}
            loops={loops}
            investing={data.investing}
            digests={data.digests}
            onAdd={onAdd}
            onEventFeedback={onEventFeedback}
            onDiscuss={onDiscuss}
          />
        </div>
      )}
        </>
      )}
    </div>
  );
}

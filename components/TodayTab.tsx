"use client";
import { useState, useEffect } from "react";
import type { DashboardData, Action, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import FocusCard from "./FocusCard";
import ContextColumn from "./ContextColumn";
import Almanac from "./Almanac";

const STORAGE_KEY = "alphalpha.todayView.v1";

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
}

export default function TodayTab({ data, activeActions, snoozedActions, loops, focusIdx, onDone, onSnooze, onSkip, onWake, onAdd, onEventFeedback, onDiscuss }: Props) {
  const current = activeActions[focusIdx % Math.max(activeActions.length, 1)];
  const highCount = activeActions.filter(a => a.priority === "HIGH").length;

  const [view, setView] = useState<"edition" | "desk">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "desk" || saved === "edition") return saved;
    }
    return "edition";
  });

  const switchView = (v: "edition" | "desk") => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, v);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", width: "100%" }}>

      {/* Edition / Desk toggle */}
      <div className="todayToggleBar">
        <div className="todayToggle">
          {(["edition", "desk"] as const).map(v => {
            const on = view === v;
            return (
              <button key={v} onClick={() => switchView(v)} className={`todayToggle__btn${on ? " todayToggle__btn--on" : ""}`}>
                {v === "edition" ? "Edition" : "Desk"}
                {v === "desk" && highCount > 0 && (
                  <span className={`todayToggle__badge${on ? " todayToggle__badge--on" : ""}`}>{highCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Edition — The Almanac */}
      {view === "edition" && (
        <div style={{ flex: 1, overflowY: "auto", width: "100%" }}>
          {data.daily
            ? <Almanac daily={data.daily} isMobile={false} openThread={onDiscuss} />
            : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: "'Lora',serif", fontStyle: "italic", color: "#9a8f7a", fontSize: 15 }}>
                No edition data — run <code style={{ fontStyle: "normal", fontSize: 13, background: "#ede8de", padding: "2px 6px", borderRadius: 4 }}>npm run generate:data</code> to populate.
              </div>
            )
          }
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
    </div>
  );
}

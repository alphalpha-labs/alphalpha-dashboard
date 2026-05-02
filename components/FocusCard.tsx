"use client";
import { useState, useRef, useEffect } from "react";
import type { Action } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

const SNOOZE_OPTIONS = [
  { label: "Later today",  hrs: "4 hrs",  value: "Later today"  },
  { label: "Tomorrow",     hrs: "24 hrs", value: "Tomorrow"     },
  { label: "In 3 days",    hrs: "72 hrs", value: "In 3 days"    },
  { label: "Next week",    hrs: "7 days", value: "Next week"    },
];

interface Props {
  current:        Action | undefined;
  activeActions:  Action[];
  focusIdx:       number;
  snoozedActions: Action[];
  onDone:         (id: string) => void;
  onSnooze:       (id: string, label: string) => void;
  onSkip:         () => void;
  onWake:         (id: string) => void;
  onDiscuss:      (ctx: ThreadContext) => void;
}

export default function FocusCard({ current, activeActions, focusIdx, snoozedActions, onDone, onSnooze, onSkip, onWake, onDiscuss }: Props) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [exiting,    setExiting]    = useState(false);
  const snoozeRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!snoozeOpen) return;
    const handle = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) setSnoozeOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [snoozeOpen]);

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  const triggerExit = (cb: () => void) => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setExiting(true);
    exitTimer.current = setTimeout(() => { setExiting(false); cb(); }, 260);
  };

  if (!current) {
    return (
      <div className="focusStage">
        <p style={{ fontFamily: "'Lora', serif", fontStyle: "italic", color: "var(--ink-muted)" }}>
          All done for now. Add a loop to continue.
        </p>
        {snoozedActions.length > 0 && <SnoozedStrip snoozedActions={snoozedActions} onWake={onWake} />}
      </div>
    );
  }

  const priorityClass = current.priority === "HIGH" ? "high" : current.priority === "MEDIUM" ? "med" : "low";
  const tagLabel = current.priority === "HIGH" ? "Needs a decision" : "Next up";
  const remaining = activeActions.length - 1;

  return (
    <div className="focusStage">
      {/* Progress dots */}
      <div className="progressDots">
        {activeActions.map((_, i) => (
          <span
            key={i}
            className={`dot${i === focusIdx % Math.max(activeActions.length, 1) ? " dot--active" : ""}`}
          />
        ))}
      </div>

      <div className={`focusCardContent${exiting ? " focusCardContent--exiting" : ""}`}>
        <div className={`priorityTag priorityTag--${priorityClass}`}>
          <span className="priorityDot" />
          {tagLabel.toUpperCase()} · {current.project.toUpperCase()}
        </div>
        <h1 className="focusTitle">{current.title}</h1>
        <p className="focusNext">Next → {current.next}</p>

        <div className="focusActions">
          <button className="btnDone" onClick={() => triggerExit(() => onDone(current.id))}>
            Done ✓
          </button>
          <div style={{ position: "relative" }} ref={snoozeRef}>
            <button className="btnOutlined" onClick={() => setSnoozeOpen(o => !o)}>
              Snooze 💤
            </button>
            {snoozeOpen && (
              <div className="snoozePicker">
                <div className="snoozePickerLabel">Snooze until</div>
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className="snoozeOption"
                    onClick={() => { setSnoozeOpen(false); triggerExit(() => onSnooze(current.id, opt.value)); }}
                  >
                    {opt.label} <span className="snoozeHrs">{opt.hrs}</span>
                  </button>
                ))}
                <button className="snoozeOption" onClick={() => setSnoozeOpen(false)}>Cancel</button>
              </div>
            )}
          </div>
          <button className="btnOutlined" onClick={() => triggerExit(onSkip)}>
            Skip →
          </button>
        </div>

        <button
          className="btnDiscuss"
          onClick={() => onDiscuss({ id: current.id, type: "decision", title: current.title, project: current.project, priority: current.priority, next: current.next })}
        >
          <span className="alphaGlyph">α</span> Discuss with Alphalpha
        </button>

        {remaining > 0 && (
          <p className="focusRemaining">{remaining} more waiting</p>
        )}
      </div>

      {snoozedActions.length > 0 && <SnoozedStrip snoozedActions={snoozedActions} onWake={onWake} />}
    </div>
  );
}

function SnoozedStrip({ snoozedActions, onWake }: { snoozedActions: Action[]; onWake: (id: string) => void }) {
  return (
    <div className="snoozedStrip" style={{ marginTop: 32, width: "100%" }}>
      <span className="snoozedStripLabel">Snoozed</span>
      {snoozedActions.map(a => (
        <span key={a.id} className="snoozedChip">
          💤 {a.title.slice(0, 30)}{a.title.length > 30 ? "…" : ""} · {a.snoozeLabel}
          <button className="snoozedWake" onClick={() => onWake(a.id)}>✕</button>
        </span>
      ))}
    </div>
  );
}

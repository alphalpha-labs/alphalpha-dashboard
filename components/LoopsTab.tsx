"use client";
import { useState, useRef, useEffect } from "react";
import type { Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import QuickAdd from "./QuickAdd";

const SNOOZE_OPTIONS = [
  { label: "Later today", value: "Later today" },
  { label: "Tomorrow",    value: "Tomorrow"    },
  { label: "In 3 days",   value: "In 3 days"   },
  { label: "Next week",   value: "Next week"   },
];

interface Props {
  loops:     Loop[];
  onDone:    (id: string) => void;
  onSnooze:  (id: string, label: string) => void;
  onAdd:     (text: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function LoopsTab({ loops, onDone, onSnooze, onAdd, onDiscuss }: Props) {
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const active  = loops.filter(l => !l.done && !l.snoozed);
  const snoozed = loops.filter(l => l.snoozed);
  const done    = loops.filter(l => l.done);

  return (
    <div className="tabPage">
      <h1 className="tabTitle">Open loops</h1>
      <p className="tabSubtitle">{active.length} items in flight</p>
      <QuickAdd onAdd={onAdd} />
      {active.map(loop => (
        <LoopRow
          key={loop.id}
          loop={loop}
          snoozing={snoozingId === loop.id}
          onOpenSnooze={() => setSnoozingId(loop.id)}
          onCloseSnooze={() => setSnoozingId(null)}
          onDone={onDone}
          onSnooze={onSnooze}
          onDiscuss={onDiscuss}
        />
      ))}
      {snoozed.length > 0 && (
        <>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 24 }}>Snoozed</p>
          {snoozed.map(loop => (
            <div key={loop.id} className="loopRow loopRow--snoozed">
              <span className={`loopDot loopDot--${loop.priority}`} />
              <div className="loopBody">
                <div className="loopText">{loop.text}</div>
                <div className="loopProject">{loop.project} · {loop.snoozeLabel}</div>
              </div>
              <div className="loopActions" style={{ opacity: 1 }}>
                <button className="loopActionBtn" onClick={() => onSnooze(loop.id, "")}>Wake</button>
              </div>
            </div>
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 24 }}>Done</p>
          {done.map(loop => (
            <div key={loop.id} className="loopRow loopRow--done">
              <span className={`loopDot loopDot--${loop.priority}`} />
              <div className="loopBody">
                <div className="loopText">{loop.text}</div>
                <div className="loopProject">{loop.project}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function LoopRow({ loop, snoozing, onOpenSnooze, onCloseSnooze, onDone, onSnooze, onDiscuss }: {
  loop: Loop;
  snoozing: boolean;
  onOpenSnooze: () => void;
  onCloseSnooze: () => void;
  onDone:    (id: string) => void;
  onSnooze:  (id: string, label: string) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}) {
  const snoozeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!snoozing) return;
    const handle = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) onCloseSnooze();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [snoozing, onCloseSnooze]);

  return (
    <div className="loopRow">
      <span className={`loopDot loopDot--${loop.priority}`} />
      <div className="loopBody">
        <div className="loopText">{loop.text}</div>
        <div className="loopProject">{loop.project}</div>
      </div>
      <div className="loopActions">
        <button className="loopActionBtn" onClick={() => onDone(loop.id)}>✓</button>
        <div className="loopSnoozeWrap" ref={snoozeRef}>
          <button className="loopActionBtn" onClick={onOpenSnooze}>💤</button>
          {snoozing && (
            <div className="snoozePicker" style={{ right: "auto", left: 0 }}>
              <div className="snoozePickerLabel">Snooze until</div>
              {SNOOZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className="snoozeOption"
                  onClick={() => { onCloseSnooze(); onSnooze(loop.id, opt.value); }}
                >
                  {opt.label}
                </button>
              ))}
              <button className="snoozeOption" onClick={onCloseSnooze}>Cancel</button>
            </div>
          )}
        </div>
        <button
          className="loopActionBtn"
          onClick={() => onDiscuss({ id: loop.id, type: "loop", title: loop.text, project: loop.project, priority: loop.priority })}
        >
          α Discuss
        </button>
      </div>
    </div>
  );
}

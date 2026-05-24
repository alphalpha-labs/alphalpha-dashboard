"use client";
import { useMemo, useState } from "react";
import type { ReviewItem } from "@/lib/data";

interface Props {
  items: ReviewItem[];
  onAction: (itemId: string, action: string, payload?: object) => void;
}

const KIND_LABELS: Record<string, string> = {
  "obsidian-proposal": "Obsidian",
  "source-health": "Source health",
  "investing-review": "Investing",
  "automation-review": "Automation",
  "event-feedback": "Events",
};

const DECISION_LABELS: Record<string, string> = {
  write: "Approve write",
  loop: "Promote to loop",
  needsAlex: "Needs Alex",
  safe: "Safe auto-apply",
};

type StatusFilter = "pending" | "all" | "approved" | "dismissed";
type DecisionFilter = "all" | "write" | "loop" | "needsAlex" | "safe";

function decisionType(item: ReviewItem): DecisionFilter {
  if (item.kind === "obsidian-proposal") return "write";
  if (item.kind === "investing-review" || item.kind === "source-health") return "loop";
  if (item.priority === "HIGH" || item.kind === "automation-review") return "needsAlex";
  return "safe";
}

export default function ReviewTab({ items, onAction }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const pending = items.filter(i => i.status === "pending");
  const high = pending.filter(i => i.priority === "HIGH").length;
  const shown = useMemo(() => items.filter(item => {
    const statusOk = filter === "all" ? true : item.status === filter;
    const decisionOk = decisionFilter === "all" ? true : decisionType(item) === decisionFilter;
    return statusOk && decisionOk;
  }), [items, filter, decisionFilter]);

  const batchPromoteSafe = () => {
    pending.filter(item => decisionType(item) === "loop" && item.priority !== "HIGH").forEach(item => {
      onAction(item.id, "promote-loop", { text: item.title, batch: true });
    });
  };
  const batchDismissLowEvents = () => {
    pending.filter(item => item.kind === "event-feedback" && item.priority === "LOW").forEach(item => {
      onAction(item.id, "dismiss", { batch: true, reason: "low-priority event feedback item dismissed from batch control" });
    });
  };

  return (
    <div className="reviewPage">
      <div className="reviewHeader">
        <div>
          <h1 className="tabTitle">Review queue</h1>
          <p className="tabSubtitle">Approval inbox grouped by decision type, risk, and action</p>
        </div>
        <div className="reviewStats">
          <span>{pending.length} pending</span>
          <span>{high} high</span>
          <span>{items.length} total</span>
        </div>
      </div>

      <div className="reviewDecisionGrid">
        {(["write", "loop", "needsAlex", "safe"] as const).map(kind => {
          const count = pending.filter(item => decisionType(item) === kind).length;
          return <button key={kind} className={`decisionCard${decisionFilter === kind ? " decisionCard--active" : ""}`} onClick={() => setDecisionFilter(decisionFilter === kind ? "all" : kind)}>
            <strong>{count}</strong><span>{DECISION_LABELS[kind]}</span>
          </button>;
        })}
      </div>

      <div className="automationFilters reviewToolbar" aria-label="Review filters">
        {(["pending", "all", "approved", "dismissed"] as const).map(kind => (
          <button key={kind} className={`automationFilter${filter === kind ? " automationFilter--active" : ""}`} onClick={() => setFilter(kind)}>{kind}</button>
        ))}
        <button className="automationFilter" onClick={batchPromoteSafe}>Batch promote research/source loops</button>
        <button className="automationFilter" onClick={batchDismissLowEvents}>Batch dismiss low event feedback</button>
      </div>

      <div className="reviewList">
        {shown.map(item => (
          <article key={item.id} className={`reviewCard reviewCard--${item.priority.toLowerCase()}`}>
            <div className="reviewTop">
              <div>
                <div className="reviewMeta">
                  <span className={`reviewPriority reviewPriority--${item.priority}`}>{item.priority}</span>
                  <span>{KIND_LABELS[item.kind] || item.kind}</span>
                  <span>{DECISION_LABELS[decisionType(item)] || decisionType(item)}</span>
                  <span>{item.status}</span>
                </div>
                <h2 className="reviewTitle">{item.title}</h2>
              </div>
              <div className="reviewActions">
                <button className="automationBtn automationBtn--dark" onClick={() => onAction(item.id, "approve")}>Approve</button>
                <button className="automationBtn" onClick={() => onAction(item.id, "promote-loop", { text: item.title })}>Add loop</button>
                <button className="automationBtn" onClick={() => onAction(item.id, "refine")}>Refine</button>
                <button className="automationBtn" onClick={() => onAction(item.id, "dismiss")}>Dismiss</button>
              </div>
            </div>
            <p className="reviewSummary">{item.summary}</p>
            <div className="reviewGrid">
              <div><span>Source</span><strong>{item.source || "n/a"}</strong></div>
              <div><span>Target</span><strong>{item.target || "n/a"}</strong></div>
              <div><span>Hint</span><strong>{item.actionHint || "Review and decide"}</strong></div>
              <div><span>Generated</span><strong>{formatDate(item.generatedAt)}</strong></div>
            </div>
            <button className="reviewExpand" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
              {expanded === item.id ? "Hide payload" : "Show payload"}
            </button>
            {expanded === item.id && <pre className="reviewPayload">{JSON.stringify(item.payload ?? {}, null, 2)}</pre>}
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

"use client";
import { useState } from "react";
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

export default function ReviewTab({ items, onAction }: Props) {
  const [filter, setFilter] = useState<"pending" | "all" | "approved" | "dismissed">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const shown = items.filter(item => filter === "all" ? true : item.status === filter);
  const pending = items.filter(i => i.status === "pending");
  const high = pending.filter(i => i.priority === "HIGH").length;

  return (
    <div className="reviewPage">
      <div className="reviewHeader">
        <div>
          <h1 className="tabTitle">Review queue</h1>
          <p className="tabSubtitle">Approval inbox for proposed writes, synthesis, and decisions</p>
        </div>
        <div className="reviewStats">
          <span>{pending.length} pending</span>
          <span>{high} high</span>
          <span>{items.length} total</span>
        </div>
      </div>

      <div className="automationFilters" aria-label="Review filters">
        {(["pending", "all", "approved", "dismissed"] as const).map(kind => (
          <button key={kind} className={`automationFilter${filter === kind ? " automationFilter--active" : ""}`} onClick={() => setFilter(kind)}>
            {kind}
          </button>
        ))}
      </div>

      <div className="reviewList">
        {shown.map(item => (
          <article key={item.id} className={`reviewCard reviewCard--${item.priority.toLowerCase()}`}>
            <div className="reviewTop">
              <div>
                <div className="reviewMeta">
                  <span className={`reviewPriority reviewPriority--${item.priority}`}>{item.priority}</span>
                  <span>{KIND_LABELS[item.kind] || item.kind}</span>
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

"use client";
import { useState } from "react";
import type { AutomationJob } from "@/lib/data";

interface Props {
  automations: AutomationJob[];
  onAction: (jobId: string, action: string, payload?: object) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  ops: "Ops",
  events: "Events",
  obsidian: "Obsidian",
  investing: "Investing",
  personal: "Personal",
  automation: "Other",
};

export default function AutomationsTab({ automations, onAction }: Props) {
  const [filter, setFilter] = useState<"all" | "enabled" | "paused">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const shown = automations.filter(job => filter === "all" ? true : filter === "enabled" ? job.enabled : !job.enabled);
  const enabled = automations.filter(j => j.enabled).length;
  const paused = automations.length - enabled;
  const failing = automations.filter(j => j.lastStatus && j.lastStatus !== "ok").length;

  return (
    <div className="automationsPage">
      <div className="automationsHeader">
        <div>
          <h1 className="tabTitle">Automations</h1>
          <p className="tabSubtitle">Cron jobs, crawls, reminders, and scheduled agent runs</p>
        </div>
        <div className="automationStats">
          <span>{enabled} enabled</span>
          <span>{paused} paused</span>
          <span>{failing} failing</span>
        </div>
      </div>

      <div className="automationFilters" aria-label="Automation filters">
        {(["all", "enabled", "paused"] as const).map(kind => (
          <button key={kind} className={`automationFilter${filter === kind ? " automationFilter--active" : ""}`} onClick={() => setFilter(kind)}>
            {kind}
          </button>
        ))}
      </div>

      <div className="automationList">
        {shown.map(job => (
          <article key={job.id} className={`automationCard${job.enabled ? "" : " automationCard--paused"}`}>
            <div className="automationTop">
              <div>
                <div className="automationMeta">
                  <span className={`automationStatus automationStatus--${job.enabled ? "enabled" : "paused"}`}>{job.enabled ? "enabled" : "paused"}</span>
                  <span>{CATEGORY_LABELS[job.category] || job.category}</span>
                  {job.lightContext && <span>light context</span>}
                </div>
                <h2 className="automationName">{job.name}</h2>
              </div>
              <div className="automationActions">
                <button className="automationBtn" onClick={() => onAction(job.id, "run-now")}>Run now</button>
                <button className="automationBtn" onClick={() => onAction(job.id, job.enabled ? "pause" : "resume")}>{job.enabled ? "Pause" : "Resume"}</button>
                <button className="automationBtn" onClick={() => setEditing(editing === job.id ? null : job.id)}>Modify</button>
              </div>
            </div>

            <p className="automationSummary">{job.summary || job.description || "No description"}</p>
            <div className="automationGrid">
              <div><span>Schedule</span><strong>{job.scheduleLabel}</strong></div>
              <div><span>Next</span><strong>{formatDate(job.nextRunAt)}</strong></div>
              <div><span>Last</span><strong>{job.lastStatus || "n/a"}{job.lastDuration ? ` · ${job.lastDuration}` : ""}</strong></div>
              <div><span>Delivery</span><strong>{job.delivery || "silent"}</strong></div>
            </div>
            {job.consecutiveErrors ? <p className="automationWarning">{job.consecutiveErrors} consecutive errors</p> : null}
            {editing === job.id && <ScheduleEditor job={job} onAction={onAction} />}
          </article>
        ))}
      </div>
    </div>
  );
}

function ScheduleEditor({ job, onAction }: { job: AutomationJob; onAction: Props["onAction"] }) {
  const [cronExpr, setCronExpr] = useState(job.schedule?.kind === "cron" ? job.schedule.expr || "" : "");
  const [tz, setTz] = useState(job.schedule?.tz || "America/Chicago");
  const [every, setEvery] = useState("4 days");
  return (
    <div className="automationEditor">
      <div className="automationEditorRow">
        <input className="automationInput" value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="Cron expression, e.g. 0 8 * * 1" />
        <input className="automationInput automationInput--tz" value={tz} onChange={e => setTz(e.target.value)} placeholder="America/Chicago" />
        <button className="automationBtn automationBtn--dark" onClick={() => onAction(job.id, "set-cron", { expr: cronExpr, tz })}>Set cron</button>
      </div>
      <div className="automationEditorRow">
        <input className="automationInput" value={every} onChange={e => setEvery(e.target.value)} placeholder="Interval, e.g. 4 days" />
        <button className="automationBtn" onClick={() => onAction(job.id, "set-every", { every })}>Set interval</button>
        <span className="automationHint">Edits are sent to OpenClaw and recorded in dashboard action history.</span>
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

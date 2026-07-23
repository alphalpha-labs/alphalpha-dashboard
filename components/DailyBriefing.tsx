"use client";

import type { Action, DashboardData, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import type { CaptureInput } from "./QuickAdd";
import QuickAdd from "./QuickAdd";

interface Props {
  data: DashboardData;
  actions: Action[];
  loops: Loop[];
  onDone: (id: string) => void;
  onAdd: (input: CaptureInput) => void;
  onDiscuss: (ctx: ThreadContext) => void;
  onOpenDesk: () => void;
}

function freshnessLabel(iso: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "just refreshed";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DailyBriefing({ data, actions, loops, onDone, onAdd, onDiscuss, onOpenDesk }: Props) {
  const pendingReviews = (data.reviewQueue || []).filter(item => item.status === "pending");
  const failingSources = (data.meta.sourceHealth || []).filter(source =>
    !["OK", "HEALTHY", "CURRENT"].includes(source.status.toUpperCase())
  );
  const failingAutomations = (data.automations || []).filter(job =>
    job.enabled && (job.lastStatus === "error" || (job.consecutiveErrors || 0) > 0)
  );
  const highActions = actions.filter(action => action.priority === "HIGH");
  const priorityActions = [...highActions, ...actions.filter(action => action.priority !== "HIGH")].slice(0, 5);
  const activeProjects = data.projects.filter(project => project.status === "ACTIVE");
  const attentionCount = pendingReviews.length + failingSources.length + failingAutomations.length;

  return (
    <div className="dailyBriefing">
      <section className="briefingHero">
        <div>
          <p className="briefingEyebrow">Daily command center · {freshnessLabel(data.meta.generatedAt)}</p>
          <h1>Here&apos;s the shape of today, Alex.</h1>
          <p className="briefingPosture">{data.meta.posture}</p>
        </div>
        <div className="briefingHeroActions">
          <button className="briefingPrimary" onClick={onOpenDesk}>Start focus session <span>→</span></button>
          <span>{highActions.length} high-priority · {attentionCount} system flags</span>
        </div>
      </section>

      <section className="briefingMetrics" aria-label="Daily status">
        <Metric label="Needs attention" value={attentionCount} tone={attentionCount ? "red" : "green"} detail={`${pendingReviews.length} awaiting review`} />
        <Metric label="Priority moves" value={highActions.length} tone={highActions.length ? "amber" : "green"} detail={`${actions.length} actions queued`} />
        <Metric label="Open loops" value={loops.filter(loop => !loop.done && !loop.snoozed).length} detail={`${data.stats.activeProjects} active projects`} />
        <Metric label="New signals" value={data.stats.investingSignals} tone="blue" detail={`${data.stats.uncertainties} uncertainties`} />
      </section>

      <div className="briefingGrid">
        <section className="briefingPanel briefingPanel--actions">
          <div className="briefingPanelHeader">
            <div>
              <p className="briefingKicker">Make progress</p>
              <h2>What should move today</h2>
            </div>
            <button className="briefingTextButton" onClick={onOpenDesk}>Focus mode →</button>
          </div>
          <div className="briefingActionList">
            {priorityActions.map((action, index) => (
              <article className="briefingAction" key={action.id}>
                <span className={`briefingRank briefingRank--${action.priority.toLowerCase()}`}>{String(index + 1).padStart(2, "0")}</span>
                <button
                  className="briefingActionCopy"
                  onClick={() => onDiscuss({ id: action.id, type: "decision", title: action.title, project: action.project, priority: action.priority, next: action.next })}
                >
                  <span className="briefingActionMeta">{action.project} · {action.due}</span>
                  <strong>{action.title}</strong>
                  <small>Next: {action.next}</small>
                </button>
                <button className="briefingDone" onClick={() => onDone(action.id)} aria-label={`Mark ${action.title} done`}>✓</button>
              </article>
            ))}
          </div>
        </section>

        <aside className="briefingPanel briefingPanel--attention">
          <div className="briefingPanelHeader">
            <div>
              <p className="briefingKicker">Protect the system</p>
              <h2>Attention queue</h2>
            </div>
            <span className="briefingCount">{attentionCount}</span>
          </div>
          <div className="attentionList">
            {failingAutomations.slice(0, 3).map(job => (
              <div className="attentionItem" key={job.id}>
                <span className="attentionDot attentionDot--red" />
                <div><strong>{job.name}</strong><small>{job.consecutiveErrors || 1} consecutive errors · automation</small></div>
              </div>
            ))}
            {failingSources.slice(0, 3).map(source => (
              <div className="attentionItem" key={source.id}>
                <span className="attentionDot attentionDot--amber" />
                <div><strong>{source.label}</strong><small>{source.status.toLowerCase()} · {source.age}</small></div>
              </div>
            ))}
            {pendingReviews.slice(0, 2).map(item => (
              <div className="attentionItem" key={item.id}>
                <span className="attentionDot attentionDot--blue" />
                <div><strong>{item.title}</strong><small>waiting for review</small></div>
              </div>
            ))}
            {attentionCount === 0 && <p className="briefingEmpty">Nothing needs intervention. The system is quiet.</p>}
          </div>
        </aside>

        <section className="briefingPanel briefingPanel--projects">
          <div className="briefingPanelHeader">
            <div>
              <p className="briefingKicker">Keep momentum</p>
              <h2>Active projects</h2>
            </div>
            <span className="briefingFreshness">last generated {freshnessLabel(data.meta.generatedAt)}</span>
          </div>
          <div className="briefingProjectGrid">
            {activeProjects.slice(0, 6).map(project => (
              <button
                className="briefingProject"
                key={project.id}
                onClick={() => onDiscuss({ id: project.id, type: "project", title: project.name, summary: project.summary, ocOwned: project.ocOwned })}
              >
                <span className="briefingProjectTop"><i className={project.highPriCount ? "isHot" : ""} />{project.category}</span>
                <strong>{project.name}</strong>
                <small>{project.summary}</small>
                <span className="briefingProjectFoot">{project.lastActivity} · {project.highPriCount || 0} priority</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="briefingPanel briefingPanel--capture">
          <p className="briefingKicker">Clear your head</p>
          <h2>Capture a loose end</h2>
          <p>Drop it here. Alphalpha will route it into the durable open-loop system.</p>
          <QuickAdd onAdd={onAdd} />
          {data.daily?.article && (
            <div className="briefingRead">
              <span>Today&apos;s read · {data.daily.article.readTime}</span>
              <strong>{data.daily.article.title}</strong>
              <small>{data.daily.article.why}</small>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: number; detail: string; tone?: string }) {
  return (
    <div className={`briefingMetric briefingMetric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

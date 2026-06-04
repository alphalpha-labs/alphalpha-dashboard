import type { AlmanacBakeoff, SystemDoc } from "@/lib/data";
import type { DashboardTab, ThreadContext } from "./Dashboard";

interface Props {
  docs: SystemDoc[];
  bakeoffs: AlmanacBakeoff[];
  operations: {
    digests: number;
    queues: number;
    review: number;
    automations: number;
    outingOracle: number;
  };
  onNavigate: (tabId: DashboardTab) => void;
  onDiscuss: (ctx: ThreadContext) => void;
}

const layerLabels: Record<string, string> = {
  core: "Core",
  context: "Context",
  plan: "Plan",
  private: "Private",
};

export default function SystemTab({ docs, bakeoffs, operations, onNavigate, onDiscuss }: Props) {
  const sorted = [...docs].sort((a, b) => {
    const order = ["core", "context", "plan", "private"];
    return order.indexOf(a.layer) - order.indexOf(b.layer) || a.title.localeCompare(b.title);
  });
  const tracked = docs.filter(doc => doc.layer === "plan" || doc.path.includes("OPEN_LOOPS")).length;
  const privateCount = docs.filter(doc => doc.sensitivity === "private").length;
  const totalWords = docs.reduce((sum, doc) => sum + (doc.words || 0), 0);
  const latestBakeoff = bakeoffs[0] || null;

  return (
    <div className="systemPage">
      <section className="systemHero">
        <div>
          <p className="eyebrow">Alphalpha source surfaces</p>
          <h1 className="tabTitle">System docs</h1>
          <p className="tabSubtitle">
            The core documents that define Alphalpha, the operating model, open loops, and the high-leverage roadmap.
          </p>
        </div>
        <div className="systemStats" aria-label="System document stats">
          <span><strong>{docs.length}</strong> docs</span>
          <span><strong>{totalWords.toLocaleString()}</strong> words</span>
          <span><strong>{privateCount}</strong> private-scoped</span>
          <span><strong>{tracked}</strong> trackers</span>
        </div>
      </section>

      <section className="systemOpsGrid" aria-label="System navigation">
        {[
          { id: "digests" as const, label: "Digests", count: operations.digests, detail: "Context, source-health, and generated summaries" },
          { id: "queues" as const, label: "Queues", count: operations.queues, detail: "Reviewable candidate queues and clarification items" },
          { id: "review" as const, label: "Review", count: operations.review, detail: "Pending approvals and dismissals" },
          { id: "automations" as const, label: "Automations", count: operations.automations, detail: "Cron jobs, cadence, and runtime health" },
          { id: "outing-oracle" as const, label: "Outing Oracle", count: operations.outingOracle, detail: "Local outing planning surface" },
        ].map(item => (
          <button key={item.id} className="systemOpCard" onClick={() => onNavigate(item.id)}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
            <em>{item.detail}</em>
          </button>
        ))}
      </section>

      <section className="systemBakeoff">
        <div className="systemSectionHead">
          <div>
            <p className="eyebrow">Almanac source quality</p>
            <h2>Bakeoff results</h2>
          </div>
          <span>{bakeoffs.length} reports</span>
        </div>
        {!latestBakeoff ? (
          <p className="systemEmpty">No bakeoff artifact found yet. Run <code>npm run almanac:bakeoff -- --date=YYYY-MM-DD</code>.</p>
        ) : (
          <div className="systemBakeoffGrid">
            {bakeoffs.slice(0, 3).map(run => (
              <article key={run.path} className="systemBakeoffCard">
                <div className="systemDocTop">
                  <span className="systemLayer">{run.date}</span>
                  <span className="systemSensitivity systemSensitivity--internal">{run.generatedAt?.slice(0, 10) || "dry run"}</span>
                </div>
                <h3>{run.date} provider bakeoff</h3>
                <div className="systemBakeoffProviders">
                  <div>
                    <span>Tavily</span>
                    <strong>{run.tavily?.searches ?? 0}</strong>
                    <em>{run.tavily?.usableResults ?? 0} result URLs</em>
                  </div>
                  <div>
                    <span>OpenClaw</span>
                    <strong>{run.openclaw?.searches ?? 0}</strong>
                    <em>{run.openclaw?.usableResults ?? 0} result URLs</em>
                  </div>
                </div>
                <p className="systemSummary">
                  Tavily burn: {run.tavily?.burn ?? run.tavily?.searches ?? 0}. Runway: {run.runway?.estCreditsRemaining ?? "n/a"} credits / {run.runway?.estDaysLeft ?? "n/a"} days.
                </p>
                <details className="systemDetails">
                  <summary>Live vs fixture tiles</summary>
                  <pre>{JSON.stringify({ tavily: run.tavily?.liveTiles, openclaw: run.openclaw?.liveTiles }, null, 2)}</pre>
                </details>
                <div className="systemFooter">
                  <div className="digestTags">
                    <span className="digestTag">#almanac</span>
                    <span className="digestTag">#source-quality</span>
                  </div>
                  <div className="systemMeta">
                    <span>{run.markdownPath || run.path}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="systemGrid">
        {sorted.map(doc => (
          <article key={doc.id} className={`systemDoc systemDoc--${doc.sensitivity}`}>
            <div className="systemDocTop">
              <span className="systemLayer">{layerLabels[doc.layer] || doc.layer}</span>
              <span className={`systemSensitivity systemSensitivity--${doc.sensitivity}`}>{doc.sensitivity}</span>
            </div>
            <h2>{doc.title}</h2>
            <p className="systemPath">{doc.path}</p>
            <p className="systemSummary">{doc.summary}</p>
            <details className="systemDetails">
              <summary>{doc.content ? "Read full source" : "Read safe excerpt"}</summary>
              <pre>{doc.content || doc.excerpt}</pre>
            </details>
            <div className="systemFooter">
              <div className="digestTags">
                {doc.tags.map(tag => <span key={tag} className="digestTag">{tag}</span>)}
              </div>
              <div className="systemMeta">
                <span>{doc.words.toLocaleString()} words</span>
                {doc.mtime && <span>{doc.mtime.slice(0, 10)}</span>}
              </div>
            </div>
            <button
              className="btnAlphaDiscuss"
              onClick={() => onDiscuss({ id: doc.id, type: "systemDoc", title: doc.title, summary: doc.summary, category: doc.path })}
            >
              <span className="alphaGlyph">α</span> Discuss
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

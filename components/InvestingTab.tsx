import type { InvestmentDecisionDigest, InvestmentDecisionDigestChanges, Ticker } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  investing: Ticker[];
  digest?: InvestmentDecisionDigest | null;
  changes?: InvestmentDecisionDigestChanges | null;
  onDiscuss: (ctx: ThreadContext) => void;
}

export default function InvestingTab({ investing, digest, changes, onDiscuss }: Props) {
  const decisions = digest?.top_decisions ?? [];
  const contradictions = digest?.contradictions ?? [];
  const research = digest?.research_queue ?? [];
  const drift = digest?.portfolio_drift ?? [];

  return (
    <div className="investingPage">
      <h1 className="tabTitle">Investing decision layer</h1>
      <p className="tabSubtitle">5–10 year accumulation focus · {decisions.length || investing.length} current signals</p>

      {digest && (
        <section className="investmentDigestHero">
          <div>
            <span className="digestEyebrow">Thesis Baskets digest · {formatDate(digest.as_of)}</span>
            <h2>{digest.posture?.headline || "Latest investment posture"}</h2>
            {digest.posture?.summary && <p>{digest.posture.summary}</p>}
            {digest.posture?.key_risk && <strong>Key risk: {digest.posture.key_risk}</strong>}
          </div>
          <a href={digest.source_url} target="_blank" rel="noreferrer">Open source brief ↗</a>
        </section>
      )}

      {changes && changes.totals.changed > 0 && (
        <section className="investmentSection investmentChanges">
          <div className="sectionTitleRow"><h2>What changed since last snapshot</h2><span>{changes.totals.added} added · {changes.totals.removed} removed</span></div>
          {changes.posture_changed && <div className="investmentListRow"><strong>Posture changed</strong><p>The headline changed since the prior Thesis Baskets snapshot; review before adding capital.</p></div>}
          {(changes.top_decisions?.added ?? []).slice(0, 4).map(item => <div key={`decision-${item.id}`} className="investmentListRow"><strong>New decision · {item.title}</strong><p>{item.rationale}</p></div>)}
          {(changes.contradictions?.added ?? []).slice(0, 4).map(item => <div key={`contradiction-${item.basket}-${item.risk}`} className="investmentListRow"><strong>New contradiction · {item.basket}</strong><p>{item.risk}</p></div>)}
          {(changes.research_queue?.added ?? []).slice(0, 4).map(item => <div key={`research-${item.id}`} className="investmentListRow"><strong>New research · {item.question}</strong><p>{item.reason}</p></div>)}
        </section>
      )}

      {decisions.length > 0 && (
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Top decisions</h2><span>{decisions.length}</span></div>
          <div className="investmentCardGrid">
            {decisions.map(item => (
              <article key={item.id} className={`investmentDecision investmentDecision--${item.action}`}>
                <div className="decisionTop"><span>{item.action}</span><strong>{item.confidence}</strong></div>
                <h3>{item.title}</h3>
                <p>{item.rationale}</p>
                <div className="decisionMeta">{item.basket || "No basket"} · {(item.asset_symbols || []).join(", ") || "theme"}</div>
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: item.title, theme: item.basket || undefined, stance: item.action })}>
                  <span className="alphaGlyph">α</span> Discuss
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="investmentTwoCol">
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Contradictions</h2><span>{contradictions.length}</span></div>
          {contradictions.length ? contradictions.map(item => (
            <div key={`${item.basket}-${item.risk}`} className="investmentListRow">
              <strong>{item.severity} · {item.basket}</strong>
              <p>{item.risk}</p>
              <em>{item.why_it_matters}</em>
            </div>
          )) : <p className="emptyText">No contradiction digest available yet.</p>}
        </section>

        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Research queue</h2><span>{research.length}</span></div>
          {research.length ? research.map(item => (
            <div key={item.id} className="investmentListRow">
              <strong>{item.priority} · {item.question}</strong>
              <p>{item.reason}</p>
            </div>
          )) : <p className="emptyText">No research questions exported yet.</p>}
        </section>
      </div>

      {(drift.length > 0 || digest?.ignored_noise?.length) && (
        <div className="investmentTwoCol">
          <section className="investmentSection">
            <div className="sectionTitleRow"><h2>Portfolio drift</h2><span>{drift.length}</span></div>
            {drift.map(item => <div key={item.id} className="investmentListRow"><strong>{item.status} · {item.title}</strong><p>{item.rationale}</p></div>)}
          </section>
          <section className="investmentSection">
            <div className="sectionTitleRow"><h2>Ignore / hold off</h2><span>{digest?.ignored_noise?.length ?? 0}</span></div>
            {(digest?.ignored_noise ?? []).map(item => <div key={item.id} className="investmentListRow"><strong>{item.title}</strong><p>{item.reason}</p></div>)}
          </section>
        </div>
      )}

      {digest?.source_health && (
        <section className="investmentSection investmentHealth">
          <div className="sectionTitleRow"><h2>Source health / cost</h2><span>{digest.latest_check_in?.degraded ? "degraded" : "ok"}</span></div>
          <p>Latest check-in age: {digest.source_health.latest_check_in_age_hours ?? "n/a"}h · latest sweep: {digest.source_health.latest_sweep_at ? formatDate(digest.source_health.latest_sweep_at) : "none"}</p>
          {digest.cost_summary && <p>Background AI: ${digest.cost_summary.total_cost_usd ?? "n/a"} · {digest.cost_summary.total_tokens} tokens · {digest.cost_summary.total_requests} requests</p>}
          <ul>{digest.source_health.notes.map(note => <li key={note}>{note}</li>)}</ul>
        </section>
      )}

      <section className="investmentSection">
        <div className="sectionTitleRow"><h2>Legacy research candidates</h2><span>{investing.length}</span></div>
        {investing.map(t => (
          <div key={t.ticker} className="tickerRow">
            <span className="tickerSymbol">{t.ticker}</span>
            <span className="tickerTheme">{t.theme}</span>
            <span className="tickerStance">{t.stance}</span>
            <span className={`tickerConf tickerConf--${t.confidence}`}>{t.confidence}</span>
            <span className="tickerDiscuss">
              <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: t.ticker, type: "ticker", title: t.ticker, theme: t.theme, stance: t.stance })}>
                <span className="alphaGlyph">α</span> Discuss
              </button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

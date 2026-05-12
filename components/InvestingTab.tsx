import type {
  InvestmentCrawlPlan,
  InvestmentDecisionDigest,
  InvestmentDecisionDigestChanges,
  InvestmentJournal,
  InvestmentResearchActions,
  InvestmentRuntimePreflight,
  InvestingAccumulationPlan,
  InvestingConvictionLedger,
  InvestingThesisRegistry,
  InvestingTrustedSources,
  InvestingPriceAlerts,
  InvestingAccumulationOpportunities,
  InvestingProposedTheses,
  InvestingProposedThesisConfig,
  InvestingWeeklyTrades,
  InvestingTradeReview,
  InvestingTradeJournal,
  InvestingFeedbackCalibration,
  Ticker,
} from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  investing: Ticker[];
  digest?: InvestmentDecisionDigest | null;
  changes?: InvestmentDecisionDigestChanges | null;
  preflight?: InvestmentRuntimePreflight | null;
  journal?: InvestmentJournal | null;
  researchActions?: InvestmentResearchActions | null;
  crawlPlan?: InvestmentCrawlPlan | null;
  thesisRegistry?: InvestingThesisRegistry | null;
  convictionLedger?: InvestingConvictionLedger | null;
  accumulationPlan?: InvestingAccumulationPlan | null;
  trustedSources?: InvestingTrustedSources | null;
  priceAlerts?: InvestingPriceAlerts | null;
  accumulationOpportunities?: InvestingAccumulationOpportunities | null;
  proposedTheses?: InvestingProposedTheses | null;
  proposedThesisConfig?: InvestingProposedThesisConfig | null;
  weeklyTrades?: InvestingWeeklyTrades | null;
  tradeReview?: InvestingTradeReview | null;
  tradeJournal?: InvestingTradeJournal | null;
  feedbackCalibration?: InvestingFeedbackCalibration | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void;
}

export default function InvestingTab({ investing, digest, changes, preflight, journal, researchActions, crawlPlan, thesisRegistry, convictionLedger, accumulationPlan, trustedSources, priceAlerts, accumulationOpportunities, proposedTheses, proposedThesisConfig, weeklyTrades, tradeReview, tradeJournal, feedbackCalibration, onDiscuss, onAction }: Props) {
  const decisions = digest?.top_decisions ?? [];
  const contradictions = digest?.contradictions ?? [];
  const research = digest?.research_queue ?? [];
  const drift = digest?.portfolio_drift ?? [];
  const theses = thesisRegistry?.theses ?? [];
  const convictionEntries = convictionLedger?.entries ?? [];
  const plans = accumulationPlan?.plans ?? [];
  const sources = trustedSources?.sources ?? [];
  const opportunities = accumulationOpportunities?.opportunities ?? [];
  const quotes = accumulationOpportunities?.quotes ?? [];
  const proposals = proposedTheses?.proposals ?? [];
  const tradePrompts = tradeReview?.prompts ?? [];
  const reviewedTrades = tradeReview?.trades ?? [];

  return (
    <div className="investingPage">
      <h1 className="tabTitle">Investing decision layer</h1>
      <p className="tabSubtitle">5–10 year accumulation focus · {decisions.length || investing.length} current signals</p>

      {preflight && preflight.summary?.status !== "ready" && (
        <section className="investmentSection investmentPreflight">
          <div className="sectionTitleRow"><h2>Live digest preflight</h2><span>{preflight.summary?.status || "unknown"}</span></div>
          {(preflight.summary?.blockers ?? []).map(blocker => <div key={blocker} className="investmentListRow"><strong>Blocked</strong><p>{blocker}</p></div>)}
        </section>
      )}

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

      {tradeReview && (
        <section className="investmentSection investmentTradeReview investmentTradeReviewFeatured">
          <div className="tradeReviewHeader">
            <div>
              <span className="digestEyebrow">Robinhood/SnapTrade behavior check</span>
              <h2>Weekly trade review</h2>
              <p>{tradeReview.startDate} → {tradeReview.endDate} · journal {tradeJournal?.entries?.[0]?.status || "pending"}</p>
            </div>
            <div className="tradeReviewStats">
              <span><strong>{tradeReview.summary.tradeCount}</strong> trades</span>
              <span><strong>{tradeReview.summary.needsDiscussion}</strong> discuss</span>
              <span><strong>{weeklyTrades?.summary?.buy_count ?? 0}</strong> buys</span>
              <span><strong>{weeklyTrades?.summary?.sell_count ?? 0}</strong> sells</span>
            </div>
          </div>
          <div className="tradeReviewMix">{Object.entries(tradeReview.summary.byAlignment || {}).map(([k, v]) => <span key={k}>{k.replace(/-/g, " ")} <strong>{v}</strong></span>)}</div>
          {tradePrompts.length > 0 && (
            <div className="tradePromptGrid">
              {tradePrompts.slice(0, 4).map(item => <div key={item.id} className="tradePromptCard"><strong>{item.symbol || "Trade"} · {item.alignment.replace(/-/g, " ")}</strong><p>{item.prompt}</p><div className="investmentButtonRow"><button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: item.symbol || "Trade review", theme: "weekly trade review", stance: item.alignment })}>Discuss</button><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "record-decision", { title: `${item.symbol || "Trade"} review`, decision: item.alignment, rationale: item.prompt })}>Journal</button></div></div>)}
            </div>
          )}
          <div className="tradeTable">
            <div className="tradeTableHead"><span>Trade</span><span>Placed</span><span>Qty</span><span>Price</span><span>Amount</span><span>Plan</span></div>
            {reviewedTrades.slice(0, 12).map(item => <div key={`trade-${item.id}`} className="tradeTableRow">
              <span><strong>{item.action.toUpperCase()} {item.symbol || "cash"}</strong><em>{item.description || "No description"}</em></span>
              <span>{formatDateTime(item.trade_date)}</span>
              <span>{formatQuantity(item.quantity)}</span>
              <span>{formatMoney(item.price)}</span>
              <span>{formatMoneyAbs(item.amount)}</span>
              <span><b className={`tradeBadge tradeBadge--${item.alignment}`}>{item.alignment.replace(/-/g, " ")}</b><em>{item.valuationState || "unknown"}</em></span>
            </div>)}
          </div>
        </section>
      )}

      {theses.length > 0 && (
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Active thesis registry</h2><span>{theses.length}</span></div>
          <div className="investmentCardGrid">
            {theses.map(thesis => (
              <article key={thesis.id} className="investmentDecision">
                <div className="decisionTop"><span>{thesis.stage}</span><strong>{thesis.currentConviction || "n/a"}</strong></div>
                <h3>{thesis.title}</h3>
                <p>{thesis.coreClaim}</p>
                <div className="decisionMeta">{thesis.basket || "No basket"} · {(thesis.symbols || []).join(", ") || "theme"} · {thesis.currentAction}</div>
                <div className="investmentButtonRow">
                  <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: thesis.id, type: "ticker", title: thesis.title, theme: thesis.basket || undefined, stance: thesis.currentAction })}><span className="alphaGlyph">α</span> Discuss</button>
                  <button className="btnAlphaDiscuss" onClick={() => onAction?.(thesis.id, "record-conviction", { thesisId: thesis.id, title: thesis.title, conviction: thesis.currentConviction, rationale: thesis.convictionWhy })}>Conviction</button>
                  <button className="btnAlphaDiscuss" onClick={() => onAction?.(thesis.id, "promote-thesis", { thesisId: thesis.id, stage: thesis.stage === "candidate" ? "active-thesis" : "candidate", title: thesis.title })}>Promote</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="investmentTwoCol">
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Conviction ledger</h2><span>{convictionEntries.length}</span></div>
          {convictionEntries.slice(0, 5).map(entry => <div key={entry.id} className="investmentListRow"><strong>{entry.direction} · {entry.thesisId} → {entry.convictionAfter}</strong><p>{entry.why}</p><em>{entry.actionImplication}</em></div>)}
        </section>
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Accumulation plan</h2><span>{plans.length}</span></div>
          {plans.slice(0, 5).map(plan => <div key={plan.id} className="investmentListRow"><strong>{plan.status} · {plan.title}</strong><p>Desired: {plan.desiredExposure || "not set"} · Max: {plan.maxExposure || "not set"}</p><em>{(plan.entryConditions || []).slice(0, 1).join(" ")}</em></div>)}
        </section>
      </div>

      {sources.length > 0 && (
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Trusted support / dissent sources</h2><span>{sources.length}</span></div>
          {sources.slice(0, 6).map(source => <div key={source.id} className="investmentListRow"><strong>{source.name} · {source.usefulness || "unknown"}</strong><p>{source.biasStyle}</p><em>{(source.bestFor || []).join(", ")}</em></div>)}
        </section>
      )}

      <div className="investmentTwoCol">
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Accumulation opportunities</h2><span>{opportunities.length}</span></div>
          {opportunities.length ? opportunities.map(item => <div key={item.id} className="investmentListRow"><strong>{item.symbol} · {item.trigger}</strong><p>{item.message}</p><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "record-decision", { title: `${item.symbol} accumulation opportunity`, decision: item.action, rationale: item.message, symbols: [item.symbol], thesisId: item.thesisId })}>Journal reminder</button></div>) : <p className="emptyText">No thesis-aware pullback opportunities currently triggered.</p>}
          {quotes.slice(0, 6).map(q => <div key={q.symbol} className="investmentListRow"><strong>{q.symbol} · {typeof q.close === "number" ? `$${q.close.toFixed(2)}` : "quote unavailable"}</strong><p>{typeof q.pullbackPct === "number" ? `${q.pullbackPct.toFixed(1)}% from six-month high` : q.error || "No quote data"}</p></div>)}
        </section>
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Proposed theses</h2><span>{proposals.length}</span></div>
          {proposedThesisConfig?.thresholds && <p className="emptyText">Thresholds: evidence ≥ {proposedThesisConfig.thresholds.minimumEvidenceScore}, differentiation ≥ {proposedThesisConfig.thresholds.minimumDifferentiationScore}</p>}
          {proposals.slice(0, 6).map(item => <div key={item.id} className="investmentListRow"><strong>{item.recommendation} · {item.title}</strong><p>{item.thesisDraft}</p><em>{(item.symbols || []).join(", ")} · evidence {item.evidenceScore} · differentiated {item.differentiationScore}</em><div className="investmentButtonRow"><button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: item.title, theme: "proposed thesis", stance: item.recommendation })}>Discuss</button><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "promote-thesis", { thesisId: item.id, stage: "candidate", title: item.title, symbols: item.symbols, rationale: item.thesisDraft })}>Approve candidate</button></div></div>)}
        </section>
      </div>

      {feedbackCalibration && (
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Feedback calibration</h2><span>{typeof feedbackCalibration.metrics.openTradeReviews === "number" ? feedbackCalibration.metrics.openTradeReviews : 0} open reviews</span></div>
          {feedbackCalibration.calibrationPrompts.map(prompt => <div key={prompt} className="investmentListRow"><strong>Calibration prompt</strong><p>{prompt}</p></div>)}
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
                <div className="investmentButtonRow">
                  <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: item.title, theme: item.basket || undefined, stance: item.action })}>
                    <span className="alphaGlyph">α</span> Discuss
                  </button>
                  <button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "record-decision", { title: item.title, decision: item.action, rationale: item.rationale, basket: item.basket, symbols: item.asset_symbols })}>
                    Journal
                  </button>
                </div>
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
              <button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "research-note", { title: item.question, rationale: item.reason, basket: item.basket, symbols: item.asset_symbols })}>Track action</button>
            </div>
          )) : <p className="emptyText">No research questions exported yet.</p>}
        </section>
      </div>

      {crawlPlan && (
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Cost-aware crawl planner</h2><span>{crawlPlan.recommended_expensive_crawls?.length ?? 0} paid candidates</span></div>
          {crawlPlan.policy?.default && <p className="emptyText">{crawlPlan.policy.default}</p>}
          {(crawlPlan.recommended_expensive_crawls ?? []).map(item => <div key={item.id} className="investmentListRow"><strong>Consider targeted crawl · {item.title}</strong><p>{item.reason}</p><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "crawl-candidate", item)}>Track crawl candidate</button></div>)}
          {(crawlPlan.deterministic_only ?? []).slice(0, 4).map(item => <div key={item.id} className="investmentListRow"><strong>Do not spend AI yet · {item.title}</strong><p>{item.reason}</p><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "deterministic-research", item)}>Track deterministic research</button></div>)}
        </section>
      )}

      <div className="investmentTwoCol">
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Decision journal</h2><span>{journal?.entries?.length ?? 0}</span></div>
          {(journal?.entries ?? []).slice(0, 5).map(item => <div key={item.id} className="investmentListRow"><strong>{item.decision || "decision"} · {item.title}</strong><p>{item.rationale}</p><em>{item.next}</em></div>)}
        </section>
        <section className="investmentSection">
          <div className="sectionTitleRow"><h2>Research actions</h2><span>{researchActions?.items?.length ?? 0}</span></div>
          {(researchActions?.items ?? []).slice(0, 5).map(item => <div key={item.id} className="investmentListRow"><strong>{item.type || "action"} · {item.title}</strong><p>{item.rationale}</p><em>{item.next}</em></div>)}
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

function formatDateTime(iso?: string | null) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatQuantity(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value < 1 ? value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "") : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatMoneyAbs(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Math.abs(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

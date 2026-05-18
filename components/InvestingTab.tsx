import { useMemo, useState } from "react";
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
  InvestingInputHealth,
  InvestingPortfolioContextMap,
  InvestingTaxonomyDecisionSheet,
  InvestingTaxonomyDecisionWorkflow,
  InvestingTaxonomyDecisions,
  InvestingBasketGovernanceAudit,
  InvestingThesisUniverse,
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
  inputHealth?: InvestingInputHealth | null;
  portfolioContextMap?: InvestingPortfolioContextMap | null;
  taxonomyDecisionSheet?: InvestingTaxonomyDecisionSheet | null;
  taxonomyDecisionWorkflow?: InvestingTaxonomyDecisionWorkflow | null;
  taxonomyDecisions?: InvestingTaxonomyDecisions | null;
  basketGovernanceAudit?: InvestingBasketGovernanceAudit | null;
  thesisUniverse?: InvestingThesisUniverse | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void | Promise<void>;
}

export default function InvestingTab({ investing, digest, changes, preflight, journal, researchActions, crawlPlan, thesisRegistry, convictionLedger, accumulationPlan, trustedSources, priceAlerts, accumulationOpportunities, proposedTheses, proposedThesisConfig, weeklyTrades, tradeReview, tradeJournal, feedbackCalibration, inputHealth, portfolioContextMap, taxonomyDecisionSheet, taxonomyDecisionWorkflow, taxonomyDecisions, basketGovernanceAudit, thesisUniverse, onDiscuss, onAction }: Props) {
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

      {(taxonomyDecisionSheet || basketGovernanceAudit || thesisUniverse) && (
        <TaxonomyReview
          taxonomyDecisionSheet={taxonomyDecisionSheet}
          taxonomyDecisionWorkflow={taxonomyDecisionWorkflow}
          taxonomyDecisions={taxonomyDecisions}
          basketGovernanceAudit={basketGovernanceAudit}
          thesisUniverse={thesisUniverse}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
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

      {(portfolioContextMap || inputHealth) && (
        <div className="investmentTwoCol investmentContextRow">
          {portfolioContextMap && (
            <section className="investmentSection investmentPortfolioMap">
              <div className="sectionTitleRow"><h2>Portfolio exposure map</h2><span>{portfolioContextMap.portfolio.holding_count ?? 0} holdings</span></div>
              <p className="emptyText">Total equity {formatMoney(portfolioContextMap.portfolio.total_equity)} · cash {formatMoney(portfolioContextMap.portfolio.cash_balance)} · {portfolioContextMap.exposureMap.unmappedHoldings?.length ?? 0} unmapped holdings</p>
              {(portfolioContextMap.exposureMap.byTheme ?? []).slice(0, 6).map(theme => <div key={theme.id} className="portfolioThemeRow"><strong>{theme.title}</strong><span>{formatMoney(theme.equity)} · {theme.portfolioPct.toFixed(1)}%</span><em>{theme.holdings.slice(0, 5).map(h => h.symbol).join(", ")}</em></div>)}
              {(portfolioContextMap.prompts ?? []).filter(p => p.type === "map-holding").slice(0, 4).map(prompt => <div key={`${prompt.type}-${prompt.symbol}`} className="investmentListRow"><strong>Map holding · {prompt.symbol}</strong><p>{prompt.prompt}</p><button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `holding-${prompt.symbol}`, type: "ticker", title: prompt.symbol || "Holding", theme: "portfolio mapping", stance: "needs thesis" })}>Discuss mapping</button></div>)}
            </section>
          )}
          {inputHealth && (
            <section className="investmentSection investmentInputHealth">
              <div className="sectionTitleRow"><h2>Investor/news input health</h2><span>{inputHealth.status}</span></div>
              <div className="inputHealthStats"><span><strong>{inputHealth.summary.investorPosts7d ?? 0}</strong> investor posts 7d</span><span><strong>{inputHealth.summary.highRelevanceInvestorPosts7d ?? 0}</strong> high-signal 7d</span><span><strong>{inputHealth.summary.newsItems7d ?? 0}</strong> news 7d</span><span><strong>{inputHealth.summary.failedInvestorFetchRuns14d ?? 0}</strong> failed runs</span></div>
              {(inputHealth.health?.warnings ?? []).slice(0, 3).map(warning => <div key={warning} className="investmentListRow"><strong>Watch</strong><p>{warning}</p></div>)}
              {(inputHealth.recommendations ?? []).slice(0, 3).map(rec => <div key={rec} className="investmentListRow"><strong>Recommendation</strong><p>{rec}</p></div>)}
              {(inputHealth.investorPosts?.recentHighSignal ?? []).slice(0, 3).map(item => <div key={`${item.event_time}-${item.title}`} className="investmentListRow"><strong>{item.investor_name || item.source_label} · {item.title}</strong><p>{item.ai_summary}</p></div>)}
            </section>
          )}
        </div>
      )}

      {portfolioContextMap?.obsidianSignals && (
        <section className="investmentSection investmentObsidianSignals">
          <div className="sectionTitleRow"><h2>Obsidian / podcast investing signals</h2><span>{portfolioContextMap.obsidianSignals.noteCount ?? 0} matched notes</span></div>
          <div className="obsidianThemeGrid">{(portfolioContextMap.obsidianSignals.themeEvidence ?? []).slice(0, 6).map(theme => <div key={theme.theme} className="obsidianThemeCard"><strong>{theme.theme.replace(/-/g, " ")}</strong><span>{theme.noteCount} notes</span><em>{Object.entries(theme.symbols || {}).slice(0, 5).map(([s, n]) => `${s}×${n}`).join(" · ") || "theme evidence"}</em></div>)}</div>
          {(portfolioContextMap.prompts ?? []).filter(p => p.type === "obsidian-theme").slice(0, 4).map(prompt => <div key={`${prompt.type}-${prompt.theme}`} className="investmentListRow"><strong>Review theme · {prompt.theme}</strong><p>{prompt.prompt}</p><em>{(prompt.examples || []).join(" · ")}</em></div>)}
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

function TaxonomyReview({ taxonomyDecisionSheet, taxonomyDecisionWorkflow, taxonomyDecisions, basketGovernanceAudit, thesisUniverse, onDiscuss, onAction }: {
  taxonomyDecisionSheet?: InvestingTaxonomyDecisionSheet | null;
  taxonomyDecisionWorkflow?: InvestingTaxonomyDecisionWorkflow | null;
  taxonomyDecisions?: InvestingTaxonomyDecisions | null;
  basketGovernanceAudit?: InvestingBasketGovernanceAudit | null;
  thesisUniverse?: InvestingThesisUniverse | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void | Promise<void>;
}) {
  const baskets = basketGovernanceAudit?.baskets ?? [];
  const clusters = taxonomyDecisionSheet?.clusters ?? [];
  const decisionPoints = taxonomyDecisionWorkflow?.decisionPoints ?? [];
  const diagnostics = thesisUniverse?.diagnostics;
  const savedChoices = useMemo(() => Object.fromEntries((taxonomyDecisions?.decisions ?? []).map(decision => [decision.decisionPointId, decision.choiceId])), [taxonomyDecisions]);
  const [stagedChoices, setStagedChoices] = useState<Record<string, string>>(savedChoices);
  const [savingChoices, setSavingChoices] = useState<Record<string, string>>({});
  const [choiceReceipts, setChoiceReceipts] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});
  const visibleBaskets = baskets
    .filter(basket => (basket.currentPortfolio?.primaryPct ?? 0) > 0 || basket.sourceOfTruthStatus === "canonical-app-basket" || (basket.governanceQuestions?.length ?? 0) > 0)
    .sort((a, b) => (b.currentPortfolio?.primaryPct ?? 0) - (a.currentPortfolio?.primaryPct ?? 0));
  const kindRows = taxonomyKindBreakdown(baskets);
  const topBlocks = visibleBaskets.filter(basket => (basket.currentPortfolio?.primaryPct ?? 0) > 0).slice(0, 12);
  const stagedCount = Object.keys(stagedChoices).length;
  const savedCount = taxonomyDecisions?.decisions?.length ?? 0;
  const decisionCards = decisionPoints.length ? decisionPoints : clusters.flatMap(cluster => (cluster.questions ?? []).map((question, idx) => ({
    id: `${cluster.id}-${idx}`,
    clusterId: cluster.id,
    title: question,
    question,
    recommendation: cluster.recommendations?.[0]?.decision || "Review needed",
    why: cluster.recommendations?.[0]?.rationale || "This decision affects taxonomy clarity.",
    recommendedChoice: cluster.recommendations?.[0]?.decision || "review",
    options: (cluster.recommendations ?? []).map(rec => ({ id: rec.decision, label: rec.decision, meaning: rec.rationale })),
    affectedAllocationPct: undefined,
    blockingLevel: "medium",
    consequences: [],
    affectedAssets: [],
  })));
  const clusterTitleById = useMemo(() => new Map(clusters.map(cluster => [cluster.id, cluster.title])), [clusters]);
  async function stageChoice(pointId: string, choiceId: string, label: string) {
    const previousChoice = stagedChoices[pointId];
    setStagedChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setSavingChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: `Saving “${label}”…` } }));
    try {
      await onAction?.(pointId, "stage-taxonomy-decision", {
        decisionPointId: pointId,
        choiceId,
        workflowVersion: taxonomyDecisionWorkflow?.schemaVersion,
        durableTarget: "memory/investing/thesis-taxonomy-decisions.json",
        requestedAction: "stage-investing-taxonomy-decision-and-refresh-dashboard",
      });
      setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: `Saved “${label}”. Receipt recorded and dashboard refresh queued.` } }));
    } catch (error) {
      setStagedChoices(prev => {
        const next = { ...prev };
        if (previousChoice) next[pointId] = previousChoice;
        else delete next[pointId];
        return next;
      });
      setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "error", text: error instanceof Error ? error.message : "Could not save this decision." } }));
    } finally {
      setSavingChoices(prev => {
        const next = { ...prev };
        delete next[pointId];
        return next;
      });
    }
  }

  return (
    <section className="investmentSection taxonomyReview">
      <div className="sectionTitleRow">
        <h2>Taxonomy review · pass 1</h2>
        <span>{basketGovernanceAudit?.summary?.notAuthoritativeForRebalance?.length ?? 0} gated before rebalance</span>
      </div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">Read-only decision map</span>
          <h3>Classify the portfolio before acting on it</h3>
          <p>{taxonomyDecisionSheet?.purpose || basketGovernanceAudit?.purpose || "Visual taxonomy review for investing baskets, sleeves, overlaps, and unresolved governance decisions."}</p>
          <div className="taxonomyStats">
            <span><strong>{diagnostics?.strictMappedPct?.toFixed(1) ?? "—"}%</strong> mapped</span>
            <span><strong>{basketGovernanceAudit?.summary?.canonicalAppRows ?? "—"}</strong> canonical</span>
            <span><strong>{basketGovernanceAudit?.summary?.nonCanonicalRows ?? "—"}</strong> needs kind</span>
            <span><strong>{basketGovernanceAudit?.summary?.multiSourceConvictionRows?.length ?? "—"}</strong> conviction conflicts</span>
            <span><strong>{decisionCards.length}</strong> decision points</span>
            <span><strong>{stagedCount}</strong> staged choices</span>
            {savedCount > 0 && <span><strong>{savedCount}</strong> saved</span>}
          </div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Rule for this view</strong>
          <p>{taxonomyDecisionSheet?.primaryRule || "One primary classification for allocation math; secondary tags are for overlap only."}</p>
          <em>No trim/add/rebalance recommendation is authoritative until kind, boundary, conviction source, target source, and overlap policy are explicit.</em>
        </div>
      </div>

      <div className="taxonomyTwoCol">
        <div className="taxonomyPanel">
          <div className="sectionTitleRow"><h2>Current primary breakdown</h2><span>{topBlocks.length} blocks</span></div>
          <div className="taxonomyTreemap" aria-label="Portfolio allocation by current primary classification">
            {topBlocks.map(block => {
              const pct = block.currentPortfolio?.primaryPct ?? 0;
              return (
                <div key={block.id} className={`taxonomyBlock taxonomyBlock--${kindClass(block.sourceOfTruthStatus)}`} style={{ flexBasis: `${Math.max(pct, 3)}%` }} title={`${block.title}: ${pct.toFixed(2)}%`}>
                  <strong>{block.title}</strong>
                  <span>{pct.toFixed(1)}%</span>
                  <em>{labelForSourceStatus(block.sourceOfTruthStatus)}</em>
                </div>
              );
            })}
          </div>
          <div className="taxonomyLegend">
            {kindRows.map(row => <span key={row.kind}><i className={`taxonomyDot taxonomyDot--${row.className}`} />{row.label}: {row.pct.toFixed(1)}%</span>)}
          </div>
        </div>

        <div className="taxonomyPanel">
          <div className="sectionTitleRow"><h2>Kind breakdown</h2><span>proposed taxonomy</span></div>
          <div className="taxonomyKindBars">
            {kindRows.map(row => (
              <div key={row.kind} className="taxonomyKindRow">
                <div><strong>{row.label}</strong><span>{row.count} rows · {row.pct.toFixed(1)}%</span></div>
                <div className="taxonomyKindTrack"><i className={`taxonomyKindFill taxonomyKindFill--${row.className}`} style={{ width: `${Math.min(100, Math.max(row.pct, row.count ? 4 : 0))}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="taxonomyTwoCol taxonomyDecisionLayout">
        <div className="taxonomyPanel">
          <div className="sectionTitleRow"><h2>Overlap / consolidation clusters</h2><span>{clusters.length}</span></div>
          <div className="taxonomyClusterStack">
            {clusters.map(cluster => (
              <article key={cluster.id} className="taxonomyClusterCard">
                <div className="taxonomyClusterHeader"><strong>{cluster.title}</strong><span>{cluster.recommendations?.length ?? 0} calls</span></div>
                <div className="taxonomyNodeLine">
                  {(cluster.recommendations ?? []).map(rec => <span key={`${cluster.id}-${rec.item}`} className="taxonomyNode">{shortId(rec.item)}</span>)}
                </div>
                {(cluster.questions ?? []).slice(0, 2).map(question => <p key={question}>{question}</p>)}
              </article>
            ))}
          </div>
        </div>

        <div className="taxonomyPanel">
          <div className="sectionTitleRow"><h2>Decision queue</h2><span>{decisionCards.length} explicit calls</span></div>
          <div className="taxonomyDecisionQueue">
            {decisionCards.map(card => (
              <article key={card.id} className={`taxonomyDecisionCard taxonomyDecisionCard--${card.blockingLevel || "medium"}`} aria-busy={Boolean(savingChoices[card.id])}>
                <div className="taxonomyDecisionTop"><span>{clusterTitleById.get(card.clusterId) || card.clusterId}</span><b>{card.blockingLevel || "medium"}</b></div>
                <strong>{card.title}</strong>
                <p className="taxonomyDecisionQuestion">{card.question}</p>
                <div className="taxonomyRecommendation"><span>Recommendation</span><p>{card.recommendation}</p></div>
                <div className="taxonomyWhy"><span>Why</span><p>{card.why}</p></div>
                {(card.affectedAllocationPct != null || (card.affectedAssets?.length ?? 0) > 0) && (
                  <div className="taxonomyImpactLine">
                    {card.affectedAllocationPct != null && <span>{card.affectedAllocationPct.toFixed(1)}% affected</span>}
                    {(card.affectedAssets?.length ?? 0) > 0 && <em>{card.affectedAssets?.slice(0, 9).join(", ")}</em>}
                  </div>
                )}
                {(card.consequences?.length ?? 0) > 0 && <ul className="taxonomyConsequences">{card.consequences?.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul>}
                <div className="taxonomyChoiceGrid">
                  {card.options.map(option => {
                    const selected = stagedChoices[card.id] === option.id;
                    const recommended = card.recommendedChoice === option.id;
                    const saving = savingChoices[card.id] === option.id;
                    return (
                      <button key={option.id} className={`taxonomyChoiceBtn${selected ? " taxonomyChoiceBtn--selected" : ""}${recommended ? " taxonomyChoiceBtn--recommended" : ""}${saving ? " taxonomyChoiceBtn--saving" : ""}`} onClick={() => void stageChoice(card.id, option.id, option.label)} title={option.meaning} disabled={Boolean(savingChoices[card.id])}>
                        <strong>{option.label}</strong>
                        <span>{saving ? "Saving…" : selected ? "Selected" : recommended ? "Recommended" : "Option"}</span>
                      </button>
                    );
                  })}
                </div>
                {choiceReceipts[card.id] && <div className={`taxonomyReceipt taxonomyReceipt--${choiceReceipts[card.id].tone}`} role="status">{choiceReceipts[card.id].text}</div>}
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: card.id, type: "decision", title: card.question, category: "investing taxonomy", summary: `${clusterTitleById.get(card.clusterId) || card.clusterId}: ${card.recommendation}` })}>Discuss decision</button>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="taxonomyPanel taxonomyMatrixPanel">
        <div className="sectionTitleRow"><h2>Basket detail matrix</h2><span>{visibleBaskets.length} rows</span></div>
        <div className="taxonomyMatrix">
          <div className="taxonomyMatrixHead"><span>Item</span><span>Kind/status</span><span>Allocation</span><span>Conviction</span><span>Target</span><span>Assets</span><span>Governance gate</span></div>
          {visibleBaskets.slice(0, 18).map(basket => {
            const assets = uniqueSymbols([...(basket.assets?.appTickersAndAlternates ?? []), ...(basket.assets?.portfolioTopHoldings ?? []), ...(basket.assets?.watchlistSymbols ?? [])]).slice(0, 8);
            return (
              <div key={basket.id} className="taxonomyMatrixRow">
                <span><strong>{basket.title}</strong><em>{basket.id}</em></span>
                <span><b className={`taxonomyPill taxonomyPill--${kindClass(basket.sourceOfTruthStatus)}`}>{labelForSourceStatus(basket.sourceOfTruthStatus)}</b><em>{basket.appStatus || "not in app"}</em></span>
                <span>{(basket.currentPortfolio?.primaryPct ?? 0).toFixed(1)}%<em>{(basket.currentPortfolio?.secondaryPct ?? 0).toFixed(1)}% secondary</em></span>
                <span>{basket.conviction?.displayedScore ?? "—"}<em>{basket.conviction?.auditStatus || "unknown"}</em></span>
                <span>{basket.targetWeights?.displayedTarget ?? "—"}<em>{basket.targetWeights?.auditStatus || "unknown"}</em></span>
                <span>{assets.join(", ") || "—"}</span>
                <span>{(basket.governanceQuestions ?? ["Ready for review"]).slice(0, 1).join(" ")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function taxonomyKindBreakdown(baskets: NonNullable<InvestingBasketGovernanceAudit["baskets"]>) {
  const base = [
    { kind: "canonical", label: "Canonical theses", className: "canonical", count: 0, pct: 0 },
    { kind: "proposed", label: "Proposed/watchlist", className: "proposed", count: 0, pct: 0 },
    { kind: "sleeve", label: "Sleeves needed", className: "sleeve", count: 0, pct: 0 },
    { kind: "legacy", label: "Legacy/archive", className: "legacy", count: 0, pct: 0 },
    { kind: "unmapped", label: "Unmapped/unclear", className: "unmapped", count: 0, pct: 0 },
  ];
  for (const basket of baskets) {
    const pctValue = basket.currentPortfolio?.primaryPct ?? 0;
    const status = basket.sourceOfTruthStatus;
    const id = basket.id;
    const row = status === "canonical-app-basket" ? base[0]
      : /quality|ballast|cash|bonds|broad|speculative/.test(id) ? base[2]
      : /doomberg|legacy|archive/.test(id) ? base[3]
      : /watchlist|proposal/.test(status) ? base[1]
      : base[4];
    row.count += 1;
    row.pct += pctValue;
  }
  return base;
}

function kindClass(status: string) {
  if (status === "canonical-app-basket") return "canonical";
  if (/watchlist|proposal/.test(status)) return "proposed";
  if (/derived|low-confidence/.test(status)) return "unmapped";
  return "sleeve";
}

function labelForSourceStatus(status: string) {
  if (status === "canonical-app-basket") return "canonical thesis";
  if (/watchlist|proposal/.test(status)) return "watchlist/proposal";
  if (/portfolio-derived/.test(status)) return "needs kind decision";
  return status.replace(/-/g, " ");
}

function shortId(value: string) {
  return value.replace(/-/g, " ").replace(/\b(ai|em)\b/gi, match => match.toUpperCase()).slice(0, 34);
}

function uniqueSymbols(rows: Array<{ symbol?: string }>) {
  return Array.from(new Set(rows.map(row => row.symbol).filter((symbol): symbol is string => Boolean(symbol))));
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

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
  InvestingAllocationTargets,
  InvestingDailyTradeAnalysis,
  InvestingDailyMarketBrief,
  InvestingTaxonomyDecisionSheet,
  InvestingTaxonomyDecisionWorkflow,
  InvestingTaxonomyDecisions,
  InvestingManualDecisionWorkflow,
  InvestingManualDecisions,
  InvestingWeeklyDecisionReview,
  InvestingLayerIntegrity,
  InvestingReceiptOutcomes,
  InvestingConvictionResetPolicy,
  InvestingExecutionBoundaryPolicy,
  InvestingRankedActionQueue,
  InvestingSourceReliabilityPlan,
  InvestingBasketGovernanceAudit,
  InvestingThesisUniverse,
  InvestingThesisInvalidationReview,
  InvestingThesisInvalidationEvidence,
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
  allocationTargets?: InvestingAllocationTargets | null;
  dailyTradeAnalysis?: InvestingDailyTradeAnalysis | null;
  dailyMarketBrief?: InvestingDailyMarketBrief | null;
  taxonomyDecisionSheet?: InvestingTaxonomyDecisionSheet | null;
  taxonomyDecisionWorkflow?: InvestingTaxonomyDecisionWorkflow | null;
  taxonomyDecisions?: InvestingTaxonomyDecisions | null;
  manualDecisionWorkflow?: InvestingManualDecisionWorkflow | null;
  holdingRoleDecisionWorkflow?: InvestingManualDecisionWorkflow | null;
  decisionPipeline?: InvestingManualDecisionWorkflow | null;
  weeklyDecisionReview?: InvestingWeeklyDecisionReview | null;
  layerIntegrity?: InvestingLayerIntegrity | null;
  receiptOutcomes?: InvestingReceiptOutcomes | null;
  convictionResetPolicy?: InvestingConvictionResetPolicy | null;
  manualDecisions?: InvestingManualDecisions | null;
  executionBoundaryPolicy?: InvestingExecutionBoundaryPolicy | null;
  rankedActionQueue?: InvestingRankedActionQueue | null;
  sourceReliabilityPlan?: InvestingSourceReliabilityPlan | null;
  basketGovernanceAudit?: InvestingBasketGovernanceAudit | null;
  thesisUniverse?: InvestingThesisUniverse | null;
  thesisInvalidationReview?: InvestingThesisInvalidationReview | null;
  thesisInvalidationEvidence?: InvestingThesisInvalidationEvidence | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void | Promise<void>;
}

export default function InvestingTab({ investing, digest, changes, preflight, journal, researchActions, crawlPlan, thesisRegistry, convictionLedger, accumulationPlan, trustedSources, priceAlerts, accumulationOpportunities, proposedTheses, proposedThesisConfig, weeklyTrades, tradeReview, tradeJournal, feedbackCalibration, inputHealth, portfolioContextMap, allocationTargets, dailyTradeAnalysis, dailyMarketBrief, taxonomyDecisionSheet, taxonomyDecisionWorkflow, taxonomyDecisions, manualDecisionWorkflow, holdingRoleDecisionWorkflow, decisionPipeline, weeklyDecisionReview, layerIntegrity, receiptOutcomes, convictionResetPolicy, manualDecisions, executionBoundaryPolicy, rankedActionQueue, sourceReliabilityPlan, basketGovernanceAudit, thesisUniverse, thesisInvalidationReview, thesisInvalidationEvidence, onDiscuss, onAction }: Props) {
  const decisions = digest?.top_decisions ?? [];
  const contradictions = digest?.contradictions ?? [];
  const research = digest?.research_queue ?? [];
  const drift = digest?.portfolio_drift ?? [];
  const theses = thesisRegistry?.theses ?? [];
  const convictionEntries = convictionLedger?.entries ?? [];
  const plans = accumulationPlan?.plans ?? [];
  const sources = trustedSources?.sources ?? [];
  const proposals = proposedTheses?.proposals ?? [];
  const tradePrompts = tradeReview?.prompts ?? [];
  const reviewedTrades = tradeReview?.trades ?? [];

  return (
    <div className="investingPage">
      <h1 className="tabTitle">Investing decision layer</h1>
      <p className="tabSubtitle">5–10 year accumulation focus · {decisions.length || investing.length} current signals</p>

      {dailyMarketBrief && <DailyMarketBriefPanel brief={dailyMarketBrief} onDiscuss={onDiscuss} />}

      {allocationTargets && <TargetAllocationCockpit allocationTargets={allocationTargets} basketGovernanceAudit={basketGovernanceAudit} onDiscuss={onDiscuss} />}

      {preflight && preflight.summary?.status !== "ready" && (
        <section className="investmentSection investmentPreflight">
          <div className="sectionTitleRow"><h2>Live digest preflight</h2><span>{preflight.summary?.status || "unknown"}</span></div>
          {(preflight.summary?.blockers ?? []).map(blocker => <div key={blocker} className="investmentListRow"><strong>Blocked</strong><p>{blocker}</p></div>)}
        </section>
      )}

      {decisionPipeline && (
        <ManualDecisionReview
          title="Investment Decisions · unified cockpit"
          eyebrow="Compression sprint"
          headline="One queue: map → policy → action → receipt → learning"
          ruleText="These are the few decisions worth attention now. Confirm writes a receipt and removes the card; Not now / Archive prevents low-value clutter from lingering. Trades still require explicit Alex confirmation."
          manualDecisionWorkflow={decisionPipeline}
          manualDecisions={manualDecisions}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
      )}

      {convictionResetPolicy?.status === "active" && <ConvictionResetPanel policy={convictionResetPolicy} onDiscuss={onDiscuss} />}

      {accumulationOpportunities && (
        <PullbackAccumulationWatch
          accumulationOpportunities={accumulationOpportunities}
          convictionResetActive={convictionResetPolicy?.status === "active"}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
      )}

      {thesisInvalidationReview && <ThesisInvalidationReviewPanel review={thesisInvalidationReview} evidence={thesisInvalidationEvidence} onDiscuss={onDiscuss} onAction={onAction} />}

      {!decisionPipeline && (executionBoundaryPolicy || rankedActionQueue || sourceReliabilityPlan) && (
        <InvestmentActionCommandCenter
          executionBoundaryPolicy={executionBoundaryPolicy}
          rankedActionQueue={rankedActionQueue}
          sourceReliabilityPlan={sourceReliabilityPlan}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
      )}

      {!decisionPipeline && (manualDecisionWorkflow || manualDecisions) && (
        <ManualDecisionReview
          title="Manual decision queue · policy + valuation"
          eyebrow="Action authority gates"
          headline="Approve ranges before signals become decisions"
          manualDecisionWorkflow={manualDecisionWorkflow}
          manualDecisions={manualDecisions}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
      )}

      {!decisionPipeline && (holdingRoleDecisionWorkflow || manualDecisions) && (
        <ManualDecisionReview
          title="Holding role queue · mapping cleanup"
          eyebrow="Role resolution"
          headline="Classify ambiguous exposure before ranked actions"
          manualDecisionWorkflow={holdingRoleDecisionWorkflow}
          manualDecisions={manualDecisions}
          onDiscuss={onDiscuss}
          onAction={onAction}
        />
      )}

      {dailyTradeAnalysis && <DailyTradeAnalysisPanel dailyTradeAnalysis={dailyTradeAnalysis} onDiscuss={onDiscuss} />}

      {!dailyTradeAnalysis && tradeReview && (
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

      <details className="investmentSection investingArchive" open={false}>
        <summary>
          <span>Research, source health, and legacy detail</span>
          <em>{theses.length} theses · {research.length} research · {sources.length} sources</em>
        </summary>

      {(weeklyDecisionReview || manualDecisions) && (
        <InvestmentDecisionAudit weeklyDecisionReview={weeklyDecisionReview} manualDecisions={manualDecisions} onDiscuss={onDiscuss} />
      )}

      {receiptOutcomes && <ReceiptOutcomeLoop receiptOutcomes={receiptOutcomes} onDiscuss={onDiscuss} />}

      {layerIntegrity && <LayerIntegrityPanel layerIntegrity={layerIntegrity} onDiscuss={onDiscuss} />}

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

      {digest && (
        <section className="investmentDigestHero investmentDigestHero--compact">
          <div>
            <span className="digestEyebrow">Thesis Baskets digest · {formatDate(digest.as_of)}</span>
            <h2>{digest.posture?.headline || "Latest investment posture"}</h2>
            {digest.posture?.summary && <p>{digest.posture.summary}</p>}
            {digest.posture?.key_risk && <strong>Key risk: {digest.posture.key_risk}</strong>}
          </div>
          <a href={digest.source_url} target="_blank" rel="noreferrer">Open source brief</a>
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

      <section className="investmentSection">
        <div className="sectionTitleRow"><h2>Proposed theses</h2><span>{proposals.length}</span></div>
        {proposedThesisConfig?.thresholds && <p className="emptyText">Thresholds: evidence ≥ {proposedThesisConfig.thresholds.minimumEvidenceScore}, differentiation ≥ {proposedThesisConfig.thresholds.minimumDifferentiationScore}</p>}
        {proposals.slice(0, 6).map(item => <div key={item.id} className="investmentListRow"><strong>{item.recommendation} · {item.title}</strong><p>{item.thesisDraft}</p><em>{(item.symbols || []).join(", ")} · evidence {item.evidenceScore} · differentiated {item.differentiationScore}</em><div className="investmentButtonRow"><button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: item.title, theme: "proposed thesis", stance: item.recommendation })}>Discuss</button><button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "promote-thesis", { thesisId: item.id, stage: "candidate", title: item.title, symbols: item.symbols, rationale: item.thesisDraft })}>Approve candidate</button></div></div>)}
      </section>

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
      </details>
    </div>
  );
}

function DailyMarketBriefPanel({ brief, onDiscuss }: { brief: InvestingDailyMarketBrief; onDiscuss: Props["onDiscuss"] }) {
  const drivers = brief.marketDrivers ?? [];
  const lookPast = brief.lookPast ?? [];
  const payAttention = brief.payAttention ?? [];
  const thesisImpacts = brief.thesisImpacts ?? [];
  return (
    <section className="investmentSection dailyMarketBrief">
      <div className="dailyMarketBriefHeader">
        <div>
          <span className="digestEyebrow">Daily market brief · published {brief.publishedAt ? formatTime(brief.publishedAt) : "noon"}</span>
          <h2>{brief.headline}</h2>
          <p>{brief.summary}</p>
        </div>
        <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: "daily-market-brief", type: "daily-market-brief", title: brief.headline, theme: "market thesis brief", stance: brief.status || "published", summary: brief.discussionPrompt || brief.summary })}>Discuss brief</button>
      </div>
      <div className="dailyMarketBriefGrid">
        <div className="dailyMarketColumn">
          <strong>Moving markets</strong>
          {drivers.slice(0, 4).map(item => <p key={item.id}><b>{item.title}</b>{item.summary}<em>{[item.direction, item.urgency, ...(item.relatedSymbols ?? []).slice(0, 4)].filter(Boolean).join(" · ")}</em></p>)}
        </div>
        <div className="dailyMarketColumn dailyMarketColumn--muted">
          <strong>Look past</strong>
          {lookPast.slice(0, 4).map(item => <p key={item.id}><b>{item.title}</b>{item.reason}<em>{item.watchIf ? `Watch if: ${item.watchIf}` : "Noise unless it persists"}</em></p>)}
        </div>
        <div className="dailyMarketColumn dailyMarketColumn--focus">
          <strong>Pay attention</strong>
          {payAttention.slice(0, 4).map(item => <p key={item.id}><b>{item.title}</b>{item.reason}<em>{item.portfolioRelevance || (item.relatedSymbols ?? []).join(", ")}</em></p>)}
        </div>
      </div>
      {(thesisImpacts.length > 0 || brief.portfolioRead) && (
        <div className="dailyMarketThesisStrip">
          {brief.portfolioRead && <span><b>Portfolio read</b>{brief.portfolioRead}</span>}
          {thesisImpacts.slice(0, 4).map(item => <span key={`${item.thesisId || item.title}-${item.action || ""}`}><b>{item.title}</b>{item.impact}<em>{[item.action, item.confidence].filter(Boolean).join(" · ")}</em></span>)}
        </div>
      )}
    </section>
  );
}

function TargetAllocationCockpit({ allocationTargets, basketGovernanceAudit, onDiscuss }: { allocationTargets: InvestingAllocationTargets; basketGovernanceAudit?: InvestingBasketGovernanceAudit | null; onDiscuss: Props["onDiscuss"] }) {
  const sleeves = allocationTargets.sleeves ?? [];
  const [selectedId, setSelectedId] = useState(sleeves[0]?.id ?? "");
  const [expandedEventId, setExpandedEventId] = useState(allocationTargets.targetChangeEvents?.[0]?.id ?? "");
  const selected = sleeves.find(sleeve => sleeve.id === selectedId) ?? sleeves[0] ?? null;
  const basketRows = basketGovernanceAudit?.baskets ?? [];
  const selectedBasket = selected ? basketRows.find(basket => basket.id === selected.id || basket.title === selected.title) ?? null : null;
  const selectedEvent = selected ? allocationTargets.targetChangeEvents?.find(event => event.id === selected.latestChangeEventId || event.sleeveId === selected.id) : null;
  const recentEvents = allocationTargets.targetChangeEvents ?? [];
  const correlationRows = selected ? basketCorrelationRows(selected, sleeves, selectedBasket, basketRows) : [];

  if (!sleeves.length) return null;

  return (
    <section className="investmentSection targetCockpit">
      <div className="targetCockpitHeader">
        <div>
          <span className="digestEyebrow">Allocation engine · {formatDate(allocationTargets.generatedAt)}</span>
          <h2>Target allocation cockpit</h2>
          <p>Current portfolio weights vs model target ranges. Target changes are approved model outputs only; no trades placed.</p>
        </div>
        <div className="targetBoundaryPill">Model targets · no trades</div>
      </div>

      <div className="targetKpiStrip">
        <span><strong>{allocationTargets.summary.targetCoveragePct}%</strong> coverage</span>
        <span><strong>{allocationTargets.summary.inRangeCount}</strong> in range</span>
        <span><strong>{allocationTargets.summary.overweightCount}</strong> overweight</span>
        <span><strong>{allocationTargets.summary.underweightCount}</strong> underweight</span>
        <span><strong>{allocationTargets.summary.recentChangeCount}</strong> target changes</span>
        <span><strong>{formatMoney(allocationTargets.scope?.trackedEquity)}</strong> tracked</span>
      </div>

      <div className="targetCockpitGrid">
        <div className="targetTreemap" aria-label="Current allocation by target sleeve">
          {sleeves.slice(0, 14).map(sleeve => {
            const selectedTile = selected?.id === sleeve.id;
            return (
              <button
                key={sleeve.id}
                className={`targetTile targetTile--${targetToneClass(sleeve.statusTone || sleeve.status)}${selectedTile ? " targetTile--selected" : ""}`}
                style={{ flexBasis: `${Math.max(9, Math.min(34, sleeve.currentPct * 1.65))}%` }}
                onClick={() => setSelectedId(sleeve.id)}
                title={`${sleeve.title}: ${sleeve.currentPct.toFixed(1)}%, target ${sleeve.target.minPct}-${sleeve.target.maxPct}%`}
              >
                <span>{sleeve.title}</span>
                <strong>{sleeve.currentPct.toFixed(1)}%</strong>
                <em>Target {sleeve.target.minPct}-{sleeve.target.maxPct}% · {sleeve.status.replace(/-/g, " ")}</em>
                <TargetRangeBar current={sleeve.currentPct} min={sleeve.target.minPct} max={sleeve.target.maxPct} />
              </button>
            );
          })}
        </div>

        <aside className="targetDetailPanel">
          {selected && (
            <>
              <div className="targetDetailTop">
                <span className={`targetStatus targetStatus--${targetToneClass(selected.statusTone || selected.status)}`}>{selected.status.replace(/-/g, " ")}</span>
                <strong>{selected.title}</strong>
                <p>{selected.actionPosture || "Hold/review."}</p>
              </div>
              <div className="targetMetricGrid">
                <span><b>{selected.currentPct.toFixed(1)}%</b><em>Current</em></span>
                <span><b>{selected.target.minPct}-{selected.target.maxPct}%</b><em>Target</em></span>
                <span><b>{selected.gapToTargetMidPct > 0 ? "+" : ""}{selected.gapToTargetMidPct.toFixed(1)} pts</b><em>Gap to mid</em></span>
                <span><b>{selected.confidence || "n/a"}</b><em>Confidence</em></span>
              </div>
              {selectedEvent && (
                <div className="targetChangeCallout">
                  <span>Latest target event</span>
                  <strong>{selectedEvent.changeDirection} · {selectedEvent.changeMagnitudePct.toFixed(1)} pts</strong>
                  <p>{selectedEvent.summary || selectedEvent.analysisSummary}</p>
                </div>
              )}
              <div className="targetReceiptStack">
                <span>Receipts</span>
                {(selected.receipts ?? []).slice(0, 4).map(receipt => (
                  <p key={`${receipt.label}-${receipt.source}`}>{receipt.excerpt || receipt.label}<em>{receipt.source}</em></p>
                ))}
              </div>
              <div className="targetBasketDossier">
                <span>Basket dossier</span>
                <p>{selectedBasket?.definition?.appThesis || selectedBasket?.definition?.registryClaim || selected.actionPosture || "No thesis text recorded for this sleeve yet."}</p>
                {selectedBasket?.definition?.canonicalBoundary && (
                  <div className="targetBoundaryGrid">
                    <em><b>Owns</b>{selectedBasket.definition.canonicalBoundary.owns || "not specified"}</em>
                    <em><b>Does not own</b>{selectedBasket.definition.canonicalBoundary.does_not_own || "not specified"}</em>
                  </div>
                )}
              </div>
              <div className="targetHoldingStack">
                <span>Holdings</span>
                <div className="targetHoldingLine">
                  {(selected.holdings ?? []).slice(0, 10).map(h => <span key={h.symbol}>{h.symbol} {h.portfolioPct != null ? `${h.portfolioPct.toFixed(1)}%` : ""}</span>)}
                </div>
              </div>
              {(selected.invalidators?.length || selectedBasket?.governanceQuestions?.length) ? (
                <div className="targetInvalidatorStack">
                  <span>Invalidators / gates</span>
                  {[...(selected.invalidators ?? []), ...(selectedBasket?.governanceQuestions ?? [])].slice(0, 4).map(item => <p key={item}>{item}</p>)}
                </div>
              ) : null}
              <div className="investmentButtonRow">
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `thesis-${selected.id}`, type: "investing-target-change", title: `${selected.title} current thesis`, theme: "target allocation thesis", stance: selected.status, summary: selectedBasket?.definition?.appThesis || selectedBasket?.definition?.registryClaim || selectedEvent?.analysisSummary || selected.actionPosture })}>Current thesis</button>
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `week-${selected.id}`, type: "investing-target-change", title: `Is ${selected.title} working this week?`, theme: "weekly thesis check", stance: selected.status, summary: `${selected.actionPosture || ""} Holdings: ${(selected.holdings ?? []).map(h => h.symbol).join(", ")}` })}>Working this week?</button>
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `invalidators-${selected.id}`, type: "investing-target-change", title: `${selected.title} invalidators`, theme: "key invalidators", stance: selected.confidence, summary: [...(selected.invalidators ?? []), ...(selectedBasket?.governanceQuestions ?? [])].join(" ") || selectedEvent?.discussionPrompt || selected.actionPosture })}>Invalidators</button>
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `correlation-${selected.id}`, type: "investing-target-change", title: `${selected.title} correlation map`, theme: "basket correlation", stance: selected.status, summary: correlationRows.map(row => `${row.title}: ${row.level} (${row.reason})`).join("\n") || "Review overlapping drivers and concentration risk." })}>Correlation risk</button>
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `expression-${selected.id}`, type: "investing-target-change", title: `${selected.title} best expressions`, theme: "holding quality", stance: selected.confidence, summary: `Current holdings: ${(selected.holdings ?? []).map(h => `${h.symbol}${h.portfolioPct != null ? ` ${h.portfolioPct.toFixed(1)}%` : ""}`).join(", ")}` })}>Best expressions</button>
              </div>
            </>
          )}
        </aside>
      </div>

      {selected && (
        <div className="targetCorrelationPanel">
          <div className="sectionTitleRow"><h2>Correlation lens</h2><span>{correlationRows.length} relationships</span></div>
          <div className="targetCorrelationBody">
            <div className="targetCorrelationMatrix" aria-label={`Correlation levels for ${selected.title}`}>
              {correlationRows.slice(0, 9).map(row => (
                <button key={`${selected.id}-${row.id}`} className={`targetCorrelationCell targetCorrelationCell--${row.level}`} onClick={() => setSelectedId(row.id)} title={row.reason}>
                  <strong>{row.shortTitle}</strong>
                  <span>{row.level}</span>
                  <em>{row.sharedSymbols.length ? row.sharedSymbols.slice(0, 3).join(", ") : row.basis}</em>
                </button>
              ))}
            </div>
            <div className="targetCorrelationNotes">
              <strong>{selected.title}</strong>
              <p>Explicit canonical relationships are shown first. When a relationship is not recorded, the cockpit uses a conservative overlap proxy from shared holdings, sector words, and target-status co-movement.</p>
              {correlationRows.slice(0, 4).map(row => <span key={`note-${row.id}`}><b>{row.title}</b>{row.reason}</span>)}
            </div>
          </div>
        </div>
      )}

      <div className="targetEventHistory">
        <div className="sectionTitleRow"><h2>Target change history</h2><span>{recentEvents.length} events</span></div>
        {recentEvents.slice(0, 8).map(event => {
          const open = expandedEventId === event.id;
          return (
            <article key={event.id} className="targetEventRow">
              <button className="targetEventSummary" onClick={() => setExpandedEventId(open ? "" : event.id)}>
                <span><strong>{sleeves.find(s => s.id === event.sleeveId)?.title || event.sleeveId}</strong><em>{formatDate(event.at)} · {event.impactType || "target"}</em></span>
                <span>{event.priorTarget ? `${event.priorTarget.minPct}-${event.priorTarget.maxPct}%` : "n/a"} → {event.newTarget.minPct}-{event.newTarget.maxPct}%</span>
                <b>{event.changeDirection}</b>
              </button>
              {open && (
                <div className="targetEventDetail">
                  <p>{event.analysisSummary || event.summary || "No analysis summary recorded."}</p>
                  <div className="targetEventColumns">
                    <div><strong>Evidence</strong>{(event.evidenceConsidered ?? []).slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>
                    <div><strong>Would reverse if</strong>{(event.reversalConditions ?? []).slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>
                  </div>
                  <div className="investmentButtonRow">
                    <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: event.id, type: "investing-target-change", title: event.title, theme: "target change analysis", stance: event.changeDirection, summary: event.analysisSummary || event.discussionPrompt })}>Discuss</button>
                    <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `follow-up-${event.id}`, type: "investing-target-change", title: `Follow-up: ${event.title}`, theme: "target change follow-up", stance: event.status, summary: event.discussionPrompt })}>Add follow-up</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TargetRangeBar({ current, min, max }: { current: number; min: number; max: number }) {
  const scale = Math.max(max * 1.25, current * 1.12, 1);
  const currentWidth = Math.min(100, (current / scale) * 100);
  const left = Math.min(100, (min / scale) * 100);
  const width = Math.max(3, Math.min(100 - left, ((max - min) / scale) * 100));
  return <i className="targetRangeBar"><b style={{ left: `${left}%`, width: `${width}%` }} /><span style={{ width: `${currentWidth}%` }} /></i>;
}

type TargetSleeve = InvestingAllocationTargets["sleeves"][number];
type GovernanceBasket = NonNullable<InvestingBasketGovernanceAudit["baskets"]>[number];
type CorrelationRow = { id: string; title: string; shortTitle: string; level: "high" | "medium" | "low"; basis: string; reason: string; sharedSymbols: string[] };

function basketCorrelationRows(selected: TargetSleeve, sleeves: TargetSleeve[], selectedBasket: GovernanceBasket | null, baskets: GovernanceBasket[]): CorrelationRow[] {
  const selectedSymbols = new Set((selected.holdings ?? []).map(h => h.symbol));
  const explicit = new Map<string, CorrelationRow>();
  for (const overlap of (selectedBasket?.overlaps ?? []) as Array<Record<string, unknown>>) {
    const raw = typeof overlap.raw === "object" && overlap.raw ? overlap.raw as Record<string, unknown> : {};
    const payload = typeof raw.payload === "object" && raw.payload ? raw.payload as Record<string, unknown> : {};
    const targetId = String(raw.target_basket_id || payload.target_basket_id || "");
    const sourceId = String(raw.source_basket_id || payload.source_basket_id || "");
    const relatedTitle = String(raw.source_basket_name || "");
    const related = baskets.find(basket => basket.id === targetId || basket.id === sourceId || basket.title === relatedTitle);
    const sleeve = findRelatedSleeve(sleeves, selected.id, related?.title || relatedTitle, related?.id || targetId || sourceId);
    if (!sleeve) continue;
    const id = sleeve?.id || related?.id || targetId || sourceId;
    if (!id || id === selected.id || explicit.has(id)) continue;
    const title = sleeve.title;
    const level = correlationLevel(String(overlap.correlation_level || raw.correlation_level || payload.correlation_level || "medium"));
    explicit.set(id, {
      id,
      title,
      shortTitle: shortBasketTitle(title),
      level,
      basis: "canonical",
      reason: String(overlap.rationale || raw.rationale || payload.rationale || "Canonical basket relationship."),
      sharedSymbols: sharedHoldingSymbols(selectedSymbols, sleeve),
    });
  }

  const inferred = sleeves
    .filter(sleeve => sleeve.id !== selected.id && !explicit.has(sleeve.id))
    .map(sleeve => inferredCorrelationRow(selected, sleeve, selectedSymbols))
    .filter(row => row.level !== "low" || row.sharedSymbols.length > 0)
    .sort((a, b) => correlationRank(b.level) - correlationRank(a.level) || b.sharedSymbols.length - a.sharedSymbols.length)
    .slice(0, Math.max(0, 9 - explicit.size));

  return [...explicit.values(), ...inferred]
    .sort((a, b) => correlationRank(b.level) - correlationRank(a.level) || a.title.localeCompare(b.title))
    .slice(0, 9);
}

function findRelatedSleeve(sleeves: TargetSleeve[], selectedId: string, title: string, id?: string) {
  const direct = sleeves.find(sleeve => sleeve.id !== selectedId && (sleeve.id === id || sleeve.title === title));
  if (direct) return direct;
  const words = topicalWords(title);
  if (!words.length) return null;
  return sleeves
    .filter(sleeve => sleeve.id !== selectedId)
    .map(sleeve => ({ sleeve, overlap: topicalWords(sleeve.title).filter(word => words.includes(word)).length }))
    .filter(item => item.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap)[0]?.sleeve ?? null;
}

function inferredCorrelationRow(selected: TargetSleeve, sleeve: TargetSleeve, selectedSymbols: Set<string>): CorrelationRow {
  const sharedSymbols = sharedHoldingSymbols(selectedSymbols, sleeve);
  const titleWords = topicalWords(selected.title);
  const matchingWords = topicalWords(sleeve.title).filter(word => titleWords.includes(word));
  const sameStatus = selected.status === sleeve.status && selected.status !== "in-range";
  const level = sharedSymbols.length >= 2 || matchingWords.length >= 2 ? "high" : sharedSymbols.length || matchingWords.length || sameStatus ? "medium" : "low";
  const basis = sharedSymbols.length ? "shared holdings" : matchingWords.length ? "theme overlap" : sameStatus ? "status co-movement" : "low overlap";
  return {
    id: sleeve.id,
    title: sleeve.title,
    shortTitle: shortBasketTitle(sleeve.title),
    level,
    basis,
    reason: sharedSymbols.length
      ? `Shares ${sharedSymbols.slice(0, 4).join(", ")} exposure.`
      : matchingWords.length
        ? `Shares ${matchingWords.slice(0, 3).join(", ")} thesis language.`
        : sameStatus
          ? `Both are currently ${selected.status.replace(/-/g, " ")} against target ranges.`
          : "No explicit relationship recorded; shown as a low-overlap sleeve.",
    sharedSymbols,
  };
}

function sharedHoldingSymbols(selectedSymbols: Set<string>, sleeve?: TargetSleeve) {
  return (sleeve?.holdings ?? []).map(h => h.symbol).filter(symbol => selectedSymbols.has(symbol));
}

function topicalWords(title: string) {
  const stop = new Set(["and", "the", "for", "with", "stockpiling", "strategic", "basket", "sleeve"]);
  return title.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && !stop.has(word));
}

function correlationLevel(value: string): CorrelationRow["level"] {
  const lower = value.toLowerCase();
  if (lower.includes("high")) return "high";
  if (lower.includes("low")) return "low";
  return "medium";
}

function correlationRank(value: CorrelationRow["level"]) {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function shortBasketTitle(title: string) {
  return title.replace(/\s*\/\s*/g, " / ").split(/\s+/).slice(0, 5).join(" ");
}

function DailyTradeAnalysisPanel({ dailyTradeAnalysis, onDiscuss }: { dailyTradeAnalysis: InvestingDailyTradeAnalysis; onDiscuss: Props["onDiscuss"] }) {
  const days = dailyTradeAnalysis.days ?? [];
  const [expandedDate, setExpandedDate] = useState(days[0]?.date ?? "");
  if (!days.length) return null;

  return (
    <section className="investmentSection dailyTradePanel">
      <div className="tradeReviewHeader">
        <div>
          <span className="digestEyebrow">Daily trade analysis · {formatDate(dailyTradeAnalysis.generatedAt)}</span>
          <h2>Trades by day</h2>
          <p>{dailyTradeAnalysis.sourceWindow?.startDate} → {dailyTradeAnalysis.sourceWindow?.endDate} · retrospective analysis, not trade authorization</p>
        </div>
        <div className="tradeReviewStats">
          <span><strong>{dailyTradeAnalysis.summary.dayCount}</strong> days</span>
          <span><strong>{dailyTradeAnalysis.summary.tradeCount}</strong> events</span>
          <span><strong>{dailyTradeAnalysis.summary.totalPlanAligned}</strong> aligned</span>
          <span><strong>{dailyTradeAnalysis.summary.totalOutsidePlan}</strong> outside plan</span>
        </div>
      </div>
      <div className="dailyTradeStack">
        {days.slice(0, 8).map(day => {
          const open = expandedDate === day.date;
          return (
            <article key={day.date} className="dailyTradeDay">
              <button className="dailyTradeSummary" onClick={() => setExpandedDate(open ? "" : day.date)}>
                <span><strong>{day.date}</strong><em>{day.dailySummary}</em></span>
                <span>{day.symbols.slice(0, 7).join(", ") || "cash"}</span>
                <b>{formatMoney(day.netAmount)}</b>
              </button>
              {open && (
                <div className="dailyTradeDetail">
                  <div className="dailyTradeAnalysisGrid">
                    <p><strong>Behavior</strong>{day.behavioralRead}</p>
                    <p><strong>Target impact</strong>{day.targetAllocationImpact}</p>
                    <p><strong>Risk read</strong>{day.riskConcentrationImpact}</p>
                  </div>
                  {day.followUps?.length ? <div className="dailyTradeFollowups">{day.followUps.map(item => <span key={item.id}>{item.symbol || "Trade"} · {item.prompt}</span>)}</div> : null}
                  <div className="dailyTradeTable">
                    {day.trades.slice(0, 10).map(trade => (
                      <div key={trade.id} className="dailyTradeLine">
                        <strong>{trade.action.toUpperCase()} {trade.symbol || "cash"}</strong>
                        <span>{formatMoneyAbs(trade.amount)} · {trade.alignment || "unknown"}</span>
                        <em>{trade.thesisTitle || trade.description || "No thesis mapping"}</em>
                      </div>
                    ))}
                  </div>
                  <div className="investmentButtonRow">
                    <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `daily-trade-${day.date}`, type: "daily-trade-analysis", title: `Trades on ${day.date}`, theme: "daily trade analysis", stance: `${day.tradeCount} events`, summary: `${day.behavioralRead} ${day.targetAllocationImpact}` })}>Discuss day</button>
                    <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: `journal-trade-${day.date}`, type: "daily-trade-analysis", title: `Journal ${day.date} trades`, theme: "trade journal", stance: "retrospective", summary: day.riskConcentrationImpact })}>Journal</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PullbackAccumulationWatch({ accumulationOpportunities, convictionResetActive, onDiscuss, onAction }: {
  accumulationOpportunities: InvestingAccumulationOpportunities;
  convictionResetActive: boolean;
  onDiscuss: Props["onDiscuss"];
  onAction?: Props["onAction"];
}) {
  const opportunities = [...(accumulationOpportunities.opportunities ?? [])]
    .sort((a, b) => Number(b.materialReview || false) - Number(a.materialReview || false) || (a.pullbackPct ?? 0) - (b.pullbackPct ?? 0));
  const quotes = accumulationOpportunities.quotes ?? [];
  const displayed = opportunities.slice(0, 8);
  const materialReviews = opportunities.filter(item => item.materialReview).length;

  return (
    <section className="investmentSection pullbackWatchPanel">
      <div className="sectionTitleRow"><h2>Pullback accumulation watch</h2><span>{opportunities.length} triggered · {quotes.length} tracked</span></div>
      <div className="pullbackWatchIntro">
        <div>
          <span className="digestEyebrow">High-conviction candidates · review first</span>
          <h3>Good thesis, better entry</h3>
          <p>Names surface when a thesis-aware value range or pullback trigger fires. This is an accumulation review queue, not a buy alert.</p>
          {convictionResetActive && <strong>Conviction is still neutral until fresh evidence is recorded.</strong>}
        </div>
        <div className="inputHealthStats">
          <span><strong>{opportunities.length}</strong> triggered</span>
          <span><strong>{materialReviews}</strong> material reviews</span>
          <span><strong>{quotes.length}</strong> tracked quotes</span>
        </div>
      </div>
      {displayed.length > 0 ? (
        <div className="pullbackWatchGrid">
          {displayed.map(item => (
            <article key={item.id} className="pullbackWatchCard">
              <div className="decisionTop"><span>{item.reviewState?.replace(/-/g, " ") || "pullback review"}</span><strong>{formatPullback(item.pullbackPct)}</strong></div>
              <h3>{item.symbol}</h3>
              <p>{item.thesisTitle}</p>
              <em>{item.trigger} · {formatMoney(item.close)} · {formatPortfolioPct(item.position?.portfolioPct)}</em>
              <small>{item.thesisStatus || item.checks?.planStatus || "review candidate"}</small>
              <div className="investmentButtonRow">
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "ticker", title: `${item.symbol} pullback review`, theme: item.thesisTitle, stance: item.action })}><span className="alphaGlyph">α</span> Discuss</button>
                <button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "record-decision", { title: `${item.symbol} pullback review`, decision: item.action, rationale: item.message, symbols: [item.symbol], thesisId: item.thesisId })}>Journal review</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="emptyText">No thesis-aware pullback opportunities currently triggered.</p>}
    </section>
  );
}

function formatPullback(value?: number | null) {
  return typeof value === "number" ? `${Math.abs(value).toFixed(1)}% off high` : "range trigger";
}

function formatPortfolioPct(value?: number | null) {
  return typeof value === "number" && value > 0 ? `${value.toFixed(2)}% held` : "not held";
}

function formatExposurePct(value?: number | null) {
  return typeof value === "number" && value > 0 ? `${value.toFixed(2)}% exposure` : "no current exposure";
}

function ThesisInvalidationReviewPanel({ review, evidence, onDiscuss, onAction }: {
  review: InvestingThesisInvalidationReview;
  evidence?: InvestingThesisInvalidationEvidence | null;
  onDiscuss: Props["onDiscuss"];
  onAction?: Props["onAction"];
}) {
  const active = review.activeReviews ?? [];
  const risks = review.systemRisks ?? [];
  const notificationCandidates = review.notifications?.candidates ?? [];
  const notificationPolicy = review.notifications?.policy;
  return (
    <section className="investmentSection invalidationPanel">
      <div className="sectionTitleRow"><h2>Thesis invalidation review</h2><span>{review.summary?.activeReviewCount ?? active.length} active · {review.summary?.highPriorityCount ?? 0} high · {review.summary?.notificationCandidateCount ?? notificationCandidates.length} notify</span></div>
      <div className="pullbackWatchIntro">
        <div>
          <span className="digestEyebrow">Bear-case first · no trade execution</span>
          <h3>Prove it still deserves capital</h3>
          <p>Active and portfolio-relevant theses are interrogated against explicit invalidators, broken assumptions, stale conviction, exposure size, and source-health risk.</p>
          <strong>Current-data checks are required before any trim, pause, or exit recommendation.</strong>
          {notificationPolicy?.sendRule && <em className="invalidationNotificationRule">{notificationPolicy.sendRule}</em>}
        </div>
        <div className="inputHealthStats">
          <span><strong>{review.summary?.thesisCount ?? review.reviews?.length ?? 0}</strong> theses</span>
          <span><strong>{review.summary?.exposedReviewCount ?? 0}</strong> exposed</span>
          <span><strong>{String(review.summary?.sourceHealthStatus ?? "unknown")}</strong> sources</span>
        </div>
      </div>
      <div className="investmentCardGrid invalidationCardGrid">
        {active.slice(0, 6).map(item => (
          <article key={item.id} className="investmentDecision invalidationCard">
            <div className="decisionTop"><span>{item.priority} · {item.recommendedAction.replace(/-/g, " ")}</span><strong>{Math.round(item.challengeScore)}</strong></div>
            <h3>{item.title}</h3>
            <p>{item.whyNow || item.coreClaim || "Review explicit invalidators before adding or maintaining capital."}</p>
            <div className="decisionMeta">{formatExposurePct(item.exposurePct)} · {(item.symbols || []).slice(0, 6).join(", ") || "theme"}</div>
            {(item.probes || []).slice(0, 2).map(probe => <em key={probe}>{probe}</em>)}
            <div className="investmentButtonRow">
              <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: item.id, type: "decision", title: `${item.title} invalidation review`, category: "investing invalidation", summary: (item.probes || []).slice(0, 3).join(" ") || item.whyNow })}><span className="alphaGlyph">α</span> Interrogate</button>
              <button className="btnAlphaDiscuss" onClick={() => onAction?.(item.id, "record-decision", { title: `${item.title} invalidation review`, decision: item.recommendedAction, rationale: item.whyNow, symbols: item.symbols })}>Journal review</button>
            </div>
          </article>
        ))}
      </div>
      <div className="invalidationNotificationPanel">
        <div>
          <span className="digestEyebrow">Discord surfacing</span>
          <h3>{notificationCandidates.length ? `${notificationCandidates.length} candidate${notificationCandidates.length === 1 ? "" : "s"} for #investing` : "No new or escalated Discord alert"}</h3>
          <p>{notificationPolicy?.repeatSuppression || "Repeat posts are suppressed unless severity or evidence changes."}</p>
          {evidence?.summary && <p className="evidencePacketStats">{evidence.summary.packets ?? 0} packets checked · {evidence.summary.confirmedMaterialRisks ?? 0} confirmed risks · {evidence.summary.needsCurrentSourceCheck ?? 0} need current sources</p>}
        </div>
        {notificationCandidates.slice(0, 2).map(candidate => (
          <article key={candidate.id}>
            <strong>{candidate.priority} · {candidate.cadence.replace(/-/g, " ")}</strong>
            <span>{candidate.title}</span>
            <p>{(candidate.changeReasons || []).slice(0, 2).join(" · ") || "New review candidate"}</p>
          </article>
        ))}
      </div>
      {risks.length > 0 && (
        <div className="invalidationRiskStrip">
          {risks.slice(0, 3).map(risk => <span key={risk.id}><strong>{risk.severity || "risk"}</strong>{risk.title}</span>)}
        </div>
      )}
    </section>
  );
}

function InvestmentActionCommandCenter({ executionBoundaryPolicy, rankedActionQueue, sourceReliabilityPlan, onDiscuss, onAction }: {
  executionBoundaryPolicy?: InvestingExecutionBoundaryPolicy | null;
  rankedActionQueue?: InvestingRankedActionQueue | null;
  sourceReliabilityPlan?: InvestingSourceReliabilityPlan | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void | Promise<void>;
}) {
  const actions = rankedActionQueue?.actions ?? [];
  const failures = sourceReliabilityPlan?.actionableFailures ?? [];
  return (
    <section className="investmentSection investmentActionCommand">
      <div className="sectionTitleRow"><h2>Ranked investment action queue</h2><span>{actions.length} cards · {rankedActionQueue?.summary?.blockedByManualGates ?? 0} gated</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">Execution boundary · {executionBoundaryPolicy?.status || "active"}</span>
          <h3>{executionBoundaryPolicy?.defaultTradePosture === "never-execute" ? "Recommendations only — no automated trades" : "Execution policy loaded"}</h3>
          <p>{executionBoundaryPolicy?.purpose || "The system may rank and stage decisions, but trades require explicit Alex confirmation."}</p>
          <div className="taxonomyStats"><span><strong>{rankedActionQueue?.sourceHealth?.status || "—"}</strong> source health</span><span><strong>{rankedActionQueue?.sourceHealth?.actionableFailedRuns14 ?? "—"}</strong> actionable failures 14d</span><span><strong>{rankedActionQueue?.sourceHealth?.penalty ?? 0}</strong> score penalty</span></div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Hard rule</strong>
          <p>Dashboard cards can recommend, stage, and journal. Actual trades stay outside automation and require explicit Alex confirmation.</p>
          <em>{executionBoundaryPolicy?.dashboardReceiptRule || "Every saved action needs a durable receipt."}</em>
        </div>
      </div>
      <div className="investmentCardGrid">
        {actions.slice(0, 10).map(action => (
          <article key={action.id} className="investmentDecision">
            <div className="decisionTop"><span>#{action.rank} · score {action.rankScore}</span><strong>{action.allowedActionLevel}</strong></div>
            <h3>{action.title}</h3>
            <p>{action.recommendation}</p>
            <div className="decisionMeta">{(action.tickers || []).join(", ") || "theme"} · blockers {(action.blockers || []).length}</div>
            <p className="emptyText">{action.rationale}</p>
            {(action.blockers || []).length > 0 && <div className="taxonomyImpactLine"><span>Blocked by</span><em>{(action.blockers || []).join(", ")}</em></div>}
            <div className="investmentButtonRow">
              <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: action.id, type: "decision", title: action.title, category: "ranked investment action", summary: action.recommendation })}>Discuss</button>
              <button className="btnAlphaDiscuss" onClick={() => onAction?.(action.id, "record-decision", { title: action.title, decision: action.allowedActionLevel, rationale: action.rationale, symbols: action.tickers })}>Journal</button>
            </div>
          </article>
        ))}
      </div>
      {failures.length > 0 && (
        <div className="taxonomyPanel">
          <div className="sectionTitleRow"><h2>Source reliability hardening</h2><span>{failures.length} actionable groups</span></div>
          {failures.slice(0, 4).map(item => <div key={item.id} className="investmentListRow"><strong>{item.priority} · {item.platform} · {item.runs} runs</strong><p>{item.recommendedAction}</p><em>{item.error}</em></div>)}
        </div>
      )}
    </section>
  );
}

function InvestmentDecisionAudit({ weeklyDecisionReview, manualDecisions, onDiscuss }: {
  weeklyDecisionReview?: InvestingWeeklyDecisionReview | null;
  manualDecisions?: InvestingManualDecisions | null;
  onDiscuss: (ctx: ThreadContext) => void;
}) {
  const receipts = weeklyDecisionReview?.recentReceipts ?? (manualDecisions?.decisions ?? []).slice(0, 12).map(item => ({
    decisionPointId: item.decisionPointId,
    choiceId: item.choiceId,
    status: item.status,
    stage: undefined,
    decisionType: undefined,
    updatedAt: item.updatedAt,
    revisitAt: undefined,
    rationale: item.rationale,
  }));
  const signals = weeklyDecisionReview?.learningSignals ?? [];
  const summary = weeklyDecisionReview?.summary ?? {};
  return (
    <section className="investmentSection investmentAuditTrail">
      <div className="sectionTitleRow"><h2>Decision receipts + learning loop</h2><span>{String(summary.receiptCount7d ?? receipts.length)} receipts this week</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">Audit trail · {weeklyDecisionReview?.generatedAt ? formatDate(weeklyDecisionReview.generatedAt) : "latest"}</span>
          <h3>What the system learned from recent decisions</h3>
          <p>Confirmed, deferred, and archived decisions leave receipts here so the active queue can stay small without losing context.</p>
          <div className="taxonomyStats"><span><strong>{String(summary.activeDecisionCount ?? "—")}</strong> active</span><span><strong>{String(summary.hiddenByLimitCount ?? "—")}</strong> hidden by cap</span><span><strong>{String(summary.actionableSourceFailures14d ?? "—")}</strong> source failures</span></div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Compression rule</strong>
          <p>Receipts are the memory. The cockpit only keeps decisions that still need attention.</p>
          <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: "investing-weekly-decision-review", type: "decision", title: "Weekly investing decision review", category: "investing learning loop", summary: signals.join(" ") || "Review recent receipts and calibration signals." })}>Discuss learning</button>
        </div>
      </div>
      {signals.length > 0 && <div className="investmentCardGrid">{signals.slice(0, 4).map(signal => <article key={signal} className="investmentDecision"><div className="decisionTop"><span>learning signal</span><strong>review</strong></div><p>{signal}</p></article>)}</div>}
      <div className="taxonomyPanel">
        <div className="sectionTitleRow"><h2>Recent receipts</h2><span>{receipts.length}</span></div>
        {receipts.length ? receipts.slice(0, 12).map(receipt => <div key={`${receipt.decisionPointId}-${receipt.updatedAt || receipt.choiceId}`} className="investmentListRow"><strong>{receipt.decisionPointId} → {receipt.choiceId}</strong><p>{receipt.rationale || "Decision receipt recorded."}</p><em>{receipt.status || "staged"}{receipt.stage ? ` · ${receipt.stage}` : ""}{receipt.updatedAt ? ` · ${formatDate(receipt.updatedAt)}` : ""}</em></div>) : <p className="emptyText">No decision receipts yet.</p>}
      </div>
    </section>
  );
}

function LayerIntegrityPanel({ layerIntegrity, onDiscuss }: { layerIntegrity: InvestingLayerIntegrity; onDiscuss: (ctx: ThreadContext) => void }) {
  const issues = layerIntegrity.issues ?? [];
  const blocking = issues.filter(issue => issue.blocksActionAuthority && issue.severity !== "pass");
  return (
    <section className="investmentSection investmentLayerIntegrity">
      <div className="sectionTitleRow"><h2>Layer integrity guardrail</h2><span>{layerIntegrity.status || "unknown"} · {blocking.length} blocking</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">Map → policy → action validation</span>
          <h3>{blocking.length ? "Action cards are provisional" : "Layers are aligned enough for review"}</h3>
          <p>{layerIntegrity.antiConvolutionRecommendation || "Keep the cockpit compressed and do not add surfaces unless they replace old ones."}</p>
          <div className="taxonomyStats"><span><strong>{String(layerIntegrity.summary?.openHoldingRoleDecisions ?? "—")}</strong> open map</span><span><strong>{String(layerIntegrity.summary?.openPolicyDecisions ?? "—")}</strong> open policy</span><span><strong>{String(layerIntegrity.summary?.activeActionCards ?? "—")}</strong> action cards</span></div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Ruthless check</strong>
          <p>If map or policy is unresolved, ranked actions are review prompts — not authoritative trade guidance.</p>
          <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: "investing-layer-integrity", type: "decision", title: "Investing layer integrity", category: "investing guardrail", summary: layerIntegrity.antiConvolutionRecommendation || "Review portfolio map, decision policy, and action queue alignment." })}>Discuss guardrail</button>
        </div>
      </div>
      <div className="investmentCardGrid">
        {issues.slice(0, 6).map(issue => <article key={issue.id} className="investmentDecision"><div className="decisionTop"><span>{issue.layer}</span><strong>{issue.severity}</strong></div><h3>{issue.title}</h3><p>{issue.detail}</p><p className="emptyText">{issue.recommendation}</p></article>)}
      </div>
    </section>
  );
}

function ReceiptOutcomeLoop({ receiptOutcomes, onDiscuss }: { receiptOutcomes: InvestingReceiptOutcomes; onDiscuss: (ctx: ThreadContext) => void }) {
  const followups = receiptOutcomes.followups ?? [];
  const dueRevisits = receiptOutcomes.dueRevisits ?? [];
  const dueChecks = receiptOutcomes.dueOutcomeChecks ?? [];
  const nextScheduled = receiptOutcomes.nextScheduled ?? [];
  return (
    <section className="investmentSection investmentReceiptOutcomes">
      <div className="sectionTitleRow"><h2>Receipt outcomes + revisits</h2><span>{String(receiptOutcomes.summary?.dueOutcomeCheckCount ?? 0)} due checks · {String(receiptOutcomes.summary?.dueRevisitCount ?? 0)} revisits</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">30 / 90 / 180 day learning loop</span>
          <h3>Receipts now have scheduled outcome checks</h3>
          <p>Deferred cards can re-enter when due, while staged and archived receipts stay in the audit trail for calibration instead of cluttering the cockpit.</p>
          <div className="taxonomyStats"><span><strong>{String(receiptOutcomes.summary?.receiptCount ?? followups.length)}</strong> receipts</span><span><strong>{String(receiptOutcomes.summary?.dueRevisitCount ?? dueRevisits.length)}</strong> revisits due</span><span><strong>{String(receiptOutcomes.summary?.dueOutcomeCheckCount ?? dueChecks.length)}</strong> outcomes due</span></div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Outcome rule</strong>
          <p>Learning is receipt metadata, not another primary queue. Use it to improve rankings and kill weak decision patterns.</p>
          <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: "investing-receipt-outcome-loop", type: "decision", title: "Investing receipt outcome loop", category: "investing learning loop", summary: `Next scheduled check: ${String(receiptOutcomes.summary?.nextScheduledCheckAt || "none")}` })}>Discuss outcomes</button>
        </div>
      </div>
      {(dueRevisits.length > 0 || dueChecks.length > 0) && <div className="investmentCardGrid">
        {dueRevisits.slice(0, 3).map(item => <article key={String(item.decisionPointId)} className="investmentDecision"><div className="decisionTop"><span>revisit due</span><strong>{String(item.stage || "receipt")}</strong></div><h3>{String(item.decisionPointId)}</h3><p>{String(item.rationale || "Deferred receipt is due for review.")}</p></article>)}
        {dueChecks.slice(0, 3).map(item => <article key={`${String(item.decisionPointId)}-${String(item.window)}`} className="investmentDecision"><div className="decisionTop"><span>outcome due</span><strong>{String(item.window || "check")}</strong></div><h3>{String(item.decisionPointId)}</h3><p>Outcome check due {String(item.dueAt || "now")}.</p></article>)}
      </div>}
      <div className="taxonomyPanel">
        <div className="sectionTitleRow"><h2>Next scheduled checks</h2><span>{nextScheduled.length}</span></div>
        {nextScheduled.length ? nextScheduled.slice(0, 8).map(item => <div key={`${item.decisionPointId}-${item.window}`} className="investmentListRow"><strong>{item.decisionPointId} · {item.window}</strong><p>Scheduled for {item.dueAt ? formatDate(item.dueAt) : "later"}</p><em>{item.stage || "receipt"}</em></div>) : <p className="emptyText">No scheduled receipt checks yet.</p>}
      </div>
    </section>
  );
}

function ConvictionResetPanel({ policy, onDiscuss }: { policy: InvestingConvictionResetPolicy; onDiscuss: (ctx: ThreadContext) => void }) {
  const evidenceTypes = policy.reEarnRule?.requiredEvidenceTypes ?? [];
  const ignored = policy.reEarnRule?.ignoredForScoring ?? [];
  return (
    <section className="investmentSection convictionResetPanel">
      <div className="sectionTitleRow"><h2>Conviction reset · neutral baseline</h2><span>{policy.neutralLabel || "neutral"} · score {policy.neutralScore ?? "—"}</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">Reset at {policy.resetAt ? formatDate(policy.resetAt) : "latest"}</span>
          <h3>Theses must re-earn conviction from fresh evidence</h3>
          <p>{policy.reason || "Existing conviction levels were reset because their back data was questionable."}</p>
          <div className="taxonomyStats"><span><strong>{policy.scope?.thesisIds?.length ?? "—"}</strong> theses</span><span><strong>{policy.neutralScore ?? "—"}</strong> neutral score</span><span><strong>{policy.status || "unknown"}</strong> status</span></div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Re-earn rule</strong>
          <p>{policy.reEarnRule?.promotionPath || "Post-reset conviction updates require explicit fresh evidence."}</p>
          <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: "investing-conviction-reset", type: "decision", title: "Investing conviction reset", category: "investing conviction", summary: policy.reason || "Reset all conviction to neutral; re-earn from fresh evidence." })}>Discuss reset</button>
        </div>
      </div>
      <div className="investmentCardGrid">
        <article className="investmentDecision"><div className="decisionTop"><span>counts</span><strong>scope</strong></div><h3>Reset scope</h3><p>{policy.scope?.appliesTo?.join("; ") || "Thesis conviction and action scoring."}</p></article>
        <article className="investmentDecision"><div className="decisionTop"><span>allowed</span><strong>evidence</strong></div><h3>Can rebuild conviction</h3><p>{evidenceTypes.join("; ") || "Fresh explicit evidence after reset."}</p></article>
        <article className="investmentDecision"><div className="decisionTop"><span>ignored</span><strong>stale</strong></div><h3>No longer score-authoritative</h3><p>{ignored.join("; ") || "Pre-reset conviction scores."}</p></article>
      </div>
    </section>
  );
}

function ManualDecisionReview({ title = "Manual decision queue · policy + valuation", eyebrow = "Action authority gates", headline = "Approve ranges before signals become decisions", ruleText = "These choices decide policy ranges, alert authority, and first valuation-review batches. Trade execution still requires explicit Alex confirmation.", manualDecisionWorkflow, manualDecisions, onDiscuss, onAction }: {
  title?: string;
  eyebrow?: string;
  headline?: string;
  ruleText?: string;
  manualDecisionWorkflow?: InvestingManualDecisionWorkflow | null;
  manualDecisions?: InvestingManualDecisions | null;
  onDiscuss: (ctx: ThreadContext) => void;
  onAction?: (itemId: string, action: string, payload?: object) => void | Promise<void>;
}) {
  const decisionCards = manualDecisionWorkflow?.decisionPoints ?? [];
  const savedChoices = useMemo(() => Object.fromEntries((manualDecisions?.decisions ?? []).filter(decision => decision.status !== "deferred" || !decision.revisitAt || new Date(decision.revisitAt).getTime() > Date.now()).map(decision => [decision.decisionPointId, decision.choiceId])), [manualDecisions]);
  const [localSavedChoices, setLocalSavedChoices] = useState<Record<string, string>>({});
  const effectiveSavedChoices = { ...savedChoices, ...localSavedChoices };
  const [stagedChoices, setStagedChoices] = useState<Record<string, string>>(savedChoices);
  const [pendingChoices, setPendingChoices] = useState<Record<string, string>>({});
  const [savingChoices, setSavingChoices] = useState<Record<string, string>>({});
  const [choiceReceipts, setChoiceReceipts] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});
  const unresolvedDecisionCards = decisionCards.filter(card => !effectiveSavedChoices[card.id]);
  const completedDecisionCards = decisionCards.filter(card => effectiveSavedChoices[card.id]);
  const savingAnyChoice = Object.keys(savingChoices).length > 0;

  function promptChoice(pointId: string, choiceId: string, label: string) {
    const card = decisionCards.find(card => card.id === pointId);
    const option = card?.options.find(option => option.id === choiceId);
    const existingChoice = effectiveSavedChoices[pointId] || stagedChoices[pointId];
    setPendingChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setStagedChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setChoiceReceipts(prev => ({
      ...prev,
      [pointId]: {
        tone: "success",
        text: option?.behavior === "open-triage"
          ? `Double-check: open triage for “${label}”. This will not clear the card or execute anything.`
          : existingChoice && existingChoice !== choiceId
            ? `Double-check: change from “${existingChoice}” to “${label}”?`
            : `Double-check: confirm “${label}” before saving a receipt.`,
      },
    }));
  }

  function cancelChoice(pointId: string) {
    setPendingChoices(prev => { const next = { ...prev }; delete next[pointId]; return next; });
    setStagedChoices(prev => { const next = { ...prev }; if (effectiveSavedChoices[pointId]) next[pointId] = effectiveSavedChoices[pointId]; else delete next[pointId]; return next; });
    setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: "Selection canceled. Nothing was saved." } }));
  }

  async function confirmChoice(pointId: string, choiceId: string, label: string) {
    const previousChoice = stagedChoices[pointId];
    const card = decisionCards.find(card => card.id === pointId);
    const option = card?.options.find(option => option.id === choiceId);
    if (option?.behavior === "open-triage") {
      setPendingChoices(prev => { const next = { ...prev }; delete next[pointId]; return next; });
      setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: `Opened triage for “${label}”. No receipt saved; this card stays active until a real disposition is recorded.` } }));
      onDiscuss({ id: `${pointId}-triage`, type: "decision", title: `${label} · ${card?.title || pointId}`, category: "investing triage", summary: `${card?.triagePrompt || card?.whyThisMatters || card?.recommendation || "Review the concrete follow-up questions before saving a decision receipt."}\n\nContext: ${card?.why || ""}\n\nAffected: ${(card?.affectedAssets || []).join(", ") || "n/a"}` });
      return;
    }
    setSavingChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: `Saving “${label}”…` } }));
    try {
      await onAction?.(pointId, "stage-manual-investing-decision", {
        decisionPointId: pointId,
        choiceId,
        workflowVersion: manualDecisionWorkflow?.schemaVersion,
        durableTarget: "memory/investing/investment-manual-decisions.json",
        requestedAction: "stage-manual-investing-decision-and-refresh-dashboard",
        lifecycleStatus: choiceId === "not-now" || choiceId === "revisit-later" ? "deferred" : choiceId === "archive-evidence" ? "archived" : "staged",
        revisitAt: choiceId === "revisit-later" ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() : undefined,
        stage: card?.stage,
        decisionType: card?.decisionType,
        rationale: card ? `${card.title}: ${card.recommendation}` : undefined,
      });
      setLocalSavedChoices(prev => ({ ...prev, [pointId]: choiceId }));
      setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: `Saved “${label}”. Receipt recorded and dashboard refresh queued.` } }));
    } catch (error) {
      setStagedChoices(prev => { const next = { ...prev }; if (previousChoice) next[pointId] = previousChoice; else delete next[pointId]; return next; });
      setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "error", text: error instanceof Error ? error.message : "Could not save this decision." } }));
    } finally {
      setPendingChoices(prev => { const next = { ...prev }; delete next[pointId]; return next; });
      setSavingChoices(prev => { const next = { ...prev }; delete next[pointId]; return next; });
    }
  }

  if (!decisionCards.length && !completedDecisionCards.length) return null;

  return (
    <section className="investmentSection taxonomyReview">
      <div className="sectionTitleRow"><h2>{title}</h2><span>{unresolvedDecisionCards.length} open · {completedDecisionCards.length} complete</span></div>
      <div className="taxonomyHeroGrid">
        <div>
          <span className="digestEyebrow">{eyebrow}</span>
          <h3>{headline}</h3>
          <p>{manualDecisionWorkflow?.purpose || "Manual investment policy and valuation decisions required before authoritative add/trim recommendations."}</p>
          <div className="taxonomyStats">
            <span><strong>{unresolvedDecisionCards.length}</strong> open</span>
            <span><strong>{completedDecisionCards.length}</strong> complete</span>
            <span><strong>{typeof manualDecisionWorkflow?.summary?.portfolioEquity === "number" ? formatMoney(manualDecisionWorkflow.summary.portfolioEquity) : "—"}</strong> equity</span>
          </div>
        </div>
        <div className="taxonomyPrinciples">
          <strong>Rule for this queue</strong>
          <p>{ruleText}</p>
          <em>Same flow as taxonomy: first click stages, Confirm saves durably, Cancel backs out.</em>
        </div>
      </div>
      <div className="taxonomyPanel">
        {unresolvedDecisionCards.length === 0 ? (
          <div className="taxonomyCompleteState">
            <strong>All current manual decisions are saved</strong>
            <p>This queue will repopulate when a future review finds new policy-range or valuation-authority gaps.</p>
            <div className="taxonomyCompletedList">
              {completedDecisionCards.slice(0, 6).map(card => {
                const choiceId = effectiveSavedChoices[card.id];
                const label = card.options.find(option => option.id === choiceId)?.label || choiceId;
                return <span key={card.id}>{card.title}: <b>{label}</b></span>;
              })}
              {completedDecisionCards.length > 6 && <em>+{completedDecisionCards.length - 6} more completed</em>}
            </div>
          </div>
        ) : (
          <div className="taxonomyDecisionQueue">
            {unresolvedDecisionCards.map(card => (
              <article key={card.id} className={`taxonomyDecisionCard taxonomyDecisionCard--${card.blockingLevel || "medium"}`} aria-busy={Boolean(savingChoices[card.id])}>
                <div className="taxonomyDecisionTop"><span>{card.clusterId}</span><b>{card.blockingLevel || "medium"}</b></div>
                <strong>{card.title}</strong>
                <p className="taxonomyDecisionQuestion">{card.question}</p>
                <div className="taxonomyRecommendation"><span>Recommendation</span><p>{card.recommendation}</p></div>
                <div className="taxonomyWhy"><span>Why</span><p>{card.why}</p></div>
                {(card.affectedAllocationPct != null || (card.affectedAssets?.length ?? 0) > 0) && <div className="taxonomyImpactLine">{card.affectedAllocationPct != null && <span>{card.affectedAllocationPct.toFixed(1)}% affected</span>}{(card.affectedAssets?.length ?? 0) > 0 && <em>{card.affectedAssets?.slice(0, 9).join(", ")}</em>}</div>}
                {card.allowedActionLevel && <div className="taxonomyImpactLine"><span>Allowed action</span><em>{card.allowedActionLevel}</em></div>}
                {(card.blockers?.length ?? 0) > 0 && <div className="taxonomyImpactLine"><span>Blocked by</span><em>{card.blockers?.join(", ")}</em></div>}
                {(card.consequences?.length ?? 0) > 0 && <ul className="taxonomyConsequences">{card.consequences?.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul>}
                <div className="taxonomyChoiceGrid">
                  {card.options.map(option => {
                    const selected = stagedChoices[card.id] === option.id;
                    const recommended = card.recommendedChoice === option.id;
                    const pending = pendingChoices[card.id] === option.id;
                    const saving = savingChoices[card.id] === option.id;
                    return <button key={option.id} className={`taxonomyChoiceBtn${selected ? " taxonomyChoiceBtn--selected" : ""}${recommended ? " taxonomyChoiceBtn--recommended" : ""}${pending ? " taxonomyChoiceBtn--pending" : ""}${saving ? " taxonomyChoiceBtn--saving" : ""}`} onClick={() => promptChoice(card.id, option.id, option.label)} title={option.meaning} disabled={savingAnyChoice}><strong>{option.label}</strong><span>{saving ? "Saving…" : pending ? "Confirm below" : selected ? "Selected" : recommended ? "Recommended" : "Option"}</span></button>;
                  })}
                </div>
                {pendingChoices[card.id] && (() => {
                  const option = card.options.find(option => option.id === pendingChoices[card.id]);
                  if (!option) return null;
                  const confirmLabel = option.confirmLabel || (option.behavior === "open-triage" ? "Open triage" : "Confirm");
                  const confirmText = option.behavior === "open-triage" ? `Open triage for “${option.label}”?` : `Confirm “${option.label}”?`;
                  return <div className="taxonomyConfirm" role="group" aria-label={`Confirm ${card.title}`}><span>{confirmText}</span><button className="taxonomyConfirmBtn taxonomyConfirmBtn--primary" onClick={() => void confirmChoice(card.id, option.id, option.label)} disabled={savingAnyChoice}>{confirmLabel}</button><button className="taxonomyConfirmBtn" onClick={() => cancelChoice(card.id)} disabled={savingAnyChoice}>Cancel</button></div>;
                })()}
                {choiceReceipts[card.id] && <div className={`taxonomyReceipt taxonomyReceipt--${choiceReceipts[card.id].tone}`} role="status">{choiceReceipts[card.id].text}</div>}
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: card.id, type: "decision", title: card.question, category: "investing policy/valuation", summary: `${card.clusterId}: ${card.recommendation}` })}>Discuss decision</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
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
  const [localSavedChoices, setLocalSavedChoices] = useState<Record<string, string>>({});
  const effectiveSavedChoices = { ...savedChoices, ...localSavedChoices };
  const [stagedChoices, setStagedChoices] = useState<Record<string, string>>(savedChoices);
  const [pendingChoices, setPendingChoices] = useState<Record<string, string>>({});
  const [savingChoices, setSavingChoices] = useState<Record<string, string>>({});
  const [choiceReceipts, setChoiceReceipts] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});
  const visibleBaskets = baskets
    .filter(basket => (basket.currentPortfolio?.primaryPct ?? 0) > 0 || basket.sourceOfTruthStatus === "canonical-app-basket" || (basket.governanceQuestions?.length ?? 0) > 0)
    .sort((a, b) => (b.currentPortfolio?.primaryPct ?? 0) - (a.currentPortfolio?.primaryPct ?? 0));
  const kindRows = taxonomyKindBreakdown(baskets);
  const topBlocks = visibleBaskets.filter(basket => (basket.currentPortfolio?.primaryPct ?? 0) > 0).slice(0, 12);
  const stagedCount = Object.keys(stagedChoices).length;
  const savedCount = taxonomyDecisions?.decisions?.length ?? 0;
  const savingAnyChoice = Object.keys(savingChoices).length > 0;
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
  const unresolvedDecisionCards = decisionCards.filter(card => !effectiveSavedChoices[card.id]);
  const completedDecisionCards = decisionCards.filter(card => effectiveSavedChoices[card.id]);
  const clusterTitleById = useMemo(() => new Map(clusters.map(cluster => [cluster.id, cluster.title])), [clusters]);
  function promptChoice(pointId: string, choiceId: string, label: string) {
    const existingChoice = effectiveSavedChoices[pointId] || stagedChoices[pointId];
    setPendingChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setStagedChoices(prev => ({ ...prev, [pointId]: choiceId }));
    setChoiceReceipts(prev => ({
      ...prev,
      [pointId]: {
        tone: "success",
        text: existingChoice && existingChoice !== choiceId
          ? `Double-check: change from “${existingChoice}” to “${label}”?`
          : `Double-check: confirm “${label}” before saving.`,
      },
    }));
  }

  function cancelChoice(pointId: string) {
    setPendingChoices(prev => {
      const next = { ...prev };
      delete next[pointId];
      return next;
    });
    setStagedChoices(prev => {
      const next = { ...prev };
      if (effectiveSavedChoices[pointId]) next[pointId] = effectiveSavedChoices[pointId];
      else delete next[pointId];
      return next;
    });
    setChoiceReceipts(prev => ({ ...prev, [pointId]: { tone: "success", text: "Selection canceled. Nothing was saved." } }));
  }

  async function confirmChoice(pointId: string, choiceId: string, label: string) {
    const previousChoice = stagedChoices[pointId];
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
      setLocalSavedChoices(prev => ({ ...prev, [pointId]: choiceId }));
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
      setPendingChoices(prev => {
        const next = { ...prev };
        delete next[pointId];
        return next;
      });
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
            <span><strong>{unresolvedDecisionCards.length}</strong> open decisions</span>
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
          <div className="sectionTitleRow"><h2>Decision queue</h2><span>{unresolvedDecisionCards.length} open · {completedDecisionCards.length} complete</span></div>
          {unresolvedDecisionCards.length === 0 ? (
            <div className="taxonomyCompleteState">
              <strong>All current decisions are saved</strong>
              <p>This queue will repopulate only when a future taxonomy/audit pass generates new unresolved decision points.</p>
              <div className="taxonomyCompletedList">
                {completedDecisionCards.slice(0, 6).map(card => {
                  const choiceId = effectiveSavedChoices[card.id];
                  const label = card.options.find(option => option.id === choiceId)?.label || choiceId;
                  return <span key={card.id}>{card.title}: <b>{label}</b></span>;
                })}
                {completedDecisionCards.length > 6 && <em>+{completedDecisionCards.length - 6} more completed</em>}
              </div>
            </div>
          ) : (
          <div className="taxonomyDecisionQueue">
            {unresolvedDecisionCards.map(card => (
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
                    const pending = pendingChoices[card.id] === option.id;
                    const saving = savingChoices[card.id] === option.id;
                    return (
                      <button key={option.id} className={`taxonomyChoiceBtn${selected ? " taxonomyChoiceBtn--selected" : ""}${recommended ? " taxonomyChoiceBtn--recommended" : ""}${pending ? " taxonomyChoiceBtn--pending" : ""}${saving ? " taxonomyChoiceBtn--saving" : ""}`} onClick={() => promptChoice(card.id, option.id, option.label)} title={option.meaning} disabled={savingAnyChoice}>
                        <strong>{option.label}</strong>
                        <span>{saving ? "Saving…" : pending ? "Confirm below" : selected ? "Selected" : recommended ? "Recommended" : "Option"}</span>
                      </button>
                    );
                  })}
                </div>
                {pendingChoices[card.id] && (() => {
                  const option = card.options.find(option => option.id === pendingChoices[card.id]);
                  if (!option) return null;
                  return (
                    <div className="taxonomyConfirm" role="group" aria-label={`Confirm ${card.title}`}>
                      <span>{`Confirm “${option.label}”?`}</span>
                      <button className="taxonomyConfirmBtn taxonomyConfirmBtn--primary" onClick={() => void confirmChoice(card.id, option.id, option.label)} disabled={savingAnyChoice}>Confirm</button>
                      <button className="taxonomyConfirmBtn" onClick={() => cancelChoice(card.id)} disabled={savingAnyChoice}>Cancel</button>
                    </div>
                  );
                })()}
                {choiceReceipts[card.id] && <div className={`taxonomyReceipt taxonomyReceipt--${choiceReceipts[card.id].tone}`} role="status">{choiceReceipts[card.id].text}</div>}
                <button className="btnAlphaDiscuss" onClick={() => onDiscuss({ id: card.id, type: "decision", title: card.question, category: "investing taxonomy", summary: `${clusterTitleById.get(card.clusterId) || card.clusterId}: ${card.recommendation}` })}>Discuss decision</button>
              </article>
            ))}
          </div>
          )}
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

function targetToneClass(value?: string | null) {
  const lower = String(value || "neutral").toLowerCase();
  if (lower.includes("red") || lower.includes("overweight")) return "red";
  if (lower.includes("blue") || lower.includes("underweight")) return "blue";
  if (lower.includes("amber") || lower.includes("needs")) return "amber";
  if (lower.includes("green") || lower.includes("in-range")) return "green";
  return "neutral";
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

function formatTime(iso?: string | null) {
  if (!iso) return "noon";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "noon";
  return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
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

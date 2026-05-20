export type Priority   = "HIGH" | "MEDIUM" | "LOW";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type Action = {
  id:          string;
  priority:    Priority;
  title:       string;
  context:     string;
  next:        string;
  project:     string;
  due:         string;
  done:        boolean;
  snoozed:     boolean;
  snoozeLabel: string | null;
};

export type Loop = {
  id:          string;
  text:        string;
  project:     string;
  priority:    Priority;
  done?:       boolean;
  snoozed?:    boolean;
  snoozeLabel?: string | null;
};

export type Project = {
  id:           string;
  name:         string;
  status:       "ACTIVE" | "SNOOZED";
  category:     string;
  lastActivity: string;
  summary:      string;
  ocOwned:      boolean;
  loops?:       Loop[];
  highPriCount?: number;
};

export type Ticker = {
  ticker:     string;
  theme:      string;
  stance:     string;
  confidence: Confidence;
};


export type InvestmentDecisionDigest = {
  schema_version: string;
  as_of: string;
  horizon: "5-10y" | string;
  source_url: string;
  latest_check_in?: { id: string | null; title: string | null; date: string | null; created_at: string | null; degraded: boolean; degradation_summary: string[] };
  posture?: { headline: string; summary: string | null; key_risk: string | null };
  top_decisions?: Array<{ id: string; action: string; title: string; asset_symbols: string[]; basket: string | null; rationale: string; confidence: string; source_url?: string | null }>;
  thesis_changes?: Array<{ basket: string; trend: string; conviction: number | null; freshness: string | null; why_it_matters: string }>;
  contradictions?: Array<{ basket: string; risk: string; severity: string; evidence: string[]; why_it_matters: string }>;
  research_queue?: Array<{ id: string; question: string; basket: string | null; asset_symbols: string[]; priority: string; reason: string }>;
  portfolio_drift?: Array<{ id: string; title: string; status: string; rationale: string; asset_symbols: string[] }>;
  ignored_noise?: Array<{ id: string; title: string; reason: string }>;
  cost_summary?: { business_date: string; total_cost_usd: number | null; total_tokens: number; total_requests: number } | null;
  source_health?: { latest_check_in_age_hours: number | null; degraded_layers: string[]; latest_sweep_at: string | null; ai_spend_available: boolean; notes: string[] };
};

export type InvestmentDecisionDigestChanges = {
  generated_at: string;
  previous_as_of: string | null;
  current_as_of: string | null;
  posture_changed: boolean;
  totals: { added: number; removed: number; changed: number };
  top_decisions?: { added: NonNullable<InvestmentDecisionDigest["top_decisions"]>; removed: NonNullable<InvestmentDecisionDigest["top_decisions"]> };
  contradictions?: { added: NonNullable<InvestmentDecisionDigest["contradictions"]>; removed: NonNullable<InvestmentDecisionDigest["contradictions"]> };
  research_queue?: { added: NonNullable<InvestmentDecisionDigest["research_queue"]>; removed: NonNullable<InvestmentDecisionDigest["research_queue"]> };
};

export type InvestmentRuntimePreflight = {
  generatedAt: string;
  summary?: { status: string; blockers: string[] };
  endpoint?: { status: number | null; authorized: boolean; body_sample?: string };
  local_env?: { auth?: Record<string, boolean>; vercel_token_present?: boolean };
  vercel?: { linked_project?: { projectName?: string; projectId?: string } | null; required_env_observed?: Record<string, boolean>; note?: string | null };
};

export type InvestmentJournal = { generatedAt: string; entries: Array<{ id: string; createdAt: string; title: string; decision?: string | null; rationale?: string; next?: string; status?: string; symbols?: string[]; basket?: string | null }> };
export type InvestmentResearchActions = { generatedAt: string; items: Array<{ id: string; createdAt: string; title: string; type?: string; rationale?: string; next?: string; status?: string; symbols?: string[]; basket?: string | null }> };
export type InvestmentCrawlPlan = { generatedAt: string; policy?: { default?: string; expensive_crawl_cap?: number }; recommended_expensive_crawls?: Array<{ id: string; title: string; reason: string; action: string; symbols?: string[]; basket?: string | null }>; deterministic_only?: Array<{ id: string; title: string; reason: string; action: string; symbols?: string[]; basket?: string | null }>; ignored_noise?: Array<{ id: string; title: string; reason: string }> };


export type QueueItem = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  creator?: string | null;
  source?: string | null;
  link?: string | null;
  why?: string | null;
  added?: string | null;
  notes?: string | null;
  themes?: string[];
};

export type QueueGroup = {
  id: string;
  label: string;
  kind: string;
  path: string;
  updatedAt?: string | null;
  summary: string;
  items: QueueItem[];
  needsClarification: QueueItem[];
};

export type Digest = {
  id:       string;
  date:     string;
  category: string;
  title:    string;
  summary:  string;
  tags:     string[];
};

export type SourceHealth = {
  id:      string;
  label:   string;
  status:  string;
  age:     string;
  summary: string;
  detail:  string;
  path:    string;
  details?: Array<{ label: string; value: string; href?: string | null }>;
};


export type SystemDoc = {
  id: string;
  title: string;
  path: string;
  layer: "core" | "context" | "plan" | "private" | string;
  sensitivity: "public" | "internal" | "private";
  summary: string;
  excerpt: string;
  content?: string | null;
  mtime?: string | null;
  words: number;
  tags: string[];
};

export type DeploymentMeta = {
  commit: string;
  branch: string;
  generatedAt: string;
  deployUrl?: string | null;
  productionUrl: string;
  dirtyFiles?: number;
};

export type ActivityItem = {
  id: string;
  at: string;
  kind: string;
  title: string;
  status: "applied" | "pending" | "failed" | string;
  summary: string;
  source?: string;
};

export type EventCandidate = {
  id:            string;
  kind:          "family" | "music";
  title:         string;
  source?:       string | null;
  sourceId?:     string | null;
  date?:         string | null;
  venue?:        string | null;
  distanceMiles?: number | null;
  link?:         string | null;
  summary?:      string;
  score?:        number;
};

export type ReviewItem = {
  id: string;
  kind: "obsidian-proposal" | "source-health" | "investing-review" | "automation-review" | "event-feedback" | string;
  title: string;
  summary: string;
  priority: Priority;
  status: "pending" | "approved" | "dismissed" | string;
  source?: string;
  target?: string;
  generatedAt?: string | null;
  actionHint?: string;
  payload?: unknown;
};

export type AutomationJob = {
  id: string;
  name: string;
  description?: string;
  category: string;
  enabled: boolean;
  scheduleLabel: string;
  schedule?: { kind?: string; expr?: string; tz?: string; everyMs?: number; at?: string } | null;
  sessionTarget?: string | null;
  lightContext?: boolean;
  toolsAllow?: string[];
  delivery?: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  lastDuration?: string | null;
  consecutiveErrors?: number;
  consecutiveSkipped?: number;
  deleteAfterRun?: boolean;
  summary?: string;
  updatedAt?: string | null;
};


export type InvestingThesis = {
  id: string;
  title: string;
  stage: string;
  basket?: string | null;
  symbols?: string[];
  coreClaim?: string;
  whyItMightCompound?: string;
  whatMustBeTrue?: string[];
  invalidators?: string[];
  currentConviction?: string;
  convictionWhy?: string;
  currentAction?: string;
  reviewCadence?: string;
  updatedAt?: string;
};
export type InvestingThesisRegistry = { generatedAt: string; schemaVersion?: string; theses: InvestingThesis[] };
export type InvestingConvictionLedger = { generatedAt: string; entries: Array<{ id: string; createdAt: string; thesisId: string; direction: string; convictionAfter: string; why: string; sources?: string[]; openQuestionsCreated?: string[]; actionImplication?: string }> };
export type InvestingAccumulationPlan = { generatedAt: string; plans: Array<{ id: string; thesisId: string; title: string; currentExposure?: string; desiredExposure?: string; maxExposure?: string; entryConditions?: string[]; pauseConditions?: string[]; nextReview?: string; status?: string }> };
export type InvestingTrustedSources = { generatedAt: string; sources: Array<{ id: string; name: string; type?: string; domains?: string[]; usefulness?: string; biasStyle?: string; timeHorizon?: string; bestFor?: string[]; relevantTheses?: string[] }> };


export type InvestingPriceAlerts = { generatedAt: string; watchRules: Array<{ id: string; thesisId: string; symbols: string[]; status?: string; triggerDescription?: string; neededInputs?: string[] }>; recentAlerts?: Array<{ id: string; symbol: string; thesisId: string; message: string; trigger: string; action: string }> };
export type InvestingAccumulationOpportunities = { generatedAt: string; quotes: Array<{ symbol: string; close?: number | null; pullbackPct?: number | null; oneMonthPct?: number | null; error?: string }>; opportunities: Array<{ id: string; symbol: string; thesisId: string; thesisTitle: string; close: number | null; pullbackPct: number | null; trigger: string; action: string; message: string }> };
export type InvestingProposedTheses = { generatedAt: string; thresholds?: { minimumEvidenceScore?: number; minimumDifferentiationScore?: number; minimumTrustedSourceCount?: number; maxProposals?: number }; proposals: Array<{ id: string; title: string; status: string; symbols: string[]; bestTickerExpressions?: Array<{ symbol: string; role: string; note: string }>; thesisDraft: string; evidenceScore: number; differentiationScore: number; trustedSourceCount: number; recommendation: string; openQuestions?: string[]; supportingSources?: string[] }> };
export type InvestingProposedThesisConfig = { generatedAt: string; thresholds?: { minimumEvidenceScore?: number; minimumDifferentiationScore?: number; minimumTrustedSourceCount?: number; maxProposals?: number } };


export type InvestingWeeklyTrades = { generated_at?: string; generatedAt?: string; start_date?: string; end_date?: string; summary?: { trade_count?: number; buy_count?: number; sell_count?: number; symbols?: string[] }; trades?: Array<{ id: string; symbol?: string | null; action: string; description?: string | null; trade_date?: string | null; quantity?: number | null; price?: number | null; amount?: number | null }> };
export type InvestingTradeReview = { generatedAt: string; startDate: string; endDate: string; summary: { tradeCount: number; byAlignment: Record<string, number>; needsDiscussion: number }; trades: Array<{ id: string; symbol?: string | null; action: string; description?: string | null; trade_date?: string | null; quantity?: number | null; price?: number | null; amount?: number | null; thesisId?: string | null; thesisTitle?: string | null; valuationState?: string; alignment: string; prompt?: string | null }>; prompts: Array<{ id: string; symbol?: string | null; alignment: string; prompt: string }> };
export type InvestingTradeJournal = { generatedAt: string; entries: Array<{ id: string; createdAt: string; startDate: string; endDate: string; status: string; summary: { tradeCount: number; needsDiscussion: number; byAlignment: Record<string, number> }; prompts?: Array<{ id: string; symbol?: string | null; alignment: string; prompt: string }> }> };
export type InvestingFeedbackCalibration = { generatedAt: string; metrics: Record<string, number | Record<string, number>>; calibrationPrompts: string[] };
export type InvestingInputHealth = { generatedAt: string; status: string; summary: Record<string, number>; health?: { blockers?: string[]; warnings?: string[] }; investorPosts?: { bySource30d?: Array<{ source: string; platform?: string; posts: number; latest?: string; avg_thesis?: number; avg_macro?: number }>; recentHighSignal?: Array<{ investor_name?: string; source_label?: string; title?: string; url?: string; event_time?: string; ai_summary?: string; themes_detected?: string[] }> }; news?: { bySource30d?: Array<{ source: string; items: number; latest?: string; avg_relevance?: number }> }; fetchRuns?: { byStatus14d?: Array<{ status: string; runs: number; items_seen?: number; items_inserted?: number; latest?: string }> }; recommendations?: string[] };
export type InvestingPortfolioContextMap = { generatedAt: string; portfolio: { holding_count?: number; account_count?: number; cash_balance?: number | null; total_equity?: number | null; warnings?: string[] }; exposureMap: { byTheme?: Array<{ id: string; title: string; equity: number; portfolioPct: number; holdings: Array<{ symbol: string; equity?: number | null; portfolio_pct?: number | null; name?: string | null }> }>; unmappedHoldings?: Array<{ symbol: string; name?: string | null; equity?: number | null; portfolio_pct?: number | null; prompt?: string | null }>; topHoldings?: Array<{ symbol: string; name?: string | null; equity?: number | null; portfolio_pct?: number | null; thesisTitle?: string | null; mappedTheme?: string | null }> }; obsidianSignals?: { noteCount?: number; themeEvidence?: Array<{ theme: string; noteCount: number; symbols?: Record<string, number>; examples?: Array<{ path: string; title?: string; snippet?: string }> }> }; prompts?: Array<{ type: string; symbol?: string; theme?: string; prompt: string; equity?: number | null; portfolio_pct?: number | null; examples?: string[] }> };

export type InvestingTaxonomyDecisionSheet = {
  generatedAt?: string;
  schemaVersion?: string;
  purpose?: string;
  canonicalKinds?: Array<{ kind: string; description: string }>;
  primaryRule?: string;
  clusters?: Array<{
    id: string;
    title: string;
    recommendations?: Array<{ item: string; decision: string; rationale: string }>;
    questions?: string[];
  }>;
  approvalPrompt?: string;
};

export type InvestingTaxonomyDecisionWorkflow = {
  generatedAt?: string;
  schemaVersion?: string;
  purpose?: string;
  decisionPrinciples?: string[];
  decisionPoints?: Array<{
    id: string;
    clusterId: string;
    title: string;
    question: string;
    recommendation: string;
    why: string;
    recommendedChoice: string;
    options: Array<{ id: string; label: string; meaning: string }>;
    affectedItems?: string[];
    affectedAssets?: string[];
    affectedAllocationPct?: number | null;
    consequences?: string[];
    blockingLevel?: "foundational" | "high" | "medium" | "low" | string;
  }>;
};

export type InvestingTaxonomyDecisions = {
  generatedAt?: string;
  schemaVersion?: string;
  status?: string;
  decisions?: Array<{
    decisionPointId: string;
    choiceId: string;
    rationale?: string;
    status?: string;
    updatedAt?: string;
    source?: string;
  }>;
  history?: Array<Record<string, unknown>>;
};

export type InvestingManualDecisionWorkflow = InvestingTaxonomyDecisionWorkflow & {
  sourceArtifacts?: Record<string, string>;
  summary?: Record<string, number | string | null | undefined>;
};
export type InvestingManualDecisions = InvestingTaxonomyDecisions;
export type InvestingExecutionBoundaryPolicy = { generatedAt?: string; status?: string; title?: string; purpose?: string; allowedWithoutAdditionalApproval?: string[]; requiresExplicitAlexConfirmation?: string[]; recommendationLevels?: Array<{ id: string; meaning: string }>; dashboardReceiptRule?: string; defaultTradePosture?: string };
export type InvestingRankedActionQueue = { generatedAt?: string; purpose?: string; summary?: Record<string, number | string | null>; sourceHealth?: { status?: string; actionableFailedRuns14?: number | null; penalty?: number }; actions?: Array<{ rank: number; id: string; title: string; rankScore: number; recommendation: string; allowedActionLevel: string; explicitTradeConfirmationRequired?: boolean; rationale: string; tickers?: string[]; blockers?: string[]; scoreComponents?: Record<string, unknown> }> };
export type InvestingSourceReliabilityPlan = { generatedAt?: string; status?: string; summary?: Record<string, number>; actionableFailures?: Array<{ id: string; platform: string; runs: number; error: string; recommendedAction: string; priority: string }>; recommendations?: string[] };

export type InvestingBasketGovernanceAudit = {
  generatedAt?: string;
  schemaVersion?: string;
  purpose?: string;
  summary?: {
    basketRows?: number;
    canonicalAppRows?: number;
    nonCanonicalRows?: number;
    missingCanonicalTargets?: string[];
    multiSourceConvictionRows?: string[];
    notAuthoritativeForRebalance?: string[];
  };
  consolidationClusters?: Array<{ id: string; title: string; members: string[]; question: string }>;
  baskets?: Array<{
    id: string;
    title: string;
    sourceOfTruthStatus: string;
    appStatus?: string | null;
    currentAction?: string | null;
    currentPortfolio?: { primaryPct?: number; secondaryPct?: number; totalReferencedPct?: number } | null;
    definition?: {
      appThesis?: string | null;
      registryClaim?: string | null;
      synthesisBoundary?: string | null;
      role?: string | null;
      canonicalBoundary?: { owns?: string | null; does_not_own?: string | null; classification_rule?: string | null } | null;
    };
    conviction?: { displayedScore?: number | null; auditStatus?: string; sources?: Array<{ source: string; value: string; field?: string | null }> };
    targetWeights?: { displayedTarget?: number | null; displayedMin?: number | null; displayedMax?: number | null; auditStatus?: string; sources?: Array<{ source: string; value: string; field?: string | null }> };
    assets?: {
      appTickersAndAlternates?: Array<{ symbol?: string; name?: string | null; role?: string | null }>;
      portfolioTopHoldings?: Array<{ symbol?: string; name?: string | null; portfolioPct?: number | null; bucketId?: string; role?: string }>;
      watchlistSymbols?: Array<{ symbol?: string; theme?: string; stance?: string; confidence?: string }>;
    };
    overlaps?: Array<Record<string, unknown>>;
    governanceQuestions?: string[];
    recommendationAuthority?: string;
  }>;
  nextDecisionSequence?: string[];
};

export type InvestingThesisUniverse = {
  generatedAt?: string;
  schemaVersion?: string;
  diagnostics?: {
    thesisCount?: number;
    appCanonicalCount?: number;
    strictMappedPct?: number;
    primaryThesisReferencePct?: number;
    unmappedPct?: number;
    activeHighConvictionUnderallocated?: Array<{ id: string; title: string; pct: number; target?: number | null; conviction?: number | null }>;
    lowerConvictionOverallocated?: Array<{ id: string; title: string; pct: number; conviction?: number | null }>;
    pausedWithExposure?: Array<{ id: string; title: string; primaryPct: number; secondaryPct: number }>;
    needsCanonicalization?: Array<{ id: string; title: string; pct: number }>;
  };
  theses?: Array<{ id: string; title: string; state?: string; classification?: string; source?: string; convictionScore?: number | null; targetWeight?: number | null; portfolio?: { primaryPct?: number; secondaryPct?: number; totalReferencedPct?: number; topHoldings?: Array<{ symbol?: string; portfolioPct?: number }> }; flags?: string[]; recommendation?: string | null }>;
};

export type DashboardData = {
  meta: {
    generatedAt:   string;
    posture:       string;
    postureDetail: string;
    contextHealth?: unknown;
    sourceHealth?: SourceHealth[];
    eventCandidates?: EventCandidate[];
    deployment?: DeploymentMeta;
    activity?: ActivityItem[];
    investmentDecisionDigest?: InvestmentDecisionDigest | null;
    investmentDecisionDigestChanges?: InvestmentDecisionDigestChanges | null;
    investmentRuntimePreflight?: InvestmentRuntimePreflight | null;
    investmentDecisionJournal?: InvestmentJournal | null;
    investmentResearchActions?: InvestmentResearchActions | null;
    investmentCrawlPlan?: InvestmentCrawlPlan | null;
    investingThesisRegistry?: InvestingThesisRegistry | null;
    investingConvictionLedger?: InvestingConvictionLedger | null;
    investingAccumulationPlan?: InvestingAccumulationPlan | null;
    investingTrustedSources?: InvestingTrustedSources | null;
    investingPriceAlerts?: InvestingPriceAlerts | null;
    investingAccumulationOpportunities?: InvestingAccumulationOpportunities | null;
    investingProposedTheses?: InvestingProposedTheses | null;
    investingProposedThesisConfig?: InvestingProposedThesisConfig | null;
    investingWeeklyTrades?: InvestingWeeklyTrades | null;
    investingTradeReview?: InvestingTradeReview | null;
    investingTradeJournal?: InvestingTradeJournal | null;
    investingFeedbackCalibration?: InvestingFeedbackCalibration | null;
    investingInputHealth?: InvestingInputHealth | null;
    investingPortfolioContextMap?: InvestingPortfolioContextMap | null;
    investingTaxonomyDecisionSheet?: InvestingTaxonomyDecisionSheet | null;
    investingTaxonomyDecisionWorkflow?: InvestingTaxonomyDecisionWorkflow | null;
    investingTaxonomyDecisions?: InvestingTaxonomyDecisions | null;
    investingManualDecisionWorkflow?: InvestingManualDecisionWorkflow | null;
    investingHoldingRoleDecisionWorkflow?: InvestingManualDecisionWorkflow | null;
    investingDecisionPipeline?: InvestingManualDecisionWorkflow | null;
    investingManualDecisions?: InvestingManualDecisions | null;
    investingExecutionBoundaryPolicy?: InvestingExecutionBoundaryPolicy | null;
    investingRankedActionQueue?: InvestingRankedActionQueue | null;
    investingSourceReliabilityPlan?: InvestingSourceReliabilityPlan | null;
    investingBasketGovernanceAudit?: InvestingBasketGovernanceAudit | null;
    investingThesisUniverse?: InvestingThesisUniverse | null;
    systemDocs?: SystemDoc[];
    queues?: QueueGroup[];
  };
  stats: {
    openLoops:             number;
    activeProjects:        number;
    highPriority:          number;
    uncertainties:         number;
    investingSignals:      number;
    contextActiveFiles?:   number | null;
    contextActiveWords?:   number | null;
    contextArchiveWords?:  number | null;
  };
  topActions: Action[];
  openLoops:  Loop[];
  projects:   Project[];
  investing:   Ticker[];
  automations?: AutomationJob[];
  reviewQueue?: ReviewItem[];
  digests:     Digest[];
};

import generated from "./generated-data.json";
export const dashboardData = generated as unknown as DashboardData;

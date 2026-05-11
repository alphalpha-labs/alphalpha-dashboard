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
export const dashboardData = generated as DashboardData;

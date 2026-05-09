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
  digests:     Digest[];
};

import generated from "./generated-data.json";
export const dashboardData = generated as DashboardData;

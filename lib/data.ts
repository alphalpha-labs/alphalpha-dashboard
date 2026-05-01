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

export type DashboardData = {
  meta: {
    generatedAt:   string;
    posture:       string;
    postureDetail: string;
  };
  stats: {
    openLoops:        number;
    activeProjects:   number;
    highPriority:     number;
    uncertainties:    number;
    investingSignals: number;
  };
  topActions: Action[];
  openLoops:  Loop[];
  projects:   Project[];
  investing:  Ticker[];
  digests:    Digest[];
};

import generated from "./generated-data.json";
export const dashboardData = generated as DashboardData;

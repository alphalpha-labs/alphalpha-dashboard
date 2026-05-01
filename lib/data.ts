import generated from "./generated-data.json";

export type Priority = "urgent" | "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";
export type ProjectStatus = "active" | "blocked" | "waiting" | "shaping";

export type Metric = {
  label: string;
  value: string;
  detail: string;
  tone: string;
};

export type AttentionItem = {
  title: string;
  reason: string;
  priority: Priority;
  age: string;
  confidence: Confidence;
  action: string;
};

export type Project = {
  name: string;
  domain: string;
  status: ProjectStatus;
  lastActivity: string;
  nextAction: string;
  blocker: string | null;
  source: string;
};

export type OpenLoop = {
  item: string;
  owner: string;
  due: string;
  priority: Priority;
  next: string;
};

export type InvestingCandidate = {
  ticker: string;
  theme: string;
  stance: string;
  confidence: Confidence;
  trigger: string;
  contradiction: string;
};

export type Digest = {
  title: string;
  source: string;
  date: string;
  summary: string;
  tags: string[];
};

type DashboardData = {
  generatedAt: string;
  metrics: Metric[];
  attentionQueue: AttentionItem[];
  projects: Project[];
  openLoops: OpenLoop[];
  investingCandidates: InvestingCandidate[];
  digests: Digest[];
};

const dashboardData = generated as DashboardData;

export const generatedAt = dashboardData.generatedAt;
export const metrics = dashboardData.metrics;
export const attentionQueue = dashboardData.attentionQueue;
export const projects = dashboardData.projects;
export const openLoops = dashboardData.openLoops;
export const investingCandidates = dashboardData.investingCandidates;
export const digests = dashboardData.digests;

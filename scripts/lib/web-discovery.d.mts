// Type declarations for the JS web-discovery module.

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date: string | null;
}

export interface GenreWeightsLike {
  chipTallies?: Record<string, number>;
  sourceAffinity?: Record<string, number>;
  notes?: string[];
  moreScore?: number;
  lessScore?: number;
  keepScore?: number;
}

export interface FeedbackHintsResult {
  prefer: string[];
  avoid: string[];
  notes: string[];
  enthusiasm: number;
}

export interface Budget {
  readonly searches: number;
  readonly fetches: number;
  takeSearch(): boolean;
  takeFetch(): boolean;
}

export interface WebDiscovery {
  provider: string;
  available: boolean;
  budget: Budget;
  search(query: string, opts?: { count?: number }): Promise<SearchResult[]>;
  searchMany(queries: string[], opts?: { perQuery?: number }): Promise<SearchResult[]>;
  fetchText(url: string, opts?: { maxChars?: number }): Promise<string>;
  curate(args: {
    task: string;
    candidates: SearchResult[];
    hints?: FeedbackHintsResult;
    context?: string;
    responseShape: string;
  }): Promise<Record<string, unknown> | null>;
}

export function callOpenClaw(
  systemPrompt: string,
  userPrompt: string,
  opts?: { tools?: unknown[]; model?: string; timeoutMs?: number },
): Promise<string | null>;
export function parseJsonLoose(raw: string | null): unknown;
export function makeBudget(opts?: { maxSearches?: number; maxFetches?: number }): Budget;
export function hostOf(url: string): string;
export function htmlToText(html: string, maxChars?: number): string;
export function extractYouTubeId(url: string): string | null;
export function feedbackHints(weights?: GenreWeightsLike): FeedbackHintsResult;
export function createWebDiscovery(opts?: {
  budget?: Budget;
  log?: (msg: string) => void;
  warn?: (msg: string) => void;
}): WebDiscovery;

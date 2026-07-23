// Server-safe. Zod schema for DailyData and each tile sub-shape.
// This is the single validation gate — every generated edition passes through here.
import { z } from "zod";

// ── Leaf schemas ─────────────────────────────────────────────────────────────

export const QuoteSchema = z.object({
  text:   z.string().min(1),
  source: z.string().min(1),
});

export const SurpriseSchema = z.object({
  form:        z.string().min(1),
  title:       z.string().min(1),
  body:        z.string().min(1),
  note:        z.string(),
  sourceUrl:   z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

export const ChartSeriesPointSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
});

export const DailyChartSchema = z.object({
  topic:       z.string().min(1),
  title:       z.string().min(1),
  unit:        z.string(),
  note:        z.string(),
  why:         z.string(),
  series:      z.array(ChartSeriesPointSchema).min(1),
  sourceUrl:   z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

// ── Workshop tiles: guitar riff + production clip of the day ──────────────────

export const DailyRiffSchema = z.object({
  title:      z.string().min(1),
  artist:     z.string(),
  genre:      z.string(),
  difficulty: z.string(),
  videoId:    z.string().min(1),
  start:      z.number().nonnegative().optional(),
  why:        z.string(),
  note:       z.string().optional(),
  sourceUrl:  z.string().url().optional(),
});

export const DailyProductionClipSchema = z.object({
  title:      z.string().min(1),
  creator:    z.string(),
  daw:        z.string(),
  technique:  z.string(),
  videoId:    z.string().min(1),
  start:      z.number().nonnegative().optional(),
  why:        z.string(),
  note:       z.string().optional(),
  sourceUrl:  z.string().url().optional(),
});

export const DailyPoemSchema = z.object({
  title:       z.string().min(1),
  poet:        z.string().min(1),
  era:         z.string().optional(),
  excerpt:     z.string().min(1),
  note:        z.string().min(1),
  why:         z.string().min(1),
  sourceUrl:   z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

export const DailyLongReadSchema = z.object({
  title:       z.string().min(1),
  source:      z.string().min(1),
  readTime:    z.string().min(1),
  frame:       z.string().min(1),
  thesis:      z.string().min(1),
  why:         z.string().min(1),
  publishedAt: z.string().optional(),
  freshnessLabel: z.string().optional(),
  sourceContext: z.string().optional(),
  url:         z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

export const DailyAustinExploreSchema = z.object({
  title:       z.string().min(1),
  category:    z.string().min(1),
  area:        z.string().min(1),
  duration:    z.string().min(1),
  bestTime:    z.string().min(1),
  vibe:        z.string().min(1),
  prompt:      z.string().min(1),
  why:         z.string().min(1),
  seasonalFit: z.string().optional(),
  latitude:    z.number().optional(),
  longitude:   z.number().optional(),
  mapUrl:      z.string().url().optional(),
  imageUrl:    z.string().url().optional(),
  imageAlt:    z.string().optional(),
  imageCredit: z.string().optional(),
  imageSourceUrl: z.string().url().optional(),
  url:         z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

export const DailyVentureResearchSchema = z.object({
  tam:         z.string(),
  tamLabel:    z.string(),
  growth:      z.string(),
  growthLabel: z.string(),
  model:       z.string(),
  whyNow:      z.string(),
  wedge:       z.string(),
  competitors: z.array(z.object({ name: z.string(), note: z.string() })),
  signals:     z.array(z.string()),
});

export const DailyVentureSchema = z.object({
  name:     z.string(),
  effort:   z.string(),
  title:    z.string(),
  pitch:    z.string(),
  why:      z.string(),
  research: DailyVentureResearchSchema,
});

export const DailyImageSchema = z.object({
  kicker:  z.string(),
  title:   z.string(),
  caption: z.string(),
  credit:  z.string(),
  curator: z.string(),
  url:     z.string().url().optional(),
  srcLink: z.string().url().optional(),
  tags:    z.array(z.string()).optional(),
});

export const DailyArticleSchema = z.object({
  kicker:   z.string(),
  source:   z.string(),
  readTime: z.string(),
  title:    z.string().min(1),
  dek:      z.string().min(1),
  why:      z.string().min(1),
  publishedAt: z.string().optional(),
  freshnessLabel: z.string().optional(),
  sourceContext: z.string().optional(),
  url:      z.string().url().optional(),
  sourceLabel: z.string().optional(),
});

export const DailyReadingRecommendationSchema = DailyArticleSchema.extend({
  id:          z.string().min(1),
  role:        z.enum(["anchor", "lens", "frontier"]),
  exploration: z.boolean(),
  readMinutes: z.number().int().positive(),
  whyNow:      z.string().min(1),
  topics:      z.array(z.string()).default([]),
  novelty:     z.object({
    score:        z.number(),
    reason:       z.string(),
    closestTitle: z.string().optional(),
  }).optional(),
});

export const DailyReadingPortfolioSchema = z.object({
  status:         z.enum(["healthy", "degraded"]),
  totalMinutes:   z.number().nonnegative(),
  minimumMinutes: z.number().nonnegative(),
  maximumMinutes: z.number().positive(),
  candidateCount: z.number().int().nonnegative(),
  uniqueSources:  z.number().int().nonnegative(),
  reason:         z.string(),
});

export const DailyInvestmentLensSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["thesis-update", "new-idea", "invalidation-check", "valuation-watch"]),
  kicker: z.string().min(1),
  title: z.string().min(1),
  observation: z.string().min(1),
  interpretation: z.string().min(1),
  openQuestion: z.string().min(1),
  nextResearchAction: z.string().min(1),
  posture: z.string().min(1),
  asOf: z.string().min(1),
  freshness: z.string().min(1),
  relatedSymbols: z.array(z.string()),
  relatedTheses: z.array(z.string()),
  provenance: z.array(z.object({
    label: z.string().min(1),
    url: z.string().url().optional(),
    observedAt: z.string().min(1),
  })),
});

// ── Root schema ──────────────────────────────────────────────────────────────

export const DailyDataSchema = z.object({
  edition:         z.string().min(1),
  image:           DailyImageSchema,
  article:         DailyArticleSchema,
  reading:         z.array(DailyReadingRecommendationSchema).max(3).optional(),
  readingPortfolio: DailyReadingPortfolioSchema.optional(),
  investmentLens: DailyInvestmentLensSchema.optional(),
  ventures:        z.array(DailyVentureSchema),
  charts:          z.array(DailyChartSchema),
  quotes:          z.array(QuoteSchema).min(1),
  parentingQuotes: z.array(QuoteSchema).min(1),
  surprises:       z.array(SurpriseSchema),
  riffs:           z.array(DailyRiffSchema).optional(),
  productionClips: z.array(DailyProductionClipSchema).optional(),
  poems:           z.array(DailyPoemSchema).optional(),
  macroRead:       DailyLongReadSchema.optional(),
  longReads:       z.array(DailyLongReadSchema).optional(),
  austinExplores:  z.array(DailyAustinExploreSchema).optional(),
});

export type ValidatedDailyData = z.infer<typeof DailyDataSchema>;

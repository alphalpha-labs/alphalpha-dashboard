import { describe, expect, it } from "vitest";
// @ts-expect-error mjs helper module is used by the generator script.
import {
  assessCandidateNovelty,
  buildExposureEvent,
  canonicalizeUrl,
  compactExposureLedger,
  evaluateNoveltyPool,
  titleFingerprint,
  tokenSimilarity,
} from "../scripts/lib/almanac-novelty.mjs";

describe("Almanac novelty controls", () => {
  it("canonicalizes URLs without tracking noise", () => {
    expect(canonicalizeUrl("https://www.Example.com/story/?utm_source=x&b=2&a=1#top"))
      .toBe("https://example.com/story?a=1&b=2");
    expect(canonicalizeUrl("https://example.com/story?ref=newsletter"))
      .toBe("https://example.com/story");
  });

  it("creates stable title fingerprints", () => {
    expect(titleFingerprint("The Politics of Attention: A New Argument"))
      .toBe("politics-attention-new-argument");
    expect(titleFingerprint("Politics of Attention — A New Argument"))
      .toBe("politics-attention-new-argument");
  });

  it("detects exact URL exposure across tracking variants", () => {
    const assessment = assessCandidateNovelty({
      title: "A different headline",
      link: "https://example.com/story?utm_campaign=daily",
    }, [{
      title: "Original headline",
      canonicalUrl: "https://www.example.com/story",
      editionDate: "2026-07-20",
    }], { targetDate: "2026-07-23" });

    expect(assessment.eligible).toBe(false);
    expect(assessment.reason).toBe("exact-url-exposure");
  });

  it("detects cross-source near-duplicate titles", () => {
    expect(tokenSimilarity(
      "The Surprising Reason American Cities Cannot Build Enough Housing",
      "Why America's Cities Can't Build Enough Housing",
    )).toBeGreaterThan(0.7);

    const assessment = assessCandidateNovelty({
      title: "The Surprising Reason American Cities Cannot Build Enough Housing",
      link: "https://second.example/new-version",
    }, [{
      title: "Why America's Cities Can't Build Enough Housing",
      canonicalUrl: "https://first.example/original",
      editionDate: "2026-07-10",
    }], { targetDate: "2026-07-23", similarityThreshold: 0.7 });

    expect(assessment.eligible).toBe(false);
    expect(assessment.reason).toBe("near-duplicate-title");
  });

  it("penalizes source saturation without hard rejecting a distinct item", () => {
    const exposures = [1, 2, 3].map(day => ({
      title: `Distinct essay number ${day}`,
      source: "Frequent Review",
      editionDate: `2026-07-${20 + day}`,
    }));
    const assessment = assessCandidateNovelty({
      title: "A genuinely different subject",
      source: "Frequent Review",
    }, exposures, { targetDate: "2026-07-23" });

    expect(assessment.eligible).toBe(true);
    expect(assessment.reason).toBe("repeated-source-penalty");
    expect(assessment.penalty).toBeGreaterThan(0);
  });

  it("builds and bounds compact exposure history", () => {
    const event = buildExposureEvent({
      id: "read-1",
      title: "The Shape of Civic Life",
      url: "https://example.com/civic?utm_source=x",
      source: "Example",
      themes: ["civic life"],
    }, "2026-07-23");

    expect(event.event).toBe("shown");
    expect(event.canonicalUrl).toBe("https://example.com/civic");
    expect(event.titleFingerprint).toBe("shape-civic-life");

    const compact = compactExposureLedger([
      { ...event, id: "old", at: "2025-01-01T00:00:00.000Z" },
      event,
      event,
    ], { now: new Date("2026-07-23T12:00:00.000Z"), retentionDays: 180 });
    expect(compact).toHaveLength(1);
  });

  it("summarizes rejection reasons for evaluation reports", () => {
    const report = evaluateNoveltyPool([
      { id: "a", title: "Already shown", link: "https://example.com/a" },
      { id: "b", title: "Completely new", link: "https://example.com/b" },
    ], [{
      title: "Already shown",
      canonicalUrl: "https://example.com/a",
      editionDate: "2026-07-22",
    }], { targetDate: "2026-07-23" });

    expect(report.candidateCount).toBe(2);
    expect(report.rejectedCount).toBe(1);
    expect(report.rejectionReasons["exact-url-exposure"]).toBe(1);
  });
});

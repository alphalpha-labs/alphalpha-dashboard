// lib/actions.test.ts
import { describe, it, expect } from "vitest";
import { parseActionBlock, stripPartialActionFence } from "./actions";

const STRUCTURED_BLOCK = `I'll update your conviction.

\`\`\`action
{
  "variant": "structured",
  "label": "Proposed change",
  "signal": "investment-action",
  "payload": { "action": "update-conviction", "value": "high" },
  "preview": { "item": "NVDA thesis", "field": "Conviction", "from": "Medium", "to": "High" }
}
\`\`\``;

const NARRATIVE_BLOCK = `On it.

\`\`\`action
{
  "variant": "narrative",
  "label": "Proposed actions",
  "signal": "automation-action",
  "payload": { "action": "multi-step" },
  "preview": { "summary": "Draft note, flag loop", "tags": ["Research note", "Loop"] }
}
\`\`\``;

describe("parseActionBlock", () => {
  it("parses a valid structured block and returns cleaned text", () => {
    const { cleaned, proposal } = parseActionBlock(STRUCTURED_BLOCK);
    expect(cleaned).toBe("I'll update your conviction.");
    expect(proposal).not.toBeNull();
    expect(proposal!.variant).toBe("structured");
    expect(proposal!.signal).toBe("investment-action");
    expect((proposal!.preview as any).to).toBe("High");
  });

  it("parses a valid narrative block", () => {
    const { cleaned, proposal } = parseActionBlock(NARRATIVE_BLOCK);
    expect(cleaned).toBe("On it.");
    expect(proposal!.variant).toBe("narrative");
    expect((proposal!.preview as any).tags).toEqual(["Research note", "Loop"]);
  });

  it("returns null proposal for plain text with no fence", () => {
    const { cleaned, proposal } = parseActionBlock("Just some text.");
    expect(cleaned).toBe("Just some text.");
    expect(proposal).toBeNull();
  });

  it("returns null proposal for malformed JSON inside fence", () => {
    const bad = "Text.\n\`\`\`action\n{ not json }\n\`\`\`";
    const { cleaned, proposal } = parseActionBlock(bad);
    expect(cleaned).toBe("Text.\n\`\`\`action\n{ not json }\n\`\`\`");
    expect(proposal).toBeNull();
  });

  it("returns null proposal when required fields are missing", () => {
    const incomplete = "Text.\n\`\`\`action\n{\"variant\":\"structured\"}\n\`\`\`";
    const { proposal } = parseActionBlock(incomplete);
    expect(proposal).toBeNull();
  });

  it("returns null proposal for unknown variant", () => {
    const badVariant = `Text.\n\`\`\`action\n{"variant":"unknown","signal":"s","label":"l","payload":{},"preview":{}}\n\`\`\``;
    const { proposal } = parseActionBlock(badVariant);
    expect(proposal).toBeNull();
  });

  it("returns null proposal when payload is an array", () => {
    const arrayPayload = `Text.\n\`\`\`action\n{"variant":"structured","signal":"s","label":"l","payload":[1,2,3],"preview":{"item":"i","field":"f","from":"a","to":"b"}}\n\`\`\``;
    const { proposal } = parseActionBlock(arrayPayload);
    expect(proposal).toBeNull();
  });

  it("parses the last action fence when multiple are present", () => {
    const multi = `Text.\n\`\`\`action\n{"variant":"structured","signal":"done","label":"First","payload":{"a":1},"preview":{"item":"x","field":"f","from":"a","to":"b"}}\n\`\`\`\nMore text.\n\`\`\`action\n{"variant":"narrative","signal":"skip","label":"Second","payload":{"b":2},"preview":{"summary":"s","tags":["T"]}}\n\`\`\``;
    const { cleaned, proposal } = parseActionBlock(multi);
    expect(proposal).not.toBeNull();
    expect(proposal!.label).toBe("Second");
    expect(cleaned).toContain("Text.");
  });
});

describe("stripPartialActionFence", () => {
  it("removes a partial fence mid-stream", () => {
    const partial = "I'll update your conviction.\n\`\`\`action\n{\"variant\":";
    expect(stripPartialActionFence(partial)).toBe("I'll update your conviction.");
  });

  it("leaves plain text unchanged", () => {
    expect(stripPartialActionFence("Plain text.")).toBe("Plain text.");
  });
});

// lib/actions.ts
// Shared types and utilities for thread action proposals.
// Imported by both client components and (if needed) server routes.

export type StructuredPreview = {
  item:  string;
  field: string;
  from:  string;
  to:    string;
};

export type NarrativePreview = {
  summary: string;
  tags:    string[];
};

export type ActionProposal = {
  variant: "structured" | "narrative";
  label:   string;          // e.g. "Proposed change", "Proposed actions"
  signal:  string;          // maps to /api/signal `type` field
  payload: Record<string, unknown>;
  preview: StructuredPreview | NarrativePreview;
};

export function isStructured(p: ActionProposal): p is ActionProposal & { preview: StructuredPreview } {
  return p.variant === "structured";
}

// ACTION_FENCE_RE matches the last ```action ... ``` block at the end of a response.
// Group 1: the leading content before the fence (greedy — forces match of the LAST fence).
// Group 2: the JSON content inside the fence.
const ACTION_FENCE_RE = /^([\s\S]*)\n?\s*```action\n([\s\S]*?)```\s*$/;

/**
 * Strips the action fence from `text` and parses the embedded JSON.
 * Returns the cleaned display text and a proposal (or null if none / malformed).
 * Never throws — malformed blocks are silently discarded.
 */
export function parseActionBlock(text: string): {
  cleaned:  string;
  proposal: ActionProposal | null;
} {
  const match = text.match(ACTION_FENCE_RE);
  if (!match) return { cleaned: text, proposal: null };

  try {
    const raw = JSON.parse(match[2]) as Partial<ActionProposal>;
    if (
      (raw.variant !== "structured" && raw.variant !== "narrative") ||
      typeof raw.signal  !== "string" || !raw.signal  ||
      typeof raw.label   !== "string" || !raw.label   ||
      !raw.payload || typeof raw.payload !== "object" || Array.isArray(raw.payload) ||
      !raw.preview || typeof raw.preview !== "object" || Array.isArray(raw.preview)
    ) {
      return { cleaned: text, proposal: null };
    }
    // match[1] is the text preceding the last fence; trim to get cleaned display text.
    const cleaned = match[1].trim();
    return { cleaned, proposal: raw as ActionProposal };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

/**
 * Strip-only version used during live streaming to hide a partial fence
 * that is still building. Removes everything from the opening fence onwards.
 */
export function stripPartialActionFence(text: string): string {
  return text.replace(/\n?\s*```action[\s\S]*$/, "").trim();
}

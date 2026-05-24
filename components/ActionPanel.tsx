// components/ActionPanel.tsx
"use client";
import { useState } from "react";
import { isStructured, type ActionProposal, type StructuredPreview, type NarrativePreview } from "@/lib/actions";

type PanelState = "idle" | "loading" | "done" | "error";

interface Props {
  proposal: ActionProposal;
  itemId:   string;
  onDismiss: () => void;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function receiptCopy(proposal: ActionProposal): { main: string; sub: string } {
  if (isStructured(proposal)) {
    const p = proposal.preview as StructuredPreview;
    return {
      main: `${p.field} updated to ${p.to}`,
      sub:  `${p.item} · logged ${formatTime()}`,
    };
  }
  const p = proposal.preview as NarrativePreview;
  const count = p.tags?.length ?? 1;
  return {
    main: count === 1 ? "Action queued" : `${count} actions queued`,
    sub:  `${p.tags?.join(" · ") ?? "Done"} · ${formatTime()}`,
  };
}

export default function ActionPanel({ proposal, itemId, onDismiss }: Props) {
  const [state,       setState]       = useState<PanelState>("idle");
  const [dismissing,  setDismissing]  = useState(false);
  const [receipt,     setReceipt]     = useState<{ main: string; sub: string } | null>(null);

  const handleConfirm = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/signal", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type:    proposal.signal,
          itemId,
          payload: proposal.payload,
        }),
      });
      if (!res.ok) throw new Error(`Signal failed: ${res.status}`);
      setReceipt(receiptCopy(proposal));
      setState("done");
    } catch (err) {
      console.error("[ActionPanel] signal failed:", err);
      setState("error");
    }
  };

  const handleDismiss = () => {
    setDismissing(true);
    // Wait for the CSS dismiss animation to finish before removing from DOM.
    setTimeout(() => onDismiss(), 300);
  };

  const handleRetry = () => setState("idle");

  // ── Done (receipt) ──
  if (state === "done" && receipt) {
    return (
      <div className="actionPanel actionPanel--done">
        <div className="actionReceiptShimmer" />
        <div className="actionReceipt">
          <div className="actionReceiptCheck">✓</div>
          <div>
            <div className="actionReceiptMain">{receipt.main}</div>
            <div className="actionReceiptSub">{receipt.sub}</div>
          </div>
        </div>
      </div>
    );
  }

  const panelClass = [
    "actionPanel",
    state === "loading"  && "actionPanel--loading",
    state === "error"    && "actionPanel--error",
    dismissing           && "actionPanel--dismissed",
  ].filter(Boolean).join(" ");

  const busy = state === "loading";

  // ── Structured body ──
  const structuredBody = isStructured(proposal) && (() => {
    const p = proposal.preview as StructuredPreview;
    return (
      <div className="actionPanel-body">
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Item</span>
          <span className="actionFieldVal">{p.item}</span>
        </div>
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Field</span>
          <span className="actionFieldVal">{p.field}</span>
        </div>
        <div className="actionFieldRow">
          <span className="actionFieldLabel">Change</span>
          <span className="actionFieldVal">{p.from}</span>
          <span className="actionFieldArrow">→</span>
          <span className="actionFieldVal actionFieldVal--new">{p.to}</span>
        </div>
      </div>
    );
  })();

  // ── Narrative body ──
  const narrativeBody = !isStructured(proposal) && (() => {
    const p = proposal.preview as NarrativePreview;
    return (
      <div className="actionPanel-body">
        <div className="actionNarrativeSummary">"{p.summary}"</div>
        {p.tags?.length > 0 && (
          <div className="actionTags">
            {p.tags.map(tag => <span key={tag} className="actionTag">{tag}</span>)}
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className={panelClass}>
      <div className="actionPanel-head">
        <span className="actionPanel-headLabel">{proposal.label}</span>
      </div>

      {structuredBody || narrativeBody}

      <div className="actionPanel-foot">
        {state === "error" ? (
          <>
            <span className="actionErrorMsg">Something went wrong — try again</span>
            <button className="actionConfirmBtn" onClick={handleRetry}>Retry</button>
            <button className="actionDismissBtn" onClick={handleDismiss}>Dismiss</button>
          </>
        ) : (
          <>
            <button className="actionConfirmBtn" onClick={handleConfirm} disabled={busy}>
              {busy ? "Working…" : "✓ " + confirmLabel(proposal)}
            </button>
            <button className="actionDismissBtn" onClick={handleDismiss} disabled={busy}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function confirmLabel(proposal: ActionProposal): string {
  if (isStructured(proposal)) return "Apply change";
  const p = proposal.preview as NarrativePreview;
  const count = p.tags?.length ?? 1;
  return count === 1 ? "Do this" : "Do all of this";
}

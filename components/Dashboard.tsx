"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { DashboardData, Action, Loop, AutomationJob } from "@/lib/data";
import type { CaptureInput } from "./QuickAdd";
import TodayTab from "./TodayTab";
import LoopsTab from "./LoopsTab";
import ProjectGrid from "./ProjectGrid";
import InvestingTab from "./InvestingTab";
import DigestsTab from "./DigestsTab";
import AutomationsTab from "./AutomationsTab";
import ReviewTab from "./ReviewTab";
import SystemTab from "./SystemTab";
import QueuesTab from "./QueuesTab";
import ThreadDrawer from "./ThreadDrawer";
import StatusBar from "./StatusBar";

type SignalResult = {
  ok?: boolean;
  type?: string;
  itemId?: string;
  acceptedAt?: string;
  receipt?: string;
  upstream?: unknown;
  error?: string;
};

type SignalReceipt = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

export type ThreadContext = {
  id:        string;
  type:      "decision" | "loop" | "project" | "ticker" | "digest" | "systemDoc" | "queueItem";
  title:     string;
  project?:  string;
  priority?: string;
  next?:     string;
  theme?:    string;
  stance?:   string;
  summary?:  string;
  category?: string;
  ocOwned?:  boolean;
};

const TABS = [
  { id: "today",     label: "Today", href: "/" },
  { id: "loops",     label: "Open loops", href: "/open-loops" },
  { id: "projects",  label: "Projects", href: "/projects" },
  { id: "investing", label: "Investing", href: "/investing" },
  { id: "digests",   label: "Digests", href: "/digests" },
  { id: "queues",    label: "Queues", href: "/queues" },
  { id: "review",    label: "Review", href: "/review" },
  { id: "automations", label: "Automations", href: "/automations" },
  { id: "system", label: "System", href: "/system" },
] as const;

export type DashboardTab = typeof TABS[number]["id"];

// OPENCLAW: This helper posts action signals to /api/signal (currently a stub).
// When OpenClaw wires up the real endpoint, no changes needed here —
// only app/api/signal/route.ts needs to be updated.
async function postSignal(type: string, itemId: string, payload?: object): Promise<SignalResult> {
  const res = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, itemId, payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Signal failed (${res.status})`);
  return json;
}

export default function Dashboard({ data, initialTab = "today" }: { data: DashboardData; initialTab?: DashboardTab }) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [actions, setActions]       = useState<Action[]>(data.topActions);
  const [loops, setLoops]           = useState<Loop[]>(data.openLoops);
  const [automations, setAutomations] = useState<AutomationJob[]>(data.automations || []);
  const [reviewItems, setReviewItems] = useState(data.reviewQueue || []);
  const [focusIdx, setFocusIdx]   = useState(0);
  const [thread, setThread]       = useState<ThreadContext | null>(null);
  const [pendingSignals, setPendingSignals] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<SignalReceipt | null>(null);
  const signalQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const activeActions  = actions.filter(a => !a.done && !a.snoozed);
  const snoozedActions = actions.filter(a => a.snoozed);

  const dispatchSignal = useCallback(async (type: string, itemId: string, payload?: object, label?: string) => {
    const key = `${type}:${itemId}`;
    setPendingSignals(prev => ({ ...prev, [key]: label || type }));
    setReceipt({ id: key, tone: "info", message: `${label || "Action"} queued…` });
    try {
      const run = signalQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          setReceipt({ id: key, tone: "info", message: `${label || "Action"}…` });
          return postSignal(type, itemId, payload);
        });
      signalQueueRef.current = run;
      const result = await run;
      setReceipt({ id: key, tone: "success", message: result.receipt || `${label || "Action"} accepted.` });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signal failed";
      setReceipt({ id: key, tone: "error", message });
      throw error;
    } finally {
      setPendingSignals(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  const handleDone = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: true } : a));
    setFocusIdx(0);
    void dispatchSignal("done", id, undefined, "Marked done").catch(() => {});
  }, [dispatchSignal]);

  const handleSnooze = useCallback((id: string, label: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: true, snoozeLabel: label } : a));
    setFocusIdx(0);
    void dispatchSignal("snooze", id, { label }, "Snoozed").catch(() => {});
  }, [dispatchSignal]);

  const handleSkip = useCallback(() => {
    setFocusIdx(i => (i + 1) % Math.max(activeActions.length, 1));
  }, [activeActions.length]);

  const handleWake = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: false, snoozeLabel: null } : a));
    void dispatchSignal("wake", id, undefined, "Woke item").catch(() => {});
  }, [dispatchSignal]);

  const handleAdd = useCallback((input: CaptureInput) => {
    const newLoop: Loop = { id: `l${Date.now()}`, text: input.text, project: input.project || "Inbox", priority: input.priority || "MEDIUM" };
    setLoops(prev => [newLoop, ...prev]);
    void dispatchSignal("add-loop", newLoop.id, {
      ...input,
      loop: newLoop,
      durableTarget: "context/OPEN_LOOPS.md",
      requestedAction: "append-open-loop-and-refresh-dashboard",
    }, "Added loop").catch(() => {});
  }, [dispatchSignal]);

  const handleEventFeedback = useCallback((eventId: string, feedbackType: string, payload: object) => {
    void dispatchSignal("event-feedback", eventId, { type: feedbackType, ...payload }, "Recorded feedback").catch(() => {});
  }, [dispatchSignal]);

  const handleReviewAction = useCallback((itemId: string, action: string, payload: object = {}) => {
    const item = reviewItems.find(i => i.id === itemId);
    setReviewItems(prev => prev.map(item => item.id === itemId
      ? { ...item, status: action === "dismiss" ? "dismissed" : action === "approve" || action === "promote-loop" ? "approved" : item.status }
      : item));
    void dispatchSignal("review-action", itemId, {
      action,
      itemId,
      item,
      ...payload,
      durableTarget: item?.target || item?.source || "memory/review-queue/latest-manifest.json",
      requestedAction: action === "promote-loop" ? "append-open-loop-and-mark-review-approved" : "persist-review-decision-and-refresh-dashboard",
    }, `Review ${action}`).catch(() => {});
  }, [dispatchSignal, reviewItems]);

  const handleInvestmentAction = useCallback(async (itemId: string, action: string, payload: object = {}) => {
    const investingOsActions = new Set(["record-conviction", "promote-thesis", "add-source-note", "stage-taxonomy-decision", "stage-manual-investing-decision"]);
    await dispatchSignal("investment-action", itemId, {
      action,
      itemId,
      ...payload,
      durableTarget: action === "stage-taxonomy-decision" ? "memory/investing/thesis-taxonomy-decisions.json" : action === "stage-manual-investing-decision" ? "memory/investing/investment-manual-decisions.json" : investingOsActions.has(action) ? "memory/investing/" : action === "record-decision" ? "memory/thesis-baskets/decision-journal.json" : "memory/thesis-baskets/research-actions.json",
      requestedAction: investingOsActions.has(action) ? "apply-investing-os-action-and-refresh-dashboard" : "apply-investment-action-and-refresh-dashboard",
      canonicalBridge: action === "promote-thesis"
        ? { mode: "dry-run", endpoint: "/api/alphalpha/thesis-baskets/propose", applyRequires: "canonical-mode=apply" }
        : action === "stage-taxonomy-decision"
          ? { mode: "dry-run", endpoint: "/api/alphalpha/thesis-baskets/:id", applyRequires: "canonical-mode=apply" }
          : undefined,
    }, action === "stage-taxonomy-decision" || action === "stage-manual-investing-decision" ? "Saving decision" : "Investing action");
  }, [dispatchSignal]);

  const handleAutomationAction = useCallback((jobId: string, action: string, payload: object = {}) => {
    const job = automations.find(j => j.id === jobId);
    setAutomations(prev => prev.map(job => {
      if (job.id !== jobId) return job;
      if (action === "pause") return { ...job, enabled: false };
      if (action === "resume") return { ...job, enabled: true };
      if (action === "set-cron" && "expr" in payload) return { ...job, scheduleLabel: `${String((payload as { expr?: string }).expr || job.scheduleLabel)} (${String((payload as { tz?: string }).tz || "America/Chicago")})` };
      if (action === "set-every" && "every" in payload) return { ...job, scheduleLabel: `every ${String((payload as { every?: string }).every)}` };
      return job;
    }));
    void dispatchSignal("automation-action", jobId, {
      action,
      jobId,
      job,
      ...payload,
      durableTarget: "memory/dashboard/automation-actions.json",
      requestedAction: "apply-automation-action-log-and-refresh-dashboard",
    }, `Automation ${action}`).catch(() => {});
  }, [automations, dispatchSignal]);

  const handleLoopDone = useCallback((id: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, done: true } : l));
    void dispatchSignal("done", id, undefined, "Marked done").catch(() => {});
  }, [dispatchSignal]);

  const handleLoopSnooze = useCallback((id: string, label: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, snoozed: true, snoozeLabel: label } : l));
    void dispatchSignal("snooze", id, { label }, "Snoozed").catch(() => {});
  }, [dispatchSignal]);

  const openThread  = useCallback((ctx: ThreadContext) => setThread(ctx), []);
  const closeThread = useCallback(() => setThread(null), []);

  const drawerOpen = !!thread;
  const signalBusy = Object.keys(pendingSignals).length > 0;

  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  }, []);

  useEffect(() => {
    const match = TABS.find(tab => tab.href === pathname || (pathname === "/open-loops" && tab.id === "loops"));
    if (match) setActiveTab(match.id);
  }, [pathname]);

  const navigateTab = useCallback((tab: typeof TABS[number]) => {
    setActiveTab(tab.id);
    if (typeof window !== "undefined") window.history.pushState(null, "", tab.href);
  }, []);

  return (
    <div className="appShell">
      <header className="masthead">
        <div className="mastheadLogo">
          <span className="mastheadWordmark">Alphalpha</span>
          <span className="mastheadSub">Chief of Staff</span>
        </div>
        <nav className="tabNav" aria-label="Dashboard sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tabBtn${activeTab === tab.id ? " tabBtn--active" : ""}`}
              onClick={() => navigateTab(tab)}
              title={tab.href}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mastheadTools">
          <button
            className={`refreshBtn${signalBusy ? " refreshBtn--busy" : ""}`}
            onClick={() => void dispatchSignal("refresh-dashboard", "dashboard", { requestedAction: "regenerate-manifests-and-deploy" }, "Refresh requested").catch(() => {})}
            disabled={signalBusy}
            title="Ask OpenClaw to regenerate dashboard data and deploy"
          >
            {signalBusy ? "Working…" : "Refresh"}
          </button>
          {receipt && <div className={`signalReceipt signalReceipt--${receipt.tone}`} role="status" aria-live="polite">{receipt.message}</div>}
          <div className="mastheadDate" aria-hidden="true">
            {dateStr}
          </div>
        </div>
      </header>

      <main className="mainContent" style={{ marginRight: drawerOpen ? 360 : 0 }} aria-busy={signalBusy}>
        <div key={activeTab} className="tabContent">
          {activeTab === "today" && (
            <TodayTab
              data={data}
              activeActions={activeActions}
              snoozedActions={snoozedActions}
              loops={loops}
              focusIdx={focusIdx}
              onDone={handleDone}
              onSnooze={handleSnooze}
              onSkip={handleSkip}
              onWake={handleWake}
              onAdd={handleAdd}
              onEventFeedback={handleEventFeedback}
              onDiscuss={openThread}
            />
          )}
          {activeTab === "loops" && (
            <LoopsTab
              loops={loops}
              onDone={handleLoopDone}
              onSnooze={handleLoopSnooze}
              onAdd={handleAdd}
              onDiscuss={openThread}
            />
          )}
          {activeTab === "projects" && (
            <ProjectGrid projects={data.projects} loops={loops} onDiscuss={openThread} />
          )}
          {activeTab === "investing" && (
            <InvestingTab
              investing={data.investing}
              digest={data.meta.investmentDecisionDigest}
              changes={data.meta.investmentDecisionDigestChanges}
              preflight={data.meta.investmentRuntimePreflight}
              journal={data.meta.investmentDecisionJournal}
              researchActions={data.meta.investmentResearchActions}
              crawlPlan={data.meta.investmentCrawlPlan}
              thesisRegistry={data.meta.investingThesisRegistry}
              convictionLedger={data.meta.investingConvictionLedger}
              accumulationPlan={data.meta.investingAccumulationPlan}
              trustedSources={data.meta.investingTrustedSources}
              priceAlerts={data.meta.investingPriceAlerts}
              accumulationOpportunities={data.meta.investingAccumulationOpportunities}
              proposedTheses={data.meta.investingProposedTheses}
              proposedThesisConfig={data.meta.investingProposedThesisConfig}
              weeklyTrades={data.meta.investingWeeklyTrades}
              tradeReview={data.meta.investingTradeReview}
              tradeJournal={data.meta.investingTradeJournal}
              feedbackCalibration={data.meta.investingFeedbackCalibration}
              inputHealth={data.meta.investingInputHealth}
              portfolioContextMap={data.meta.investingPortfolioContextMap}
              taxonomyDecisionSheet={data.meta.investingTaxonomyDecisionSheet}
              taxonomyDecisionWorkflow={data.meta.investingTaxonomyDecisionWorkflow}
              taxonomyDecisions={data.meta.investingTaxonomyDecisions}
              manualDecisionWorkflow={data.meta.investingManualDecisionWorkflow}
              holdingRoleDecisionWorkflow={data.meta.investingHoldingRoleDecisionWorkflow}
              manualDecisions={data.meta.investingManualDecisions}
              executionBoundaryPolicy={data.meta.investingExecutionBoundaryPolicy}
              rankedActionQueue={data.meta.investingRankedActionQueue}
              sourceReliabilityPlan={data.meta.investingSourceReliabilityPlan}
              basketGovernanceAudit={data.meta.investingBasketGovernanceAudit}
              thesisUniverse={data.meta.investingThesisUniverse}
              onDiscuss={openThread}
              onAction={handleInvestmentAction}
            />
          )}
          {activeTab === "digests" && (
            <DigestsTab digests={data.digests} onDiscuss={openThread} />
          )}
          {activeTab === "queues" && (
            <QueuesTab queues={data.meta.queues || []} onDiscuss={openThread} />
          )}
          {activeTab === "review" && (
            <ReviewTab items={reviewItems} onAction={handleReviewAction} />
          )}
          {activeTab === "system" && (
            <SystemTab docs={data.meta.systemDocs || []} onDiscuss={openThread} />
          )}
          {activeTab === "automations" && (
            <AutomationsTab automations={automations} onAction={handleAutomationAction} />
          )}
        </div>
      </main>

      <ThreadDrawer thread={thread} onClose={closeThread} />
      <StatusBar stats={data.stats} generatedAt={data.meta.generatedAt} drawerOpen={drawerOpen} />
    </div>
  );
}

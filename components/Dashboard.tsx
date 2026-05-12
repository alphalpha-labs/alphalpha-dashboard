"use client";
import { useState, useCallback, useEffect } from "react";
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
import ThreadDrawer from "./ThreadDrawer";
import StatusBar from "./StatusBar";

export type ThreadContext = {
  id:        string;
  type:      "decision" | "loop" | "project" | "ticker" | "digest";
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
  { id: "review",    label: "Review", href: "/review" },
  { id: "automations", label: "Automations", href: "/automations" },
] as const;

export type DashboardTab = typeof TABS[number]["id"];

// OPENCLAW: This helper posts action signals to /api/signal (currently a stub).
// When OpenClaw wires up the real endpoint, no changes needed here —
// only app/api/signal/route.ts needs to be updated.
async function postSignal(type: string, itemId: string, payload?: object) {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, itemId, payload }),
  }).catch(() => {});
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

  const activeActions  = actions.filter(a => !a.done && !a.snoozed);
  const snoozedActions = actions.filter(a => a.snoozed);

  const handleDone = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: true } : a));
    setFocusIdx(0);
    postSignal("done", id);
  }, []);

  const handleSnooze = useCallback((id: string, label: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: true, snoozeLabel: label } : a));
    setFocusIdx(0);
    postSignal("snooze", id, { label });
  }, []);

  const handleSkip = useCallback(() => {
    setFocusIdx(i => (i + 1) % Math.max(activeActions.length, 1));
  }, [activeActions.length]);

  const handleWake = useCallback((id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, snoozed: false, snoozeLabel: null } : a));
    postSignal("wake", id);
  }, []);

  const handleAdd = useCallback((input: CaptureInput) => {
    const newLoop: Loop = { id: `l${Date.now()}`, text: input.text, project: input.project || "Inbox", priority: input.priority || "MEDIUM" };
    setLoops(prev => [newLoop, ...prev]);
    postSignal("add-loop", newLoop.id, {
      ...input,
      loop: newLoop,
      durableTarget: "context/OPEN_LOOPS.md",
      requestedAction: "append-open-loop-and-refresh-dashboard",
    });
  }, []);

  const handleEventFeedback = useCallback((eventId: string, feedbackType: string, payload: object) => {
    postSignal("event-feedback", eventId, { type: feedbackType, ...payload });
  }, []);

  const handleReviewAction = useCallback((itemId: string, action: string, payload: object = {}) => {
    const item = reviewItems.find(i => i.id === itemId);
    setReviewItems(prev => prev.map(item => item.id === itemId
      ? { ...item, status: action === "dismiss" ? "dismissed" : action === "approve" || action === "promote-loop" ? "approved" : item.status }
      : item));
    postSignal("review-action", itemId, {
      action,
      itemId,
      item,
      ...payload,
      durableTarget: item?.target || item?.source || "memory/review-queue/latest-manifest.json",
      requestedAction: action === "promote-loop" ? "append-open-loop-and-mark-review-approved" : "persist-review-decision-and-refresh-dashboard",
    });
  }, [reviewItems]);

  const handleInvestmentAction = useCallback((itemId: string, action: string, payload: object = {}) => {
    postSignal("investment-action", itemId, {
      action,
      itemId,
      ...payload,
      durableTarget: action === "record-conviction" || action === "promote-thesis" || action === "add-source-note" ? "memory/investing/" : action === "record-decision" ? "memory/thesis-baskets/decision-journal.json" : "memory/thesis-baskets/research-actions.json",
      requestedAction: action === "record-conviction" || action === "promote-thesis" || action === "add-source-note" ? "apply-investing-os-action-and-refresh-dashboard" : "apply-investment-action-and-refresh-dashboard",
    });
  }, []);

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
    postSignal("automation-action", jobId, {
      action,
      jobId,
      job,
      ...payload,
      durableTarget: "memory/dashboard/automation-actions.json",
      requestedAction: "apply-automation-action-log-and-refresh-dashboard",
    });
  }, [automations]);

  const handleLoopDone = useCallback((id: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, done: true } : l));
    postSignal("done", id);
  }, []);

  const handleLoopSnooze = useCallback((id: string, label: string) => {
    setLoops(prev => prev.map(l => l.id === id ? { ...l, snoozed: true, snoozeLabel: label } : l));
    postSignal("snooze", id, { label });
  }, []);

  const openThread  = useCallback((ctx: ThreadContext) => setThread(ctx), []);
  const closeThread = useCallback(() => setThread(null), []);

  const drawerOpen = !!thread;

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
            className="refreshBtn"
            onClick={() => postSignal("refresh-dashboard", "dashboard", { requestedAction: "regenerate-manifests-and-deploy" })}
            title="Ask OpenClaw to regenerate dashboard data and deploy"
          >
            Refresh
          </button>
          <div className="mastheadDate" aria-hidden="true">
            {dateStr}
          </div>
        </div>
      </header>

      <main className="mainContent" style={{ marginRight: drawerOpen ? 360 : 0 }}>
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
              onDiscuss={openThread}
              onAction={handleInvestmentAction}
            />
          )}
          {activeTab === "digests" && (
            <DigestsTab digests={data.digests} onDiscuss={openThread} />
          )}
          {activeTab === "review" && (
            <ReviewTab items={reviewItems} onAction={handleReviewAction} />
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

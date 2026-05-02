import type { DashboardData, Action, Loop } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";
import FocusCard from "./FocusCard";
import ContextColumn from "./ContextColumn";

interface Props {
  data:           DashboardData;
  activeActions:  Action[];
  snoozedActions: Action[];
  loops:          Loop[];
  focusIdx:       number;
  onDone:         (id: string) => void;
  onSnooze:       (id: string, label: string) => void;
  onSkip:         () => void;
  onWake:         (id: string) => void;
  onAdd:          (text: string) => void;
  onDiscuss:      (ctx: ThreadContext) => void;
}

export default function TodayTab({ data, activeActions, snoozedActions, loops, focusIdx, onDone, onSnooze, onSkip, onWake, onAdd, onDiscuss }: Props) {
  const current = activeActions[focusIdx % Math.max(activeActions.length, 1)];

  return (
    <div className="todayLayout">
      <FocusCard
        current={current}
        activeActions={activeActions}
        focusIdx={focusIdx}
        snoozedActions={snoozedActions}
        onDone={onDone}
        onSnooze={onSnooze}
        onSkip={onSkip}
        onWake={onWake}
        onDiscuss={onDiscuss}
      />
      <ContextColumn
        meta={data.meta}
        loops={loops}
        investing={data.investing}
        digests={data.digests}
        onAdd={onAdd}
        onDiscuss={onDiscuss}
      />
    </div>
  );
}

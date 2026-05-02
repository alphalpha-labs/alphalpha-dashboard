import type { DashboardData } from "@/lib/data";

interface Props {
  stats:       DashboardData["stats"];
  generatedAt: string;
  drawerOpen:  boolean;
}

export default function StatusBar({ stats, generatedAt, drawerOpen }: Props) {
  const date = new Date(generatedAt);
  const formatted = date.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  }) + " · " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  return (
    <footer className="statusBar" style={{ marginRight: drawerOpen ? 360 : 0 }}>
      <span>
        {stats.openLoops} open loops · {stats.activeProjects} projects ·{" "}
        {stats.highPriority > 0
          ? <span className="statusHighPri">{stats.highPriority} high priority</span>
          : <span>{stats.highPriority} high priority</span>}
      </span>
      <span className="statusGenerated">Generated {formatted}</span>
    </footer>
  );
}

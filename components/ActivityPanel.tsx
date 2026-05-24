import type { ActivityItem } from "@/lib/data";

export default function ActivityPanel({ activity = [] }: { activity?: ActivityItem[] }) {
  const recent = activity.slice(0, 8);
  return (
    <section className="activityPanel">
      <div className="activityHeader">
        <h2>Activity trail</h2>
        <span>{activity.length} recorded</span>
      </div>
      {recent.length === 0 ? (
        <p className="activityEmpty">No dashboard actions recorded yet.</p>
      ) : recent.map(item => (
        <div key={item.id} className={`activityRow activityRow--${item.status}`}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
          </div>
          <span>{item.kind} · {formatDate(item.at)}</span>
        </div>
      ))}
    </section>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "n/a";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

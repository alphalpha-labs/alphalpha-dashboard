import type { QueueGroup, QueueItem } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  queues: QueueGroup[];
  onDiscuss: (ctx: ThreadContext) => void;
}

function itemMeta(item: QueueItem) {
  return [item.status, item.priority && `Priority: ${item.priority}`, item.added && `Added ${item.added}`].filter(Boolean).join(" · ");
}

function QueueCard({ queue, item, onDiscuss }: { queue: QueueGroup; item: QueueItem; onDiscuss: Props["onDiscuss"] }) {
  return (
    <article className="queueItem">
      <div className="queueItemTop">
        <span className="queueStatus">{item.status || "Queued"}</span>
        {item.priority && <span className="queuePriority">{item.priority}</span>}
      </div>
      <h3>{item.title}</h3>
      {item.creator && <p className="queueCreator">{item.creator}</p>}
      {item.why && <p className="queueWhy">{item.why}</p>}
      <div className="queueMeta">
        {itemMeta(item) && <span>{itemMeta(item)}</span>}
        {item.source && <span>Source: {item.source}</span>}
      </div>
      {item.themes && item.themes.length > 0 && (
        <div className="digestTags">
          {item.themes.slice(0, 5).map(theme => <span key={theme} className="digestTag">#{theme}</span>)}
        </div>
      )}
      <div className="queueActions">
        {item.link && <a className="queueLink" href={item.link} target="_blank" rel="noreferrer">Open source</a>}
        <button
          className="btnAlphaDiscuss"
          onClick={() => onDiscuss({ id: item.id, type: "queueItem", title: item.title, category: queue.label, summary: item.why || item.notes || queue.summary })}
        >
          <span className="alphaGlyph">α</span> Discuss
        </button>
      </div>
    </article>
  );
}

export default function QueuesTab({ queues, onDiscuss }: Props) {
  const totalItems = queues.reduce((sum, queue) => sum + queue.items.length, 0);
  const totalClarify = queues.reduce((sum, queue) => sum + queue.needsClarification.length, 0);

  return (
    <div className="queuesPage">
      <section className="queuesHero">
        <div>
          <p className="eyebrow">Personal queues</p>
          <h1 className="tabTitle">Queues & lists</h1>
          <p className="tabSubtitle">Books, articles, shows, movies, and other durable lists pulled from Obsidian queue files.</p>
        </div>
        <div className="systemStats" aria-label="Queue stats">
          <span><strong>{queues.length}</strong> lists</span>
          <span><strong>{totalItems}</strong> queued</span>
          <span><strong>{totalClarify}</strong> need clarification</span>
        </div>
      </section>

      <div className="queuesGrid">
        {queues.map(queue => (
          <section key={queue.id} className="queueGroup">
            <div className="queueGroupHeader">
              <div>
                <span className="queueKind">{queue.kind}</span>
                <h2>{queue.label}</h2>
                <p>{queue.summary}</p>
              </div>
              <div className="queuePath">
                <span>{queue.path}</span>
                {queue.updatedAt && <span>{queue.updatedAt.slice(0, 10)}</span>}
              </div>
            </div>

            {queue.items.length > 0 ? (
              <div className="queueItems">
                {queue.items.map(item => <QueueCard key={item.id} queue={queue} item={item} onDiscuss={onDiscuss} />)}
              </div>
            ) : (
              <div className="queueEmpty">No confirmed candidates yet.</div>
            )}

            {queue.needsClarification.length > 0 && (
              <details className="queueClarify">
                <summary>{queue.needsClarification.length} need clarification</summary>
                <div className="queueItems queueItems--compact">
                  {queue.needsClarification.map(item => <QueueCard key={item.id} queue={queue} item={item} onDiscuss={onDiscuss} />)}
                </div>
              </details>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

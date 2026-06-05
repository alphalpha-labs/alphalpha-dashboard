"use client";

import { useMemo, useState } from "react";
import type { QueueGroup, QueueItem } from "@/lib/data";
import type { ThreadContext } from "./Dashboard";

interface Props {
  queues: QueueGroup[];
  onDiscuss: (ctx: ThreadContext) => void;
}

function itemMeta(item: QueueItem) {
  return [item.status, item.priority && `Priority: ${item.priority}`, item.added && `Added ${item.added}`].filter(Boolean).join(" · ");
}

type QueueLookupSuggestion = {
  title: string;
  creator: string;
  year?: string | null;
  status: string;
  priority: string;
  why: string;
  link?: string | null;
  sourceLabel?: string | null;
  notes?: string | null;
  confidence: "high" | "medium" | "low";
};

type LookupState = {
  query: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  suggestions: QueueLookupSuggestion[];
  index: number;
  saved: string | null;
};

const ADDABLE_QUEUE_KINDS = new Set(["books", "shows", "movies"]);

function emptyLookupState(): LookupState {
  return { query: "", loading: false, saving: false, error: null, suggestions: [], index: 0, saved: null };
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

function QueueAddBox({ queue }: { queue: QueueGroup }) {
  const [state, setState] = useState<LookupState>(() => emptyLookupState());
  const suggestion = state.suggestions[state.index] ?? null;
  const canSearch = state.query.trim().length > 1 && !state.loading;
  const hasNext = state.suggestions.length > 1;

  const lookup = async () => {
    if (!canSearch) return;
    setState(prev => ({ ...prev, loading: true, error: null, suggestions: [], index: 0, saved: null }));
    try {
      const res = await fetch("/api/queue-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: queue.kind, query: state.query.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Lookup failed");
      setState(prev => ({
        ...prev,
        loading: false,
        suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
        error: data?.suggestions?.length ? null : "No confident matches found.",
      }));
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Lookup failed" }));
    }
  };

  const accept = async () => {
    if (!suggestion || state.saving) return;
    setState(prev => ({ ...prev, saving: true, error: null, saved: null }));
    try {
      const res = await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "queue-entry-add",
          itemId: `${queue.id}:${suggestion.title}`,
          payload: { queueId: queue.id, queueKind: queue.kind, queueLabel: queue.label, suggestion, rawQuery: state.query.trim() },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Accept failed");
      setState(prev => ({ ...prev, saving: false, saved: data?.receipt || "Accepted. Dashboard refresh queued." }));
    } catch (err) {
      setState(prev => ({ ...prev, saving: false, error: err instanceof Error ? err.message : "Accept failed" }));
    }
  };

  return (
    <div className="queueAddBox">
      <div className="queueAddInputRow">
        <input
          className="queueAddInput"
          value={state.query}
          onChange={event => setState(prev => ({ ...prev, query: event.target.value, saved: null }))}
          onKeyDown={event => { if (event.key === "Enter") lookup(); }}
          placeholder={`Add a ${queue.kind.slice(0, -1)}...`}
          aria-label={`Look up a ${queue.kind.slice(0, -1)} for ${queue.label}`}
        />
        <button className="queueAddButton" type="button" onClick={lookup} disabled={!canSearch}>
          {state.loading ? "Looking..." : "AI lookup"}
        </button>
      </div>

      {suggestion && (
        <div className="queueSuggestion">
          <div className="queueSuggestionTop">
            <span>{suggestion.confidence} confidence</span>
            {hasNext && (
              <button
                className="queueGhostButton"
                type="button"
                onClick={() => setState(prev => ({ ...prev, index: (prev.index + 1) % prev.suggestions.length, saved: null }))}
              >
                Next suggestion
              </button>
            )}
          </div>
          <strong>{suggestion.title}{suggestion.year ? ` (${suggestion.year})` : ""}</strong>
          <em>{suggestion.creator}</em>
          <p>{suggestion.why}</p>
          <div className="queueSuggestionMeta">
            <span>{suggestion.priority}</span>
            {suggestion.sourceLabel && <span>{suggestion.sourceLabel}</span>}
            {suggestion.link && <a href={suggestion.link} target="_blank" rel="noreferrer">Source</a>}
          </div>
          {suggestion.notes && <p className="queueSuggestionNotes">{suggestion.notes}</p>}
          <button className="queueAcceptButton" type="button" onClick={accept} disabled={state.saving}>
            {state.saving ? "Accepting..." : "Accept into queue"}
          </button>
        </div>
      )}

      {state.error && <div className="queueAddReceipt queueAddReceipt--error">{state.error}</div>}
      {state.saved && <div className="queueAddReceipt queueAddReceipt--success">{state.saved}</div>}
    </div>
  );
}

export default function QueuesTab({ queues, onDiscuss }: Props) {
  const totalItems = queues.reduce((sum, queue) => sum + queue.items.length, 0);
  const totalClarify = queues.reduce((sum, queue) => sum + queue.needsClarification.length, 0);
  const addableCount = useMemo(() => queues.filter(queue => ADDABLE_QUEUE_KINDS.has(queue.kind)).length, [queues]);

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
          <span><strong>{addableCount}</strong> quick-add</span>
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

            {ADDABLE_QUEUE_KINDS.has(queue.kind) && <QueueAddBox queue={queue} />}

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

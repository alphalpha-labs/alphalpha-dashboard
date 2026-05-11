// Shared types — imported by both client components and the API route.

export type StoredMessage = { role: "assistant" | "user"; content: string };

export type StoredThread = {
  id:        string;
  itemId:    string;
  itemTitle: string;
  itemType:  string;
  messages:  StoredMessage[];
  startedAt: number;
  updatedAt: number;
};

export function newThreadId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Client-side API wrappers ────────────────────────────────────────────────

export async function getThreadsForItem(itemId: string): Promise<StoredThread[]> {
  try {
    const res = await fetch(`/api/threads?itemId=${encodeURIComponent(itemId)}`);
    if (!res.ok) return [];
    const { threads } = await res.json();
    return threads ?? [];
  } catch {
    return [];
  }
}

export async function upsertThread(thread: StoredThread): Promise<void> {
  await fetch("/api/threads", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(thread),
  }).catch(() => {});
}

export async function deleteThread(threadId: string, itemId: string): Promise<void> {
  await fetch(
    `/api/threads?id=${encodeURIComponent(threadId)}&itemId=${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  ).catch(() => {});
}

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

const STORAGE_KEY = "alphalpha-chat-history";

function load(): StoredThread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(threads: StoredThread[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function getThreadsForItem(itemId: string): StoredThread[] {
  return load()
    .filter(t => t.itemId === itemId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function upsertThread(thread: StoredThread): void {
  const all      = load();
  const existing = all.find(t => t.id === thread.id);
  // Always preserve the original startedAt
  const record   = existing ? { ...thread, startedAt: existing.startedAt } : thread;
  persist([...all.filter(t => t.id !== thread.id), record]);
}

export function deleteThread(threadId: string): void {
  persist(load().filter(t => t.id !== threadId));
}

export function newThreadId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

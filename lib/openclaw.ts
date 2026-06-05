// Server-only. Never import from client components.

const BASE_URL      = process.env.OPENCLAW_BASE_URL      ?? '';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';
const SIGNAL_URL    = process.env.OPENCLAW_SIGNAL_URL    ?? '';
const HOOK_TOKEN    = process.env.OPENCLAW_HOOK_TOKEN    ?? '';


function assertEnv(name: string, val: string): string {
  if (!val) throw new Error(`${name} env var is not set`);
  return val;
}

export type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * Forward a thread conversation to OpenClaw /v1/responses with stream: true.
 * Returns the raw fetch Response so the caller can proxy the SSE body.
 */
export async function streamThread(
  threadType:   string,
  threadId:     string,
  systemPrompt: string,
  messages:     Msg[],
  model:        string,
): Promise<Response> {
  const baseUrl = assertEnv('OPENCLAW_BASE_URL', BASE_URL);
  const token   = assertEnv('OPENCLAW_GATEWAY_TOKEN', GATEWAY_TOKEN);

  const input = messages.map(m => ({
    type:    'message',
    role:    m.role,
    content: m.content,
  }));

  return fetch(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input,
      stream: true,
      // Stable session key per dashboard item — lets OpenClaw route consistently.
      user: `dashboard:thread:${threadType}:${threadId}`,
    }),
  });
}

export async function completeJson(
  instructions: string,
  prompt: string,
  user: string,
  opts: { model?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const baseUrl = assertEnv('OPENCLAW_BASE_URL', BASE_URL);
  const token   = assertEnv('OPENCLAW_GATEWAY_TOKEN', GATEWAY_TOKEN);

  const res = await fetch(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    body: JSON.stringify({
      model: opts.model ?? 'openclaw',
      instructions,
      input: [{ type: 'message', role: 'user', content: prompt }],
      stream: false,
      user,
    }),
  });

  if (!res.ok) throw new Error(`OpenClaw ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  const raw = responseText(data);
  const parsed = parseJsonLoose(raw);
  if (!parsed) throw new Error('OpenClaw returned non-JSON output');
  return parsed;
}

/**
 * Forward an action signal to the configured OpenClaw signal hook URL.
 */
export async function sendSignal(
  type:    string,
  itemId:  string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const signalUrl = assertEnv('OPENCLAW_SIGNAL_URL', SIGNAL_URL);
  const token     = assertEnv('OPENCLAW_HOOK_TOKEN',  HOOK_TOKEN);

  return fetch(signalUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ type, itemId, payload }),
  });
}

function responseText(data: unknown): string {
  const d = data as { output?: Array<{ content?: Array<{ text?: string }> }>; output_text?: string; content?: Array<{ text?: string }> };
  if (Array.isArray(d.output)) {
    for (const item of d.output) {
      const part = item?.content?.find?.(c => typeof c?.text === 'string');
      if (part?.text) return part.text;
    }
  }
  return d.output_text ?? d.content?.[0]?.text ?? '';
}

function parseJsonLoose(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const match = body.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

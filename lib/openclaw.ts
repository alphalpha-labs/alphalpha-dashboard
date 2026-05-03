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
  threadType: string,
  threadId:   string,
  systemPrompt: string,
  messages:   Msg[],
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
      instructions: systemPrompt,
      input,
      stream: true,
      // Stable session key per dashboard item — lets OpenClaw route consistently.
      user: `dashboard:thread:${threadType}:${threadId}`,
    }),
  });
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

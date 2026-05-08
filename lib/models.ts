export type Model = { id: string; label: string };

export const MODELS: Model[] = [
  { id: "openclaw",         label: "OpenClaw (default)" },
  { id: "openclaw/alphalpha", label: "OpenClaw · Alphalpha" },
];

export const DEFAULT_MODEL = MODELS[0].id;

export type Model = { id: string; label: string };

export const MODELS: Model[] = [
  { id: "openai-codex/gpt-5.5", label: "GPT-5.5"  },
  { id: "openai-codex/gpt-4.1", label: "GPT-4.1"  },
  { id: "openai-codex/gpt-4o",  label: "GPT-4o"   },
];

export const DEFAULT_MODEL = MODELS[0].id;

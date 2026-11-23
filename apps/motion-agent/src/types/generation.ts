export const MODELS = [
  { id: "gpt-6.1-sol:none", name: "GPT-6.1 Sol (No Reasoning)" },
  { id: "gpt-6.1-sol:low", name: "GPT-6.1 Sol (Low Reasoning)" },
  { id: "gpt-6.1-sol:medium", name: "GPT-6.1 Sol (Medium Reasoning)" },
  { id: "gpt-6.1-sol:high", name: "GPT-6.1 Sol (High Reasoning)" },
  { id: "gpt-6-luna:low", name: "GPT-6 Luna (Fast)" },
  { id: "gpt-6-astra:high", name: "GPT-6 Astra (High)" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";

import type { StepProgress } from "../types.js";

export type ProgressHook = (p: StepProgress) => Promise<void>;

export async function step(on?: ProgressHook, payload?: StepProgress) {
  if (on && payload) await on(payload);
}

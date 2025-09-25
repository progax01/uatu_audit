export type SOPName = string;

export interface SOPInputs {
  [key: string]: unknown;
}

export interface SOPResult {
  [key: string]: unknown;
}

export interface StepProgress {
  phase: string; // e.g., "bootstrap"
  step: string; // e.g., "pattern-matching"
  pct: number; // 0-100
  note?: string; // brief message
}

export interface SOP {
  name: SOPName;
  version: string;
  prerequisites: SOPName[];
  validateInputs(i: SOPInputs): Promise<boolean>;
  execute(
    i: SOPInputs,
    onProgress?: (p: StepProgress) => Promise<void>
  ): Promise<SOPResult>;
  verifyOutputs(r: SOPResult): Promise<boolean>;
}

// Progress model types - these are now defined in progressService.ts
// Keeping minimal types here for backward compatibility



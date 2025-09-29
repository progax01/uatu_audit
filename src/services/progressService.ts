import path from "node:path";
import fs from "fs-extra";

export type PhaseName = "bootstrap" | "inventory" | "analysis" | "testgen" | "execute";
export const PHASE_WEIGHTS: Record<PhaseName, number> = {
  bootstrap: 10, inventory: 20, analysis: 35, testgen: 15, execute: 20
};

export type PhaseProgress = { name: PhaseName; pct: number; step?: string };
export type RunProgress = {
  project: string;
  branch: string;
  timestamp: string;
  overall_pct: number;
  phases: PhaseProgress[];
  last_event?: string;
};

async function atomicWrite(file: string, data: unknown, maxRetries: number = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure directory exists before each attempt
      await fs.ensureDir(path.dirname(file));

      const tmp = `${file}.tmp`;

      // Clean up any existing temp files first
      try {
        await fs.remove(tmp);
      } catch {
        // Ignore cleanup errors
      }

      // Write to temp file
      await fs.writeJson(tmp, data, { spaces: 2 });

      // Verify temp file exists before rename
      if (!(await fs.pathExists(tmp))) {
        throw new Error('Temp file creation failed');
      }

      // Ensure directory still exists (race condition protection)
      await fs.ensureDir(path.dirname(file));

      // Atomic rename
      await fs.move(tmp, file, { overwrite: true });

      // Verify final file exists
      if (!(await fs.pathExists(file))) {
        throw new Error('Final file creation failed');
      }

      return; // Success - exit retry loop

    } catch (error: any) {
      lastError = error;

      // Clean up temp file on error
      try {
        await fs.remove(`${file}.tmp`);
      } catch {
        // Ignore cleanup errors
      }

      if (attempt < maxRetries && (error.code === 'ENOENT' || error.code === 'EEXIST')) {
        // Wait before retry for filesystem race conditions
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        continue;
      } else {
        // Log error details
        console.error('atomicWrite failed after retries:', {
          file,
          tmpFile: `${file}.tmp`,
          error: error.message,
          code: error.code,
          errno: error.errno,
          attempt,
          maxRetries
        });
        break;
      }
    }
  }

  throw lastError || new Error('atomicWrite failed with unknown error');
}

export function newProgress(project: string, branch: string, timestamp: string): RunProgress {
  return {
    project, branch, timestamp,
    overall_pct: 0,
    phases: [
      { name: "bootstrap", pct: 0 },
      { name: "inventory", pct: 0 },
      { name: "analysis", pct: 0 },
      { name: "testgen", pct: 0 },
      { name: "execute", pct: 0 }
    ]
  };
}

function recomputeOverall(phases: PhaseProgress[]): number {
  let sum = 0;
  for (const ph of phases) sum += (PHASE_WEIGHTS[ph.name] * Math.min(100, Math.max(0, ph.pct))) / 100;
  return Math.round(sum);
}

export async function loadProgress(runPath: string): Promise<RunProgress | null> {
  const f = path.join(runPath, "progress.json");
  if (!(await fs.pathExists(f))) return null;
  return fs.readJson(f);
}

export async function saveProgress(runPath: string, p: RunProgress) {
  p.overall_pct = recomputeOverall(p.phases);
  p.last_event = p.last_event || undefined;
  await atomicWrite(path.join(runPath, "progress.json"), p);
  return p;
}

export async function setPhasePct(runPath: string, phase: PhaseName, pct: number, stepLabel?: string) {
  const p = (await loadProgress(runPath))!;
  const idx = p.phases.findIndex(x => x.name === phase);
  if (idx >= 0) { p.phases[idx].pct = pct; p.phases[idx].step = stepLabel || p.phases[idx].step; }
  p.last_event = stepLabel ? `${phase}: ${stepLabel} (${pct}%)` : p.last_event;
  return saveProgress(runPath, p);
}

export async function bumpPhase(runPath: string, phase: PhaseName, deltaPct: number, stepLabel?: string) {
  const p = (await loadProgress(runPath))!;
  const idx = p.phases.findIndex(x => x.name === phase);
  if (idx >= 0) { p.phases[idx].pct = Math.min(100, p.phases[idx].pct + deltaPct); p.phases[idx].step = stepLabel || p.phases[idx].step; }
  p.last_event = stepLabel ? `${phase}: ${stepLabel} (${p.phases[idx].pct}%)` : p.last_event;
  return saveProgress(runPath, p);
}



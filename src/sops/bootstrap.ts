import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";

export const bootstrapSOP: SOP = {
  name: "bootstrap",
  version: "1.0.1",
  prerequisites: [],
  async validateInputs(i) { return !!(i.projectPath && i.contextPath); },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); const errors: string[] = [];

    await step(onProgress, { phase: "bootstrap", step: "project-detection", pct: 25 });
    // Mock ecosystem detection - in real implementation, this would analyze the project
    const fingerprint = { ecosystems: ["solidity-foundry"] };

    await step(onProgress, { phase: "bootstrap", step: "dependency-fingerprint", pct: 50 });
    // Mock context building - in real implementation, this would build the .uatu/context
    await fs.ensureDir(i.contextPath as string);

    await step(onProgress, { phase: "bootstrap", step: "context-built", pct: 90 });
    await fs.ensureDir(path.join(i.projectPath as string, ".uatu", "sop"));
    await fs.writeFile(path.join(i.projectPath as string, ".uatu", "sop", "done.marker"), "bootstrap\n");

    await step(onProgress, { phase: "bootstrap", step: "ready-marked", pct: 100 });
    const outputs = { ready: fingerprint.ecosystems.length > 0, fingerprint };
    return { ok: true, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return !!(r.outputs && (r.outputs as any).fingerprint); }
};

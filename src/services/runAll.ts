import path from "node:path";
import fs from "fs-extra";
import { cloneOrRefresh } from "./gitService.js";
import { resolveWorkspace } from "./workspaceService.js";
import { bootstrapSOP } from "../sops/bootstrap.js";
import { inventorySOP } from "../sops/inventory.js";
import { analysisSOP } from "../sops/analysis.js";
import { testgenSOP } from "../sops/testgen.js";
import { executeSOP } from "../sops/execute.js";
import { writePdfReport } from "./report/pdfReport.js";
import { writeSarif } from "./report/sarif.js";
import { loadConfig } from "./configService.js";
import { newProgress, saveProgress, setPhasePct } from "./progressService.js";
import type { ProgressHook } from "../utils/stepHelper.js";
import { attachRunTimestamp, updateJobNote, updateJobPct } from "./jobQueue.js";

export async function runAll(params: {
  repo: string; project: string; branch: string; ai?: boolean; jobId?: number;
}) {
  const { project, branch, repo, ai, jobId } = params;
  const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(project, branch);
  await cloneOrRefresh(repo, branchPath, branch);

  const timestamp = Date.now().toString();
  const runPath = path.join(runsPath, timestamp);
  await fs.ensureDir(runPath);

  // init progress
  await saveProgress(runPath, newProgress(project, branch, timestamp));
  if (jobId) await attachRunTimestamp(jobId, timestamp);

  const onProgress: ProgressHook = async ({ phase, step, pct }: { phase: any, step: any, pct: any }) => {
    await setPhasePct(runPath, phase, pct, step);
    const curr = await fs.readJson(path.join(runPath, "progress.json"));
    if (jobId) {
      await updateJobPct(jobId, curr.overall_pct);
      if (step) await updateJobNote(jobId, `${phase}: ${step}`);
    }
  };

  // SOP order
  await bootstrapSOP.execute({ projectPath: branchPath, contextPath, runsPath, timestamp, ai: !!ai }, onProgress);
  await inventorySOP.execute({ projectPath: branchPath, contextPath, runsPath, timestamp, ai: !!ai }, onProgress);
  await analysisSOP.execute({ projectPath: branchPath, contextPath, runsPath, timestamp, ai: !!ai }, onProgress);
  const cfg = await loadConfig(branchPath);
  const aiFlag = typeof ai === "boolean" ? ai : !!cfg.ai;
  await testgenSOP.execute({ projectPath: branchPath, contextPath, runsPath, timestamp, ai: aiFlag }, onProgress);
  await executeSOP.execute({ projectPath: branchPath, contextPath, runsPath, timestamp, ai: aiFlag }, onProgress);

  // report
  const analysis = await fs.readJson(path.join(runPath, "analysis.json")).catch(() => ({ findings: [] }));
  await writeSarif(runPath, analysis.findings || []);
  const bootstrap = await fs.readJson(path.join(branchPath, ".uatu", "sop", "bootstrap.status.json")).catch(() => null);
  const execStatus = await fs.readJson(path.join(branchPath, ".uatu", "sop", "execute.status.json")).catch(() => null);
  const coveragePct = execStatus?.outputs?.coverage;
  const pdfPath = await writePdfReport(runPath, {
    project, branch, timestamp,
    ecosystemSummary: (bootstrap?.outputs?.fingerprint?.ecosystems ?? []) as string[],
    findings: analysis.findings ?? [],
    coverage: typeof coveragePct === "number" ? coveragePct/100 : undefined
  });

  return { pdfPath, timestamp, runPath };
}

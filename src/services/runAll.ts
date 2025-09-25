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
import { writeHtmlReport } from "./report/htmlReport.js";
import { writeSarif } from "./report/sarif.js";
import { loadConfig } from "./configService.js";
import { withRetry, withTimeout } from "../utils/retry.js";
import { createJobLogger } from "../utils/logger.js";
import { newProgress, saveProgress, setPhasePct } from "./progressService.js";
import type { ProgressHook } from "../utils/stepHelper.js";
import { attachRunTimestamp, updateJobNote, updateJobPct } from "./jobQueue.js";

export async function runAll(params: {
  repo: string; project: string; branch: string; ai?: boolean; jobId?: number;
}) {
  const { project, branch, repo, ai, jobId } = params;
  const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(project, branch);
  
  const log = createJobLogger(jobId, project, branch);
  log.info('Starting runAll pipeline');
  
  await withRetry(() => cloneOrRefresh(repo, branchPath, branch));

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

  // SOP order with retries and timeouts
  const cfg = await loadConfig(branchPath);
  const aiFlag = typeof ai === "boolean" ? ai : !!cfg.ai;
  const sopInputs = { projectPath: branchPath, contextPath, runsPath, timestamp, ai: aiFlag };
  
  log.info('Executing bootstrap SOP');
  await withRetry(() => withTimeout(() => 
    bootstrapSOP.execute(sopInputs, onProgress), 
    5 * 60 * 1000, 'Bootstrap SOP timed out'
  ));
  
  log.info('Executing inventory SOP');
  await withRetry(() => withTimeout(() => 
    inventorySOP.execute(sopInputs, onProgress), 
    10 * 60 * 1000, 'Inventory SOP timed out'
  ));
  
  log.info('Executing analysis SOP');
  const analysisResult = await withRetry(() => withTimeout(() => 
    analysisSOP.execute(sopInputs, onProgress), 
    15 * 60 * 1000, 'Analysis SOP timed out'
  ));
  
  log.info('Executing testgen SOP');
  await withRetry(() => withTimeout(() => 
    testgenSOP.execute(sopInputs, onProgress), 
    10 * 60 * 1000, 'Testgen SOP timed out'
  ));
  
  log.info('Executing execute SOP');
  const executeResult = await withRetry(() => withTimeout(() => 
    executeSOP.execute(sopInputs, onProgress), 
    20 * 60 * 1000, 'Execute SOP timed out'
  ));

  // report generation
  log.info('Generating reports');
  const analysis = await fs.readJson(path.join(runPath, "analysis.json")).catch(() => ({ findings: [] }));
  await writeSarif(runPath, analysis.findings || []);
  
  const bootstrap = await fs.readJson(path.join(branchPath, ".uatu", "sop", "bootstrap.status.json")).catch(() => null);
  const execStatus = await fs.readJson(path.join(branchPath, ".uatu", "sop", "execute.status.json")).catch(() => null);
  const coveragePct = execStatus?.outputs?.coverage;

  const reportData = {
    project, 
    branch, 
    timestamp,
    ecosystemSummary: (bootstrap?.outputs?.fingerprint?.ecosystems ?? []) as string[],
    findings: analysis.findings ?? [],
    coverage: typeof coveragePct === "number" ? coveragePct/100 : undefined
  };

  // Generate both HTML and PDF reports
  const htmlPath = await writeHtmlReport(runPath, reportData);
  const pdfPath = await writePdfReport(runPath, reportData);

  log.info('Reports generated successfully', { htmlPath, pdfPath });

  return { pdfPath, htmlPath, timestamp, runPath };
}

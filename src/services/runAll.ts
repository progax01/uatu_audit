import path from "node:path";
import fs from "fs-extra";
import { cloneOrRefresh, getCommitHash } from "./gitService.js";
import { resolveWorkspace } from "./workspaceService.js";
import { bootstrapSOP } from "../sops/bootstrap.js";
import { singlePromptAuditSOP } from "../sops/singlePromptAudit.js";
import { executeParallelAudit } from "../sops/parallelAuditExecutor.js";
import { MilestoneExecutor } from "../sops/milestoneExecutor.js";
import { writeFilesStructure, writeTestRequirements, writeMilestones, initResultsJson } from "./contextWriter.js";
import { generateReportFromResults, generateCertificateFromResults } from "./report/simpleReportGenerator.js";
import { generatePdfFromHtml } from "./pdfGenerator.js";
import { loadConfig } from "./configService.js";
import { withRetry, withTimeout } from "../utils/retry.js";
import { createJobLogger } from "../utils/logger.js";
import { ensureClaudeReady } from "../utils/claudeHealthCheck.js";
import { createJobLogger as createJobFileLogger, closeJobLogger } from "./jobLogger.js";
import { newProgress, saveProgress, setPhasePct } from "./progressService.js";
import type { ProgressHook } from "../utils/stepHelper.js";
import { loadLiabilityMap } from "./liabilityMap.js";
import { calculateWeightedScore, type FindingLike } from "./scoringService.js";
import { runDeterministicScanners } from "./scannerRunner.js";
import { generateLiabilityQuestionsFromEvidence, loadConversationState } from "../ai/conversationManager.js";
import {
  checkCancellation as checkJobCancellation,
  attachRunTimestamp,
  updateJobPct,
  updateJobNote,
  updateJobPreAuditStatus,
  getJob,
} from "./jobQueue.js";
import { runPreAuditScan, savePreAuditEvidence, loadPreAuditEvidence } from "./preAuditScanService.js";
import { createQuestionnaire, saveQuestionnaire, loadQuestionnaire } from "./preAuditQuestionGenerator.js";
import type { ComponentFingerprint } from "../types/project.js";

// Helper to check cancellation and throw if cancelled
function checkCancellation(jobId: number | undefined) {
  if (jobId) {
    checkJobCancellation(jobId);
  }
}

/**
 * Simplified 3-Phase Audit Pipeline
 *
 * Phase 1: Context Preparation (Clone + Bootstrap + Write Context Files)
 * Phase 2: Single Claude CLI Audit (One mega-prompt does everything)
 * Phase 3: Report Generation (results.json → HTML/PDF)
 */
export async function runAll(params: {
  repo: string;
  project: string;
  branch: string;
  ai?: boolean;
  testStyles?: string[];
  jobId?: number;
  accessToken?: string;
  selectedFiles?: string[];
}) {
  const { project, branch, repo, ai, testStyles, jobId, accessToken, selectedFiles } = params;
  const { branchPath, contextPath, sopPath, runsPath } = await resolveWorkspace(project, branch);

  const log = createJobLogger(jobId, project, branch);
  log.info("Starting simplified 3-phase audit pipeline", { project, branch, repo, ai, testStyles });

  // ============================================================
  // PHASE 1: Context Preparation
  // ============================================================
  log.info("=== PHASE 1: Context Preparation ===");

  // Step 1.1: Clone/Refresh Repository
  log.info("Step 1.1: Cloning/refreshing repository");
  checkCancellation(jobId);
  await withRetry(() => cloneOrRefresh(repo, branchPath, branch, accessToken));
  log.info("Step 1.1: Repository ready");

  // Step 1.2: Create run directory
  const timestamp = Date.now().toString();
  const runPath = path.join(runsPath, timestamp);
  log.info("Step 1.2: Creating run directory", { runPath, timestamp });
  await fs.ensureDir(runPath);
  await new Promise(resolve => setTimeout(resolve, 100));

  // Create job-specific file logger for UI streaming
  const jobFileLog = createJobFileLogger(runPath);
  jobFileLog.info("Job started", { project, branch, repo, jobId, timestamp });

  // Step 1.3: Initialize progress tracking
  log.info("Step 1.3: Initializing progress tracking");
  jobFileLog.info("Initializing progress tracking");
  await saveProgress(runPath, newProgress(project, branch, timestamp));
  if (jobId) {
    await attachRunTimestamp(jobId, timestamp);
    log.info("Step 1.3: Progress initialized", { jobId, timestamp });
  }

  const onProgress: ProgressHook = async ({ phase, step, pct }: { phase: any; step: any; pct: any }) => {
    await setPhasePct(runPath, phase, pct, step);
    try {
      const curr = await fs.readJson(path.join(runPath, "progress.json"));
      jobFileLog.info(`Progress: ${phase}`, { step, pct, overall: curr.overall_pct });
      if (jobId) {
        await updateJobPct(jobId, curr.overall_pct);
        if (step) await updateJobNote(jobId, `${phase}: ${step}`);
      }
    } catch (error: any) {
      // Progress file might not exist yet or be in the middle of atomic write
      jobFileLog.info(`Progress: ${phase}`, { step, pct, note: 'progress file not ready' });
    }
  };

  // Step 1.4: Run Bootstrap SOP (project structure analysis)
  log.info("Step 1.4: Running Bootstrap SOP");
  checkCancellation(jobId);
  const sopInputs = {
    projectPath: branchPath,
    contextPath,
    runsPath,
    timestamp,
    ai: ai ?? true,
    testStyles: (testStyles || ["behavioral", "stride"]) as ("behavioral" | "stride" | "owasp")[],
    jobId
  };

  await withRetry(() =>
    withTimeout(
      () => bootstrapSOP.execute(sopInputs, onProgress),
      5 * 60 * 1000,
      "Bootstrap SOP timed out"
    )
  );
  log.info("Step 1.4: Bootstrap SOP completed");

  // Step 1.5: Write context files for single-prompt audit
  log.info("Step 1.5: Writing context files");
  checkCancellation(jobId);

  const contextWriterOptions = {
    projectPath: branchPath,
    contextPath,
    selectedFiles,
    testStyles: (testStyles || ["behavioral", "stride"]) as ("behavioral" | "stride" | "owasp")[],
    repo,
    branch
  };

  await writeFilesStructure(contextWriterOptions);
  log.info("Step 1.5a: files_structure.md written");

  await writeTestRequirements(contextWriterOptions);
  log.info("Step 1.5b: test_requirements.md written");

  await writeMilestones(contextPath, "NOT_STARTED");
  log.info("Step 1.5c: milestones.md written");

  // Get commit hash for metadata
  const commitHash = await getCommitHash(branchPath);
  log.info("Step 1.5d: Got commit hash", { commitHash });

  await initResultsJson(contextPath, repo, branch, commitHash || undefined);
  log.info("Step 1.5e: results.json initialized", { repo, branch, commitHash });

  await onProgress({ phase: "context", step: "context-ready", pct: 100 });
  log.info("=== PHASE 1 COMPLETE ===");

  // ============================================================
  // PHASE 1.5: Pre-Audit Questionnaire (Interactive Human-in-the-Loop)
  // ============================================================
  log.info("=== PHASE 1.5: Pre-Audit Questionnaire ===");
  checkCancellation(jobId);

  // Check if pre-audit was already completed or skipped
  const existingQuestionnaire = await loadQuestionnaire(contextPath);
  const job = jobId ? await getJob(jobId) : null;
  const preAuditStatus = job?.preAuditStatus;

  if (preAuditStatus === 'completed' || preAuditStatus === 'skipped') {
    log.info("Pre-audit questionnaire already processed", { status: preAuditStatus });
  } else if (existingQuestionnaire?.status === 'COMPLETED' || existingQuestionnaire?.status === 'SKIPPED') {
    log.info("Pre-audit questionnaire already completed", { status: existingQuestionnaire.status });
  } else {
    // Run deterministic scanners for evidence collection
    log.info("Step 1.5a: Running deterministic scanners...");
    const toolLogs = await runDeterministicScanners(branchPath);
    log.info("Scanners completed", { logLength: toolLogs.length });

    // Create fingerprint from project structure
    const projectStructure = await fs.readJson(path.join(contextPath, "project-structure.json")).catch(() => null);
    const fingerprint: ComponentFingerprint = {
      ecosystems: projectStructure?.ecosystems?.map((e: string) => ({ name: e, confidence: 0.9 })) || [],
      stats: {
        totalFiles: projectStructure?.stats?.totalFiles || 0,
        totalLines: projectStructure?.stats?.totalLines || 0,
        solidityFiles: projectStructure?.stats?.solidityFiles || 0,
        rustFiles: projectStructure?.stats?.rustFiles || 0,
        typescriptFiles: projectStructure?.stats?.typescriptFiles || 0,
        javascriptFiles: projectStructure?.stats?.javascriptFiles || 0,
        testFiles: projectStructure?.stats?.testFiles || 0,
      },
      dependencies: projectStructure?.dependencies || [],
      contracts: projectStructure?.mainContracts?.map((c: any) => ({
        name: c.name,
        file: c.path,
        isInterface: c.name?.startsWith('I') || false,
        isLibrary: c.name?.includes('Lib') || false,
        isAbstract: false,
      })) || [],
      contentHash: Date.now().toString(),
      fingerprintedAt: new Date().toISOString(),
    };

    // Run pre-audit scan to collect evidence
    log.info("Step 1.5b: Running pre-audit evidence scan...");
    const evidence = await runPreAuditScan(branchPath, fingerprint);
    await savePreAuditEvidence(contextPath, evidence);
    log.info("Pre-audit evidence collected", {
      riskHotspots: evidence.riskHotspots.length,
      adminPatterns: evidence.detectedPatterns.adminPatterns.length,
      oracleUsage: evidence.detectedPatterns.oracleUsage.length,
    });

    // Generate questionnaire from evidence
    log.info("Step 1.5c: Generating pre-audit questionnaire...");
    const componentId = job?.componentId || 'main';
    const questionnaire = createQuestionnaire(project, evidence, componentId);
    await saveQuestionnaire(contextPath, questionnaire);
    log.info("Pre-audit questionnaire generated", {
      questionCount: questionnaire.questions.length,
      status: questionnaire.status,
    });

    // If there are questions, pause for user input (unless skipPreAudit is set)
    const skipPreAudit = process.env.SKIP_PREAUDIT === 'true';
    if (questionnaire.questions.length > 0 && !skipPreAudit) {
      log.info("Pausing for pre-audit questionnaire - waiting for user input");
      if (jobId) {
        await updateJobPreAuditStatus(jobId, 'pending', project);
        await updateJobNote(jobId, 'Awaiting pre-audit questionnaire responses');
      }

      // Return early - the job will be resumed when user submits answers
      // The worker will pick it up again when status changes from 'awaiting-preaudit'
      log.info("=== JOB PAUSED FOR PRE-AUDIT QUESTIONNAIRE ===");
      await onProgress({ phase: "preaudit", step: "awaiting-user-input", pct: 50 });

      return {
        status: 'awaiting-preaudit',
        message: 'Pre-audit questionnaire generated, awaiting user responses',
        questionCount: questionnaire.questions.length,
        timestamp,
        runPath: path.join(runsPath, timestamp),
      };
    } else {
      // No questions or skipping pre-audit
      log.info("Pre-audit questionnaire skipped or no questions generated");
      if (jobId) {
        await updateJobPreAuditStatus(jobId, 'skipped');
      }
      questionnaire.status = 'SKIPPED';
      await saveQuestionnaire(contextPath, questionnaire);
    }
  }

  await onProgress({ phase: "preaudit", step: "preaudit-complete", pct: 100 });
  log.info("=== PHASE 1.5 COMPLETE ===");

  // ============================================================
  // PHASE 2: Single Claude CLI Audit
  // ============================================================
  log.info("=== PHASE 2: Single Claude CLI Audit ===");
  checkCancellation(jobId);

  // Run deterministic scanners (may already have run in pre-audit, but idempotent)
  log.info("Running deterministic scanners...");
  const toolLogs = await runDeterministicScanners(branchPath);
  log.info("Scanners completed", { logLength: toolLogs.length });

  // Legacy triage phase (kept for backward compatibility)
  const existingLiabilityMap = await loadLiabilityMap(contextPath);
  const conversation = await loadConversationState(contextPath);

  if (!existingLiabilityMap && !conversation) {
    log.info("No liability map found, generating from evidence...");
    await generateLiabilityQuestionsFromEvidence({
      contextPath,
      repo,
      branch,
      evidenceSummary: toolLogs,
      jobId
    });
    log.info("Liability questions generated in intent_map.json");
  }

  // Health check: Ensure Claude CLI is ready before starting audit
  log.info("Performing Claude CLI health check...");
  try {
    await ensureClaudeReady();
    log.info("Claude CLI health check passed - ready for audit");
  } catch (healthError: any) {
    log.error("Claude CLI health check failed", { error: healthError.message });
    throw healthError; // This will fail the job with a clear error message
  }

  // Calculate timeout based on project size
  const projectStructurePath = path.join(contextPath, "project-structure.json");
  const projectStructure = await fs.readJson(projectStructurePath).catch(() => ({ mainContracts: [] }));
  const contractCount = projectStructure.mainContracts?.length || 5;
  const auditTimeoutMs = Math.max(30 * 60 * 1000, contractCount * 6 * 60 * 1000); // 30 min base + 6 min per contract

  // Calculate dynamic session timeout based on contract count
  // Base: 15 minutes minimum, plus 30 seconds per contract
  const baseSessionTimeoutMin = 15;
  const timePerContractMin = 0.5; // 30 seconds per contract
  const sessionTimeoutMin = Math.max(
    baseSessionTimeoutMin,
    Math.ceil(contractCount * timePerContractMin)
  );
  const sessionTimeoutMs = sessionTimeoutMin * 60 * 1000;

  log.info("Calculated dynamic session timeout", {
    contractCount,
    baseTimeoutMin: baseSessionTimeoutMin,
    sessionTimeoutMin,
    sessionTimeoutMs,
    formula: `max(${baseSessionTimeoutMin}, ${contractCount} × ${timePerContractMin})`
  });

  // Check if milestone-based Deep Intelligence Framework is enabled
  const enableMilestoneFramework = process.env.ENABLE_MILESTONE_FRAMEWORK === "true";
  const enableDetailedAudit = process.env.ENABLE_DETAILED_AUDIT === "true";

  if (enableMilestoneFramework) {
    log.info("Step 2.1: Starting Deep Intelligence Framework (5-Milestone Pipeline)", {
      contractCount,
      overallTimeoutMinutes: Math.round(auditTimeoutMs / 60000),
      mode: "MILESTONE_FRAMEWORK"
    });

    // Load project context (flattened source code)
    log.info("\n📂 Loading project context (flattened source code)...");
    const filesStructurePath = path.join(contextPath, "files_structure.md");
    log.info(`   Context path: ${filesStructurePath}`);
    let projectContext: string | undefined;

    try {
      if (await fs.pathExists(filesStructurePath)) {
        log.info(`   ✓ File exists, reading...`);
        projectContext = await fs.readFile(filesStructurePath, 'utf-8');
        log.info(`   ✅ Loaded project context: ${projectContext.length} chars`);

        // Log first 200 chars as preview
        const preview = projectContext.substring(0, 200).replace(/\n/g, ' ');
        log.info(`   Preview: ${preview}...`);
      } else {
        log.warn('   ⚠️  files_structure.md not found, proceeding without project context');
      }
    } catch (error: any) {
      log.warn(`   ❌ Failed to load project context: ${error.message}`);
    }

    // Initialize Milestone Executor
    log.info("\n🎯 Initializing Milestone Executor:");
    log.info(`   Job ID: ${jobId?.toString() || 'unknown'}`);
    log.info(`   Project path: ${branchPath}`);
    log.info(`   Project context: ${projectContext ? `${projectContext.length} chars` : 'none'}`);
    log.info(`   Domain: auto-detect`);
    log.info(`   Audit depth: standard`);

    const milestoneExecutor = new MilestoneExecutor({
      jobId: jobId?.toString() || 'unknown',
      projectPath: branchPath,
      projectContext,
      toolLogs, // Pass scanner evidence
      domain: undefined, // auto-detect
      auditDepth: 'standard'
    });

    log.info(`   ✅ MilestoneExecutor initialized`);

    try {
      // Execute all 5 milestones
      const success = await milestoneExecutor.executeAll();

      if (!success) {
        log.error("Deep Intelligence Framework execution failed");
        throw new Error("Milestone execution failed");
      }

      log.info("Step 2.1: Deep Intelligence Framework completed successfully");

      // Get the final report from Milestone 5 outputs
      const milestone5State = milestoneExecutor.getMilestoneState(5);
      const unifiedReport = milestone5State?.outputs?.audit_report;

      if (unifiedReport) {
        // Write to results.json
        const resultsJsonPath = path.join(contextPath, "results.json");
        const resultsWithMetadata = {
          metadata: {
            repo,
            branch,
            timestamp: new Date().toISOString(),
            duration_seconds: Math.round((Date.now() - parseInt(timestamp)) / 1000),
            status: "completed",
            framework: "deep-intelligence-v1",
            milestones_completed: 5
          },
          ...unifiedReport
        };
        await fs.writeJson(resultsJsonPath, resultsWithMetadata, { spaces: 2 });
        log.info("Step 2.1: Deep Intelligence Framework results written to results.json", {
          score: unifiedReport.score?.value,
          grade: unifiedReport.score?.grade,
          totalFindings: unifiedReport.findings?.summary?.total
        });
      } else {
        log.warn("No unified report found in Milestone 5 outputs");
      }
    } catch (error: any) {
      log.error("Deep Intelligence Framework execution failed", { error: error.message });
      throw error;
    }
  } else if (enableDetailedAudit) {
    log.info("Step 2.1: Starting parallel detailed audit", {
      contractCount,
      overallTimeoutMinutes: Math.round(auditTimeoutMs / 60000),
      sessionTimeoutMinutes: sessionTimeoutMin,
      mode: "DETAILED"
    });

    const parallelResult = await executeParallelAudit({
      projectPath: branchPath,
      contextPath,
      runPath,
      jobId,
      sessionTimeout: sessionTimeoutMs, // Pass dynamic timeout
      onProgress: async (update) => {
        await onProgress({
          phase: "audit",
          step: update.session,
          pct: update.pct
        });
      }
    });

    if (!parallelResult.success) {
      log.warn("Parallel detailed audit had issues", { results: parallelResult.results });
    } else {
      log.info("Step 2.1: Parallel detailed audit completed successfully");
    }

    // Write parallel audit results to results.json with metadata
    const resultsJsonPath = path.join(contextPath, "results.json");
    const resultsWithMetadata = {
      metadata: {
        repo,
        branch,
        timestamp: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - parseInt(timestamp)) / 1000),
        status: "completed"
      },
      ...parallelResult.combined
    };
    await fs.writeJson(resultsJsonPath, resultsWithMetadata, { spaces: 2 });
    log.info("Step 2.1: Parallel audit results written to results.json", {
      score: parallelResult.combined?.score?.value,
      grade: parallelResult.combined?.score?.grade,
      findings: parallelResult.combined?.analysis?.total_findings
    });
  } else {
    log.info("Step 2.1: Starting single-prompt audit", {
      contractCount,
      timeoutMinutes: Math.round(auditTimeoutMs / 60000),
      mode: "BASIC"
    });

    const auditResult = await withRetry(() =>
      withTimeout(
        () => singlePromptAuditSOP.execute(sopInputs, onProgress),
        auditTimeoutMs,
        "Single-prompt audit timed out"
      )
    );

    if (!auditResult.ok) {
      log.warn("Single-prompt audit had issues", { errors: auditResult.errors });
    } else {
      log.info("Step 2.1: Single-prompt audit completed successfully");
    }
  }

  // Mark all audit phases as complete
  await onProgress({ phase: "inventory", step: "inventory-complete", pct: 100 });
  await onProgress({ phase: "analysis", step: "analysis-complete", pct: 100 });
  await onProgress({ phase: "testgen", step: "testgen-complete", pct: 100 });
  log.info("=== PHASE 2 COMPLETE ===");

  // Validate audit results before proceeding to report generation
  log.info("Validating audit results...");
  const resultsPath = path.join(contextPath, "results.json");
  if (!(await fs.pathExists(resultsPath))) {
    throw new Error(
      "Audit phase failed - results.json not created. " +
      "Check audit logs for errors."
    );
  }

  let auditResults = await fs.readJson(resultsPath);

  // Extract findings from various possible locations
  let findings: any[] = [];
  if (auditResults.analysis?.findings && Array.isArray(auditResults.analysis.findings)) {
    findings = auditResults.analysis.findings;
  } else if (auditResults.findings && typeof auditResults.findings === 'object') {
    // Milestone format: findings grouped by severity
    findings = [
      ...(auditResults.findings.critical || []),
      ...(auditResults.findings.high || []),
      ...(auditResults.findings.medium || []),
      ...(auditResults.findings.low || []),
      ...(auditResults.findings.info || [])
    ];
  }

  // Always recalculate score based on actual findings and liability mapping
  const liabilityMap = await loadLiabilityMap(contextPath);
  const normalizedFindings: FindingLike[] = findings.map((f: any) => ({
    id: f.id || f.code || f.slug,
    component_id: f.component_id || f.component || f.location,
    severity: f.severity,
    title: f.title,
    description: f.description,
  }));

  const weightedScoreResult = calculateWeightedScore(normalizedFindings, liabilityMap);
  
  log.info("Score calculated with liability weighting", {
    findingsCount: findings.length,
    calculatedScore: weightedScoreResult.value,
    calculatedGrade: weightedScoreResult.grade,
    breakdown: weightedScoreResult.breakdown,
    originalScore: auditResults.score?.value
  });

  // ALWAYS use the calculated score to ensure consistency
  const originalScore = auditResults.score?.value;
  auditResults.score = weightedScoreResult;

  // Update the results.json with corrected score
  await fs.writeJson(resultsPath, auditResults, { spaces: 2 });
  log.info("Updated results.json with calculated score", {
    originalScore,
    newScore: weightedScoreResult.value,
    newGrade: weightedScoreResult.grade
  });

  log.info("Audit results validated successfully", {
    score: auditResults.score.value,
    grade: auditResults.score.grade,
    findings: findings.length,
    hasMetadata: !!auditResults.metadata
  });

  // ============================================================
  // PHASE 3: Report Generation
  // ============================================================
  log.info("=== PHASE 3: Report Generation ===");
  checkCancellation(jobId);

  // Step 3.1: Generate HTML report from results.json
  log.info("Step 3.1: Generating HTML report");
  let htmlPath: string;

  // Extract score and grade from results.json FIRST (before HTML generation)
  const results = await fs.readJson(path.join(contextPath, "results.json")).catch(() => ({}));
  let score = results.score?.value || 0;
  let grade = results.score?.grade || "F";
  log.info("Extracted score from results.json", { score, grade });

  try {
    // Load logo if available
    let logoDataUri: string | undefined;
    const logoPath = path.join(branchPath, ".uatu", "brand", "logo.png");
    if (await fs.pathExists(logoPath)) {
      const logoBuffer = await fs.readFile(logoPath);
      logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    }

    htmlPath = await generateReportFromResults(contextPath, runPath, logoDataUri);
    log.info("Step 3.1: HTML report generated", { htmlPath });

    // Generate certificate (dark-themed)
    try {
      const certPath = await generateCertificateFromResults(contextPath, runPath);
      log.info("Step 3.1: Certificate generated", { certPath });
    } catch (certError: any) {
      log.warn("Certificate generation failed (non-critical)", { error: String(certError) });
    }

    // Copy results.json to runPath for persistence
    await fs.copy(path.join(contextPath, "results.json"), path.join(runPath, "results.json"));
  } catch (reportError: any) {
    log.error("HTML report generation failed", { error: String(reportError) });

    // Create a minimal report on failure
    htmlPath = path.join(runPath, "report.html");
    await fs.writeFile(
      htmlPath,
      `<!DOCTYPE html><html><head><title>Audit Report</title></head><body>
      <h1>Audit Report</h1>
      <p>Report generation failed: ${reportError.message}</p>
      <p>Check context/results.json for raw data.</p>
      </body></html>`,
      "utf8"
    );
  }

  // Step 3.2: Generate PDF from HTML
  log.info("Step 3.2: Generating PDF report");
  checkCancellation(jobId);
  const pdfPath = path.join(runPath, "report.pdf");
  const pdfResult = await generatePdfFromHtml(htmlPath, pdfPath);

  if (pdfResult.success) {
    log.info("Step 3.2: PDF report generated successfully", { pdfPath });
  } else {
    log.warn("Step 3.2: PDF generation failed (non-critical)", { error: pdfResult.error });
  }

  await onProgress({ phase: "execute", step: "report-complete", pct: 100 });
  log.info("=== PHASE 3 COMPLETE ===");

  // ============================================================
  // Pipeline Complete
  // ============================================================
  log.info("Pipeline completed successfully", {
    htmlPath,
    score,
    grade,
    totalDuration: Date.now() - parseInt(timestamp)
  });

  // Write final status to job log and close
  jobFileLog.info("Job completed successfully", {
    score,
    grade,
    htmlPath,
    totalDuration: Date.now() - parseInt(timestamp)
  });
  await closeJobLogger(runPath);

  return { htmlPath, timestamp, runPath, score, grade };
}

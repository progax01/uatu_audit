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
import { scanForEmpathyPatterns, generateEmpathyQuestions } from "./empathyRules.js";
import clarificationService from "./clarificationService.js";
import { updateJobClarificationStatus } from "./jobQueue.js";

// Helper to check cancellation and throw if cancelled
function checkCancellation(jobId: number | undefined) {
  if (jobId) {
    checkJobCancellation(jobId);
  }
}

/**
 * Calculate security score based on findings
 * Formula: 100 - (critical×15 + high×10 + medium×4 + low×2 + info×1)
 * Score is always between 0-100
 */
function calculateScoreFromFindings(findings: any[]): { value: number; grade: string; breakdown: Record<string, number> } {
  const breakdown = {
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    info_count: 0
  };

  // Count findings by severity
  for (const finding of findings || []) {
    const severity = (finding.severity || '').toLowerCase();
    if (severity === 'critical') breakdown.critical_count++;
    else if (severity === 'high') breakdown.high_count++;
    else if (severity === 'medium') breakdown.medium_count++;
    else if (severity === 'low') breakdown.low_count++;
    else if (severity === 'info' || severity === 'informational') breakdown.info_count++;
  }

  // Calculate score: 100 - (critical×15 + high×10 + medium×4 + low×2 + info×1)
  const deductions =
    breakdown.critical_count * 15 +
    breakdown.high_count * 10 +
    breakdown.medium_count * 4 +
    breakdown.low_count * 2 +
    breakdown.info_count * 1;

  const value = Math.max(0, Math.min(100, 100 - deductions));

  // Determine grade
  const grade =
    value >= 90 ? 'A' :
      value >= 80 ? 'B' :
        value >= 70 ? 'C' :
          value >= 60 ? 'D' : 'F';

  return { value, grade, breakdown };
}

/**
 * 7-Phase Audit Pipeline
 *
 * Phase 1 (M1): Context Ingestion - Clone repo, analyze structure, write context files
 * Phase 2: Clarification - Generate empathy questions, await user input
 * Phase 3 (M2): Static Analysis - Pattern-based vulnerability detection
 * Phase 4 (M3): Logic Simulation - Chain-of-thought reasoning for attack scenarios
 * Phase 5 (M4): Test Generation - Generate executable PoC tests for critical findings
 * Phase 6 (M5): Final Consolidation - Combine findings, calculate weighted score
 * Phase 7: Report Generation - Generate HTML/PDF reports and certificate
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
  log.info("Starting 7-phase audit pipeline", { project, branch, repo, ai, testStyles });

  // Get existing run metadata if resuming
  let existingProgress = null;
  let timestamp = null;

  if (jobId) {
    const job = await getJob(jobId);
    if (job?.runTimestamp) {
      timestamp = job.runTimestamp;
      const runPath = path.join(runsPath, timestamp);
      const { loadProgress } = await import("./progressService.js");
      existingProgress = await loadProgress(runPath);
      if (existingProgress) {
        log.info("Resuming from existing run", { timestamp, overall: existingProgress.overall_pct });
      }
    }
  }

  // ============================================================
  // PHASE 1: Context Preparation
  // ============================================================
  log.info("=== PHASE 1: Context Preparation ===");

  if (!timestamp) {
    timestamp = Date.now().toString();
  }
  const runPath = path.join(runsPath, timestamp);

  // Step 1.1: Clone/Refresh Repository
  // M1 progress breakdown: 10%=project-detection, 25%=dependency-fingerprint, 40%=context-built, 50%=ready-marked, 50-100%=MilestoneExecutor
  const m1_phase = existingProgress?.phases.find(p => p.name === 'm1_context');
  const m1_pct = m1_phase?.pct ?? 0;
  const skipM1Fully = m1_pct >= 100;      // Skip everything - M1 fully complete
  const skipBootstrap = m1_pct >= 50;     // Skip bootstrap - context already built

  if (skipM1Fully) {
    log.info("Step 1.1 - 1.5: Skipping Context Preparation (M1 at 100%)");
  } else if (skipBootstrap) {
    log.info(`Step 1.1 - 1.4: Partial skip - M1 at ${m1_pct}%, skipping bootstrap`);
    // Still ensure repo is fresh
    checkCancellation(jobId);
    await withRetry(() => cloneOrRefresh(repo, branchPath, branch, accessToken));
    log.info("Step 1.1: Repository refreshed");
    await fs.ensureDir(runPath);
  } else {
    log.info("Step 1.1: Cloning/refreshing repository");
    checkCancellation(jobId);
    await withRetry(() => cloneOrRefresh(repo, branchPath, branch, accessToken));
    log.info("Step 1.1: Repository ready");

    // Step 1.2: Create run directory
    log.info("Step 1.2: Ensuring run directory", { runPath, timestamp });
    await fs.ensureDir(runPath);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Create job-specific file logger for UI streaming
  const jobFileLog = createJobFileLogger(runPath);
  if (!skipBootstrap && !skipM1Fully) {
    jobFileLog.info("Job started", { project, branch, repo, jobId, timestamp });
  } else {
    jobFileLog.info("Job resumed", { project, branch, repo, jobId, timestamp, m1_pct });
  }

  // Step 1.3: Initialize progress tracking
  if (!existingProgress) {
    log.info("Step 1.3: Initializing progress tracking");
    jobFileLog.info("Initializing progress tracking");
    await saveProgress(runPath, newProgress(project, branch, timestamp));
    if (jobId) {
      await attachRunTimestamp(jobId, timestamp);
      log.info("Step 1.3: Progress initialized", { jobId, timestamp });
    }
  } else {
    log.info("Step 1.3: Progress already exists, reusing history");
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

  // Move common inputs before the skip check so they are available for later phases
  const sopInputs = {
    projectPath: branchPath,
    contextPath,
    runsPath,
    timestamp,
    ai: ai ?? true,
    testStyles: (testStyles || ["behavioral", "stride"]) as ("behavioral" | "stride" | "owasp")[],
    jobId
  };

  // Step 1.4: Run Bootstrap SOP (project structure analysis)
  // Skip if M1 >= 50% (bootstrap already ran and wrote context files)
  if (skipBootstrap || skipM1Fully) {
    log.info(`Step 1.4: Skipping Bootstrap SOP (M1 at ${m1_pct}%)`);
  } else {
    log.info("Step 1.4: Running Bootstrap SOP");
    checkCancellation(jobId);

    await withRetry(() =>
      withTimeout(
        () => bootstrapSOP.execute(sopInputs, onProgress),
        5 * 60 * 1000,
        "Bootstrap SOP timed out"
      )
    );
    log.info("Step 1.4: Bootstrap SOP completed");
  }

  // Step 1.5: Write context files for single-prompt audit
  // Skip if M1 >= 50% (context files already written)
  if (skipBootstrap || skipM1Fully) {
    log.info(`Step 1.5: Skipping context file writing (M1 at ${m1_pct}%)`);
  } else {
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
  }

  // Note: m1_context progress is handled by bootstrap.ts (0-50%) and MilestoneExecutor (50-100%)
  log.info("=== PHASE 1 COMPLETE ===");

  // ============================================================
  // PHASE 1.5: Technical Clarifications (Empathy-Driven)
  // ============================================================
  log.info("=== PHASE 1.5: Technical Clarifications ===");
  checkCancellation(jobId);

  // Check if clarifications already exist for this job
  const hasClarifications = jobId ? await clarificationService.hasPendingClarifications(String(jobId), "pre_audit") : false;

  if (hasClarifications) {
    log.info("Pending clarifications already exist, pausing for user input");
    if (jobId) {
      await updateJobClarificationStatus(jobId, 'pending');
      await updateJobNote(jobId, 'Awaiting technical clarifications');
      await onProgress({ phase: "clarification", step: "awaiting-user-input", pct: 50 });
    }
    return {
      status: 'awaiting_clarification',
      message: 'Audit paused: technical clarifications required',
      timestamp,
      runPath: path.join(runsPath, timestamp),
    };
  }

  // Load project structure analysis results
  const psp = path.join(contextPath, "project-structure.json");
  const drp = path.join(contextPath, "dependency-report.json");

  if (await fs.pathExists(psp) && jobId) {
    log.info("Scanning for empathy patterns and unknown dependencies...");
    const projectStructure = await fs.readJson(psp);
    const dependencyReport = await fs.readJson(drp).catch(() => null);

    const questions: any[] = [];

    // 1. Scan critical files for empathy patterns
    for (const cp of projectStructure.criticalPaths || []) {
      const fullPath = path.join(branchPath, cp);
      if (await fs.pathExists(fullPath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        const matches = scanForEmpathyPatterns(content, cp);
        const empathyQuestions = generateEmpathyQuestions(matches);

        for (const q of empathyQuestions) {
          questions.push({
            questionKey: q.questionKey,
            questionText: q.questionText,
            context: q.context,
            options: q.options
          });
        }
      }
    }

    // 2. Add questions for unknown dependencies
    if (dependencyReport?.summary?.unknown > 0) {
      const unknownDeps = dependencyReport.unknownLibraries.map((d: any) => d.name).join(", ");
      questions.push({
        questionKey: 'unknown_dependencies',
        questionText: `We detected unknown or internal dependencies: ${unknownDeps}. Should these be audited as well?`,
        options: [
          { label: 'Yes, audit them (standard risk)', value: 'audit_all', risk: 'medium', scoreImpact: 0 },
          { label: 'No, trust them (verified internal)', value: 'trust_internal', risk: 'low', scoreImpact: +5 },
          { label: 'Ignore them (outside scope)', value: 'ignore', risk: 'info', scoreImpact: 0 }
        ],
        context: {
          category: 'TOKEN_HANDLING',
          dependencies: dependencyReport.unknownLibraries
        }
      });
    }

    // 3. Save generated questions
    if (questions.length > 0) {
      log.info(`Generating ${questions.length} clarifications for job ${jobId}`);
      await clarificationService.addBulkPreAuditQuestions(String(jobId), questions);

      await updateJobClarificationStatus(jobId, 'pending');
      await updateJobNote(jobId, 'Awaiting technical clarifications');
      await onProgress({ phase: "clarification", step: "awaiting-user-input", pct: 50 });

      return {
        status: 'awaiting_clarification',
        message: 'Pre-audit clarifications generated, awaiting user responses',
        questionCount: questions.length,
        timestamp,
        runPath: path.join(runsPath, timestamp),
      };
    }
  }

  await onProgress({ phase: "clarification", step: "clarifications-complete", pct: 100 });
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
      auditDepth: 'standard',
      onProgress // Pass progress callback to track milestone progress
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
      sessionTimeout: sessionTimeoutMs // Pass dynamic timeout
      // Note: Parallel audit doesn't use milestone-based progress
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

  // Milestones are tracked by MilestoneExecutor - no need to update here
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

  await onProgress({ phase: "report", step: "report-complete", pct: 100 });
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

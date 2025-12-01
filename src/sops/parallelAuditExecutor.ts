import path from "node:path";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import { logger } from "../utils/logger.js";
import { checkCancellation, JobCancelledError } from "../services/jobQueue.js";
import { buildSecurityAnalysisPrompt } from "./prompts/securityAnalysis.js";
import { buildContractExplanationsPrompt } from "./prompts/contractExplanations.js";
import { buildUserFlowsPrompt } from "./prompts/userFlows.js";
import { buildTestExecutionPrompt } from "./prompts/testExecution.js";

const log = logger.child({ service: "parallel-audit-executor" });

interface SessionConfig {
  id: string;
  name: string;
  promptBuilder: (contextPath: string, projectPath: string) => string;
  outputFile: string;
  timeout: number; // milliseconds
  critical: boolean; // If true, audit fails if this session fails
}

interface SessionResult {
  id: string;
  name: string;
  success: boolean;
  duration: number;
  output?: any;
  error?: string;
}

/**
 * Execute multiple Claude CLI sessions in parallel for comprehensive audit
 */
export async function executeParallelAudit(options: {
  projectPath: string;
  contextPath: string;
  runPath: string;
  jobId?: number;
  onProgress?: (update: { session: string; status: string; pct: number }) => void;
}): Promise<{ success: boolean; results: SessionResult[]; combined: any }> {
  const { projectPath, contextPath, runPath, jobId, onProgress } = options;

  log.info("=== PARALLEL AUDIT EXECUTION STARTING ===");
  log.info("Options:", { projectPath, contextPath, runPath, jobId });

  // Read feature flag
  const enableDetailed = process.env.ENABLE_DETAILED_AUDIT === "true";
  const maxParallel = parseInt(process.env.PARALLEL_SESSIONS || "4");
  const sessionTimeoutMin = parseInt(process.env.SESSION_TIMEOUT_MIN || "15");
  const fallbackToBasic = process.env.FALLBACK_TO_BASIC === "true";

  log.info("Feature flags:", { enableDetailed, maxParallel, sessionTimeoutMin, fallbackToBasic });

  if (!enableDetailed) {
    log.info("Detailed audit disabled - skipping parallel execution");
    return {
      success: true,
      results: [],
      combined: { detailedAuditEnabled: false }
    };
  }

  // Define session configurations
  const sessions: SessionConfig[] = [
    {
      id: "security",
      name: "Security Analysis",
      promptBuilder: buildSecurityAnalysisPrompt,
      outputFile: "security_results.json",
      timeout: sessionTimeoutMin * 60 * 1000,
      critical: true // Security analysis is critical
    },
    {
      id: "contracts",
      name: "Contract Explanations",
      promptBuilder: (ctx, _proj) => buildContractExplanationsPrompt(ctx),
      outputFile: "contract_explanations.json",
      timeout: sessionTimeoutMin * 60 * 1000,
      critical: false // Optional enhancement
    },
    {
      id: "flows",
      name: "User Flow Mapping",
      promptBuilder: (ctx, _proj) => buildUserFlowsPrompt(ctx),
      outputFile: "user_flows.json",
      timeout: sessionTimeoutMin * 60 * 1000,
      critical: false // Optional enhancement
    },
    {
      id: "tests",
      name: "Test Execution",
      promptBuilder: (ctx, _proj) => buildTestExecutionPrompt(ctx),
      outputFile: "test_execution.json",
      timeout: sessionTimeoutMin * 60 * 1000,
      critical: false // Optional enhancement
    }
  ];

  log.info("Session configurations:", { sessionCount: sessions.length });

  // Execute sessions in parallel with concurrency control
  const results: SessionResult[] = [];
  const sessionPromises: Promise<SessionResult>[] = [];

  for (const session of sessions.slice(0, maxParallel)) {
    log.info(`Queueing session: ${session.name}`);

    const sessionPromise = executeSession({
      session,
      projectPath,
      contextPath,
      runPath,
      jobId,
      onProgress: (status, pct) => {
        onProgress?.({ session: session.name, status, pct });
      }
    });

    sessionPromises.push(sessionPromise);
  }

  log.info(`Executing ${sessionPromises.length} sessions in parallel`);

  // Wait for all sessions to complete
  const sessionResults = await Promise.all(sessionPromises);
  results.push(...sessionResults);

  log.info("All sessions completed", {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });

  // Check if any critical session failed
  const criticalFailures = results.filter(r => {
    const session = sessions.find(s => s.id === r.id);
    return session?.critical && !r.success;
  });

  if (criticalFailures.length > 0 && !fallbackToBasic) {
    log.error("Critical session(s) failed", {
      failures: criticalFailures.map(f => f.name)
    });
    return {
      success: false,
      results,
      combined: { error: "Critical audit session failed" }
    };
  }

  // Merge results from all sessions
  log.info("Merging session results");
  const combined = await mergeSessionResults(results, contextPath);

  log.info("=== PARALLEL AUDIT EXECUTION COMPLETE ===");
  return {
    success: true,
    results,
    combined
  };
}

/**
 * Execute a single Claude CLI session
 */
async function executeSession(options: {
  session: SessionConfig;
  projectPath: string;
  contextPath: string;
  runPath: string;
  jobId?: number;
  onProgress: (status: string, pct: number) => void;
}): Promise<SessionResult> {
  const { session, projectPath, contextPath, runPath, jobId, onProgress } = options;
  const startTime = Date.now();

  log.info(`Starting session: ${session.name}`, { id: session.id });
  onProgress("starting", 0);

  try {
    // Check cancellation
    if (jobId) {
      checkCancellation(jobId);
    }

    // Build prompt
    const prompt = session.promptBuilder(contextPath, projectPath);
    log.info(`Built prompt for ${session.name}`, { length: prompt.length });
    onProgress("building prompt", 10);

    // Write prompt to file for debugging
    const promptFile = path.join(runPath, `${session.id}-prompt.txt`);
    await fs.writeFile(promptFile, prompt, "utf8");
    log.info(`Wrote prompt file: ${promptFile}`);

    // Execute Claude CLI
    onProgress("executing", 20);
    const outputPath = path.join(contextPath, session.outputFile);
    const output = await executeClaudeCLI({
      prompt,
      cwd: projectPath,
      timeout: session.timeout,
      sessionId: session.id,
      jobId,
      outputPath, // Pass the output path so Claude CLI can write results
      onProgress: (pct) => onProgress("executing", 20 + pct * 0.7)
    });

    onProgress("processing", 90);

    // Read output file
    let result: any = null;

    if (await fs.pathExists(outputPath)) {
      result = await fs.readJson(outputPath);
      log.info(`Session ${session.name} completed successfully`, {
        duration: Date.now() - startTime,
        hasOutput: !!result
      });
      onProgress("complete", 100);

      return {
        id: session.id,
        name: session.name,
        success: true,
        duration: Date.now() - startTime,
        output: result
      };
    } else {
      log.warn(`Session ${session.name} did not produce output file`, {
        expected: outputPath
      });
      onProgress("failed", 100);

      return {
        id: session.id,
        name: session.name,
        success: false,
        duration: Date.now() - startTime,
        error: "Output file not created"
      };
    }

  } catch (error: any) {
    log.error(`Session ${session.name} failed`, {
      error: error.message,
      duration: Date.now() - startTime
    });
    onProgress("failed", 100);

    if (error instanceof JobCancelledError) {
      throw error; // Propagate cancellation
    }

    return {
      id: session.id,
      name: session.name,
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Execute Claude CLI for a single session
 */
async function executeClaudeCLI(options: {
  prompt: string;
  cwd: string;
  timeout: number;
  sessionId: string;
  jobId?: number;
  outputPath: string;
  onProgress: (pct: number) => void;
}): Promise<void> {
  const { prompt, cwd, timeout, sessionId, jobId, outputPath, onProgress } = options;

  return new Promise((resolve, reject) => {
    const args = [
      "--dangerously-skip-permissions",
      "-p", prompt,
      "--output-format", "text"
    ];

    log.info(`Spawning Claude CLI for session ${sessionId}`);

    const proc = spawn("claude", args, {
      cwd,
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: "cli"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    proc.stdin?.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
      // Update progress based on output
      if (stdout.length > 1000) onProgress(0.3);
      if (stdout.length > 5000) onProgress(0.5);
      if (stdout.length > 10000) onProgress(0.7);
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Cancellation check
    const checkInterval = setInterval(() => {
      if (jobId) {
        try {
          checkCancellation(jobId);
        } catch (e) {
          log.info(`Job cancelled, killing session ${sessionId}`);
          proc.kill("SIGTERM");
          clearInterval(checkInterval);
          reject(new JobCancelledError(jobId));
        }
      }
    }, 1000);

    proc.on("close", async (code) => {
      clearInterval(checkInterval);
      if (code === 0) {
        try {
          // Parse Claude's response - it should be JSON
          let jsonOutput;
          try {
            // Try to extract JSON from stdout (Claude might include markdown code blocks)
            const jsonMatch = stdout.match(/```json\s*([\s\S]*?)\s*```/) || stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[1] || jsonMatch[0];
              jsonOutput = JSON.parse(jsonStr);
            } else {
              // If no JSON found, try parsing entire stdout
              jsonOutput = JSON.parse(stdout);
            }
          } catch (parseError) {
            log.warn(`Session ${sessionId} output is not valid JSON, saving raw text`, {
              preview: stdout.slice(0, 200)
            });
            jsonOutput = { raw_output: stdout, error: "Could not parse as JSON" };
          }

          // Write output to file
          await fs.writeJson(outputPath, jsonOutput, { spaces: 2 });
          log.info(`Session ${sessionId} Claude CLI exited successfully, output written`, {
            outputPath,
            hasData: !!jsonOutput
          });
          resolve();
        } catch (writeError: any) {
          log.error(`Session ${sessionId} failed to write output`, { error: writeError.message });
          reject(new Error(`Failed to write output: ${writeError.message}`));
        }
      } else {
        log.error(`Session ${sessionId} Claude CLI failed`, { code, stderr });
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      clearInterval(checkInterval);
      log.error(`Session ${sessionId} spawn error`, { error: err.message });
      reject(err);
    });

    // Timeout
    const timeoutHandle = setTimeout(() => {
      log.error(`Session ${sessionId} timed out`);
      proc.kill("SIGTERM");
      clearInterval(checkInterval);
      reject(new Error(`Session ${sessionId} timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", () => clearTimeout(timeoutHandle));
  });
}

/**
 * Merge results from all sessions into combined output
 */
async function mergeSessionResults(
  results: SessionResult[],
  contextPath: string
): Promise<any> {
  log.info("Merging session results");

  const merged: any = {
    detailedAuditEnabled: true,
    sessions: results.map(r => ({
      id: r.id,
      name: r.name,
      success: r.success,
      duration: r.duration
    }))
  };

  // Merge security results (required)
  const securityResult = results.find(r => r.id === "security");
  if (securityResult?.success && securityResult.output) {
    merged.analysis = securityResult.output.analysis;
    merged.tests_generated = securityResult.output.tests_generated;
    merged.score = securityResult.output.score;
    merged.recommendations = securityResult.output.recommendations;
    log.info("Merged security analysis");
  }

  // Merge contract explanations (optional)
  const contractsResult = results.find(r => r.id === "contracts");
  if (contractsResult?.success && contractsResult.output) {
    merged.contracts_explained = contractsResult.output.contracts_explained;
    log.info("Merged contract explanations");
  }

  // Merge user flows (optional)
  const flowsResult = results.find(r => r.id === "flows");
  if (flowsResult?.success && flowsResult.output) {
    merged.user_flows = flowsResult.output.user_flows;
    log.info("Merged user flows");
  }

  // Merge test results (optional)
  const testsResult = results.find(r => r.id === "tests");
  if (testsResult?.success && testsResult.output) {
    merged.test_methodology = testsResult.output.test_methodology;
    merged.test_results = testsResult.output.test_results;
    log.info("Merged test execution results");
  }

  return merged;
}

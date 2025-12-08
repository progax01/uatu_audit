import path from "node:path";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { createLiveLogger } from "../services/liveLogger.js";
import { checkCancellation, JobCancelledError } from "../services/jobQueue.js";
import { logger } from "../utils/logger.js";
import { executeParallelAudit } from "./parallelAuditExecutor.js";

const log = logger.child({ service: "single-prompt-audit" });

/**
 * Single-Prompt Audit SOP
 *
 * Replaces the complex multi-SOP flow with a single Claude CLI call.
 * Uses context files:
 * - context/files_structure.md (project structure + contract code)
 * - context/test_requirements.md (selected files + test styles)
 * - context/milestones.md (progress tracking for resume)
 * - context/results.json (output)
 */
export const singlePromptAuditSOP: SOP = {
  name: "singlePromptAudit",
  version: "1.0.0",
  prerequisites: ["bootstrap"],

  async validateInputs(i) {
    return !!(i.projectPath && i.contextPath);
  },

  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];
    const runPath = path.join(i.runsPath as string, i.timestamp as string);
    const liveLogger = createLiveLogger(runPath, "cli");

    // DEBUG: Log all inputs
    log.info("=== SINGLE-PROMPT AUDIT SOP STARTING ===");
    log.info("Input parameters:", {
      projectPath: i.projectPath,
      contextPath: i.contextPath,
      runsPath: i.runsPath,
      timestamp: i.timestamp,
      jobId: i.jobId,
      testStyles: i.testStyles
    });
    log.info("Run path:", { runPath });

    liveLogger.info("Single-Prompt Audit SOP starting", { contextPath: i.contextPath });

    await step(onProgress, { phase: "audit", step: "preparing-prompt", pct: 10 });

    // Verify context files exist
    const filesStructurePath = path.join(i.contextPath as string, "files_structure.md");
    const testRequirementsPath = path.join(i.contextPath as string, "test_requirements.md");
    const milestonesPath = path.join(i.contextPath as string, "milestones.md");
    const resultsPath = path.join(i.contextPath as string, "results.json");

    log.debug("Context file paths:", {
      filesStructurePath,
      testRequirementsPath,
      milestonesPath,
      resultsPath
    });

    // Check existence of each file
    const filesStructureExists = await fs.pathExists(filesStructurePath);
    const testRequirementsExists = await fs.pathExists(testRequirementsPath);
    const milestonesExists = await fs.pathExists(milestonesPath);
    const resultsExists = await fs.pathExists(resultsPath);

    log.info("Context files existence check:", {
      filesStructureExists,
      testRequirementsExists,
      milestonesExists,
      resultsExists
    });

    if (!filesStructureExists) {
      log.error("files_structure.md not found!", { path: filesStructurePath });
      errors.push("files_structure.md not found - run bootstrap first");
      return { ok: false, outputs: {}, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
    }

    if (!testRequirementsExists) {
      log.error("test_requirements.md not found!", { path: testRequirementsPath });
      errors.push("test_requirements.md not found - run bootstrap first");
      return { ok: false, outputs: {}, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
    }

    // Log file sizes for debugging
    const filesStructureStats = await fs.stat(filesStructurePath);
    const testRequirementsStats = await fs.stat(testRequirementsPath);
    log.info("Context file sizes:", {
      filesStructure: `${filesStructureStats.size} bytes`,
      testRequirements: `${testRequirementsStats.size} bytes`
    });

    await step(onProgress, { phase: "audit", step: "invoking-claude", pct: 20 });

    // Check for parallel execution feature flag
    const enableDetailed = process.env.ENABLE_DETAILED_AUDIT === "true";
    const fallbackToBasic = process.env.FALLBACK_TO_BASIC === "true";

    if (enableDetailed) {
      log.info("Detailed audit enabled - attempting parallel execution");
      liveLogger.info("Running parallel detailed audit with 4 sessions");

      try {
        const parallelResult = await executeParallelAudit({
          projectPath: i.projectPath as string,
          contextPath: i.contextPath as string,
          runPath,
          jobId: i.jobId as number | undefined,
          onProgress: (update) => {
            onProgress?.({
              phase: "audit",
              step: update.session.toLowerCase().replace(/ /g, '-'),
              pct: 20 + (update.pct * 0.7)
            });
          }
        });

        if (!parallelResult.success) {
          if (fallbackToBasic) {
            log.warn("Parallel audit failed, falling back to basic single-prompt audit");
            liveLogger.warn("Parallel audit failed, using fallback mode");
            // Continue to basic audit below
          } else {
            errors.push("Parallel audit failed");
            liveLogger.error("Parallel audit failed with no fallback");
            return {
              ok: false,
              outputs: {},
              errors,
              started_at,
              completed_at: new Date().toISOString(),
              version: this.version
            };
          }
        } else {
          // Parallel audit succeeded - write results and return
          log.info("Parallel audit completed successfully");
          liveLogger.info("Parallel audit completed successfully", {
            sessions: parallelResult.results.length,
            successful: parallelResult.results.filter(r => r.success).length
          });

          await fs.writeJson(resultsPath, parallelResult.combined, { spaces: 2 });
          await step(onProgress, { phase: "audit", step: "audit-complete", pct: 100 });

          return {
            ok: true,
            outputs: parallelResult.combined,
            errors: [],
            started_at,
            completed_at: new Date().toISOString(),
            version: this.version
          };
        }
      } catch (error: any) {
        if (error instanceof JobCancelledError) {
          throw error; // Propagate cancellation
        }

        log.error("Parallel audit error:", { error: error.message });
        liveLogger.error("Parallel audit error", { error: error.message });

        if (fallbackToBasic) {
          log.warn("Falling back to basic audit due to error");
          liveLogger.warn("Falling back to basic audit");
          // Continue to basic audit below
        } else {
          errors.push(`Parallel audit error: ${error.message}`);
          return {
            ok: false,
            outputs: {},
            errors,
            started_at,
            completed_at: new Date().toISOString(),
            version: this.version
          };
        }
      }
    }

    // Basic single-prompt audit (either disabled or fallback)
    log.info(enableDetailed ? "Running basic audit as fallback" : "Running basic single-prompt audit");

    // Check for cancellation before starting Claude CLI
    if (i.jobId) {
      log.debug("Checking cancellation for job", { jobId: i.jobId });
      checkCancellation(i.jobId as number);
    }

    // Build the MEGA PROMPT
    log.info("Building mega prompt...");
    const megaPrompt = buildMegaPrompt(i.contextPath as string, i.projectPath as string);
    log.info("Mega prompt built", {
      promptLength: megaPrompt.length,
      promptPreview: megaPrompt.substring(0, 500) + "..."
    });

    liveLogger.info("Executing Claude CLI with single mega-prompt", {
      promptLength: megaPrompt.length,
      contextPath: i.contextPath
    });

    try {
      // Execute Claude CLI
      log.info("=== EXECUTING CLAUDE CLI ===");
      log.info("Claude CLI parameters:", {
        cwd: i.projectPath,
        contextPath: i.contextPath,
        runPath,
        jobId: i.jobId
      });

      const result = await executeClaudeCLI({
        prompt: megaPrompt,
        cwd: i.projectPath as string,
        contextPath: i.contextPath as string,
        runPath,
        onProgress,
        jobId: i.jobId as number | undefined,
        liveLogger
      });

      log.info("Claude CLI execution completed", {
        success: result.success,
        duration: result.duration,
        outputLength: result.output?.length || 0,
        errorLength: result.error?.length || 0
      });

      if (!result.success) {
        const errorMsg = result.error || "Claude CLI execution failed";

        log.error("Claude CLI failed!", {
          error: errorMsg,
          duration: result.duration,
          outputPreview: result.output?.substring(0, 1000),
          promptLength: megaPrompt.length
        });

        // Provide actionable error message based on error type
        let actionableError = errorMsg;
        if (errorMsg.includes("Invalid API key") || errorMsg.includes("/login")) {
          actionableError =
            "❌ Claude CLI authentication failed.\n" +
            "Fix options:\n" +
            "  1. Check ~/.claude/.credentials.json permissions (should be 644)\n" +
            "  2. Set ANTHROPIC_API_KEY environment variable\n" +
            "  3. Run 'claude /login' inside container\n" +
            `Original error: ${errorMsg}`;
        } else if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
          actionableError =
            `❌ Claude CLI timed out after ${result.duration}ms.\n` +
            "Fix options:\n" +
            "  1. Increase SESSION_TIMEOUT_MIN environment variable\n" +
            "  2. Reduce number of contracts being analyzed\n" +
            "  3. Check if Claude API is experiencing issues\n" +
            `Original error: ${errorMsg}`;
        } else if (errorMsg.includes("ENOENT") || errorMsg.includes("not found")) {
          actionableError =
            "❌ Claude CLI not found or not executable.\n" +
            "Fix options:\n" +
            "  1. Install Claude CLI: https://github.com/anthropics/claude-cli\n" +
            "  2. Check if claude is in PATH: which claude\n" +
            `Original error: ${errorMsg}`;
        }

        errors.push(actionableError);
        liveLogger.error("Claude CLI failed", { error: actionableError });
      } else {
        log.info("Claude CLI completed successfully", {
          duration: result.duration,
          outputPreview: result.output?.substring(0, 500)
        });
        liveLogger.info("Claude CLI completed successfully", {
          duration: result.duration,
          outputLength: result.output?.length || 0
        });
      }

      await step(onProgress, { phase: "audit", step: "processing-results", pct: 90 });

      // Verify results.json was created/updated
      log.info("=== PROCESSING RESULTS ===");
      log.info("Checking for results.json at:", { resultsPath });

      let outputs: any = {};
      const resultsExistsNow = await fs.pathExists(resultsPath);
      log.info("results.json exists after Claude CLI:", { exists: resultsExistsNow });

      if (resultsExistsNow) {
        try {
          const resultsRaw = await fs.readFile(resultsPath, "utf8");
          log.debug("results.json raw content (first 1000 chars):", {
            content: resultsRaw.substring(0, 1000)
          });

          outputs = await fs.readJson(resultsPath);
          log.info("Results parsed successfully", {
            hasMetadata: !!outputs.metadata,
            hasAnalysis: !!outputs.analysis,
            hasScore: !!outputs.score,
            findingsCount: outputs.analysis?.findings?.length || 0,
            totalFindings: outputs.analysis?.total_findings || 0,
            scoreValue: outputs.score?.value,
            scoreGrade: outputs.score?.grade
          });
          liveLogger.info("Results loaded", {
            findings: outputs.analysis?.total_findings || 0,
            score: outputs.score?.value || 0
          });
        } catch (e: any) {
          log.error("Failed to parse results.json!", {
            error: e.message,
            stack: e.stack
          });
          errors.push("Failed to parse results.json");
        }
      } else {
        log.error("results.json not created by Claude CLI!");
        log.info("Listing context directory contents:", { contextPath: i.contextPath });
        try {
          const contextContents = await fs.readdir(i.contextPath as string);
          log.info("Context directory contents:", { files: contextContents });
        } catch (e) {
          log.error("Failed to list context directory");
        }
        errors.push("results.json not created by Claude CLI");
      }

      await step(onProgress, { phase: "audit", step: "audit-complete", pct: 100 });

      log.info("=== SINGLE-PROMPT AUDIT COMPLETE ===", {
        ok: errors.length === 0,
        errorCount: errors.length,
        errors: errors
      });

      return {
        ok: errors.length === 0,
        outputs,
        errors,
        started_at,
        completed_at: new Date().toISOString(),
        version: this.version
      };

    } catch (error: any) {
      log.error("=== SINGLE-PROMPT AUDIT EXCEPTION ===", {
        error: error.message,
        stack: error.stack,
        name: error.name
      });

      if (error instanceof JobCancelledError) {
        log.info("Audit cancelled by user");
        liveLogger.info("Audit cancelled by user");
        return {
          ok: false,
          outputs: { cancelled: true },
          errors: ["Cancelled by user"],
          started_at,
          completed_at: new Date().toISOString(),
          version: this.version
        };
      }

      errors.push(String(error));
      liveLogger.error("Single-prompt audit failed", { error: String(error) });

      return {
        ok: false,
        outputs: {},
        errors,
        started_at,
        completed_at: new Date().toISOString(),
        version: this.version
      };
    }
  },

  async verifyOutputs(r) {
    return !!(r.outputs && (r.outputs as any).score);
  }
};

/**
 * Build the mega-prompt that does everything in one shot
 */
function buildMegaPrompt(contextPath: string, projectPath: string): string {
  return `You are UatuAudit, an expert smart contract security auditor. You will perform a comprehensive security audit and generate tests in a SINGLE execution.

## CRITICAL INSTRUCTIONS

1. You MUST read the context files first
2. You MUST write results to context/results.json
3. You MUST update context/milestones.md as you progress
4. You MUST generate test files in the project's test/ directory

## STEP 1: Read Context Files

Read these files to understand the project:
- \`${path.join(contextPath, "files_structure.md")}\` - Project structure and contract source code
- \`${path.join(contextPath, "test_requirements.md")}\` - What tests to generate
- \`${path.join(contextPath, "milestones.md")}\` - Check if resuming from previous run

## STEP 2: Security Analysis

For EACH contract in the selected files, analyze for:

### Vulnerability Categories
1. **Reentrancy** - External calls before state updates, cross-function reentrancy
2. **Access Control** - Missing modifiers, improper authorization, privilege escalation
3. **Integer Issues** - Overflow/underflow, unsafe casting, precision loss
4. **Unchecked Returns** - Ignored return values from external calls
5. **DoS Vectors** - Unbounded loops, gas griefing, block stuffing
6. **Randomness** - Predictable block.timestamp, blockhash abuse
7. **Front-Running** - Sandwich attacks, transaction ordering
8. **Logic Errors** - Business logic flaws, incorrect state transitions
9. **Oracle Issues** - Price manipulation, stale data
10. **Flash Loan Attacks** - Instant liquidity exploits

### For Each Finding Record:
- Severity: critical | high | medium | low | info
- Category: one of the above
- File and line number
- Code snippet
- Description
- Recommendation

## STEP 3: Generate Tests

Based on test_requirements.md, generate test files:

### Behavioral Tests (if requested)
For each contract function:
- Happy path test
- Edge cases (zero values, max values, empty inputs)
- Revert conditions
- Event emissions

### STRIDE Tests (if requested)
- **S**poofing: Test identity verification
- **T**ampering: Test data integrity
- **R**epudiation: Test audit logging
- **I**nfo Disclosure: Test access controls on sensitive data
- **D**enial of Service: Test gas limits and loops
- **E**levation of Privilege: Test role-based access

### OWASP Tests (if requested)
Generate specific tests for each OWASP Smart Contract Top 10 category.

## STEP 4: Calculate Score

Calculate security score (0-100):
- Start at 100
- Critical finding: -25 points each
- High finding: -15 points each
- Medium finding: -10 points each
- Low finding: -5 points each
- Info finding: -1 point each
- Minimum score: 0

Grade:
- A: 90-100
- B: 80-89
- C: 70-79
- D: 60-69
- F: 0-59

## STEP 5: Write Results

Write to \`${path.join(contextPath, "results.json")}\`:

\`\`\`json
{
  "metadata": {
    "repo": "<from files_structure.md>",
    "branch": "<from files_structure.md>",
    "timestamp": "<current ISO timestamp>",
    "duration_seconds": <execution time>,
    "status": "completed"
  },
  "analysis": {
    "contracts_analyzed": <number>,
    "total_findings": <number>,
    "findings": [
      {
        "id": "VULN-001",
        "severity": "high",
        "category": "reentrancy",
        "title": "Reentrancy in withdraw()",
        "file": "contracts/Vault.sol",
        "line": 45,
        "description": "External call before state update allows reentrancy",
        "code_snippet": "payable(msg.sender).transfer(amount);\\nbalances[msg.sender] = 0;",
        "recommendation": "Update state before external call (CEI pattern)"
      }
    ]
  },
  "tests_generated": {
    "behavioral": {
      "count": <number>,
      "files": ["test/Contract.behavioral.test.ts"]
    },
    "stride": {
      "count": <number>,
      "files": ["test/Contract.stride.test.ts"]
    },
    "owasp": {
      "count": <number>,
      "files": ["test/owasp/SC01-reentrancy.test.ts"]
    }
  },
  "score": {
    "value": <0-100>,
    "grade": "<A-F>",
    "breakdown": {
      "critical_count": <n>,
      "high_count": <n>,
      "medium_count": <n>,
      "low_count": <n>,
      "info_count": <n>
    }
  },
  "recommendations": [
    "Implement reentrancy guards using OpenZeppelin ReentrancyGuard",
    "Add access control modifiers to admin functions",
    "Use SafeMath or Solidity 0.8+ for arithmetic operations"
  ]
}
\`\`\`

## STEP 6: Update Milestones

Update \`${path.join(contextPath, "milestones.md")}\` with completion status.

## EXECUTION ORDER

1. Read files_structure.md
2. Read test_requirements.md
3. Read milestones.md (check if resuming)
4. Update milestones.md: Status = IN_PROGRESS
5. Analyze each contract
6. Generate test files
7. Calculate score
8. Write results.json
9. Update milestones.md: Status = COMPLETED

## BEGIN AUDIT NOW

Start by reading the context files, then perform the complete audit.`;
}

/**
 * Execute Claude CLI with the mega-prompt
 */
async function executeClaudeCLI(options: {
  prompt: string;
  cwd: string;
  contextPath: string;
  runPath: string;
  onProgress?: ProgressHook;
  jobId?: number;
  liveLogger: any;
}): Promise<{ success: boolean; output?: string; error?: string; duration?: number }> {
  const { prompt, cwd, contextPath, runPath, onProgress, jobId, liveLogger } = options;
  const startTime = Date.now();

  log.info("=== executeClaudeCLI START ===");
  log.info("executeClaudeCLI options:", {
    promptLength: prompt.length,
    cwd,
    contextPath,
    runPath,
    jobId
  });

  return new Promise((resolve) => {
    // Write prompt to temp file for debugging
    const promptFile = path.join(runPath, "mega-prompt.txt");
    log.info("Writing mega-prompt to file:", { promptFile });
    fs.writeFileSync(promptFile, prompt, "utf8");
    log.info("Mega-prompt file written successfully");

    const args = [
      "--dangerously-skip-permissions",
      "-p", prompt,
      "--output-format", "text",
      "--verbose"
    ];

    log.info("Claude CLI arguments:", {
      argCount: args.length,
      args: ["--dangerously-skip-permissions", "-p", `<prompt ${prompt.length} chars>`, "--output-format", "text", "--verbose"]
    });

    liveLogger.info("Spawning Claude CLI", { args: args.slice(0, 3), cwd });

    log.info("Spawning Claude CLI process...", { cwd });
    const proc = spawn("claude", args, {
      cwd,
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: "cli"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    log.info("Claude CLI process spawned", { pid: proc.pid });

    // IMPORTANT: Close stdin immediately since we're passing prompt via -p flag
    // Without this, Claude CLI may hang waiting for stdin input
    proc.stdin?.end();
    log.info("Closed stdin for Claude CLI process");

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Stream output to logs in real-time for visibility
      const now = Date.now();
      const elapsed = Math.round((now - startTime) / 1000);

      // Log every chunk for real-time visibility
      log.info("Claude CLI output", {
        elapsed: `${elapsed}s`,
        totalLength: stdout.length,
        chunk: chunk.substring(0, 500).replace(/\n/g, ' ')
      });

      liveLogger.info("Claude stdout", { chunk: chunk.substring(0, 300) });

      // Update progress based on output patterns
      if (chunk.includes("Reading") || chunk.includes("Analyzing")) {
        log.info("Claude CLI: Analyzing contracts phase detected");
        onProgress?.({ phase: "audit", step: "analyzing-contracts", pct: 40 });
      } else if (chunk.includes("Generating") || chunk.includes("test")) {
        log.info("Claude CLI: Generating tests phase detected");
        onProgress?.({ phase: "audit", step: "generating-tests", pct: 60 });
      } else if (chunk.includes("Writing") || chunk.includes("results")) {
        log.info("Claude CLI: Writing results phase detected");
        onProgress?.({ phase: "audit", step: "writing-results", pct: 80 });
      }
    });

    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      log.warn("Claude CLI stderr:", {
        chunkLength: chunk.length,
        totalStderrLength: stderr.length,
        content: chunk.substring(0, 500)
      });
      liveLogger.debug("Claude stderr", { chunk: chunk.substring(0, 200) });
    });

    // Handle cancellation
    const checkInterval = setInterval(() => {
      if (jobId) {
        try {
          checkCancellation(jobId);
        } catch (e) {
          log.info("Job cancellation detected, killing Claude CLI process", { jobId });
          proc.kill("SIGTERM");
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: "Cancelled by user",
            duration: Date.now() - startTime
          });
        }
      }
    }, 1000);

    proc.on("close", (code) => {
      clearInterval(checkInterval);
      const duration = Date.now() - startTime;

      log.info("=== Claude CLI process closed ===", {
        exitCode: code,
        duration: `${Math.round(duration / 1000)}s`,
        stdoutLength: stdout.length,
        stderrLength: stderr.length
      });

      if (code === 0) {
        log.info("Claude CLI exited successfully");
        log.debug("Claude CLI final stdout (last 2000 chars):", {
          content: stdout.substring(Math.max(0, stdout.length - 2000))
        });
      } else {
        log.error("Claude CLI exited with error!", {
          exitCode: code,
          stderr: stderr.substring(0, 2000),
          stdoutTail: stdout.substring(Math.max(0, stdout.length - 1000))
        });
      }

      liveLogger.info("Claude CLI exited", { code, duration, stdoutLen: stdout.length, stderrLen: stderr.length });

      if (code === 0) {
        resolve({ success: true, output: stdout, duration });
      } else {
        resolve({
          success: false,
          error: stderr || `Claude CLI exited with code ${code}`,
          output: stdout,
          duration
        });
      }
    });

    proc.on("error", (err) => {
      clearInterval(checkInterval);
      log.error("Claude CLI spawn error!", {
        error: String(err),
        errorName: err.name,
        errorMessage: err.message
      });
      liveLogger.error("Claude CLI spawn error", { error: String(err) });
      resolve({
        success: false,
        error: String(err),
        duration: Date.now() - startTime
      });
    });

    // Timeout after 60 minutes
    log.info("Setting 60-minute timeout for Claude CLI");
    const timeout = setTimeout(() => {
      log.error("Claude CLI TIMEOUT after 60 minutes!", {
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        stdoutTail: stdout.substring(Math.max(0, stdout.length - 1000))
      });
      proc.kill("SIGTERM");
      clearInterval(checkInterval);
      resolve({
        success: false,
        error: "Claude CLI timed out after 60 minutes",
        duration: Date.now() - startTime
      });
    }, 60 * 60 * 1000);

    proc.on("close", () => clearTimeout(timeout));
  });
}

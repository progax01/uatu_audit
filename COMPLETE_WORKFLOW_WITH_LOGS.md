# COMPLETE AUDIT WORKFLOW WITH ALL LOGS 📊
## From GitHub → Final Report (Every Single Step)

---

## 🎬 ENTRY POINT: User Submits Audit Request

```
USER BROWSER
    │
    ├─ ui/src/pages/AuditSetup.tsx
    │  └─ User fills form:
    │     - Select GitHub repository
    │     - Select branch
    │     - Select Solidity files
    │     - Click "Start Audit"
    │
    ▼
POST /enqueue
```

---

## 📥 PHASE 0: Job Enqueueing

### File: `src/server/routes/jobs.ts`

```javascript
POST /enqueue
├─ Log: "New job created: ID {jobId} for {repo}@{branch}@{commit}"
│  Location: src/services/jobQueue.ts:145
│  Level: INFO
│  Output: console.log
│
└─ Writes to: ~/.uatu/queue/jobs.json
   {
     "id": 23,
     "status": "pending",
     "repo": "https://github.com/user/repo.git",
     "project": "MyProject",
     "branch": "main",
     "createdAt": "2025-12-10T07:31:05.748Z"
   }
```

**Log Output:**
```
New job created: ID 23 for https://github.com/saurabh-7797/LandRegistry.git@main@-
```

---

## 🔄 PHASE 1: Worker Claims Job

### File: `src/server/worker.ts`

```javascript
DAEMON WORKER LOOP (Every 5 seconds)
├─ Line 14: const job = await claimNext()
│
├─ Log: "Worker processing job"
│  File: src/server/worker.ts:22
│  Level: INFO
│  Output: jobLog.info()
│  Location: ~/.uatu/workspace/.../runs/{timestamp}/job.log
│
└─ Calls: runAll({repo, project, branch, ...})
   File: src/services/runAll.ts
```

**Log Output:**
```json
{
  "timestamp": "2025-12-10T07:31:09.752Z",
  "level": "info",
  "message": "Worker processing job",
  "data": {
    "workerId": 1,
    "jobId": 23
  }
}
```

---

## 🚀 PHASE 2: Main Execution Pipeline

### File: `src/services/runAll.ts`

### **LOG POINT 1: Pipeline Start**
```javascript
// Line 49
log.info("Starting simplified 3-phase audit pipeline", {
  project, branch, repo, ai, testStyles
});
```
**Output Location:** PM2 logs + `~/.uatu/workspace/.../runs/{timestamp}/job.log`

---

## 📂 PHASE 2.1: Context Preparation

### **LOG POINT 2: Phase 1 Start**
```javascript
// Line 54
log.info("=== PHASE 1: Context Preparation ===");
```

### **LOG POINT 3: Git Clone Start**
```javascript
// Line 57
log.info("Step 1.1: Cloning/refreshing repository");
```
**Action:** Calls `cloneOrRefresh()` from `src/services/gitService.ts`

**Git Service Logs** (`src/services/gitService.ts`):
```javascript
// Inside cloneOrRefresh()
logger.info("Cloning repository", { repo, targetPath, branch });
// OR
logger.info("Repository already exists, pulling latest", { targetPath });
```

### **LOG POINT 4: Git Clone Complete**
```javascript
// Line 60
log.info("Step 1.1: Repository ready");
```

### **LOG POINT 5: Create Run Directory**
```javascript
// Line 65
log.info("Step 1.2: Creating run directory", { runPath, timestamp });
```
**Creates:** `~/.uatu/workspace/users/{user}/projects/{project}/branches/{branch}/runs/{timestamp}/`

### **LOG POINT 6: Job Started**
```javascript
// Line 71
jobFileLog.info("Job started", { project, branch, repo, jobId, timestamp });
```
**Output File:** `~/.uatu/workspace/.../runs/{timestamp}/job.log`
```json
{
  "timestamp": "2025-12-10T07:31:10.657Z",
  "level": "info",
  "message": "Job started",
  "data": {
    "project": "LandRegistry",
    "branch": "main",
    "repo": "https://github.com/saurabh-7797/LandRegistry.git",
    "jobId": 23,
    "timestamp": "1765351870553"
  }
}
```

### **LOG POINT 7: Progress Initialization**
```javascript
// Line 74
log.info("Step 1.3: Initializing progress tracking");
jobFileLog.info("Initializing progress tracking");
```

### **LOG POINT 8: Progress Initialized**
```javascript
// Line 79
log.info("Step 1.3: Progress initialized", { jobId, timestamp });
```
**Creates:** `~/.uatu/workspace/.../runs/{timestamp}/progress.json`
```json
{
  "project": "LandRegistry",
  "branch": "main",
  "timestamp": "1765351870553",
  "overall_pct": 0,
  "phases": [
    {"name": "bootstrap", "pct": 0, "step": "initializing"},
    {"name": "inventory", "pct": 0, "step": "waiting"},
    {"name": "analysis", "pct": 0, "step": "waiting"},
    {"name": "testgen", "pct": 0, "step": "waiting"},
    {"name": "execute", "pct": 0, "step": "waiting"}
  ],
  "last_event": "Starting audit..."
}
```

---

## 🔧 PHASE 2.2: Bootstrap SOP

### **LOG POINT 9: Bootstrap Start**
```javascript
// Line 98
log.info("Step 1.4: Running Bootstrap SOP");
```

### File: `src/sops/bootstrap.ts`

### **LOG POINT 10: Bootstrap SOP Starting**
```javascript
// Line ~50
logger.info("Bootstrap SOP starting", { projectPath });
```
**Output File:** `~/.uatu/workspace/.../runs/{timestamp}/cli.log`
```json
{
  "timestamp": "2025-12-10T07:31:10.673Z",
  "level": "info",
  "message": "Bootstrap SOP starting",
  "data": {
    "projectPath": "/home/azureuser/.uatu/workspace/users/azureuser/projects/LandRegistry/branches/main"
  }
}
```

### **LOG POINT 11: Progress - Project Detection**
```javascript
// Calls onProgress()
await onProgress({ phase: "bootstrap", step: "project-detection", pct: 25 });
```
**Updates:** `progress.json`
```json
{
  "timestamp": "2025-12-10T07:31:10.677Z",
  "level": "info",
  "message": "Progress: bootstrap",
  "data": {
    "step": "project-detection",
    "pct": 25,
    "overall": 3
  }
}
```

### **LOG POINT 12: Ecosystem Detection**
```javascript
logger.info("Detecting project ecosystems...");
```

### File: `src/services/ecosystemDetector.ts`
```javascript
// Logs detected ecosystems
logger.info("Detected ecosystems", {
  foundry, hardhat, anchor, soroban, nodejs
});
```

### **LOG POINT 13: Project Structure Analysis**
```javascript
logger.info("Analyzing project structure...");
```

### File: `src/services/projectAnalyzer.ts`
```javascript
// Analyzes directory structure, counts files, finds contracts
logger.info("Project analysis completed", {
  detectedEcosystems: ["hardhat", "nodejs"],
  secondaryEcosystems: [],
  recommendation: "Multi-ecosystem project detected...",
  totalFiles: 148,
  hasTests: false
});
```
**Output:**
```json
{
  "timestamp": "2025-12-10T07:31:10.750Z",
  "level": "info",
  "message": "Project analysis completed",
  "data": {
    "detectedEcosystems": ["hardhat", "nodejs"],
    "secondaryEcosystems": [],
    "recommendation": "Multi-ecosystem project detected: hardhat, nodejs. Consider separate audit configurations.",
    "totalFiles": 148,
    "hasTests": false
  }
}
```

### **LOG POINT 14: Progress - Dependency Fingerprint**
```javascript
await onProgress({ phase: "bootstrap", step: "dependency-fingerprint", pct: 50 });
```

### **LOG POINT 15: Progress - Context Built**
```javascript
await onProgress({ phase: "bootstrap", step: "context-built", pct: 90 });
```

### **LOG POINT 16: Progress - Ready Marked**
```javascript
await onProgress({ phase: "bootstrap", step: "ready-marked", pct: 100 });
```

### **LOG POINT 17: Bootstrap Complete**
```javascript
// Line 762
logger.info("Bootstrap SOP completed successfully");
```
**Output:**
```json
{
  "timestamp": "2025-12-10T07:31:10.762Z",
  "level": "info",
  "message": "Bootstrap SOP completed successfully"
}
```

### Back to `runAll.ts`

### **LOG POINT 18: Bootstrap SOP Completed**
```javascript
// Line 117
log.info("Step 1.4: Bootstrap SOP completed");
```

---

## 📝 PHASE 2.3: Write Context Files

### **LOG POINT 19: Context Files Start**
```javascript
// Line 120
log.info("Step 1.5: Writing context files");
```

### File: `src/services/contextWriter.ts`

### **LOG POINT 20: files_structure.md**
```javascript
// Line 132
await writeFilesStructure(contextWriterOptions);
log.info("Step 1.5a: files_structure.md written");
```
**Creates:** `~/.uatu/workspace/.../. uatu/context/files_structure.md`

**Content Example:**
```markdown
# Project Structure

## contracts/LandRegistry.sol
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract LandRegistry {
    mapping(uint256 => address) public landOwners;
    ...
}
```

### **LOG POINT 21: test_requirements.md**
```javascript
// Line 135
await writeTestRequirements(contextWriterOptions);
log.info("Step 1.5b: test_requirements.md written");
```
**Creates:** `~/.uatu/workspace/.../. uatu/context/test_requirements.md`

### **LOG POINT 22: milestones.md**
```javascript
// Line 138
await writeMilestones(contextPath, "NOT_STARTED");
log.info("Step 1.5c: milestones.md written");
```
**Creates:** `~/.uatu/workspace/.../. uatu/context/milestones.md`

### **LOG POINT 23: results.json Initialized**
```javascript
// Line 141
await initResultsJson(contextPath);
log.info("Step 1.5d: results.json initialized");
```
**Creates:** `~/.uatu/workspace/.../. uatu/context/results.json`
```json
{
  "findings": [],
  "analysis": {},
  "score": { "value": 0, "grade": "N/A" }
}
```

### **LOG POINT 24: Context Ready**
```javascript
// Line 144
await onProgress({ phase: "context", step: "context-ready", pct: 100 });
log.info("=== PHASE 1 COMPLETE ===");
```

---

## 🤖 PHASE 3: Claude CLI Audit (Milestone Framework)

### **LOG POINT 25: Phase 2 Start**
```javascript
// Line 150
log.info("=== PHASE 2: Single Claude CLI Audit ===");
```

### **LOG POINT 26: Claude Health Check**
```javascript
// Line 154
log.info("Performing Claude CLI health check...");
```

### File: `src/utils/claudeHealthCheck.ts`
```javascript
// Executes: claude --version
logger.info("Claude CLI health check passed", { version });
```

### **LOG POINT 27: Health Check Passed**
```javascript
// Line 157
log.info("Claude CLI health check passed - ready for audit");
```

### **LOG POINT 28: Timeout Calculation**
```javascript
// Line 179
log.info("Calculated dynamic session timeout", {
  contractCount,
  baseTimeoutMin: 15,
  sessionTimeoutMin,
  sessionTimeoutMs,
  formula: `max(15, ${contractCount} × 0.5)`
});
```
**Output:**
```
Calculated dynamic session timeout: {
  contractCount: 1,
  baseTimeoutMin: 15,
  sessionTimeoutMin: 15,
  sessionTimeoutMs: 900000,
  formula: "max(15, 1 × 0.5)"
}
```

### **LOG POINT 29: Framework Mode Selected**
```javascript
// Line 192
log.info("Step 2.1: Starting Deep Intelligence Framework (5-Milestone Pipeline)", {
  contractCount,
  overallTimeoutMinutes: Math.round(auditTimeoutMs / 60000),
  mode: "MILESTONE_FRAMEWORK"
});
```

### **LOG POINT 30: Loading Project Context**
```javascript
// Line 199
log.info("\n📂 Loading project context (flattened source code)...");
log.info(`   Context path: ${filesStructurePath}`);
```

### **LOG POINT 31: Context File Check**
```javascript
// Line 206
log.info(`   ✓ File exists, reading...`);
```

### **LOG POINT 32: Context Loaded**
```javascript
// Line 208
log.info(`   ✅ Loaded project context: ${projectContext.length} chars`);
log.info(`   Preview: ${preview}...`);
```
**Output:**
```
   ✅ Loaded project context: 3456 chars
   Preview: # Project Structure  ## contracts/LandRegistry.sol  ```solidity // SPDX-License-Identifier...
```

### **LOG POINT 33: Milestone Executor Init**
```javascript
// Line 221
log.info("\n🎯 Initializing Milestone Executor:");
log.info(`   Job ID: ${jobId?.toString() || 'unknown'}`);
log.info(`   Project path: ${branchPath}`);
log.info(`   Project context: ${projectContext ? `${projectContext.length} chars` : 'none'}`);
log.info(`   Domain: auto-detect`);
log.info(`   Audit depth: standard`);
```

### **LOG POINT 34: Executor Initialized**
```javascript
// Line 236
log.info(`   ✅ MilestoneExecutor initialized`);
```

---

## 🎯 MILESTONE EXECUTION LOOP (1 → 5)

### File: `src/sops/milestoneExecutor.ts`

---

### 🔹 MILESTONE 1: Context Ingestion

### **LOG POINT 35: Milestone 1 Start**
```javascript
// Line 172-175
log.info(`\n${'='.repeat(80)}`);
log.info(`🎯 Starting Milestone 1: Context Ingestion`);
log.info(`   Read and understand the entire codebase, build mental model`);
log.info(`${'='.repeat(80)}\n`);
```
**Output:**
```
================================================================================
🎯 Starting Milestone 1: Context Ingestion
   Read and understand the entire codebase, build mental model
================================================================================
```

### **LOG POINT 36: Validate Inputs**
```javascript
// Line 186-188
log.info(`📋 Validating inputs for Milestone 1:`);
log.info(`   Required: projectPath, projectContext`);
log.info(`   Provided: projectPath, projectContext`);
```

### **LOG POINT 37: Building Prompt**
```javascript
// Line 220 (in buildMilestonePrompt)
log.info(`📝 Building prompt for Milestone ${milestoneNumber}:`);
log.info(`   System prompt: loaded from .claude/system.md`);
log.info(`   Milestone prompt: loaded from .claude/milestones/m1-context-ingestion.md`);
```

### **LOG POINT 38: Persona Selection**
```javascript
// Line 250
log.info(`   Persona: ${domain || 'auto-detecting...'}`);
```

### **LOG POINT 39: Methodology Loading**
```javascript
// Line 280
log.info(`   Methodologies: ${methodologies.join(', ')}`);
```

### **LOG POINT 40: Prompt Built**
```javascript
// Line 320
log.info(`   ✅ Prompt built: ${promptText.length} characters`);
```
**Output:**
```
   ✅ Prompt built: 46403 characters
```

### **LOG POINT 41: Executing Claude CLI**
```javascript
// Line 340
log.info(`\n🚀 Executing Claude CLI for Milestone 1...`);
log.info(`   Timeout: ${config.timeout / 60000} minutes`);
```

### File: `src/services/ai/claudeCLIProvider.ts`

### **LOG POINT 42: Creating Temp File** ✅ ARG_MAX FIX
```javascript
// Line 150 (in createTempPromptFile)
log.debug(`[${sessionId}] Created temp prompt file: ${tempFile} (${prompt.length} bytes)`);
```
**Output:**
```
[claude-1765351974327-whl5kddlt] Created temp prompt file: /tmp/claude-prompt-claude-1765351974327-whl5kddlt-OG7QTQ/prompt.txt (46403 bytes)
```

### **LOG POINT 43: Spawning PTY Process**
```javascript
// Line 240
log.info(`[${sessionId}] Spawning Claude CLI process`);
log.debug(`[${sessionId}] Method: STDIN (file-based context passing)`);
log.debug(`[${sessionId}] Command: cat "${tempPromptFile}" | ${getCLIPath()} --print`);
log.debug(`[${sessionId}] Temp File: ${tempPromptFile}`);
```
**Output:**
```
[claude-1765351974327-whl5kddlt] Spawning Claude CLI process
[claude-1765351974327-whl5kddlt] Method: STDIN (file-based context passing)
[claude-1765351974327-whl5kddlt] Command: cat "/tmp/claude-prompt-claude-1765351974327-whl5kddlt-OG7QTQ/prompt.txt" | /home/azureuser/.local/bin/claude --print
[claude-1765351974327-whl5kddlt] Temp File: /tmp/claude-prompt-claude-1765351974327-whl5kddlt-OG7QTQ/prompt.txt
```

### **LOG POINT 44: PTY Process Spawned**
```javascript
// Line 265
log.info(`[${sessionId}] PTY process spawned successfully (using stdin from temp file)`);
```

### **LOG POINT 45: Claude Processing** (No logs - silent while thinking)
```
⏳ Claude is analyzing the codebase...
   (This can take several minutes)
```

### **LOG POINT 46: Output Received**
```javascript
// Line 320 (on PTY exit)
log.info(`[${sessionId}] Claude CLI process completed`);
log.info(`[${sessionId}] Exit code: ${code}`);
log.info(`[${sessionId}] Output size: ${outputBuffer.length} bytes`);
```
**Output:**
```
[claude-1765351974327-whl5kddlt] Claude CLI process completed
[claude-1765351974327-whl5kddlt] Exit code: 0
[claude-1765351974327-whl5kddlt] Output size: 12456 bytes
```

### **LOG POINT 47: Cleanup Temp File**
```javascript
// Line 340
log.debug(`[${sessionId}] Cleaned up temp file: ${tempPromptFile}`);
```

### **LOG POINT 48: Parsing JSON Response**
```javascript
// Line 380
log.info(`[${sessionId}] Parsing Claude CLI response...`);
```

### **LOG POINT 49: JSON Validation**
```javascript
// Line 390
log.info(`[${sessionId}] Response parsed successfully`);
log.debug(`[${sessionId}] Response contains: ${Object.keys(parsedResponse).join(', ')}`);
```

### Back to `milestoneExecutor.ts`

### **LOG POINT 50: Milestone 1 Complete**
```javascript
// Line 250
log.info(`✅ Milestone 1 completed successfully`);
log.info(`   Duration: ${duration}s`);
log.info(`   Files analyzed: ${output.files_analyzed}`);
log.info(`   Contracts found: ${output.contracts_found}`);
```
**Output:**
```
✅ Milestone 1 completed successfully
   Duration: 94s
   Files analyzed: 1
   Contracts found: 1
```

### **LOG POINT 51: Saving State**
```javascript
// Line 270
log.info(`💾 Saving milestone state to disk...`);
```
**Writes:** `~/.uatu/workspace/.../context/milestone_state.json`

---

### 🔹 MILESTONE 2: Static & Structural Analysis

### **LOG POINT 52: Milestone 2 Start**
```javascript
log.info(`\n${'='.repeat(80)}`);
log.info(`🎯 Starting Milestone 2: Static & Structural Analysis`);
log.info(`   Pattern-based vulnerability detection and architectural analysis`);
log.info(`${'='.repeat(80)}\n`);
```

### **LOG POINT 53-65:** (Same logging pattern as Milestone 1)
- Validate inputs
- Build prompt (loads m2-static-analysis.md + access-control methodology)
- Create temp file
- Execute Claude CLI
- Parse response
- Save results

### **LOG POINT 66: Milestone 2 Complete**
```javascript
log.info(`✅ Milestone 2 completed successfully`);
log.info(`   Duration: ${duration}s`);
log.info(`   Static findings: ${output.findings?.length || 0}`);
```

---

### 🔹 MILESTONE 3: Deep Logic Simulation

### **LOG POINT 67: Milestone 3 Start**
```javascript
log.info(`\n${'='.repeat(80)}`);
log.info(`🎯 Starting Milestone 3: Deep Logic Simulation`);
log.info(`   Chain-of-Thought reasoning for complex attack scenarios`);
log.info(`${'='.repeat(80)}\n`);
```

### **LOG POINT 68-80:** (Same pattern + loads all methodologies)

### **LOG POINT 81: Milestone 3 Complete**
```javascript
log.info(`✅ Milestone 3 completed successfully`);
log.info(`   Duration: ${duration}s`);
log.info(`   Attack scenarios tested: ${output.attack_scenarios_tested}`);
```

---

### 🔹 MILESTONE 4: Verification Test Generation

### **LOG POINT 82: Milestone 4 Start**
```javascript
log.info(`\n${'='.repeat(80)}`);
log.info(`🎯 Starting Milestone 4: Verification Test Generation`);
log.info(`   Generate executable PoC tests for critical findings`);
log.info(`${'='.repeat(80)}\n`);
```

### **LOG POINT 83-95:** (Same pattern)

### **LOG POINT 96: Milestone 4 Complete**
```javascript
log.info(`✅ Milestone 4 completed successfully`);
log.info(`   Duration: ${duration}s`);
log.info(`   Tests generated: ${output.tests_generated}`);
```

---

### 🔹 MILESTONE 5: Final Consolidation

### **LOG POINT 97: Milestone 5 Start**
```javascript
log.info(`\n${'='.repeat(80)}`);
log.info(`🎯 Starting Milestone 5: Final Consolidation`);
log.info(`   Combine findings, calculate score, generate recommendations`);
log.info(`${'='.repeat(80)}\n`);
```

### **LOG POINT 98: Loading All Previous Findings**
```javascript
log.info(`📊 Loading findings from previous milestones:`);
log.info(`   Milestone 2: ${m2Findings.length} findings`);
log.info(`   Milestone 3: ${m3Findings.length} findings`);
log.info(`   Milestone 4: ${m4Findings.length} findings`);
log.info(`   Total to consolidate: ${allFindings.length} findings`);
```

### **LOG POINT 99-111:** (Same pattern)

### **LOG POINT 112: Milestone 5 Complete**
```javascript
log.info(`✅ Milestone 5 completed successfully`);
log.info(`   Duration: ${duration}s`);
log.info(`   Final score: ${output.audit_report.score.value}/100`);
log.info(`   Grade: ${output.audit_report.score.grade}`);
log.info(`   Total findings: ${output.audit_report.findings.summary.total}`);
```
**Output:**
```
✅ Milestone 5 completed successfully
   Duration: 432s
   Final score: 67/100
   Grade: C
   Total findings: 12
```

---

## 📊 PHASE 4: Results Consolidation

### Back to `runAll.ts`

### **LOG POINT 113: Framework Complete**
```javascript
// Line 247
log.info("Step 2.1: Deep Intelligence Framework completed successfully");
```

### **LOG POINT 114: Writing Results**
```javascript
// Line 269
log.info("Step 2.1: Deep Intelligence Framework results written to results.json", {
  score: unifiedReport.score?.value,
  grade: unifiedReport.score?.grade,
  totalFindings: unifiedReport.findings?.summary?.total
});
```
**Writes:** `~/.uatu/workspace/.../context/results.json`

```json
{
  "metadata": {
    "repo": "https://github.com/saurabh-7797/LandRegistry.git",
    "branch": "main",
    "timestamp": "2025-12-10T08:00:00.000Z",
    "duration_seconds": 1800,
    "status": "completed",
    "framework": "deep-intelligence-v1",
    "milestones_completed": 5
  },
  "score": {
    "value": 67,
    "grade": "C",
    "breakdown": { ... }
  },
  "findings": {
    "summary": {
      "total": 12,
      "critical": 2,
      "high": 4,
      "medium": 5,
      "low": 1
    },
    "details": [ ... ]
  }
}
```

---

## 📄 PHASE 5: Report Generation

### **LOG POINT 115: Phase 3 Start**
```javascript
// Line 350 (runAll.ts)
log.info("=== PHASE 3: Report Generation ===");
```

### **LOG POINT 116: Loading Results**
```javascript
// Line 360
log.info("Step 3.1: Loading audit results from results.json");
```

### File: `src/services/report/simpleReportGenerator.ts`

### **LOG POINT 117: Report Generator Start**
```javascript
// Line 50
log.info("Generating HTML report from results.json", {
  resultsPath: contextResultsPath,
  project,
  branch
});
```

### **LOG POINT 118: Loading Template**
```javascript
// Line 80
log.info("Loading HTML template from src/templates/report-template.html");
```

### **LOG POINT 119: Injecting Data**
```javascript
// Line 120
log.info("Injecting audit data into template", {
  findingsCount: results.findings?.summary?.total,
  score: results.score?.value,
  grade: results.score?.grade
});
```

### **LOG POINT 120: Writing HTML**
```javascript
// Line 150
log.info("Writing HTML report", { outputPath: htmlPath });
```
**Creates:** `~/.uatu/workspace/.../runs/{timestamp}/report.html`

### **LOG POINT 121: HTML Report Complete**
```javascript
// Line 160
log.info("HTML report generated successfully", {
  path: htmlPath,
  size: `${(stat.size / 1024).toFixed(2)} KB`
});
```

### **LOG POINT 122: PDF Generation (Optional)**
```javascript
// Line 180
log.info("Generating PDF from HTML...");
```

### File: `src/services/pdfGenerator.ts`

### **LOG POINT 123: Puppeteer Launch**
```javascript
// Line 30
log.info("Launching Puppeteer browser...");
```

### **LOG POINT 124: PDF Created**
```javascript
// Line 50
log.info("PDF generated successfully", {
  path: pdfPath,
  size: `${(stat.size / 1024).toFixed(2)} KB`
});
```
**Creates:** `~/.uatu/workspace/.../runs/{timestamp}/report.pdf`

---

## ✅ PHASE 6: Job Completion

### Back to `runAll.ts`

### **LOG POINT 125: Phase 3 Complete**
```javascript
// Line 400
log.info("=== PHASE 3 COMPLETE ===");
log.info("All phases completed successfully", {
  htmlPath,
  pdfPath,
  score,
  grade
});
```

### Back to `worker.ts`

### **LOG POINT 126: Job Complete**
```javascript
// Line 36-42
await complete(job.id, true, htmlPath);
jobLog.info(`Job completed successfully`, {
  htmlPath,
  score,
  grade,
  workerId
});
```

### File: `src/services/jobQueue.ts`

### **LOG POINT 127: Update Job Status**
```javascript
// In complete()
log.info(`Job ${jobId} marked as ${success ? 'completed' : 'failed'}`, {
  reportPath: success ? htmlPath : undefined
});
```

**Updates:** `~/.uatu/queue/jobs.json`
```json
{
  "id": 23,
  "status": "done",
  "pct": 100,
  "finishedAt": "2025-12-10T08:00:00.000Z",
  "reportPath": "/home/azureuser/.uatu/workspace/.../runs/1765351870553/report.html",
  "note": "execute: report-complete"
}
```

---

## 📥 PHASE 7: User Downloads Report

### User Browser Request

```
GET /report?project=LandRegistry&branch=main&format=html
```

### File: `src/server/routes/reports.ts`

### **LOG POINT 128: Report Request**
```javascript
// Line 20
log.info("Report requested", {
  project,
  branch,
  format,
  userAgent: req.headers['user-agent']
});
```

### **LOG POINT 129: Resolving Report Path**
```javascript
// Line 40
log.info("Resolving report path", { runsPath, lastRun });
```

### **LOG POINT 130: Serving Report**
```javascript
// Line 60
log.info("Serving report", {
  path: reportPath,
  format,
  size: stat.size
});
```

### **Response Headers:**
```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 245678
Content-Disposition: inline; filename="LandRegistry-audit-report.html"
```

---

## 📊 COMPLETE FILE LOCATIONS

### **Logs Written During Execution:**

```
~/.uatu/
├── queue/
│   └── jobs.json                                    # Job queue state
│
├── workspace/users/{user}/projects/{project}/branches/{branch}/
│   ├── .uatu/
│   │   ├── context/
│   │   │   ├── files_structure.md                   # Flattened source code
│   │   │   ├── test_requirements.md                 # Test style requirements
│   │   │   ├── milestones.md                        # Milestone tracking
│   │   │   ├── results.json                         # Final consolidated results
│   │   │   ├── milestone_state.json                 # Milestone execution state
│   │   │   └── project-structure.json               # Analyzed project structure
│   │   │
│   │   └── sop/
│   │       ├── bootstrap-ready.json                 # Bootstrap completion marker
│   │       └── context-ready.json                   # Context ready marker
│   │
│   └── runs/{timestamp}/
│       ├── job.log                                  # Job-specific logs (JSON)
│       ├── cli.log                                  # Bootstrap SOP logs
│       ├── progress.json                            # Real-time progress tracking
│       ├── milestone-1-context.json                 # Milestone 1 output
│       ├── milestone-2-static.json                  # Milestone 2 output
│       ├── milestone-3-logic.json                   # Milestone 3 output
│       ├── milestone-4-exploits.json                # Milestone 4 output
│       ├── milestone-5-consolidated.json            # Milestone 5 output
│       ├── report.html                              # Final HTML report
│       └── report.pdf                               # Final PDF report
│
└── logs/
    ├── pm2-out.log                                  # PM2 daemon stdout
    └── pm2-error.log                                # PM2 daemon stderr
```

### **Temp Files (During Execution):**

```
/tmp/
└── claude-prompt-{sessionId}-{random}/
    └── prompt.txt                                   # Temp prompt file (deleted after use)
```

---

## 🎯 SUMMARY: Log Points by Phase

| Phase | Log Points | Duration | Key Files |
|-------|-----------|----------|-----------|
| **0. Enqueue** | 1 | < 1s | `jobs.json` |
| **1. Worker Claim** | 1 | < 1s | `worker.ts` |
| **2.1. Context Prep** | 24 | ~2s | `runAll.ts`, `bootstrap.ts`, `contextWriter.ts` |
| **2.2. Milestone 1** | 17 | ~94s | `milestoneExecutor.ts`, `claudeCLIProvider.ts` |
| **2.3. Milestone 2** | 17 | ~300s | Same as Milestone 1 |
| **2.4. Milestone 3** | 17 | ~450s | Same as Milestone 1 |
| **2.5. Milestone 4** | 17 | ~280s | Same as Milestone 1 |
| **2.6. Milestone 5** | 17 | ~432s | Same as Milestone 1 |
| **3. Consolidation** | 3 | ~5s | `runAll.ts` |
| **4. Report Gen** | 10 | ~15s | `simpleReportGenerator.ts`, `pdfGenerator.ts` |
| **5. Completion** | 3 | < 1s | `worker.ts`, `jobQueue.ts` |
| **6. Download** | 3 | < 1s | `reports.ts` |
| **TOTAL** | **130** | **~1800s (30 min)** | **15 files** |

---

## 🔍 How to Monitor Logs in Real-Time

### **1. PM2 Logs (Daemon Output)**
```bash
pm2 logs 0 --lines 100
```

### **2. Job-Specific Logs (UI Streaming)**
```bash
tail -f ~/.uatu/workspace/users/azureuser/projects/LandRegistry/branches/main/runs/{timestamp}/job.log
```

### **3. CLI Logs (Bootstrap)**
```bash
tail -f ~/.uatu/workspace/.../runs/{timestamp}/cli.log
```

### **4. Progress Tracking**
```bash
watch -n 1 'cat ~/.uatu/workspace/.../runs/{timestamp}/progress.json | jq .'
```

### **5. Milestone State**
```bash
watch -n 5 'cat ~/.uatu/workspace/.../context/milestone_state.json | jq .'
```

### **6. Claude CLI Process**
```bash
ps aux | grep claude
# Check process runtime:
ps -p {PID} -o pid,etime,cmd
```

### **7. Temp Files (ARG_MAX Fix)**
```bash
ls -lh /tmp/claude-prompt-*/
cat /tmp/claude-prompt-*/prompt.txt | head -50
```

---

## ✅ COMPLETE! Every Single Log Point Documented

**Total Execution:** GitHub → 130 Log Points → Final Report

No steps skipped! 🎉

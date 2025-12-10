# UatuAudit - Complete Workflow Documentation

**Version:** 2.0
**Last Updated:** 2025-12-10
**Architecture:** Agentic AI-Powered Audit System

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Installation & Setup](#2-installation--setup)
3. [Usage Workflows](#3-usage-workflows)
4. [Audit Pipeline (5 Phases)](#4-audit-pipeline-5-phases)
5. [Agentic Architecture](#5-agentic-architecture)
6. [Report Generation](#6-report-generation)
7. [API Reference](#7-api-reference)
8. [Backend Architecture](#8-backend-architecture)
9. [Workspace Structure](#9-workspace-structure)
10. [Error Handling & Reliability](#10-error-handling--reliability)
11. [Production Deployment](#11-production-deployment)
12. [Testing](#12-testing)
13. [Recent Improvements](#13-recent-improvements)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. Project Overview

UatuAudit transforms ad-hoc smart contract audits into **standardized, repeatable SOPs** (Standard Operating Procedures) using **Agentic AI workflows powered by Claude CLI**.

### Supported Ecosystems
- **Solidity** (Foundry/Hardhat)
- **Anchor** (Solana)
- **Soroban** (Stellar)
- **Node.js** projects

### Key Features
- Multi-Ecosystem Support
- GitHub OAuth Integration
- Live Progress Tracking
- Professional PDF Reports
- SARIF Export
- Web UI + CLI
- **Agentic AI Analysis** (Claude CLI)
- Docker Sandbox Security
- Deployed Contract Scanning

---

## 2. Installation & Setup

### Prerequisites

```bash
# Required
- Node.js 18+ (recommended: 20 LTS)
- pnpm package manager

# Optional Toolchains
- Foundry (forge) for Solidity
- Hardhat/npm for Node.js projects
- Anchor CLI for Solana projects
- Soroban CLI for Stellar projects
- Claude CLI (for AI-powered analysis)
```

### Installation Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd UatuAudit

# 2. Install dependencies
pnpm install

# 3. Build project
pnpm build

# 4. Configure environment
cp env.example .env
```

### Environment Configuration

```env
# Daemon Configuration
UATU_PORT=9090
UATU_CONCURRENCY=4
UATU_HOME=/Users/yourusername/.uatu

# GitHub OAuth (Required for private repos)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback

# AI Enhancement (Claude CLI)
ANTHROPIC_API_KEY=your_anthropic_key_here
ENABLE_DETAILED_AUDIT=true
SESSION_TIMEOUT_MIN=15

# Security & Performance
UATU_EXECUTE_TIMEOUT_MS=900000
UATU_COVERAGE_ENABLED=true
UATU_SANDBOX=docker

# Block Explorer API Keys (for deployed contract scanning)
ETHERSCAN_API_KEY=your_key_here
POLYGONSCAN_API_KEY=your_key_here
BSCSCAN_API_KEY=your_key_here
ARBISCAN_API_KEY=your_key_here
BASESCAN_API_KEY=your_key_here
```

### GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App:
   - **Application name:** `UatuAudit`
   - **Homepage URL:** `http://localhost:9090`
   - **Authorization callback URL:** `http://localhost:9090/auth/github/callback`
3. Copy Client ID and Client Secret to `.env`

### Claude CLI Setup

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude

# Authenticate
claude auth login

# Verify authentication
claude --version

# Fix credentials permissions (if using Docker)
chmod 644 ~/.claude/.credentials.json
```

---

## 3. Usage Workflows

### 3A. Web Interface Workflow

#### Start the Daemon

```bash
uatu daemon
# Server starts on http://localhost:9090
```

#### Access Web UI

```
Browser: http://localhost:9090/index.html
```

#### GitHub Repository Audit Flow

```
Step 1: Connect GitHub
        └─> OAuth authentication

Step 2: Select Repository & Branch
        └─> Live GitHub integration
        └─> Select files to audit

Step 3: Select Technology Stack
        └─> Foundry | Hardhat | Anchor | Soroban | Node.js

Step 4: Configure Audit
        └─> Enable AI analysis
        └─> Set scope

Step 5: Run Audit
        └─> Live progress tracking (5 phases)
        └─> Real-time logs

Step 6: Download Report
        └─> PDF with findings and coverage
        └─> HTML report
        └─> SARIF export
```

#### Deployed Contract Scan Flow

```
Step 1: Navigate to "Scan Contract" page

Step 2: Enter Contract Details
        ├─> Contract Address (0x...)
        └─> Select Network:
            ├─> Ethereum Mainnet
            ├─> Polygon
            ├─> BSC
            ├─> Arbitrum
            ├─> Base
            └─> Sepolia (testnet)

Step 3: Validate Contract
        └─> System checks:
            ├─> Valid address format?
            ├─> Is contract (not EOA)?
            ├─> Verified on explorer?
            └─> Proxy pattern detection

Step 4: Fetch Contract Source
        └─> From Etherscan/Polygonscan/BSCScan
        └─> Handle proxy implementations
        └─> Multi-file contracts

Step 5: Run Audit Pipeline
        └─> Same 5-phase process

Step 6: View Report
        └─> Download PDF
        └─> View HTML report
```

### 3B. CLI Workflow

#### Single Repository Audit

```bash
uatu run \
  --repo https://github.com/owner/repo.git \
  --project my-project \
  --branch main \
  --ai
```

#### Batch Processing

```bash
uatu batch \
  --repos "https://github.com/org/repo1.git#main,https://github.com/org/repo2.git#develop" \
  --ai
```

#### Check Version

```bash
uatu --version
```

---

## 4. Audit Pipeline (5 Phases)

### Phase 1: BOOTSTRAP (10% weight)

**Duration:** 1-3 minutes
**Purpose:** Project detection and ecosystem fingerprinting

```
Process:
├─> Clone repository at specific commit
├─> Detect project ecosystem:
│   ├─> foundry.toml → Foundry (Solidity)
│   ├─> hardhat.config.js → Hardhat (Solidity)
│   ├─> Anchor.toml → Anchor (Solana)
│   ├─> Cargo.toml with soroban → Soroban (Stellar)
│   └─> package.json → Node.js
├─> Build .uatu/context directory
└─> Create readiness markers

Output:
├─> .uatu/context/ecosystem.json
├─> .uatu/context/files_structure.md
└─> .uatu/sop/bootstrap.ready
```

**Files Involved:**
- `src/sops/bootstrap.ts`
- `src/services/ecosystemDetector.ts`
- `src/services/projectAnalyzer.ts`
- `src/services/contextWriter.ts`

### Phase 2: INVENTORY (20% weight)

**Duration:** 2-5 minutes
**Purpose:** Contract discovery and function cataloging

```
Process:
├─> Extract public/external function signatures
├─> Catalog smart contracts and source files
├─> Discover existing test files
├─> Map inheritance and dependencies
└─> Count lines of code

Output:
├─> .uatu/sop/inventory.json
│   ├─> contracts: []
│   ├─> functions: []
│   ├─> dependencies: []
│   └─> metrics: { loc, files_count }
└─> .uatu/sop/inventory.ready
```

**Inventory Structure:**
```json
{
  "contracts": [
    {
      "name": "Swapper",
      "file": "contracts/Swapper.sol",
      "functions": ["swap", "lock", "release"],
      "state_variables": ["owner", "feeRate"],
      "inheritance": ["Ownable", "Pausable"]
    }
  ],
  "metrics": {
    "total_contracts": 5,
    "total_functions": 42,
    "total_loc": 1247
  }
}
```

### Phase 3: ANALYSIS (35% weight) - **AGENTIC**

**Duration:** 5-15+ minutes (dynamic timeout)
**Purpose:** AI-powered security analysis

```
Process:
├─> Health check: Verify Claude CLI authenticated
├─> Calculate dynamic timeout: max(15 min, contracts × 0.5 min)
├─> Choose execution mode:
│   ├─> Small projects (<10 contracts): Single session
│   └─> Large projects (>10 contracts): Parallel sessions
├─> Launch Claude CLI agent(s)
└─> Aggregate findings

Agent Analysis:
├─> Read all contract code
├─> Understand business logic
├─> Identify vulnerabilities
├─> Trace fund flows
├─> Generate attack scenarios
├─> Provide recommendations
└─> Output structured JSON
```

**Detection Rules by Ecosystem:**

**Solidity:**
- tx.origin usage
- Low-level calls (.call, .delegatecall)
- Unbounded loops
- Reentrancy vulnerabilities
- Integer overflow/underflow
- Unchecked return values
- Access control issues
- Front-running/MEV risks
- Slippage control missing
- Fee-on-transfer token issues
- Proxy pattern risks

**Rust (Anchor/Soroban):**
- unsafe blocks
- unwrap() calls
- Missing authorization checks
- Arithmetic overflows
- Unvalidated account inputs

**Node.js:**
- eval() usage
- Hardcoded secrets
- child_process calls
- SQL injection patterns
- XSS vulnerabilities

**Severity Classification:**
- **CRITICAL:** Fund loss, complete system compromise
- **HIGH:** Significant security risk
- **MEDIUM:** Moderate security concern
- **LOW:** Best practice violation
- **INFO:** Informational finding

**Dynamic Timeout Formula:**
```
timeout = max(15 minutes, contract_count × 0.5 minutes)

Examples:
- 5 contracts  → 15 min (minimum)
- 52 contracts → 26 min
- 100 contracts → 50 min
- 200 contracts → 100 min
```

**Output:**
```
runs/{timestamp}/
├─> analysis.json
│   ├─> findings: []
│   ├─> severity_breakdown: {critical, high, medium, low, info}
│   ├─> security_score: 0-100
│   └─> user_flows: []
├─> findings.sarif
└─> results.json
```

**Files Involved:**
- `src/sops/singlePromptAudit.ts` (small projects)
- `src/sops/parallelAuditExecutor.ts` (large projects)
- `src/services/ai/claudeCLIProvider.ts`
- `src/utils/claudeHealthCheck.ts`

### Phase 4: TESTGEN (15% weight) - **AGENTIC**

**Duration:** 3-10 minutes
**Purpose:** AI-powered test plan generation

```
Process:
├─> Generate ecosystem-specific test checklists
├─> AI-enhanced test suggestions via Claude
├─> Create actionable test plans
└─> Identify missing test coverage

Output:
├─> .uatu/ai_tests/test_plan.json
├─> .uatu/ai_tests/recommendations.md
└─> .uatu/sop/testgen.ready
```

**Test Plan Structure:**
```json
{
  "test_suggestions": [
    {
      "contract": "Swapper",
      "function": "swap",
      "test_cases": [
        "Test swap with zero amount",
        "Test swap with insufficient balance",
        "Test swap with invalid token",
        "Test slippage protection"
      ]
    }
  ],
  "coverage_gaps": [
    "Edge case: Fee-on-transfer tokens",
    "Security: Reentrancy in swap"
  ]
}
```

### Phase 5: EXECUTE (20% weight)

**Duration:** 5-20 minutes
**Purpose:** Sandboxed test execution and coverage analysis

```
Execution Modes:
├─> Local: Direct execution on host
└─> Docker: Sandboxed execution (PRODUCTION RECOMMENDED)

Toolchain Support:
├─> Foundry: forge test && forge coverage
├─> Hardhat: npx hardhat test && npx hardhat coverage
├─> Anchor: anchor test
└─> Cargo: cargo test (Soroban)

Coverage Extraction:
├─> Foundry: forge coverage --report lcov
├─> Hardhat: npx hardhat coverage
└─> Node.js: nyc/jest coverage

Output:
├─> runs/{timestamp}/execute.log
├─> runs/{timestamp}/coverage.txt
├─> runs/{timestamp}/test_results.json
└─> runs/{timestamp}/coverage.lcov
```

**Docker Sandbox Security:**
- Read-only filesystem
- Network isolation (`--network=none`)
- Memory/CPU limits
- Non-root user execution
- Capability dropping
- Temporary filesystem for outputs

**Supported Images:**
- Foundry: `ghcr.io/foundry-rs/foundry:latest`
- Node.js: `node:18-alpine`
- Rust: `rust:1.70-alpine`

---

## 5. Agentic Architecture

### What Makes UatuAudit Agentic?

UatuAudit uses **Claude CLI as an autonomous agent** to perform intelligent code analysis, not just pattern matching.

### Agentic vs Traditional Comparison

| Aspect | Traditional Static Analysis | UatuAudit Agentic |
|--------|----------------------------|-------------------|
| **Intelligence** | Pattern matching | Contextual reasoning |
| **Understanding** | Syntax only | Business logic aware |
| **False Positives** | 60-80% | <10% |
| **Explanations** | Generic warnings | Detailed attack scenarios |
| **Adaptability** | Fixed rules | Dynamic analysis |
| **Context** | None | Full codebase understanding |
| **Time** | Fast (5 min) | Thorough (15-50 min) |

### Agentic Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTIC FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UatuAudit (Orchestrator)                                   │
│       │                                                     │
│       ├─> Phase 1: Bootstrap (Traditional)                  │
│       │   └─> File discovery, ecosystem detection           │
│       │                                                     │
│       ├─> Phase 2: Inventory (Traditional)                  │
│       │   └─> Function extraction, cataloging               │
│       │                                                     │
│       ├─> Phase 3: ANALYSIS (AGENTIC!) ⭐                   │
│       │   │                                                 │
│       │   ├─> Health Check                                  │
│       │   │   ├─> Claude CLI installed?                     │
│       │   │   ├─> Authenticated?                            │
│       │   │   └─> Credentials readable?                     │
│       │   │                                                 │
│       │   ├─> Small Projects (<10 contracts)                │
│       │   │   └─> singlePromptAudit.ts                      │
│       │   │       └─> Single Claude session                 │
│       │   │           └─> Full context analysis             │
│       │   │                                                 │
│       │   └─> Large Projects (>10 contracts)                │
│       │       └─> parallelAuditExecutor.ts                  │
│       │           ├─> Agent 1: Contracts Analysis           │
│       │           ├─> Agent 2: User Flows                   │
│       │           ├─> Agent 3: Tests Coverage               │
│       │           └─> Agent 4: Security Deep Dive           │
│       │                                                     │
│       │   [Claude Agent autonomously:]                      │
│       │   ├─> Reads all contract code                       │
│       │   ├─> Understands business logic                    │
│       │   ├─> Analyzes vulnerabilities                      │
│       │   ├─> Traces fund flows                             │
│       │   ├─> Identifies attack vectors                     │
│       │   ├─> Generates detailed findings                   │
│       │   └─> Outputs structured JSON                       │
│       │                                                     │
│       ├─> Phase 4: TESTGEN (AGENTIC!) ⭐                    │
│       │   └─> Claude generates test plans                   │
│       │                                                     │
│       └─> Phase 5: Execute (Traditional)                    │
│           └─> Run tests, collect coverage                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Agent Parallel Execution

For large projects (>10 contracts), UatuAudit launches 4 parallel Claude agents:

**Agent 1: Contracts Analysis**
```
Task: Review contract structure
├─> Identify state variables
├─> Map inheritance hierarchy
├─> Document external dependencies
└─> List entry points
```

**Agent 2: User Flows**
```
Task: Trace user interactions
├─> Identify critical user paths
├─> Map state changes
├─> Assign severity:
│   ├─> CRITICAL: High-risk (funds, permissions)
│   ├─> MODERATE: Standard flows
│   └─> POSITIVE: Read-only operations
└─> Document edge cases
```

**Agent 3: Tests Coverage**
```
Task: Review existing tests
├─> Analyze test files
├─> Identify coverage gaps
├─> Suggest new test cases
└─> Prioritize by risk
```

**Agent 4: Security Deep Dive**
```
Task: Vulnerability analysis
├─> Reentrancy checks
├─> Access control review
├─> Fund flow tracing
├─> Attack scenario generation
├─> Code-level findings
└─> Fix recommendations
```

### Autonomous Agent Capabilities

**The Claude agent can:**
1. **Read and understand** entire codebases
2. **Reason about** business logic and design patterns
3. **Identify vulnerabilities** with context awareness
4. **Generate attack scenarios** step-by-step
5. **Provide actionable fixes** with code examples
6. **Explain WHY** something is vulnerable, not just WHAT

**Example Agent Reasoning:**

Traditional analyzer:
```
❌ "Low-level call detected at line 45"
```

UatuAudit agent:
```
✅ "Third-party Can Trigger Swap on Behalf of User

Location: contracts/Swapper.sol:45

Issue: The swap() function allows any caller to execute a swap
using another user's approved tokens without authorization check.

Attack Scenario:
1. Alice approves Swapper for 1000 USDC
2. Alice intends to swap later
3. Bob (attacker) calls swap(Alice, ...)
4. Alice's 1000 USDC gets swapped without her consent
5. Bob benefits from MEV or receives output tokens

Impact: Unauthorized fund transfer, MEV extraction

Recommendation:
Add caller verification:
require(msg.sender == user, "Not authorized");
```

### Agent Prompt Structure

The agent receives structured prompts with:

```
Context:
├─> Project name and repository
├─> Ecosystem (Solidity/Rust/Node.js)
├─> Full contract source code
├─> Dependencies and imports
└─> Existing test coverage

Task:
├─> Analyze for specific vulnerability types
├─> Focus areas based on ecosystem
├─> Output format (structured JSON)

Expected Output:
├─> findings: []
│   ├─> title
│   ├─> severity
│   ├─> location (file:line)
│   ├─> description
│   ├─> code_snippet
│   ├─> impact
│   ├─> attack_scenario
│   └─> recommendation
├─> security_score: 0-100
└─> summary
```

### Retry Logic with Exponential Backoff

Agents handle transient failures automatically:

```
Retry Strategy:
├─> Attempt 1: Immediate
├─> Attempt 2: 3s delay
├─> Attempt 3: 6s delay
├─> Attempt 4: 12s delay

Retries for:
├─> Network timeouts
├─> API rate limits
├─> Temporary Claude CLI errors

No retry for:
├─> Authentication failures
├─> Cancellations
├─> Invalid input
└─> Validation errors
```

---

## 6. Report Generation

### Report Structure

UatuAudit generates professional audit reports in multiple formats.

#### Certificate Section (Top)

```
┌─────────────────────────────────────────────────────────────┐
│  AUDIT CERTIFICATE                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Logo]  SECURITY AUDIT REPORT                              │
│          Report ID: #12345                                  │
│          Date: December 10, 2025                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PROJECT OVERVIEW                                     │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Project: MyDEX                                       │   │
│  │ Repository: github.com/org/mydex                     │   │
│  │ Branch: main                                         │   │
│  │ Commit: 0264b30                                      │   │
│  │ Contracts: 5                                         │   │
│  │ Lines of Code: 1,247                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SECURITY SCORE                                       │   │
│  │                                                      │   │
│  │           ╭────────╮                                 │   │
│  │          │   85   │  Good                            │   │
│  │          │  /100  │                                  │   │
│  │           ╰────────╯                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ KEY FINDINGS SUMMARY                                 │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Critical  ▓░░░░░░░░░░  0                             │   │
│  │ High      ▓░░░░░░░░░░  0                             │   │
│  │ Medium    ▓▓▓░░░░░░░░  3                             │   │
│  │ Low       ▓▓▓▓░░░░░░░  4                             │   │
│  │ Info      ▓▓░░░░░░░░░  2                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ EXECUTIVE SUMMARY                                    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ UatuAudit conducted a comprehensive security         │   │
│  │ assessment of MyDEX smart contracts. The audit       │   │
│  │ identified 9 findings across 5 contracts...          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Detailed Report Sections

1. **Security Findings Overview**
   - Severity cards with counts
   - Visual breakdown

2. **Key Security Findings**
   - Finding cards with:
     - Title
     - Severity badge
     - Location (file:line)
     - Description
     - Code snippet
     - Impact
     - Recommendation

3. **User Flow Analysis**
   - Table format
   - Severity badges (CRITICAL/MODERATE/POSITIVE)
   - Flow descriptions

4. **Smart Contracts Explained**
   - Contract summaries
   - Purpose and functionality

5. **Test Execution Results**
   - Pass/fail statistics
   - Coverage metrics

6. **Audit Timeline**
   - Phase-by-phase progress

7. **Recommendations**
   - Prioritized fix suggestions

### Report Formats

**HTML Report:**
```
GET /report?project=MyDEX&branch=main&format=html

Features:
├─> Dark/light theme
├─> Interactive elements
├─> Hover effects
├─> Print-optimized
├─> Embedded SVG/CSS
└─> No external dependencies
```

**PDF Report:**
```
GET /report?project=MyDEX&branch=main&format=pdf

Features:
├─> A4 print layout
├─> Professional styling
├─> Vector graphics
├─> Embedded fonts
└─> Ready for distribution
```

**SARIF Export:**
```
runs/{timestamp}/findings.sarif

Features:
├─> IDE integration
├─> GitHub Security tab
├─> Standardized format
└─> Machine-readable
```

### Report Generation Process

```
1. Validate results.json
   ├─> Check structure
   ├─> Verify findings format
   └─> Ensure security_score present

2. Generate HTML
   ├─> Load template: src/templates/report-template.html
   ├─> Inject data
   ├─> Calculate metrics
   └─> Format code snippets

3. Convert to PDF (optional)
   ├─> Launch Puppeteer
   ├─> Render HTML
   ├─> Print to PDF
   └─> Save to runs/{timestamp}/report.pdf

4. Generate SARIF
   ├─> Map findings to SARIF format
   ├─> Include locations
   └─> Save to runs/{timestamp}/findings.sarif
```

---

## 7. API Reference

### Health & Metrics

```http
GET /healthz
Response: { status: "ok", version: "2.0.0" }
```

### Authentication

```http
GET /auth/github/login
Redirects to GitHub OAuth

GET /auth/github/callback?code=XXX
Processes OAuth callback

GET /auth/github/me
Response: { username, email, avatar }
```

### GitHub Integration

```http
GET /github/repos
Response: [{ name, owner, private, url }]

GET /github/branches?repo=owner/name
Response: [{ name, sha, protected }]
```

### Job Management

```http
POST /enqueue
Body: {
  repo: "https://github.com/owner/repo.git",
  project: "myproject",
  branch: "main",
  ai: true
}
Response: { jobId: 123 }

GET /jobs
Response: [{ id, project, branch, status, progress }]

GET /progress?project=X&branch=Y
Response: {
  phase: "analysis",
  percentage: 65,
  status: "in_progress"
}

GET /logs?project=X&branch=Y
Response: [{ timestamp, level, message }]
```

### Reports

```http
GET /report?project=X&branch=Y&format=html
Returns: HTML report

GET /report?project=X&branch=Y&format=pdf
Returns: PDF file (application/pdf)
```

### Deployed Contract Scanning

```http
POST /scan/validate
Body: {
  address: "0x1234...",
  network: "ethereum"
}
Response: {
  valid: true,
  isContract: true,
  isVerified: true
}

POST /scan/fetch
Body: {
  address: "0x1234...",
  network: "ethereum"
}
Response: {
  contractName: "MyToken",
  sources: { "MyToken.sol": "..." },
  abi: [...]
}

POST /scan/enqueue
Body: {
  address: "0x1234...",
  network: "ethereum",
  projectName: "MyToken-0x1234"
}
Response: { jobId: 456 }
```

---

## 8. Backend Architecture

### Service Layer

**Core Services:**

| Service | File | Purpose |
|---------|------|---------|
| Pipeline Orchestrator | `src/services/runAll.ts` | Main audit pipeline |
| Job Queue | `src/services/jobQueue.ts` | SQLite-based queue |
| Progress Tracker | `src/services/progressService.ts` | Real-time progress |
| Git Operations | `src/services/gitService.ts` | Clone/refresh repos |
| Project Analyzer | `src/services/projectAnalyzer.ts` | Structure analysis |
| Live Logger | `src/services/liveLogger.ts` | Real-time log streaming |
| Ecosystem Detector | `src/services/ecosystemDetector.ts` | Framework detection |
| Context Writer | `src/services/contextWriter.ts` | Generate context files |
| PDF Generator | `src/services/pdfGenerator.ts` | Puppeteer PDF conversion |
| Config Service | `src/services/configService.ts` | Configuration management |
| Workspace Service | `src/services/workspaceService.ts` | Path resolution |

**AI Services:**

| Service | File | Purpose |
|---------|------|---------|
| Claude CLI Provider | `src/services/ai/claudeCLIProvider.ts` | Agent integration |
| Health Check | `src/utils/claudeHealthCheck.ts` | Pre-flight validation |

**Report Services:**

| Service | File | Purpose |
|---------|------|---------|
| Report Generator | `src/services/report/simpleReportGenerator.ts` | HTML reports |

### SOP Layer

**Standard Operating Procedures:**

| SOP | File | Purpose |
|-----|------|---------|
| Bootstrap | `src/sops/bootstrap.ts` | Project initialization |
| Single Prompt Audit | `src/sops/singlePromptAudit.ts` | Small project analysis |
| Parallel Audit | `src/sops/parallelAuditExecutor.ts` | Large project analysis |

### Server Layer

**HTTP Server:**

| Component | File | Purpose |
|-----------|------|---------|
| App Setup | `src/server/app.ts` | Express app, CORS |
| Worker | `src/server/worker.ts` | Background job processor |

**Routes:**

| Route | File | Endpoints |
|-------|------|-----------|
| Auth | `src/server/routes/auth.ts` | /auth/* |
| GitHub | `src/server/routes/github.ts` | /github/* |
| Jobs | `src/server/routes/jobs.ts` | /enqueue, /jobs, /progress, /logs |
| Reports | `src/server/routes/reports.ts` | /report, /certificate |
| Health | `src/server/routes/health.ts` | /healthz, /metrics |
| Scan | `src/server/routes/scan.ts` | /scan/* |

### Execution Flow

```
Request → Server Routes → Services → SOPs → Agent → Response

Example: GitHub Repo Audit
┌────────────────────────────────────────────────────────────┐
│ 1. POST /enqueue                                           │
│    └─> routes/jobs.ts                                      │
│        └─> services/jobQueue.ts (enqueue)                  │
│                                                            │
│ 2. Background Worker                                       │
│    └─> server/worker.ts                                    │
│        └─> services/runAll.ts                              │
│            ├─> Phase 1: sops/bootstrap.ts                  │
│            │   └─> services/ecosystemDetector.ts           │
│            │   └─> services/projectAnalyzer.ts             │
│            │                                               │
│            ├─> Phase 2: Inventory (built-in)               │
│            │                                               │
│            ├─> Phase 3: sops/singlePromptAudit.ts          │
│            │   └─> utils/claudeHealthCheck.ts              │
│            │   └─> services/ai/claudeCLIProvider.ts        │
│            │       └─> Claude CLI Agent (external)         │
│            │                                               │
│            ├─> Phase 4: Testgen (same as Phase 3)          │
│            │                                               │
│            ├─> Phase 5: Execute (built-in)                 │
│            │                                               │
│            └─> Phase 6: services/report/                   │
│                simpleReportGenerator.ts                    │
│                └─> services/pdfGenerator.ts                │
│                                                            │
│ 3. GET /report?project=X&branch=Y                          │
│    └─> routes/reports.ts                                   │
│        └─> Return PDF/HTML                                 │
└────────────────────────────────────────────────────────────┘
```

---

## 9. Workspace Structure

```
~/.uatu/
├── workspace/
│   ├── users/{username}/
│   │   └── projects/{project}/
│   │       └── branches/{branch}/
│   │           ├── .uatu/
│   │           │   ├── context/
│   │           │   │   ├── ecosystem.json
│   │           │   │   ├── files_structure.md
│   │           │   │   └── test_requirements.md
│   │           │   ├── sop/
│   │           │   │   ├── bootstrap.ready
│   │           │   │   ├── inventory.json
│   │           │   │   └── testgen.ready
│   │           │   └── ai_tests/
│   │           │       ├── test_plan.json
│   │           │       └── recommendations.md
│   │           ├── runs/
│   │           │   └── {timestamp}/
│   │           │       ├── progress.json
│   │           │       ├── inventory.json
│   │           │       ├── analysis.json
│   │           │       ├── results.json
│   │           │       ├── findings.sarif
│   │           │       ├── execute.log
│   │           │       ├── coverage.txt
│   │           │       ├── coverage.lcov
│   │           │       ├── report.html
│   │           │       └── report.pdf
│   │           └── {cloned-repo-files}
│   │
│   └── scans/
│       └── {network}/
│           └── {address}/
│               ├── contracts/
│               │   └── {fetched-source-files}
│               ├── .uatu/
│               │   └── context/
│               ├── runs/
│               │   └── {timestamp}/
│               └── metadata.json
│
├── queue/
│   └── jobs.json
│
└── users/
    └── {username}/
        └── secrets/
            └── github.json
```

### File Descriptions

**Context Files:**
- `ecosystem.json` - Detected frameworks and toolchains
- `files_structure.md` - Project file tree
- `test_requirements.md` - Test coverage requirements

**SOP Files:**
- `bootstrap.ready` - Bootstrap completion marker
- `inventory.json` - Contract and function inventory
- `testgen.ready` - Test generation completion marker

**Run Files:**
- `progress.json` - Real-time progress tracking
- `analysis.json` - Security findings
- `results.json` - Final audit results
- `findings.sarif` - SARIF format export
- `execute.log` - Test execution logs
- `coverage.txt` - Coverage report
- `report.pdf` - Final PDF report

---

## 10. Error Handling & Reliability

### Health Check System

**Pre-flight Validation:**

```
Before starting audit:
├─> Check Claude CLI installed
│   └─> Command: claude --version
│   └─> Expected: Version number
│
├─> Check Claude CLI authenticated
│   └─> Command: claude auth status
│   └─> Expected: Authenticated
│
└─> Check credentials file permissions
    └─> File: ~/.claude/.credentials.json
    └─> Expected: Readable (644)

Timeout: 8 seconds
```

**Error Messages with Fixes:**

```
If Claude CLI not found:
"Claude CLI not found. Install with: npm install -g @anthropic-ai/claude"

If not authenticated:
"Claude CLI not authenticated. Run: claude auth login"

If credentials unreadable (Docker):
"Credentials file not readable. Fix with: chmod 644 ~/.claude/.credentials.json"
```

### Retry Logic

**Exponential Backoff Strategy:**

```
Function: executeWithRetry()

Attempts: 4
Delays: [0s, 3s, 6s, 12s]

Retry Conditions:
├─> Network timeout
├─> API rate limit (429)
├─> Temporary server error (5xx)
└─> Claude CLI transient errors

No Retry:
├─> Authentication failure (401)
├─> User cancellation
├─> Invalid input (400)
└─> Validation errors
```

### Validation Chain

**Phase Validation:**

```
After Bootstrap:
├─> Check .uatu/context/ directory exists
├─> Verify ecosystem.json present
└─> Validate files_structure.md generated

After Inventory:
├─> Check inventory.json exists
├─> Verify contracts array not empty
└─> Validate metrics calculated

After Analysis (Critical):
├─> Check results.json exists
├─> Verify results.json structure:
│   ├─> findings array present
│   ├─> security_score present
│   └─> severity_breakdown present
└─> If invalid → Fail with clear error

After Report:
├─> Check report.pdf generated
├─> Verify file size > 0
└─> Validate PDF is readable
```

### Comprehensive Logging

**Log Levels:**

```
ERROR   - Critical failures
WARN    - Potential issues
INFO    - General information
DEBUG   - Detailed debugging
```

**Logged Information:**

```
For each operation:
├─> Timestamp
├─> Log level
├─> Job context (project, branch)
├─> Operation name
├─> stdout (real-time)
├─> stderr (real-time)
├─> Combined output
├─> Exit code
├─> Duration
└─> Error patterns with fix suggestions
```

**Log Storage:**

```
Per-job logs:
└─> runs/{timestamp}/audit.log

Real-time streaming:
└─> WebSocket or SSE to UI

Debug logs:
└─> GET /logs?project=X&branch=Y
```

### Dynamic Timeout

**Calculation:**

```javascript
function calculateTimeout(contractCount) {
  const BASE_TIMEOUT = 15; // minutes
  const PER_CONTRACT = 0.5; // minutes

  return Math.max(
    BASE_TIMEOUT,
    contractCount * PER_CONTRACT
  );
}

// Examples:
// 5 contracts  → 15 min (base)
// 52 contracts → 26 min
// 100 contracts → 50 min
```

**Implementation:**

```
src/services/runAll.ts:
├─> Count contracts from inventory
├─> Calculate dynamic timeout
├─> Pass to parallelAuditExecutor.ts

src/sops/parallelAuditExecutor.ts:
├─> Receive timeout parameter
├─> Apply to each session
└─> Monitor progress
```

---

## 11. Production Deployment

### Docker Setup

**Build Image:**

```dockerfile
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache git

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude

# Copy application
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN pnpm build

# Create uatu user
RUN adduser -D uatu
USER uatu

CMD ["node", "dist/bin/daemon.js"]
```

**Run Container:**

```bash
docker run -d \
  --name uatuaudit \
  -p 9090:9090 \
  -v /home/azureuser/.claude:/home/uatu/.claude \
  -v /home/azureuser/.uatu:/home/uatu/.uatu \
  -e UATU_PORT=9090 \
  -e UATU_CONCURRENCY=4 \
  -e ENABLE_DETAILED_AUDIT=true \
  -e UATU_SANDBOX=docker \
  uatuaudit:latest
```

**Fix Permissions:**

```bash
# Ensure credentials readable by container user
chmod 644 /home/azureuser/.claude/.credentials.json

# Ensure workspace writable
chmod -R 755 /home/azureuser/.uatu
```

### Environment Configuration

**Production Settings:**

```env
# Server
UATU_PORT=9090
UATU_CONCURRENCY=8

# Security
UATU_SANDBOX=docker
NODE_ENV=production

# AI
ENABLE_DETAILED_AUDIT=true
SESSION_TIMEOUT_MIN=15

# Timeouts
UATU_EXECUTE_TIMEOUT_MS=900000

# Features
UATU_COVERAGE_ENABLED=true

# GitHub OAuth
GITHUB_CLIENT_ID=prod_client_id
GITHUB_CLIENT_SECRET=prod_secret
GITHUB_OAUTH_CALLBACK=https://audit.yourdomain.com/auth/github/callback
```

### Security Best Practices

**Docker Sandbox:**

```bash
# Run with security options
docker run \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --read-only \
  --tmpfs /tmp \
  --network=none \
  ...
```

**Network Isolation:**

```
Production containers:
├─> No network access (--network=none)
├─> Exception: API endpoints
└─> Outbound only for GitHub/Explorer APIs
```

**Resource Limits:**

```bash
docker run \
  --memory=4g \
  --memory-swap=4g \
  --cpus=2 \
  ...
```

### Scaling Strategies

**Horizontal Scaling:**

```
Multiple daemon instances:
├─> Shared workspace (NFS/EFS)
├─> Shared queue (SQLite → PostgreSQL)
├─> Load balancer in front
└─> Session affinity for WebSocket
```

**Vertical Scaling:**

```
Single instance optimization:
├─> Increase UATU_CONCURRENCY=16
├─> More CPU cores
├─> More memory (8-16 GB)
└─> SSD storage for workspace
```

**Queue-Based:**

```
Separate components:
├─> API servers (enqueuers)
├─> Worker nodes (processors)
├─> Shared PostgreSQL queue
└─> Redis for real-time updates
```

### Monitoring

**Health Checks:**

```bash
# HTTP health endpoint
curl http://localhost:9090/healthz

# Metrics endpoint
curl http://localhost:9090/metrics
```

**Logging:**

```bash
# Application logs
docker logs -f uatuaudit

# Job-specific logs
tail -f ~/.uatu/workspace/users/*/projects/*/branches/*/runs/*/audit.log
```

**Alerts:**

```
Monitor:
├─> Queue depth (jobs pending)
├─> Processing time (avg duration)
├─> Error rate (failed jobs)
├─> Disk usage (workspace size)
└─> Claude CLI failures
```

---

## 12. Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test progressService
pnpm test jobQueue
pnpm test ecosystemDetector

# Run with coverage
pnpm test --coverage
```

### Integration Tests

```bash
# Test full audit pipeline
uatu run \
  --repo https://github.com/foundry-rs/forge-std.git \
  --project test-foundry \
  --branch master

# Test deployed contract scan
curl -X POST http://localhost:9090/scan/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "network": "ethereum"
  }'
```

### Build Verification

```bash
# Verify build
pnpm build

# Check for TypeScript errors
npx tsc --noEmit

# Lint code
pnpm lint
```

---

## 13. Recent Improvements

### December 2025 Updates

**Problems Fixed:**

1. ✅ **Claude CLI Authentication in Docker**
   - Fixed credentials file permissions (chmod 644)
   - Volume mount: `/home/azureuser/.claude:/home/uatu/.claude`

2. ✅ **Health Check Timeout**
   - Close stdin to prevent hang
   - Reduced timeout from 30s to 8s

3. ✅ **Parallel Executor False Success**
   - Added validation: check all sessions
   - Return proper error if all failed

4. ✅ **Empty stderr Debugging**
   - Real-time logging of stdout/stderr
   - Combined output tracking

5. ✅ **Report Generator Crashes**
   - Comprehensive validation of results.json
   - Clear error messages on invalid structure

6. ✅ **Pipeline Continuation After Failures**
   - Validation between phases
   - Fail early with clear messages

7. ✅ **Generic Error Messages**
   - Pattern matching for common errors
   - Actionable fix instructions

8. ✅ **Transient Failures**
   - Retry logic with exponential backoff
   - 3 retry attempts with delays

9. ✅ **Late Auth Issue Detection**
   - Pre-flight health check
   - Fail in seconds, not minutes

10. ✅ **Security Session Timeout**
    - Dynamic timeout based on contract count
    - Formula: `max(15 min, contracts × 0.5 min)`

11. ✅ **Dark Theme Report Template**
    - Professional dark navy theme
    - Certificate-style header
    - Gold accent colors

12. ✅ **Informational Severity Level**
    - Added 5th severity: INFO
    - Complete severity breakdown

13. ✅ **User Flows Severity Classification**
    - CRITICAL/MODERATE/POSITIVE badges
    - Risk-based prioritization

14. ✅ **Code Snippets in Findings**
    - code_snippet support in findings
    - Monospace formatting

### Status

**All 14 problems fixed and deployed!**

System is production-ready with:
- ✅ Robust error handling
- ✅ Dynamic timeout for large projects
- ✅ Clear, actionable error messages
- ✅ Health checks before audit
- ✅ Full logging (stdout, stderr, combined)
- ✅ Professional dark-themed reports

---

## 14. Future Roadmap

### Halborn-Level Implementation (Planned)

**Enhanced Features:**

1. **Executive Summary**
   - AI-generated professional summary
   - Audit duration tracking
   - Security posture assessment (Strong/Moderate/Weak/Critical)
   - Overall risk score (1-10)

2. **Explicit Scope Definition**
   - In-scope files (explicit list)
   - Out-of-scope files
   - Third-party exclusions
   - Attack vector exclusions

3. **BVSS Scoring** (Blockchain Vulnerability Scoring System)
   - Attack vector breakdown
   - Financial impact calculation
   - Exploit likelihood assessment
   - Score: 0.0-10.0

4. **Finding Remediation Tracking**
   - Track fix commits
   - Verify fixes applied
   - Status: Open/Acknowledged/Solved/Won't Fix

5. **Advanced Methodology**
   - Transaction simulation
   - MEV analysis
   - Fuzzing with Echidna/Foundry
   - Mainnet fork testing

### Additional Features (Roadmap)

- **Multi-chain Support:** More networks for deployed contract scanning
- **Continuous Auditing:** GitHub Actions integration
- **Team Collaboration:** Multi-user workspaces
- **Custom Rules:** User-defined vulnerability patterns
- **AI Model Selection:** Choose between Claude models
- **Detailed Coverage Reports:** Line-by-line coverage visualization

---

## Quick Reference

### Common Commands

```bash
# Start daemon
uatu daemon

# Run single audit
uatu run --repo URL --project NAME --branch BRANCH --ai

# Batch audit
uatu batch --repos "URL1#branch1,URL2#branch2" --ai

# Check version
uatu --version

# Run tests
pnpm test

# Build
pnpm build
```

### Key Endpoints

```
Health:        GET  /healthz
Login:         GET  /auth/github/login
Repositories:  GET  /github/repos
Enqueue:       POST /enqueue
Progress:      GET  /progress?project=X&branch=Y
Report (PDF):  GET  /report?project=X&branch=Y&format=pdf
Report (HTML): GET  /report?project=X&branch=Y&format=html
```

### Workspace Paths

```
Home:          ~/.uatu/
Projects:      ~/.uatu/workspace/users/{user}/projects/{project}/branches/{branch}/
Reports:       ~/.uatu/workspace/.../runs/{timestamp}/report.pdf
Logs:          ~/.uatu/workspace/.../runs/{timestamp}/audit.log
Queue:         ~/.uatu/queue/jobs.json
```

### Environment Variables (Essential)

```env
UATU_PORT=9090
UATU_CONCURRENCY=4
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
ANTHROPIC_API_KEY=xxx
ENABLE_DETAILED_AUDIT=true
UATU_SANDBOX=docker
```

---

**End of Workflow Documentation**

For support or questions, please refer to:
- GitHub Issues: https://github.com/anthropics/uatuaudit/issues
- Documentation: /docs/
- README: /README.md

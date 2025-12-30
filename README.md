# UatuAudit — Automated Smart Contract Audit Platform

UatuAudit transforms ad-hoc smart contract audits into **standardized, repeatable SOPs** (Standard Operating Procedures). This platform implements the **Deep Intelligence Framework** featuring multi-domain agents, milestone-based execution, and liability-weighted scoring.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UATUAUDIT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Web UI    │     │   CLI       │     │   API       │                   │
│  │  (React)    │     │ (uatu run)  │     │ (REST)      │                   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                   │
│         └───────────────────┼───────────────────┘                           │
│                             ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    HTTP SERVER (app.ts)                              │  │
│  │  • GitHub OAuth  • Job Queue  • Progress API  • Report API           │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    MASTER ORCHESTRATOR                               │  │
│  │  • Domain Detection (Web3 / Backend / Frontend)                      │  │
│  │  • Agent Routing & Message Bus                                       │  │
│  │  • Results Combination                                               │  │
│  └─────────────────────────────────┬────────────────────────────────────┘  │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         ▼                          ▼                          ▼            │
│  ┌───────────┐            ┌───────────┐            ┌───────────┐          │
│  │   WEB3    │            │  BACKEND  │            │ FRONTEND  │          │
│  │   AGENT   │            │   AGENT   │            │   AGENT   │          │
│  ├───────────┤            ├───────────┤            ├───────────┤          │
│  │ Solidity  │            │ OWASP     │            │ React/Vue │          │
│  │ Foundry   │            │ API Sec   │            │ XSS/DOM   │          │
│  │ Hardhat   │            │ Injection │            │ State     │          │
│  └───────────┘            └───────────┘            └───────────┘          │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    5-MILESTONE EXECUTOR                              │  │
│  │                                                                      │  │
│  │  M1 Context ──► M2 Static ──► M3 Logic ──► M4 Tests ──► M5 Report   │  │
│  │     10min          30min        60min       30min        10min       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    STORAGE & SERVICES                                │  │
│  │  • Job Queue (SQLite)  • Prompt Cache  • Liability Map               │  │
│  │  • Progress Tracking   • Live Logs     • Report Generator            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Deep Intelligence Framework (Implemented)

| Feature | Status | Description |
|---------|--------|-------------|
| **5-Milestone Pipeline** | ✅ Complete | Context → Static → Logic → Tests → Report |
| **Domain Agents** | ✅ Complete | Web3, Backend, Frontend specialized analysis |
| **Master Orchestrator** | ✅ Complete | Routes to appropriate agents, combines results |
| **Prompt Caching** | ✅ Complete | 4-layer cache for cost reduction |
| **Liability-Weighted Scoring** | ✅ Complete | INTERNAL vs EXTERNAL component scoring |
| **Chain-of-Thought Reasoning** | ✅ Complete | Step-by-step vulnerability detection |
| **Milestone State Persistence** | ✅ Complete | Resume interrupted audits |
| **Deterministic Scanners** | ✅ Complete | Slither, Semgrep integration |

### Platform Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Multi-Ecosystem Support** | ✅ Complete | Solidity, Anchor, Soroban, Node.js, Go |
| **GitHub OAuth Integration** | ✅ Complete | Private repo access, PR integration |
| **Real-Time Progress** | ✅ Complete | 5-phase weighted progress tracking |
| **Professional Reports** | ✅ Complete | PDF/HTML with embedded assets |
| **Quick Scan** | ✅ Complete | Deployed contract analysis |
| **Job Queue** | ✅ Complete | Persistent with retry logic |

---

## Complete Audit Flow

### Phase 1: Context Preparation (10%)
```
User Request
     ↓
POST /enqueue
     ↓
┌─────────────────────────────────────┐
│ 1.1 Clone/Refresh Repository        │
│ 1.2 Run Fingerprint Detection       │
│     • Repo shape (monorepo/standard)│
│     • Ecosystem (Foundry/Hardhat)   │
│     • Node.js, Rust, Solidity       │
│ 1.3 Run Deterministic Scanners      │
│     • Slither (if Solidity)         │
│     • Semgrep                       │
│ 1.4 Write Context Files             │
│     • files_structure.md            │
│     • test_requirements.md          │
│     • results.json (empty)          │
└─────────────────────────────────────┘
```

### Phase 2: Milestone Execution (65%)

#### Milestone 1: Context Ingestion (10 min)
```
Load .claude/system.md + personas
     ↓
Read entire codebase
     ↓
Build Intent Map:
  • product_goal
  • assets
  • entrypoints
  • trust_boundaries
  • risk_hotspots
     ↓
Save to context/milestone-1-context.json
```

#### Milestone 2: Static Analysis (30 min)
```
Load methodology: access-control.md
     ↓
Ingest local tool evidence (Slither/Semgrep)
     ↓
Pattern-based vulnerability detection:
  • Access control issues
  • Integer overflows
  • Unchecked calls
  • DoS vectors
     ↓
Save to context/milestone-2-static.json
```

#### Milestone 3: Deep Logic Simulation (60 min)
```
Load all methodologies:
  • reentrancy.md
  • oracle-manipulation.md
  • access-control.md
  • injection.md
     ↓
Chain-of-Thought reasoning:
  1. Map the System
  2. Trace Data Flow
  3. Identify State Changes
  4. Hypothesize Attacks
  5. Validate Hypothesis
     ↓
Save to context/milestone-3-logic.json
```

#### Milestone 4: Test Generation (30 min)
```
Load findings from M2 + M3
     ↓
Generate Test Plan:
  • test_categories
  • tests[] with invariants
  • tooling recommendations
     ↓
Save to context/milestone-4-exploits.json
```

#### Milestone 5: Final Consolidation (10 min)
```
Combine all findings
     ↓
Calculate liability-weighted score
     ↓
Generate recommendations:
  • immediate
  • short_term
  • long_term
  • security_best_practices
     ↓
Save to context/results.json
```

### Phase 3: Report Generation (25%)
```
Load results.json
     ↓
Load liability_map.json (if exists)
     ↓
Calculate weighted score:
  • INTERNAL: full weight
  • EXTERNAL: 0.2x discount
     ↓
Generate HTML Report
     ↓
Generate PDF via Puppeteer
     ↓
Mark job complete
```

---

## Directory Structure

```
UatuAudit/
├── .claude/                          # Prompt templates (Deep Intelligence)
│   ├── system.md                     # Master auditor framework
│   ├── personas/                     # Domain-specific personas
│   │   ├── web3.md                   # EVM & Solidity auditor
│   │   ├── backend.md                # API security auditor
│   │   └── frontend.md               # Client-side auditor
│   ├── methodologies/                # Vulnerability detection patterns
│   │   ├── reentrancy.md
│   │   ├── oracle-manipulation.md
│   │   ├── access-control.md
│   │   └── injection.md
│   └── milestones/                   # Milestone prompt templates
│       ├── m1-context-ingestion.md
│       ├── m2-static-analysis.md
│       ├── m3-logic-simulation.md
│       ├── m4-test-generation.md
│       └── m5-final-consolidation.md
│
├── src/
│   ├── agents/                       # Domain-specific agents
│   │   ├── masterOrchestrator.ts     # Routes to agents, combines results
│   │   ├── web3Agent.ts              # Solidity/EVM analysis
│   │   ├── backendAgent.ts           # API/server analysis
│   │   ├── frontendAgent.ts          # Client-side analysis
│   │   └── types.ts                  # Agent interfaces
│   │
│   ├── sops/                         # Standard Operating Procedures
│   │   ├── bootstrap.ts              # Project initialization
│   │   ├── milestoneExecutor.ts      # 5-milestone engine
│   │   ├── singlePromptAudit.ts      # Legacy single-prompt mode
│   │   ├── parallelAuditExecutor.ts  # Parallel 4-session mode
│   │   └── prompts/                  # Prompt builders
│   │
│   ├── services/
│   │   ├── runAll.ts                 # Main 3-phase orchestrator
│   │   ├── jobQueue.ts               # Persistent job queue
│   │   ├── progressService.ts        # Real-time progress
│   │   ├── liabilityMap.ts           # Component liability tracking
│   │   ├── scoringService.ts         # Liability-weighted scoring
│   │   ├── scannerRunner.ts          # Deterministic scanner runner
│   │   ├── promptCache.ts            # 4-layer prompt caching
│   │   ├── ecosystemDetector.ts      # Framework detection
│   │   ├── projectAnalyzer.ts        # Structure analysis
│   │   ├── contextWriter.ts          # Context file generation
│   │   ├── pdfGenerator.ts           # Puppeteer PDF
│   │   └── ai/
│   │       └── claudeCLIProvider.ts  # Claude CLI integration
│   │
│   ├── detect/                       # Fingerprint detection
│   │   └── fingerprint.ts            # Orchestrates bash scripts
│   │
│   ├── server/                       # HTTP server
│   │   ├── app.ts                    # Main server
│   │   ├── worker.ts                 # Background job processor
│   │   └── routes/                   # API endpoints
│   │       ├── auth.ts               # GitHub OAuth
│   │       ├── github.ts             # Repo/branch APIs
│   │       ├── jobs.ts               # Job management
│   │       ├── reports.ts            # Report download
│   │       └── scan.ts               # Quick scan
│   │
│   ├── github/                       # GitHub integration
│   │   ├── appWebhookServer.ts       # Webhook receiver
│   │   └── checksClient.ts           # PR checks API
│   │
│   └── templates/                    # Report templates
│       ├── report-template.html
│       └── certificate-template.html
│
├── scripts/
│   ├── detect/                       # Fingerprint scripts
│   │   ├── 00_repo_shape.sh          # Monorepo detection
│   │   ├── 10_node.sh                # Node.js detection
│   │   ├── 20_solidity.sh            # Solidity framework
│   │   ├── 30_rust.sh                # Rust/Anchor detection
│   │   └── 99_emit_fingerprint.sh    # Emit JSON
│   └── run/
│       └── security_scanners.sh      # Slither/Semgrep runner
│
├── ui/                               # React frontend
│   └── src/
│       ├── pages/
│       │   ├── HomePage.tsx          # Landing page
│       │   ├── ConnectSource.tsx     # GitHub OAuth
│       │   ├── ConfigureAudit.tsx    # Audit settings
│       │   ├── ReviewAndRun.tsx      # Live progress
│       │   ├── Dashboard.tsx         # Job history
│       │   ├── AuditDetails.tsx      # Report viewer
│       │   ├── ScanContract.tsx      # Quick scan
│       │   └── Settings.tsx          # User settings
│       └── components/
│           ├── MilestoneTracker.tsx  # 5-milestone stepper
│           ├── CoTReasoning.tsx      # Chain-of-thought display
│           ├── LiabilityTriage.tsx   # Component scope Q&A
│           └── FileSelector.tsx      # File picker
│
└── docs/                             # Documentation
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+ (recommended: 20 LTS)
- pnpm package manager
- Claude CLI installed (`claude --version`)
- (Optional) Docker for sandboxed execution

### Install Dependencies
```bash
git clone <repository-url>
cd uatu-audit
pnpm install
pnpm build
```

### Environment Configuration
```bash
cp env.example .env
```

**Required Variables:**
```env
# Daemon
UATU_PORT=9090
UATU_CONCURRENCY=4
UATU_HOME=/Users/yourusername/.uatu

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback

# AI
ANTHROPIC_API_KEY=your_key

# Optional
UATU_SANDBOX=docker
UATU_EXECUTE_TIMEOUT_MS=900000
```

---

## Usage

### Start the Daemon
```bash
uatu daemon
# or
pnpm daemon
```

### Web Interface
Open `http://localhost:9090`

**Workflow:**
1. **Connect GitHub** → OAuth authentication
2. **Select Repository** → Pick repo, branch, files
3. **Configure Audit** → Ecosystem, test styles, depth
4. **Run Audit** → Watch 5-milestone progress
5. **Download Report** → PDF with findings

### CLI Usage
```bash
# Single audit
uatu run \
  --repo https://github.com/owner/repo.git \
  --project my-project \
  --branch main \
  --ai

# Batch processing
uatu batch \
  --repos "https://github.com/org/repo1.git#main,https://github.com/org/repo2.git#develop" \
  --ai
```

---

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/github/login` | GET | Start OAuth flow |
| `/auth/github/callback` | GET | OAuth callback |
| `/auth/github/me` | GET | Current user info |

### GitHub
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/github/repos` | GET | List repositories |
| `/github/branches?repo=owner/name` | GET | List branches |
| `/github/file-tree?repo=owner/name&branch=main` | GET | File tree |

### Jobs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/enqueue` | POST | Queue new audit |
| `/jobs` | GET | List all jobs |
| `/progress?project=X&branch=Y` | GET | Real-time progress |
| `/logs?project=X&branch=Y` | GET | Live logs |
| `/cancel?jobId=X` | POST | Cancel job |

### Reports
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/report?project=X&branch=Y&format=html` | GET | HTML report |
| `/report?project=X&branch=Y&format=pdf` | GET | PDF download |
| `/report?project=X&branch=Y&run=123456` | GET | Specific run |
| `/certificate?project=X&branch=Y` | GET | Audit certificate |

### Quick Scan
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/scan/deployed` | POST | Analyze deployed contract |
| `/scan/results?address=0x...` | GET | Scan results |
| `/scan/networks` | GET | Supported networks |

---

## Workspace Structure

```
~/.uatu/
├── workspace/users/{userId}/projects/{project}/branches/{branch}/
│   ├── <cloned-repo>/
│   ├── context/
│   │   ├── files_structure.md        # Flattened source
│   │   ├── test_requirements.md      # Test styles
│   │   ├── liability_map.json        # Component scope
│   │   ├── intent_map.json           # M1 output
│   │   ├── milestone_state.json      # Execution state
│   │   └── results.json              # Final results
│   └── runs/{timestamp}/
│       ├── progress.json             # Real-time progress
│       ├── milestone-1-context.json
│       ├── milestone-2-static.json
│       ├── milestone-3-logic.json
│       ├── milestone-4-exploits.json
│       ├── milestone-5-consolidated.json
│       ├── report.html
│       └── report.pdf
├── queue/
│   └── jobs.json                     # Job queue
└── sessions/{sessionId}/secrets/
    └── github.json                   # OAuth tokens
```

---

## Scoring System

### Standard Scoring
```
Score = 100 - (Critical×25 + High×10 + Medium×3 + Low×1)
```

### Liability-Weighted Scoring
Components marked as EXTERNAL (dependencies, third-party) receive a 0.2x discount:
```
Score = 100 - (Internal_Deductions + External_Deductions × 0.2)
```

| Grade | Score Range |
|-------|-------------|
| A | 90-100 |
| B | 75-89 |
| C | 60-74 |
| D | 40-59 |
| F | 0-39 |

---

## Deep Intelligence Proposal Completion Status

### Fully Implemented
- [x] `.claude/` folder structure with system, personas, methodologies, milestones
- [x] 5-Milestone Execution Engine (`milestoneExecutor.ts`)
- [x] Domain-Specific Agents (Web3, Backend, Frontend)
- [x] Master Orchestrator with routing logic
- [x] Prompt Cache Manager (4-layer caching)
- [x] Liability Map and Weighted Scoring
- [x] Milestone State Persistence and Resume
- [x] Deterministic Scanner Integration
- [x] Chain-of-Thought prompt structure
- [x] UI: MilestoneTracker, CoTReasoning, LiabilityTriage components
- [x] Dashboard and AuditDetails pages

### Partially Implemented
- [~] Inter-Agent Message Bus (basic implementation)
- [~] Test Artifact File Output (structure exists, output unclear)

### Not Yet Implemented
- [ ] Dry Run Mode (estimate cost before starting)
- [ ] Budget Controller (max tokens/cost limits)
- [ ] Circuit Breaker Pattern (API failure handling)
- [ ] Audit Diff Engine (compare two audits)
- [ ] False Positive Feedback Loop
- [ ] Incremental Audit (only changed files)
- [ ] SSE/WebSocket Result Streaming
- [ ] Confidence Scoring for Findings
- [ ] Methodology Versioning (v1, v2, etc.)
- [ ] Canary Deployments for Prompts

---

## Security Considerations

- **Sandbox Execution**: Use Docker in production (`UATU_SANDBOX=docker`)
- **GitHub Tokens**: Stored locally with appropriate scopes
- **Network Isolation**: Docker containers run with `--network=none`
- **Resource Limits**: Memory and CPU constraints
- **Non-Root Execution**: All sandboxed processes run as unprivileged user

---

## Development

### Build Commands
```bash
pnpm build        # TypeScript compile + Vite build
pnpm typecheck    # Type checking only
pnpm lint         # ESLint
pnpm test         # Vitest run
pnpm dev:ui       # Start UI dev server
```

### Testing
```bash
pnpm test progressService
pnpm test jobQueue
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

**Built for the smart contract security community**

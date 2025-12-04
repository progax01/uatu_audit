# UatuAudit — Automated Smart Contract Audit Platform

UatuAudit transforms ad-hoc smart contract audits into **standardized, repeatable SOPs** (Standard Operating Procedures). This platform supports multi-ecosystem auditing including Solidity (Foundry/Hardhat), Anchor (Solana), Soroban (Stellar), and Node.js projects.

## 🚀 **Key Features**

- **Multi-Ecosystem Support**: Solidity, Anchor/Soroban, Node.js detection and analysis
- **GitHub OAuth Integration**: Secure access to private repositories
- **Docker Sandbox Execution**: Isolated test execution for security
- **Live Progress Tracking**: Real-time updates with weighted progress calculation
- **Professional Reports**: PDF and SARIF export with coverage metrics
- **Web UI**: Single-page timeline interface for complete audit workflow
- **Retry & Timeout Logic**: Production-ready reliability features
- **Structured Logging**: Comprehensive audit trails with job context

## 🔧 **Installation & Setup**

### Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- pnpm package manager
- (Optional) Docker for sandbox execution
- (Optional) Toolchains for target ecosystems:
  - Foundry (`forge`) for Solidity
  - Hardhat/npm for Node.js projects
  - Anchor CLI for Solana projects
  - Soroban CLI for Stellar projects

### Install Dependencies

```bash
git clone <repository-url>
cd uatu-audit
pnpm install
pnpm build
```

### Environment Configuration

Create a `.env` file based on `env.example`:

```bash
cp env.example .env
```

**Required Environment Variables:**

```env
# Daemon Configuration
UATU_PORT=9090
UATU_CONCURRENCY=4
UATU_HOME=/Users/yourusername/.uatu

# GitHub OAuth (Required for private repos)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback

# Optional: AI Enhancement
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional: Security & Performance
UATU_SANDBOX=docker                # Enable Docker sandbox (default: local)
UATU_EXECUTE_TIMEOUT_MS=900000    # 15 minutes
UATU_COVERAGE_ENABLED=true
```

## 🌐 **GitHub OAuth Setup**

1. **Create GitHub OAuth App**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create new OAuth App with:
     - Application name: `UatuAudit`
     - Homepage URL: `http://localhost:9090`
     - Authorization callback URL: `http://localhost:9090/auth/github/callback`

2. **Configure Environment**:
   ```env
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   GITHUB_OAUTH_CALLBACK=http://localhost:9090/auth/github/callback
   ```

## 🏃 **Usage**

### Start the Daemon

```bash
uatu daemon
```

### Web Interface

Open your browser to `http://localhost:9090/index.html`

**Workflow:**
1. **Connect GitHub** → OAuth authentication
2. **Select Repository & Branch** → Live GitHub integration
3. **Select Technology Stack** → Foundry, Hardhat, Anchor, Soroban, Node.js
4. **Run Audit** → Live progress tracking across 5 phases
5. **Download Report** → PDF with findings and coverage metrics

### CLI Usage

**Single Repository Audit:**
```bash
uatu run \
  --repo https://github.com/owner/repo.git \
  --project my-project \
  --branch main \
  --ai
```

**Batch Processing:**
```bash
uatu batch \
  --repos "https://github.com/org/repo1.git#main,https://github.com/org/repo2.git#develop" \
  --ai
```

**Check Version:**
```bash
uatu --version
```

## 📊 **Audit Phases & Progress**

The audit pipeline consists of 5 weighted phases:

| Phase | Weight | Description |
|-------|--------|-------------|
| **Bootstrap** | 10% | Project detection, ecosystem fingerprinting |
| **Inventory** | 20% | Contract discovery, function cataloging |
| **Analysis** | 35% | Static analysis, pattern detection |
| **Testgen** | 15% | Test plan generation (+ optional AI) |
| **Execute** | 20% | Sandboxed test execution, coverage analysis |

## 🏗 **SOPs (Standard Operating Procedures)**

### Bootstrap SOP
- Detects project ecosystems (Solidity, Anchor, Soroban, Node.js)
- Builds `.uatu/context` directory
- Creates readiness markers

### Inventory SOP
- Extracts public/external function signatures
- Catalogs smart contracts and source files
- Discovers existing test files
- Maps inheritance and dependencies

### Analysis SOP
- **Solidity**: tx.origin usage, low-level calls, unbounded loops
- **Rust**: unsafe blocks, unwrap() calls, missing auth checks
- **Node.js**: eval() usage, hardcoded secrets, child_process calls
- Severity classification (high/medium/low)

### Testgen SOP
- Generates ecosystem-specific test checklists
- Optional AI-enhanced test suggestions via Anthropic
- Creates `.uatu/ai_tests/` with actionable plans

### Execute SOP
- Sandboxed execution (local or Docker)
- Multi-toolchain support (Forge, Hardhat, Anchor, Cargo)
- Coverage extraction and aggregation
- Comprehensive logging

## 🐳 **Docker Sandbox Security**

Enable secure execution with Docker:

```env
UATU_SANDBOX=docker
```

**Security Features:**
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

## 📋 **Configuration**

**Repository-Local Config** (`.uatu/config.json`):
```json
{
  "ai": true,
  "sandbox": "docker",
  "timeouts": {
    "executeMs": 1200000
  },
  "coverage": {
    "foundry": true,
    "hardhat": true,
    "node": true
  }
}
```

## 📊 **API Endpoints**

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/healthz` | GET | Health check |
| `/auth/github/login` | GET | GitHub OAuth login |
| `/auth/github/me` | GET | Current user info |
| `/github/repos` | GET | List repositories |
| `/github/branches?repo=owner/name` | GET | List branches |
| `/enqueue` | POST | Queue audit job |
| `/jobs` | GET | List all jobs |
| `/progress?project=X&branch=Y` | GET | Live progress |
| `/logs?project=X&branch=Y` | GET | Debug logs |
| `/report?project=X&branch=Y&format=pdf\|html` | GET | Download PDF or view HTML report |

## 📁 **Workspace Structure**

```
~/.uatu/
├── workspace/
│   └── users/{user}/projects/{project}/branches/{branch}/
│       ├── .uatu/
│       │   ├── context/         # Project analysis context
│       │   ├── sop/             # SOP status files
│       │   └── ai_tests/        # AI-generated test plans
│       ├── runs/
│       │   └── {timestamp}/
│       │       ├── progress.json    # Live progress tracking
│       │       ├── inventory.json   # Contract inventory
│       │       ├── analysis.json    # Security findings
│       │       ├── findings.sarif   # SARIF export
│       │       ├── execute.log      # Execution logs
│       │       ├── coverage.txt     # Coverage report
│       │       └── report.pdf       # Final audit report
│       └── <cloned repository>
├── queue/
│   └── jobs.json               # Persistent job queue
└── users/{user}/secrets/
    └── github.json             # OAuth tokens
```

## 🔒 **Security Considerations**

- **Sandbox Execution**: Always use Docker in production (`UATU_SANDBOX=docker`)
- **GitHub Tokens**: Stored locally with appropriate scopes
- **Network Isolation**: Docker containers run with `--network=none`
- **Resource Limits**: Memory and CPU constraints prevent resource exhaustion
- **Non-Root Execution**: All sandboxed processes run as unprivileged user

## 📄 **HTML Report Features**

The platform generates beautiful HTML reports with:

- **Interactive Elements**: Live score gauge, hover effects, print optimization
- **Professional Styling**: Dark/light themes, A4 print layout, embedded assets
- **Rich Data Visualization**: Security score, coverage bars, severity breakdown
- **Print-Ready PDF**: Use browser "Print → Save as PDF" for distribution
- **No External Dependencies**: Self-contained HTML with embedded SVG/CSS

**Accessing Reports:**
- **HTML**: `GET /report?project=X&branch=Y&format=html` (view in browser)
- **PDF**: `GET /report?project=X&branch=Y&format=pdf` (download file)

**Converting HTML to PDF with Puppeteer:**
```bash
# Install Puppeteer (optional, for automated PDF generation)
pnpm add --save-dev puppeteer

# Convert any HTML report to PDF
node scripts/html-to-pdf.js report.html output.pdf [data.json]
```

## 🧪 **Testing**

```bash
# Run unit tests
pnpm test

# Test specific modules
pnpm test progressService
pnpm test jobQueue

# Build verification
pnpm build
```

## 📈 **Production Deployment**

**Recommended Setup:**
1. Use Docker sandbox mode (`UATU_SANDBOX=docker`)
2. Configure appropriate concurrency (`UATU_CONCURRENCY=8`)
3. Set up persistent storage for workspace
4. Configure GitHub OAuth for your domain
5. Set up reverse proxy with SSL
6. Monitor logs and queue status

**Scaling:**
- Horizontal: Run multiple daemon instances with shared storage
- Vertical: Increase `UATU_CONCURRENCY` based on available cores
- Queue-based: Separate enqueuers from workers

## 🏛️ **Codebase Architecture**

### Backend Services (`src/services/`)

| Service | Purpose | Used By |
|---------|---------|---------|
| `runAll.ts` | Main 3-phase audit pipeline orchestrator | daemon.ts, bin/uatu.ts |
| `jobQueue.ts` | Persistent job queue with SQLite, handles enqueue/claim/complete | daemon.ts, singlePromptAudit.ts, parallelAuditExecutor.ts |
| `progressService.ts` | Real-time progress tracking with weighted phases | daemon.ts, index.ts |
| `gitService.ts` | Git clone/refresh operations with auth support | runAll.ts |
| `projectAnalyzer.ts` | Project structure analysis, contract detection | bootstrap.ts |
| `liveLogger.ts` | Real-time log streaming for UI | bootstrap.ts, singlePromptAudit.ts |
| `ecosystemDetector.ts` | Detects Foundry/Hardhat/Anchor/Soroban ecosystems | bootstrap.ts |
| `metrics.ts` | Performance metrics collection | daemon.ts |
| `jobLogger.ts` | Per-job file logging for debugging | daemon.ts, runAll.ts |
| `testStyles.ts` | Test style validation (behavioral/stride/owasp) | bin/uatu.ts |
| `insightAutoWriter.ts` | Auto-generates insights from command outputs | smokeTests.ts |
| `contextWriter.ts` | Writes context files (files_structure.md, test_requirements.md) | runAll.ts |
| `pdfGenerator.ts` | HTML to PDF conversion using Puppeteer | runAll.ts |
| `configService.ts` | Loads .uatu/config.json settings | runAll.ts |
| `workspaceService.ts` | Resolves workspace paths for projects | daemon.ts, runAll.ts |
| `ai/claudeCLIProvider.ts` | Claude CLI integration, session management | jobQueue.ts |
| `report/simpleReportGenerator.ts` | Generates HTML reports from results.json | runAll.ts |

### SOPs (`src/sops/`)

| SOP | Purpose |
|-----|---------|
| `bootstrap.ts` | Project initialization, ecosystem detection, context setup |
| `singlePromptAudit.ts` | Single Claude CLI call for complete audit |
| `parallelAuditExecutor.ts` | Parallel multi-session audit for large projects |

### Frontend (`ui/src/`)

**Pages:**
| Page | Purpose |
|------|---------|
| `AuditSetup.tsx` | Repository selection, branch picker, file selector |
| `ReviewAndRun.tsx` | Audit execution with live progress tracking |
| `Reports.tsx` | List of completed audit reports |
| `ReportDetail.tsx` | Individual report viewer with PDF download |
| `Settings.tsx` | Application settings |

**Hooks:**
| Hook | Purpose |
|------|---------|
| `useLocalStorage.ts` | Persistent state management |
| `useAudit.ts` | Audit state and operations |
| `useToast.ts` | Toast notifications |

### Utilities (`src/utils/`)

| Utility | Purpose |
|---------|---------|
| `logger.ts` | Structured logging with pino |
| `retry.ts` | Retry and timeout wrappers |
| `stepHelper.ts` | Progress step management |
| `claudeHealthCheck.ts` | Claude CLI availability check |

### Templates (`src/templates/`)

| Template | Purpose |
|----------|---------|
| `report-template.html` | HTML report template with dark theme |
| `certificate-template.html` | Audit certificate template |
| `sop-prompt.txt` | Main Claude CLI audit prompt |

### Server (`src/server/`)

| File | Purpose |
|------|---------|
| `app.ts` | HTTP server setup, request routing, CORS |
| `worker.ts` | Background job processor |
| `routes/auth.ts` | GitHub OAuth routes (/auth/*) |
| `routes/github.ts` | GitHub API routes (/github/*) |
| `routes/jobs.ts` | Job management routes (/jobs, /enqueue, /progress) |
| `routes/reports.ts` | Report routes (/report, /certificate) |
| `routes/health.ts` | Health & metrics routes (/healthz, /metrics) |
| `routes/scan.ts` | Deployed contract scan routes (/scan/*) |

---

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 **License**

[Specify your license here]

---

**Built with ❤️ for the smart contract security community**

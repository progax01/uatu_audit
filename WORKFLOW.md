# UatuAudit Workflow & Architecture

## 1. Component Architecture
```
User/IDE ──────┐
               ▼
┌─────────────────────────────┐     ┌─────────────────┐
│ CLI (bin/uatu.ts)           │     │ Web UI          │
│  ├─ uatu run               ─┼────►│  /progress      │
│  ├─ uatu batch             │     │  /report        │
│  └─ uatu daemon            │     │  /logs          │
└─────────────┬───────────────┘     └────────┬────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                     Daemon                          │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────┐ │
│  │ HTTP Server │   │ Worker Pool │   │ Queue    │ │
│  │  - /enqueue│   │  Worker 1   │   │jobs.json │ │
│  │  - /progress   │  Worker 2   │   └──────────┘ │
│  │  - /report │   │  Worker N   │                │
│  └─────────────┘   └─────────────┘                │
└───────────────────────────┬─────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│              Pipeline Orchestrator                   │
│   ┌────────────┐ ┌──────────┐ ┌──────────────────┐   │
│   │Git Service │ │Workspace │ │Progress Service  │   │
│   └────────────┘ └──────────┘ └──────────────────┘   │
│                                                      │
│   ┌─── SOP Pipeline ────────────────────────┐       │
│   │ Bootstrap → Inventory → Analysis        │       │
│   │    → TestGen → Execute                  │       │
│   └────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

## 2. Job Processing Flow
```
User Input                 Worker Process              Storage
──────────                 ──────────────             ────────
[CLI/UI Request]
      │
      ▼
[Enqueue Job] ─────► [Queue jobs.json]
                           │
                           ▼
                    [Worker claims job]
                           │
                           ▼
                    [Create workspace] ────► [.uatu/context/]
                           │
                           ▼
                    [Clone repository] ────► [workspace/repo]
                           │
                           ▼
                    [Execute SOPs] ───────► [runs/{timestamp}/]
                     │  │  │  │             ├── progress.json
                     │  │  │  │             ├── analysis.json
                     │  │  │  │             ├── report.html
                     │  │  │  │             └── execute.log
                     ▼  ▼  ▼  ▼
                    [Mark complete]
                           │
                           ▼
                    [Generate report] ────► [report.html/pdf]
```

## 3. Filesystem Structure
```
$UATU_HOME/
│
├── queue/
│   └── jobs.json              # Persistent job queue
│
├── workspace/
│   └── users/
│       └── {user}/
│           └── projects/
│               └── {project}/
│                   └── branches/
│                       └── {branch}/
│                           ├── .uatu/
│                           │   ├── context/   # Analysis context
│                           │   └── sop/       # SOP state
│                           │
│                           └── runs/
│                               └── {timestamp}/
│                                   ├── progress.json
│                                   ├── analysis.json
│                                   ├── report.html
│                                   ├── report.pdf
│                                   └── execute.log
```

## 4. Runtime Flow
```
1. Job Creation & Queue
   ┌──────────┐     ┌──────────┐     ┌─────────────┐
   │ CLI/UI   │ ──► │ Enqueue  │ ──► │ jobs.json   │
   └──────────┘     └──────────┘     └─────────────┘

2. Worker Processing
   ┌──────────┐     ┌──────────┐     ┌─────────────┐
   │ Worker   │ ──► │ Claim    │ ──► │ Run SOPs    │
   └──────────┘     └──────────┘     └─────────────┘
                                            │
                                            ▼
                                     ┌─────────────┐
                                     │ Write Logs  │
                                     └─────────────┘

3. Progress & Reports
   ┌──────────┐     ┌──────────┐     ┌─────────────┐
   │ WebUI    │ ◄── │ /progress│ ◄── │progress.json│
   └──────────┘     └──────────┘     └─────────────┘
```

## 5. Environment Setup
```
Configuration Sources           Runtime Components
────────────────────           ──────────────────
.env                    ──┐
                         │
.uatu/config.json   ────┼──► Daemon (PORT, CONCURRENCY)
                         │
CLI flags           ────┼──► Workers (SANDBOX, TIMEOUT)
                         │
                         └──► Services (GITHUB_*, AI_*)


Directory Structure           Process Flow
──────────────────           ────────────
$UATU_HOME/                  1. Read configs
  ├── queue/                 2. Start daemon
  │   └── jobs.json         3. Init workers
  │                         4. Watch queue
  └── workspace/            5. Process jobs
      └── users/            6. Write results
          └── projects/     7. Update status
```

## Quick Commands

```bash
# Build and start
pnpm install
pnpm build
uatu daemon

# Run audit
uatu run --repo https://github.com/owner/repo.git --project myproj --branch main

# Generate PDF report
node scripts/generate-pdf.js myproj main
```

## Key Files

- `src/bin/uatu.ts`: CLI entry point
- `src/daemon/daemon.ts`: HTTP server + worker pool
- `src/services/runAll.ts`: Pipeline orchestrator
- `src/services/jobQueue.ts`: Job queue manager
- `src/sops/*.ts`: SOP implementations
- `src/services/ai/*.ts`: AI integration
- `scripts/generate-pdf.js`: PDF generator

## Common Operations

1. **Start Development**
   - Copy `.env.example` to `.env`
   - Configure environment variables
   - Run `pnpm install && pnpm build`
   - Start daemon: `uatu daemon`

2. **Run Tests**
   - Unit tests: `pnpm test`
   - Single audit: `uatu run --repo <url> --project <name> --branch <branch>`
   - Batch mode: `uatu batch --repos "url1#branch,url2#branch"`

3. **Monitor Progress**
   - Web UI: `http://localhost:9090`
   - Check logs: `$UATU_HOME/workspace/.../runs/latest/execute.log`
   - View reports: `/report?project=X&branch=Y&format=html`

4. **Troubleshooting**
   - Check job queue: `$UATU_HOME/queue/jobs.json`
   - Verify GitHub token: `$UATU_HOME/users/{user}/secrets/github.json`
   - Restart daemon to recover stuck jobs
   - Enable verbose logging in `.env`

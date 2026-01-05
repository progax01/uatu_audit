# UatuAudit – Automated Smart Contract Audit Platform

## What is UatuAudit?
UatuAudit transforms ad‑hoc smart contract audits into **standardized, repeatable SOPs** using the **Deep Intelligence Framework**. It combines deterministic scanners (Slither, Semgrep) with AI‑driven analysis across five milestones:
1. Context Ingestion
2. Static Analysis
3. Deep Logic Simulation
4. Test Generation
5. Final Consolidation

## Key Features
| Feature | Description |
|---|---|
| **Multi‑Ecosystem Support** | Solidity, Anchor, Soroban, Node.js, Go |
| **One‑Click Deployment** | Deploy the daemon and UI with a single `pnpm dev:ui` command |
| **Real‑Time Progress** | Milestone stepper UI with live logs |
| **Professional Reports** | PDF/HTML with findings, score, and recommendations |
| **Guardrails Enforcer** | Prevents score manipulation and ensures SOP adherence |
| **Pre‑Audit Questionnaire** | Smart questions to capture liability scope |

## Architecture Overview
```
┌─────────────────────────────┐
│          UatuAudit           │
├─────────────────────────────┤
│  Web UI (React)   CLI   API │
└───────┬───────┬───────┬─────┘
        │       │       │
   Milestone   Scanner   Queue
   Executor   (Slither) (SQLite)
```

## Installation & Setup
```bash
# Prerequisites
node >= 18 (recommended 20)
pnpm (or yarn)
# Clone & install
git clone <repo-url>
cd UatuAudit
pnpm install
# Start daemon (backend)
pnpm daemon
# Start UI (frontend)
pnpm dev:ui
```
The UI will be available at `http://localhost:3000` and the daemon at `http://localhost:9090`.

## Usage
### CLI
```bash
# Run a full audit
uatu run \
  --repo https://github.com/owner/repo.git \
  --project my-project \
  --branch main \
  --ai
```
### Web UI
1. Connect your GitHub account.
2. Select repository, branch, and files.
3. Configure audit options.
4. Click **Start Audit** and watch the milestone progress.
5. Download the generated PDF report.

## API Reference
- `POST /enqueue` – Queue a new audit job.
- `GET /progress?project=X&branch=Y` – Real‑time progress.
- `GET /report?project=X&branch=Y&format=html|pdf` – Retrieve the report.
- See `docs/API.md` for the full list.

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome`).
3. Install dependencies (`pnpm install`).
4. Run tests (`pnpm test`).
5. Submit a Pull Request.

## License
MIT © 2025‑2026 UatuAudit contributors

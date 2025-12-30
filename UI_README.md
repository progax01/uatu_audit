# UatuAudit UI — React Frontend

Modern React-based UI for UatuAudit implementing the Deep Intelligence Framework with milestone-based progress tracking, chain-of-thought reasoning display, and liability triage.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USER FLOW                                    │   │
│  │                                                                      │   │
│  │  HomePage ──► ConnectSource ──► ConfigureAudit ──► ReviewAndRun     │   │
│  │     │                                                    │          │   │
│  │     │                                                    ▼          │   │
│  │     │                                              Dashboard        │   │
│  │     │                                                    │          │   │
│  │     ▼                                                    ▼          │   │
│  │  ScanContract ────────────────────────────────► AuditDetails        │   │
│  │  (Quick Scan)                                   (Report View)       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    KEY COMPONENTS                                    │   │
│  │                                                                      │   │
│  │  MilestoneTracker ──── 5-step visual stepper                        │   │
│  │  CoTReasoning ──────── Chain-of-thought display                     │   │
│  │  LiabilityTriage ───── Component scope Q&A                          │   │
│  │  FileSelector ──────── Multi-file tree picker                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    STATE MANAGEMENT                                  │   │
│  │                                                                      │   │
│  │  useAuditProgress ──── Real-time progress polling                   │   │
│  │  useLocalStorage ───── Persistent state                             │   │
│  │  React Context ─────── Auth & job state                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.4 | Build tool |
| Tailwind CSS | 4.1 | Styling |
| Lucide React | - | Icons |

---

## Directory Structure

```
ui/
├── index.html                    # Entry point
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
├── src/
│   ├── main.tsx                  # React root
│   ├── App.tsx                   # Router & layout
│   │
│   ├── pages/                    # Route pages
│   │   ├── HomePage.tsx          # Landing page + Quick Scan
│   │   ├── ConnectSource.tsx     # Step 1: GitHub OAuth
│   │   ├── ConfigureAudit.tsx    # Step 2: Audit settings
│   │   ├── ReviewAndRun.tsx      # Step 3: Live progress
│   │   ├── Dashboard.tsx         # Job history list
│   │   ├── AuditDetails.tsx      # Individual report view
│   │   ├── ScanContract.tsx      # Deployed contract scan
│   │   └── Settings.tsx          # User preferences
│   │
│   ├── components/               # Reusable components
│   │   ├── MilestoneTracker.tsx  # 5-milestone stepper
│   │   ├── CoTReasoning.tsx      # Chain-of-thought display
│   │   ├── LiabilityTriage.tsx   # Component scope Q&A
│   │   └── FileSelector.tsx      # File tree picker
│   │
│   ├── hooks/                    # React hooks
│   │   └── useAuditProgress.ts   # Progress polling
│   │
│   ├── styles/                   # Stylesheets
│   │   └── globals.css           # Tailwind + custom
│   │
│   └── assets/                   # Static assets
│       └── mascot.svg            # Logo/mascot
└── dist-ui/                      # Production build
```

---

## Complete User Flow

### Flow 1: GitHub Audit

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    GITHUB AUDIT FLOW                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. HOMEPAGE (HomePage.tsx)                                               │
│     ├── View feature highlights                                           │
│     ├── Click "Connect GitHub" button                                     │
│     └── OR click "Quick Scan" for deployed contracts                      │
│                                                                           │
│  2. CONNECT SOURCE (ConnectSource.tsx)                                    │
│     ├── GitHub OAuth redirect                                             │
│     ├── Return with session token                                         │
│     ├── Load user's repositories                                          │
│     ├── Select repository from dropdown                                   │
│     ├── Select branch                                                     │
│     └── Click "Continue" to next step                                     │
│                                                                           │
│  3. CONFIGURE AUDIT (ConfigureAudit.tsx)                                  │
│     ├── Select files to audit (FileSelector)                              │
│     ├── Choose ecosystem (Foundry/Hardhat/Anchor/Soroban/Node.js)         │
│     ├── Select test styles (Behavioral/STRIDE/OWASP)                      │
│     ├── Optional: Enable AI enhancement                                   │
│     └── Click "Start Audit"                                               │
│                                                                           │
│  4. REVIEW AND RUN (ReviewAndRun.tsx)                                     │
│     ├── POST /enqueue (queue job)                                         │
│     ├── Poll /progress every 2 seconds                                    │
│     ├── Display MilestoneTracker:                                         │
│     │   ├── M1: Context Ingestion      (10 min)                          │
│     │   ├── M2: Static Analysis        (30 min)                          │
│     │   ├── M3: Deep Logic Simulation  (60 min)                          │
│     │   ├── M4: Test Generation        (30 min)                          │
│     │   └── M5: Final Consolidation    (10 min)                          │
│     ├── Show live logs (filterable)                                       │
│     ├── Display elapsed time & ETA                                        │
│     └── On completion → auto-switch to Certificate tab                    │
│                                                                           │
│  5. REPORT VIEW (embedded in ReviewAndRun or AuditDetails)                │
│     ├── View HTML report in iframe                                        │
│     ├── Download PDF                                                      │
│     ├── View findings breakdown                                           │
│     └── View score & grade                                                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Quick Scan (Deployed Contract)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    QUICK SCAN FLOW                                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. HOMEPAGE (HomePage.tsx)                                               │
│     ├── Click "Quick Scan" button                                         │
│     └── Opens Quick Scan modal                                            │
│                                                                           │
│  2. QUICK SCAN MODAL                                                      │
│     ├── Select network (Ethereum/Polygon/Arbitrum/Base/BNB/Optimism)     │
│     ├── Enter contract address                                            │
│     └── Click "Scan"                                                      │
│                                                                           │
│  3. REVIEW AND RUN (ReviewAndRun.tsx)                                     │
│     ├── POST /scan/deployed (fetch source from explorer)                  │
│     ├── Same milestone progress as GitHub flow                            │
│     └── Shows "Network: Ethereum" instead of "Branch: main"              │
│                                                                           │
│  4. REPORT VIEW                                                           │
│     └── Same as GitHub flow                                               │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Dashboard & History

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD FLOW                                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. DASHBOARD (Dashboard.tsx)                                             │
│     ├── List all user's jobs                                              │
│     ├── Filter by status (pending/running/done/failed)                    │
│     ├── Show score & grade for completed jobs                             │
│     └── Click job row → AuditDetails                                      │
│                                                                           │
│  2. AUDIT DETAILS (AuditDetails.tsx)                                      │
│     ├── View full report                                                  │
│     ├── Download PDF                                                      │
│     └── Re-run audit option                                               │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Page Components

### HomePage.tsx
**Route:** `/`

Landing page with marketing content and quick actions.

```
┌─────────────────────────────────────────────────────────────────┐
│  UatuAudit - Smart Contract Security Platform                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Hero Section]                                                  │
│  Automated Smart Contract Audits                                 │
│                                                                  │
│  [Connect GitHub Button]  [Quick Scan Button]                    │
│                                                                  │
│  [Feature Cards]                                                 │
│  • Multi-Ecosystem Support                                       │
│  • Real-Time Progress                                            │
│  • Professional Reports                                          │
│                                                                  │
│  [Quick Scan Modal]                                              │
│  • Network selector (6 chains)                                   │
│  • Contract address input                                        │
│  • Scan button                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ConnectSource.tsx
**Route:** `/step/1`

GitHub OAuth and repository selection.

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Connect Your Code                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [GitHub OAuth Section]                                          │
│  ✓ Connected as @username                                        │
│                                                                  │
│  [Repository Dropdown]                                           │
│  Select repository: [owner/repo-name ▼]                          │
│                                                                  │
│  [Branch Dropdown]                                               │
│  Select branch: [main ▼]                                         │
│                                                                  │
│  [Project Slug]                                                  │
│  Project name: [my-project]                                      │
│                                                                  │
│  [Continue Button]                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ConfigureAudit.tsx
**Route:** `/step/2`

Audit configuration with file selection.

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Configure Audit                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [File Selector - FileSelector.tsx]                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📁 contracts/                                             │  │
│  │    ☑ Token.sol                                             │  │
│  │    ☑ Staking.sol                                           │  │
│  │    ☐ test/Token.test.sol                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Ecosystem Selection]                                           │
│  ○ Foundry  ● Hardhat  ○ Anchor  ○ Soroban  ○ Node.js          │
│                                                                  │
│  [Test Styles]                                                   │
│  ☑ Behavioral (unit tests)                                       │
│  ☑ STRIDE (threat modeling)                                      │
│  ☐ OWASP Smart Contract Top 10                                   │
│                                                                  │
│  [AI Enhancement]                                                │
│  ☑ Enable AI-powered analysis                                    │
│                                                                  │
│  [Start Audit Button]                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ReviewAndRun.tsx
**Route:** `/step/3`

Live progress tracking with milestone display.

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Review & Run                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Configuration Summary]                                         │
│  Repository: owner/repo  Branch: main  Files: 3 selected        │
│                                                                  │
│  [MilestoneTracker - MilestoneTracker.tsx]                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [✓] Context  [✓] Static  [●] Logic  [ ] Tests  [ ] Final │  │
│  │      100%        100%       45%        0%         0%       │  │
│  │                                                            │  │
│  │  Current: Milestone 3 - Deep Logic Simulation              │  │
│  │  Elapsed: 12:34  |  ETA: ~18 min remaining                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Tabs: Progress | Logs | Certificate]                          │
│                                                                  │
│  [Progress Tab]                                                  │
│  Overall: ████████████░░░░░░░░ 62%                              │
│                                                                  │
│  [Logs Tab]                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [INFO] Milestone 3 starting...                            │  │
│  │  [INFO] Loading methodologies: reentrancy, oracle...       │  │
│  │  [INFO] Chain-of-thought reasoning in progress...          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Certificate Tab - on completion]                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Embedded Certificate/Report]                             │  │
│  │  Score: 72/100 | Grade: C                                  │  │
│  │  [Download PDF]                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Cancel Button]                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Dashboard.tsx
**Route:** `/dashboard`

Job history and management.

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                                          [+ New Audit] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Filter Tabs]                                                   │
│  [All] [Running] [Completed] [Failed]                            │
│                                                                  │
│  [Job List]                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  my-project / main           ●  Running    45%    3:21    │  │
│  │  Started 5 minutes ago                       [View]       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  nft-marketplace / main      ✓  Done   92/A   2 hrs ago   │  │
│  │  Completed successfully                [Report] [Re-run]  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  defi-protocol / develop     ✗  Failed         1 day ago  │  │
│  │  Error: Timeout exceeded                       [Retry]    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ScanContract.tsx
**Route:** `/scan`

Full-page deployed contract scanner.

```
┌─────────────────────────────────────────────────────────────────┐
│  Scan Deployed Contract                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Network Selection]                                             │
│  ○ Ethereum  ● Polygon  ○ Arbitrum  ○ Base  ○ BNB  ○ Optimism  │
│                                                                  │
│  [Contract Address]                                              │
│  [0x1234...5678                                              ]   │
│                                                                  │
│  [Scan Button]                                                   │
│                                                                  │
│  [Results Section - after scan]                                  │
│  Contract verified: ✓                                            │
│  Compiler: solc 0.8.19                                           │
│  Source files: 5                                                 │
│                                                                  │
│  [Start Audit Button]                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### MilestoneTracker.tsx

5-step visual progress stepper for the Deep Intelligence Framework milestones.

**Props:**
```typescript
interface MilestoneTrackerProps {
  milestones: {
    id: number;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    pct: number;
    duration?: number;
  }[];
  currentMilestone: number;
}
```

**Visual:**
```
[✓] Context  [✓] Static  [●] Logic  [ ] Tests  [ ] Final
    100%        100%       45%        0%         0%
```

### CoTReasoning.tsx

Displays chain-of-thought reasoning steps from the audit.

**Props:**
```typescript
interface CoTReasoningProps {
  reasoning: {
    step: string;
    observation: string;
    hypothesis: string;
    validation: string;
    conclusion: string;
  }[];
}
```

**Visual:**
```
▼ Chain-of-Thought Reasoning
┌─────────────────────────────────────────────────────────────┐
│  Step: Tracing withdraw() call graph                         │
│  Observation: External call before state update              │
│  Hypothesis: Classic reentrancy pattern                      │
│  Validation: No reentrancy guard present                     │
│  Conclusion: CRITICAL vulnerability confirmed                │
└─────────────────────────────────────────────────────────────┘
```

### LiabilityTriage.tsx

Interactive Q&A for classifying component liability scope.

**Props:**
```typescript
interface LiabilityTriageProps {
  components: {
    id: string;
    name: string;
    scope?: 'INTERNAL' | 'EXTERNAL';
  }[];
  onScopeChange: (id: string, scope: 'INTERNAL' | 'EXTERNAL') => void;
}
```

**Visual:**
```
Component Liability Triage

Token.sol:owner
  Is this component managed by your team?
  [Yes - Internal]  [No - External]

Staking.sol:rewardToken
  Is this an external dependency?
  [Yes - External]  [No - Internal]
```

### FileSelector.tsx

Tree-view file selector for choosing audit scope.

**Props:**
```typescript
interface FileSelectorProps {
  files: FileNode[];
  selectedFiles: string[];
  onSelectionChange: (paths: string[]) => void;
}
```

---

## Hooks

### useAuditProgress.ts

Real-time progress polling hook.

```typescript
const {
  progress,      // Current progress object
  logs,          // Array of log entries
  isComplete,    // Boolean
  isError,       // Boolean
  error,         // Error message if failed
  runTimestamp,  // Current run ID
} = useAuditProgress({
  project: 'my-project',
  branch: 'main',
  pollInterval: 2000,  // 2 seconds
});
```

**Progress Object:**
```typescript
interface AuditProgress {
  project: string;
  branch: string;
  timestamp: string;
  overall_pct: number;
  phases: {
    name: string;
    pct: number;
    step: string;
    note?: string;
  }[];
  milestones?: MilestoneState[];
  last_event?: string;
}
```

---

## API Integration

### Authentication
```typescript
// Initiate OAuth
window.location.href = '/auth/github/login';

// Check auth status
const response = await fetch('/auth/github/me');
const { user, authenticated } = await response.json();

// Logout
await fetch('/auth/github/logout', { method: 'POST' });
```

### GitHub Operations
```typescript
// List repositories
const repos = await fetch('/github/repos').then(r => r.json());

// List branches
const branches = await fetch(`/github/branches?repo=${owner}/${name}`).then(r => r.json());

// Get file tree
const tree = await fetch(`/github/file-tree?repo=${owner}/${name}&branch=main`).then(r => r.json());
```

### Audit Operations
```typescript
// Start audit
const response = await fetch('/enqueue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repo: 'https://github.com/owner/repo.git',
    project: 'my-project',
    branch: 'main',
    selectedFiles: ['contracts/Token.sol'],
    testStyles: ['behavioral', 'stride'],
    ai: true,
  }),
});

// Poll progress
const progress = await fetch(`/progress?project=my-project&branch=main`).then(r => r.json());

// Get logs
const logs = await fetch(`/logs?project=my-project&branch=main&tail=100`).then(r => r.json());

// Cancel job
await fetch(`/cancel?jobId=${jobId}`, { method: 'POST' });
```

### Reports
```typescript
// View HTML report
const html = await fetch(`/report?project=my-project&branch=main&format=html`).then(r => r.text());

// Download PDF
window.open(`/report?project=my-project&branch=main&format=pdf`);

// Get specific run
const report = await fetch(`/report?project=my-project&branch=main&run=${timestamp}&format=html`);
```

---

## Design System

### Colors
```css
/* Primary */
--accent: #0a7cff;
--background: #0b1020;
--card: #121a33;
--text: #eaf0ff;
--muted: #9fb0e3;

/* Status */
--success: #10B981;
--error: #EF4444;
--warning: #F59E0B;
--pending: #6B7280;

/* Severity */
--critical: #dc2626;
--high: #f97316;
--medium: #eab308;
--low: #22c55e;
--info: #3b82f6;
```

### Border Radius
```css
--radius-card: 16px;
--radius-button: 10px;
--radius-badge: 6px;
```

### Common Classes
```css
.card { /* Card container */ }
.btn-primary { /* Blue button */ }
.btn-secondary { /* Gray button */ }
.input, .select { /* Form inputs */ }
.badge { /* Status badges */ }
```

---

## Development

### Prerequisites
- Node.js 18+ (Vite 5.4 supports Node 18)
- pnpm

### Commands
```bash
# Start dev server (port 3000)
pnpm dev:ui

# Build for production
pnpm build:ui

# Preview production build
pnpm preview:ui
```

### Proxy Configuration
API requests are proxied to `localhost:9090` in `vite.config.ts`:
```typescript
server: {
  port: 3000,
  proxy: {
    '/auth': 'http://localhost:9090',
    '/github': 'http://localhost:9090',
    '/enqueue': 'http://localhost:9090',
    '/progress': 'http://localhost:9090',
    '/logs': 'http://localhost:9090',
    '/report': 'http://localhost:9090',
    '/jobs': 'http://localhost:9090',
    '/scan': 'http://localhost:9090',
  },
}
```

### Hot Reload
Vite provides instant HMR. Changes to `.tsx` and `.css` files reflect immediately.

---

## Troubleshooting

### Port 3000 in Use
```typescript
// vite.config.ts
server: {
  port: 3001,
}
```

### API Calls Failing
Ensure daemon is running:
```bash
pnpm daemon
```

### Build Errors
```bash
rm -rf node_modules
pnpm install
```

---

## Future Enhancements

- [ ] Toast notifications for actions
- [ ] Modal dialogs for confirmations
- [ ] Search/filter in job history
- [ ] Pagination for large job lists
- [ ] Dark/light theme toggle
- [ ] Mobile responsive improvements
- [ ] Keyboard shortcuts
- [ ] Accessibility (ARIA labels)
- [ ] WebSocket for real-time updates
- [ ] Confidence score display per finding
- [ ] Test artifact download section

---

## License

MIT

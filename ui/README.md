# UatuAudit UI — React Frontend

The UatuAudit UI is a React-based frontend for the automated smart contract audit platform. Built with Vite, Tailwind CSS, and Lucide React icons.

## Quick Start

```bash
cd ui
pnpm install
pnpm dev
```

Open `http://localhost:5173` (or the port shown in terminal)

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build Tool |
| Tailwind CSS | 3.4 | Styling |
| Lucide React | Latest | Icons |
| TypeScript | 5.x | Type Safety |

## Architecture

The UI uses **state-based routing** via `App.tsx` instead of React Router. State is lifted to `App.tsx` and passed via props.

```typescript
type Step =
  | 'home'                    // Landing page
  | 'connect'                 // GitHub OAuth (legacy)
  | 'configure'               // Audit settings
  | 'review'                  // Live progress
  | 'scan'                    // Quick scan
  | 'dashboard'               // Project listing
  | 'settings'                // User settings
  | 'audit-details'           // Report viewer
  // NEW in v2.0:
  | 'create-project'          // Create new project
  | 'add-components'          // Add sources
  | 'preaudit-questionnaire'  // Answer questions
```

## Pages

### Core Pages

| Page | File | Description |
|------|------|-------------|
| Home | `HomePage.tsx` | Landing page with quick actions |
| Dashboard | `Dashboard.tsx` | Project listing with status and scores |
| Audit Details | `AuditDetails.tsx` | Report viewer with milestone progress |
| Settings | `Settings.tsx` | User preferences |

### New Project Flow (v2.0)

| Page | File | Description |
|------|------|-------------|
| Create Project | `ProjectCreate.tsx` | Name, description, type selection |
| Add Components | `AddComponents.tsx` | Multi-source manager |
| Pre-Audit Questionnaire | `PreAuditQuestionnaire.tsx` | Smart questions UI |

### Legacy Flow

| Page | File | Description |
|------|------|-------------|
| Connect Source | `ConnectSource.tsx` | GitHub OAuth + repo selection |
| Configure Audit | `ConfigureAudit.tsx` | Ecosystem, test styles |
| Review & Run | `ReviewAndRun.tsx` | Live progress display |
| Scan Contract | `ScanContract.tsx` | Quick contract scan |

## Components

| Component | File | Description |
|-----------|------|-------------|
| Milestone Tracker | `MilestoneTracker.tsx` | 5-milestone progress stepper |
| CoT Reasoning | `CoTReasoning.tsx` | Chain-of-thought display |
| Liability Triage | `LiabilityTriage.tsx` | Scope Q&A form |
| File Selector | `FileSelector.tsx` | File picker tree |

## User Flows

### New Project Flow (v2.0)

```
Dashboard
    │
    └─→ [New Audit] button
           │
           ▼
    ProjectCreate.tsx
    ┌─────────────────────────────┐
    │ • Enter project name        │
    │ • Add description (opt)     │
    │ • Select type:              │
    │   - Full Audit              │
    │   - Contracts Only          │
    │   - DApp Pentest            │
    │   - Library Audit           │
    └──────────────┬──────────────┘
                   ▼
    AddComponents.tsx
    ┌─────────────────────────────┐
    │ Add sources:                │
    │ • GitHub Repository         │
    │ • Deployed Contract         │
    │ • DApp URL                  │
    │ • Library Source            │
    └──────────────┬──────────────┘
                   ▼
    [Start Audit] → API creates job
                   ▼
    PreAuditQuestionnaire.tsx
    ┌─────────────────────────────┐
    │ Answer questions about:     │
    │ • Admin custody model       │
    │ • Oracle trust assumptions  │
    │ • Third-party dependencies  │
    │ • External integrations     │
    │ • Missing source code       │
    │ • Cross-chain bridges       │
    └──────────────┬──────────────┘
                   ▼
    AuditDetails.tsx
    (5-milestone progress + report)
```

### Legacy Flow

```
Dashboard → Connect Source → Configure Audit → Review & Run → Audit Details
```

## API Integration

The UI communicates with the backend via direct `fetch()` calls:

```typescript
// Projects API
GET  /api/projects              // List projects
POST /api/projects              // Create project
POST /api/projects/:id/components  // Add component
POST /api/projects/:id/audit    // Start audit

// Pre-Audit API
GET  /preaudit/questions/:jobId  // Get questionnaire
POST /preaudit/answers/:jobId    // Submit answers
POST /preaudit/skip/:jobId       // Skip questionnaire

// Legacy APIs
GET  /github/repos              // List repos
GET  /github/branches           // List branches
POST /enqueue                   // Queue audit job
GET  /progress                  // Real-time progress (SSE)
```

## Styling

The UI uses Tailwind CSS with a custom `uatu` theme:

```css
/* Primary brand color */
#0F3F62 - Uatu Blue (buttons, headers, active states)

/* Status colors */
green-500/600 - Success, completed
amber-500/600 - Warning, in progress
red-500/600   - Error, critical
gray-400/500  - Inactive, pending
```

## State Management

State is lifted to `App.tsx` and passed via props:

```typescript
// App.tsx state
const [currentStep, setCurrentStep] = useState<Step>('home')
const [repoData, setRepoData] = useState({...})      // Legacy flow
const [projectData, setProjectData] = useState(null) // New flow
const [jobId, setJobId] = useState<number>()
const [isAuthed, setIsAuthed] = useState(false)
```

## Building for Production

```bash
pnpm build
```

Output is placed in `dist/` and served by the backend at `http://localhost:9090`

## Development Tips

1. **Hot Reload**: UI changes are instantly reflected via Vite HMR
2. **API Proxy**: In dev mode, API calls are proxied to `localhost:9090`
3. **TypeScript**: All pages and components are typed
4. **Icons**: Import icons from `lucide-react`

## File Structure

```
ui/
├── public/
│   └── logo.svg
├── src/
│   ├── App.tsx              # Main router and state
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind imports
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ProjectCreate.tsx      # NEW
│   │   ├── AddComponents.tsx      # NEW
│   │   ├── PreAuditQuestionnaire.tsx # NEW
│   │   ├── AuditDetails.tsx
│   │   ├── ConnectSource.tsx
│   │   ├── ConfigureAudit.tsx
│   │   ├── ReviewAndRun.tsx
│   │   ├── ScanContract.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── MilestoneTracker.tsx
│   │   ├── CoTReasoning.tsx
│   │   ├── LiabilityTriage.tsx
│   │   └── FileSelector.tsx
│   └── hooks/
│       └── useAuditProgress.ts   # SSE progress hook
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

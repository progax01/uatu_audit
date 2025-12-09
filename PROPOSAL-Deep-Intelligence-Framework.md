# Deep Intelligence Framework for UatuAudit

## Proposal: Implementing Agentic Workflows for Automated Code Auditing

**Date:** December 9, 2025
**Status:** Proposal
**Author:** UatuAudit Team

---

## Executive Summary

This document outlines a comprehensive proposal to upgrade UatuAudit from its current single/parallel prompt-based architecture to a **Deep Intelligence Framework** featuring:

- **4-Layer Prompt Caching** for 90% cost reduction
- **5-Milestone Execution Pipeline** for thorough analysis
- **Domain-Specific Agents** (Web3, Backend, Frontend) with Master Orchestrator
- **Chain-of-Thought (CoT) Reasoning** for deeper vulnerability detection
- **Executable Test Artifacts** (Foundry, K6, Cypress) as proof-of-concept

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Proposed State](#2-proposed-state)
3. [What Should Change](#3-what-should-change)
4. [Best Approach to Implement](#4-best-approach-to-implement)
5. [Effects on Current Code](#5-effects-on-current-code)
6. [Frontend Architecture Changes](#6-frontend-architecture-changes)
7. [Benefits of Proposal](#7-benefits-of-proposal)
8. [Implementation Priority](#8-implementation-priority)
9. [Appendix: Prompt Templates](#appendix-prompt-templates)

---

## 1. Current State Analysis

### 1.1 Architecture Overview

UatuAudit currently operates as a **3-phase audit pipeline**:

```
PHASE 1: Context Preparation
├── Clone/Refresh Git Repository
├── Bootstrap SOP (Ecosystem Detection)
├── Write Context Files (files_structure.md, test_requirements.md)
└── Initialize results.json

PHASE 2: Claude CLI Audit
├── Build Mega-Prompt (~550 lines)
├── Execute Single Claude Session (or 4 Parallel Sessions)
└── Claude writes findings to results.json

PHASE 3: Report Generation
├── Validate results.json
├── Generate HTML Report
└── Generate PDF via Puppeteer
```

### 1.2 Current Prompt Structure

**Location:** `src/sops/singlePromptAudit.ts`

The current implementation uses a **single mega-prompt** built at runtime containing:
- Instructions for reading context files
- 10 vulnerability categories (generic)
- Test generation instructions
- Scoring algorithm
- Output format specification

**Parallel Mode:** `src/sops/parallelAuditExecutor.ts` runs 4 concurrent sessions:
- Security Analysis
- Contract Explanations
- User Flow Mapping
- Test Execution

### 1.3 Current Limitations

| Limitation | Impact |
|------------|--------|
| No prompt caching | Full context sent every query; high token cost |
| Generic vulnerability categories | Misses domain-specific patterns (Read-Only Reentrancy, etc.) |
| No explicit Chain-of-Thought | Model may skip subtle logic flaws |
| Test descriptions only | No executable PoC tests generated |
| Single audit type | No domain-specific agents (Web3 vs Backend vs Frontend) |
| No milestone state persistence | Cannot resume from specific analysis phase |

### 1.4 Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/runAll.ts` | 383 | Main 3-phase orchestrator |
| `src/sops/singlePromptAudit.ts` | 550+ | Mega-prompt execution |
| `src/sops/parallelAuditExecutor.ts` | 200+ | 4-session parallel mode |
| `src/services/projectAnalyzer.ts` | 496 | Project structure analysis |
| `src/services/ecosystemDetector.ts` | 457 | Framework detection |
| `src/services/contextWriter.ts` | 330 | Context file generation |
| `src/services/ai/claudeCLIProvider.ts` | 80+ | Claude CLI integration |

---

## 2. Proposed State

### 2.1 New Architecture Overview

```
LAYER 1: SYSTEM CORE (Cached Permanently)
├── Master Security Auditor Framework
├── Zero-Mutation Rules
├── Unified JSON Schema
└── Domain Personas (Web3, Backend, Frontend)

LAYER 2: PROJECT CONTEXT (Cached Per-Session)
├── Flattened Source Code
├── Dependency Trees
├── Architecture Diagrams
└── Audit Scope Metadata

LAYER 3: METHODOLOGIES (Cached Per-Task)
├── Vulnerability Detection Patterns
├── Analysis Algorithms
└── Test Generation Templates

LAYER 4: DYNAMIC QUERY (Never Cached)
├── User Commands
├── Milestone Instructions
└── Specific Analysis Requests
```

### 2.2 New Execution Pipeline

```
MILESTONE 1: Context Ingestion
├── Read entire codebase
├── Cache project context
└── Output: {"status": "Context Received"}

MILESTONE 2: Static & Structural Analysis
├── Map architecture (inheritance, dependencies)
├── Identify attack surfaces
├── Detect static vulnerabilities
└── Output: audit_report.findings.static_analysis

MILESTONE 3: Deep Logic Simulation
├── Chain-of-Thought reasoning
├── Simulate attacker kill chains
├── Cross-contract analysis
└── Output: audit_report.findings.logic_analysis

MILESTONE 4: Test Generation
├── Generate Foundry tests (Web3)
├── Generate K6 scripts (Backend)
├── Generate Cypress tests (Frontend)
└── Output: audit_report.tooling_artifacts

MILESTONE 5: Final Consolidated Audit
├── Combine all findings
├── Calculate score
├── Generate recommendations
└── Output: Final audit_report JSON
```

### 2.3 Domain Agent System

```
┌─────────────────────────────────────────────────────────┐
│                  MASTER ORCHESTRATOR                     │
│  - Determines which domain agent(s) to invoke           │
│  - Ensures milestone order                               │
│  - Enforces JSON schema & Zero-Mutation                 │
│  - Combines outputs into unified report                 │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│  WEB3     │  │  BACKEND  │  │ FRONTEND  │
│  AGENT    │  │  AGENT    │  │  AGENT    │
├───────────┤  ├───────────┤  ├───────────┤
│ EVM       │  │ OWASP     │  │ Redux     │
│ Solidity  │  │ API       │  │ React     │
│ Foundry   │  │ K6        │  │ Cypress   │
│ Hardhat   │  │ Injection │  │ XSS/DOM   │
└───────────┘  └───────────┘  └───────────┘
```

---

## 3. What Should Change

### 3.1 Prompt Architecture

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Structure** | Single mega-prompt (~550 lines) | 4-Layer Cached System |
| **Caching** | None; full context every time | Strategic cache breakpoints; 90% cost reduction |
| **Personas** | Generic "security auditor" | Role-Based: EVM Auditor, API Pentester, Frontend Architect |
| **Output** | Custom `results.json` schema | Unified JSON Audit Schema |

### 3.2 Audit Execution

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Flow** | 3-phase (Bootstrap → Audit → Report) | 5 Milestones with state persistence |
| **Reasoning** | Implicit | Explicit Chain-of-Thought (CoT) |
| **Agents** | 4 parallel sessions (all generic) | Domain-Specific Agents with routing |
| **Mutation** | Not enforced | Zero-Mutation Principle (strict read-only) |

### 3.3 Vulnerability Detection

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Categories** | 10 generic | Domain-specific deep patterns |
| **Detection** | General pattern matching | CoT-guided multi-step analysis |
| **Cross-Contract** | Limited | Full dependency tracing |

**New Vulnerability Patterns:**

**Web3:**
- Read-Only Reentrancy
- Flash Loan Oracle Manipulation
- EIP-712 Signature Replay
- Storage Slot Collisions
- Upgradeable Proxy Flaws

**Backend:**
- NoSQL Operator Injection
- Next.js Middleware Bypass (CVE-2025-29927)
- Race Condition Exploits
- Deserialization Attacks

**Frontend:**
- Redux State Manipulation
- React Query Cache Poisoning
- Time-Travel Attacks
- DOM-based XSS

### 3.4 Test Generation

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Output** | Test descriptions in JSON | Executable test code files |
| **Web3** | Conceptual tests | Foundry `.t.sol` files with `vm.startPrank()` |
| **Backend** | Conceptual tests | K6 load scripts, curl commands |
| **Frontend** | Conceptual tests | Cypress `.cy.js` E2E tests |
| **Validation** | Manual | Tests prove vulnerabilities exist |

### 3.5 Context Management

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Files** | `files_structure.md`, `test_requirements.md` | Add methodology caches, milestone state |
| **Size** | Everything in one pass | Tiered: static cached, dynamic transient |
| **Resume** | Basic milestone tracking | Full state per milestone |

---

## 4. Best Approach to Implement

### Phase 1: Prompt Layer Refactoring

**Duration:** 1 sprint
**Risk:** Low

#### 4.1.1 Create `.claude/` Folder Structure

```
.claude/
├── system.md                    # Master Security Auditor Framework
├── personas/
│   ├── web3.md                  # EVM & Solidity Auditor
│   ├── backend.md               # API & Server Security Auditor
│   └── frontend.md              # Client-Side Logic Auditor
├── methodologies/
│   ├── reentrancy.md            # Reentrancy detection patterns
│   ├── oracle-manipulation.md   # Oracle attack patterns
│   ├── signature-replay.md      # EIP-712 replay detection
│   ├── injection.md             # SQL/NoSQL injection patterns
│   ├── middleware-bypass.md     # Next.js middleware issues
│   └── xss-dom.md               # XSS/DOM patterns
├── milestones/
│   ├── m1-context-ingestion.md
│   ├── m2-static-analysis.md
│   ├── m3-logic-simulation.md
│   ├── m4-test-generation.md
│   └── m5-final-consolidation.md
└── schemas/
    └── unified-audit-schema.json
```

#### 4.1.2 Implement Prompt Caching Logic

**File:** `src/services/promptCache.ts` (new)

```typescript
interface CacheLayer {
  layer: 1 | 2 | 3 | 4;
  content: string;
  hash: string;
  cached: boolean;
}

interface PromptCacheManager {
  setSystemCore(content: string): void;
  setProjectContext(content: string): void;
  setMethodology(content: string): void;
  buildPrompt(dynamicQuery: string): string;
  getCacheStats(): { hits: number; misses: number; savings: number };
}
```

---

### Phase 2: Milestone-Based Execution Engine

**Duration:** 2 sprints
**Risk:** Medium

#### 4.2.1 Create Milestone Executor

**File:** `src/sops/milestoneExecutor.ts` (new)

```typescript
interface MilestoneConfig {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  promptTemplate: string;
  requiredInputs: string[];
  outputSchema: object;
  timeout: number;
}

interface MilestoneState {
  milestone: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

class MilestoneExecutor {
  async execute(milestone: MilestoneConfig, state: MilestoneState): Promise<MilestoneState>;
  async resume(fromMilestone: number): Promise<void>;
  getState(): MilestoneState[];
}
```

#### 4.2.2 Milestone State Persistence

**Location:** `context/milestone_state.json`

```json
{
  "milestones": [
    {
      "id": 1,
      "name": "Context Ingestion",
      "status": "completed",
      "outputs": { "context_cached": true }
    },
    {
      "id": 2,
      "name": "Static Analysis",
      "status": "in_progress",
      "outputs": { "findings_count": 12 }
    }
  ],
  "current_milestone": 2,
  "can_resume": true
}
```

---

### Phase 3: Domain Agent System

**Duration:** 2 sprints
**Risk:** Medium-High

#### 4.3.1 Create Agent Router

**File:** `src/agents/masterOrchestrator.ts` (new)

```typescript
interface AgentRouting {
  detectDomains(projectPath: string): Promise<('web3' | 'backend' | 'frontend')[]>;
  routeToAgent(domain: string, context: AuditContext): Promise<AgentResult>;
  combineResults(results: AgentResult[]): UnifiedAuditReport;
}
```

#### 4.3.2 Domain Agent Interfaces

**File:** `src/agents/types.ts` (new)

```typescript
interface DomainAgent {
  name: string;
  persona: string;
  supportedEcosystems: string[];
  methodologies: string[];

  analyze(context: AuditContext): Promise<DomainFindings>;
  generateTests(findings: DomainFindings): Promise<TestArtifacts>;
}

interface TestArtifacts {
  foundry_tests?: string[];      // .t.sol files
  k6_scripts?: string[];         // K6 load test scripts
  cypress_tests?: string[];      // Cypress E2E tests
  curl_commands?: string[];      // API test commands
}
```

---

### Phase 4: Chain-of-Thought Integration

**Duration:** 1 sprint
**Risk:** Low

#### 4.4.1 CoT Prompt Structure

Add to all milestone prompts:

```markdown
## Chain-of-Thought Requirements

Before providing findings, you MUST think step-by-step:

1. **Map the System**: Identify all contracts/modules and their relationships
2. **Trace Data Flow**: Follow user inputs through the system
3. **Identify State Changes**: Mark all state-modifying operations
4. **Hypothesize Attacks**: For each state change, consider exploitation
5. **Validate Hypothesis**: Confirm or reject each attack vector
6. **Document Reasoning**: Include your reasoning in the output

Format your reasoning as:
```json
{
  "reasoning": {
    "step": "Mapping call graph for withdraw()",
    "observation": "withdraw() calls external token.transfer() before updating balances",
    "hypothesis": "Classic reentrancy pattern detected",
    "validation": "Confirmed: no reentrancy guard, state updated after external call",
    "conclusion": "CRITICAL: Reentrancy vulnerability in withdraw()"
  }
}
```

#### 4.4.2 CoT Output Parser

**File:** `src/services/cotParser.ts` (new)

```typescript
interface CoTReasoning {
  step: string;
  observation: string;
  hypothesis: string;
  validation: string;
  conclusion: string;
}

function parseCoTOutput(output: string): {
  reasoning: CoTReasoning[];
  findings: Finding[];
};
```

---

### Phase 5: Test Artifact Generation

**Duration:** 2 sprints
**Risk:** Medium

#### 4.5.1 Foundry Test Generator (Web3)

**Prompt Template:**

```markdown
For each Critical/High finding, generate a Foundry test:

1. Create test contract inheriting from `forge-std/Test.sol`
2. Use `vm.startPrank(attacker)` for user simulation
3. Define malicious contracts if needed (reentrancy, flash loans)
4. Assert the exploit succeeds (e.g., balance drained)
5. Output complete `.t.sol` file content

Example output:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vault.sol";

contract VaultExploitTest is Test {
    Vault vault;
    AttackerContract attacker;

    function setUp() public {
        vault = new Vault();
        attacker = new AttackerContract(address(vault));
        vm.deal(address(vault), 10 ether);
    }

    function testReentrancyExploit() public {
        vm.startPrank(address(attacker));
        attacker.attack();
        assertEq(address(vault).balance, 0);
    }
}
```

#### 4.5.2 K6 Script Generator (Backend)

**Prompt Template:**

```markdown
For each API vulnerability, generate a K6 load test:

1. Import required K6 modules
2. Define test scenario (VUs, duration)
3. Create HTTP requests with malicious payloads
4. Add checks for expected responses
5. Output complete `.js` file content

Example output:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '10s',
};

export default function() {
  // Race condition test: 100 users redeem same coupon
  const payload = JSON.stringify({ coupon_code: 'SINGLE_USE_123' });
  const res = http.post('http://api.example.com/redeem', payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    'only one success': (r) => r.status === 200 || r.status === 400
  });
}
```

#### 4.5.3 Cypress Test Generator (Frontend)

**Prompt Template:**

```markdown
For each frontend vulnerability, generate a Cypress E2E test:

1. Define test suite and test cases
2. Include positive, negative, and security tests
3. Assert DOM state and network responses
4. Output complete `.cy.js` file content

Example output:
```javascript
describe('Login Security', () => {
  it('should escape XSS in username field', () => {
    cy.visit('/login');
    cy.get('input[name="username"]').type('<script>alert(1)</script>');
    cy.get('button[type="submit"]').click();

    // Assert script is escaped, not executed
    cy.get('.error-message').should('contain', '&lt;script&gt;');
    cy.window().then((win) => {
      expect(win.xssTriggered).to.be.undefined;
    });
  });
});
```

---

## 5. Effects on Current Code

### 5.1 Files Requiring Major Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/sops/singlePromptAudit.ts` | **REWRITE** | Replace with milestone-based executor |
| `src/sops/prompts/*.ts` | **REFACTOR** | Split into persona + methodology + milestone |
| `src/services/ai/claudeCLIProvider.ts` | **ENHANCE** | Add prompt caching, cache breakpoints |
| `src/services/contextWriter.ts` | **EXTEND** | Add methodology caches, milestone state |
| `src/types.ts` | **UPDATE** | New interfaces for milestones, agents, unified schema |

### 5.2 Files Requiring Minor Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/services/runAll.ts` | **ADJUST** | Update for 5-milestone flow |
| `src/services/progressService.ts` | **UPDATE** | Milestone-level progress tracking |
| `src/sops/parallelAuditExecutor.ts` | **MERGE** | Integrate into domain agent system |
| `src/services/report/simpleReportGenerator.ts` | **EXTEND** | Handle unified schema, CoT display |
| `src/templates/report-template.html` | **ENHANCE** | Add reasoning sections, test artifacts |

### 5.3 New Files to Create

| File | Purpose |
|------|---------|
| `src/agents/masterOrchestrator.ts` | Route to domain agents |
| `src/agents/web3Agent.ts` | EVM/Solidity specialized analysis |
| `src/agents/backendAgent.ts` | API/Server specialized analysis |
| `src/agents/frontendAgent.ts` | Client-side specialized analysis |
| `src/agents/types.ts` | Agent interfaces |
| `src/sops/milestoneExecutor.ts` | 5-milestone execution engine |
| `src/services/promptCache.ts` | Prompt caching layer |
| `src/services/cotParser.ts` | Chain-of-Thought parser |
| `.claude/` folder | All prompt templates (see structure above) |

### 5.4 Backward Compatibility

| Concern | Mitigation |
|---------|------------|
| Existing `results.json` schema | Add migration layer; support both schemas during transition |
| Current parallel executor | Feature flag `USE_LEGACY_PARALLEL=true` for rollback |
| Report template | Graceful degradation; detect schema version |
| API responses | Version API endpoints (`/v1/` vs `/v2/`) |

---

## 6. Frontend Architecture Changes

### 6.1 Current Frontend State

**Location:** `ui/src/`

| Page | Current Function |
|------|------------------|
| `HomePage.tsx` | Landing page with mascot, OAuth button |
| `ConnectSource.tsx` | GitHub OAuth, repo/branch selection |
| `ConfigureAudit.tsx` | File selector, test style selection |
| `ReviewAndRun.tsx` | Live progress tracking (3 phases) |
| `ScanContract.tsx` | Deployed contract scanner |

**Current Progress Model:**
- 5 weighted phases: bootstrap(10%) → inventory(20%) → analysis(35%) → testgen(15%) → execute(20%)
- Single progress bar with phase labels
- Basic log streaming

### 6.2 Required Frontend Changes

#### 6.2.1 New UI Components Needed

| Component | Purpose |
|-----------|---------|
| `MilestoneTracker.tsx` | 5-milestone visual stepper (replaces phase bar) |
| `AgentStatusPanel.tsx` | Show which domain agent(s) are active |
| `CoTReasoningView.tsx` | Expandable Chain-of-Thought reasoning display |
| `TestArtifactsPanel.tsx` | Display/download generated test files |
| `DomainSelector.tsx` | Manual override for domain agent selection |
| `FindingSeverityChart.tsx` | Enhanced severity breakdown visualization |
| `ReasoningAccordion.tsx` | Collapsible reasoning steps per finding |

#### 6.2.2 Page Changes

**`ConfigureAudit.tsx` Changes:**

| Current | Proposed |
|---------|----------|
| Test style selection only | Add **Domain Selection** (Auto-detect / Web3 / Backend / Frontend / Multi) |
| Single file selector | Add **Audit Depth** selector (Quick / Standard / Deep) |
| - | Add **Methodology Toggles** (enable/disable specific checks) |

```
New UI Elements:
┌─────────────────────────────────────────────────┐
│ Audit Configuration                              │
├─────────────────────────────────────────────────┤
│ Domain: [Auto-detect ▼] [Web3] [Backend] [Frontend] │
│                                                  │
│ Depth:  ○ Quick (M1+M2)                         │
│         ● Standard (M1-M4)                      │
│         ○ Deep (M1-M5 + CoT)                    │
│                                                  │
│ Methodologies:                                   │
│   ☑ Reentrancy Detection                        │
│   ☑ Oracle Manipulation                         │
│   ☑ Access Control                              │
│   ☐ Gas Optimization (optional)                 │
└─────────────────────────────────────────────────┘
```

**`ReviewAndRun.tsx` Changes:**

| Current | Proposed |
|---------|----------|
| Single progress bar | **5-Milestone Stepper** with status icons |
| Phase labels | **Active Agent Indicator** (Web3/Backend/Frontend) |
| Basic logs | **Structured Log Sections** per milestone |
| - | **Live CoT Reasoning** stream |
| - | **Partial Results Preview** (findings as they're discovered) |

```
New UI Layout:
┌─────────────────────────────────────────────────────────┐
│ Audit Progress                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [✓] Context  [✓] Static  [●] Logic  [ ] Tests  [ ] Final │
│       100%        100%       45%        0%         0%    │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Active Agent: Web3 (EVM & Solidity Auditor)         │ │
│ │ Current Task: Analyzing cross-contract dependencies │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Live Findings (3 found so far):                         │
│ ├─ 🔴 CRITICAL: Reentrancy in withdraw()               │
│ ├─ 🟠 HIGH: Unchecked return value                     │
│ └─ 🟡 MEDIUM: Missing zero-address check               │
│                                                          │
│ ▼ Chain-of-Thought Reasoning                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Step: Tracing withdraw() call graph                 │ │
│ │ Observation: External call before state update      │ │
│ │ Hypothesis: Classic reentrancy pattern              │ │
│ │ Validation: No reentrancy guard present             │ │
│ │ Conclusion: CRITICAL vulnerability confirmed        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Report View Changes:**

| Current | Proposed |
|---------|----------|
| Findings table | Add **Reasoning Expandable** per finding |
| - | Add **Test Artifacts Section** with download buttons |
| - | Add **Agent Attribution** (which agent found what) |
| Static severity chart | **Interactive Severity Breakdown** with drill-down |

```
New Report Sections:
┌─────────────────────────────────────────────────────────┐
│ Finding: Reentrancy Vulnerability                       │
├─────────────────────────────────────────────────────────┤
│ Severity: CRITICAL    Agent: Web3    File: Vault.sol:45│
│                                                          │
│ Description: ...                                         │
│                                                          │
│ ▼ How We Found This (Chain-of-Thought)                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. Mapped call graph: withdraw() → token.transfer() │ │
│ │ 2. Observed: state update AFTER external call       │ │
│ │ 3. Hypothesis: attacker can re-enter during transfer│ │
│ │ 4. Validated: no reentrancy guard modifier          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ▼ Proof-of-Concept Test                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📄 VaultExploit.t.sol                    [Download] │ │
│ │ ```solidity                                         │ │
│ │ function testReentrancyExploit() public {           │ │
│ │   vm.startPrank(attacker);                          │ │
│ │   attacker.attack();                                │ │
│ │   assertEq(address(vault).balance, 0);              │ │
│ │ }                                                   │ │
│ │ ```                                                 │ │
│ │ Run: forge test --match-test testReentrancyExploit  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Recommendation: Add ReentrancyGuard modifier            │
└─────────────────────────────────────────────────────────┘
```

#### 6.2.3 New API Endpoints Required

| Endpoint | Purpose |
|----------|---------|
| `GET /progress/milestones` | Get detailed milestone status (not just phases) |
| `GET /progress/agents` | Get active agent information |
| `GET /progress/reasoning` | Stream CoT reasoning in real-time |
| `GET /progress/findings` | Get partial findings as they're discovered |
| `GET /artifacts/:jobId` | Download generated test files |
| `POST /audit/configure` | Set domain, depth, methodology options |

#### 6.2.4 State Management Changes

**New State Shape:**

```typescript
interface AuditProgress {
  // Current
  overall_pct: number;
  phases: PhaseProgress[];

  // NEW
  milestones: MilestoneProgress[];
  activeAgent: 'web3' | 'backend' | 'frontend' | null;
  reasoning: CoTStep[];
  partialFindings: Finding[];
  artifacts: TestArtifact[];
}

interface MilestoneProgress {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  pct: number;
  startTime?: string;
  endTime?: string;
  agent?: string;
}

interface CoTStep {
  timestamp: string;
  step: string;
  observation: string;
  hypothesis: string;
  validation: string;
  conclusion: string;
  relatedFinding?: string;
}

interface TestArtifact {
  type: 'foundry' | 'k6' | 'cypress' | 'curl';
  filename: string;
  content: string;
  relatedFinding: string;
}
```

#### 6.2.5 New Hooks Required

| Hook | Purpose |
|------|---------|
| `useMilestoneProgress()` | Subscribe to milestone updates |
| `useActiveAgent()` | Track which agent is currently running |
| `useCoTStream()` | Real-time CoT reasoning subscription |
| `usePartialFindings()` | Get findings as they're discovered |
| `useTestArtifacts()` | Manage generated test files |

### 6.3 UI/UX Improvements

#### Visual Design Updates

| Element | Current | Proposed |
|---------|---------|----------|
| Progress | Single bar | 5-step milestone stepper with icons |
| Status | Text labels | Animated agent avatars |
| Findings | Table only | Cards with expandable reasoning |
| Tests | Description text | Code blocks with syntax highlighting + download |
| Logs | Plain text stream | Structured, filterable by milestone/agent |

#### User Flow Changes

```
Current Flow:
Connect → Configure → Run → Wait → Report

Proposed Flow:
Connect → Configure (Domain + Depth + Methods) → Run →
  → Live Milestones (with partial results) →
  → Report (with reasoning + artifacts)
```

### 6.4 Frontend File Changes Summary

#### Files to Modify

| File | Changes |
|------|---------|
| `ui/src/pages/ConfigureAudit.tsx` | Add domain selector, depth selector, methodology toggles |
| `ui/src/pages/ReviewAndRun.tsx` | Replace phase bar with milestone stepper, add agent panel, CoT viewer |
| `ui/src/hooks/useAuditProgress.ts` | Add milestone, agent, reasoning state |
| `ui/src/App.tsx` | Add routes for new pages if needed |

#### New Files to Create

| File | Purpose |
|------|---------|
| `ui/src/components/MilestoneTracker.tsx` | 5-step visual progress stepper |
| `ui/src/components/AgentStatusPanel.tsx` | Active agent display |
| `ui/src/components/CoTReasoningView.tsx` | Chain-of-thought reasoning display |
| `ui/src/components/TestArtifactsPanel.tsx` | Test file display/download |
| `ui/src/components/FindingCard.tsx` | Enhanced finding display with reasoning |
| `ui/src/components/DomainSelector.tsx` | Domain selection chips |
| `ui/src/components/DepthSelector.tsx` | Audit depth radio buttons |
| `ui/src/components/MethodologyToggles.tsx` | Methodology checkboxes |
| `ui/src/hooks/useMilestoneProgress.ts` | Milestone progress hook |
| `ui/src/hooks/useCoTStream.ts` | Real-time reasoning hook |
| `ui/src/hooks/useTestArtifacts.ts` | Test artifacts management |
| `ui/src/types/audit.ts` | New TypeScript interfaces |

### 6.5 Report Template Changes

**File:** `src/templates/report-template.html`

| Section | Current | Proposed |
|---------|---------|----------|
| Header | Basic metadata | Add agent attribution, milestone summary |
| Findings | Simple table | Cards with expandable CoT reasoning |
| Score | Static gauge | Interactive breakdown chart |
| Tests | Text descriptions | Code blocks + copy/download buttons |
| - | - | NEW: Reasoning timeline visualization |
| - | - | NEW: Test artifacts download section |

---

## 7. Benefits of Proposal

### 7.1 Cost Efficiency

| Benefit | Quantified Impact |
|---------|-------------------|
| **Token Cost Reduction** | 90% reduction via prompt caching |
| **Tiered Context Loading** | Only load relevant methodology per milestone |
| **Reusable Methodology Cache** | Same patterns across all audits |
| **Faster Iterations** | Cached context = lower TTFT latency |

**Example Cost Calculation:**

```
Current: 100K tokens per audit × $0.01/1K = $1.00/audit
Proposed:
  - Layer 1-3 cached: 80K tokens (paid once)
  - Layer 4 dynamic: 20K tokens per query
  - 5 milestones: 20K × 5 = 100K tokens (but 80K cached)
  - Effective: 20K fresh + 80K @ 90% discount = $0.28/audit

Savings: 72% cost reduction
```

### 7.2 Audit Quality

| Benefit | Impact |
|---------|--------|
| **Deeper Detection** | CoT catches multi-step logic flaws |
| **Domain Expertise** | Specialized agents understand EVM semantics, API patterns |
| **Executable PoCs** | Tests prove vulnerabilities (not theoretical) |
| **Cross-Contract Analysis** | Detect read-only reentrancy, oracle manipulation |
| **Consistent Coverage** | Milestone-based ensures nothing skipped |

**New Vulnerabilities Detectable:**

- Read-Only Reentrancy (missed by current generic patterns)
- Flash Loan Oracle Manipulation
- EIP-712 Signature Replay with domain separator issues
- NoSQL Operator Injection (`$ne`, `$gt`, `$where`)
- Next.js Middleware Bypass
- Redux State Manipulation attacks
- React Query Cache Poisoning

### 7.3 Developer Experience

| Benefit | Impact |
|---------|--------|
| **Actionable Output** | Run `forge test` / `k6 run` / `npx cypress` immediately |
| **Clear Reasoning** | CoT explains WHY something is vulnerable |
| **Resume Capability** | Interrupted audits continue from last milestone |
| **Unified Schema** | Consistent JSON enables CI/CD integration |
| **Better Reports** | Include reasoning, test results, remediation code |

### 7.4 Scalability

| Benefit | Impact |
|---------|--------|
| **Multi-Domain** | One audit covers Web3 + Backend + Frontend |
| **Parallel Agents** | Domain agents can run concurrently |
| **Methodology Reuse** | Add new patterns without changing core |
| **Enterprise Ready** | Persistent state, job queue, resume support |

### 7.5 Maintainability

| Benefit | Impact |
|---------|--------|
| **Modular Prompts** | Update persona without affecting methodology |
| **Version Control** | `.claude/` in git; track prompt changes |
| **Testable Components** | Each milestone has clear inputs/outputs |
| **Separation of Concerns** | Agents, milestones, prompts are independent |

---

## 8. Implementation Priority

### Priority Matrix

```
                    HIGH IMPACT
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         │   PHASE 1     │   PHASE 2     │
         │   Prompts     │   Milestones  │
         │               │               │
LOW ─────┼───────────────┼───────────────┼───── HIGH
EFFORT   │               │               │     EFFORT
         │   PHASE 4     │   PHASE 3     │
         │   CoT         │   Agents      │
         │               │               │
         └───────────────┼───────────────┘
                         │
                    LOW IMPACT
```

### Recommended Order

#### Sprint 1-2: Phase 1 (Prompt Layer)
- Create `.claude/` folder structure
- Implement Zero-Mutation enforcement
- Add Chain-of-Thought requirements
- **Deliverable:** Modular prompt system

#### Sprint 3-4: Phase 2 (Milestones)
- Refactor to 5-milestone execution
- Implement milestone state persistence
- Add resume capability
- **Deliverable:** Milestone executor

#### Sprint 5-6: Phase 3 (Agents)
- Create domain agent interfaces
- Implement Master Orchestrator
- Build Web3/Backend/Frontend agents
- **Deliverable:** Multi-domain support

#### Sprint 7: Phase 4 (CoT)
- Add CoT parsing
- Include reasoning in reports
- Validate reasoning completeness
- **Deliverable:** Explainable findings

#### Sprint 8-9: Phase 5 (Test Artifacts)
- Implement Foundry test generator
- Implement K6 script generator
- Implement Cypress test generator
- **Deliverable:** Executable PoCs

### Quick Wins (Can Start Immediately)

1. Create `.claude/system.md` with Zero-Mutation rules
2. Add CoT requirements to existing prompts
3. Create unified JSON schema
4. Add domain detection to ecosystem detector

---

## Appendix: Prompt Templates

### A.1 Master System Prompt

```markdown
# Master Security Auditor Framework

You are an Autonomous Multi-Domain Security Auditor operating under the
"Deep Intelligence Framework for Automated Code Auditing."

## Universal Principles

### 1. ZERO-MUTATION RULE
- Never modify the provided code
- You may describe remediation, but never output refactored code
- Focus on evidence: exploit scenarios, test scripts, payload vectors

### 2. STRICT JSON OUTPUT
- All results must be valid JSON following the Unified Audit Schema
- If output is not JSON, self-correct immediately

### 3. CHAIN-OF-THOUGHT (CoT) MANDATORY
- Think step-by-step BEFORE giving the JSON answer
- Use internal reasoning to detect multi-step logic flaws
- Document your reasoning in the output

### 4. MILESTONE-BASED EXECUTION
Completion Order:
1. Context Ingestion
2. Static / Structural Analysis
3. Deep Logic Simulation
4. Verification Test Generation
5. Final Consolidated Audit

### 5. ROLE-BASED EXECUTION
Load the correct persona based on audit domain:
- Web3 → "Senior Solidity & EVM Security Researcher"
- Backend → "Senior API Penetration Tester"
- Frontend → "Client-Side Logic Architect"

### 6. PROMPT CACHING LAYERS
- Layer 1: System Core (this prompt)
- Layer 2: Project Context (codebase, configs)
- Layer 3: Methodologies (vulnerability patterns)
- Layer 4: Dynamic Query (per-task instructions)
```

### A.2 Web3 Agent Persona

```markdown
# Web3 Agent: EVM & Solidity Security Researcher

## Persona
You are a Senior EVM & Solidity Security Researcher specializing in:
- DeFi protocol security
- Foundry/Hardhat tooling
- Multi-contract logic analysis

## Responsibilities
- Perform full EVM-level reasoning and storage slot tracing
- Detect complex vulnerabilities:
  - Read-only reentrancy
  - Invariant breaks
  - Flash Loan oracle manipulation
  - Signature Replay (EIP-712)
  - Upgradeable proxy flaws
- Map system architecture: inheritance, modifiers, control flow
- Generate Foundry exploit tests for Critical/High issues

## Guarantees
- NEVER modify code
- All outputs in JSON
- Simulate attacker behavior using accurate EVM semantics
- Generate PoC exploit steps + corresponding Foundry tests
```

### A.3 Backend Agent Persona

```markdown
# Backend Agent: API & Server Security Auditor

## Persona
You are a Senior Penetration Tester specializing in:
- API security (OWASP Top 10)
- Race conditions and concurrency
- Injection attacks and authentication bypass

## Responsibilities
- Map API surface using OpenAPI specs and route files
- Detect vulnerabilities:
  - NoSQL injection (`$ne`, `$gt`, `$where`)
  - SQLi via raw queries
  - Deserialization attacks
  - CSRF, SSRF, Path Traversal
  - Authentication/Session misconfigurations
  - Next.js middleware bypass
- Generate K6 load tests and curl payloads

## Guarantees
- Zero mutation; read-only audits
- JSON structured outputs
- Simulate real-world attacker behaviors
```

### A.4 Frontend Agent Persona

```markdown
# Frontend Agent: Client-Side Logic Auditor

## Persona
You are a Client-Side Logic Architect specializing in:
- SPA security
- State management exploitation
- DOM-based attacks

## Responsibilities
- Map state flows and identify sensitive state values
- Detect vulnerabilities:
  - Redux state manipulation
  - React Query cache poisoning
  - Time-travel attacks
  - DOM-based XSS
  - URL injection
- Evaluate DOM sanitization and script loading
- Generate Cypress/Playwright E2E tests

## Guarantees
- Zero mutation
- JSON-only output
- Accurate logic flow modelling
```

### A.5 Unified JSON Audit Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Unified Audit Report",
  "type": "object",
  "properties": {
    "audit_report": {
      "type": "object",
      "properties": {
        "metadata": {
          "type": "object",
          "properties": {
            "target_system": { "type": "string" },
            "audit_domain": { "enum": ["Web3", "Backend", "Frontend", "Multi-Domain"] },
            "auditor_model": { "type": "string" },
            "timestamp": { "type": "string", "format": "date-time" },
            "duration_seconds": { "type": "number" }
          }
        },
        "milestone_summary": {
          "type": "object",
          "properties": {
            "current_milestone": { "type": "string" },
            "completion_status": { "enum": ["Pending", "In Progress", "Complete", "Failed"] },
            "milestones_completed": { "type": "array", "items": { "type": "string" } }
          }
        },
        "findings": {
          "type": "object",
          "properties": {
            "static_analysis": { "type": "array" },
            "logic_analysis": { "type": "array" }
          }
        },
        "reasoning": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "step": { "type": "string" },
              "observation": { "type": "string" },
              "hypothesis": { "type": "string" },
              "validation": { "type": "string" },
              "conclusion": { "type": "string" }
            }
          }
        },
        "tooling_artifacts": {
          "type": "object",
          "properties": {
            "foundry_tests": { "type": "array", "items": { "type": "string" } },
            "k6_scripts": { "type": "array", "items": { "type": "string" } },
            "cypress_tests": { "type": "array", "items": { "type": "string" } },
            "curl_commands": { "type": "array", "items": { "type": "string" } }
          }
        },
        "score": {
          "type": "object",
          "properties": {
            "value": { "type": "number", "minimum": 0, "maximum": 100 },
            "grade": { "enum": ["A", "B", "C", "D", "F"] },
            "breakdown": {
              "type": "object",
              "properties": {
                "critical": { "type": "number" },
                "high": { "type": "number" },
                "medium": { "type": "number" },
                "low": { "type": "number" },
                "info": { "type": "number" }
              }
            }
          }
        },
        "recommendations": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-09 | UatuAudit Team | Initial proposal |

---

*This document is based on the "Deep Intelligence Frameworks for Automated Code Auditing" research report and adapted for UatuAudit's specific architecture and requirements.*

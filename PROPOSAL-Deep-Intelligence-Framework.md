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
10. [Critical Analysis: Flaws, Gaps & Suggestions](#10-critical-analysis-flaws-gaps--suggestions)
11. [Report UI Redesign Specification](#11-report-ui-redesign-specification)

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

## 10. Critical Analysis: Flaws, Gaps & Suggestions

### 10.1 Architectural Flaws Identified

#### Flaw 1: Single Point of Failure in Master Orchestrator

**Problem:** The Master Orchestrator is a monolithic decision maker. If it fails or makes wrong routing decisions, the entire audit fails.

**Impact:** High - No fallback mechanism

**Suggested Fix:**
```
CURRENT:
  Master Orchestrator → Single Decision → Agent

PROPOSED:
  ┌─────────────────────────────────────────────────┐
  │            RESILIENT ORCHESTRATION              │
  ├─────────────────────────────────────────────────┤
  │  Primary Orchestrator ←→ Fallback Orchestrator  │
  │         ↓                       ↓               │
  │  Decision Validator (consensus check)           │
  │         ↓                                       │
  │  Agent Pool with Health Checks                  │
  └─────────────────────────────────────────────────┘
```

#### Flaw 2: No Agent Communication / Collaboration

**Problem:** Agents work in isolation. Web3 agent may find something that Backend agent needs to know (e.g., an API endpoint called from a contract).

**Impact:** Medium - Missed cross-domain vulnerabilities

**Suggested Fix:**
```
Add: Inter-Agent Message Bus

┌──────────┐    ┌──────────────┐    ┌──────────┐
│  Web3    │◄──►│  Message Bus │◄──►│ Backend  │
│  Agent   │    │  (findings,  │    │  Agent   │
└──────────┘    │   context)   │    └──────────┘
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │   Frontend   │
                │    Agent     │
                └──────────────┘
```

#### Flaw 3: Linear Milestone Execution is Inflexible

**Problem:** Strict M1→M2→M3→M4→M5 order. What if M3 (Logic Simulation) discovers something that requires re-running M2 (Static Analysis)?

**Impact:** Medium - Cannot adapt to findings

**Suggested Fix:**
```
Add: Milestone Feedback Loops

M1 ──► M2 ──► M3 ──► M4 ──► M5
              │      │
              ▼      │
        ┌─────────┐  │
        │ Re-scan │◄─┘
        │ Trigger │
        └─────────┘

Allow M3/M4 to trigger targeted M2 re-runs for specific files
```

#### Flaw 4: No Confidence Scoring for Findings

**Problem:** All findings are treated equally confident. AI may be 95% sure about one finding and 40% about another.

**Impact:** Medium - False positives treated same as true positives

**Suggested Fix:**
```json
{
  "finding": {
    "id": "VULN-001",
    "severity": "critical",
    "confidence": 0.95,        // NEW
    "confidence_factors": [     // NEW
      "Pattern match: exact",
      "Cross-reference: 2 sources",
      "Historical: seen in 50 audits"
    ],
    "requires_manual_review": false  // NEW
  }
}
```

#### Flaw 5: No Versioning for Methodology Files

**Problem:** Methodology files (reentrancy.md, etc.) will evolve. No way to track which version was used for an audit.

**Impact:** Low - Audit reproducibility issues

**Suggested Fix:**
```
.claude/
├── methodologies/
│   ├── reentrancy/
│   │   ├── v1.0.md
│   │   ├── v1.1.md
│   │   └── latest.md → v1.1.md (symlink)
│   └── manifest.json  # tracks versions used per audit
```

---

### 10.2 Missing Components

#### Gap 1: No Audit Diff / Comparison Feature

**Problem:** Cannot compare two audits of the same project (before/after fix).

**Suggested Addition:**
```
New Feature: Audit Diff Engine

Input: audit_v1.json, audit_v2.json
Output: {
  "fixed_vulnerabilities": [...],
  "new_vulnerabilities": [...],
  "unchanged_vulnerabilities": [...],
  "regression_score": 85  // % improvement
}
```

#### Gap 2: No False Positive Feedback Loop

**Problem:** When user marks a finding as false positive, system doesn't learn.

**Suggested Addition:**
```
New Component: Feedback Collector

User marks finding as false positive
        ↓
Store in feedback_db.json
        ↓
Pre-audit: Load past false positives for this project
        ↓
Include in prompt: "These patterns were previously marked as false positives..."
        ↓
AI avoids repeating same mistakes
```

#### Gap 3: No Severity Auto-Calibration

**Problem:** Severity is static. A "medium" in a DEX contract may be "critical" in a lending protocol.

**Suggested Addition:**
```
New Feature: Context-Aware Severity

Input: Project type (DEX, Lending, NFT, etc.)
       TVL if available
       Contract criticality map

Calibration Rules:
  - Lending protocol + price oracle issue = bump to CRITICAL
  - NFT contract + reentrancy in mint = bump to HIGH (not CRITICAL)
  - DEX + slippage issue = context-dependent
```

#### Gap 4: No Integration with Existing Security Tools

**Problem:** Proposal ignores existing tools (Slither, Mythril, Semgrep).

**Suggested Addition:**
```
New Layer: Tool Integration Layer

┌─────────────────────────────────────────────────┐
│              HYBRID ANALYSIS ENGINE             │
├─────────────────────────────────────────────────┤
│                                                  │
│  Static Tools          AI Agents                │
│  ┌─────────┐          ┌─────────┐              │
│  │ Slither │          │  Web3   │              │
│  │ Mythril │    ──►   │  Agent  │              │
│  │ Semgrep │  merge   │         │              │
│  └─────────┘          └─────────┘              │
│       │                    │                    │
│       └────────┬───────────┘                    │
│                ▼                                │
│         Unified Findings                        │
│    (deduplicated, enriched)                     │
└─────────────────────────────────────────────────┘
```

#### Gap 5: No Rate Limiting / Cost Control

**Problem:** Deep audit on large codebase could consume unlimited tokens.

**Suggested Addition:**
```
New Feature: Budget Controller

Config:
  max_tokens_per_audit: 500000
  max_cost_per_audit: $5.00
  alert_threshold: 80%

Runtime:
  - Track token usage per milestone
  - Warn user at 80% budget
  - Graceful degradation at 100% (skip optional milestones)
  - Cost estimation BEFORE starting audit
```

#### Gap 6: No Audit Queue Priority System

**Problem:** All audits treated equal priority. Enterprise customer same as free user.

**Suggested Addition:**
```
New Feature: Priority Queue

Priority Levels:
  P0 - Enterprise (SLA: start within 1 min)
  P1 - Pro users (SLA: start within 5 min)
  P2 - Free tier (SLA: best effort)

Queue Logic:
  - P0 can preempt P2 (pause & resume)
  - Dedicated worker pool for P0
  - Fair scheduling within same priority
```

---

### 10.3 Robustness Suggestions

#### Suggestion 1: Add Circuit Breaker Pattern

**Why:** If Claude API is failing, don't keep retrying and burning tokens.

```
Circuit Breaker States:
  CLOSED (normal) → failures < 3
  OPEN (blocking) → failures >= 3, wait 60s
  HALF-OPEN (testing) → allow 1 request, check result

Benefits:
  - Prevents cascade failures
  - Saves cost during outages
  - Auto-recovery when service restored
```

#### Suggestion 2: Add Audit Checkpoints

**Why:** Long audits (30+ min) should save progress incrementally.

```
Checkpoint Strategy:
  - After each milestone completion
  - Every 5 minutes during long milestones
  - Store: current state, partial findings, context hash

Recovery:
  - On restart, check for checkpoint
  - Validate context hash (code hasn't changed)
  - Resume from checkpoint, skip completed work
```

#### Suggestion 3: Add Canary Deployments for Prompts

**Why:** Prompt changes can break audits. Need safe rollout.

```
Canary Strategy:
  - New prompt version deployed to 5% of audits
  - Compare: finding count, severity distribution, execution time
  - If metrics within threshold, expand to 25% → 50% → 100%
  - Auto-rollback if anomalies detected

Metrics to Track:
  - Findings per 1000 LOC
  - False positive rate (from feedback)
  - Average milestone duration
  - JSON schema validation failures
```

#### Suggestion 4: Add Observability Layer

**Why:** Current proposal lacks monitoring/alerting infrastructure.

```
Observability Stack:

Metrics (Prometheus/Grafana):
  - audit_duration_seconds
  - findings_by_severity
  - token_usage_per_audit
  - agent_success_rate
  - cache_hit_ratio

Logs (Structured JSON):
  - Every milestone start/end
  - Agent routing decisions
  - CoT reasoning steps
  - Error stack traces

Traces (OpenTelemetry):
  - Full audit trace with spans
  - Cross-service correlation
  - Latency breakdown by phase

Alerts:
  - Audit failure rate > 5%
  - Average duration > 2x baseline
  - Token usage anomaly
  - Cache miss rate spike
```

#### Suggestion 5: Add Semantic Versioning for Audit Reports

**Why:** Audit report schema will evolve. Clients need compatibility.

```
Report Versioning:
  {
    "schema_version": "2.1.0",
    "min_compatible_version": "2.0.0",
    "audit_report": { ... }
  }

Compatibility Rules:
  - Major: Breaking changes (new required fields)
  - Minor: New optional fields
  - Patch: Bug fixes, no schema change

Migration:
  - Provide migration scripts between major versions
  - API supports ?schema_version=2.0 parameter
```

#### Suggestion 6: Add Dry Run Mode

**Why:** Users want to preview audit scope/cost before committing.

```
Dry Run Output:
  {
    "estimated_duration": "15-25 minutes",
    "estimated_cost": "$0.45-$0.60",
    "detected_domains": ["web3", "backend"],
    "files_in_scope": 47,
    "contracts_detected": 12,
    "methodologies_applicable": [
      "reentrancy",
      "oracle-manipulation",
      "access-control"
    ],
    "warnings": [
      "Large codebase: consider file selection",
      "No tests detected: test generation recommended"
    ]
  }
```

---

### 10.4 Security Considerations (Missing)

#### Security Gap 1: No Audit Data Encryption

**Problem:** Audit results contain sensitive vulnerability information.

**Suggested Fix:**
```
Encryption Strategy:
  - At rest: AES-256 for stored results
  - In transit: TLS 1.3 minimum
  - Audit reports: Optional client-side encryption key
  - Key rotation: Every 90 days
```

#### Security Gap 2: No Access Control for Reports

**Problem:** Anyone with report URL can access it.

**Suggested Fix:**
```
Access Control:
  - Reports require authentication
  - Owner can share with specific users/teams
  - Time-limited share links (expire after X days)
  - Audit log for all report accesses
```

#### Security Gap 3: No Input Sanitization Strategy

**Problem:** Malicious code in audited repo could affect system.

**Suggested Fix:**
```
Sandboxing Strategy:
  - Clone repos into isolated containers
  - No code execution during audit (read-only)
  - File size limits (skip files > 1MB)
  - Blocklist known malicious patterns
  - Timeout for file reads
```

---

### 10.5 Performance Optimizations (Missing)

#### Perf Gap 1: No Incremental Audit

**Problem:** Re-auditing after small change re-processes everything.

**Suggested Fix:**
```
Incremental Audit:
  - Hash each file
  - Compare with previous audit
  - Only re-analyze changed files
  - Re-run cross-reference for affected contracts
  - Merge with cached findings for unchanged files

Savings: 60-80% faster for small changes
```

#### Perf Gap 2: No Parallel Milestone Execution

**Problem:** M2 and M4 could potentially run in parallel.

**Suggested Fix:**
```
Dependency Graph:
  M1 (Context)
   ├──► M2 (Static) ────► M3 (Logic)
   │                          │
   └──► M4* (Test Gen) ◄──────┘  (* can start early with partial data)
                │
                ▼
              M5 (Final)

Parallel Opportunities:
  - M2 static + M4 test scaffolding (in parallel)
  - Multiple files in M2 (parallel)
  - Multiple agents (parallel)
```

#### Perf Gap 3: No Result Streaming

**Problem:** User waits until full milestone completes to see anything.

**Suggested Fix:**
```
Streaming Strategy:
  - Stream findings as discovered (SSE/WebSocket)
  - Progressive report rendering
  - Early severity summary
  - "X critical issues found so far" live counter
```

---

### 10.6 Suggested Architecture Diagram (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENHANCED UATUAUDIT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Web UI    │     │   CLI       │     │   API       │                   │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                   │
│         └───────────────────┼───────────────────┘                           │
│                             ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        API GATEWAY                                    │  │
│  │  • Rate Limiting  • Auth  • Cost Control  • Priority Queue           │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ORCHESTRATION LAYER                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │   Primary   │◄►│  Fallback   │  │  Circuit    │                   │  │
│  │  │ Orchestrator│  │ Orchestrator│  │  Breaker    │                   │  │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘                   │  │
│  └─────────┼────────────────────────────────────────────────────────────┘  │
│            ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      AGENT LAYER                                      │  │
│  │                                                                        │  │
│  │  ┌─────────┐    ┌─────────────────┐    ┌─────────┐                   │  │
│  │  │  Web3   │◄──►│   Message Bus   │◄──►│ Backend │                   │  │
│  │  │  Agent  │    │  (Inter-Agent)  │    │  Agent  │                   │  │
│  │  └─────────┘    └────────┬────────┘    └─────────┘                   │  │
│  │                          │                                            │  │
│  │                   ┌──────▼──────┐                                     │  │
│  │                   │  Frontend   │                                     │  │
│  │                   │   Agent     │                                     │  │
│  │                   └─────────────┘                                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    MILESTONE ENGINE                                   │  │
│  │                                                                        │  │
│  │  M1 ──► M2 ──► M3 ──► M4 ──► M5                                      │  │
│  │         │      │      │                                               │  │
│  │         ▼      ▼      ▼                                               │  │
│  │  [Checkpoint] [Feedback Loop] [Streaming]                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INTEGRATION LAYER                                  │  │
│  │                                                                        │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐              │  │
│  │  │ Slither │  │ Mythril │  │ Semgrep │  │ Custom Tools│              │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘              │  │
│  │       └────────────┴────────────┴──────────────┘                      │  │
│  │                            │                                          │  │
│  │                    ┌───────▼───────┐                                  │  │
│  │                    │ Tool Merger & │                                  │  │
│  │                    │ Deduplicator  │                                  │  │
│  │                    └───────────────┘                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    INFRASTRUCTURE LAYER                               │  │
│  │                                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │  Cache   │  │ Job Queue│  │ Storage  │  │Observab. │              │  │
│  │  │ (Redis)  │  │ (SQLite) │  │(Encrypted│  │(Metrics) │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 10.7 Summary of Recommendations

| Category | Issue | Priority | Effort |
|----------|-------|----------|--------|
| **Architecture** | Single point of failure | HIGH | Medium |
| **Architecture** | No agent collaboration | HIGH | High |
| **Architecture** | Linear milestone inflexibility | MEDIUM | Medium |
| **Features** | No confidence scoring | HIGH | Low |
| **Features** | No audit diff | MEDIUM | Medium |
| **Features** | No false positive feedback | HIGH | Medium |
| **Features** | No tool integration | MEDIUM | High |
| **Features** | No cost control | HIGH | Low |
| **Features** | No dry run mode | MEDIUM | Low |
| **Robustness** | No circuit breaker | HIGH | Low |
| **Robustness** | No checkpoints | HIGH | Medium |
| **Robustness** | No observability | MEDIUM | Medium |
| **Security** | No encryption | HIGH | Medium |
| **Security** | No access control | HIGH | Medium |
| **Performance** | No incremental audit | MEDIUM | High |
| **Performance** | No result streaming | MEDIUM | Medium |

---

### 10.8 Revised Implementation Priority

```
PHASE 0 (Pre-requisites) - Add before Phase 1:
├── Cost control / budget system
├── Dry run mode
├── Circuit breaker pattern
└── Basic observability

PHASE 1 (Prompts) - As proposed, plus:
├── Methodology versioning
├── Confidence scoring in prompts
└── Canary deployment setup

PHASE 2 (Milestones) - As proposed, plus:
├── Checkpoint system
├── Feedback loop triggers
└── Milestone parallelization where possible

PHASE 3 (Agents) - As proposed, plus:
├── Inter-agent message bus
├── Fallback orchestrator
└── Health checks

PHASE 4 (CoT) - As proposed

PHASE 5 (Tests) - As proposed, plus:
├── Tool integration layer
└── Result streaming

PHASE 6 (NEW - Hardening):
├── Encryption at rest
├── Access control for reports
├── Audit diff feature
├── False positive feedback loop
└── Incremental audit support
```

---

## 11. Report UI Redesign Specification

This section outlines the new report structure featuring a unified template with PAGE 1 (Executive Certificate) and PAGE 2 (Risk Narrative), followed by detailed findings.

### 11.1 Design Philosophy

**Goal:** Unify `certificate-template.html` and `report-template.html` into a single comprehensive report with:
- **PAGE 1:** Executive-level summary for stakeholders (Deployment Verdict, Score, Risk Overview)
- **PAGE 2:** Risk narrative for security teams (Attack Scenarios, Threat Model)
- **PAGE 3+:** Detailed technical findings (existing sections)

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED AUDIT REPORT                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PAGE 1: EXECUTIVE CERTIFICATE                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │  DEPLOYMENT  │  │   SECURITY   │  │   RISK BADGES    │  ││
│  │  │   VERDICT    │  │    SCORE     │  │   (bool flags)   │  ││
│  │  │              │  │              │  │                  │  ││
│  │  │ PRODUCTION   │  │     85       │  │ ☑ Reentrancy     │  ││
│  │  │   READY      │  │    Grade A   │  │ ☐ Oracle Risk    │  ││
│  │  └──────────────┘  └──────────────┘  │ ☐ Access Control │  ││
│  │                                       └──────────────────┘  ││
│  │  ┌──────────────────────────────────────────────────────┐   ││
│  │  │  SEVERITY SNAPSHOT        │  SCOPE SUMMARY           │   ││
│  │  │  Critical: 0  High: 1     │  Contracts: 12           │   ││
│  │  │  Medium: 3    Low: 5      │  Lines: 2,847            │   ││
│  │  │  Info: 2                  │  Commit: abc123          │   ││
│  │  └──────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  PAGE 2: RISK NARRATIVE                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  WORST-CASE SCENARIOS (Top 3)                               ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ 1. Reentrancy Attack: Attacker drains 100% of vault... │││
│  │  │ 2. Oracle Manipulation: Flash loan attack on price...  │││
│  │  │ 3. Access Control Bypass: Admin functions callable...  │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  │  THREAT MODEL SUMMARY                                        ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ Threat Actors: External Attacker, Malicious Insider    │││
│  │  │ Attack Vectors: Flash Loans, Front-running, Reentrancy │││
│  │  │ Assets at Risk: User funds, Protocol reserves, NFTs    │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                              ││
│  │  ATTACK SURFACE OVERVIEW                                     ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ External Entry Points: 15 public functions             │││
│  │  │ Privileged Functions: 8 admin-only functions           │││
│  │  │ Cross-Contract Calls: 12 external calls identified     │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  PAGE 3+: DETAILED FINDINGS (existing sections)                  │
│  - Security Findings Overview                                    │
│  - Key Security Findings                                         │
│  - User Flow Analysis                                            │
│  - Contract Explanations                                         │
│  - Test Results                                                  │
│  - Recommendations                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 11.2 PAGE 1: Executive Certificate Specification

#### 11.2.1 Deployment Verdict

**Purpose:** Clear, actionable deployment recommendation for stakeholders.

| Verdict | Criteria | Color | Icon |
|---------|----------|-------|------|
| `PRODUCTION_READY` | Score ≥ 85, No Critical/High findings | Green | ✅ |
| `CONDITIONALLY_READY` | Score 60-84, No Critical, ≤2 High findings | Yellow | ⚠️ |
| `BLOCKED` | Score < 60, OR any Critical, OR >2 High findings | Red | 🛑 |

**Logic:**
```typescript
function calculateDeploymentVerdict(score: number, severity: SeverityCounts): DeploymentVerdict {
  if (severity.critical > 0) return 'BLOCKED';
  if (severity.high > 2) return 'BLOCKED';
  if (score < 60) return 'BLOCKED';
  if (score >= 85 && severity.high === 0) return 'PRODUCTION_READY';
  return 'CONDITIONALLY_READY';
}
```

#### 11.2.2 Security Score

**Display:**
- Numeric score (0-100)
- Letter grade (A, B, C, D, F)
- Visual gauge/ring
- Assurance level label

**Grading Scale:**
| Score | Grade | Label |
|-------|-------|-------|
| 90-100 | A | Excellent |
| 80-89 | B | Good |
| 70-79 | C | Satisfactory |
| 60-69 | D | Needs Improvement |
| 0-59 | F | Critical Issues |

**Score Calculation Methodology:**

The security score is calculated using a point deduction system:

```
Starting Score: 100 points

Deductions per finding:
┌──────────────┬─────────────┬─────────────────────────────────┐
│ Severity     │ Deduction   │ Rationale                       │
├──────────────┼─────────────┼─────────────────────────────────┤
│ Critical     │ -15 points  │ Immediate exploitation risk     │
│ High         │ -10 points  │ Significant security impact     │
│ Medium       │ -4 points   │ Moderate risk requiring fix     │
│ Low          │ -2 points   │ Minor issues, best practices    │
│ Info         │ -1 point    │ Informational, optimization     │
│ Third-party  │ -1 point    │ Third-party dependent issues    │
└──────────────┴─────────────┴─────────────────────────────────┘

Formula: Score = max(0, 100 - (Critical×15 + High×10 + Medium×4 + Low×2 + Info×1))
Minimum Score: 0
```

**Example Calculation:**
```
Findings: 0 Critical, 1 High, 2 Medium, 3 Low
Deductions: (0×15) + (1×10) + (2×4) + (3×2) = 0 + 10 + 8 + 6 = 24
Final Score: 100 - 24 = 76 (Grade C)
```

**Score Breakdown Display (in report):**
```
┌─────────────────────────┐
│   Score Breakdown       │
├─────────────────────────┤
│ Base Score        100   │
│ Critical (-15)    -0    │
│ High (-10)        -10   │
│ Medium (-4)       -8    │
│ Low (-2)          -6    │
│ Info (-1)         -0    │
├─────────────────────────┤
│ Final Score       76    │
└─────────────────────────┘
```

#### 11.2.3 Risk Badges

**Purpose:** Boolean flags for common vulnerability categories (quick visual scan).

| Badge | Condition | Description |
|-------|-----------|-------------|
| `reentrancy_risk` | Any reentrancy finding | Reentrancy vulnerability detected |
| `oracle_risk` | Any oracle manipulation finding | Price oracle risk detected |
| `access_control_risk` | Any access control finding | Access control issues found |
| `upgrade_risk` | Any proxy/upgrade finding | Upgradability concerns |
| `flash_loan_risk` | Any flash loan finding | Flash loan attack vectors |
| `dos_risk` | Any DoS finding | Denial of service risks |
| `frontrun_risk` | Any frontrunning finding | MEV/Frontrunning exposure |
| `centralization_risk` | Any centralization finding | Centralization concerns |

**Schema:**
```typescript
interface RiskBadges {
  reentrancy_risk: boolean;
  oracle_risk: boolean;
  access_control_risk: boolean;
  upgrade_risk: boolean;
  flash_loan_risk: boolean;
  dos_risk: boolean;
  frontrun_risk: boolean;
  centralization_risk: boolean;
}
```

#### 11.2.4 Severity Snapshot

**Display:** Compact severity counts with visual indicators.

```
Critical: 0  │  High: 1  │  Medium: 3  │  Low: 5  │  Info: 2
```

#### 11.2.5 Scope Summary

**Display:** Quick audit scope overview.

| Field | Example |
|-------|---------|
| Contracts Analyzed | 12 contracts |
| Total Lines | 2,847 lines |
| Commit Hash | abc123def |
| Branch | main |
| Audit Date | 2025-12-18 |

---

### 11.3 PAGE 2: Risk Narrative Specification

#### 11.3.1 Worst-Case Scenarios

**Purpose:** Top 3 most impactful attack scenarios in plain language.

**Schema:**
```typescript
interface WorstCaseScenario {
  rank: 1 | 2 | 3;
  title: string;           // "Reentrancy Attack on Vault"
  attack_description: string;  // How attacker exploits
  impact: string;          // "100% fund drainage"
  likelihood: 'High' | 'Medium' | 'Low';
  related_findings: string[];  // ["VULN-001", "VULN-003"]
}
```

**Example:**
```json
{
  "rank": 1,
  "title": "Reentrancy Attack on Vault",
  "attack_description": "Attacker deploys malicious contract that calls withdraw() recursively before balance update, draining all funds.",
  "impact": "Complete loss of user funds (~$2M TVL at risk)",
  "likelihood": "High",
  "related_findings": ["VULN-001"]
}
```

#### 11.3.2 Threat Model Summary

**Purpose:** High-level threat landscape overview.

**Schema:**
```typescript
interface ThreatModelSummary {
  threat_actors: ThreatActor[];
  attack_vectors: string[];
  assets_at_risk: string[];
  trust_assumptions: string[];
}

interface ThreatActor {
  type: 'external_attacker' | 'malicious_insider' | 'compromised_admin' | 'mev_bot';
  capability: string;
  motivation: string;
}
```

**Example:**
```json
{
  "threat_actors": [
    {
      "type": "external_attacker",
      "capability": "Smart contract deployment, flash loan access",
      "motivation": "Financial gain"
    },
    {
      "type": "mev_bot",
      "capability": "Transaction ordering, sandwich attacks",
      "motivation": "MEV extraction"
    }
  ],
  "attack_vectors": ["Reentrancy", "Flash Loans", "Front-running", "Price Manipulation"],
  "assets_at_risk": ["User deposits", "Protocol reserves", "Governance tokens"],
  "trust_assumptions": ["Admin keys are secure", "Oracles are reliable"]
}
```

#### 11.3.3 Attack Surface Overview

**Purpose:** Quantified entry points and risk areas.

**Schema:**
```typescript
interface AttackSurfaceOverview {
  external_entry_points: {
    count: number;
    functions: string[];
  };
  privileged_functions: {
    count: number;
    functions: string[];
    roles: string[];
  };
  external_calls: {
    count: number;
    targets: string[];
  };
  state_modifying_functions: number;
  payable_functions: number;
}
```

**Example:**
```json
{
  "external_entry_points": {
    "count": 15,
    "functions": ["deposit()", "withdraw()", "swap()", "stake()", "unstake()"]
  },
  "privileged_functions": {
    "count": 8,
    "functions": ["setFee()", "pause()", "upgrade()", "withdrawFees()"],
    "roles": ["owner", "admin", "operator"]
  },
  "external_calls": {
    "count": 12,
    "targets": ["IERC20", "IUniswapV2Router", "IChainlinkOracle"]
  },
  "state_modifying_functions": 23,
  "payable_functions": 4
}
```

---

### 11.4 AI Prompts for PAGE 1 & PAGE 2 Data Generation

#### 11.4.1 Deployment Verdict Prompt

**Location:** `.claude/prompts/deployment-verdict.md`

```markdown
# Deployment Verdict Analysis

You are a security auditor providing a deployment recommendation.

## Input
- Security Score: {{score}}
- Severity Counts: {{severity}}
- Critical Findings: {{critical_findings}}
- High Findings: {{high_findings}}

## Task
Determine the deployment verdict based on these rules:

1. **BLOCKED** if ANY of:
   - Score < 60
   - Critical findings > 0
   - High findings > 2

2. **PRODUCTION_READY** if ALL of:
   - Score >= 85
   - Critical findings = 0
   - High findings = 0

3. **CONDITIONALLY_READY** otherwise

## Output Format
```json
{
  "verdict": "PRODUCTION_READY" | "CONDITIONALLY_READY" | "BLOCKED",
  "reasoning": "Brief explanation of verdict",
  "conditions": ["List of conditions to meet before deployment"] // only for CONDITIONALLY_READY
}
```
```

#### 11.4.2 Risk Badges Prompt

**Location:** `.claude/prompts/risk-badges.md`

```markdown
# Risk Badge Classification

You are analyzing security findings to classify risk categories.

## Input
- Findings: {{findings}}

## Task
For each finding, determine which risk badges apply:

| Badge | Keywords to Match |
|-------|-------------------|
| reentrancy_risk | "reentrancy", "reentrant", "callback", "external call before state" |
| oracle_risk | "oracle", "price feed", "price manipulation", "TWAP" |
| access_control_risk | "access control", "unauthorized", "permission", "onlyOwner missing" |
| upgrade_risk | "proxy", "upgrade", "delegatecall", "implementation" |
| flash_loan_risk | "flash loan", "flashloan", "atomic arbitrage" |
| dos_risk | "denial of service", "DoS", "gas limit", "unbounded loop" |
| frontrun_risk | "frontrun", "front-run", "MEV", "sandwich" |
| centralization_risk | "centralization", "single point", "admin key", "owner privilege" |

## Output Format
```json
{
  "reentrancy_risk": true,
  "oracle_risk": false,
  "access_control_risk": true,
  "upgrade_risk": false,
  "flash_loan_risk": false,
  "dos_risk": false,
  "frontrun_risk": true,
  "centralization_risk": true
}
```
```

#### 11.4.3 Worst-Case Scenarios Prompt

**Location:** `.claude/prompts/worst-case-scenarios.md`

```markdown
# Worst-Case Scenario Analysis

You are a security researcher identifying the most impactful attack scenarios.

## Input
- Findings: {{findings}}
- Contract Architecture: {{architecture}}
- TVL/Value at Risk: {{tvl}} (if known)

## Task
Identify the TOP 3 worst-case scenarios based on:
1. **Impact** - Financial loss, reputation damage, protocol failure
2. **Likelihood** - How easy is it to exploit?
3. **Scope** - How many users/funds affected?

For each scenario:
1. Describe the attack step-by-step
2. Quantify the impact
3. Link to specific findings

## Chain-of-Thought Required
Before outputting, reason through:
- Which findings have the highest impact?
- Can multiple findings be chained together?
- What's the realistic attacker profile?

## Output Format
```json
{
  "worst_case_scenarios": [
    {
      "rank": 1,
      "title": "Attack Name",
      "attack_description": "Step-by-step attack description",
      "impact": "Quantified impact (e.g., '100% fund loss')",
      "likelihood": "High" | "Medium" | "Low",
      "related_findings": ["VULN-001", "VULN-002"]
    }
  ]
}
```
```

#### 11.4.4 Threat Model Summary Prompt

**Location:** `.claude/prompts/threat-model.md`

```markdown
# Threat Model Analysis

You are building a threat model for the audited smart contracts.

## Input
- Codebase: {{codebase_summary}}
- Findings: {{findings}}
- Architecture: {{architecture}}

## Task
Analyze and identify:

### 1. Threat Actors
Who might attack this system?
- External Attacker (anonymous, has capital)
- Malicious Insider (has internal access)
- Compromised Admin (stolen keys)
- MEV Bot (automated extraction)
- Competitor (economic warfare)

### 2. Attack Vectors
What techniques could be used?
- Reentrancy, Flash Loans, Frontrunning
- Oracle Manipulation, Governance Attacks
- Social Engineering, Key Compromise

### 3. Assets at Risk
What can be stolen/damaged?
- User funds, Protocol reserves
- Governance tokens, NFTs
- Reputation, Protocol functionality

### 4. Trust Assumptions
What must remain true for security?
- Admin keys secure
- Oracles reliable
- External contracts safe

## Output Format
```json
{
  "threat_actors": [
    {
      "type": "external_attacker",
      "capability": "Description of capabilities",
      "motivation": "Why they would attack"
    }
  ],
  "attack_vectors": ["Vector1", "Vector2"],
  "assets_at_risk": ["Asset1", "Asset2"],
  "trust_assumptions": ["Assumption1", "Assumption2"]
}
```
```

#### 11.4.5 Attack Surface Overview Prompt

**Location:** `.claude/prompts/attack-surface.md`

```markdown
# Attack Surface Analysis

You are mapping the attack surface of smart contracts.

## Input
- Contract Files: {{contract_files}}
- Function Signatures: {{functions}}
- Inheritance Tree: {{inheritance}}

## Task
Identify and categorize:

### 1. External Entry Points
All `public` and `external` functions that can be called by anyone.

### 2. Privileged Functions
Functions with access control (onlyOwner, onlyAdmin, etc.)
- List the function
- List the required role

### 3. External Calls
All calls to external contracts (potential callback points).
- Target contract/interface
- Function called
- Risk level

### 4. Counts
- Total state-modifying functions
- Total payable functions
- Total view/pure functions

## Output Format
```json
{
  "external_entry_points": {
    "count": 15,
    "functions": ["deposit(uint256)", "withdraw(uint256)"]
  },
  "privileged_functions": {
    "count": 8,
    "functions": ["setFee(uint256)", "pause()"],
    "roles": ["owner", "admin"]
  },
  "external_calls": {
    "count": 12,
    "targets": ["IERC20", "IOracle"]
  },
  "state_modifying_functions": 23,
  "payable_functions": 4
}
```
```

---

### 11.5 Unified JSON Schema for Report Data

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "UatuAudit Unified Report Schema v2.0",
  "type": "object",
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "project": { "type": "string" },
        "branch": { "type": "string" },
        "commit": { "type": "string" },
        "run": { "type": "string", "format": "date-time" },
        "contracts_analyzed": { "type": "number" },
        "lines_analyzed": { "type": "number" }
      }
    },
    "page1_certificate": {
      "type": "object",
      "properties": {
        "deployment_verdict": {
          "type": "object",
          "properties": {
            "verdict": { "enum": ["PRODUCTION_READY", "CONDITIONALLY_READY", "BLOCKED"] },
            "reasoning": { "type": "string" },
            "conditions": { "type": "array", "items": { "type": "string" } }
          }
        },
        "score": { "type": "number", "minimum": 0, "maximum": 100 },
        "grade": { "enum": ["A", "B", "C", "D", "F"] },
        "risk_badges": {
          "type": "object",
          "properties": {
            "reentrancy_risk": { "type": "boolean" },
            "oracle_risk": { "type": "boolean" },
            "access_control_risk": { "type": "boolean" },
            "upgrade_risk": { "type": "boolean" },
            "flash_loan_risk": { "type": "boolean" },
            "dos_risk": { "type": "boolean" },
            "frontrun_risk": { "type": "boolean" },
            "centralization_risk": { "type": "boolean" }
          }
        },
        "severity": {
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
    "page2_risk_narrative": {
      "type": "object",
      "properties": {
        "worst_case_scenarios": {
          "type": "array",
          "maxItems": 3,
          "items": {
            "type": "object",
            "properties": {
              "rank": { "type": "number" },
              "title": { "type": "string" },
              "attack_description": { "type": "string" },
              "impact": { "type": "string" },
              "likelihood": { "enum": ["High", "Medium", "Low"] },
              "related_findings": { "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "threat_model": {
          "type": "object",
          "properties": {
            "threat_actors": { "type": "array" },
            "attack_vectors": { "type": "array", "items": { "type": "string" } },
            "assets_at_risk": { "type": "array", "items": { "type": "string" } },
            "trust_assumptions": { "type": "array", "items": { "type": "string" } }
          }
        },
        "attack_surface": {
          "type": "object",
          "properties": {
            "external_entry_points": { "type": "object" },
            "privileged_functions": { "type": "object" },
            "external_calls": { "type": "object" },
            "state_modifying_functions": { "type": "number" },
            "payable_functions": { "type": "number" }
          }
        }
      }
    },
    "findings": { "type": "array" },
    "user_flows": { "type": "array" },
    "contracts_explained": { "type": "array" },
    "test_results": { "type": "array" },
    "improve": { "type": ["array", "object"] }
  }
}
```

---

### 11.6 Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/templates/certificate-template.html` | **DELETE** | Merge into unified template |
| `src/templates/report-template.html` | **REDESIGN** | Add PAGE 1 + PAGE 2 sections |
| `src/types.ts` | **UPDATE** | Add new interfaces for verdict, badges, scenarios |
| `src/services/report/simpleReportGenerator.ts` | **UPDATE** | Generate PAGE 1 + PAGE 2 data |
| `src/sops/singlePromptAudit.ts` | **UPDATE** | Include PAGE 1/PAGE 2 prompts |
| `.claude/prompts/` | **CREATE** | New prompt files for PAGE 1/PAGE 2 |

---

### 11.7 Implementation Priority

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Add types to `src/types.ts` | Low |
| 2 | Create prompt files in `.claude/prompts/` | Low |
| 3 | Update `singlePromptAudit.ts` to generate PAGE 1/PAGE 2 data | Medium |
| 4 | Redesign `report-template.html` with new sections | Medium |
| 5 | Update `simpleReportGenerator.ts` | Low |
| 6 | Delete `certificate-template.html` | Low |
| 7 | Test and validate | Medium |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-09 | UatuAudit Team | Initial proposal |
| 1.1 | 2025-12-09 | UatuAudit Team | Added Frontend Architecture (Section 6) |
| 1.2 | 2025-12-09 | UatuAudit Team | Added Critical Analysis, Flaws, Gaps & Suggestions (Section 10) |
| 1.3 | 2025-12-18 | UatuAudit Team | Added Report UI Redesign Specification (Section 11) |

---

*This document is based on the "Deep Intelligence Frameworks for Automated Code Auditing" research report and adapted for UatuAudit's specific architecture and requirements.*

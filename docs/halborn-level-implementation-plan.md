# Halborn-Level Audit Implementation Plan for UatuAudit

## Overview

Halborn ki audit report mein ye key sections hain:
1. Executive Summary
2. Scope Definition
3. Assessment Methodology
4. Findings (with BVSS scoring)
5. Client Response & Remediation
6. Additional Notes

Har section ke liye detailed implementation plan:

---

## 1. EXECUTIVE SUMMARY

### Current State (UatuAudit):
- Basic summary hai
- Project details hain

### Halborn Mein Kya Extra Hai:
- Audit duration
- Specific commit hash
- Team size/effort
- High-level risk assessment
- Overall security posture

### Implementation Needed:

#### A. Data Collection:
```
Required Fields:
├── audit_start_date
├── audit_end_date
├── commit_hash (exact)
├── auditor_effort_hours
├── files_reviewed_count
├── lines_of_code
├── overall_risk_score (1-10)
└── security_posture ("Strong" | "Moderate" | "Weak" | "Critical")
```

#### B. AI Prompt for Executive Summary:
```
PROMPT STRUCTURE:

"You are a senior blockchain security auditor writing an executive summary.

Context:
- Project: {project_name}
- Repository: {repo_url}
- Commit: {commit_hash}
- Files Audited: {file_list}
- Lines of Code: {loc_count}
- Audit Duration: {start_date} to {end_date}

Findings Summary:
- Critical: {critical_count}
- High: {high_count}
- Medium: {medium_count}
- Low: {low_count}
- Informational: {info_count}

Write a professional executive summary that:
1. States the engagement scope in 1-2 sentences
2. Summarizes the security assessment approach
3. Provides overall security posture assessment
4. Highlights key risk areas (if any)
5. Mentions remediation status

Tone: Professional, objective, concise
Length: 150-200 words
Format: Paragraph form, no bullet points"
```

#### C. UI/UX Design:
```
┌─────────────────────────────────────────────────────────────┐
│  EXECUTIVE SUMMARY                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Security Posture Badge: MODERATE]                         │
│                                                             │
│  Halborn conducted a security assessment of {project}...    │
│  [AI-generated summary paragraph]                           │
│                                                             │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │ Audit Period │ Commit       │ LOC Reviewed │             │
│  │ Aug 21-22    │ 0264b30      │ 1,247        │             │
│  └──────────────┴──────────────┴──────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. SCOPE DEFINITION

### Halborn Mein Kya Hai:
- Repository URL
- Exact commit hash
- Files in scope (explicit list)
- Files out of scope
- Third-party exclusions
- Attack vector exclusions

### Implementation Needed:

#### A. Data Structure:
```typescript
interface AuditScope {
  repository: {
    url: string;
    commit_hash: string;
    branch: string;
  };

  in_scope: {
    files: string[];           // ["contracts/Swapper.sol"]
    contracts: string[];       // ["Swapper", "Bridge"]
    functions: string[];       // Optional: specific functions
    total_loc: number;
  };

  out_of_scope: {
    files: string[];           // ["node_modules/**", "test/**"]
    categories: string[];      // ["Third-party dependencies", "Economic attacks"]
    reasons: string[];         // Why excluded
  };

  limitations: string[];       // Known limitations of audit
}
```

#### B. Logic for Auto-Detection:
```
SCOPE DETECTION ALGORITHM:

1. Clone repository at specific commit
2. Identify auditable files:
   - *.sol → Solidity contracts
   - *.rs → Rust/Anchor programs
   - *.move → Move contracts

3. Exclude by pattern:
   - test/**, tests/**, *_test.sol
   - node_modules/**, lib/**
   - interfaces/** (usually standard)
   - mocks/**, mock/**

4. Calculate metrics:
   - LOC per file
   - Complexity score (cyclomatic)
   - External dependencies count

5. Generate scope document
```

#### C. UI/UX - Scope Configuration:
```
┌─────────────────────────────────────────────────────────────┐
│  AUDIT SCOPE                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Repository: https://github.com/Dev-zkCross/...             │
│  Commit: 0264b3082a5b080d7e4b04256724255ed60b191a [copy]    │
│  Branch: main                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ FILES IN SCOPE                              [Edit]  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ✓ contracts/Swapper.sol          (342 LOC)         │     │
│  │ ✓ contracts/Bridge.sol           (567 LOC)         │     │
│  │ ✓ contracts/TokenVault.sol       (234 LOC)         │     │
│  │                                                    │     │
│  │ Total: 3 files, 1,143 LOC                          │     │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ OUT OF SCOPE                                        │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ○ Third-party dependencies (OpenZeppelin, etc.)     │    │
│  │ ○ Economic/tokenomics attacks                       │    │
│  │ ○ Frontend/off-chain components                     │    │
│  │ ○ Test files and mocks                              │    │
│  │                                         [+ Add more]│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. ASSESSMENT METHODOLOGY

### Halborn Ka Approach:
1. Reconnaissance (understand objectives)
2. Manual code review (privilege boundaries, fund flows)
3. Automated static analysis
4. Dynamic on-chain testing
5. Transaction simulation

### Implementation Needed:

#### A. Methodology Phases:
```
PHASE 1: RECONNAISSANCE
├── Parse contract structure
├── Identify entry points (public/external functions)
├── Map state variables
├── Detect inheritance hierarchy
├── List external calls
└── Output: Contract Architecture Map

PHASE 2: STATIC ANALYSIS
├── Run Slither
├── Run Mythril
├── Run Semgrep (custom rules)
├── Run 4naly3er
├── Aggregate findings
└── Output: Static Analysis Report

PHASE 3: MANUAL REVIEW (AI-Assisted)
├── Access control analysis
├── Fund flow tracing
├── Reentrancy checks
├── Integer overflow/underflow
├── Logic errors
├── Business logic validation
└── Output: Manual Findings

PHASE 4: DYNAMIC TESTING
├── Fuzz testing (Echidna/Foundry)
├── Invariant testing
├── Integration tests
├── Edge case testing
└── Output: Test Results

PHASE 5: SIMULATION
├── Mainnet fork testing
├── Transaction replay
├── MEV simulation
├── Gas optimization check
└── Output: Simulation Report
```

#### B. AI Prompt for Each Phase:

**Phase 1 - Reconnaissance Prompt:**
```
"Analyze this smart contract and provide:

1. CONTRACT OVERVIEW
   - Main purpose in 1 sentence
   - Key actors (admin, user, oracle, etc.)

2. ENTRY POINTS
   - List all public/external functions
   - Categorize: View | State-changing | Payable

3. STATE VARIABLES
   - Critical state (balances, ownership)
   - Configuration state (fees, limits)

4. EXTERNAL DEPENDENCIES
   - Inherited contracts
   - External calls (other contracts, oracles)

5. TRUST ASSUMPTIONS
   - What must be trusted?
   - Centralization risks

Contract Code:
{contract_code}

Output as structured JSON."
```

**Phase 3 - Manual Review Prompt:**
```
"You are a senior smart contract auditor. Review this code for vulnerabilities.

CONTRACT: {contract_name}
CODE:
{code}

CONTEXT:
- This contract handles: {purpose}
- Key functions: {function_list}
- External interactions: {external_calls}

For each finding, provide:
1. TITLE: Short descriptive name
2. SEVERITY: Critical/High/Medium/Low/Info
3. LOCATION: File:Line
4. DESCRIPTION: What is the issue?
5. IMPACT: What can go wrong?
6. ATTACK SCENARIO: Step-by-step exploitation
7. CODE SNIPPET: Vulnerable code
8. RECOMMENDATION: How to fix
9. REFERENCES: CWE/SWC IDs if applicable

Focus on:
- Access control issues
- Reentrancy vulnerabilities
- Integer overflow/underflow
- Unchecked return values
- Front-running/MEV risks
- Logic errors
- Fund locking scenarios
- Oracle manipulation
- Signature replay
- Cross-chain risks (if applicable)

Be thorough but avoid false positives."
```

#### C. UI/UX - Methodology Display:
```
┌─────────────────────────────────────────────────────────────┐
│  ASSESSMENT METHODOLOGY                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Our security assessment employed a comprehensive           │
│  multi-layered approach:                                    │
│                                                             │
│  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐        │
│  │ 1   │───▶│ 2   │───▶│ 3   │───▶│ 4   │───▶│ 5   │        │
│  │Recon│    │Static│   │Manual│   │Dynamic│  │ Sim │        │
│  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘        │
│                                                             │
│  [Expandable sections for each phase]                       │
│                                                             │
│  ▼ Phase 1: Reconnaissance                                  │
│    • Contract architecture mapping                          │
│    • Entry point identification                             │
│    • Trust boundary analysis                                │
│                                                             │
│  ▶ Phase 2: Static Analysis [Click to expand]               │
│  ▶ Phase 3: Manual Review [Click to expand]                 │
│  ▶ Phase 4: Dynamic Testing [Click to expand]               │
│  ▶ Phase 5: Simulation [Click to expand]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. FINDINGS (Most Important Section)

### Halborn Format:
- Finding title
- Severity with BVSS score
- Status (Solved/Acknowledged/Open)
- Description
- Vulnerable code snippet
- Attack scenario
- Recommendation
- Remediation commit

### Implementation Needed:

#### A. Data Structure:
```typescript
interface Finding {
  id: string;                    // "HAL-01"
  title: string;                 // "Third-party Can Trigger Swap"

  severity: {
    level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    bvss_score: number;          // 0.0 - 10.0
    bvss_vector: string;         // Attack vector breakdown
  };

  status: "OPEN" | "ACKNOWLEDGED" | "SOLVED" | "WONT_FIX";

  location: {
    file: string;                // "contracts/Swapper.sol"
    line_start: number;          // 45
    line_end: number;            // 52
    function_name: string;       // "swap"
  };

  description: string;           // Detailed explanation

  vulnerable_code: {
    snippet: string;             // Actual code
    language: string;            // "solidity"
  };

  impact: string;                // What can go wrong

  attack_scenario: {
    steps: string[];             // Step-by-step attack
    prerequisites: string[];     // What attacker needs
    profit_potential: string;    // Estimated impact
  };

  recommendation: {
    summary: string;             // Quick fix
    detailed: string;            // Full explanation
    code_fix: string;            // Fixed code example
  };

  references: {
    cwe: string[];               // ["CWE-284"]
    swc: string[];               // ["SWC-105"]
    external: string[];          // Links to similar issues
  };

  remediation: {
    commit_hash: string;         // Fix commit
    verified: boolean;           // Has fix been verified?
    verification_notes: string;
  };
}
```

#### B. BVSS (Blockchain Vulnerability Scoring System):

```
BVSS CALCULATION:

Components:
├── Attack Vector (AV)
│   ├── Network (N): 0.85
│   ├── Adjacent (A): 0.62
│   └── Local (L): 0.55
│
├── Attack Complexity (AC)
│   ├── Low (L): 0.77
│   └── High (H): 0.44
│
├── Privileges Required (PR)
│   ├── None (N): 0.85
│   ├── Low (L): 0.62
│   └── High (H): 0.27
│
├── User Interaction (UI)
│   ├── None (N): 0.85
│   └── Required (R): 0.62
│
├── Scope (S)
│   ├── Unchanged (U): 1.0
│   └── Changed (C): 1.08 (can affect other contracts)
│
├── Impact - Confidentiality (C)
│   ├── None (N): 0
│   ├── Low (L): 0.22
│   └── High (H): 0.56
│
├── Impact - Integrity (I)
│   ├── None (N): 0
│   ├── Low (L): 0.22
│   └── High (H): 0.56
│
└── Impact - Availability (A)
    ├── None (N): 0
    ├── Low (L): 0.22
    └── High (H): 0.56

BLOCKCHAIN-SPECIFIC ADDITIONS:
├── Financial Impact (FI)
│   ├── None: 0
│   ├── Low (<$10K): 0.2
│   ├── Medium ($10K-$100K): 0.5
│   └── High (>$100K): 1.0
│
├── Reversibility (R)
│   ├── Reversible: 0.5
│   └── Irreversible: 1.0
│
└── Exploit Likelihood (EL)
    ├── Unlikely: 0.3
    ├── Possible: 0.6
    └── Likely: 1.0

FORMULA:
Base Score = (AV × AC × PR × UI) × S × (C + I + A) / 3
Blockchain Modifier = (FI + R + EL) / 3
Final BVSS = Base Score × (1 + Blockchain Modifier)

Range: 0.0 - 10.0
```

#### C. AI Prompt for Finding Generation:

```
"Generate a detailed security finding in the following format:

VULNERABILITY DETECTED:
- Location: {file}:{line}
- Function: {function_name}
- Code: {code_snippet}

Provide:

1. TITLE
   - Clear, descriptive (max 10 words)
   - Format: "[Noun] [Issue Type] in [Location]"
   - Example: "Missing Access Control in Swap Function"

2. SEVERITY ASSESSMENT
   Calculate BVSS score considering:
   - Attack Vector: Can this be exploited remotely?
   - Attack Complexity: How hard is exploitation?
   - Privileges Required: What access does attacker need?
   - User Interaction: Does victim need to do something?
   - Financial Impact: How much money at risk?
   - Reversibility: Can damage be undone?

3. DESCRIPTION
   - What is the vulnerability?
   - Why does it exist?
   - Technical explanation (2-3 paragraphs)

4. IMPACT
   - Direct consequences
   - Worst-case scenario
   - Affected parties

5. ATTACK SCENARIO
   Write step-by-step attack:
   Step 1: Attacker does X
   Step 2: This causes Y
   Step 3: Result is Z

   Include:
   - Prerequisites
   - Transaction sequence
   - Profit calculation (if applicable)

6. PROOF OF CONCEPT (Optional)
   Provide test code demonstrating the issue

7. RECOMMENDATION
   - Quick summary (1 sentence)
   - Detailed fix explanation
   - Code example of fix
   - Alternative solutions if any

8. REFERENCES
   - Relevant CWE IDs
   - SWC Registry IDs
   - Similar vulnerabilities in other projects

Output as JSON matching the Finding interface."
```

#### D. UI/UX - Findings Display:

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY FINDINGS                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CRITICAL: 0] [HIGH: 0] [MEDIUM: 3] [LOW: 3] [INFO: 0]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ UAT-01                                    [MEDIUM]  │   │
│  │                                          BVSS: 5.86 │   │
│  │ Third-party Can Trigger Swap on Behalf of User      │   │
│  │                                                     │   │
│  │ Location: contracts/Swapper.sol:45                  │   │
│  │ Status: [SOLVED ✓] Commit: 268595f7                 │   │
│  │                                                     │   │
│  │ [View Details] [View Fix] [Verify]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ UAT-02                                    [MEDIUM]  │   │
│  │                                          BVSS: 5.00 │   │
│  │ Funds Stuck for Smart Contract Recipients           │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[Expanded Finding View]
┌─────────────────────────────────────────────────────────────┐
│ UAT-01: Third-party Can Trigger Swap                        │
├─────────────────────────────────────────────────────────────┤
│ Severity: MEDIUM (BVSS: 5.86)         Status: SOLVED        │
│ Location: contracts/Swapper.sol:45-52                       │
├─────────────────────────────────────────────────────────────┤
│ DESCRIPTION                                                 │
│ The public swap function lacks verification that the        │
│ caller is the owner of the funds being swapped...           │
├─────────────────────────────────────────────────────────────┤
│ VULNERABLE CODE                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ function swap(address user, uint256 amount) public {    ││
│ │     // No check that msg.sender == user                 ││
│ │     token.transferFrom(user, address(this), amount);    ││
│ │     // ... swap logic                                   ││
│ │ }                                                       ││
│ └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ATTACK SCENARIO                                             │
│ 1. Alice approves Swapper contract for 1000 USDC           │
│ 2. Bob (attacker) calls swap(Alice, 1000)                  │
│ 3. Alice's tokens are swapped without her consent          │
│ 4. Bob receives output or benefits from MEV                │
├─────────────────────────────────────────────────────────────┤
│ RECOMMENDATION                                              │
│ Add caller verification:                                    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ function swap(address user, uint256 amount) public {    ││
│ │     require(msg.sender == user, "Not authorized");      ││
│ │     // ... rest of function                             ││
│ │ }                                                       ││
│ └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ REMEDIATION                                                 │
│ Fixed in commit: 268595f7d7e3bac0e5c4d19f0d129d3786e3509b  │
│ Verification: ✓ Fix correctly implements recommendation    │
├─────────────────────────────────────────────────────────────┤
│ REFERENCES                                                  │
│ • CWE-284: Improper Access Control                         │
│ • SWC-105: Unprotected Ether Withdrawal                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CLIENT RESPONSE & REMEDIATION TRACKING

### Halborn Mein Kya Hai:
- Client's response to each finding
- Remediation strategy
- Fix commits
- Verification status

### Implementation Needed:

#### A. Data Structure:
```typescript
interface RemediationTracking {
  finding_id: string;

  client_response: {
    acknowledged: boolean;
    response_date: Date;
    response_text: string;
    planned_action: "FIX" | "ACKNOWLEDGE" | "WONT_FIX" | "DISPUTE";
  };

  fix_details: {
    commit_hash: string;
    commit_url: string;
    commit_date: Date;
    files_changed: string[];
    diff_summary: string;
  };

  verification: {
    verified: boolean;
    verified_by: string;        // "AI" | "Manual"
    verification_date: Date;
    verification_notes: string;
    remaining_concerns: string[];
  };

  timeline: Array<{
    date: Date;
    event: string;
    actor: string;
  }>;
}
```

#### B. Logic for Auto-Verification:

```
FIX VERIFICATION ALGORITHM:

1. Fetch original vulnerable code
2. Fetch fixed code from remediation commit
3. Compare changes

AI Verification Prompt:
"
Original vulnerable code:
{original_code}

Finding: {finding_description}

Fixed code:
{fixed_code}

Evaluate:
1. Does the fix address the vulnerability?
2. Are there any remaining concerns?
3. Does the fix introduce new issues?
4. Is the fix complete or partial?

Output:
- Verification Status: VERIFIED | PARTIALLY_FIXED | NOT_FIXED | INTRODUCES_NEW_ISSUES
- Confidence: HIGH | MEDIUM | LOW
- Notes: [explanation]
"
```

#### C. UI/UX - Remediation Dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│  REMEDIATION STATUS                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Progress: ████████████████████░░░░ 83% (5/6 Fixed)        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Finding    │ Status   │ Commit   │ Verified        │   │
│  ├────────────┼──────────┼──────────┼─────────────────┤   │
│  │ UAT-01     │ FIXED    │ 268595f7 │ ✓ Verified     │   │
│  │ UAT-02     │ FIXED    │ 268595f7 │ ✓ Verified     │   │
│  │ UAT-03     │ FIXED    │ 268595f7 │ ✓ Verified     │   │
│  │ UAT-04     │ FIXED    │ 268595f7 │ ✓ Verified     │   │
│  │ UAT-05     │ FIXED    │ 268595f7 │ ✓ Verified     │   │
│  │ UAT-06     │ PENDING  │ -        │ ⏳ Awaiting    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Request Re-audit] [Generate Final Report]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. ADDITIONAL FEATURES NEEDED

### A. Vulnerability Database:

```
PURPOSE: Learn from past findings, improve detection

SCHEMA:
├── vulnerability_id
├── category (Access Control, Reentrancy, etc.)
├── pattern (regex/AST pattern)
├── severity_range
├── common_locations
├── fix_patterns
├── false_positive_indicators
└── real_world_examples (with links)

USE CASES:
1. Pattern matching for detection
2. Training data for AI
3. Reference for recommendations
4. Severity calibration
```

### B. Comparison with Known Exploits:

```
PROMPT FOR EXPLOIT COMPARISON:

"Compare this code pattern with known exploits:

Code:
{code_snippet}

Known Exploits Database:
- Parity Wallet Hack (2017): {pattern}
- DAO Hack (2016): {pattern}
- Wormhole Bridge (2022): {pattern}
- Ronin Bridge (2022): {pattern}

Does this code have similar patterns to any known exploit?
If yes, explain the similarity and risk level."
```

### C. Gas Optimization Section:

```
GAS ANALYSIS PROMPT:

"Analyze this function for gas optimization:

{function_code}

Identify:
1. Expensive operations in loops
2. Redundant storage reads
3. Unnecessary memory allocations
4. Suboptimal data types
5. Missing view/pure modifiers

For each issue:
- Current gas cost estimate
- Optimized gas cost estimate
- Code change needed
- Risk of optimization (if any)"
```

### D. Compliance Checks:

```
COMPLIANCE CHECKLIST:

□ ERC-20 Compliance (if token)
  - transfer() returns bool
  - approve() returns bool
  - transferFrom() returns bool
  - Events emitted correctly

□ ERC-721 Compliance (if NFT)
  - safeTransferFrom implemented
  - onERC721Received check

□ Access Control Standards
  - Role-based access
  - Ownership patterns

□ Upgradeability Safety
  - Storage gaps
  - Initializer protection
  - Upgrade authorization
```

---

## 7. REPORT GENERATION

### A. Report Sections:

```
FULL REPORT STRUCTURE:

1. Cover Page
   - Project name & logo
   - Audit date range
   - Report version
   - Auditor branding

2. Table of Contents
   - Clickable navigation

3. Disclaimer
   - Legal text
   - Scope limitations

4. Executive Summary
   - 1-page overview
   - Key metrics
   - Risk assessment

5. Scope
   - Files audited
   - Exclusions
   - Methodology

6. Findings Summary
   - Severity distribution chart
   - Status overview

7. Detailed Findings
   - Each finding fully documented
   - Code snippets
   - Recommendations

8. Appendices
   - A: Severity definitions
   - B: BVSS calculation
   - C: Tool outputs
   - D: Test results

9. About Auditor
   - Company info
   - Team credentials
```

### B. PDF Generation Considerations:

```
PDF REQUIREMENTS:

1. Layout
   - Professional formatting
   - Consistent styling
   - Code syntax highlighting
   - Page numbers
   - Headers/footers

2. Branding
   - Custom logo placement
   - Color scheme
   - Typography

3. Interactive Elements
   - Clickable TOC
   - Internal links
   - External references

4. Print Optimization
   - Page breaks at sections
   - No orphan lines
   - Proper margins

TECH STACK OPTIONS:
- Puppeteer (HTML → PDF)
- @react-pdf/renderer (React components)
- PDFKit (programmatic)
- WeasyPrint (CSS-based)
```

---

## 8. WORKFLOW SUMMARY

```
COMPLETE AUDIT WORKFLOW:

┌──────────────┐
│ 1. INPUT     │
│ - Repo URL   │
│ - Commit     │
│ - Files      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. SCOPE     │
│ - Detect     │
│ - Configure  │
│ - Confirm    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 3. ANALYSIS  │
│ - Static     │
│ - AI Review  │
│ - Dynamic    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 4. FINDINGS  │
│ - Generate   │
│ - Score      │
│ - Dedupe     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 5. REVIEW    │
│ - Human QA   │
│ - Client     │
│ - Iterate    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 6. REMEDIATE │
│ - Track      │
│ - Verify     │
│ - Re-audit   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 7. REPORT    │
│ - Generate   │
│ - Format     │
│ - Deliver    │
└──────────────┘
```

---

## 9. TEST ENVIRONMENT SETUP & PARAMETERS

### A. Test Environment Configuration:

```typescript
interface TestEnvironment {
  // Network Configuration
  network: {
    type: "mainnet_fork" | "testnet" | "local_hardhat" | "local_foundry";
    chain_id: number;
    rpc_url: string;
    fork_block?: number;        // For mainnet fork - specific block
    fork_timestamp?: number;    // For time-sensitive tests
  };

  // Compiler Settings
  compiler: {
    solc_version: string;       // "0.8.19"
    optimizer: boolean;
    optimizer_runs: number;     // 200
    via_ir: boolean;
  };

  // Testing Framework
  framework: {
    name: "hardhat" | "foundry" | "brownie" | "anchor";
    version: string;
    plugins: string[];          // ["hardhat-gas-reporter", "solidity-coverage"]
  };

  // External Dependencies
  dependencies: {
    name: string;
    version: string;
    source: "npm" | "github" | "local";
  }[];

  // Test Accounts
  accounts: {
    deployer: string;
    admin: string;
    user1: string;
    user2: string;
    attacker: string;
  };
}
```

### B. Test Parameters:

```
TEST PARAMETERS STRUCTURE:

├── Unit Test Parameters
│   ├── Function coverage threshold: 90%
│   ├── Branch coverage threshold: 80%
│   ├── Edge cases per function: minimum 5
│   └── Gas snapshot comparison: enabled
│
├── Fuzz Test Parameters
│   ├── Runs per function: 10,000
│   ├── Max test depth: 50
│   ├── Seed: configurable
│   └── Shrinking: enabled
│
├── Invariant Test Parameters
│   ├── Runs: 1,000
│   ├── Depth: 100
│   ├── Actor count: 5
│   └── Fail on revert: true
│
└── Integration Test Parameters
    ├── Mainnet fork: latest block
    ├── Time manipulation: enabled
    ├── Impersonation: enabled
    └── External protocol mocks: configured
```

### C. UI/UX - Test Environment Display:

```
┌─────────────────────────────────────────────────────────────┐
│  TEST ENVIRONMENT                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Network: Ethereum Mainnet Fork (Block: 18,500,000)        │
│  Framework: Foundry v0.2.0                                  │
│  Solc: 0.8.19 (Optimizer: 200 runs)                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TEST PARAMETERS                                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Fuzz Runs      │ 10,000                             │   │
│  │ Invariant Runs │ 1,000                              │   │
│  │ Coverage Target│ 90%                                │   │
│  │ Gas Reporting  │ Enabled                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. TEST MATERIALS & TEST CASES

### A. Test Materials Structure:

```typescript
interface TestMaterials {
  // Source Materials
  source_code: {
    contracts: string[];        // Files being tested
    interfaces: string[];       // Interface definitions
    libraries: string[];        // Utility libraries
  };

  // Test Suites
  test_suites: {
    unit_tests: string[];       // ["test/Swapper.t.sol"]
    fuzz_tests: string[];       // ["test/Swapper.fuzz.sol"]
    invariant_tests: string[];  // ["test/Swapper.invariant.sol"]
    integration_tests: string[];
  };

  // Mock Contracts
  mocks: {
    name: string;
    purpose: string;            // "Mock USDC for testing"
    file: string;
  }[];

  // Test Data
  test_data: {
    fixtures: string[];         // JSON fixtures
    sample_inputs: any[];       // Sample transaction data
    edge_cases: any[];          // Boundary conditions
  };
}
```

### B. Test Cases Documentation:

```
TEST CASE FORMAT:

┌─────────────────────────────────────────────────────────────┐
│ TEST CASE: TC-001                                           │
├─────────────────────────────────────────────────────────────┤
│ Name: test_swap_unauthorized_caller                         │
│ Category: Access Control                                    │
│ Priority: HIGH                                              │
├─────────────────────────────────────────────────────────────┤
│ OBJECTIVE:                                                  │
│ Verify that only authorized users can trigger swaps on      │
│ their own behalf                                            │
├─────────────────────────────────────────────────────────────┤
│ PRECONDITIONS:                                              │
│ 1. User A has approved Swapper for 1000 USDC                │
│ 2. User A has NOT initiated any swap                        │
│ 3. Attacker B has no special permissions                    │
├─────────────────────────────────────────────────────────────┤
│ TEST STEPS:                                                 │
│ 1. Attacker B calls swap(UserA, 1000, ...)                  │
│ 2. Assert transaction reverts                               │
│ 3. Assert User A balance unchanged                          │
├─────────────────────────────────────────────────────────────┤
│ EXPECTED RESULT:                                            │
│ Transaction should revert with "Not authorized"             │
├─────────────────────────────────────────────────────────────┤
│ ACTUAL RESULT: [To be filled during execution]              │
│ STATUS: PASS / FAIL                                         │
│ FINDING REFERENCE: UAT-01 (if failed)                       │
└─────────────────────────────────────────────────────────────┘
```

### C. Test Case Categories:

```
TEST CASE CATEGORIES:

1. ACCESS CONTROL TESTS
   ├── TC-AC-001: Only owner can call admin functions
   ├── TC-AC-002: Role-based access enforcement
   ├── TC-AC-003: Unauthorized caller rejection
   └── TC-AC-004: Permission escalation prevention

2. FUND SAFETY TESTS
   ├── TC-FS-001: No unauthorized fund withdrawal
   ├── TC-FS-002: Reentrancy protection
   ├── TC-FS-003: Integer overflow prevention
   └── TC-FS-004: Fund recovery mechanisms

3. STATE CONSISTENCY TESTS
   ├── TC-SC-001: State updates are atomic
   ├── TC-SC-002: No partial state corruption
   ├── TC-SC-003: Invariants maintained
   └── TC-SC-004: Event emission correctness

4. EDGE CASE TESTS
   ├── TC-EC-001: Zero amount handling
   ├── TC-EC-002: Maximum value handling
   ├── TC-EC-003: Empty array handling
   └── TC-EC-004: Self-referential calls

5. INTEGRATION TESTS
   ├── TC-IT-001: External contract interaction
   ├── TC-IT-002: Oracle price feed handling
   ├── TC-IT-003: Cross-contract call chains
   └── TC-IT-004: Flash loan scenarios
```

---

## 11. USER FLOWS & RESULTS INTERPRETATION

### A. Flow Analysis Structure:

```typescript
interface UserFlow {
  flow_id: string;              // "UF-001"
  name: string;                 // "Token Swap Flow"
  description: string;

  actors: {
    name: string;               // "User", "Admin", "Oracle"
    role: string;
    trust_level: "TRUSTED" | "UNTRUSTED" | "SEMI_TRUSTED";
  }[];

  steps: {
    step_number: number;
    action: string;             // "User calls swap()"
    contract: string;           // "Swapper.sol"
    function: string;           // "swap"
    state_changes: string[];    // ["balances updated", "event emitted"]
    gas_cost: number;
    risk_points: string[];      // Potential issues at this step
  }[];

  success_criteria: string[];
  failure_modes: string[];

  test_results: {
    passed: boolean;
    execution_time: number;
    gas_used: number;
    notes: string;
  };
}
```

### B. Result Interpretation Guide:

```
RESULT INTERPRETATION MATRIX:

┌─────────────────┬─────────────────┬─────────────────────────────┐
│ Result Type     │ Significance    │ Action Required             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ PASS            │ Expected        │ Document, move forward      │
│                 │ behavior        │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ FAIL - Revert   │ Security check  │ Verify if intentional,      │
│                 │ working OR bug  │ if not → Finding            │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ FAIL - Wrong    │ Logic error     │ Create Finding, analyze     │
│ Output          │                 │ root cause                  │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ FAIL - OOG      │ Gas issue or    │ Analyze gas consumption,    │
│ (Out of Gas)    │ infinite loop   │ potential DoS               │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ UNEXPECTED      │ Undefined       │ Deep analysis required,     │
│ BEHAVIOR        │ behavior        │ potential critical issue    │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ TIMEOUT         │ Complexity or   │ Review test parameters,     │
│                 │ loop issue      │ potential DoS vector        │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### C. UI/UX - Flow Results Display:

```
┌─────────────────────────────────────────────────────────────┐
│  USER FLOW ANALYSIS                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UF-001: Token Swap Flow                          [PASS ✓]  │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Step 1: User approves tokens                               │
│  ├── Contract: USDC.sol                                     │
│  ├── Function: approve()                                    │
│  ├── Gas: 46,234                                            │
│  └── Status: ✓ Completed                                    │
│                                                             │
│  Step 2: User initiates swap                    [RISK ⚠️]    │
│  ├── Contract: Swapper.sol                                  │
│  ├── Function: swap()                                       │
│  ├── Gas: 152,456                                           │
│  ├── Risk: MEV exposure during swap                         │
│  └── Status: ✓ Completed (with warning)                     │
│                                                             │
│  Step 3: Tokens received                                    │
│  ├── Contract: TokenB.sol                                   │
│  ├── Function: transfer()                                   │
│  ├── Gas: 51,234                                            │
│  └── Status: ✓ Completed                                    │
│                                                             │
│  FLOW SUMMARY:                                              │
│  Total Gas: 249,924 | Time: 2 blocks | Risk Points: 1      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. CLIENT CLARIFICATIONS & SCORE REANALYSIS

### A. Clarification Document Structure:

```typescript
interface ClarificationDocument {
  // Questions raised by auditor
  questions: {
    question_id: string;        // "CQ-001"
    category: "DESIGN" | "IMPLEMENTATION" | "BUSINESS_LOGIC" | "TRUST_ASSUMPTION";
    question: string;
    context: string;            // Why this question matters
    related_finding?: string;   // Finding ID if related
    priority: "HIGH" | "MEDIUM" | "LOW";
    asked_date: Date;
  }[];

  // Client responses
  responses: {
    question_id: string;
    response: string;
    response_type: "CODE_BASED" | "TRUST_BASED" | "DESIGN_DECISION" | "ACKNOWLEDGED_RISK";
    supporting_evidence?: string;   // Code reference, docs link
    response_date: Date;
    responder: string;              // Client team member
  }[];

  // Impact on findings
  impact_analysis: {
    question_id: string;
    finding_id?: string;
    original_severity?: string;
    revised_severity?: string;
    severity_change_reason: string;
    confidence_level: "HIGH" | "MEDIUM" | "LOW";
  }[];
}
```

### B. Clarification Types & Their Weight:

```
CLARIFICATION TYPE ANALYSIS:

┌─────────────────────────────────────────────────────────────┐
│ TYPE: CODE_BASED                                            │
├─────────────────────────────────────────────────────────────┤
│ Definition: Client points to actual code that addresses     │
│             the concern                                     │
│                                                             │
│ Confidence: HIGH                                            │
│ Verification: Can be verified by reading code               │
│ Weight: 100% (Full confidence in response)                  │
│                                                             │
│ Example:                                                    │
│ Q: "How is reentrancy prevented?"                           │
│ A: "We use ReentrancyGuard, see line 45 of Swapper.sol"     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TYPE: TRUST_BASED                                           │
├─────────────────────────────────────────────────────────────┤
│ Definition: Client claims something that cannot be verified │
│             on-chain, requires trust in their word          │
│                                                             │
│ Confidence: LOW                                             │
│ Verification: Cannot be verified, must trust client         │
│ Weight: 30-50% (Partial confidence)                         │
│                                                             │
│ Example:                                                    │
│ Q: "Who controls the admin key?"                            │
│ A: "It's a 3-of-5 multisig with team members"               │
│ (Cannot verify multisig setup without on-chain proof)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TYPE: DESIGN_DECISION                                       │
├─────────────────────────────────────────────────────────────┤
│ Definition: Client explains intentional design choice       │
│             that auditor flagged as potential issue         │
│                                                             │
│ Confidence: MEDIUM                                          │
│ Verification: Verify if design is sound                     │
│ Weight: 70% (Good confidence if reasoning is solid)         │
│                                                             │
│ Example:                                                    │
│ Q: "Why no slippage protection in swap?"                    │
│ A: "Users set slippage in frontend, we trust input"         │
│ (Design choice, but may still be risky)                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TYPE: ACKNOWLEDGED_RISK                                     │
├─────────────────────────────────────────────────────────────┤
│ Definition: Client acknowledges the risk but accepts it     │
│             for business/design reasons                     │
│                                                             │
│ Confidence: HIGH (for acknowledgment)                       │
│ Verification: Document the acknowledgment                   │
│ Weight: N/A (Finding stays, status = ACKNOWLEDGED)          │
│                                                             │
│ Example:                                                    │
│ Q: "Admin can drain all funds, is this intended?"           │
│ A: "Yes, we need emergency withdrawal capability"           │
│ (Acknowledged centralization risk)                          │
└─────────────────────────────────────────────────────────────┘
```

### C. Score Reanalysis Based on Clarifications:

```
SCORE REANALYSIS WORKFLOW:

1. COLLECT CLARIFICATION
   └── Document client response with type

2. VERIFY RESPONSE
   ├── CODE_BASED → Read code, confirm claim
   ├── TRUST_BASED → Note as unverifiable
   ├── DESIGN_DECISION → Evaluate reasoning
   └── ACKNOWLEDGED_RISK → Document acknowledgment

3. CALCULATE CONFIDENCE
   ├── Full evidence provided → 100%
   ├── Partial evidence → 50-80%
   ├── No evidence, trust required → 20-40%
   └── Contradictory evidence → FLAG FOR REVIEW

4. ADJUST SEVERITY (if applicable)
   ├── Severity can decrease if valid mitigation shown
   ├── Severity can increase if response reveals new issues
   └── Severity stays same if only acknowledged

5. UPDATE FINDING
   ├── Add clarification section
   ├── Update severity with justification
   ├── Add confidence score
   └── Note any remaining concerns
```

### D. UI/UX - Clarification Display:

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT CLARIFICATIONS                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CQ-001: Admin Key Security                    [TRUST_BASED]│
│  ─────────────────────────────────────────────────────────  │
│  Question: Who controls the admin key and what safeguards   │
│            are in place?                                    │
│                                                             │
│  Response: "Admin key is held in a 3-of-5 multisig with     │
│            team leads. Signers are geographically           │
│            distributed."                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ VERIFICATION STATUS                                 │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Type: TRUST_BASED                                   │    │
│  │ Confidence: 40%                                     │    │
│  │ Reason: Cannot verify multisig setup on-chain       │    │
│  │                                                     │    │
│  │ Impact on Finding UAT-05:                           │    │
│  │ Original Severity: HIGH                             │    │
│  │ Revised Severity: MEDIUM                            │    │
│  │ Reason: Multisig claim reduces single-point-of-     │    │
│  │         failure risk, but unverified                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. SECTION-WISE SCORING WITH CONFIDENCE

### A. Section Score Structure:

```typescript
interface SectionScore {
  section_name: string;         // "Access Control"

  // Raw Score
  raw_score: {
    score: number;              // 0-100
    max_possible: number;       // 100
    issues_found: number;
    issues_critical: number;
    issues_high: number;
    issues_medium: number;
    issues_low: number;
  };

  // Confidence in Score
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW";
    percentage: number;         // 0-100
    factors: {
      code_coverage: number;    // How much code was reviewed
      test_coverage: number;    // How well tested
      clarification_quality: number;  // Quality of client responses
      tool_agreement: number;   // Do multiple tools agree?
    };
  };

  // Clarification Impact
  clarification_impact: {
    questions_asked: number;
    questions_answered: number;
    code_based_responses: number;
    trust_based_responses: number;
    score_adjustments: {
      original: number;
      adjusted: number;
      reason: string;
    }[];
  };

  // Final Assessment
  final_assessment: {
    status: "SECURE" | "NEEDS_ATTENTION" | "AT_RISK" | "CRITICAL";
    summary: string;
    remaining_concerns: string[];
  };
}
```

### B. Scoring Formula:

```
SECTION SCORE CALCULATION:

1. BASE SCORE (0-100):
   base_score = 100 - (critical×25 + high×15 + medium×8 + low×3)

2. CONFIDENCE MULTIPLIER:
   confidence = (code_coverage×0.3 + test_coverage×0.3 +
                 clarification_quality×0.2 + tool_agreement×0.2)

3. CLARIFICATION ADJUSTMENT:
   adjustment = Σ(clarification_impacts)

   Where clarification_impact =
   - CODE_BASED positive response: +5 to +15
   - TRUST_BASED response: +2 to +5 (with low confidence note)
   - DESIGN_DECISION accepted: +3 to +10
   - ACKNOWLEDGED_RISK: 0 (no change, just documented)

4. FINAL SECTION SCORE:
   final_score = (base_score + adjustment) × confidence

   With confidence indicator:
   - HIGH (80-100%): Score is reliable
   - MEDIUM (50-79%): Score has uncertainty
   - LOW (<50%): Score needs human review
```

### C. UI/UX - Section Scores Dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│  SECURITY SCORECARD                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Overall Score: 72/100                    Confidence: 78%   │
│  ████████████████████████████░░░░░░░░░░░░                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SECTION BREAKDOWN                                    │   │
│  ├───────────────────┬───────┬────────────┬───────────┤   │
│  │ Section           │ Score │ Confidence │ Status    │   │
│  ├───────────────────┼───────┼────────────┼───────────┤   │
│  │ Access Control    │ 65/100│ HIGH (85%) │ ⚠️ REVIEW │   │
│  │ Fund Safety       │ 78/100│ HIGH (90%) │ ✓ GOOD    │   │
│  │ Input Validation  │ 82/100│ MED (65%)  │ ✓ GOOD    │   │
│  │ State Management  │ 70/100│ HIGH (88%) │ ⚠️ REVIEW │   │
│  │ External Calls    │ 55/100│ LOW (45%)  │ ❌ AT RISK│   │
│  │ Gas Efficiency    │ 90/100│ HIGH (92%) │ ✓ GOOD    │   │
│  └───────────────────┴───────┴────────────┴───────────┘   │
│                                                             │
│  ⚠️ Low Confidence Warning: "External Calls" section has   │
│     insufficient test coverage and trust-based client      │
│     responses. Manual review recommended.                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### D. Confidence Breakdown Detail:

```
┌─────────────────────────────────────────────────────────────┐
│  CONFIDENCE ANALYSIS: External Calls Section                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Overall Confidence: 45% (LOW)                              │
│                                                             │
│  FACTOR BREAKDOWN:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Code Coverage          │ 60%  │ ████████░░░░░░░░   │   │
│  │ Test Coverage          │ 35%  │ █████░░░░░░░░░░░   │   │
│  │ Clarification Quality  │ 30%  │ ████░░░░░░░░░░░░   │   │
│  │ Tool Agreement         │ 55%  │ ███████░░░░░░░░░   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  CLARIFICATION IMPACT:                                      │
│  • 3 questions asked                                        │
│  • 2 answered (1 CODE_BASED, 1 TRUST_BASED)                │
│  • 1 unanswered (critical for confidence)                   │
│                                                             │
│  RECOMMENDATION:                                            │
│  Human auditor should review external call patterns and     │
│  verify oracle integration assumptions.                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 14. HUMAN INVOLVEMENT POINTS

### A. Where Human Review is Required:

```
HUMAN REVIEW CHECKPOINTS:

┌─────────────────────────────────────────────────────────────┐
│ CHECKPOINT 1: SCOPE VALIDATION                              │
├─────────────────────────────────────────────────────────────┤
│ Human Action: Review auto-detected scope, confirm files     │
│ Reason: AI may miss custom patterns or include irrelevant   │
│ Input: Auto-detected file list                              │
│ Output: Confirmed scope with human approval                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CHECKPOINT 2: FINDING VALIDATION                            │
├─────────────────────────────────────────────────────────────┤
│ Human Action: Review AI-generated findings for accuracy     │
│ Reason: Reduce false positives, validate severity           │
│ Input: AI findings with confidence scores                   │
│ Output: Validated findings, removed false positives         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CHECKPOINT 3: CLARIFICATION REVIEW                          │
├─────────────────────────────────────────────────────────────┤
│ Human Action: Evaluate client responses, especially         │
│               TRUST_BASED ones                              │
│ Reason: Human judgment needed for trust decisions           │
│ Input: Client clarification responses                       │
│ Output: Verified responses, confidence adjustments          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CHECKPOINT 4: LOW CONFIDENCE SECTIONS                       │
├─────────────────────────────────────────────────────────────┤
│ Human Action: Deep review of sections with <50% confidence  │
│ Reason: AI uncertainty requires expert judgment             │
│ Input: Section with low confidence flag                     │
│ Output: Human-verified score and assessment                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CHECKPOINT 5: FINAL REPORT APPROVAL                         │
├─────────────────────────────────────────────────────────────┤
│ Human Action: Review complete report before delivery        │
│ Reason: Quality assurance, professional responsibility      │
│ Input: Generated report                                     │
│ Output: Approved report with auditor sign-off               │
└─────────────────────────────────────────────────────────────┘
```

### B. Human Review UI:

```
┌─────────────────────────────────────────────────────────────┐
│  HUMAN REVIEW QUEUE                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project: ZKCross Swapper                                   │
│  Status: Awaiting Human Review                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ PENDING REVIEWS                                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ □ Scope Validation                      [Review]    │   │
│  │ □ Finding UAT-03 (Low Confidence: 45%)  [Review]    │   │
│  │ □ Clarification CQ-002 (Trust-based)    [Review]    │   │
│  │ □ External Calls Section (Low: 45%)     [Review]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  COMPLETED REVIEWS:                                         │
│  ✓ Finding UAT-01 validated by @auditor1                   │
│  ✓ Finding UAT-02 validated by @auditor1                   │
│                                                             │
│  [Generate Report] (Disabled until all reviews complete)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. IMPLEMENTATION PRIORITY

```
PRIORITY ORDER (No time estimates, just sequence):

PHASE 1: FOUNDATION
├── BVSS scoring system
├── Finding data structure with confidence
├── Enhanced finding prompts
├── Basic test environment config
└── Clarification document structure

PHASE 2: TESTING & FLOWS
├── Test materials structure
├── Test case documentation
├── User flow analysis
├── Result interpretation guide
└── Flow-to-finding mapping

PHASE 3: CLARIFICATIONS & SCORING
├── Clarification type classification
├── Score reanalysis logic
├── Section-wise scoring
├── Confidence calculation
└── Adjustment tracking

PHASE 4: HUMAN INTEGRATION
├── Human review checkpoints
├── Review queue UI
├── Approval workflow
├── Sign-off mechanism
└── Audit trail

PHASE 5: REPORTING
├── Updated report structure
├── Clarification section in report
├── Confidence indicators
├── Score breakdown visualization
└── PDF generation with all sections
```

---

## 16. KEY DIFFERENTIATORS

```
UATU UNIQUE VALUE:

1. TRANSPARENCY
   └── Every score has confidence level
   └── Clarification impact visible
   └── Trust vs Code distinction clear

2. HYBRID APPROACH
   └── AI speed + Human judgment
   └── Clear handoff points
   └── Traceable decisions

3. CLIENT COLLABORATION
   └── Clarification document flow
   └── Response type classification
   └── Score adjustment visibility

4. CONTINUOUS VERIFICATION
   └── Test results integrated
   └── Flow analysis included
   └── Evidence-based scoring
```

---

## 17. IMPLEMENTATION APPROACH - HOW TO ACHIEVE

This section details the exact approach, architecture, and step-by-step methodology to implement each feature.

---

### 17.1 OVERALL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UATU AUDIT PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   FRONTEND   │    │   BACKEND    │    │   AI ENGINE  │              │
│  │   (React)    │◄──►│   (Node.js)  │◄──►│   (Claude)   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         │                   ▼                   │                       │
│         │            ┌──────────────┐           │                       │
│         │            │   DATABASE   │           │                       │
│         │            │  (PostgreSQL)│           │                       │
│         │            └──────────────┘           │                       │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                    AUDIT PIPELINE                         │          │
│  ├──────────────────────────────────────────────────────────┤          │
│  │  SCOPE → ANALYSIS → FINDINGS → CLARIFY → SCORE → REPORT │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 17.2 DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [USER INPUT]                                                            │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────┐                                                        │
│  │ 1. REPO     │ ──► Clone repo at commit                               │
│  │    INTAKE   │ ──► Detect ecosystem (Solidity/Rust/Move)              │
│  │             │ ──► Parse file structure                                │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 2. SCOPE    │ ──► Auto-detect auditable files                        │
│  │    CONFIG   │ ──► Human confirms scope                               │
│  │             │ ──► Store scope document                                │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 3. TEST     │ ──► Detect test framework                              │
│  │    SETUP    │ ──► Configure environment                              │
│  │             │ ──► Run existing tests                                  │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │ 4a. STATIC  │     │ 4b. AI      │     │ 4c. DYNAMIC │               │
│  │    ANALYSIS │     │    ANALYSIS │     │    TESTING  │               │
│  │ (Slither,   │     │ (Claude     │     │ (Foundry    │               │
│  │  Mythril)   │     │  Prompts)   │     │  Fuzz)      │               │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
│         │                   │                   │                       │
│         └───────────────────┴───────────────────┘                       │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────┐                                                        │
│  │ 5. FINDING  │ ──► Merge all findings                                 │
│  │    AGGREGAT │ ──► Deduplicate                                        │
│  │             │ ──► Calculate BVSS scores                              │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 6. HUMAN    │ ──► Queue for review                                   │
│  │    REVIEW   │ ──► Validate findings                                  │
│  │             │ ──► Adjust severity if needed                          │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 7. CLIENT   │ ──► Send clarification questions                       │
│  │    CLARIFY  │ ──► Receive responses                                  │
│  │             │ ──► Classify response type                             │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 8. SCORE    │ ──► Calculate section scores                           │
│  │    CALCULATE│ ──► Apply clarification impact                         │
│  │             │ ──► Determine confidence levels                        │
│  └──────┬──────┘                                                        │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐                                                        │
│  │ 9. REPORT   │ ──► Generate HTML/PDF                                  │
│  │    GENERATE │ ──► Human final approval                               │
│  │             │ ──► Deliver to client                                  │
│  └─────────────┘                                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 17.3 APPROACH: BVSS SCORING SYSTEM

#### Problem:
Severity scoring subjective hai, need consistent, blockchain-specific scoring.

#### Solution Approach:

```
STEP 1: Create BVSS Calculator Module
────────────────────────────────────

Location: src/lib/bvss-calculator.ts

Input:
├── Attack Vector (AV): Network | Adjacent | Local
├── Attack Complexity (AC): Low | High
├── Privileges Required (PR): None | Low | High
├── User Interaction (UI): None | Required
├── Scope (S): Unchanged | Changed
├── Confidentiality Impact (C): None | Low | High
├── Integrity Impact (I): None | Low | High
├── Availability Impact (A): None | Low | High
├── Financial Impact (FI): None | Low | Medium | High
├── Reversibility (R): Reversible | Irreversible
└── Exploit Likelihood (EL): Unlikely | Possible | Likely

Output:
├── bvss_score: number (0.0 - 10.0)
├── severity_level: CRITICAL | HIGH | MEDIUM | LOW | INFO
└── bvss_vector: string (e.g., "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/FI:H/R:I/EL:L")
```

```typescript
// PSEUDO-CODE LOGIC

const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55 },
  AC: { L: 0.77, H: 0.44 },
  PR: { N: 0.85, L: 0.62, H: 0.27 },
  UI: { N: 0.85, R: 0.62 },
  S:  { U: 1.0, C: 1.08 },
  C:  { N: 0, L: 0.22, H: 0.56 },
  I:  { N: 0, L: 0.22, H: 0.56 },
  A:  { N: 0, L: 0.22, H: 0.56 },
  // Blockchain-specific
  FI: { N: 0, L: 0.2, M: 0.5, H: 1.0 },
  R:  { R: 0.5, I: 1.0 },
  EL: { U: 0.3, P: 0.6, L: 1.0 }
};

function calculateBVSS(params) {
  // Base exploitability
  const exploitability = WEIGHTS.AV[params.AV] *
                         WEIGHTS.AC[params.AC] *
                         WEIGHTS.PR[params.PR] *
                         WEIGHTS.UI[params.UI];

  // Impact score
  const impact = (WEIGHTS.C[params.C] +
                  WEIGHTS.I[params.I] +
                  WEIGHTS.A[params.A]) / 3;

  // Base CVSS-like score
  const baseScore = exploitability * WEIGHTS.S[params.S] * impact * 10;

  // Blockchain modifier
  const blockchainMod = (WEIGHTS.FI[params.FI] +
                         WEIGHTS.R[params.R] +
                         WEIGHTS.EL[params.EL]) / 3;

  // Final BVSS
  const bvss = Math.min(10, baseScore * (1 + blockchainMod * 0.5));

  return {
    score: Math.round(bvss * 100) / 100,
    level: getSeverityLevel(bvss),
    vector: generateVector(params)
  };
}

function getSeverityLevel(score) {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score >= 0.1) return 'LOW';
  return 'INFO';
}
```

#### AI Integration for Auto-BVSS:

```
PROMPT FOR AI BVSS ASSESSMENT:

"Given this vulnerability:

Title: {finding_title}
Description: {finding_description}
Code: {code_snippet}

Assess each BVSS parameter:

1. Attack Vector (AV):
   - Network (N): Can be exploited remotely via network/internet
   - Adjacent (A): Requires adjacent network access
   - Local (L): Requires local/physical access

2. Attack Complexity (AC):
   - Low (L): No special conditions needed
   - High (H): Requires specific conditions/race conditions

3. Privileges Required (PR):
   - None (N): No authentication needed
   - Low (L): Basic user privileges
   - High (H): Admin/owner privileges

4. User Interaction (UI):
   - None (N): No victim action needed
   - Required (R): Victim must take action

5. Scope (S):
   - Unchanged (U): Only affects vulnerable contract
   - Changed (C): Can affect other contracts/systems

6. Confidentiality Impact (C):
   - None: No data exposure
   - Low: Partial data exposure
   - High: Full data exposure

7. Integrity Impact (I):
   - None: No data modification
   - Low: Partial data modification
   - High: Full data modification

8. Availability Impact (A):
   - None: No disruption
   - Low: Partial disruption
   - High: Full DoS possible

9. Financial Impact (FI) [Blockchain-specific]:
   - None: No financial loss
   - Low: <$10K potential loss
   - Medium: $10K-$100K potential loss
   - High: >$100K potential loss

10. Reversibility (R) [Blockchain-specific]:
    - Reversible: Can be undone (upgradeable, pausable)
    - Irreversible: Permanent damage

11. Exploit Likelihood (EL) [Blockchain-specific]:
    - Unlikely: Theoretical, complex
    - Possible: Feasible with effort
    - Likely: Easy to exploit, will happen

Return JSON:
{
  'AV': 'N|A|L',
  'AC': 'L|H',
  'PR': 'N|L|H',
  'UI': 'N|R',
  'S': 'U|C',
  'C': 'N|L|H',
  'I': 'N|L|H',
  'A': 'N|L|H',
  'FI': 'N|L|M|H',
  'R': 'R|I',
  'EL': 'U|P|L',
  'reasoning': 'Brief explanation for each choice'
}"
```

#### UI Component:

```
┌─────────────────────────────────────────────────────────────┐
│  BVSS CALCULATOR                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Finding: Missing Access Control in swap()                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ EXPLOITABILITY METRICS                               │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Attack Vector:     [Network ▼]                       │   │
│  │ Attack Complexity: [Low ▼]                           │   │
│  │ Privileges Req:    [None ▼]                          │   │
│  │ User Interaction:  [None ▼]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ IMPACT METRICS                                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Confidentiality:   [None ▼]                          │   │
│  │ Integrity:         [High ▼]                          │   │
│  │ Availability:      [None ▼]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ BLOCKCHAIN METRICS                                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Financial Impact:  [High ▼]                          │   │
│  │ Reversibility:     [Irreversible ▼]                  │   │
│  │ Exploit Likelihood:[Likely ▼]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  BVSS Score: 7.8 / 10.0                        [HIGH]      │
│  Vector: AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N/FI:H/R:I/EL:L │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  [Auto-Calculate with AI] [Save Score] [Override Manual]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 17.4 APPROACH: TEST ENVIRONMENT DETECTION & SETUP

#### Problem:
Different projects use different frameworks (Hardhat, Foundry, Brownie). Need auto-detection.

#### Solution Approach:

```
DETECTION ALGORITHM:
────────────────────

function detectTestEnvironment(repoPath) {
  const result = {
    framework: null,
    compiler: null,
    network: null,
    testFiles: []
  };

  // Step 1: Check for framework config files
  if (exists('foundry.toml')) {
    result.framework = 'foundry';
    result.testFiles = glob('test/**/*.t.sol');
  } else if (exists('hardhat.config.js') || exists('hardhat.config.ts')) {
    result.framework = 'hardhat';
    result.testFiles = glob('test/**/*.js', 'test/**/*.ts');
  } else if (exists('brownie-config.yaml')) {
    result.framework = 'brownie';
    result.testFiles = glob('tests/**/*.py');
  } else if (exists('Anchor.toml')) {
    result.framework = 'anchor';
    result.testFiles = glob('tests/**/*.ts');
  }

  // Step 2: Parse compiler version from config
  if (result.framework === 'foundry') {
    const config = parseToml('foundry.toml');
    result.compiler = {
      version: config.profile?.default?.solc || 'auto',
      optimizer: config.profile?.default?.optimizer || true,
      runs: config.profile?.default?.optimizer_runs || 200
    };
  } else if (result.framework === 'hardhat') {
    const config = require(hardhatConfigPath);
    result.compiler = {
      version: config.solidity?.version || config.solidity,
      optimizer: config.solidity?.settings?.optimizer?.enabled,
      runs: config.solidity?.settings?.optimizer?.runs
    };
  }

  // Step 3: Detect network configuration
  result.network = detectNetworkConfig(result.framework);

  // Step 4: Count existing tests
  result.existingTests = {
    count: result.testFiles.length,
    coverage: await runCoverageCheck(result.framework)
  };

  return result;
}
```

#### Running Tests:

```
TEST EXECUTION APPROACH:
────────────────────────

async function runTests(framework, options) {
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    coverage: {},
    gasReport: {},
    logs: []
  };

  switch (framework) {
    case 'foundry':
      // Run Foundry tests
      const foundryResult = await exec(`
        forge test
          --gas-report
          --fuzz-runs ${options.fuzzRuns || 10000}
          -vvv
      `);
      results = parseFoundryOutput(foundryResult);

      // Run coverage
      const coverageResult = await exec('forge coverage --report lcov');
      results.coverage = parseLcov(coverageResult);
      break;

    case 'hardhat':
      // Run Hardhat tests
      const hardhatResult = await exec('npx hardhat test --parallel');
      results = parseHardhatOutput(hardhatResult);

      // Run coverage
      const hCoverage = await exec('npx hardhat coverage');
      results.coverage = parseCoverage(hCoverage);
      break;
  }

  return results;
}
```

#### Test Parameter Configuration UI:

```
┌─────────────────────────────────────────────────────────────┐
│  TEST ENVIRONMENT CONFIGURATION                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Detected Framework: [Foundry ✓] (auto-detected)           │
│  Solidity Version: 0.8.19                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ FUZZ TESTING                                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Fuzz Runs:        [10000    ] (recommended: 10000)   │   │
│  │ Max Depth:        [50       ]                        │   │
│  │ Seed:             [random   ]                        │   │
│  │ Shrinking:        [✓] Enabled                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ INVARIANT TESTING                                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Runs:             [1000     ]                        │   │
│  │ Depth:            [100      ]                        │   │
│  │ Fail on Revert:   [✓] Yes                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ FORK CONFIGURATION                                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Fork Network:     [Ethereum Mainnet ▼]               │   │
│  │ Fork Block:       [latest   ] or specific block      │   │
│  │ RPC URL:          [alchemy/infura endpoint]          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Run Tests] [Run with Coverage] [Skip to Analysis]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 17.5 APPROACH: TEST CASE GENERATION

#### Problem:
Need to generate test cases for vulnerabilities found, and track their results.

#### Solution Approach:

```
TEST CASE GENERATION PIPELINE:
──────────────────────────────

1. FINDING DETECTED
   └── Finding: Missing access control in withdraw()

2. AI GENERATES TEST CASE
   └── Prompt AI to create test for this specific vulnerability

3. STORE TEST CASE
   └── Save to database with finding reference

4. EXECUTE TEST
   └── Run in test environment

5. RECORD RESULT
   └── Store PASS/FAIL with details

6. LINK TO FINDING
   └── Update finding with test evidence
```

#### AI Prompt for Test Generation:

```
PROMPT: GENERATE TEST CASE

"You are a smart contract security tester. Generate a test case for this vulnerability:

VULNERABILITY:
Title: {finding_title}
Description: {finding_description}
Contract: {contract_name}
Function: {function_name}
Location: {file}:{line}

Vulnerable Code:
```solidity
{vulnerable_code}
```

REQUIREMENTS:
1. Use {framework} testing framework (Foundry/Hardhat)
2. Test should FAIL on vulnerable code
3. Test should PASS after fix is applied
4. Include setup, attack steps, and assertions
5. Include comments explaining each step

Generate test in this format:

```solidity
// Test Case: TC-{finding_id}
// Purpose: Verify {vulnerability_type} is exploitable
// Expected: Transaction should {succeed/revert}

contract {TestName} is Test {
    // Setup
    function setUp() public {
        // Deploy contracts
        // Set initial state
    }

    // Attack test
    function test_{vulnerability}_attack() public {
        // Step 1: ...
        // Step 2: ...
        // Assert
    }

    // Fix verification test
    function test_{vulnerability}_fixed() public {
        // Should pass after fix
    }
}
```

Also provide:
- Preconditions list
- Expected result
- Gas estimate
- Related test cases (if any)"
```

#### Test Case Tracking:

```typescript
interface TestCase {
  id: string;                    // "TC-UAT-001"
  finding_id: string;            // "UAT-001"

  metadata: {
    name: string;                // "test_unauthorized_withdrawal"
    category: string;            // "Access Control"
    priority: "HIGH" | "MEDIUM" | "LOW";
    created_by: "AI" | "HUMAN";
    created_at: Date;
  };

  test_spec: {
    objective: string;
    preconditions: string[];
    steps: string[];
    expected_result: string;
    framework: "foundry" | "hardhat";
  };

  test_code: {
    code: string;                // Actual test code
    file_path: string;           // Where test is saved
    language: "solidity" | "typescript";
  };

  execution: {
    status: "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ERROR";
    executed_at?: Date;
    duration_ms?: number;
    gas_used?: number;
    output?: string;
    error?: string;
  };

  evidence: {
    transaction_hash?: string;
    logs: string[];
    screenshots?: string[];      // For frontend tests
  };
}
```

---

### 17.6 APPROACH: USER FLOW ANALYSIS

#### Problem:
Need to map complete user journeys through contracts, identify risk points.

#### Solution Approach:

```
FLOW DETECTION ALGORITHM:
─────────────────────────

1. IDENTIFY ENTRY POINTS
   └── All public/external functions

2. TRACE EXECUTION PATH
   └── For each entry point, trace:
       ├── State changes
       ├── External calls
       ├── Events emitted
       └── Return values

3. BUILD FLOW GRAPH
   └── Create directed graph of function calls

4. IDENTIFY CRITICAL PATHS
   └── Paths involving:
       ├── Fund transfers
       ├── Ownership changes
       ├── Access control changes
       └── External contract calls

5. RISK ANALYSIS PER STEP
   └── For each step, check:
       ├── Reentrancy risk
       ├── Access control
       ├── Input validation
       └── State consistency
```

#### AI Prompt for Flow Analysis:

```
PROMPT: ANALYZE USER FLOW

"Analyze this smart contract and identify all user flows:

CONTRACT CODE:
{contract_code}

For each flow, provide:

1. FLOW NAME: Descriptive name (e.g., "Token Swap Flow")

2. ACTORS: Who participates
   - User types (admin, regular user, oracle, etc.)
   - Trust level (trusted/untrusted)

3. STEPS: Sequential actions
   For each step:
   - Function called
   - Parameters passed
   - State changes
   - Events emitted
   - External calls made
   - Gas estimate
   - Potential risks at this step

4. SUCCESS CRITERIA: What defines successful completion

5. FAILURE MODES: What can go wrong
   - For each failure mode:
     - Cause
     - Impact
     - Likelihood
     - Mitigation (if any)

6. ATTACK SCENARIOS: How could attacker abuse this flow

Output as JSON matching UserFlow interface."
```

#### Flow Visualization:

```
┌─────────────────────────────────────────────────────────────┐
│  USER FLOW: Token Swap                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTORS:                                                    │
│  ┌────────┐    ┌────────┐    ┌────────┐                    │
│  │  User  │    │Swapper │    │  DEX   │                    │
│  │(untrust)│    │Contract│    │(external)                  │
│  └────┬───┘    └────┬───┘    └────┬───┘                    │
│       │             │             │                         │
│  ═════╪═════════════╪═════════════╪═════════════════════   │
│       │             │             │                         │
│  ┌────┴────┐        │             │                         │
│  │STEP 1   │        │             │                         │
│  │approve()│───────▶│             │                         │
│  │         │        │             │                         │
│  │Gas: 46K │        │             │                         │
│  │Risk: LOW│        │             │                         │
│  └────┬────┘        │             │                         │
│       │             │             │                         │
│  ┌────┴────┐        │             │                         │
│  │STEP 2   │        │             │                         │
│  │swap()   │───────▶│             │                         │
│  │         │        │─────────────▶                         │
│  │Gas: 150K│        │  external   │                         │
│  │Risk:HIGH│        │  call       │                         │
│  │⚠️ MEV   │        │             │                         │
│  └────┬────┘        │             │                         │
│       │             │             │                         │
│  ┌────┴────┐        │             │                         │
│  │STEP 3   │        │             │                         │
│  │receive  │◀───────│             │                         │
│  │tokens   │        │             │                         │
│  │Gas: 51K │        │             │                         │
│  │Risk: LOW│        │             │                         │
│  └─────────┘        │             │                         │
│                                                             │
│  RISK SUMMARY: 1 HIGH (MEV), 2 LOW                         │
│  TOTAL GAS: ~250K                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 17.7 APPROACH: CLARIFICATION SYSTEM

#### Problem:
Need structured way to ask client questions, track responses, classify response types.

#### Solution Approach:

```
CLARIFICATION WORKFLOW:
───────────────────────

1. QUESTION GENERATION
   ├── AI identifies areas needing clarification
   ├── Human auditor adds questions
   └── Questions categorized by type

2. QUESTION DELIVERY
   ├── Package questions in clarification document
   ├── Send to client via platform/email
   └── Set deadline for response

3. RESPONSE COLLECTION
   ├── Client responds in platform
   ├── Each response timestamped
   └── Supporting evidence attached

4. RESPONSE CLASSIFICATION
   ├── AI classifies: CODE_BASED | TRUST_BASED | DESIGN | ACKNOWLEDGED
   ├── Human verifies classification
   └── Confidence score assigned

5. IMPACT ANALYSIS
   ├── Link to related findings
   ├── Calculate severity adjustment
   └── Update scores
```

#### AI Prompt for Question Generation:

```
PROMPT: GENERATE CLARIFICATION QUESTIONS

"Based on this audit finding, generate clarification questions:

FINDING:
{finding_details}

CODE CONTEXT:
{relevant_code}

Generate questions that would help:
1. Verify if this is intentional design
2. Understand trust assumptions
3. Clarify business logic
4. Identify mitigations not visible in code

For each question provide:
- Question text
- Category: DESIGN | IMPLEMENTATION | BUSINESS_LOGIC | TRUST_ASSUMPTION
- Priority: HIGH | MEDIUM | LOW
- Context: Why this matters
- Expected response type: CODE_BASED | TRUST_BASED | DESIGN_DECISION

Format as JSON array."
```

#### Response Classification:

```
CLASSIFICATION ALGORITHM:
─────────────────────────

function classifyResponse(question, response) {
  const classification = {
    type: null,
    confidence: 0,
    evidence: null
  };

  // Check for code references
  const codePatterns = [
    /line \d+/i,
    /function \w+/i,
    /contract \w+/i,
    /see (the |our )?code/i,
    /implemented in/i,
    /\.sol/,
    /```/ // code block
  ];

  const hasCodeReference = codePatterns.some(p => p.test(response));

  // Check for trust indicators
  const trustPatterns = [
    /we (will|plan to|intend)/i,
    /our team/i,
    /multisig/i,
    /trust/i,
    /off-chain/i,
    /manual process/i
  ];

  const hasTrustClaim = trustPatterns.some(p => p.test(response));

  // Check for acknowledgment
  const ackPatterns = [
    /we (acknowledge|accept|understand)/i,
    /intentional/i,
    /by design/i,
    /known (risk|limitation)/i
  ];

  const isAcknowledgment = ackPatterns.some(p => p.test(response));

  // Classify
  if (hasCodeReference && await verifyCodeReference(response)) {
    classification.type = 'CODE_BASED';
    classification.confidence = 90;
    classification.evidence = extractCodeReference(response);
  } else if (isAcknowledgment) {
    classification.type = 'ACKNOWLEDGED_RISK';
    classification.confidence = 85;
  } else if (hasTrustClaim && !hasCodeReference) {
    classification.type = 'TRUST_BASED';
    classification.confidence = 40;
  } else {
    classification.type = 'DESIGN_DECISION';
    classification.confidence = 60;
  }

  return classification;
}
```

#### Clarification UI:

```
┌─────────────────────────────────────────────────────────────┐
│  CLARIFICATION DOCUMENT                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project: ZKCross Swapper                                   │
│  Status: 3 of 5 questions answered                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CQ-001 [ANSWERED]                     [CODE_BASED]  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Q: How is reentrancy prevented in the swap function?│   │
│  │                                                     │   │
│  │ A: "We use OpenZeppelin's ReentrancyGuard. See      │   │
│  │    Swapper.sol line 12 for the import and line 45   │   │
│  │    for the nonReentrant modifier on swap()."        │   │
│  │                                                     │   │
│  │ Classification: CODE_BASED (Confidence: 95%)        │   │
│  │ Verified: ✓ Code reference confirmed                │   │
│  │ Impact: Finding UAT-02 severity unchanged           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CQ-002 [ANSWERED]                    [TRUST_BASED]  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Q: Who controls the admin key?                       │   │
│  │                                                     │   │
│  │ A: "Our admin key is held in a 3-of-5 multisig      │   │
│  │    with founding team members."                     │   │
│  │                                                     │   │
│  │ Classification: TRUST_BASED (Confidence: 35%)       │   │
│  │ ⚠️ Cannot verify without on-chain multisig address │   │
│  │ Impact: Finding UAT-05 severity reduced with caveat │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CQ-003 [PENDING]                                    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Q: Is the lack of slippage protection intentional?  │   │
│  │                                                     │   │
│  │ [Awaiting response from client]                     │   │
│  │                                                     │   │
│  │ Asked: 2 days ago                                   │   │
│  │ Deadline: 3 days                                    │   │
│  │                                         [Send Reminder] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 17.8 APPROACH: SECTION-WISE SCORING

#### Problem:
Need to provide granular security scores per category with confidence levels.

#### Solution Approach:

```
SCORING PIPELINE:
─────────────────

1. CATEGORIZE FINDINGS
   └── Group findings by category:
       ├── Access Control
       ├── Fund Safety
       ├── Input Validation
       ├── State Management
       ├── External Calls
       └── Gas Efficiency

2. CALCULATE RAW SCORE PER SECTION
   └── base_score = 100 - Σ(severity_penalties)
       Where:
       ├── Critical: -25
       ├── High: -15
       ├── Medium: -8
       └── Low: -3

3. CALCULATE CONFIDENCE FACTORS
   └── confidence = weighted_average(
       ├── code_coverage (30%)
       ├── test_coverage (30%)
       ├── clarification_quality (20%)
       └── tool_agreement (20%)
   )

4. APPLY CLARIFICATION ADJUSTMENTS
   └── For each clarification:
       ├── CODE_BASED positive: +5 to +15
       ├── TRUST_BASED: +2 to +5 (flagged)
       ├── DESIGN_DECISION: +3 to +10
       └── ACKNOWLEDGED_RISK: 0 (documented)

5. CALCULATE FINAL SCORE
   └── final = (raw + adjustments) × confidence_multiplier
```

#### Scoring Logic:

```typescript
interface SectionScoreCalculation {
  section: string;

  // Step 1: Count issues
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  // Step 2: Raw score
  rawScore: number;  // 100 - penalties

  // Step 3: Confidence factors
  confidence: {
    codeCoverage: number;      // 0-100: % of section code reviewed
    testCoverage: number;      // 0-100: % test coverage
    clarificationQuality: number; // 0-100: quality of responses
    toolAgreement: number;     // 0-100: do tools agree?
    overall: number;           // weighted average
    level: 'HIGH' | 'MEDIUM' | 'LOW';
  };

  // Step 4: Adjustments
  adjustments: Array<{
    clarificationId: string;
    type: 'CODE_BASED' | 'TRUST_BASED' | 'DESIGN_DECISION' | 'ACKNOWLEDGED_RISK';
    adjustment: number;
    reason: string;
  }>;

  // Step 5: Final
  finalScore: number;
  status: 'SECURE' | 'NEEDS_ATTENTION' | 'AT_RISK' | 'CRITICAL';
}

function calculateSectionScore(section, findings, clarifications, coverage) {
  // Step 1: Count issues in this section
  const issues = countIssuesBySeverity(findings, section);

  // Step 2: Raw score
  const penalties = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 0
  };

  let rawScore = 100;
  for (const [severity, count] of Object.entries(issues)) {
    rawScore -= count * penalties[severity];
  }
  rawScore = Math.max(0, rawScore);

  // Step 3: Confidence
  const confidence = {
    codeCoverage: coverage.codeReviewedPercent,
    testCoverage: coverage.testCoveragePercent,
    clarificationQuality: calculateClarificationQuality(clarifications),
    toolAgreement: calculateToolAgreement(section)
  };

  confidence.overall = (
    confidence.codeCoverage * 0.3 +
    confidence.testCoverage * 0.3 +
    confidence.clarificationQuality * 0.2 +
    confidence.toolAgreement * 0.2
  );

  confidence.level =
    confidence.overall >= 80 ? 'HIGH' :
    confidence.overall >= 50 ? 'MEDIUM' : 'LOW';

  // Step 4: Adjustments
  const adjustments = [];
  let totalAdjustment = 0;

  for (const clarification of clarifications) {
    if (clarification.relatedSection !== section) continue;

    let adj = 0;
    switch (clarification.type) {
      case 'CODE_BASED':
        adj = clarification.positive ? 10 : 0;
        break;
      case 'TRUST_BASED':
        adj = 3; // Small adjustment, low confidence
        break;
      case 'DESIGN_DECISION':
        adj = clarification.soundReasoning ? 7 : 0;
        break;
      case 'ACKNOWLEDGED_RISK':
        adj = 0; // No adjustment
        break;
    }

    if (adj > 0) {
      adjustments.push({
        clarificationId: clarification.id,
        type: clarification.type,
        adjustment: adj,
        reason: clarification.summary
      });
      totalAdjustment += adj;
    }
  }

  // Step 5: Final score
  const adjustedScore = Math.min(100, rawScore + totalAdjustment);
  const confidenceMultiplier = confidence.overall / 100;
  const finalScore = Math.round(adjustedScore * confidenceMultiplier);

  const status =
    finalScore >= 80 ? 'SECURE' :
    finalScore >= 60 ? 'NEEDS_ATTENTION' :
    finalScore >= 40 ? 'AT_RISK' : 'CRITICAL';

  return {
    section,
    issues,
    rawScore,
    confidence,
    adjustments,
    totalAdjustment,
    finalScore,
    status
  };
}
```

---

### 17.9 APPROACH: HUMAN REVIEW INTEGRATION

#### Problem:
AI cannot make final judgments on trust-based claims. Need human-in-the-loop.

#### Solution Approach:

```
HUMAN REVIEW SYSTEM:
────────────────────

1. AUTOMATIC QUEUE GENERATION
   ├── Low confidence findings → Queue
   ├── Trust-based clarifications → Queue
   ├── Severity > MEDIUM → Queue
   └── Scope changes → Queue

2. REVIEW INTERFACE
   ├── Show AI analysis
   ├── Show evidence
   ├── Show confidence scores
   └── Allow override/confirm

3. APPROVAL WORKFLOW
   ├── Reviewer assigns to self
   ├── Reviews and makes decision
   ├── Documents reasoning
   └── Approves/rejects/requests changes

4. AUDIT TRAIL
   ├── All actions logged
   ├── Timestamps recorded
   ├── Reviewer identified
   └── Reasoning captured
```

#### Queue Logic:

```typescript
function shouldQueueForHumanReview(item, context) {
  const reasons = [];

  // Low confidence items
  if (item.confidence < 50) {
    reasons.push(`Low confidence: ${item.confidence}%`);
  }

  // Trust-based clarifications
  if (item.type === 'clarification' && item.responseType === 'TRUST_BASED') {
    reasons.push('Trust-based response requires human verification');
  }

  // High severity findings
  if (item.type === 'finding' && ['CRITICAL', 'HIGH'].includes(item.severity)) {
    reasons.push(`High severity finding: ${item.severity}`);
  }

  // AI disagreement
  if (item.type === 'finding' && item.toolsDisagree) {
    reasons.push('Static analysis tools disagree');
  }

  // Scope changes
  if (item.type === 'scope' && item.isChange) {
    reasons.push('Scope modification requires approval');
  }

  // Complex business logic
  if (item.type === 'finding' && item.category === 'BUSINESS_LOGIC') {
    reasons.push('Business logic requires human understanding');
  }

  return {
    needsReview: reasons.length > 0,
    reasons,
    priority: calculateReviewPriority(reasons)
  };
}
```

#### Human Review UI:

```
┌─────────────────────────────────────────────────────────────┐
│  HUMAN REVIEW ITEM                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Item: CQ-002 (Clarification Response)                      │
│  Priority: HIGH                                             │
│  Queued: 2 hours ago                                        │
│  Reason: Trust-based response requires human verification   │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  ORIGINAL QUESTION:                                         │
│  "Who controls the admin key and what safeguards are       │
│   in place against key compromise?"                         │
│                                                             │
│  CLIENT RESPONSE:                                           │
│  "Our admin key is held in a 3-of-5 multisig with          │
│   founding team members. Signers are geographically        │
│   distributed across 3 countries. Key ceremony was         │
│   conducted with hardware wallets."                        │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  AI CLASSIFICATION:                                         │
│  Type: TRUST_BASED                                          │
│  Confidence: 35%                                            │
│  Reasoning: "Cannot verify multisig setup without          │
│             on-chain address. Claims about geographical    │
│             distribution are unverifiable."                │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  HUMAN REVIEWER ACTIONS:                                    │
│                                                             │
│  □ Request on-chain proof (multisig address)               │
│  □ Accept claim with documented caveat                     │
│  □ Reject - insufficient evidence                          │
│  □ Escalate to senior reviewer                             │
│                                                             │
│  Notes:                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Enter review notes here...]                         │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Severity Impact:                                           │
│  Finding UAT-05: HIGH → [MEDIUM ▼] (based on clarification)│
│                                                             │
│  Confidence Adjustment: 35% → [50% ▼] (after human review) │
│                                                             │
│  [Submit Review] [Request More Info] [Skip for Now]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 17.10 APPROACH: REPORT GENERATION

#### Problem:
Need professional, comprehensive PDF/HTML reports with all sections.

#### Solution Approach:

```
REPORT GENERATION PIPELINE:
───────────────────────────

1. DATA AGGREGATION
   ├── Collect all audit data
   ├── Organize by section
   └── Validate completeness

2. TEMPLATE SELECTION
   ├── Choose based on audit type
   ├── Apply client branding
   └── Set color scheme

3. SECTION GENERATION
   ├── For each section:
   │   ├── Gather relevant data
   │   ├── Format content
   │   ├── Generate visualizations
   │   └── Add to document
   └── Ensure consistency

4. PDF GENERATION
   ├── HTML → PDF conversion
   ├── Apply print styles
   ├── Add headers/footers
   └── Generate TOC

5. QUALITY CHECK
   ├── Verify all sections present
   ├── Check formatting
   ├── Validate links
   └── Human final approval
```

#### Report Template Structure:

```
REPORT SECTIONS (In Order):
───────────────────────────

1. COVER PAGE
   ├── Project name
   ├── Audit date
   ├── Report version
   ├── Security grade badge
   └── Uatu branding

2. TABLE OF CONTENTS
   └── Clickable navigation

3. DISCLAIMER & LIMITATIONS

4. EXECUTIVE SUMMARY
   ├── One-page overview
   ├── Key metrics
   ├── Risk assessment
   └── Recommendations summary

5. SCOPE
   ├── Repository details
   ├── Files in scope
   ├── Out of scope
   └── Methodology used

6. TEST ENVIRONMENT
   ├── Framework used
   ├── Parameters
   ├── Coverage achieved
   └── Tools used

7. FINDINGS SUMMARY
   ├── Severity distribution (chart)
   ├── Category distribution
   ├── Status overview
   └── Timeline

8. DETAILED FINDINGS
   └── For each finding:
       ├── Title & ID
       ├── Severity (BVSS)
       ├── Location
       ├── Description
       ├── Impact
       ├── Attack scenario
       ├── Vulnerable code
       ├── Recommendation
       ├── Fixed code
       └── References

9. USER FLOW ANALYSIS
   ├── Flow diagrams
   ├── Risk points
   └── Test results

10. CLIENT CLARIFICATIONS
    ├── Questions asked
    ├── Responses received
    ├── Classification
    └── Impact on findings

11. SECURITY SCORECARD
    ├── Overall score
    ├── Section breakdown
    ├── Confidence levels
    └── Trend (if re-audit)

12. APPENDICES
    ├── A: Severity definitions
    ├── B: BVSS calculation
    ├── C: Test results
    ├── D: Static analysis output
    └── E: Auditor credentials

13. AUDITOR SIGN-OFF
    ├── Lead auditor signature
    ├── Review date
    └── Certificate (if passed)
```

#### PDF Generation Code Approach:

```typescript
// Using Puppeteer for HTML → PDF

async function generatePDF(auditData) {
  // Step 1: Generate HTML from template
  const html = await renderTemplate('audit-report', {
    ...auditData,
    generatedAt: new Date(),
    version: auditData.version || '1.0'
  });

  // Step 2: Launch Puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Step 3: Set content
  await page.setContent(html, {
    waitUntil: 'networkidle0'
  });

  // Step 4: Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 10px; width: 100%; text-align: center;">
        ${auditData.projectName} - Security Audit Report
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 10px; width: 100%; text-align: center;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        | Confidential
      </div>
    `,
    margin: {
      top: '60px',
      right: '40px',
      bottom: '60px',
      left: '40px'
    }
  });

  await browser.close();

  return pdf;
}
```

---

### 17.11 DATABASE SCHEMA

```sql
-- Core Tables

CREATE TABLE audits (
  id UUID PRIMARY KEY,
  project_name VARCHAR(255),
  repo_url TEXT,
  commit_hash VARCHAR(40),
  branch VARCHAR(255),
  status VARCHAR(50), -- 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETE'
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE audit_scope (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  in_scope_files JSONB,
  out_of_scope JSONB,
  confirmed_by VARCHAR(255),
  confirmed_at TIMESTAMP
);

CREATE TABLE test_environment (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  framework VARCHAR(50),
  compiler_version VARCHAR(20),
  optimizer_enabled BOOLEAN,
  optimizer_runs INTEGER,
  network_config JSONB,
  test_params JSONB
);

CREATE TABLE findings (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  finding_code VARCHAR(20), -- 'UAT-001'
  title TEXT,
  description TEXT,
  severity VARCHAR(20),
  bvss_score DECIMAL(3,2),
  bvss_vector TEXT,
  status VARCHAR(20),
  location_file TEXT,
  location_line_start INTEGER,
  location_line_end INTEGER,
  function_name VARCHAR(255),
  vulnerable_code TEXT,
  recommendation TEXT,
  fixed_code TEXT,
  references JSONB,
  category VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE test_cases (
  id UUID PRIMARY KEY,
  finding_id UUID REFERENCES findings(id),
  test_code VARCHAR(20), -- 'TC-001'
  name TEXT,
  category VARCHAR(100),
  objective TEXT,
  preconditions JSONB,
  steps JSONB,
  expected_result TEXT,
  actual_result TEXT,
  status VARCHAR(20), -- 'PENDING' | 'PASSED' | 'FAILED'
  test_code_content TEXT,
  execution_logs TEXT,
  gas_used BIGINT,
  executed_at TIMESTAMP
);

CREATE TABLE user_flows (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  flow_code VARCHAR(20), -- 'UF-001'
  name TEXT,
  description TEXT,
  actors JSONB,
  steps JSONB,
  success_criteria JSONB,
  failure_modes JSONB,
  test_result JSONB,
  risk_level VARCHAR(20)
);

CREATE TABLE clarifications (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  question_code VARCHAR(20), -- 'CQ-001'
  category VARCHAR(50),
  question TEXT,
  context TEXT,
  priority VARCHAR(20),
  related_finding_id UUID REFERENCES findings(id),
  response TEXT,
  response_type VARCHAR(30), -- 'CODE_BASED' | 'TRUST_BASED' | etc.
  response_evidence TEXT,
  confidence_level INTEGER,
  responder VARCHAR(255),
  asked_at TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE TABLE section_scores (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  section_name VARCHAR(100),
  raw_score INTEGER,
  adjustments JSONB,
  final_score INTEGER,
  confidence_overall INTEGER,
  confidence_factors JSONB,
  status VARCHAR(30),
  findings_count JSONB
);

CREATE TABLE human_reviews (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  item_type VARCHAR(50), -- 'finding' | 'clarification' | 'scope'
  item_id UUID,
  reason TEXT,
  priority VARCHAR(20),
  status VARCHAR(20), -- 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  assigned_to VARCHAR(255),
  reviewer_notes TEXT,
  decision VARCHAR(50),
  reviewed_at TIMESTAMP
);

CREATE TABLE audit_reports (
  id UUID PRIMARY KEY,
  audit_id UUID REFERENCES audits(id),
  version VARCHAR(20),
  report_html TEXT,
  report_pdf BYTEA,
  generated_at TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP
);
```

---

### 17.12 API ENDPOINTS

```
CORE API STRUCTURE:
───────────────────

# Audit Management
POST   /api/audits                     # Create new audit
GET    /api/audits/:id                 # Get audit details
PATCH  /api/audits/:id                 # Update audit
DELETE /api/audits/:id                 # Cancel audit

# Scope
GET    /api/audits/:id/scope           # Get scope
PUT    /api/audits/:id/scope           # Update scope
POST   /api/audits/:id/scope/confirm   # Confirm scope (human)

# Test Environment
GET    /api/audits/:id/test-env        # Get test environment
PUT    /api/audits/:id/test-env        # Configure test environment
POST   /api/audits/:id/test-env/run    # Run tests

# Findings
GET    /api/audits/:id/findings        # List findings
POST   /api/audits/:id/findings        # Add finding (manual)
GET    /api/findings/:id               # Get finding details
PATCH  /api/findings/:id               # Update finding
POST   /api/findings/:id/bvss          # Calculate BVSS

# Test Cases
GET    /api/findings/:id/test-cases    # Get test cases for finding
POST   /api/findings/:id/test-cases    # Generate test case
POST   /api/test-cases/:id/run         # Run test case

# User Flows
GET    /api/audits/:id/flows           # List user flows
POST   /api/audits/:id/flows/analyze   # Analyze flows

# Clarifications
GET    /api/audits/:id/clarifications  # List clarifications
POST   /api/audits/:id/clarifications  # Add question
PATCH  /api/clarifications/:id         # Add response
POST   /api/clarifications/:id/classify # Classify response

# Scores
GET    /api/audits/:id/scores          # Get all section scores
POST   /api/audits/:id/scores/calculate # Recalculate scores

# Human Review
GET    /api/audits/:id/reviews         # List review queue
POST   /api/reviews/:id/assign         # Assign to reviewer
POST   /api/reviews/:id/complete       # Complete review

# Reports
POST   /api/audits/:id/reports         # Generate report
GET    /api/audits/:id/reports/:version # Get report
GET    /api/audits/:id/reports/:version/pdf # Download PDF
```

---

### 17.13 FRONTEND COMPONENTS

```
COMPONENT HIERARCHY:
────────────────────

<AuditDashboard>
├── <Header>
│   ├── <ProjectInfo>
│   ├── <AuditStatus>
│   └── <QuickActions>
│
├── <TabNavigation>
│   ├── Scope
│   ├── Analysis
│   ├── Findings
│   ├── Clarifications
│   ├── Scores
│   └── Report
│
├── <ScopeTab>
│   ├── <FileTreeSelector>
│   ├── <InScopeList>
│   ├── <OutOfScopeConfig>
│   └── <ScopeConfirmation>
│
├── <AnalysisTab>
│   ├── <TestEnvironmentConfig>
│   ├── <StaticAnalysisRunner>
│   ├── <AIAnalysisProgress>
│   └── <TestResultsViewer>
│
├── <FindingsTab>
│   ├── <FindingsSummary>
│   │   ├── <SeverityChart>
│   │   └── <CategoryBreakdown>
│   ├── <FindingsList>
│   │   └── <FindingCard>
│   │       ├── <SeverityBadge>
│   │       ├── <BVSSScore>
│   │       ├── <CodeSnippet>
│   │       └── <ActionButtons>
│   └── <FindingDetailModal>
│       ├── <AttackScenario>
│       ├── <Recommendation>
│       ├── <TestCaseViewer>
│       └── <BVSSCalculator>
│
├── <ClarificationsTab>
│   ├── <ClarificationList>
│   │   └── <ClarificationItem>
│   │       ├── <Question>
│   │       ├── <Response>
│   │       ├── <ClassificationBadge>
│   │       └── <ImpactAnalysis>
│   └── <AddQuestionModal>
│
├── <ScoresTab>
│   ├── <OverallScoreCard>
│   ├── <SectionScoreGrid>
│   │   └── <SectionScoreCard>
│   │       ├── <ScoreBar>
│   │       ├── <ConfidenceBadge>
│   │       └── <AdjustmentsList>
│   └── <ConfidenceBreakdown>
│
├── <ReportTab>
│   ├── <ReportPreview>
│   ├── <ReportCustomization>
│   └── <DownloadOptions>
│
└── <HumanReviewQueue> (floating/sidebar)
    └── <ReviewItem>
        ├── <ItemDetails>
        ├── <AIAnalysis>
        └── <ReviewActions>
```

---

## CONCLUSION

Complete professional audit requires:

1. **Scoping** - Clear in/out of scope with human confirmation
2. **Test Environment** - Documented setup and parameters
3. **Test Materials** - Organized test cases with expected results
4. **User Flows** - Step-by-step analysis with risk points
5. **Clarifications** - Structured Q&A with type classification
6. **Score Reanalysis** - Adjustments based on clarification type
7. **Section Scores** - Individual scores with confidence levels
8. **Human Checkpoints** - Clear points where human review required

All without hardcoded timelines - sequence matters, not duration.

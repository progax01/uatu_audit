# Interactive Multi-Project Audit Architecture

## Problem Statement

The current audit system has significant gaps:

1. **No interactive prompts during audit execution** - AI discovers admin addresses but can't ask "Is this a multisig?"
2. **No multi-contract context** - Can't link Protocol A with its Admin Contract or Governance Module
3. **User context doesn't affect findings** - Even if user tells us "this is a 3/5 multisig", we still flag it as "centralized admin risk"
4. **No cross-project references** - Two contracts working together are audited in isolation
5. **Long audits have no user re-engagement mechanism** - User starts deep audit, goes to lunch, has no idea when to come back

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT SESSION LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Primary    │───▶│   Linked     │───▶│   Known      │                   │
│  │   Project    │    │   Projects   │    │   Addresses  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    UNIFIED AUDIT CONTEXT                             │    │
│  │  • User answers to prompts                                          │    │
│  │  • Cross-project relationships                                       │    │
│  │  • Address labels and types                                          │    │
│  │  • Finding enrichment data                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOP EXECUTION ENGINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  │ Step 1  │──▶│ Step 2  │──▶│ Step 3  │──▶│ PROMPT  │──▶│ Step 4  │       │
│  │ (tool)  │   │ (tool)  │   │  (AI)   │   │ (pause) │   │  (AI)   │       │
│  └─────────┘   └─────────┘   └─────────┘   └────┬────┘   └─────────┘       │
│                                                  │                           │
│                                    ┌─────────────┴─────────────┐            │
│                                    │      USER INPUT           │            │
│                                    │  • Answer question        │            │
│                                    │  • Skip with default      │            │
│                                    │  • Auto-timeout (5 min)   │            │
│                                    └───────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FINDING ENRICHMENT ENGINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Raw Finding ──▶ Apply User Context ──▶ Adjust Severity ──▶ Enriched Finding│
│                                                                              │
│  Example:                                                                    │
│  ┌────────────────────────┐      ┌────────────────────────┐                 │
│  │ BEFORE                 │      │ AFTER                  │                 │
│  │ Title: Centralized     │  ──▶ │ Title: Multisig        │                 │
│  │        Admin Control   │      │        Admin Control   │                 │
│  │ Severity: HIGH         │      │ Severity: MEDIUM       │                 │
│  │ Context: None          │      │ Context: 3/5 Gnosis    │                 │
│  └────────────────────────┘      └────────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema Additions

```sql
-- =============================================================================
-- AUDIT SESSION CONTEXT
-- =============================================================================

-- Master session for an audit run (wraps audit_jobs)
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  -- Session configuration
  interactive_mode BOOLEAN DEFAULT true,
  auto_continue_timeout_seconds INTEGER DEFAULT 300,
  notification_email VARCHAR(255),
  notify_on_completion BOOLEAN DEFAULT true,
  notify_on_input_needed BOOLEAN DEFAULT true,

  -- Session state
  status VARCHAR(30) DEFAULT 'running', -- running, paused_for_input, completed, failed
  current_prompt_id UUID,
  paused_at_step VARCHAR(100),
  paused_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(job_id)
);

-- =============================================================================
-- LINKED PROJECTS (Multi-Contract Support)
-- =============================================================================

CREATE TABLE audit_linked_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,

  -- The linked project source
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(30) NOT NULL, -- github-repo, deployed-contract, existing-project
  source_config JSONB NOT NULL, -- { repoUrl, branch } or { address, chain } or { projectId }

  -- Relationship to primary project
  relationship VARCHAR(50) NOT NULL, -- admin, governance, timelock, dependency, integration, proxy, implementation
  relationship_description TEXT,

  -- Which contracts are relevant
  relevant_contracts JSONB, -- ["Governance.sol", "Timelock.sol"]

  -- If we're also auditing this linked project
  linked_job_id UUID REFERENCES audit_jobs(id),

  -- Metadata
  added_by VARCHAR(30) DEFAULT 'user', -- user, ai_suggestion
  added_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- KNOWN ADDRESSES (User-Provided Context)
-- =============================================================================

CREATE TABLE audit_known_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,

  -- Address info
  address VARCHAR(100) NOT NULL,
  chain VARCHAR(30) NOT NULL,
  label VARCHAR(255) NOT NULL,

  -- Address type affects how we interpret findings
  address_type VARCHAR(50) NOT NULL, -- eoa, multisig, timelock, governance, treasury, oracle, protocol, unknown

  -- Type-specific metadata
  metadata JSONB, -- { signers: 5, threshold: 3, walletType: "gnosis-safe" } for multisig
                  -- { delaySeconds: 172800 } for timelock
                  -- { tokenAddress: "0x...", quorum: "4%" } for governance

  -- If this address links to another project
  linked_project_id UUID REFERENCES audit_linked_projects(id),

  -- Source
  source VARCHAR(30) DEFAULT 'user', -- user, ai_detected, on_chain_verified
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INTERACTIVE PROMPTS
-- =============================================================================

CREATE TABLE audit_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,

  -- Which step triggered this prompt
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255),

  -- Prompt content
  prompt_type VARCHAR(30) NOT NULL, -- single_choice, multi_choice, text, address, contract_link, confirm
  question TEXT NOT NULL,

  -- Context to show user
  context JSONB, -- { code, file, line, finding, relatedFindings }

  -- Available options (for choice types)
  options JSONB, -- [{ value, label, description, severityImpact, followUp }]

  -- Prompt behavior
  required BOOLEAN DEFAULT false,
  default_value JSONB,
  timeout_seconds INTEGER DEFAULT 300,

  -- State
  status VARCHAR(20) DEFAULT 'pending', -- pending, answered, skipped, timed_out

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP,
  timed_out_at TIMESTAMP
);

-- =============================================================================
-- USER ANSWERS
-- =============================================================================

CREATE TABLE audit_user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES audit_prompts(id) ON DELETE CASCADE,

  -- The answer
  answer JSONB NOT NULL,
  answer_type VARCHAR(30) NOT NULL, -- from prompt_type

  -- How to apply this answer
  apply_to_similar BOOLEAN DEFAULT true, -- Apply to similar findings
  applied_to_findings JSONB, -- Array of finding IDs this affected
  severity_adjustments JSONB, -- { "finding-123": { from: "high", to: "medium", reason: "..." } }

  -- Source
  answered_by VARCHAR(30) DEFAULT 'user', -- user, auto_timeout, skip

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- NORMALIZED FINDINGS (for cross-referencing)
-- =============================================================================

CREATE TABLE audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,
  session_id UUID REFERENCES audit_sessions(id),

  -- Finding identity
  finding_id VARCHAR(100) NOT NULL, -- Original ID from tool/AI
  tool VARCHAR(50), -- slither, mythril, ai, etc.
  step_id VARCHAR(100),

  -- Finding content
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,

  -- Severity (original and adjusted)
  original_severity VARCHAR(20) NOT NULL,
  adjusted_severity VARCHAR(20), -- After user context applied
  severity_adjustment_reason TEXT,

  -- Location
  file_path VARCHAR(500),
  line_start INTEGER,
  line_end INTEGER,
  function_name VARCHAR(255),
  contract_name VARCHAR(255),

  -- Related addresses (for context matching)
  related_addresses JSONB, -- ["0x123...", "0x456..."]

  -- Cross-references
  similar_finding_ids JSONB, -- Findings in other projects that match
  linked_project_findings JSONB, -- Related findings in linked projects

  -- User interaction
  user_context JSONB, -- Context provided by user answers
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,

  -- State
  status VARCHAR(30) DEFAULT 'new', -- new, acknowledged, disputed, fixed, wont_fix

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(job_id, finding_id)
);

-- =============================================================================
-- CROSS-PROJECT REFERENCES
-- =============================================================================

CREATE TABLE audit_cross_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source finding
  finding_id UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,

  -- Target (either another finding or a linked project)
  target_type VARCHAR(30) NOT NULL, -- finding, linked_project, known_address
  target_finding_id UUID REFERENCES audit_findings(id),
  target_linked_project_id UUID REFERENCES audit_linked_projects(id),
  target_known_address_id UUID REFERENCES audit_known_addresses(id),

  -- Relationship
  relationship_type VARCHAR(50) NOT NULL, -- calls, inherits, controls, depends_on, same_issue
  description TEXT,

  -- Source
  created_by VARCHAR(30) DEFAULT 'ai', -- ai, user
  confidence DECIMAL(3,2), -- 0.00-1.00 for AI-detected

  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification content
  type VARCHAR(50) NOT NULL, -- audit_complete, input_needed, critical_finding, audit_failed
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Related entities
  job_id UUID REFERENCES audit_jobs(id),
  session_id UUID REFERENCES audit_sessions(id),
  prompt_id UUID REFERENCES audit_prompts(id),
  finding_id UUID REFERENCES audit_findings(id),

  -- Delivery
  channels JSONB NOT NULL, -- ["in_app", "email"]
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,

  -- State
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_sessions_job ON audit_sessions(job_id);
CREATE INDEX idx_audit_sessions_status ON audit_sessions(status);
CREATE INDEX idx_audit_prompts_session ON audit_prompts(session_id);
CREATE INDEX idx_audit_prompts_status ON audit_prompts(status);
CREATE INDEX idx_audit_findings_job ON audit_findings(job_id);
CREATE INDEX idx_audit_findings_severity ON audit_findings(adjusted_severity);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
```

---

## 2. Prompt Templates

```typescript
// src/services/promptTemplates.ts

export const PROMPT_TEMPLATES = {
  // ==========================================================================
  // ADMIN & ACCESS CONTROL
  // ==========================================================================

  admin_address_type: {
    id: 'admin_address_type',
    type: 'single_choice',
    question: 'We identified an admin address that controls critical functions:\n\n**Address:** `{address}`\n**Controls:** {functions}\n\nWhat type of address is this?',
    options: [
      {
        value: 'eoa',
        label: 'EOA (Single Private Key)',
        description: 'One person/key controls this address',
        severityImpact: 'no_change',
        riskLevel: 'high'
      },
      {
        value: 'multisig',
        label: 'Multisig Wallet',
        description: 'Multiple signatures required for transactions',
        severityImpact: 'reduce_one_level',
        riskLevel: 'medium',
        followUp: ['multisig_details']
      },
      {
        value: 'timelock',
        label: 'Timelock Contract',
        description: 'Actions have a delay before execution',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
        followUp: ['timelock_duration']
      },
      {
        value: 'governance',
        label: 'Governance Contract',
        description: 'Token holders vote on actions',
        severityImpact: 'reduce_two_levels',
        riskLevel: 'low',
        followUp: ['governance_link']
      },
      {
        value: 'renounced',
        label: 'Renounced/Burned',
        description: 'No one can use this admin function anymore',
        severityImpact: 'remove_finding',
        riskLevel: 'none'
      },
      {
        value: 'unknown',
        label: "I don't know",
        description: 'We\'ll assume worst case (EOA)',
        severityImpact: 'no_change',
        riskLevel: 'high'
      }
    ],
    defaultValue: 'unknown',
    timeoutSeconds: 300
  },

  multisig_details: {
    id: 'multisig_details',
    type: 'form',
    question: 'Please provide multisig details:',
    fields: [
      {
        name: 'threshold',
        type: 'number',
        label: 'Required signatures',
        placeholder: '3',
        required: true
      },
      {
        name: 'total_signers',
        type: 'number',
        label: 'Total signers',
        placeholder: '5',
        required: true
      },
      {
        name: 'wallet_type',
        type: 'select',
        label: 'Wallet type',
        options: [
          { value: 'gnosis_safe', label: 'Gnosis Safe' },
          { value: 'gnosis_safe_legacy', label: 'Gnosis Safe (Legacy)' },
          { value: 'other', label: 'Other Multisig' }
        ],
        required: true
      },
      {
        name: 'signer_diversity',
        type: 'select',
        label: 'Signer diversity',
        options: [
          { value: 'same_entity', label: 'All signers are same entity/team' },
          { value: 'mixed', label: 'Mix of team and external signers' },
          { value: 'fully_distributed', label: 'Fully distributed (different entities)' }
        ],
        description: 'This affects how we assess centralization risk'
      }
    ],
    severityRules: {
      // If 1/1, no reduction
      // If 2/3 same entity, reduce one level
      // If 3/5+ distributed, reduce two levels
      calculate: (answers) => {
        const ratio = answers.threshold / answers.total_signers;
        if (ratio >= 0.6 && answers.signer_diversity !== 'same_entity') {
          return 'reduce_two_levels';
        } else if (ratio >= 0.5) {
          return 'reduce_one_level';
        }
        return 'no_change';
      }
    }
  },

  timelock_duration: {
    id: 'timelock_duration',
    type: 'single_choice',
    question: 'What is the timelock delay?',
    options: [
      {
        value: 'instant',
        label: 'No delay (0)',
        severityImpact: 'no_change',
        description: 'Timelock exists but delay is 0'
      },
      {
        value: 'less_6h',
        label: 'Less than 6 hours',
        severityImpact: 'no_change',
        description: 'Too short to react'
      },
      {
        value: '6h_to_24h',
        label: '6-24 hours',
        severityImpact: 'reduce_one_level'
      },
      {
        value: '24h_to_48h',
        label: '24-48 hours',
        severityImpact: 'reduce_one_level',
        description: 'Reasonable time to react'
      },
      {
        value: '48h_to_7d',
        label: '48 hours to 7 days',
        severityImpact: 'reduce_two_levels',
        description: 'Good protection'
      },
      {
        value: 'more_7d',
        label: 'More than 7 days',
        severityImpact: 'reduce_two_levels',
        description: 'Strong protection'
      }
    ]
  },

  governance_link: {
    id: 'governance_link',
    type: 'contract_link',
    question: 'Please link the governance contract so we can analyze the full access control flow:',
    options: [
      {
        value: 'link_github',
        label: 'Link GitHub Repository',
        description: 'We\'ll include it in the audit scope'
      },
      {
        value: 'link_deployed',
        label: 'Link Deployed Contract',
        description: 'Provide the contract address'
      },
      {
        value: 'known_protocol',
        label: 'Known Protocol',
        description: 'Select from known governance systems'
      },
      {
        value: 'skip',
        label: 'Skip - Don\'t link',
        description: 'We\'ll note governance exists but not analyze it'
      }
    ],
    knownProtocols: [
      { value: 'governor_bravo', label: 'Governor Bravo (Compound-style)' },
      { value: 'governor_oz', label: 'OpenZeppelin Governor' },
      { value: 'snapshot', label: 'Snapshot (off-chain)' },
      { value: 'custom', label: 'Custom Governance' }
    ]
  },

  // ==========================================================================
  // EXTERNAL CALLS & INTEGRATIONS
  // ==========================================================================

  external_call_context: {
    id: 'external_call_context',
    type: 'single_choice',
    question: 'We found an external call to:\n\n**Address:** `{address}`\n**Function:** `{function}`\n**In:** `{location}`\n\nWhat is this contract?',
    options: [
      {
        value: 'our_contract',
        label: 'Our Contract (link it)',
        description: 'This is part of your protocol',
        severityImpact: 'depends_on_link',
        followUp: ['link_our_contract']
      },
      {
        value: 'known_safe',
        label: 'Known Safe Protocol',
        description: 'Well-audited protocol (Uniswap, Aave, etc.)',
        severityImpact: 'reduce_one_level',
        followUp: ['known_protocol_selection']
      },
      {
        value: 'audited_third_party',
        label: 'Audited Third-Party',
        description: 'Third-party but has public audits',
        severityImpact: 'no_change'
      },
      {
        value: 'unaudited',
        label: 'Unaudited/Unknown',
        description: 'We\'ll flag this as external dependency risk',
        severityImpact: 'increase_one_level'
      }
    ]
  },

  known_protocol_selection: {
    id: 'known_protocol_selection',
    type: 'single_choice',
    question: 'Which known protocol is this?',
    options: [
      // DEXes
      { value: 'uniswap_v2', label: 'Uniswap V2', category: 'DEX' },
      { value: 'uniswap_v3', label: 'Uniswap V3', category: 'DEX' },
      { value: 'sushiswap', label: 'SushiSwap', category: 'DEX' },
      { value: 'curve', label: 'Curve Finance', category: 'DEX' },
      { value: 'balancer', label: 'Balancer', category: 'DEX' },
      // Lending
      { value: 'aave_v2', label: 'Aave V2', category: 'Lending' },
      { value: 'aave_v3', label: 'Aave V3', category: 'Lending' },
      { value: 'compound_v2', label: 'Compound V2', category: 'Lending' },
      { value: 'compound_v3', label: 'Compound V3', category: 'Lending' },
      // Oracles
      { value: 'chainlink', label: 'Chainlink', category: 'Oracle' },
      { value: 'uniswap_twap', label: 'Uniswap TWAP', category: 'Oracle' },
      // Other
      { value: 'openzeppelin', label: 'OpenZeppelin Contracts', category: 'Library' },
      { value: 'other', label: 'Other (specify)', category: 'Other' }
    ]
  },

  // ==========================================================================
  // UPGRADES
  // ==========================================================================

  upgrade_mechanism: {
    id: 'upgrade_mechanism',
    type: 'multi_choice',
    question: 'This contract appears to be upgradeable. What safeguards are in place?',
    options: [
      {
        value: 'multisig_upgrade',
        label: 'Multisig Required',
        description: 'Upgrades require multisig approval'
      },
      {
        value: 'timelock_upgrade',
        label: 'Timelock Delay',
        description: 'Upgrades have a waiting period'
      },
      {
        value: 'governance_upgrade',
        label: 'Governance Vote',
        description: 'Token holders must approve upgrades'
      },
      {
        value: 'security_council',
        label: 'Security Council',
        description: 'Separate security team can veto'
      },
      {
        value: 'two_step',
        label: 'Two-Step Process',
        description: 'Propose then execute after delay'
      },
      {
        value: 'none',
        label: 'No Safeguards',
        description: 'Single key can upgrade immediately'
      }
    ],
    severityRules: {
      calculate: (answers) => {
        if (answers.includes('none')) return 'critical';
        if (answers.length >= 3) return 'low';
        if (answers.length >= 2) return 'medium';
        return 'high';
      }
    }
  },

  // ==========================================================================
  // BUSINESS LOGIC
  // ==========================================================================

  fee_configuration: {
    id: 'fee_configuration',
    type: 'form',
    question: 'We found configurable fees. Please provide expected ranges:',
    context: 'This helps us identify if fee settings could be malicious',
    fields: [
      {
        name: 'expected_min_fee',
        type: 'text',
        label: 'Expected minimum fee',
        placeholder: '0.1%'
      },
      {
        name: 'expected_max_fee',
        type: 'text',
        label: 'Expected maximum fee',
        placeholder: '5%'
      },
      {
        name: 'hard_cap_exists',
        type: 'boolean',
        label: 'Is there a hard cap in the code?'
      }
    ]
  },

  pause_mechanism: {
    id: 'pause_mechanism',
    type: 'single_choice',
    question: 'This contract has a pause function. Who should be able to pause?',
    options: [
      {
        value: 'multisig_only',
        label: 'Multisig Only',
        description: 'Only the admin multisig'
      },
      {
        value: 'security_council',
        label: 'Security Council',
        description: 'Dedicated security responders'
      },
      {
        value: 'anyone_guardian',
        label: 'Guardian Role',
        description: 'Special guardian address for emergencies'
      },
      {
        value: 'eoa_ok',
        label: 'EOA is OK',
        description: 'Speed matters more than decentralization'
      }
    ]
  }
};

// Severity adjustment rules
export const SEVERITY_ADJUSTMENTS = {
  reduce_one_level: (current: string) => {
    const levels = ['info', 'low', 'medium', 'high', 'critical'];
    const idx = levels.indexOf(current);
    return idx > 0 ? levels[idx - 1] : current;
  },

  reduce_two_levels: (current: string) => {
    const levels = ['info', 'low', 'medium', 'high', 'critical'];
    const idx = levels.indexOf(current);
    return idx > 1 ? levels[idx - 2] : (idx > 0 ? levels[idx - 1] : current);
  },

  increase_one_level: (current: string) => {
    const levels = ['info', 'low', 'medium', 'high', 'critical'];
    const idx = levels.indexOf(current);
    return idx < levels.length - 1 ? levels[idx + 1] : current;
  },

  remove_finding: () => null, // Finding should be removed

  no_change: (current: string) => current
};
```

---

## 3. Interactive Orchestrator

```typescript
// src/sops/orchestrator/interactiveOrchestrator.ts

import { EventEmitter } from 'events';
import type {
  SOPDefinition,
  StepDefinition,
  StepContext,
  StepResult,
  StepFinding
} from '../definitions/types';
import { PROMPT_TEMPLATES, SEVERITY_ADJUSTMENTS } from '../../services/promptTemplates';

interface AuditSessionContext {
  sessionId: string;
  jobId: string;
  userId: string;
  linkedProjects: LinkedProject[];
  knownAddresses: KnownAddress[];
  userAnswers: Map<string, UserAnswer>;
  pendingPrompts: AuditPrompt[];
}

interface AuditPrompt {
  id: string;
  templateId: string;
  stepId: string;
  variables: Record<string, string>;
  context: {
    code?: string;
    file?: string;
    line?: number;
    finding?: StepFinding;
  };
  status: 'pending' | 'answered' | 'skipped' | 'timed_out';
  answer?: any;
  createdAt: Date;
  timeoutAt: Date;
}

export class InteractiveAuditOrchestrator extends EventEmitter {
  private session: AuditSessionContext;
  private isPaused: boolean = false;
  private resumeResolver: (() => void) | null = null;

  constructor(session: AuditSessionContext) {
    super();
    this.session = session;
  }

  /**
   * Execute a step with interactive prompt support
   */
  async executeStep(
    step: StepDefinition,
    context: StepContext
  ): Promise<StepResult> {
    // Run the actual step
    const result = await this.runStepExecutor(step, context);

    // If step produced findings, check if any need user context
    if (result.findings && result.findings.length > 0) {
      for (const finding of result.findings) {
        // Check if this finding has addresses we should ask about
        const addresses = this.extractAddresses(finding);

        for (const address of addresses) {
          // Skip if we already have context for this address
          if (this.session.knownAddresses.find(a =>
            a.address.toLowerCase() === address.toLowerCase()
          )) {
            continue;
          }

          // Check if we already asked about this address
          const existingAnswer = this.session.userAnswers.get(`address:${address}`);
          if (existingAnswer) {
            continue;
          }

          // Create prompt for this address
          const prompt = this.createPromptForAddress(address, finding, step);
          if (prompt) {
            await this.handlePrompt(prompt);
          }
        }
      }

      // Enrich findings with user context
      result.findings = this.enrichFindings(result.findings);
    }

    return result;
  }

  /**
   * Create a prompt from a template
   */
  private createPromptForAddress(
    address: string,
    finding: StepFinding,
    step: StepDefinition
  ): AuditPrompt | null {
    const template = PROMPT_TEMPLATES.admin_address_type;

    return {
      id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      templateId: 'admin_address_type',
      stepId: step.id,
      variables: {
        address: address,
        functions: finding.description
      },
      context: {
        finding,
        file: finding.location?.file,
        line: finding.location?.line
      },
      status: 'pending',
      createdAt: new Date(),
      timeoutAt: new Date(Date.now() + (template.timeoutSeconds || 300) * 1000)
    };
  }

  /**
   * Handle a prompt - pause execution and wait for user input
   */
  private async handlePrompt(prompt: AuditPrompt): Promise<void> {
    // Add to pending prompts
    this.session.pendingPrompts.push(prompt);

    // Emit event for UI
    this.emit('prompt_required', {
      promptId: prompt.id,
      template: PROMPT_TEMPLATES[prompt.templateId],
      variables: prompt.variables,
      context: prompt.context,
      timeoutAt: prompt.timeoutAt
    });

    // Store prompt in database
    await this.savePromptToDb(prompt);

    // Update session status
    this.isPaused = true;
    this.emit('session_paused', { promptId: prompt.id });

    // Wait for answer or timeout
    await this.waitForAnswer(prompt);
  }

  /**
   * Wait for user answer or timeout
   */
  private waitForAnswer(prompt: AuditPrompt): Promise<void> {
    return new Promise((resolve) => {
      const timeoutMs = prompt.timeoutAt.getTime() - Date.now();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (prompt.status === 'pending') {
          prompt.status = 'timed_out';
          prompt.answer = PROMPT_TEMPLATES[prompt.templateId].defaultValue;
          this.emit('prompt_timeout', { promptId: prompt.id });
          resolve();
        }
      }, timeoutMs);

      // Store resolver for external answer submission
      this.resumeResolver = () => {
        clearTimeout(timeoutId);
        resolve();
      };
    });
  }

  /**
   * Called when user submits an answer
   */
  async submitAnswer(promptId: string, answer: any, applyToSimilar: boolean = true): Promise<void> {
    const prompt = this.session.pendingPrompts.find(p => p.id === promptId);
    if (!prompt || prompt.status !== 'pending') {
      throw new Error('Invalid or already answered prompt');
    }

    prompt.status = 'answered';
    prompt.answer = answer;

    // Store answer
    const userAnswer: UserAnswer = {
      promptId,
      answer,
      applyToSimilar,
      timestamp: new Date()
    };

    // If this was an address question, store in known addresses
    if (prompt.templateId === 'admin_address_type') {
      const address = prompt.variables.address;
      this.session.userAnswers.set(`address:${address}`, userAnswer);

      // Add to known addresses
      this.session.knownAddresses.push({
        address,
        chain: 'ethereum', // TODO: detect chain
        label: this.getLabelForType(answer.value),
        addressType: answer.value,
        metadata: answer.metadata || {}
      });
    }

    // Save to database
    await this.saveAnswerToDb(userAnswer);

    // Resume execution
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
    }
  }

  /**
   * Enrich findings with user-provided context
   */
  private enrichFindings(findings: StepFinding[]): StepFinding[] {
    return findings.map(finding => {
      const enriched = { ...finding };

      // Check if any known addresses are in this finding
      const addresses = this.extractAddresses(finding);

      for (const address of addresses) {
        const knownAddress = this.session.knownAddresses.find(
          a => a.address.toLowerCase() === address.toLowerCase()
        );

        if (knownAddress) {
          enriched.userContext = {
            addressType: knownAddress.addressType,
            addressLabel: knownAddress.label,
            metadata: knownAddress.metadata
          };

          // Adjust severity based on address type
          const template = PROMPT_TEMPLATES.admin_address_type;
          const option = template.options.find(o => o.value === knownAddress.addressType);

          if (option?.severityImpact) {
            const adjuster = SEVERITY_ADJUSTMENTS[option.severityImpact];
            if (adjuster) {
              const newSeverity = adjuster(finding.severity);
              if (newSeverity !== finding.severity) {
                enriched.originalSeverity = finding.severity;
                enriched.severity = newSeverity;
                enriched.severityAdjustmentReason =
                  `Adjusted from ${finding.severity} to ${newSeverity} because address is ${knownAddress.label}`;
              }
            }
          }
        }
      }

      return enriched;
    });
  }

  /**
   * Extract addresses from a finding
   */
  private extractAddresses(finding: StepFinding): string[] {
    const addresses: string[] = [];
    const addressRegex = /0x[a-fA-F0-9]{40}/g;

    // Check title and description
    const text = `${finding.title} ${finding.description} ${finding.recommendation || ''}`;
    const matches = text.match(addressRegex);

    if (matches) {
      addresses.push(...matches);
    }

    // Check if finding has explicit related addresses
    if (finding.relatedAddresses) {
      addresses.push(...finding.relatedAddresses);
    }

    return [...new Set(addresses)]; // Dedupe
  }

  private getLabelForType(type: string): string {
    const labels: Record<string, string> = {
      'eoa': 'EOA (Single Key)',
      'multisig': 'Multisig Wallet',
      'timelock': 'Timelock Contract',
      'governance': 'Governance Contract',
      'renounced': 'Renounced',
      'unknown': 'Unknown'
    };
    return labels[type] || type;
  }

  // Database methods (implement these)
  private async savePromptToDb(prompt: AuditPrompt): Promise<void> { /* ... */ }
  private async saveAnswerToDb(answer: UserAnswer): Promise<void> { /* ... */ }
  private async runStepExecutor(step: StepDefinition, context: StepContext): Promise<StepResult> { /* ... */ }
}
```

---

## 4. UI Components Needed

### 4.1 Audit Configuration Wizard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         START NEW AUDIT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1 OF 4: SELECT SOURCE                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                           │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   GitHub Repo   │  │    Deployed     │  │   File Upload   │              │
│  │   ┌───────┐     │  │    Contract     │  │   ┌───────┐     │              │
│  │   │  🐙   │     │  │   ┌───────┐     │  │   │  📁   │     │              │
│  │   └───────┘     │  │   │  📋   │     │  │   └───────┘     │              │
│  │   Selected ✓    │  │   └───────┘     │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  Repository URL:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ https://github.com/org/protocol-v2                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Branch: [ main ▼ ]                                                          │
│                                                                              │
│                                                           [Next →]           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         START NEW AUDIT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 2 OF 4: AUDIT DEPTH                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ○ QUICK (8-15 minutes)                                              │    │
│  │    Basic compilation, static analysis, quick AI review               │    │
│  │    Best for: Initial checks, pre-deployment sanity tests             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ◉ STANDARD (30-60 minutes)                                 ★ Popular │    │
│  │    Full static analysis, AST parsing, comprehensive AI analysis      │    │
│  │    Best for: Pre-audit prep, medium-risk contracts                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ○ DEEP (2-4 hours)                                                  │    │
│  │    Everything in Standard + symbolic execution + formal verification │    │
│  │    Best for: High-value protocols, production deployments            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ☑ Enable interactive mode (pause for questions during audit)               │
│                                                                              │
│                                              [← Back]  [Next →]              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         START NEW AUDIT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 3 OF 4: LINKED PROJECTS (Optional)                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                           │
│                                                                              │
│  Add related contracts for complete context analysis                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  LINKED PROJECTS                                                     │    │
│  │                                                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │ 🏛️ Governance.sol                                              │ │    │
│  │  │    github.com/org/governance                                   │ │    │
│  │  │    Relationship: Admin Contract                                │ │    │
│  │  │    [Edit] [Remove]                                             │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  │                                                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │ ⏱️ Timelock.sol                                                 │ │    │
│  │  │    0x1234...5678 (Ethereum Mainnet)                            │ │    │
│  │  │    Relationship: Timelock                                       │ │    │
│  │  │    [Edit] [Remove]                                             │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  │                                                                      │    │
│  │  [+ Add Admin Contract]  [+ Add Dependency]  [+ Add Integration]    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  KNOWN ADDRESSES                                                     │    │
│  │                                                                      │    │
│  │  Pre-label addresses to provide context during analysis              │    │
│  │                                                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │ 0x742d35...C0532  │  Treasury Multisig  │  3/5 Gnosis Safe     │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │ 0x1234ab...5678  │  Team Timelock      │  48h delay            │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  │                                                                      │    │
│  │  [+ Add Address]                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                                              [← Back]  [Next →]              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         START NEW AUDIT                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 4 OF 4: NOTIFICATIONS                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                           │
│                                                                              │
│  How should we notify you?                                                   │
│                                                                              │
│  Email: user@example.com                                                     │
│                                                                              │
│  ☑ Email me when audit completes                                            │
│  ☑ Email me when input is needed                                            │
│  ☑ Email me if critical vulnerabilities are found                           │
│  ☐ Send daily progress digest                                               │
│                                                                              │
│  Auto-continue settings:                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  When a question times out:                                          │    │
│  │  ◉ Continue with safe defaults (assume worst case)                   │    │
│  │  ○ Pause indefinitely (wait for my answer)                           │    │
│  │                                                                      │    │
│  │  Question timeout: [ 5 minutes ▼ ]                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                                                                              │
│                                              [← Back]  [Start Audit →]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Interactive Prompt Modal (During Audit)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUDIT IN PROGRESS                                  │
│                                                                              │
│  ████████████████████░░░░░░░░░░░░░░░  52%                                   │
│  Step 19/35: AI Admin Function Analysis                                      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ⚠️  INPUT NEEDED                                        ⏱️ Auto-continue: 4:32 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  We identified an admin address that controls critical functions:    │    │
│  │                                                                      │    │
│  │  Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e                │    │
│  │  Controls: setFee(), pause(), upgrade()                              │    │
│  │                                                                      │    │
│  │  ┌────────────────────────────────────────────────────────────────┐ │    │
│  │  │  function setFee(uint256 _newFee) external onlyAdmin {         │ │    │
│  │  │      require(_newFee <= MAX_FEE, "Fee too high");              │ │    │
│  │  │      fee = _newFee;                                            │ │    │
│  │  │      emit FeeUpdated(_newFee);                                 │ │    │
│  │  │  }                                                             │ │    │
│  │  │                                            Protocol.sol:142    │ │    │
│  │  └────────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  What type of address is 0x742d35...f44e?                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ○ EOA (Single Private Key)                                          │    │
│  │    One person/key controls this address                              │    │
│  │    ⚠️ High centralization risk                                        │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ◉ Multisig Wallet                                                   │    │
│  │    Multiple signatures required for transactions                     │    │
│  │    ✓ Reduces centralization risk                                     │    │
│  │                                                                      │    │
│  │    ┌──────────────────────────────────────────────────────────────┐│    │
│  │    │ Required signatures: [3    ]  Total signers: [5    ]         ││    │
│  │    │ Wallet type: [ Gnosis Safe          ▼ ]                      ││    │
│  │    │ Signer diversity: [ Mix of team and external    ▼ ]          ││    │
│  │    └──────────────────────────────────────────────────────────────┘│    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ○ Timelock Contract                                                 │    │
│  │    Actions have a delay before execution                             │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ○ Governance Contract                                               │    │
│  │    Token holders vote on actions                                     │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ○ Renounced/Burned                                                  │    │
│  │    No one can use this admin function anymore                        │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  ○ I don't know                                                      │    │
│  │    We'll assume worst case (single key)                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ☑ Apply this answer to similar findings in this audit                      │
│                                                                              │
│  ┌──────────────────┐                            ┌────────────────────┐     │
│  │ Skip (use default) │                            │   Submit Answer   │     │
│  └──────────────────┘                            └────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Finding with Context Applied

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔶 MEDIUM - Privileged Admin Control                                        │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📉 SEVERITY ADJUSTED                                                │    │
│  │                                                                      │    │
│  │  Original: HIGH  →  Adjusted: MEDIUM                                 │    │
│  │                                                                      │    │
│  │  Reason: Admin address confirmed as 3/5 Gnosis Safe multisig        │    │
│  │          with mixed team and external signers                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  The admin address 0x742d35...f44e has privileged access to:                │
│  • setFee() - Can modify protocol fees                                       │
│  • pause() - Can pause all protocol operations                               │
│  • upgrade() - Can upgrade contract implementation                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  👤 USER-PROVIDED CONTEXT                                            │    │
│  │                                                                      │    │
│  │  Address Type: Gnosis Safe Multisig                                  │    │
│  │  Configuration: 3 of 5 signatures required                           │    │
│  │  Signer Diversity: Mix of team and external signers                  │    │
│  │                                                                      │    │
│  │  This reduces (but does not eliminate) centralization risk.          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  📍 Location: contracts/core/Protocol.sol:142-156                            │
│                                                                              │
│  💡 Recommendation:                                                          │
│  Consider adding a timelock delay for setFee() and upgrade() to give        │
│  users time to react to changes. The pause() function appropriately         │
│  requires quick action and may not need a timelock.                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🔗 RELATED IN LINKED PROJECTS                                       │    │
│  │                                                                      │    │
│  │  Governance.sol - executeProposal() calls Protocol.setFee()          │    │
│  │  Timelock.sol - Queued transactions can call Protocol.upgrade()      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  [Acknowledge] [Dispute] [Mark as Won't Fix]                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. API Endpoints

```typescript
// New endpoints for interactive audit system

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// Start audit with full configuration
POST /api/audit/start
{
  source: {
    type: 'github-repo',
    repoUrl: 'https://github.com/org/protocol',
    branch: 'main'
  },
  depth: 'standard',
  config: {
    interactiveMode: true,
    autoContinueTimeoutSeconds: 300,
    notifications: {
      email: 'user@example.com',
      onCompletion: true,
      onInputNeeded: true,
      onCriticalFinding: true
    },
    linkedProjects: [
      {
        name: 'Governance',
        sourceType: 'github-repo',
        sourceConfig: { repoUrl: 'https://github.com/org/governance' },
        relationship: 'admin'
      }
    ],
    knownAddresses: [
      {
        address: '0x742d35...',
        chain: 'ethereum',
        label: 'Treasury Multisig',
        addressType: 'multisig',
        metadata: { signers: 5, threshold: 3, walletType: 'gnosis_safe' }
      }
    ]
  }
}

// Response
{
  success: true,
  jobId: 'uuid',
  sessionId: 'uuid',
  estimatedDuration: 2400, // seconds
  totalSteps: 32
}

// ============================================================================
// INTERACTIVE PROMPTS
// ============================================================================

// Get current session state (including pending prompts)
GET /api/audit/:jobId/session
{
  sessionId: 'uuid',
  status: 'paused_for_input',
  progress: {
    currentStep: 19,
    totalSteps: 32,
    percent: 52,
    stepName: 'AI Admin Function Analysis'
  },
  currentPrompt: {
    id: 'prompt-123',
    templateId: 'admin_address_type',
    question: 'What type of address is 0x742d35...?',
    context: {
      code: 'function setFee(uint256 _newFee) external onlyAdmin { ... }',
      file: 'Protocol.sol',
      line: 142
    },
    options: [...],
    timeoutAt: '2024-01-15T10:30:00Z',
    timeoutRemaining: 272 // seconds
  },
  linkedProjects: [...],
  knownAddresses: [...],
  userAnswers: [...]
}

// Submit answer to prompt
POST /api/audit/:jobId/prompt/:promptId/answer
{
  answer: {
    value: 'multisig',
    metadata: {
      threshold: 3,
      total_signers: 5,
      wallet_type: 'gnosis_safe',
      signer_diversity: 'mixed'
    }
  },
  applyToSimilar: true
}

// Skip prompt (use default)
POST /api/audit/:jobId/prompt/:promptId/skip
{
  useDefault: true,
  reason: 'Will verify later' // optional
}

// ============================================================================
// LINKED PROJECTS (can add mid-audit)
// ============================================================================

// Add linked project during audit
POST /api/audit/:jobId/linked-projects
{
  name: 'Timelock Contract',
  sourceType: 'deployed-contract',
  sourceConfig: {
    address: '0x1234...',
    chain: 'ethereum'
  },
  relationship: 'timelock',
  relevantContracts: ['Timelock.sol']
}

// Get linked project details
GET /api/audit/:jobId/linked-projects/:projectId

// ============================================================================
// KNOWN ADDRESSES (can add mid-audit)
// ============================================================================

// Add known address during audit
POST /api/audit/:jobId/known-addresses
{
  address: '0x5678...',
  chain: 'ethereum',
  label: 'Protocol Timelock',
  addressType: 'timelock',
  metadata: {
    delaySeconds: 172800 // 48 hours
  }
}

// Get all known addresses
GET /api/audit/:jobId/known-addresses

// ============================================================================
// FINDINGS WITH CONTEXT
// ============================================================================

// Get findings with user context applied
GET /api/audit/:jobId/findings
{
  findings: [
    {
      id: 'finding-123',
      originalSeverity: 'high',
      adjustedSeverity: 'medium',
      severityAdjustmentReason: 'Admin confirmed as 3/5 multisig',
      title: 'Privileged Admin Control',
      description: '...',
      userContext: {
        addressType: 'multisig',
        addressLabel: 'Treasury Multisig',
        metadata: { signers: 5, threshold: 3 }
      },
      crossReferences: [
        {
          type: 'linked_project',
          projectName: 'Governance',
          relationship: 'Governance can call setFee()'
        }
      ],
      status: 'new'
    }
  ],
  summary: {
    total: 15,
    bySeverity: { critical: 0, high: 2, medium: 5, low: 6, info: 2 },
    adjusted: 3, // 3 findings had severity adjusted based on user context
    withContext: 8 // 8 findings have user-provided context
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// Get user notifications
GET /api/notifications
{
  notifications: [
    {
      id: 'notif-123',
      type: 'input_needed',
      title: 'Input needed for Protocol audit',
      message: 'We need information about an admin address',
      jobId: 'uuid',
      promptId: 'prompt-123',
      read: false,
      createdAt: '2024-01-15T10:25:00Z'
    }
  ],
  unreadCount: 3
}

// Mark notification as read
POST /api/notifications/:id/read
```

---

## 6. Implementation Priority

### Phase 1: Core Interactive System (P0)
1. Database schema additions (audit_sessions, prompts, answers, findings)
2. InteractiveOrchestrator with pause/resume
3. Prompt templates for admin address analysis
4. Basic API endpoints for prompt submission
5. WebSocket/SSE for real-time prompt delivery

### Phase 2: Multi-Project Context (P0)
1. Linked projects database and API
2. Known addresses database and API
3. Finding enrichment engine
4. Severity adjustment logic
5. Cross-reference detection

### Phase 3: UI Components (P1)
1. Audit configuration wizard (4-step)
2. Interactive prompt modal
3. Finding cards with context display
4. Linked projects panel
5. Known addresses panel

### Phase 4: Notifications (P1)
1. Email service integration (SendGrid/Postmark)
2. Notification database and API
3. In-app notification bell/dropdown
4. Email templates for audit events

### Phase 5: Advanced Features (P2)
1. Cross-audit finding comparison
2. Finding deduplication across projects
3. Organization-level dashboards
4. Scheduled/recurring audits

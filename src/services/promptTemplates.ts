/**
 * Prompt Templates for Interactive Audits
 *
 * Standardized questions asked during audit execution to gather
 * context about admin addresses, access control, and integrations.
 */

import type { PromptType, AddressType } from '../db/schema.js';

// ============================================================================
// Types
// ============================================================================

export interface PromptOption {
  value: string;
  label: string;
  description?: string;
  severityImpact?: SeverityImpact;
  riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  followUp?: string[]; // Template IDs for follow-up questions
}

export interface FormField {
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  description?: string;
}

export interface PromptTemplate {
  id: string;
  type: PromptType;
  question: string;
  description?: string;
  options?: PromptOption[];
  fields?: FormField[]; // For 'form' type
  defaultValue?: any;
  timeoutSeconds: number;
  severityRules?: {
    calculate: (answer: any) => SeverityImpact;
  };
}

export type SeverityImpact =
  | 'no_change'
  | 'reduce_one_level'
  | 'reduce_two_levels'
  | 'increase_one_level'
  | 'remove_finding'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

// ============================================================================
// Severity Adjustment Functions
// ============================================================================

const SEVERITY_LEVELS = ['info', 'low', 'medium', 'high', 'critical'] as const;

export const SEVERITY_ADJUSTMENTS: Record<SeverityImpact, (current: string) => string | null> = {
  no_change: (current) => current,

  reduce_one_level: (current) => {
    const idx = SEVERITY_LEVELS.indexOf(current as any);
    return idx > 0 ? SEVERITY_LEVELS[idx - 1] : current;
  },

  reduce_two_levels: (current) => {
    const idx = SEVERITY_LEVELS.indexOf(current as any);
    if (idx > 1) return SEVERITY_LEVELS[idx - 2];
    if (idx > 0) return SEVERITY_LEVELS[idx - 1];
    return current;
  },

  increase_one_level: (current) => {
    const idx = SEVERITY_LEVELS.indexOf(current as any);
    return idx < SEVERITY_LEVELS.length - 1 ? SEVERITY_LEVELS[idx + 1] : current;
  },

  remove_finding: () => null, // Signal to remove the finding entirely

  // Direct severity assignments
  critical: () => 'critical',
  high: () => 'high',
  medium: () => 'medium',
  low: () => 'low',
  info: () => 'info',
};

/**
 * Apply severity adjustment to a finding
 */
export function adjustSeverity(
  currentSeverity: string,
  impact: SeverityImpact
): { newSeverity: string | null; reason: string } {
  const adjuster = SEVERITY_ADJUSTMENTS[impact];
  const newSeverity = adjuster(currentSeverity);

  let reason = '';
  if (newSeverity === null) {
    reason = 'Finding removed based on user context';
  } else if (newSeverity !== currentSeverity) {
    reason = `Severity adjusted from ${currentSeverity} to ${newSeverity}`;
  }

  return { newSeverity, reason };
}

// ============================================================================
// Prompt Templates
// ============================================================================

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  // ==========================================================================
  // ADMIN & ACCESS CONTROL
  // ==========================================================================

  admin_address_type: {
    id: 'admin_address_type',
    type: 'single_choice',
    question:
      'We identified an admin address that controls critical functions:\n\n' +
      '**Address:** `{address}`\n' +
      '**Controls:** {functions}\n\n' +
      'What type of address is this?',
    description: 'This helps us accurately assess centralization risk',
    options: [
      {
        value: 'eoa',
        label: 'EOA (Single Private Key)',
        description: 'One person/key controls this address',
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
      {
        value: 'multisig',
        label: 'Multisig Wallet',
        description: 'Multiple signatures required for transactions',
        severityImpact: 'reduce_one_level',
        riskLevel: 'medium',
        followUp: ['multisig_details'],
      },
      {
        value: 'timelock',
        label: 'Timelock Contract',
        description: 'Actions have a delay before execution',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
        followUp: ['timelock_duration'],
      },
      {
        value: 'governance',
        label: 'Governance Contract',
        description: 'Token holders vote on actions',
        severityImpact: 'reduce_two_levels',
        riskLevel: 'low',
        followUp: ['governance_details'],
      },
      {
        value: 'renounced',
        label: 'Renounced/Burned',
        description: 'No one can use this admin function anymore',
        severityImpact: 'remove_finding',
        riskLevel: 'none',
      },
      {
        value: 'unknown',
        label: "I don't know",
        description: "We'll assume worst case (single key)",
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
    ],
    defaultValue: 'unknown',
    timeoutSeconds: 300,
  },

  multisig_details: {
    id: 'multisig_details',
    type: 'form',
    question: 'Please provide multisig details:',
    description: 'More signers with higher threshold = lower risk',
    fields: [
      {
        name: 'threshold',
        type: 'number',
        label: 'Required signatures',
        placeholder: '3',
        required: true,
      },
      {
        name: 'total_signers',
        type: 'number',
        label: 'Total signers',
        placeholder: '5',
        required: true,
      },
      {
        name: 'wallet_type',
        type: 'select',
        label: 'Wallet type',
        options: [
          { value: 'gnosis_safe', label: 'Gnosis Safe' },
          { value: 'gnosis_safe_legacy', label: 'Gnosis Safe (Legacy)' },
          { value: 'multisig_wallet', label: 'ConsenSys Multisig' },
          { value: 'other', label: 'Other Multisig' },
        ],
        required: true,
      },
      {
        name: 'signer_diversity',
        type: 'select',
        label: 'Signer diversity',
        options: [
          { value: 'same_entity', label: 'All signers are same entity/team' },
          { value: 'mixed', label: 'Mix of team and external signers' },
          { value: 'fully_distributed', label: 'Fully distributed (different entities)' },
        ],
        description: 'This affects how we assess centralization risk',
      },
    ],
    defaultValue: { threshold: 1, total_signers: 1, wallet_type: 'other', signer_diversity: 'same_entity' },
    timeoutSeconds: 300,
    severityRules: {
      calculate: (answer: any) => {
        const threshold = answer.threshold || 1;
        const total = answer.total_signers || 1;
        const diversity = answer.signer_diversity || 'same_entity';

        const ratio = threshold / total;

        // Strong multisig: 3/5+ with external signers
        if (ratio >= 0.6 && diversity !== 'same_entity' && total >= 3) {
          return 'reduce_two_levels';
        }

        // Decent multisig: 2/3+ or any with some external
        if (ratio >= 0.5 && total >= 2) {
          return 'reduce_one_level';
        }

        // Weak multisig (1/1 or 1/2): no reduction
        return 'no_change';
      },
    },
  },

  timelock_duration: {
    id: 'timelock_duration',
    type: 'single_choice',
    question: 'What is the timelock delay?',
    description: 'Longer delays give users more time to react to malicious proposals',
    options: [
      {
        value: 'instant',
        label: 'No delay (0)',
        description: 'Timelock exists but delay is 0',
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
      {
        value: 'less_6h',
        label: 'Less than 6 hours',
        description: 'Too short to react meaningfully',
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
      {
        value: '6h_to_24h',
        label: '6-24 hours',
        description: 'Minimal reaction time',
        severityImpact: 'reduce_one_level',
        riskLevel: 'medium',
      },
      {
        value: '24h_to_48h',
        label: '24-48 hours',
        description: 'Reasonable time to react',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
      },
      {
        value: '48h_to_7d',
        label: '48 hours to 7 days',
        description: 'Good protection for users',
        severityImpact: 'reduce_two_levels',
        riskLevel: 'low',
      },
      {
        value: 'more_7d',
        label: 'More than 7 days',
        description: 'Strong protection',
        severityImpact: 'reduce_two_levels',
        riskLevel: 'low',
      },
    ],
    defaultValue: 'less_6h',
    timeoutSeconds: 300,
  },

  governance_details: {
    id: 'governance_details',
    type: 'form',
    question: 'Please provide governance details:',
    fields: [
      {
        name: 'governance_type',
        type: 'select',
        label: 'Governance type',
        options: [
          { value: 'governor_bravo', label: 'Governor Bravo (Compound-style)' },
          { value: 'governor_oz', label: 'OpenZeppelin Governor' },
          { value: 'snapshot', label: 'Snapshot (off-chain)' },
          { value: 'custom', label: 'Custom Governance' },
        ],
        required: true,
      },
      {
        name: 'has_timelock',
        type: 'boolean',
        label: 'Includes timelock delay?',
      },
      {
        name: 'quorum_percent',
        type: 'text',
        label: 'Quorum requirement',
        placeholder: '4%',
      },
      {
        name: 'voting_period',
        type: 'text',
        label: 'Voting period',
        placeholder: '7 days',
      },
    ],
    defaultValue: { governance_type: 'custom', has_timelock: false },
    timeoutSeconds: 300,
  },

  // ==========================================================================
  // EXTERNAL CALLS & INTEGRATIONS
  // ==========================================================================

  external_call_context: {
    id: 'external_call_context',
    type: 'single_choice',
    question:
      'We found an external call to:\n\n' +
      '**Address:** `{address}`\n' +
      '**Function:** `{function}`\n' +
      '**Location:** `{location}`\n\n' +
      'What is this contract?',
    options: [
      {
        value: 'our_contract',
        label: 'Our Contract (part of this protocol)',
        description: 'This is part of your protocol - please link it',
        severityImpact: 'no_change',
        followUp: ['link_contract'],
      },
      {
        value: 'known_safe',
        label: 'Known Safe Protocol',
        description: 'Well-audited protocol (Uniswap, Aave, Chainlink, etc.)',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
        followUp: ['known_protocol_selection'],
      },
      {
        value: 'audited_third_party',
        label: 'Audited Third-Party',
        description: 'Third-party contract with public audits',
        severityImpact: 'no_change',
        riskLevel: 'medium',
      },
      {
        value: 'unaudited',
        label: 'Unaudited/Unknown',
        description: "We'll flag this as external dependency risk",
        severityImpact: 'increase_one_level',
        riskLevel: 'high',
      },
    ],
    defaultValue: 'unaudited',
    timeoutSeconds: 300,
  },

  known_protocol_selection: {
    id: 'known_protocol_selection',
    type: 'single_choice',
    question: 'Which known protocol is this?',
    options: [
      // DEXes
      { value: 'uniswap_v2', label: 'Uniswap V2' },
      { value: 'uniswap_v3', label: 'Uniswap V3' },
      { value: 'sushiswap', label: 'SushiSwap' },
      { value: 'curve', label: 'Curve Finance' },
      { value: 'balancer', label: 'Balancer' },
      { value: 'pancakeswap', label: 'PancakeSwap' },
      // Lending
      { value: 'aave_v2', label: 'Aave V2' },
      { value: 'aave_v3', label: 'Aave V3' },
      { value: 'compound_v2', label: 'Compound V2' },
      { value: 'compound_v3', label: 'Compound V3' },
      { value: 'maker', label: 'MakerDAO' },
      // Oracles
      { value: 'chainlink', label: 'Chainlink' },
      { value: 'uniswap_twap', label: 'Uniswap TWAP Oracle' },
      { value: 'chronicle', label: 'Chronicle' },
      { value: 'pyth', label: 'Pyth Network' },
      // Libraries
      { value: 'openzeppelin', label: 'OpenZeppelin Contracts' },
      { value: 'solmate', label: 'Solmate' },
      // Other
      { value: 'other', label: 'Other (verified safe)' },
    ],
    defaultValue: 'other',
    timeoutSeconds: 180,
  },

  link_contract: {
    id: 'link_contract',
    type: 'contract_link',
    question: 'Please link this contract so we can include it in the analysis:',
    options: [
      {
        value: 'github',
        label: 'Link GitHub Repository',
        description: "We'll include it in the audit scope",
      },
      {
        value: 'deployed',
        label: 'Link Deployed Contract',
        description: 'Provide the contract address and we\'ll fetch the source',
      },
      {
        value: 'existing',
        label: 'Select Existing Project',
        description: 'Link to one of your existing projects',
      },
      {
        value: 'skip',
        label: 'Skip',
        description: "Don't link - continue without full context",
      },
    ],
    defaultValue: 'skip',
    timeoutSeconds: 300,
  },

  // ==========================================================================
  // UPGRADES
  // ==========================================================================

  upgrade_mechanism: {
    id: 'upgrade_mechanism',
    type: 'multi_choice',
    question: 'This contract appears to be upgradeable. What safeguards are in place?',
    description: 'Select all that apply',
    options: [
      {
        value: 'multisig_upgrade',
        label: 'Multisig Required',
        description: 'Upgrades require multisig approval',
      },
      {
        value: 'timelock_upgrade',
        label: 'Timelock Delay',
        description: 'Upgrades have a waiting period before taking effect',
      },
      {
        value: 'governance_upgrade',
        label: 'Governance Vote',
        description: 'Token holders must approve upgrades',
      },
      {
        value: 'security_council',
        label: 'Security Council',
        description: 'Separate security team can veto malicious upgrades',
      },
      {
        value: 'two_step',
        label: 'Two-Step Process',
        description: 'Propose, wait, then execute',
      },
      {
        value: 'none',
        label: 'No Safeguards',
        description: 'Single key can upgrade immediately',
      },
    ],
    defaultValue: ['none'],
    timeoutSeconds: 300,
    severityRules: {
      calculate: (answers: string[]) => {
        if (answers.includes('none') && answers.length === 1) {
          return 'critical';
        }
        if (answers.length >= 3) {
          return 'reduce_two_levels';
        }
        if (answers.length >= 2) {
          return 'reduce_one_level';
        }
        return 'no_change';
      },
    },
  },

  // ==========================================================================
  // ORACLE & PRICE FEEDS
  // ==========================================================================

  oracle_source: {
    id: 'oracle_source',
    type: 'single_choice',
    question:
      'We detected price/data oracle usage:\n\n' +
      '**Oracle Address:** `{address}`\n' +
      '**Used For:** {usage}\n\n' +
      'What is the oracle source?',
    options: [
      {
        value: 'chainlink',
        label: 'Chainlink Price Feed',
        description: 'Industry standard, decentralized oracle',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
      },
      {
        value: 'uniswap_twap',
        label: 'Uniswap TWAP',
        description: 'Time-weighted average price from Uniswap',
        severityImpact: 'no_change',
        riskLevel: 'medium',
      },
      {
        value: 'uniswap_spot',
        label: 'Uniswap Spot Price',
        description: 'Single-block price - vulnerable to manipulation',
        severityImpact: 'increase_one_level',
        riskLevel: 'high',
      },
      {
        value: 'centralized',
        label: 'Centralized Oracle',
        description: 'Single entity controls price data',
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
      {
        value: 'custom',
        label: 'Custom Implementation',
        description: 'Protocol-specific oracle',
        severityImpact: 'no_change',
        riskLevel: 'medium',
      },
      {
        value: 'unknown',
        label: "I don't know",
        description: 'Unable to determine oracle source',
        severityImpact: 'no_change',
        riskLevel: 'high',
      },
    ],
    defaultValue: 'unknown',
    timeoutSeconds: 300,
  },

  // ==========================================================================
  // BUSINESS LOGIC
  // ==========================================================================

  fee_configuration: {
    id: 'fee_configuration',
    type: 'form',
    question: 'We found configurable fees. Please provide expected ranges:',
    description: 'This helps us identify if fee settings could be malicious',
    fields: [
      {
        name: 'expected_min_fee',
        type: 'text',
        label: 'Expected minimum fee',
        placeholder: '0.1%',
      },
      {
        name: 'expected_max_fee',
        type: 'text',
        label: 'Expected maximum fee',
        placeholder: '5%',
      },
      {
        name: 'hard_cap_exists',
        type: 'boolean',
        label: 'Is there a hard cap in the code?',
      },
      {
        name: 'who_receives',
        type: 'text',
        label: 'Who receives fees?',
        placeholder: 'Treasury multisig',
      },
    ],
    defaultValue: {},
    timeoutSeconds: 300,
  },

  pause_mechanism: {
    id: 'pause_mechanism',
    type: 'single_choice',
    question:
      'This contract has a pause function controlled by `{address}`.\n\n' +
      'Who should be able to pause the protocol?',
    description: 'Pause functions need quick action but also have abuse potential',
    options: [
      {
        value: 'multisig_only',
        label: 'Multisig Only',
        description: 'Only the admin multisig can pause',
        severityImpact: 'no_change',
        riskLevel: 'low',
      },
      {
        value: 'security_council',
        label: 'Security Council',
        description: 'Dedicated security responders can pause',
        severityImpact: 'reduce_one_level',
        riskLevel: 'low',
      },
      {
        value: 'guardian',
        label: 'Guardian Role',
        description: 'Special guardian address for emergencies',
        severityImpact: 'no_change',
        riskLevel: 'medium',
      },
      {
        value: 'eoa_acceptable',
        label: 'EOA is Acceptable',
        description: 'Speed matters more than decentralization for pause',
        severityImpact: 'no_change',
        riskLevel: 'medium',
      },
    ],
    defaultValue: 'eoa_acceptable',
    timeoutSeconds: 300,
  },

  // ==========================================================================
  // SOLANA-SPECIFIC (Anchor)
  // ==========================================================================

  account_validation: {
    id: 'account_validation',
    type: 'single_choice',
    question:
      'We found an account that may need additional validation:\n\n' +
      '**Account:** `{account}`\n' +
      '**Usage:** {usage}\n\n' +
      'Is this account expected to be a specific type?',
    options: [
      {
        value: 'program_owned',
        label: 'Must be Program-Owned (PDA)',
        description: 'Should be derived from seeds and program ID',
        severityImpact: 'no_change',
      },
      {
        value: 'system_owned',
        label: 'Must be System-Owned',
        description: 'Regular wallet account',
        severityImpact: 'no_change',
      },
      {
        value: 'token_account',
        label: 'Must be Token Account',
        description: 'SPL Token account',
        severityImpact: 'no_change',
      },
      {
        value: 'any',
        label: 'Any Account Type is OK',
        description: 'No specific type requirement',
        severityImpact: 'no_change',
      },
    ],
    defaultValue: 'any',
    timeoutSeconds: 300,
  },

  signer_requirement: {
    id: 'signer_requirement',
    type: 'single_choice',
    question:
      'We found a function that may need signer validation:\n\n' +
      '**Function:** `{function}`\n' +
      '**Parameter:** `{parameter}`\n\n' +
      'Should this account be required to sign?',
    options: [
      {
        value: 'must_sign',
        label: 'Must be Signer',
        description: 'Critical - this account must sign the transaction',
        severityImpact: 'increase_one_level',
      },
      {
        value: 'optional_sign',
        label: 'Signing is Optional',
        description: 'Useful but not required',
        severityImpact: 'no_change',
      },
      {
        value: 'no_sign',
        label: 'Should Not Sign',
        description: 'This is a read-only account',
        severityImpact: 'no_change',
      },
    ],
    defaultValue: 'optional_sign',
    timeoutSeconds: 300,
  },

  // ==========================================================================
  // MOVE-SPECIFIC (Aptos/Sui)
  // ==========================================================================

  capability_holder: {
    id: 'capability_holder',
    type: 'single_choice',
    question:
      'We found a capability/resource that grants special permissions:\n\n' +
      '**Capability:** `{capability}`\n' +
      '**Grants:** {permissions}\n\n' +
      'Who holds this capability?',
    options: [
      {
        value: 'admin_multisig',
        label: 'Admin Multisig',
        description: 'Held by a multisig wallet',
        severityImpact: 'reduce_one_level',
      },
      {
        value: 'module_signer',
        label: 'Module Signer (Deployer)',
        description: 'Held by whoever deployed the module',
        severityImpact: 'no_change',
      },
      {
        value: 'governance',
        label: 'Governance Module',
        description: 'Controlled by on-chain governance',
        severityImpact: 'reduce_two_levels',
      },
      {
        value: 'unknown',
        label: 'Unknown/Unspecified',
        description: "We'll flag this as a risk",
        severityImpact: 'no_change',
      },
    ],
    defaultValue: 'unknown',
    timeoutSeconds: 300,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a prompt template by ID
 */
export function getPromptTemplate(templateId: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[templateId];
}

/**
 * Render a prompt question with variables substituted
 */
export function renderPromptQuestion(template: PromptTemplate, variables: Record<string, string>): string {
  let question = template.question;

  for (const [key, value] of Object.entries(variables)) {
    question = question.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return question;
}

/**
 * Get the severity impact for a given answer
 */
export function getSeverityImpactForAnswer(
  template: PromptTemplate,
  answer: any
): SeverityImpact {
  // For templates with custom calculation rules
  if (template.severityRules?.calculate) {
    return template.severityRules.calculate(answer);
  }

  // For single/multi choice, look up the option
  if (template.options) {
    if (Array.isArray(answer)) {
      // Multi-choice: use the most impactful option
      const impacts = answer
        .map((v) => template.options!.find((o) => o.value === v)?.severityImpact)
        .filter(Boolean) as SeverityImpact[];

      if (impacts.includes('remove_finding')) return 'remove_finding';
      if (impacts.includes('reduce_two_levels')) return 'reduce_two_levels';
      if (impacts.includes('reduce_one_level')) return 'reduce_one_level';
      if (impacts.includes('increase_one_level')) return 'increase_one_level';
      return 'no_change';
    } else {
      // Single choice
      const option = template.options.find((o) => o.value === answer || o.value === answer?.value);
      return option?.severityImpact || 'no_change';
    }
  }

  return 'no_change';
}

/**
 * Get follow-up template IDs for a given answer
 */
export function getFollowUpTemplates(template: PromptTemplate, answer: any): string[] {
  if (!template.options) return [];

  const value = typeof answer === 'object' ? answer.value : answer;
  const option = template.options.find((o) => o.value === value);

  return option?.followUp || [];
}

/**
 * Convert address type from prompt answer to schema enum
 */
export function answerToAddressType(answer: string): AddressType {
  const mapping: Record<string, AddressType> = {
    eoa: 'eoa',
    multisig: 'multisig',
    timelock: 'timelock',
    governance: 'governance',
    renounced: 'renounced',
    unknown: 'unknown',
  };

  return mapping[answer] || 'unknown';
}

/**
 * Get all template IDs for a specific category
 */
export function getTemplatesByCategory(category: 'access_control' | 'external' | 'upgrade' | 'oracle' | 'business' | 'solana' | 'move'): string[] {
  const categories: Record<string, string[]> = {
    access_control: ['admin_address_type', 'multisig_details', 'timelock_duration', 'governance_details'],
    external: ['external_call_context', 'known_protocol_selection', 'link_contract'],
    upgrade: ['upgrade_mechanism'],
    oracle: ['oracle_source'],
    business: ['fee_configuration', 'pause_mechanism'],
    solana: ['account_validation', 'signer_requirement'],
    move: ['capability_holder'],
  };

  return categories[category] || [];
}

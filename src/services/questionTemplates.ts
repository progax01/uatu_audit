/**
 * Question Templates Service
 *
 * Provides contract-type specific pre-audit questionnaire templates.
 * Questions are categorized by contract type (ERC20, NFT, DeFi, etc.)
 * and priority (HIGH = required, MEDIUM/LOW = optional).
 *
 * Supports dynamic questions based on code analysis context.
 */

import type { ContractCategory } from '../db/schema.js';
import type { CodeAnalysisContext } from './codeAnalysisContext.js';

// ============================================================================
// Types
// ============================================================================

export type QuestionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'confirm';

export interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
}

export interface PreAuditQuestion {
  key: string;
  text: string | ((context: CodeAnalysisContext) => string); // Support dynamic text
  type: QuestionType;
  options?: string[] | QuestionOption[] | ((context: CodeAnalysisContext) => (string[] | QuestionOption[]));
  priority: QuestionPriority;
  category: string;
  helpText?: string;
  defaultValue?: any;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  // Conditional rendering based on code analysis
  condition?: (context: CodeAnalysisContext) => boolean;
}

export interface QuestionTemplate {
  category: ContractCategory;
  questions: PreAuditQuestion[];
}

// ============================================================================
// Generic Questions (All Contract Types)
// ============================================================================

const GENERIC_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'project_description',
    text: 'Briefly describe the purpose of this smart contract',
    type: 'textarea',
    priority: 'HIGH',
    category: 'general',
    helpText: 'Provide a high-level overview of what the contract does and its main functionality',
    validation: {
      required: true,
      minLength: 20,
      maxLength: 500,
    },
  },
  {
    key: 'deployment_networks',
    text: 'Which blockchain networks will this contract be deployed on?',
    type: 'multiselect',
    options: [
      { value: 'ethereum-mainnet', label: 'Ethereum Mainnet', icon: 'ethereum' },
      { value: 'polygon', label: 'Polygon', icon: 'polygon' },
      { value: 'arbitrum', label: 'Arbitrum', icon: 'arbitrum' },
      { value: 'optimism', label: 'Optimism', icon: 'optimism' },
      { value: 'base', label: 'Base', icon: 'base' },
      { value: 'bsc', label: 'BSC', icon: 'binance' },
      { value: 'avalanche', label: 'Avalanche', icon: 'avalanche' },
      { value: 'solana', label: 'Solana', icon: 'solana' },
      { value: 'stellar', label: 'Stellar', icon: 'stellar' },
      { value: 'other', label: 'Other' }
    ],
    priority: 'HIGH',
    category: 'general',
    helpText: 'Select all networks where you plan to deploy. Different chains have different security considerations (block times, gas costs, cross-chain risks).',
  },
  {
    key: 'external_dependencies',
    text: 'Does this contract integrate with external protocols or oracles?',
    type: 'multiselect',
    options: [
      'Chainlink Oracles',
      'Uniswap',
      'Aave',
      'Compound',
      'Curve',
      'Pyth Network',
      'None',
      'Other'
    ],
    priority: 'MEDIUM',
    category: 'general',
  },
  {
    key: 'admin_privileges',
    text: 'Which admin controls are present in your contract?',
    type: 'multiselect',
    options: [
      'Pause/unpause functionality',
      'Upgrade contract (proxy)',
      'Change fees/parameters',
      'Mint tokens',
      'Blacklist addresses',
      'Emergency withdraw',
      'None - fully decentralized',
      'Other'
    ],
    priority: 'HIGH',
    category: 'general',
    helpText: '⚡ Transparency Matters: Disclosing admin controls upfront shows good faith. Hidden admin privileges receive higher severity ratings than disclosed ones. Admin controls are common in early-stage contracts — what matters is that they\'re clearly documented and protected by timelocks or multisig.',
  },
  {
    key: 'timelock_protection',
    text: 'Are admin actions protected by a timelock?',
    type: 'select',
    options: ['Yes (timelock delay specified)', 'No', 'Not applicable'],
    priority: 'HIGH',
    category: 'general',
  },
];

// ============================================================================
// ERC20 Token Questions
// ============================================================================

const ERC20_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'token_supply_cap',
    text: 'Is the token supply capped or can new tokens be minted indefinitely?',
    type: 'select',
    options: ['Capped (fixed supply)', 'Mintable by owner', 'Mintable by anyone', 'Unlimited/Uncapped'],
    priority: 'HIGH',
    category: 'token-economics',
    helpText: 'Fixed supply means no new tokens can be created after deployment',
  },
  {
    key: 'token_max_supply',
    text: 'If capped, what is the maximum token supply?',
    type: 'text',
    priority: 'MEDIUM',
    category: 'token-economics',
    helpText: 'Leave blank if uncapped',
  },
  {
    key: 'token_minting_restrictions',
    text: 'Who can mint new tokens?',
    type: 'select',
    options: ['No minting (fixed supply)', 'Only owner', 'Specific role (e.g., MINTER_ROLE)', 'Anyone', 'Automated (vesting/rewards)'],
    priority: 'HIGH',
    category: 'token-economics',
  },
  {
    key: 'token_burning',
    text: 'Can tokens be burned?',
    type: 'select',
    options: ['Yes - by holders only', 'Yes - by owner only', 'Yes - by both', 'No burning allowed'],
    priority: 'MEDIUM',
    category: 'token-economics',
  },
  {
    key: 'token_transfer_restrictions',
    text: 'Are there any restrictions on token transfers?',
    type: 'multiselect',
    options: [
      'Transfer tax/fee',
      'Blacklist/whitelist',
      'Pausable transfers',
      'Timelock/vesting',
      'Max transaction amount',
      'Cooldown period',
      'None'
    ],
    priority: 'HIGH',
    category: 'token-economics',
  },
  {
    key: 'token_transfer_fee',
    text: 'Is there a transfer fee or tax?',
    type: 'select',
    options: ['No', 'Yes - fixed percentage', 'Yes - variable (owner can change)', 'Yes - dynamic (based on conditions)'],
    priority: 'HIGH',
    category: 'token-economics',
  },
  {
    key: 'token_max_fee',
    text: 'If there is a transfer fee, what is the maximum fee percentage?',
    type: 'text',
    priority: 'HIGH',
    category: 'token-economics',
    helpText: 'Example: 10 for 10%, 2.5 for 2.5%',
  },
  {
    key: 'token_pause_mechanism',
    text: 'Can token transfers be paused?',
    type: 'select',
    options: ['Yes - by owner', 'Yes - by specific role', 'No pause mechanism'],
    priority: 'HIGH',
    category: 'token-economics',
  },
];

// ============================================================================
// NFT (ERC721/ERC1155) Questions
// ============================================================================

const NFT_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'nft_max_supply',
    text: 'What is the maximum NFT supply?',
    type: 'text',
    priority: 'HIGH',
    category: 'nft-characteristics',
    helpText: 'Enter the maximum number of NFTs that can be minted, or "unlimited" if no cap',
    validation: {
      required: true,
    },
  },
  {
    key: 'nft_supply_increase',
    text: 'Can the maximum supply be increased after deployment?',
    type: 'select',
    options: ['No - hardcoded', 'Yes - by owner', 'Yes - through governance'],
    priority: 'HIGH',
    category: 'nft-characteristics',
  },
  {
    key: 'nft_metadata_storage',
    text: 'Where is NFT metadata stored?',
    type: 'select',
    options: [
      'On-chain (fully)',
      'IPFS (pinned)',
      'IPFS (unpinned)',
      'Arweave',
      'Centralized server',
      'Mixed (some on-chain, some off-chain)'
    ],
    priority: 'HIGH',
    category: 'nft-characteristics',
    helpText: 'This affects immutability and long-term accessibility',
  },
  {
    key: 'nft_base_uri_changeable',
    text: 'Can the base URI be changed after NFTs are minted?',
    type: 'select',
    options: ['No - immutable', 'Yes - by owner', 'Yes - by governance'],
    priority: 'HIGH',
    category: 'nft-characteristics',
  },
  {
    key: 'nft_royalties',
    text: 'Are royalties enforced?',
    type: 'select',
    options: ['Yes - ERC2981 standard', 'Yes - custom implementation', 'No royalties'],
    priority: 'MEDIUM',
    category: 'nft-characteristics',
  },
  {
    key: 'nft_reveal_mechanism',
    text: 'Is there a reveal mechanism for NFT metadata?',
    type: 'select',
    options: ['No - revealed immediately', 'Yes - delayed reveal', 'Yes - on-demand reveal'],
    priority: 'MEDIUM',
    category: 'nft-characteristics',
  },
  {
    key: 'nft_minting_restrictions',
    text: 'Who can mint NFTs?',
    type: 'select',
    options: ['Public (anyone)', 'Whitelist only', 'Owner only', 'Specific role'],
    priority: 'HIGH',
    category: 'nft-characteristics',
  },
];

// ============================================================================
// DeFi Protocol Questions
// ============================================================================

const DEFI_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'defi_protocol_type',
    text: 'What type of DeFi protocol is this?',
    type: 'select',
    options: ['AMM/DEX', 'Lending', 'Staking', 'Yield Farming', 'Derivatives', 'Other'],
    priority: 'HIGH',
    category: 'defi-security',
  },
  {
    key: 'defi_oracle_provider',
    text: 'Which oracle provider(s) does the protocol use for price feeds?',
    type: 'multiselect',
    options: [
      'Chainlink',
      'Uniswap V3 TWAP',
      'Pyth Network',
      'Band Protocol',
      'Custom oracle',
      'None (no price feeds needed)',
      'Other'
    ],
    priority: 'HIGH',
    category: 'defi-security',
    helpText: 'Price oracles are critical for preventing manipulation',
  },
  {
    key: 'defi_flash_loan_protection',
    text: 'Does the protocol have flash loan protection?',
    type: 'select',
    options: [
      'Yes - TWAP oracle',
      'Yes - minimum block delay',
      'Yes - other mechanism',
      'No',
      'Not applicable (no flash loan risk)'
    ],
    priority: 'HIGH',
    category: 'defi-security',
  },
  {
    key: 'defi_slippage_protection',
    text: 'Is slippage protection implemented?',
    type: 'select',
    options: ['Yes - user-defined', 'Yes - protocol-enforced', 'No'],
    priority: 'MEDIUM',
    category: 'defi-security',
  },
  {
    key: 'defi_liquidity_lock',
    text: 'Is liquidity locked or can it be withdrawn by admins?',
    type: 'select',
    options: [
      'Locked (time-based)',
      'Locked (permanent)',
      'Withdrawable by owner',
      'No liquidity locking',
      'Not applicable'
    ],
    priority: 'HIGH',
    category: 'defi-security',
  },
  {
    key: 'defi_emergency_pause',
    text: 'Is there an emergency pause mechanism?',
    type: 'select',
    options: ['Yes - by owner', 'Yes - by multisig', 'Yes - by governance', 'No'],
    priority: 'MEDIUM',
    category: 'defi-security',
  },
  {
    key: 'defi_max_fee',
    text: 'What is the maximum fee percentage that can be set?',
    type: 'text',
    priority: 'HIGH',
    category: 'defi-security',
    helpText: 'Example: 5 for 5%, 0.3 for 0.3%',
  },
];

// ============================================================================
// Governance Questions
// ============================================================================

const GOVERNANCE_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'gov_vote_weight',
    text: 'How is voting power calculated?',
    type: 'select',
    options: [
      'Token balance (1 token = 1 vote)',
      'Quadratic voting',
      'Delegated voting',
      'NFT-based',
      'Custom mechanism'
    ],
    priority: 'HIGH',
    category: 'governance',
  },
  {
    key: 'gov_quorum',
    text: 'What is the quorum threshold for proposals?',
    type: 'text',
    priority: 'HIGH',
    category: 'governance',
    helpText: 'Example: 10 for 10%, 51 for 51%',
  },
  {
    key: 'gov_timelock_delay',
    text: 'What is the timelock delay before executing approved proposals?',
    type: 'text',
    priority: 'HIGH',
    category: 'governance',
    helpText: 'Example: 2 days, 48 hours, 24h',
  },
  {
    key: 'gov_flash_loan_protection',
    text: 'Is governance protected against flash loan attacks?',
    type: 'select',
    options: [
      'Yes - snapshot voting',
      'Yes - vote lockup period',
      'Yes - both',
      'No',
      'Not applicable'
    ],
    priority: 'HIGH',
    category: 'governance',
  },
  {
    key: 'gov_proposal_threshold',
    text: 'What is the minimum token balance required to create a proposal?',
    type: 'text',
    priority: 'MEDIUM',
    category: 'governance',
    helpText: 'This prevents spam proposals',
  },
];

// ============================================================================
// Proxy/Upgradeable Questions (Dynamic)
// ============================================================================

const PROXY_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'proxy_upgrade_mechanism',
    text: (ctx) => `We detected a ${ctx.proxyType || 'proxy'} pattern. How is upgradeability managed?`,
    type: 'select',
    priority: 'HIGH',
    category: 'upgradeable',
    condition: (ctx) => ctx.hasProxy || ctx.hasUpgradeable,
    options: [
      'Multi-signature wallet',
      'Timelock controller',
      'DAO governance',
      'Single admin (not recommended)',
      'Not upgradeable'
    ],
    helpText: 'Who has the authority to upgrade the contract implementation?'
  },
  {
    key: 'access_control_roles',
    text: (ctx) => `We found ${ctx.rolesCount} access control role${ctx.rolesCount !== 1 ? 's' : ''}. How are these roles managed?`,
    type: 'textarea',
    priority: 'HIGH',
    category: 'access-control',
    condition: (ctx) => ctx.hasAccessControl && ctx.rolesCount > 0,
    validation: {
      required: true,
      minLength: 50,
      maxLength: 500
    },
    helpText: 'Explain the governance structure for role management and any time delays or multisig requirements'
  },
  {
    key: 'proxy_storage_collision_check',
    text: 'Have you checked for storage layout collisions between implementations?',
    type: 'confirm',
    priority: 'HIGH',
    category: 'proxy',
    condition: (ctx) => ctx.hasProxy || ctx.hasUpgradeable,
    helpText: 'Storage collisions can cause serious bugs in upgradeable contracts',
  },
];

// ============================================================================
// Oracle/Chainlink Questions (Dynamic)
// ============================================================================

const ORACLE_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'chainlink_circuit_breakers',
    text: 'We detected Chainlink oracle integration. Are circuit breakers implemented for stale/invalid price data?',
    type: 'select',
    priority: 'HIGH',
    category: 'oracle',
    condition: (ctx) => ctx.usesChainlink,
    options: [
      'Yes, circuit breakers are implemented',
      'No, but we acknowledge the risk',
      'Not applicable to our use case'
    ],
    helpText: 'Circuit breakers protect against stale or manipulated oracle data'
  },
  {
    key: 'chainlink_feed_validation',
    text: 'How do you validate Chainlink price feed data?',
    type: 'multiselect',
    priority: 'HIGH',
    category: 'oracle',
    condition: (ctx) => ctx.usesChainlink,
    options: [
      'Check for stale data (updatedAt timestamp)',
      'Compare against min/max bounds',
      'Use multiple oracle sources',
      'Implement fallback oracle',
      'None'
    ],
    helpText: 'Multiple validation methods provide better security'
  },
];

// ============================================================================
// DEX/Uniswap Questions (Dynamic)
// ============================================================================

const DEX_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'uniswap_integration_version',
    text: (ctx) => `We detected Uniswap integration. Which version are you using?`,
    type: 'select',
    priority: 'MEDIUM',
    category: 'defi-security',
    condition: (ctx) => ctx.usesUniswap,
    options: [
      'Uniswap V2',
      'Uniswap V3',
      'Both V2 and V3',
      'Other DEX (not Uniswap)'
    ]
  },
  {
    key: 'dex_slippage_protection',
    text: 'How is slippage protection implemented in your DEX integration?',
    type: 'select',
    priority: 'HIGH',
    category: 'defi-security',
    condition: (ctx) => ctx.usesUniswap,
    options: [
      'User-defined slippage tolerance',
      'Protocol-enforced maximum slippage',
      'Both user-defined and protocol maximum',
      'No slippage protection'
    ],
    helpText: 'Slippage protection prevents sandwich attacks and price manipulation'
  },
];

// ============================================================================
// Admin Controls Questions (Dynamic)
// ============================================================================

const ADMIN_CONTROL_QUESTIONS: PreAuditQuestion[] = [
  {
    key: 'pause_mechanism_details',
    text: 'We detected a pause mechanism. How is it governed?',
    type: 'select',
    priority: 'HIGH',
    category: 'admin-controls',
    condition: (ctx) => ctx.hasPause,
    options: [
      'Single owner (immediate pause)',
      'Multisig (requires multiple signatures)',
      'Timelock (with delay)',
      'Emergency multisig (no delay)',
      'Governance vote required'
    ],
    helpText: 'Emergency pause should be quick but resuming should have governance'
  },
  {
    key: 'mint_burn_controls',
    text: (ctx) => {
      const features = [];
      if (ctx.hasMint) features.push('minting');
      if (ctx.hasBurn) features.push('burning');
      return `We detected ${features.join(' and ')} functionality. Who controls this?`;
    },
    type: 'select',
    priority: 'HIGH',
    category: 'token-economics',
    condition: (ctx) => ctx.hasMint || ctx.hasBurn,
    options: [
      'Only owner/admin',
      'Specific role (e.g., MINTER_ROLE)',
      'Any token holder can burn their own',
      'Automated/algorithmic',
      'Governance-controlled'
    ]
  },
  {
    key: 'owner_privileges_scope',
    text: 'We detected Ownable pattern. What privileges does the owner have?',
    type: 'multiselect',
    priority: 'HIGH',
    category: 'admin-controls',
    condition: (ctx) => ctx.hasOwner,
    options: [
      'Pause/unpause contract',
      'Change fees/parameters',
      'Upgrade contract',
      'Mint/burn tokens',
      'Withdraw funds',
      'Blacklist/whitelist addresses',
      'Transfer ownership',
      'Renounce ownership (permanently)',
      'Other'
    ],
    helpText: 'Transparency about owner privileges helps users assess risk'
  },
];

// ============================================================================
// Conditional Questions Pool (Added to Relevant Categories)
// ============================================================================

const CONDITIONAL_QUESTIONS_POOL = [
  ...PROXY_QUESTIONS,
  ...ORACLE_QUESTIONS,
  ...DEX_QUESTIONS,
  ...ADMIN_CONTROL_QUESTIONS,
];

// ============================================================================
// Template Mapping
// ============================================================================

export const QUESTION_TEMPLATES: Record<ContractCategory, PreAuditQuestion[]> = {
  'erc20-token': [...GENERIC_QUESTIONS, ...ERC20_QUESTIONS],
  'erc721-nft': [...GENERIC_QUESTIONS, ...NFT_QUESTIONS],
  'erc1155-multi': [...GENERIC_QUESTIONS, ...NFT_QUESTIONS],
  'defi-amm': [...GENERIC_QUESTIONS, ...DEFI_QUESTIONS],
  'defi-lending': [...GENERIC_QUESTIONS, ...DEFI_QUESTIONS],
  'defi-staking': [...GENERIC_QUESTIONS, ...DEFI_QUESTIONS],
  'governance': [...GENERIC_QUESTIONS, ...GOVERNANCE_QUESTIONS],
  'bridge': [...GENERIC_QUESTIONS, ...DEFI_QUESTIONS], // Bridge shares DeFi security concerns
  'proxy-upgradeable': [...GENERIC_QUESTIONS, ...PROXY_QUESTIONS],
  'multisig-wallet': [...GENERIC_QUESTIONS],
  'generic': [...GENERIC_QUESTIONS],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get questions for a specific contract category
 */
export function getQuestionsForCategory(category: ContractCategory): PreAuditQuestion[] {
  return QUESTION_TEMPLATES[category] || GENERIC_QUESTIONS;
}

/**
 * Get only HIGH priority (required) questions
 */
export function getRequiredQuestions(category: ContractCategory): PreAuditQuestion[] {
  const questions = getQuestionsForCategory(category);
  return questions.filter((q) => q.priority === 'HIGH');
}

/**
 * Get questions grouped by category
 */
export function getQuestionsGroupedByCategory(contractCategory: ContractCategory): Record<string, PreAuditQuestion[]> {
  const questions = getQuestionsForCategory(contractCategory);
  const grouped: Record<string, PreAuditQuestion[]> = {};

  for (const question of questions) {
    if (!grouped[question.category]) {
      grouped[question.category] = [];
    }
    grouped[question.category].push(question);
  }

  return grouped;
}

/**
 * Get conditional questions that should be added based on code analysis
 */
export function getConditionalQuestions(): PreAuditQuestion[] {
  return CONDITIONAL_QUESTIONS_POOL;
}

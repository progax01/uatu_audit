/**
 * Empathy Rules Service
 * 
 * Defines patterns that require human clarification before scoring.
 * Instead of penalizing developers, we ask questions to understand context.
 * 
 * Examples:
 * - onlyOwner without multisig → ask if it's multisig-controlled
 * - Hardcoded addresses → ask if testnet or mainnet
 * - External calls → ask if verified protocol
 * - Missing tests → ask if tests are in separate repo
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'empathy-rules' });

// ============================================================================
// TYPES
// ============================================================================

export type RuleCategory =
    | 'ADMIN_CUSTODY'
    | 'HARDCODED_VALUES'
    | 'EXTERNAL_CALLS'
    | 'MISSING_TESTS'
    | 'UPGRADE_PATTERN'
    | 'ORACLE_USAGE'
    | 'CROSS_CHAIN'
    | 'TOKEN_HANDLING';

export type RuleSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface EmpathyRule {
    id: string;
    name: string;
    category: RuleCategory;
    description: string;
    pattern: RegExp;
    filePattern?: RegExp; // Only apply to certain files
    question: string;
    options: Array<{
        label: string;
        value: string;
        risk: RuleSeverity;
        scoreImpact: number; // -10 to +10
    }>;
    defaultSeverity: RuleSeverity;
    clarifiedSeverity: (answer: string) => RuleSeverity;
}

export interface PatternMatch {
    ruleId: string;
    file: string;
    line: number;
    snippet: string;
    context: string;
}

export interface EmpathyEvaluation {
    matches: PatternMatch[];
    questions: Array<{
        ruleId: string;
        questionKey: string;
        questionText: string;
        category: RuleCategory;
        context: object;
        options: EmpathyRule['options'];
    }>;
    pendingClarifications: number;
}

// ============================================================================
// EMPATHY RULES DEFINITIONS
// ============================================================================

export const EMPATHY_RULES: EmpathyRule[] = [
    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN CUSTODY PATTERNS
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'admin_only_owner',
        name: 'Owner-Only Functions',
        category: 'ADMIN_CUSTODY',
        description: 'Functions restricted to a single owner address',
        pattern: /onlyOwner|Ownable|owner\(\)|_owner/i,
        filePattern: /\.sol$/,
        question: 'We detected owner-controlled admin functions. Is ownership held by a multisig wallet or a single EOA?',
        options: [
            { label: 'Multisig (e.g., Gnosis Safe)', value: 'multisig', risk: 'low', scoreImpact: +5 },
            { label: 'Timelocked + Multisig', value: 'timelocked_multisig', risk: 'info', scoreImpact: +10 },
            { label: 'Single EOA (externally owned account)', value: 'eoa', risk: 'high', scoreImpact: -10 },
            { label: 'DAO governance', value: 'dao', risk: 'low', scoreImpact: +5 },
            { label: 'Not sure yet', value: 'unknown', risk: 'medium', scoreImpact: 0 },
        ],
        defaultSeverity: 'medium',
        clarifiedSeverity: (answer) => {
            if (answer === 'multisig' || answer === 'dao') return 'low';
            if (answer === 'timelocked_multisig') return 'info';
            if (answer === 'eoa') return 'high';
            return 'medium';
        },
    },

    {
        id: 'admin_pause',
        name: 'Pause Functionality',
        category: 'ADMIN_CUSTODY',
        description: 'Contract can be paused by admin',
        pattern: /Pausable|_pause\(\)|whenNotPaused|isPaused/i,
        filePattern: /\.sol$/,
        question: 'The contract has pause functionality. Who can trigger a pause?',
        options: [
            { label: 'Emergency multisig only', value: 'emergency_multisig', risk: 'low', scoreImpact: +5 },
            { label: 'Any admin/owner', value: 'any_admin', risk: 'medium', scoreImpact: 0 },
            { label: 'Automatic circuit breaker', value: 'circuit_breaker', risk: 'info', scoreImpact: +10 },
        ],
        defaultSeverity: 'medium',
        clarifiedSeverity: (answer) => answer === 'any_admin' ? 'medium' : 'low',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // HARDCODED VALUES
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'hardcoded_address',
        name: 'Hardcoded Addresses',
        category: 'HARDCODED_VALUES',
        description: 'Ethereum addresses hardcoded in source code',
        pattern: /0x[a-fA-F0-9]{40}/,
        filePattern: /\.(sol|ts|js)$/,
        question: 'We found hardcoded addresses in the code. Are these mainnet addresses or testnet?',
        options: [
            { label: 'Mainnet addresses (verified)', value: 'mainnet_verified', risk: 'low', scoreImpact: +5 },
            { label: 'Testnet addresses (will change)', value: 'testnet', risk: 'info', scoreImpact: 0 },
            { label: 'Protocol addresses (WETH, Uniswap, etc.)', value: 'protocol', risk: 'info', scoreImpact: +5 },
            { label: 'Not sure', value: 'unknown', risk: 'medium', scoreImpact: -5 },
        ],
        defaultSeverity: 'medium',
        clarifiedSeverity: (answer) => {
            if (answer === 'testnet') return 'info';
            if (answer === 'protocol' || answer === 'mainnet_verified') return 'low';
            return 'medium';
        },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EXTERNAL CALLS
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'external_call',
        name: 'External Contract Calls',
        category: 'EXTERNAL_CALLS',
        description: 'Calls to external contracts',
        pattern: /\.call\(|\.delegatecall\(|IERC20\(|interface\s+\w+/i,
        filePattern: /\.sol$/,
        question: 'The contract interacts with external contracts. Are these verified and audited protocols?',
        options: [
            { label: 'Yes, all are verified (Uniswap, Compound, etc.)', value: 'verified', risk: 'low', scoreImpact: +5 },
            { label: 'Partially verified', value: 'partial', risk: 'medium', scoreImpact: 0 },
            { label: 'Custom external contracts (unverified)', value: 'unverified', risk: 'high', scoreImpact: -10 },
        ],
        defaultSeverity: 'medium',
        clarifiedSeverity: (answer) => answer === 'verified' ? 'low' : answer === 'unverified' ? 'high' : 'medium',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MISSING TESTS
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'missing_tests',
        name: 'No Tests Found',
        category: 'MISSING_TESTS',
        description: 'No test files found in the repository',
        pattern: /^$/, // Special: triggered externally, not by pattern
        question: 'We didn\'t find any test files. Are tests stored in a separate repository?',
        options: [
            { label: 'Tests are in a separate repo', value: 'separate_repo', risk: 'low', scoreImpact: 0 },
            { label: 'Tests are planned but not written', value: 'planned', risk: 'medium', scoreImpact: -5 },
            { label: 'No tests yet', value: 'none', risk: 'high', scoreImpact: -15 },
        ],
        defaultSeverity: 'high',
        clarifiedSeverity: (answer) => answer === 'separate_repo' ? 'low' : answer === 'none' ? 'high' : 'medium',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // UPGRADE PATTERNS
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'upgrade_proxy',
        name: 'Upgradeable Proxy',
        category: 'UPGRADE_PATTERN',
        description: 'Contract uses upgradeable proxy pattern',
        pattern: /Upgradeable|UUPSUpgradeable|TransparentUpgradeableProxy|initializer/i,
        filePattern: /\.sol$/,
        question: 'The contract uses an upgradeable pattern. Who controls upgrades?',
        options: [
            { label: 'DAO governance with timelock', value: 'dao_timelock', risk: 'low', scoreImpact: +10 },
            { label: 'Multisig with timelock', value: 'multisig_timelock', risk: 'low', scoreImpact: +5 },
            { label: 'Multisig without timelock', value: 'multisig_no_timelock', risk: 'medium', scoreImpact: 0 },
            { label: 'Single admin', value: 'single_admin', risk: 'critical', scoreImpact: -15 },
        ],
        defaultSeverity: 'high',
        clarifiedSeverity: (answer) => {
            if (answer === 'dao_timelock' || answer === 'multisig_timelock') return 'low';
            if (answer === 'multisig_no_timelock') return 'medium';
            return 'critical';
        },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ORACLE USAGE
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'oracle_price',
        name: 'Price Oracle Usage',
        category: 'ORACLE_USAGE',
        description: 'Contract relies on external price oracles',
        pattern: /Chainlink|AggregatorV3Interface|latestRoundData|getPrice|oracle/i,
        filePattern: /\.sol$/,
        question: 'The contract uses price oracles. Which oracle provider is used?',
        options: [
            { label: 'Chainlink (official feeds)', value: 'chainlink', risk: 'low', scoreImpact: +10 },
            { label: 'Uniswap TWAP', value: 'uniswap_twap', risk: 'medium', scoreImpact: 0 },
            { label: 'Custom oracle', value: 'custom', risk: 'high', scoreImpact: -10 },
            { label: 'Multiple sources with fallback', value: 'multiple', risk: 'low', scoreImpact: +5 },
        ],
        defaultSeverity: 'medium',
        clarifiedSeverity: (answer) => {
            if (answer === 'chainlink' || answer === 'multiple') return 'low';
            if (answer === 'custom') return 'high';
            return 'medium';
        },
    },
];

// ============================================================================
// EVALUATION FUNCTIONS
// ============================================================================

/**
 * Scan content for empathy rule matches
 */
export function scanForEmpathyPatterns(
    content: string,
    filePath: string
): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const lines = content.split('\n');

    for (const rule of EMPATHY_RULES) {
        // Check if file pattern matches
        if (rule.filePattern && !rule.filePattern.test(filePath)) {
            continue;
        }

        // Skip special rules (like missing_tests)
        if (rule.pattern.source === '^$') {
            continue;
        }

        // Scan lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (rule.pattern.test(line)) {
                matches.push({
                    ruleId: rule.id,
                    file: filePath,
                    line: i + 1,
                    snippet: line.trim(),
                    context: lines.slice(Math.max(0, i - 2), i + 3).join('\n'),
                });
                break; // One match per rule per file
            }
        }
    }

    return matches;
}

/**
 * Generate clarification questions from pattern matches
 */
export function generateEmpathyQuestions(
    matches: PatternMatch[]
): EmpathyEvaluation['questions'] {
    const questions: EmpathyEvaluation['questions'] = [];
    const seenRules = new Set<string>();

    for (const match of matches) {
        if (seenRules.has(match.ruleId)) continue;
        seenRules.add(match.ruleId);

        const rule = EMPATHY_RULES.find(r => r.id === match.ruleId);
        if (!rule) continue;

        questions.push({
            ruleId: rule.id,
            questionKey: `empathy_${rule.id}`,
            questionText: rule.question,
            category: rule.category,
            context: {
                file: match.file,
                line: match.line,
                snippet: match.snippet,
            },
            options: rule.options,
        });
    }

    return questions;
}

/**
 * Get rule by ID
 */
export function getRule(ruleId: string): EmpathyRule | undefined {
    return EMPATHY_RULES.find(r => r.id === ruleId);
}

/**
 * Calculate score impact based on answer
 */
export function calculateScoreImpact(ruleId: string, answer: string): number {
    const rule = getRule(ruleId);
    if (!rule) return 0;

    const option = rule.options.find(o => o.value === answer);
    return option?.scoreImpact ?? 0;
}

/**
 * Get clarified severity after answer
 */
export function getClarifiedSeverity(ruleId: string, answer: string): RuleSeverity {
    const rule = getRule(ruleId);
    if (!rule) return 'medium';
    return rule.clarifiedSeverity(answer);
}

export default {
    EMPATHY_RULES,
    scanForEmpathyPatterns,
    generateEmpathyQuestions,
    getRule,
    calculateScoreImpact,
    getClarifiedSeverity,
};

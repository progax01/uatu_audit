/**
 * Post-Audit Clarification Generator (INTELLIGENT VERSION)
 *
 * Generates liability triage questions AFTER audit completes.
 * ONLY for HIGH/MEDIUM severity findings that need business justification.
 *
 * KEY IMPROVEMENTS:
 * - Severity filtering: Only MEDIUM+ findings (no INFO/LOW noise)
 * - Deduplication: Groups similar findings into single questions
 * - Smart detection: Requires specific security patterns, not broad keywords
 * - Excludes compiler noise: Never asks about SPDX, unused vars, etc.
 * - Intelligence integration: Uses clarificationIntelligence to skip redundant questions
 */

import { addClarification, type AddClarificationParams } from './clarificationService.js';
import { logger } from '../utils/logger.js';
import type { IntelligenceAnalysis } from './clarificationIntelligence.js';

const log = logger.child({ module: 'post-audit-clarification-gen' });

// ============================================================================
// Types
// ============================================================================

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category?: string;
  location?: {
    file?: string;
    line?: number;
  };
  rawOutput?: string | object;
}

// ============================================================================
// Main Generation Function
// ============================================================================

export interface ClarificationIntelligence {
  feeControls: IntelligenceAnalysis;
  rebalanceControls: IntelligenceAnalysis;
  pauseControls: IntelligenceAnalysis;
  upgradeControls: IntelligenceAnalysis;
  withdrawalControls: IntelligenceAnalysis;
  supplyControls: IntelligenceAnalysis;
  questionsNeeded: number;
  questionsSkipped: number;
  skipReasons: string[];
}

/**
 * Generate post-audit clarification questions from completed audit findings
 * INTELLIGENT VERSION: Uses clarification intelligence to skip redundant questions
 */
export async function generatePostAuditClarifications(
  jobId: string,
  findings: Finding[],
  intelligence?: ClarificationIntelligence
): Promise<number> {
  log.info('Generating post-audit clarifications (INTELLIGENT)', {
    jobId,
    totalFindings: findings.length,
    hasIntelligence: !!intelligence
  });

  // STEP 1: Filter out noise - only MEDIUM+ severity
  const relevantFindings = findings.filter(f => {
    // Only MEDIUM, HIGH, CRITICAL
    if (!['medium', 'high', 'critical'].includes(f.severity)) {
      return false;
    }

    // Exclude compiler noise
    if (isCompilerNoise(f)) {
      return false;
    }

    // Exclude generic/low-value findings
    if (isGenericFinding(f)) {
      return false;
    }

    return true;
  });

  log.info('Filtered relevant findings', {
    original: findings.length,
    relevant: relevantFindings.length,
    filtered: findings.length - relevantFindings.length
  });

  let questionCount = 0;
  let intelligentlySkipped = 0;

  // STEP 2: Group and generate questions by category (with intelligence filtering)

  // Admin/Owner controls - GROUP BY FUNCTION TYPE
  const adminGroups = groupAdminControlFindings(relevantFindings);
  for (const [groupKey, groupFindings] of Object.entries(adminGroups)) {
    // Check intelligence before generating
    if (intelligence && shouldSkipByIntelligence(groupKey, intelligence)) {
      log.info('Intelligence: Skipping question', {
        category: groupKey,
        reason: getIntelligenceReason(groupKey, intelligence)
      });
      intelligentlySkipped++;
      continue;
    }

    const added = await generateGroupedAdminQuestion(jobId, groupKey, groupFindings, intelligence);
    if (added) questionCount++;
  }

  // Centralization risks - ONE QUESTION if any found
  const centralizedFindings = relevantFindings.filter(f => isCentralizationRisk(f));
  if (centralizedFindings.length > 0) {
    const added = await generateCentralizationQuestion(jobId, centralizedFindings);
    if (added) questionCount++;
  }

  // Upgrade mechanisms - ONE QUESTION if found
  const upgradeFindings = relevantFindings.filter(f => isUpgradeMechanismFinding(f));
  if (upgradeFindings.length > 0) {
    // Check intelligence for upgrade controls
    if (intelligence?.upgradeControls && !intelligence.upgradeControls.shouldAskQuestion) {
      log.info('Intelligence: Skipping upgrade question', {
        reason: intelligence.upgradeControls.reason
      });
      intelligentlySkipped++;
    } else {
      const added = await generateUpgradeQuestion(jobId, upgradeFindings);
      if (added) questionCount++;
    }
  }

  // Pause/Emergency - ONE QUESTION if found
  const pauseFindings = relevantFindings.filter(f => isPauseMechanismFinding(f));
  if (pauseFindings.length > 0) {
    // Check intelligence for pause controls
    if (intelligence?.pauseControls && !intelligence.pauseControls.shouldAskQuestion) {
      log.info('Intelligence: Skipping pause question', {
        reason: intelligence.pauseControls.reason
      });
      intelligentlySkipped++;
    } else {
      const added = await generatePauseQuestion(jobId, pauseFindings);
      if (added) questionCount++;
    }
  }

  // Economic controls (fees, minting, etc) - GROUP BY TYPE
  const economicGroups = groupEconomicFindings(relevantFindings);
  for (const [groupKey, groupFindings] of Object.entries(economicGroups)) {
    // Check intelligence for supply controls
    if (groupKey === 'minting-control' && intelligence?.supplyControls && !intelligence.supplyControls.shouldAskQuestion) {
      log.info('Intelligence: Skipping supply question', {
        reason: intelligence.supplyControls.reason
      });
      intelligentlySkipped++;
      continue;
    }

    const added = await generateGroupedEconomicQuestion(jobId, groupKey, groupFindings);
    if (added) questionCount++;
  }

  log.info('Post-audit clarifications generated', {
    jobId,
    questionCount,
    intelligentlySkipped,
    relevantFindings: relevantFindings.length,
    totalFindings: findings.length
  });

  return questionCount;
}

// ============================================================================
// Intelligence Helper Functions
// ============================================================================

/**
 * Check if a question category should be skipped based on intelligence analysis
 */
function shouldSkipByIntelligence(groupKey: string, intelligence: ClarificationIntelligence): boolean {
  const categoryMap: Record<string, keyof ClarificationIntelligence> = {
    'fee-controls': 'feeControls',
    'supply-controls': 'supplyControls',
    'emergency-controls': 'pauseControls',
    'upgrade-controls': 'upgradeControls',
    'withdrawal-controls': 'withdrawalControls',
  };

  const intelligenceKey = categoryMap[groupKey];
  if (!intelligenceKey) return false;

  const analysis = intelligence[intelligenceKey];
  if (!analysis || typeof analysis !== 'object') return false;

  return !(analysis as IntelligenceAnalysis).shouldAskQuestion;
}

/**
 * Get the intelligence reason for skipping a question
 */
function getIntelligenceReason(groupKey: string, intelligence: ClarificationIntelligence): string {
  const categoryMap: Record<string, keyof ClarificationIntelligence> = {
    'fee-controls': 'feeControls',
    'supply-controls': 'supplyControls',
    'emergency-controls': 'pauseControls',
    'upgrade-controls': 'upgradeControls',
    'withdrawal-controls': 'withdrawalControls',
  };

  const intelligenceKey = categoryMap[groupKey];
  if (!intelligenceKey) return 'Unknown';

  const analysis = intelligence[intelligenceKey];
  if (!analysis || typeof analysis !== 'object') return 'No analysis available';

  return (analysis as IntelligenceAnalysis).reason || 'No reason provided';
}

// ============================================================================
// Smart Filtering Functions
// ============================================================================

/**
 * Detects compiler noise that should NEVER generate questions
 */
function isCompilerNoise(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  const noisePatterns = [
    'spdx',
    'license',
    'pragma',
    'unused variable',
    'unused parameter',
    'unused local',
    'shadowed variable',
    'contract size',
    'unreachable code',
    'function state mutability',
    'visibility',
    'different number of components',
    'unary negation',
  ];

  return noisePatterns.some(pattern => text.includes(pattern));
}

/**
 * Detects generic/low-value findings
 */
function isGenericFinding(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Too generic to warrant questions
  const genericPatterns = [
    'missing documentation',
    'consider adding comments',
    'code quality',
    'style guide',
    'naming convention',
  ];

  return genericPatterns.some(pattern => text.includes(pattern));
}

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * Groups admin control findings by function type
 * Instead of 10 questions about "setFee", "setRate", "setTax" - ask ONE about fee controls
 */
function groupAdminControlFindings(findings: Finding[]): Record<string, Finding[]> {
  const groups: Record<string, Finding[]> = {};

  for (const finding of findings) {
    if (!isAdminControlFinding(finding)) continue;

    const groupKey = categorizeAdminFunction(finding);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(finding);
  }

  return groups;
}

function categorizeAdminFunction(finding: Finding): string {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  if (text.match(/fee|tax|rate|commission/)) return 'fee-controls';
  if (text.match(/mint|burn|supply/)) return 'supply-controls';
  if (text.match(/pause|unpause|emergency/)) return 'emergency-controls';
  if (text.match(/upgrade|proxy|implementation/)) return 'upgrade-controls';
  if (text.match(/withdraw|rescue|recover/)) return 'withdrawal-controls';
  if (text.match(/blacklist|whitelist|ban/)) return 'access-list-controls';

  return 'general-admin';
}

/**
 * Groups economic findings by type
 */
function groupEconomicFindings(findings: Finding[]): Record<string, Finding[]> {
  const groups: Record<string, Finding[]> = {};

  for (const finding of findings) {
    if (!isEconomicControlFinding(finding)) continue;

    const groupKey = categorizeEconomicFunction(finding);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(finding);
  }

  return groups;
}

function categorizeEconomicFunction(finding: Finding): string {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  if (text.match(/mint|minting/)) return 'minting-control';
  if (text.match(/burn|burning/)) return 'burning-control';
  if (text.match(/fee|tax|commission/)) return 'fee-control';
  if (text.match(/supply cap|max supply|total supply/)) return 'supply-cap';

  return 'other-economic';
}

// ============================================================================
// Smart Detection Functions (MORE SPECIFIC)
// ============================================================================

function isAdminControlFinding(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Require BOTH a keyword AND a security-relevant context
  const hasAdminKeyword = (
    text.includes('onlyowner') ||
    text.includes('only owner') ||
    text.includes('owner can') ||
    text.includes('admin can') ||
    text.includes('privileged')
  );

  const hasSecurityContext = (
    text.includes('function') ||
    text.includes('control') ||
    text.includes('permission') ||
    text.includes('restricted')
  );

  return hasAdminKeyword && hasSecurityContext;
}

function isCentralizationRisk(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Very specific patterns only
  return (
    text.includes('centralization risk') ||
    text.includes('single point of failure') ||
    (text.includes('centralized') && text.includes('control')) ||
    (text.includes('single address') && (text.includes('owner') || text.includes('admin')))
  );
}

function isUpgradeMechanismFinding(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Specific upgrade-related patterns
  return (
    (text.includes('upgrade') && (text.includes('proxy') || text.includes('implementation'))) ||
    text.includes('upgradeable contract') ||
    (text.includes('delegatecall') && text.includes('implementation'))
  );
}

function isPauseMechanismFinding(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  return (
    text.includes('pause mechanism') ||
    text.includes('emergency stop') ||
    text.includes('circuit breaker') ||
    (text.includes('pause') && text.includes('function'))
  );
}

function isEconomicControlFinding(finding: Finding): boolean {
  const text = `${finding.title} ${finding.description}`.toLowerCase();

  // Economic controls that warrant questions
  return (
    (text.includes('mint') && text.includes('unlimited')) ||
    (text.includes('fee') && text.includes('no limit')) ||
    (text.includes('burn') && !text.includes('from')) ||
    (text.includes('supply cap') && text.includes('none')) ||
    text.includes('uncapped supply')
  );
}

// ============================================================================
// Grouped Question Generation
// ============================================================================

async function generateGroupedAdminQuestion(
  jobId: string,
  groupKey: string,
  findings: Finding[],
  intelligence?: ClarificationIntelligence
): Promise<boolean> {
  if (findings.length === 0) return false;

  // INTELLIGENCE-BASED HANDLING: Check intelligence analysis first
  if (intelligence && shouldSkipByIntelligence(groupKey, intelligence)) {
    log.info('Intelligence: Skipping admin question', {
      jobId,
      category: groupKey,
      reason: getIntelligenceReason(groupKey, intelligence),
      findingCount: findings.length
    });
    return false;
  }

  // LEGACY HANDLING: Skip fee-controls question if fees are already validated
  // (This is kept for backwards compatibility when intelligence is not available)
  if (groupKey === 'fee-controls' && !intelligence) {
    // Check if ALL findings are INFO severity (meaning fees are properly controlled)
    const allInfoSeverity = findings.every(f => f.severity === 'info');

    // Check if findings mention proper fee controls
    const hasProperControls = findings.some(f => {
      const text = `${f.title} ${f.description}`.toLowerCase();
      return (
        text.includes('capped at') ||
        text.includes('max') ||
        text.includes('limit') ||
        text.includes('timelock') ||
        text.includes('cooldown')
      );
    });

    // If fees are info-level AND have proper controls, skip the question
    if (allInfoSeverity || hasProperControls) {
      log.info('Legacy: Skipping fee-controls question - fees already validated', {
        jobId,
        findingCount: findings.length,
        allInfo: allInfoSeverity,
        hasControls: hasProperControls
      });
      return false; // Don't generate question
    }
  }

  // Create comprehensive question for ALL findings in this group
  const functionNames = findings.map(f => extractFunctionName(f)).filter(Boolean);
  const uniqueFunctions = [...new Set(functionNames)];

  const questionTexts: Record<string, string> = {
    'fee-controls': `Fee/Tax Controls: ${uniqueFunctions.length} admin-controlled fee functions detected (${uniqueFunctions.join(', ')}). What are the maximum fee limits and who controls these parameters?`,
    'supply-controls': `Token Supply Controls: ${uniqueFunctions.length} minting/burning functions detected (${uniqueFunctions.join(', ')}). What supply limits are enforced and who can mint/burn?`,
    'emergency-controls': `Emergency Controls: ${uniqueFunctions.length} pause/emergency functions detected (${uniqueFunctions.join(', ')}). Under what conditions are these used and what's the recovery process?`,
    'upgrade-controls': `Upgrade Controls: ${uniqueFunctions.length} upgrade-related functions detected (${uniqueFunctions.join(', ')}). Who controls upgrades and what timelock is in place?`,
    'withdrawal-controls': `Withdrawal Controls: ${uniqueFunctions.length} admin withdrawal functions detected (${uniqueFunctions.join(', ')}). Why can admin withdraw funds and what safeguards exist?`,
    'access-list-controls': `Access List Controls: ${uniqueFunctions.length} blacklist/whitelist functions detected (${uniqueFunctions.join(', ')}). What's the governance process for list changes?`,
    'general-admin': `Admin Functions: ${uniqueFunctions.length} privileged functions detected (${uniqueFunctions.join(', ')}). Why are these admin-only and what safeguards exist?`,
  };

  const params: AddClarificationParams = {
    jobId,
    phase: 'post_audit',
    questionKey: `grouped_admin_${groupKey}`,
    questionText: questionTexts[groupKey] || `Admin control group: ${uniqueFunctions.join(', ')}. Please explain the business justification and safeguards.`,
    questionType: 'text',
    context: {
      findingIds: findings.map(f => f.id),
      category: groupKey,
      count: findings.length,
      functions: uniqueFunctions,
    },
  };

  const result = await addClarification(params);
  return !!result;
}

async function generateGroupedEconomicQuestion(
  jobId: string,
  groupKey: string,
  findings: Finding[]
): Promise<boolean> {
  if (findings.length === 0) return false;

  const questionTexts: Record<string, string> = {
    'minting-control': `Minting Control: Unlimited or admin-controlled minting detected. What's the maximum supply cap and who can mint? Are there any rate limits?`,
    'burning-control': `Burning Mechanism: Token burning detected. Can only holders burn their tokens or can admin burn from any address? Is this intended?`,
    'fee-control': `Fee Parameters: Dynamic fees detected. What's the maximum fee that can be set? Are there hardcoded limits in the contract?`,
    'supply-cap': `Supply Cap: No maximum supply cap detected. Is unlimited supply intentional? If yes, what prevents infinite inflation?`,
  };

  const params: AddClarificationParams = {
    jobId,
    phase: 'post_audit',
    questionKey: `grouped_economic_${groupKey}`,
    questionText: questionTexts[groupKey] || `Economic control detected. Please explain the design decision and limits.`,
    questionType: 'text',
    context: {
      findingIds: findings.map(f => f.id),
      category: groupKey,
      count: findings.length,
    },
  };

  const result = await addClarification(params);
  return !!result;
}

async function generateCentralizationQuestion(
  jobId: string,
  findings: Finding[]
): Promise<boolean> {
  const params: AddClarificationParams = {
    jobId,
    phase: 'post_audit',
    questionKey: `centralization_risk`,
    questionText: `Centralization Risk: Single admin/owner address detected. Is this address a multisig or single signer? What's the governance model?`,
    questionType: 'select',
    options: [
      { label: '✅ Multisig (3+ signers, 60%+ threshold)', value: 'multisig_secure', risk: 'low' },
      { label: '⚠️ Multisig (2 signers, 50% threshold)', value: 'multisig_minimal', risk: 'medium' },
      { label: '🔴 Single signer (EOA)', value: 'eoa', risk: 'critical' },
      { label: '✅ DAO/Timelock governance', value: 'dao', risk: 'low' },
      { label: 'Other (explain below)', value: 'other', risk: 'medium' },
    ],
    context: {
      findingIds: findings.map(f => f.id),
      category: 'centralization',
      count: findings.length,
    },
  };

  const result = await addClarification(params);
  return !!result;
}

async function generateUpgradeQuestion(
  jobId: string,
  findings: Finding[]
): Promise<boolean> {
  const params: AddClarificationParams = {
    jobId,
    phase: 'post_audit',
    questionKey: `upgrade_mechanism`,
    questionText: `Upgrade Mechanism: Upgradeable contract detected. Who controls upgrades and what timelock delay is in place to protect users?`,
    questionType: 'select',
    options: [
      { label: '✅ Multisig + 48+ hour timelock', value: 'multisig_timelock', risk: 'low' },
      { label: '⚠️ Multisig + 24 hour timelock', value: 'multisig_short_timelock', risk: 'medium' },
      { label: '🔴 Multisig, no timelock', value: 'multisig_no_timelock', risk: 'high' },
      { label: '🔴 Single signer', value: 'single_signer', risk: 'critical' },
      { label: '✅ Immutable (cannot upgrade)', value: 'immutable', risk: 'low' },
    ],
    context: {
      findingIds: findings.map(f => f.id),
      category: 'upgrade-mechanism',
      count: findings.length,
    },
  };

  const result = await addClarification(params);
  return !!result;
}

async function generatePauseQuestion(
  jobId: string,
  findings: Finding[]
): Promise<boolean> {
  const params: AddClarificationParams = {
    jobId,
    phase: 'post_audit',
    questionKey: `pause_mechanism`,
    questionText: `Pause/Emergency Mechanism: Contract can be paused. Under what conditions would this be triggered? Is there a transparent recovery process?`,
    questionType: 'text',
    context: {
      findingIds: findings.map(f => f.id),
      category: 'emergency-controls',
      count: findings.length,
    },
  };

  const result = await addClarification(params);
  return !!result;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractFunctionName(finding: Finding): string {
  const text = `${finding.title} ${finding.description}`;

  // Try to extract function name from various patterns
  const patterns = [
    /function\s+`?(\w+)`?/i,
    /`(\w+)\(\)`/i,
    /"(\w+)"/,
    /(\w+)\s+can\s+/i,
    /(\w+)\s+is\s+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      return match[1];
    }
  }

  return '';
}

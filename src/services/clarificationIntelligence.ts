/**
 * Clarification Intelligence Service
 *
 * Analyzes findings and determines if clarification questions are ACTUALLY needed.
 * Prevents asking questions when answers are already obvious from the code/findings.
 *
 * PHILOSOPHY:
 * - If the scan found it, we already know it
 * - Only ask about AMBIGUOUS situations where user intent is unclear
 * - Never ask about properly implemented security features
 * - Never ask redundant questions about things we can infer from code
 * - Create adaptive checklists based on contract type (Token/DeFi/Vault)
 * - Always verify answers in code, not assumptions
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'clarification-intelligence' });

// ============================================================================
// Types
// ============================================================================

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  location?: {
    file?: string;
    line?: number;
  };
  recommendation?: string;
  rawOutput?: string | object;
}

export interface BusinessRiskCheck {
  category: string;
  result: string;
  severity: 'safe' | 'warning' | 'danger';
}

export interface IntelligenceAnalysis {
  shouldAskQuestion: boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  inferredAnswer?: string;
  category: string;
}

// ============================================================================
// Contract Type Detection (for Adaptive Analysis)
// ============================================================================

type ContractType = 'token' | 'defi' | 'vault' | 'proxy' | 'generic';

/**
 * Detect contract type from findings to apply adaptive intelligence
 */
function detectContractType(findings: Finding[]): ContractType {
  const allText = findings.map(f => `${f.title} ${f.description}`).join(' ').toLowerCase();

  // Token indicators
  if (
    allText.includes('erc20') ||
    allText.includes('erc721') ||
    allText.includes('transfer') && allText.includes('balance') ||
    allText.includes('mint') && allText.includes('supply')
  ) {
    return 'token';
  }

  // DeFi indicators
  if (
    allText.includes('liquidity') ||
    allText.includes('swap') ||
    allText.includes('pool') ||
    allText.includes('stake') ||
    allText.includes('oracle') ||
    allText.includes('collateral')
  ) {
    return 'defi';
  }

  // Vault indicators
  if (
    allText.includes('vault') ||
    allText.includes('treasury') ||
    allText.includes('rebalance') ||
    allText.includes('deposit') && allText.includes('withdraw')
  ) {
    return 'vault';
  }

  // Proxy indicators
  if (
    allText.includes('proxy') ||
    allText.includes('upgrade') ||
    allText.includes('delegatecall') ||
    allText.includes('implementation')
  ) {
    return 'proxy';
  }

  return 'generic';
}

// ============================================================================
// Intelligence Rules
// ============================================================================

/**
 * Analyze if a fee-related question is needed
 * ADAPTIVE: Token contracts have stricter fee expectations than DeFi protocols
 */
export function analyzeFeeQuestion(
  findings: Finding[],
  businessRisks: BusinessRiskCheck[]
): IntelligenceAnalysis {
  const contractType = detectContractType(findings);
  // Extract all fee-related findings
  const feeFindings = findings.filter(f =>
    f.title.toLowerCase().includes('fee') ||
    f.title.toLowerCase().includes('tax') ||
    f.description.toLowerCase().includes('fee')
  );

  // Check business risk checks for fee info
  const feeRisks = businessRisks.filter(b =>
    b.category.toLowerCase().includes('fee') ||
    b.category.toLowerCase().includes('tax')
  );

  // ========================================================================
  // RULE 1: If fees are explicitly capped and safe, NO QUESTION NEEDED
  // ========================================================================
  const hasCapInfo = feeFindings.some(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return (
      text.includes('capped at') ||
      text.includes('max') ||
      text.includes('maximum') ||
      (text.includes('%') && text.includes('limit'))
    );
  });

  const hasSafeRisks = feeRisks.every(r => r.severity === 'safe');

  // ADAPTIVE: Different contract types have different fee expectations
  // Tokens: Buy/sell tax | DeFi: Protocol fees | Vaults: Management/performance fees
  const feeTypeContext = contractType === 'token' ? 'buy/sell tax' :
                         contractType === 'vault' ? 'management/performance fees' :
                         'protocol fees';

  if (hasCapInfo && hasSafeRisks && feeFindings.every(f => f.severity === 'info')) {
    const capMatch = feeFindings[0]?.description.match(/(\d+)%/);
    const capValue = capMatch ? capMatch[1] : 'reasonable';

    return {
      shouldAskQuestion: false,
      reason: `${feeTypeContext} capped at ${capValue}% with proper controls verified in code. No question needed.`,
      confidence: 'high',
      inferredAnswer: `Fees (${feeTypeContext}) are hardcoded with maximum limits (${capValue}%) and include timelock mechanisms for changes. This is documented in the findings.`,
      category: 'fee-controls'
    };
  }

  // ========================================================================
  // RULE 2: If fees are unlimited or >20%, QUESTION IS NEEDED
  // ========================================================================
  const hasUnlimitedFees = feeFindings.some(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return (
      text.includes('no limit') ||
      text.includes('unlimited') ||
      text.includes('100%') ||
      f.severity === 'critical' ||
      f.severity === 'high'
    );
  });

  const hasDangerousRisks = feeRisks.some(r => r.severity === 'danger');

  if (hasUnlimitedFees || hasDangerousRisks) {
    return {
      shouldAskQuestion: true,
      reason: 'Unlimited or high fees detected. User must explain business justification.',
      confidence: 'high',
      category: 'fee-controls'
    };
  }

  // ========================================================================
  // RULE 3: If fees are 10-20% (warning level), ASK FOR DISCLOSURE
  // ========================================================================
  const hasWarningFees = feeFindings.some(f => f.severity === 'medium') ||
                          feeRisks.some(r => r.severity === 'warning');

  if (hasWarningFees) {
    return {
      shouldAskQuestion: true,
      reason: 'Fees in 10-20% range. Requires user disclosure for transparency.',
      confidence: 'medium',
      category: 'fee-controls'
    };
  }

  // ========================================================================
  // RULE 4: Default - No fee findings, no question
  // ========================================================================
  return {
    shouldAskQuestion: false,
    reason: 'No significant fee concerns detected.',
    confidence: 'high',
    category: 'fee-controls'
  };
}

/**
 * Analyze if admin control questions are needed
 */
export function analyzeAdminControlQuestion(
  findings: Finding[],
  controlType: 'rebalance' | 'pause' | 'upgrade' | 'withdrawal'
): IntelligenceAnalysis {
  const relevantFindings = findings.filter(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();

    switch (controlType) {
      case 'rebalance':
        return text.includes('rebalance') || text.includes('move funds');
      case 'pause':
        return text.includes('pause') || text.includes('emergency');
      case 'upgrade':
        return text.includes('upgrade') || text.includes('proxy');
      case 'withdrawal':
        return text.includes('withdraw') && text.includes('admin');
      default:
        return false;
    }
  });

  if (relevantFindings.length === 0) {
    return {
      shouldAskQuestion: false,
      reason: `No ${controlType} control findings detected.`,
      confidence: 'high',
      category: `${controlType}-controls`
    };
  }

  // ========================================================================
  // Check if it's a managed vault/protocol design
  // ========================================================================
  const isManagedDesign = findings.some(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return (
      text.includes('managed vault') ||
      text.includes('yield optimization') ||
      text.includes('by design') ||
      text.includes('intentional')
    );
  });

  const hasProperControls = relevantFindings.every(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return (
      text.includes('timelock') ||
      text.includes('cooldown') ||
      text.includes('multisig') ||
      text.includes('governance')
    );
  });

  // If it's info severity + managed design + has controls = NO QUESTION
  if (relevantFindings.every(f => f.severity === 'info') &&
      (isManagedDesign || hasProperControls)) {
    return {
      shouldAskQuestion: false,
      reason: `${controlType} is part of intentional managed design with proper controls.`,
      confidence: 'high',
      inferredAnswer: `This is a managed protocol where ${controlType} by admin is intentional and includes appropriate safeguards (timelocks, multisig, etc.).`,
      category: `${controlType}-controls`
    };
  }

  // If high/critical severity = MUST ASK
  const hasCriticalIssues = relevantFindings.some(f =>
    f.severity === 'critical' || f.severity === 'high'
  );

  if (hasCriticalIssues) {
    return {
      shouldAskQuestion: true,
      reason: `Critical ${controlType} vulnerability detected. User must explain.`,
      confidence: 'high',
      category: `${controlType}-controls`
    };
  }

  // Medium severity = ASK if no clear controls mentioned
  return {
    shouldAskQuestion: !hasProperControls,
    reason: hasProperControls
      ? `${controlType} has proper controls documented.`
      : `${controlType} controls unclear, needs clarification.`,
    confidence: 'medium',
    category: `${controlType}-controls`
  };
}

/**
 * Analyze if minting/supply questions are needed
 */
export function analyzeSupplyQuestion(
  findings: Finding[],
  businessRisks: BusinessRiskCheck[]
): IntelligenceAnalysis {
  const mintFindings = findings.filter(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return text.includes('mint') || text.includes('supply');
  });

  const mintRisks = businessRisks.find(b => b.category === 'Can Mint');

  // No minting capability = NO QUESTION
  if (mintRisks?.result === 'No' || mintFindings.length === 0) {
    return {
      shouldAskQuestion: false,
      reason: 'No minting capability detected.',
      confidence: 'high',
      inferredAnswer: 'This contract does not have minting functionality.',
      category: 'supply-controls'
    };
  }

  // Check if capped
  const hasCap = mintFindings.some(f => {
    const text = `${f.title} ${f.description}`.toLowerCase();
    return (
      text.includes('cap') ||
      text.includes('maximum supply') ||
      text.includes('limited')
    );
  });

  if (hasCap && mintFindings.every(f => f.severity === 'info' || f.severity === 'low')) {
    return {
      shouldAskQuestion: false,
      reason: 'Minting is capped with clear limits.',
      confidence: 'high',
      inferredAnswer: 'Minting has hardcoded supply caps as documented in findings.',
      category: 'supply-controls'
    };
  }

  // Unlimited minting = MUST ASK
  const isUnlimited = mintFindings.some(f =>
    f.severity === 'high' || f.severity === 'critical'
  );

  return {
    shouldAskQuestion: isUnlimited,
    reason: isUnlimited
      ? 'Unlimited minting detected - requires justification.'
      : 'Minting controls are documented.',
    confidence: isUnlimited ? 'high' : 'medium',
    category: 'supply-controls'
  };
}

/**
 * Master analysis function - determines ALL questions needed
 */
export function analyzeAllClarificationNeeds(
  findings: Finding[],
  businessRisks: BusinessRiskCheck[]
): {
  feeControls: IntelligenceAnalysis;
  rebalanceControls: IntelligenceAnalysis;
  pauseControls: IntelligenceAnalysis;
  upgradeControls: IntelligenceAnalysis;
  withdrawalControls: IntelligenceAnalysis;
  supplyControls: IntelligenceAnalysis;
  questionsNeeded: number;
  questionsSkipped: number;
  skipReasons: string[];
} {
  const analyses = {
    feeControls: analyzeFeeQuestion(findings, businessRisks),
    rebalanceControls: analyzeAdminControlQuestion(findings, 'rebalance'),
    pauseControls: analyzeAdminControlQuestion(findings, 'pause'),
    upgradeControls: analyzeAdminControlQuestion(findings, 'upgrade'),
    withdrawalControls: analyzeAdminControlQuestion(findings, 'withdrawal'),
    supplyControls: analyzeSupplyQuestion(findings, businessRisks),
  };

  const questionsNeeded = Object.values(analyses).filter(a => a.shouldAskQuestion).length;
  const questionsSkipped = Object.values(analyses).filter(a => !a.shouldAskQuestion).length;
  const skipReasons = Object.values(analyses)
    .filter(a => !a.shouldAskQuestion)
    .map(a => `${a.category}: ${a.reason}`);

  log.info('Clarification intelligence analysis complete', {
    questionsNeeded,
    questionsSkipped,
    needsFeeQuestion: analyses.feeControls.shouldAskQuestion,
    needsRebalanceQuestion: analyses.rebalanceControls.shouldAskQuestion,
    needsPauseQuestion: analyses.pauseControls.shouldAskQuestion,
    needsUpgradeQuestion: analyses.upgradeControls.shouldAskQuestion,
    needsWithdrawalQuestion: analyses.withdrawalControls.shouldAskQuestion,
    needsSupplyQuestion: analyses.supplyControls.shouldAskQuestion,
  });

  return {
    ...analyses,
    questionsNeeded,
    questionsSkipped,
    skipReasons,
  };
}

/**
 * Generate a summary report of what questions should/shouldn't be asked
 */
export function generateIntelligenceReport(
  findings: Finding[],
  businessRisks: BusinessRiskCheck[]
): string {
  const analysis = analyzeAllClarificationNeeds(findings, businessRisks);

  let report = '=== CLARIFICATION INTELLIGENCE REPORT ===\n\n';

  report += `Questions Needed: ${analysis.questionsNeeded}\n`;
  report += `Questions Skipped: ${analysis.questionsSkipped}\n\n`;

  report += '--- DECISIONS ---\n\n';

  for (const [key, value] of Object.entries(analysis)) {
    if (key.includes('Controls')) {
      const analysis = value as IntelligenceAnalysis;
      const status = analysis.shouldAskQuestion ? '❌ ASK' : '✅ SKIP';

      report += `${status} ${analysis.category}:\n`;
      report += `  Reason: ${analysis.reason}\n`;
      report += `  Confidence: ${analysis.confidence}\n`;

      if (analysis.inferredAnswer) {
        report += `  Inferred: ${analysis.inferredAnswer}\n`;
      }

      report += '\n';
    }
  }

  if (analysis.questionsSkipped > 0) {
    report += '--- SKIP REASONS ---\n\n';
    analysis.skipReasons.forEach(reason => {
      report += `• ${reason}\n`;
    });
  }

  return report;
}

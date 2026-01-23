/**
 * 10th Man Analysis Service
 *
 * Acts as a devil's advocate to challenge severity ratings with logical reasoning.
 * This service validates that critical/high findings actually deserve their severity
 * by analyzing:
 * 1. Stakeholder Impact - Who actually gets hurt?
 * 2. Attack Feasibility - Is this realistic or theoretical?
 * 3. Severity Logic - Does the rating match the actual risk?
 * 4. Business Context - Is this critical for THIS contract type?
 * 5. Evidence Quality - Does the proof support the claim?
 *
 * PHILOSOPHY: Challenge everything. Don't trust the first analysis.
 * Better to downgrade an inflated finding than ship false alarms.
 */

import { logger } from '../utils/logger.js';
import type { FindingLike } from './scoringService.js';

const log = logger.child({ service: '10th-man' });

// ============================================================================
// TYPES
// ============================================================================

export interface StakeholderImpact {
  users: 'none' | 'low' | 'medium' | 'high' | 'critical';
  protocol: 'none' | 'low' | 'medium' | 'high' | 'critical';
  admins: 'none' | 'low' | 'medium' | 'high' | 'critical';
  thirdParties: 'none' | 'low' | 'medium' | 'high' | 'critical';
  primaryVictim: 'users' | 'protocol' | 'admins' | 'thirdParties' | 'none';
  description: string;
}

export interface AttackFeasibility {
  prerequisites: string[];
  complexity: 'trivial' | 'low' | 'medium' | 'high' | 'expert';
  likelihood: 'certain' | 'likely' | 'possible' | 'unlikely' | 'theoretical';
  timeToExploit: 'immediate' | 'hours' | 'days' | 'weeks' | 'months';
  exploitableInPractice: boolean;
  reasoning: string;
}

export interface SeverityChallenge {
  originalSeverity: string;
  challengedSeverity: string;
  shouldDowngrade: boolean;
  shouldUpgrade: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  riskScore: number; // 0-100
  cvssVector: string;
}

export interface BusinessContext {
  contractType: 'token' | 'defi' | 'vault' | 'nft' | 'governance' | 'proxy' | 'generic';
  criticalityForType: 'irrelevant' | 'minor' | 'important' | 'critical' | 'catastrophic';
  industryStandard: string;
  contextualFactors: string[];
}

export interface TenthManAnalysis {
  findingId: string;
  findingTitle: string;
  stakeholderImpact: StakeholderImpact;
  attackFeasibility: AttackFeasibility;
  severityChallenge: SeverityChallenge;
  businessContext: BusinessContext;
  finalVerdict: {
    agreedSeverity: string;
    reasoning: string;
    keyQuestions: string[];
    redFlags: string[];
    mitigatingFactors: string[];
  };
  timestamp: string;
}

// ============================================================================
// STAKEHOLDER IMPACT ANALYSIS
// ============================================================================

/**
 * Analyze who gets hurt and how badly
 */
export function analyzeStakeholderImpact(
  finding: FindingLike & { impact?: string; description?: string }
): StakeholderImpact {
  const text = `${finding.title} ${finding.description} ${finding.impact || ''}`.toLowerCase();

  let users: StakeholderImpact['users'] = 'none';
  let protocol: StakeholderImpact['protocol'] = 'none';
  let admins: StakeholderImpact['admins'] = 'none';
  let thirdParties: StakeholderImpact['thirdParties'] = 'none';

  // User impact indicators
  if (
    text.includes('user funds') ||
    text.includes('steal') && text.includes('balance') ||
    text.includes('drain') && !text.includes('admin') ||
    text.includes('loss of funds') && text.includes('user')
  ) {
    users = 'critical';
  } else if (
    text.includes('user') && (text.includes('loss') || text.includes('theft'))
  ) {
    users = 'high';
  } else if (text.includes('user') && text.includes('griefing')) {
    users = 'medium';
  }

  // Protocol impact indicators
  if (
    text.includes('protocol insolvency') ||
    text.includes('all funds') ||
    text.includes('treasury drain') ||
    text.includes('total loss')
  ) {
    protocol = 'critical';
  } else if (
    text.includes('protocol') && text.includes('loss') ||
    text.includes('liquidity drain')
  ) {
    protocol = 'high';
  } else if (
    text.includes('protocol') && (text.includes('stuck') || text.includes('freeze'))
  ) {
    protocol = 'medium';
  }

  // Admin impact indicators
  if (
    text.includes('admin') && text.includes('bypass') ||
    text.includes('unauthorized admin') ||
    text.includes('privilege escalation')
  ) {
    admins = 'high';
  } else if (text.includes('admin') && text.includes('griefing')) {
    admins = 'low';
  }

  // Third party impact (oracles, integrators, etc.)
  if (
    text.includes('oracle') && text.includes('manipulat') ||
    text.includes('flashloan') && text.includes('attack')
  ) {
    thirdParties = 'high';
  }

  // Determine primary victim
  const impacts = [
    { type: 'users' as const, level: users },
    { type: 'protocol' as const, level: protocol },
    { type: 'admins' as const, level: admins },
    { type: 'thirdParties' as const, level: thirdParties },
  ];

  const severityOrder = ['critical', 'high', 'medium', 'low', 'none'];
  impacts.sort((a, b) => severityOrder.indexOf(a.level) - severityOrder.indexOf(b.level));

  const primaryVictim = impacts[0].level !== 'none' ? impacts[0].type : 'none';

  // Generate description
  const description = generateImpactDescription(users, protocol, admins, thirdParties, primaryVictim);

  return {
    users,
    protocol,
    admins,
    thirdParties,
    primaryVictim,
    description,
  };
}

function generateImpactDescription(
  users: string,
  protocol: string,
  admins: string,
  thirdParties: string,
  primaryVictim: string
): string {
  const parts: string[] = [];

  if (users !== 'none') parts.push(`Users: ${users} impact`);
  if (protocol !== 'none') parts.push(`Protocol: ${protocol} impact`);
  if (admins !== 'none') parts.push(`Admins: ${admins} impact`);
  if (thirdParties !== 'none') parts.push(`Third parties: ${thirdParties} impact`);

  if (parts.length === 0) return 'No clear stakeholder impact identified';

  return `${parts.join(' | ')} - Primary victim: ${primaryVictim}`;
}

// ============================================================================
// ATTACK FEASIBILITY ANALYSIS
// ============================================================================

/**
 * Determine if this attack is realistic or just theoretical
 */
export function analyzeAttackFeasibility(
  finding: FindingLike & { impact?: string; description?: string; code_snippet?: string }
): AttackFeasibility {
  const text = `${finding.title} ${finding.description} ${finding.impact || ''}`.toLowerCase();

  const prerequisites: string[] = [];
  let complexity: AttackFeasibility['complexity'] = 'medium';
  let likelihood: AttackFeasibility['likelihood'] = 'possible';
  let timeToExploit: AttackFeasibility['timeToExploit'] = 'days';

  // Identify prerequisites
  if (text.includes('admin') || text.includes('owner')) {
    prerequisites.push('Requires admin/owner privileges');
    likelihood = 'unlikely';
  }
  if (text.includes('flashloan')) {
    prerequisites.push('Requires flashloan capability');
    complexity = 'high';
  }
  if (text.includes('oracle') && text.includes('manipulat')) {
    prerequisites.push('Requires oracle manipulation');
    complexity = 'expert';
  }
  if (text.includes('reentrancy')) {
    prerequisites.push('Requires malicious contract deployment');
    complexity = 'medium';
  }
  if (text.includes('front-run') || text.includes('frontrun')) {
    prerequisites.push('Requires MEV bot or transaction monitoring');
    complexity = 'medium';
  }
  if (text.includes('sandwich')) {
    prerequisites.push('Requires MEV infrastructure');
    complexity = 'high';
  }

  // Determine complexity
  if (
    text.includes('public function') &&
    text.includes('no access control') &&
    !text.includes('require')
  ) {
    complexity = 'trivial';
    likelihood = 'certain';
    timeToExploit = 'immediate';
  } else if (
    text.includes('direct call') ||
    text.includes('simple exploit')
  ) {
    complexity = 'low';
    likelihood = 'likely';
    timeToExploit = 'hours';
  } else if (
    text.includes('complex') ||
    text.includes('multiple steps') ||
    text.includes('precise timing')
  ) {
    complexity = 'high';
    likelihood = 'possible';
    timeToExploit = 'weeks';
  } else if (
    text.includes('theoretical') ||
    text.includes('edge case') ||
    text.includes('requires perfect conditions')
  ) {
    complexity = 'expert';
    likelihood = 'theoretical';
    timeToExploit = 'months';
  }

  // Override likelihood if prerequisites are too restrictive
  if (prerequisites.length > 3) {
    likelihood = 'unlikely';
  }

  // Determine if exploitable in practice
  const exploitableInPractice =
    complexity !== 'expert' &&
    likelihood !== 'theoretical' &&
    likelihood !== 'unlikely';

  // Generate reasoning
  const reasoning = generateFeasibilityReasoning(
    complexity,
    likelihood,
    prerequisites,
    exploitableInPractice
  );

  return {
    prerequisites,
    complexity,
    likelihood,
    timeToExploit,
    exploitableInPractice,
    reasoning,
  };
}

function generateFeasibilityReasoning(
  complexity: string,
  likelihood: string,
  prerequisites: string[],
  exploitable: boolean
): string {
  let reasoning = `Attack complexity: ${complexity}. Likelihood: ${likelihood}.`;

  if (prerequisites.length > 0) {
    reasoning += ` Requires: ${prerequisites.join(', ')}.`;
  }

  if (!exploitable) {
    reasoning += ' This attack is NOT realistically exploitable in practice.';
  } else {
    reasoning += ' This attack IS realistically exploitable.';
  }

  return reasoning;
}

// ============================================================================
// SEVERITY CHALLENGE LOGIC
// ============================================================================

/**
 * Challenge the severity rating with logical reasoning
 * Uses Impact × Likelihood matrix (CVSS-inspired)
 */
export function challengeSeverity(
  finding: FindingLike & { impact?: string; description?: string },
  stakeholderImpact: StakeholderImpact,
  attackFeasibility: AttackFeasibility
): SeverityChallenge {
  const originalSeverity = (finding.severity || 'info').toLowerCase();

  // Calculate impact score (0-10)
  const impactScore = calculateImpactScore(stakeholderImpact);

  // Calculate likelihood score (0-10)
  const likelihoodScore = calculateLikelihoodScore(attackFeasibility);

  // Risk score = Impact × Likelihood (0-100)
  const riskScore = (impactScore * likelihoodScore);

  // Determine challenged severity based on risk score
  let challengedSeverity: string;
  if (riskScore >= 80) challengedSeverity = 'critical';
  else if (riskScore >= 50) challengedSeverity = 'high';
  else if (riskScore >= 25) challengedSeverity = 'medium';
  else if (riskScore >= 10) challengedSeverity = 'low';
  else challengedSeverity = 'info';

  // Determine if we should upgrade or downgrade
  const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
  const originalIndex = severityOrder.indexOf(originalSeverity);
  const challengedIndex = severityOrder.indexOf(challengedSeverity);

  const shouldDowngrade = originalIndex > challengedIndex;
  const shouldUpgrade = originalIndex < challengedIndex;

  // Calculate confidence in the challenge
  const difference = Math.abs(originalIndex - challengedIndex);
  let confidence: 'high' | 'medium' | 'low';
  if (difference >= 2) confidence = 'high';
  else if (difference === 1) confidence = 'medium';
  else confidence = 'low';

  // Generate reasoning
  const reasoning = generateChallengeReasoning(
    originalSeverity,
    challengedSeverity,
    impactScore,
    likelihoodScore,
    riskScore,
    stakeholderImpact,
    attackFeasibility
  );

  // Generate CVSS-like vector
  const cvssVector = `IMPACT:${impactScore}/LIKELIHOOD:${likelihoodScore}/RISK:${riskScore}`;

  return {
    originalSeverity,
    challengedSeverity,
    shouldDowngrade,
    shouldUpgrade,
    confidence,
    reasoning,
    riskScore,
    cvssVector,
  };
}

function calculateImpactScore(impact: StakeholderImpact): number {
  const scoreMap = { none: 0, low: 2.5, medium: 5, high: 7.5, critical: 10 };

  // Weighted average (users matter most)
  const userWeight = 0.4;
  const protocolWeight = 0.4;
  const adminWeight = 0.1;
  const thirdPartyWeight = 0.1;

  return (
    scoreMap[impact.users] * userWeight +
    scoreMap[impact.protocol] * protocolWeight +
    scoreMap[impact.admins] * adminWeight +
    scoreMap[impact.thirdParties] * thirdPartyWeight
  );
}

function calculateLikelihoodScore(feasibility: AttackFeasibility): number {
  const likelihoodMap = {
    certain: 10,
    likely: 7.5,
    possible: 5,
    unlikely: 2.5,
    theoretical: 1,
  };

  const complexityPenalty = {
    trivial: 0,
    low: -1,
    medium: -2,
    high: -3,
    expert: -4,
  };

  let score = likelihoodMap[feasibility.likelihood];
  score += complexityPenalty[feasibility.complexity];

  // Penalty for each prerequisite
  score -= feasibility.prerequisites.length * 0.5;

  return Math.max(0, Math.min(10, score));
}

function generateChallengeReasoning(
  original: string,
  challenged: string,
  impactScore: number,
  likelihoodScore: number,
  riskScore: number,
  stakeholderImpact: StakeholderImpact,
  attackFeasibility: AttackFeasibility
): string {
  let reasoning = '';

  if (original === challenged) {
    reasoning = `Severity rating of "${original}" is CORRECT. `;
    reasoning += `Risk analysis confirms: Impact=${impactScore.toFixed(1)}/10, `;
    reasoning += `Likelihood=${likelihoodScore.toFixed(1)}/10, Risk=${riskScore.toFixed(0)}/100. `;
  } else if (original !== challenged) {
    reasoning = `SEVERITY CHALLENGE: Original "${original}" should be "${challenged}". `;
    reasoning += `Risk analysis shows: Impact=${impactScore.toFixed(1)}/10, `;
    reasoning += `Likelihood=${likelihoodScore.toFixed(1)}/10, Risk=${riskScore.toFixed(0)}/100. `;
  }

  // Add stakeholder context
  reasoning += `Primary victim: ${stakeholderImpact.primaryVictim}. `;

  // Add feasibility context
  if (!attackFeasibility.exploitableInPractice) {
    reasoning += `Attack is NOT realistically exploitable (${attackFeasibility.complexity} complexity, ${attackFeasibility.likelihood} likelihood). `;
  } else {
    reasoning += `Attack IS realistically exploitable (${attackFeasibility.complexity} complexity, ${attackFeasibility.likelihood} likelihood). `;
  }

  // Add key reasoning
  if (impactScore >= 7 && likelihoodScore < 3) {
    reasoning += 'High impact but unlikely - severity may be inflated.';
  } else if (impactScore < 3 && likelihoodScore >= 7) {
    reasoning += 'Low impact despite likelihood - not critical.';
  } else if (impactScore >= 7 && likelihoodScore >= 7) {
    reasoning += 'High impact AND likely - severity justified.';
  } else if (impactScore < 5 && likelihoodScore < 5) {
    reasoning += 'Both impact and likelihood are moderate - severity may be overstated.';
  }

  return reasoning;
}

// ============================================================================
// BUSINESS CONTEXT ANALYSIS
// ============================================================================

/**
 * Analyze if the finding is critical for THIS specific contract type
 */
export function analyzeBusinessContext(
  finding: FindingLike & { description?: string },
  contractType?: string
): BusinessContext {
  const text = `${finding.title} ${finding.description || ''}`.toLowerCase();

  // Detect contract type if not provided
  let detectedType: BusinessContext['contractType'] = contractType as any || 'generic';
  if (!contractType) {
    if (text.includes('erc20') || text.includes('token')) detectedType = 'token';
    else if (text.includes('vault') || text.includes('treasury')) detectedType = 'vault';
    else if (text.includes('defi') || text.includes('swap') || text.includes('liquidity')) detectedType = 'defi';
    else if (text.includes('erc721') || text.includes('nft')) detectedType = 'nft';
    else if (text.includes('governance') || text.includes('voting')) detectedType = 'governance';
    else if (text.includes('proxy') || text.includes('upgrade')) detectedType = 'proxy';
  }

  let criticalityForType: BusinessContext['criticalityForType'] = 'important';
  const contextualFactors: string[] = [];
  let industryStandard = '';

  // Token-specific context
  if (detectedType === 'token') {
    if (text.includes('fee') && text.includes('100%')) {
      criticalityForType = 'catastrophic';
      industryStandard = 'Token fees should be capped below 25%';
      contextualFactors.push('Uncapped fees can honeypot users');
    } else if (text.includes('transfer') && text.includes('blacklist')) {
      criticalityForType = 'critical';
      contextualFactors.push('Blacklist in token transfers is high risk');
    } else if (text.includes('mint') && text.includes('unlimited')) {
      criticalityForType = 'catastrophic';
      industryStandard = 'Unlimited minting can hyperinflate supply';
    }
  }

  // DeFi-specific context
  if (detectedType === 'defi') {
    if (text.includes('oracle') && text.includes('manipulat')) {
      criticalityForType = 'catastrophic';
      industryStandard = 'Oracle manipulation can drain entire protocol';
      contextualFactors.push('Single oracle = single point of failure');
    } else if (text.includes('slippage') && text.includes('sandwich')) {
      criticalityForType = 'important';
      contextualFactors.push('Sandwich attacks cause user losses');
    }
  }

  // Vault-specific context
  if (detectedType === 'vault') {
    if (text.includes('withdraw') && text.includes('stuck')) {
      criticalityForType = 'catastrophic';
      industryStandard = 'Users must always be able to withdraw';
      contextualFactors.push('Stuck funds = protocol death');
    }
  }

  // Governance-specific context
  if (detectedType === 'governance') {
    if (text.includes('vote') && text.includes('manipulat')) {
      criticalityForType = 'catastrophic';
      contextualFactors.push('Vote manipulation undermines entire governance');
    }
  }

  return {
    contractType: detectedType,
    criticalityForType,
    industryStandard,
    contextualFactors,
  };
}

// ============================================================================
// MAIN 10TH MAN ANALYSIS
// ============================================================================

/**
 * Perform comprehensive 10th man analysis on a finding
 */
export async function perform10thManAnalysis(
  finding: FindingLike & {
    impact?: string;
    description?: string;
    code_snippet?: string;
    location?: string;
  },
  contractType?: string
): Promise<TenthManAnalysis> {
  log.info('Performing 10th man analysis', { findingId: finding.id, title: finding.title });

  // 1. Analyze stakeholder impact
  const stakeholderImpact = analyzeStakeholderImpact(finding);

  // 2. Analyze attack feasibility
  const attackFeasibility = analyzeAttackFeasibility(finding);

  // 3. Challenge severity
  const severityChallenge = challengeSeverity(finding, stakeholderImpact, attackFeasibility);

  // 4. Analyze business context
  const businessContext = analyzeBusinessContext(finding, contractType);

  // 5. Generate final verdict
  const finalVerdict = generateFinalVerdict(
    finding,
    stakeholderImpact,
    attackFeasibility,
    severityChallenge,
    businessContext
  );

  return {
    findingId: finding.id || 'unknown',
    findingTitle: finding.title || 'Untitled Finding',
    stakeholderImpact,
    attackFeasibility,
    severityChallenge,
    businessContext,
    finalVerdict,
    timestamp: new Date().toISOString(),
  };
}

function generateFinalVerdict(
  finding: FindingLike & { impact?: string; description?: string },
  stakeholderImpact: StakeholderImpact,
  attackFeasibility: AttackFeasibility,
  severityChallenge: SeverityChallenge,
  businessContext: BusinessContext
): TenthManAnalysis['finalVerdict'] {
  const agreedSeverity = severityChallenge.challengedSeverity;

  // Generate key questions that challenge the finding
  const keyQuestions: string[] = [];
  keyQuestions.push(`Who actually gets hurt? ${stakeholderImpact.primaryVictim}`);
  keyQuestions.push(`Is this attack realistic? ${attackFeasibility.exploitableInPractice ? 'Yes' : 'No'}`);
  keyQuestions.push(`What's the actual risk? ${severityChallenge.riskScore.toFixed(0)}/100`);
  if (businessContext.industryStandard) {
    keyQuestions.push(`Industry standard: ${businessContext.industryStandard}`);
  }

  // Identify red flags (reasons to downgrade)
  const redFlags: string[] = [];
  if (!attackFeasibility.exploitableInPractice) {
    redFlags.push('Attack is not realistically exploitable');
  }
  if (attackFeasibility.prerequisites.length > 2) {
    redFlags.push(`Requires ${attackFeasibility.prerequisites.length} prerequisites`);
  }
  if (stakeholderImpact.primaryVictim === 'none') {
    redFlags.push('No clear victim identified');
  }
  if (attackFeasibility.complexity === 'expert') {
    redFlags.push('Requires expert-level exploitation');
  }
  if (attackFeasibility.likelihood === 'theoretical') {
    redFlags.push('Likelihood is purely theoretical');
  }

  // Identify mitigating factors
  const mitigatingFactors: string[] = [];
  if (businessContext.contextualFactors.length > 0) {
    mitigatingFactors.push(...businessContext.contextualFactors);
  }
  if (attackFeasibility.timeToExploit === 'months' || attackFeasibility.timeToExploit === 'weeks') {
    mitigatingFactors.push('Long time required for exploitation');
  }

  // Generate final reasoning
  let reasoning = severityChallenge.reasoning;

  if (severityChallenge.shouldDowngrade) {
    reasoning += ` RECOMMENDATION: Downgrade from ${severityChallenge.originalSeverity} to ${agreedSeverity}.`;
  } else if (severityChallenge.shouldUpgrade) {
    reasoning += ` RECOMMENDATION: Upgrade from ${severityChallenge.originalSeverity} to ${agreedSeverity}.`;
  } else {
    reasoning += ` RECOMMENDATION: Maintain severity at ${agreedSeverity}.`;
  }

  return {
    agreedSeverity,
    reasoning,
    keyQuestions,
    redFlags,
    mitigatingFactors,
  };
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Perform 10th man analysis on all critical/high findings
 */
export async function analyze10thManForFindings(
  findings: Array<FindingLike & {
    impact?: string;
    description?: string;
    code_snippet?: string;
    location?: string;
  }>,
  contractType?: string
): Promise<TenthManAnalysis[]> {
  const criticalHighFindings = findings.filter(f =>
    ['critical', 'high'].includes((f.severity || '').toLowerCase())
  );

  log.info('Running 10th man analysis batch', {
    totalFindings: findings.length,
    criticalHigh: criticalHighFindings.length,
  });

  const analyses: TenthManAnalysis[] = [];

  for (const finding of criticalHighFindings) {
    try {
      const analysis = await perform10thManAnalysis(finding, contractType);
      analyses.push(analysis);

      if (analysis.severityChallenge.shouldDowngrade) {
        log.warn('10th man recommends DOWNGRADE', {
          findingId: finding.id,
          from: analysis.severityChallenge.originalSeverity,
          to: analysis.severityChallenge.challengedSeverity,
          reason: analysis.severityChallenge.reasoning,
        });
      } else if (analysis.severityChallenge.shouldUpgrade) {
        log.warn('10th man recommends UPGRADE', {
          findingId: finding.id,
          from: analysis.severityChallenge.originalSeverity,
          to: analysis.severityChallenge.challengedSeverity,
          reason: analysis.severityChallenge.reasoning,
        });
      }
    } catch (error: any) {
      log.error('10th man analysis failed for finding', {
        findingId: finding.id,
        error: error.message,
      });
    }
  }

  return analyses;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  perform10thManAnalysis,
  analyze10thManForFindings,
  analyzeStakeholderImpact,
  analyzeAttackFeasibility,
  challengeSeverity,
  analyzeBusinessContext,
};

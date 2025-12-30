/**
 * Pre-Audit Question Generator
 *
 * Generates smart, context-aware questions based on evidence from
 * the pre-audit scan. Questions focus on:
 * - Third-party dependencies
 * - Admin/custody model
 * - Oracle trust assumptions
 * - External integrations
 * - Missing source code
 * - Cross-chain interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type {
  PreAuditEvidence,
  PreAuditQuestion,
  PreAuditQuestionnaire,
  QuestionCategory,
  QuestionOption,
  RiskLevel,
} from '../types/project.js';

const log = logger.child({ service: 'question-generator' });

// ============================================================================
// QUESTION TEMPLATES
// ============================================================================

interface QuestionTemplate {
  category: QuestionCategory;
  triggerCondition: (evidence: PreAuditEvidence) => boolean;
  generateQuestion: (evidence: PreAuditEvidence, componentId: string) => PreAuditQuestion | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

const QUESTION_TEMPLATES: QuestionTemplate[] = [
  // ========== THIRD_PARTY_DEPS ==========
  {
    category: 'THIRD_PARTY_DEPS',
    priority: 'HIGH',
    triggerCondition: (e) => e.detectedPatterns.thirdPartyLibs.length > 0,
    generateQuestion: (e, componentId) => {
      const libs = e.detectedPatterns.thirdPartyLibs.slice(0, 5);
      const libNames = libs.map(l => l.name).join(', ');

      return {
        id: uuidv4(),
        category: 'THIRD_PARTY_DEPS',
        componentId,
        componentLabel: 'Smart Contracts',
        question: `Your code uses third-party libraries (${libNames}). Are these the official versions or modified forks?`,
        options: [
          {
            value: 'official',
            label: 'Official/unmodified versions',
            risk: 'LOW' as RiskLevel,
            description: 'Using verified packages from npm/official sources',
          },
          {
            value: 'fork',
            label: 'Custom forks with modifications',
            risk: 'MEDIUM' as RiskLevel,
            description: 'Modified versions that need separate review',
          },
          {
            value: 'unknown',
            label: 'Not sure / Mixed',
            risk: 'HIGH' as RiskLevel,
            description: 'Uncertain about library provenance',
          },
        ],
        suggestedScope: 'EXTERNAL',
        priority: 'HIGH',
        evidence: `Found ${e.detectedPatterns.thirdPartyLibs.length} third-party libraries in your codebase`,
      };
    },
  },
  {
    category: 'THIRD_PARTY_DEPS',
    priority: 'MEDIUM',
    triggerCondition: (e) =>
      e.detectedPatterns.thirdPartyLibs.some(l =>
        l.name.includes('openzeppelin') ||
        l.name.includes('solmate') ||
        l.name.includes('solady')
      ),
    generateQuestion: (e, componentId) => {
      const securityLibs = e.detectedPatterns.thirdPartyLibs.filter(l =>
        l.name.includes('openzeppelin') ||
        l.name.includes('solmate') ||
        l.name.includes('solady')
      );

      return {
        id: uuidv4(),
        category: 'THIRD_PARTY_DEPS',
        componentId,
        componentLabel: 'Security Libraries',
        question: `You're using security-focused libraries (${securityLibs.map(l => l.name).join(', ')}). Which version are you using?`,
        freeform: true,
        suggestedScope: 'EXTERNAL',
        priority: 'MEDIUM',
        evidence: 'Security libraries detected - version matters for known vulnerabilities',
      };
    },
  },

  // ========== ADMIN_CUSTODY ==========
  {
    category: 'ADMIN_CUSTODY',
    priority: 'HIGH',
    triggerCondition: (e) => e.detectedPatterns.adminPatterns.length > 0,
    generateQuestion: (e, componentId) => {
      const adminCount = e.detectedPatterns.adminPatterns.length;
      const patterns = [...new Set(e.detectedPatterns.adminPatterns.map(p => p.pattern))].slice(0, 3);

      return {
        id: uuidv4(),
        category: 'ADMIN_CUSTODY',
        componentId,
        componentLabel: 'Access Control',
        question: `Your contracts have ${adminCount} admin/owner patterns (${patterns.join(', ')}). What is your custody model for admin keys?`,
        options: [
          {
            value: 'multisig',
            label: 'Multi-signature wallet (Gnosis Safe, etc.)',
            risk: 'LOW' as RiskLevel,
            description: 'Multiple parties must approve admin actions',
          },
          {
            value: 'timelock',
            label: 'Timelock with delay',
            risk: 'LOW' as RiskLevel,
            description: 'Admin actions have mandatory waiting period',
          },
          {
            value: 'dao',
            label: 'DAO/Governance contract',
            risk: 'LOW' as RiskLevel,
            description: 'Token holders vote on admin actions',
          },
          {
            value: 'hot-wallet',
            label: 'Single hot wallet / EOA',
            risk: 'CRITICAL' as RiskLevel,
            description: 'Single point of failure for admin access',
          },
        ],
        suggestedScope: 'INTERNAL',
        priority: 'HIGH',
        evidence: `Found ${adminCount} occurrences of admin/owner access patterns`,
      };
    },
  },
  {
    category: 'ADMIN_CUSTODY',
    priority: 'MEDIUM',
    triggerCondition: (e) =>
      e.detectedPatterns.adminPatterns.some(p =>
        p.pattern.includes('transferOwnership') ||
        p.pattern.includes('renounceOwnership')
      ),
    generateQuestion: (e, componentId) => ({
      id: uuidv4(),
      category: 'ADMIN_CUSTODY',
      componentId,
      componentLabel: 'Ownership Transfer',
      question: 'Your contracts allow ownership transfer/renouncement. Is this functionality intended for production use?',
      options: [
        {
          value: 'immutable',
          label: 'Will renounce ownership before mainnet',
          risk: 'LOW' as RiskLevel,
          description: 'No admin access after deployment',
        },
        {
          value: 'transfer-planned',
          label: 'Will transfer to multisig/DAO',
          risk: 'LOW' as RiskLevel,
          description: 'Ownership moves to secure custody',
        },
        {
          value: 'keep-ownership',
          label: 'Team will retain ownership',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Team maintains admin control',
        },
      ],
      suggestedScope: 'INTERNAL',
      priority: 'MEDIUM',
      evidence: 'Detected ownership transfer/renounce patterns',
    }),
  },

  // ========== ORACLE_TRUST ==========
  {
    category: 'ORACLE_TRUST',
    priority: 'HIGH',
    triggerCondition: (e) => e.detectedPatterns.oracleUsage.length > 0,
    generateQuestion: (e, componentId) => {
      const oracleTypes = [...new Set(e.detectedPatterns.oracleUsage.map(o => o.oracleType))];

      return {
        id: uuidv4(),
        category: 'ORACLE_TRUST',
        componentId,
        componentLabel: 'Price Oracles',
        question: `Your contracts use price oracles (${oracleTypes.slice(0, 3).join(', ')}). What is your fallback mechanism if the oracle fails?`,
        options: [
          {
            value: 'multi-oracle',
            label: 'Multiple oracles with median/aggregation',
            risk: 'LOW' as RiskLevel,
            description: 'Resilient to single oracle failure',
          },
          {
            value: 'circuit-breaker',
            label: 'Circuit breaker / pause mechanism',
            risk: 'MEDIUM' as RiskLevel,
            description: 'Operations halt if oracle is suspicious',
          },
          {
            value: 'twap-fallback',
            label: 'TWAP fallback from DEX',
            risk: 'MEDIUM' as RiskLevel,
            description: 'Uses on-chain price if oracle fails',
          },
          {
            value: 'single-oracle',
            label: 'Single oracle, no fallback',
            risk: 'HIGH' as RiskLevel,
            description: 'Complete dependency on one price source',
          },
        ],
        suggestedScope: 'INTERNAL',
        priority: 'HIGH',
        evidence: `Found ${e.detectedPatterns.oracleUsage.length} oracle usage patterns`,
      };
    },
  },

  // ========== EXTERNAL_INTEGRATION ==========
  {
    category: 'EXTERNAL_INTEGRATION',
    priority: 'HIGH',
    triggerCondition: (e) =>
      e.detectedPatterns.externalCalls.filter(c => c.callType === 'address-reference').length > 0,
    generateQuestion: (e, componentId) => {
      const addresses = e.detectedPatterns.externalCalls
        .filter(c => c.callType === 'address-reference')
        .map(c => c.target);
      const uniqueAddresses = [...new Set(addresses)].slice(0, 3);

      return {
        id: uuidv4(),
        category: 'EXTERNAL_INTEGRATION',
        componentId,
        componentLabel: 'External Contracts',
        question: `Your code references ${uniqueAddresses.length} external contract addresses (e.g., ${uniqueAddresses[0]?.substring(0, 10)}...). Can you provide documentation or source code for these contracts?`,
        options: [
          {
            value: 'verified',
            label: 'All are verified on block explorer',
            risk: 'LOW' as RiskLevel,
            description: 'Source code publicly available',
          },
          {
            value: 'well-known',
            label: 'Well-known protocols (Uniswap, Aave, etc.)',
            risk: 'LOW' as RiskLevel,
            description: 'Audited mainstream protocols',
          },
          {
            value: 'partial',
            label: 'Some are documented, others unknown',
            risk: 'MEDIUM' as RiskLevel,
            description: 'Mixed verification status',
          },
          {
            value: 'unverified',
            label: 'Unverified / proprietary contracts',
            risk: 'HIGH' as RiskLevel,
            description: 'Cannot verify contract behavior',
          },
        ],
        suggestedScope: 'EXTERNAL',
        priority: 'HIGH',
        evidence: `Found ${addresses.length} external contract address references`,
      };
    },
  },
  {
    category: 'EXTERNAL_INTEGRATION',
    priority: 'MEDIUM',
    triggerCondition: (e) =>
      e.detectedPatterns.externalCalls.filter(c => c.callType === 'api-url').length > 0,
    generateQuestion: (e, componentId) => {
      const apiUrls = e.detectedPatterns.externalCalls
        .filter(c => c.callType === 'api-url')
        .map(c => c.target);

      return {
        id: uuidv4(),
        category: 'EXTERNAL_INTEGRATION',
        componentId,
        componentLabel: 'External APIs',
        question: `Your frontend/backend calls external APIs (${[...new Set(apiUrls)].slice(0, 2).join(', ')}). Is the backend code available for audit?`,
        options: [
          {
            value: 'included',
            label: 'Backend code is in this project',
            risk: 'LOW' as RiskLevel,
            description: 'Full stack available for review',
          },
          {
            value: 'separate-repo',
            label: 'Backend is in separate repo (can provide)',
            risk: 'LOW' as RiskLevel,
            description: 'Can add as additional component',
          },
          {
            value: 'third-party',
            label: 'Third-party APIs (not our code)',
            risk: 'MEDIUM' as RiskLevel,
            description: 'External dependencies we cannot audit',
          },
          {
            value: 'not-available',
            label: 'Backend code not available',
            risk: 'HIGH' as RiskLevel,
            description: 'Cannot verify server-side security',
          },
        ],
        suggestedScope: 'EXTERNAL',
        priority: 'MEDIUM',
        evidence: `Found ${apiUrls.length} external API calls`,
      };
    },
  },

  // ========== MISSING_SOURCE ==========
  {
    category: 'MISSING_SOURCE',
    priority: 'HIGH',
    triggerCondition: (e) => e.detectedPatterns.missingRefs.length > 0,
    generateQuestion: (e, componentId) => {
      const missing = e.detectedPatterns.missingRefs.slice(0, 3);

      return {
        id: uuidv4(),
        category: 'MISSING_SOURCE',
        componentId,
        componentLabel: 'Missing Dependencies',
        question: `Some imports could not be resolved (${missing.map(m => m.import).join(', ')}). Are these installed separately or missing?`,
        options: [
          {
            value: 'will-install',
            label: 'Will be installed via package manager',
            risk: 'LOW' as RiskLevel,
            description: 'Standard dependencies to be installed',
          },
          {
            value: 'local-lib',
            label: 'Local/private library (can provide)',
            risk: 'MEDIUM' as RiskLevel,
            description: 'Custom code that can be added',
          },
          {
            value: 'not-available',
            label: 'Source not available',
            risk: 'HIGH' as RiskLevel,
            description: 'Cannot audit these imports',
          },
        ],
        suggestedScope: 'EXTERNAL',
        priority: 'HIGH',
        evidence: `Found ${e.detectedPatterns.missingRefs.length} unresolved imports`,
      };
    },
  },
  {
    category: 'MISSING_SOURCE',
    priority: 'MEDIUM',
    triggerCondition: (e) => e.detectedPatterns.walletPatterns.length > 0,
    generateQuestion: (e, componentId) => ({
      id: uuidv4(),
      category: 'MISSING_SOURCE',
      componentId,
      componentLabel: 'Frontend Security',
      question: 'Your frontend has wallet integration. Do you want a frontend security review included?',
      options: [
        {
          value: 'yes-frontend',
          label: 'Yes, include frontend security review',
          risk: 'LOW' as RiskLevel,
          description: 'Full stack security assessment',
        },
        {
          value: 'contracts-only',
          label: 'No, focus on smart contracts only',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Frontend vulnerabilities out of scope',
        },
      ],
      suggestedScope: 'EXTERNAL',
      priority: 'MEDIUM',
      evidence: `Found ${e.detectedPatterns.walletPatterns.length} frontend wallet integration patterns`,
    }),
  },

  // ========== CROSS_CHAIN ==========
  {
    category: 'CROSS_CHAIN',
    priority: 'HIGH',
    triggerCondition: (e) => {
      const keywords = ['bridge', 'layerzero', 'ccip', 'wormhole', 'axelar', 'hyperlane'];
      const libs = e.detectedPatterns.thirdPartyLibs.map(l => l.name.toLowerCase());
      return libs.some(lib => keywords.some(kw => lib.includes(kw)));
    },
    generateQuestion: (e, componentId) => ({
      id: uuidv4(),
      category: 'CROSS_CHAIN',
      componentId,
      componentLabel: 'Cross-Chain Bridge',
      question: 'Your project appears to involve cross-chain messaging. What bridge/messaging protocol are you using?',
      options: [
        {
          value: 'layerzero',
          label: 'LayerZero',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Oracle + Relayer model',
        },
        {
          value: 'ccip',
          label: 'Chainlink CCIP',
          risk: 'LOW' as RiskLevel,
          description: 'Decentralized oracle network',
        },
        {
          value: 'custom',
          label: 'Custom bridge implementation',
          risk: 'CRITICAL' as RiskLevel,
          description: 'Requires deep security review',
        },
        {
          value: 'other',
          label: 'Other (please specify)',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Will assess based on protocol',
        },
      ],
      suggestedScope: 'INTERNAL',
      priority: 'HIGH',
      evidence: 'Cross-chain/bridge patterns detected in dependencies',
    }),
  },
];

// ============================================================================
// STATIC ANALYSIS QUESTIONS
// ============================================================================

/**
 * Generate questions based on Slither findings
 */
function generateSlitherQuestions(
  evidence: PreAuditEvidence,
  componentId: string
): PreAuditQuestion[] {
  const questions: PreAuditQuestion[] = [];
  const { slither } = evidence.scannerFindings;

  if (!slither) return questions;

  if (slither.critical > 0 || slither.high > 0) {
    questions.push({
      id: uuidv4(),
      category: 'EXTERNAL_INTEGRATION',
      componentId,
      componentLabel: 'Static Analysis',
      question: `Our preliminary scan found ${slither.critical} critical and ${slither.high} high severity issues. Are you aware of these? Some may be false positives.`,
      options: [
        {
          value: 'aware',
          label: 'Yes, aware and will address before audit',
          risk: 'LOW' as RiskLevel,
          description: 'Issues are known and being fixed',
        },
        {
          value: 'investigate',
          label: 'No, please include detailed analysis',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Will review during full audit',
        },
        {
          value: 'false-positive',
          label: 'Believe these are false positives',
          risk: 'MEDIUM' as RiskLevel,
          description: 'Will verify during analysis',
        },
      ],
      suggestedScope: 'INTERNAL',
      priority: 'HIGH',
      evidence: `Slither detected ${slither.critical} critical, ${slither.high} high, ${slither.medium} medium, ${slither.low} low severity findings`,
    });
  }

  return questions;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate pre-audit questions based on evidence
 */
export function generatePreAuditQuestions(
  evidence: PreAuditEvidence,
  componentId: string
): PreAuditQuestion[] {
  log.info('Generating pre-audit questions', { componentId });

  const questions: PreAuditQuestion[] = [];
  const usedCategories = new Set<string>();

  // Apply question templates
  for (const template of QUESTION_TEMPLATES) {
    // Limit to 2 questions per category
    if (usedCategories.has(template.category)) {
      const categoryCount = questions.filter(q => q.category === template.category).length;
      if (categoryCount >= 2) continue;
    }

    if (template.triggerCondition(evidence)) {
      const question = template.generateQuestion(evidence, componentId);
      if (question) {
        questions.push(question);
        usedCategories.add(template.category);
      }
    }
  }

  // Add Slither-based questions
  questions.push(...generateSlitherQuestions(evidence, componentId));

  // Sort by priority (HIGH first)
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  questions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  log.info('Generated questions', {
    count: questions.length,
    categories: [...usedCategories],
  });

  return questions;
}

/**
 * Create a new pre-audit questionnaire
 */
export function createQuestionnaire(
  projectId: string,
  evidence: PreAuditEvidence,
  componentId: string
): PreAuditQuestionnaire {
  const questions = generatePreAuditQuestions(evidence, componentId);

  const questionnaire: PreAuditQuestionnaire = {
    version: '1.0.0',
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: questions.length > 0 ? 'PENDING' : 'COMPLETED',
    evidenceSummary: evidence,
    questions,
    answers: [],
    scopeSummary: {
      likelyInternal: evidence.riskHotspots
        .filter(h => h.suggestedScope === 'INTERNAL')
        .map(h => h.component),
      likelyExternal: evidence.riskHotspots
        .filter(h => h.suggestedScope === 'EXTERNAL')
        .map(h => h.component),
      needsClarification: questions.map(q => q.componentLabel),
    },
  };

  return questionnaire;
}

/**
 * Save questionnaire to disk
 */
export async function saveQuestionnaire(
  contextPath: string,
  questionnaire: PreAuditQuestionnaire
): Promise<string> {
  const { promises: fs } = await import('fs');
  const path = await import('path');

  const questionnairePath = path.join(contextPath, 'preaudit_questionnaire.json');
  await fs.mkdir(path.dirname(questionnairePath), { recursive: true });
  await fs.writeFile(questionnairePath, JSON.stringify(questionnaire, null, 2), 'utf-8');

  log.info('Saved questionnaire', { path: questionnairePath });
  return questionnairePath;
}

/**
 * Load questionnaire from disk
 */
export async function loadQuestionnaire(
  contextPath: string
): Promise<PreAuditQuestionnaire | null> {
  const { promises: fs } = await import('fs');
  const path = await import('path');

  const questionnairePath = path.join(contextPath, 'preaudit_questionnaire.json');
  try {
    const content = await fs.readFile(questionnairePath, 'utf-8');
    return JSON.parse(content) as PreAuditQuestionnaire;
  } catch {
    return null;
  }
}

export default {
  generatePreAuditQuestions,
  createQuestionnaire,
  saveQuestionnaire,
  loadQuestionnaire,
};

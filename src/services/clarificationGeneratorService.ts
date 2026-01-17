/**
 * Clarification Generator Service
 *
 * Generates context-specific clarification questions based on audit findings.
 * Used during Deep scans to resolve ambiguities and gather additional context.
 */

import type { StepFinding } from '../sops/definitions/types.js';
import type { ContractCategory } from '../db/schema.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'clarification-generator' });

// ============================================================================
// Types
// ============================================================================

export interface ClarificationQuestion {
  id: string;
  jobId: string;
  findingId?: string;
  questionText: string;
  questionType: 'yes-no' | 'select' | 'text' | 'multiselect';
  options?: string[];
  context: {
    file?: string;
    line?: number;
    severity?: string;
    snippet?: string;
    category?: string;
  };
  urgency: 'blocking' | 'important' | 'optional';
  phase: 'during-audit';
}

export interface ClarificationRequest {
  questions: ClarificationQuestion[];
  totalQuestions: number;
  blockingQuestions: number;
}

// ============================================================================
// Clarification Generation
// ============================================================================

/**
 * Generate clarification questions from findings
 */
export function generateClarificationQuestions(
  jobId: string,
  findings: StepFinding[],
  contractCategory?: ContractCategory
): ClarificationRequest {
  const questions: ClarificationQuestion[] = [];
  let questionCounter = 0;

  // Filter findings that warrant clarification
  const ambiguousFindings = findings.filter((f) =>
    shouldRequestClarification(f)
  );

  log.info('Generating clarification questions', {
    jobId,
    totalFindings: findings.length,
    ambiguousFindings: ambiguousFindings.length,
  });

  for (const finding of ambiguousFindings) {
    const question = generateQuestionForFinding(jobId, finding, questionCounter++);
    if (question) {
      questions.push(question);
    }
  }

  // Add contract-specific questions
  if (contractCategory) {
    const contractQuestions = generateContractSpecificQuestions(
      jobId,
      contractCategory,
      findings,
      questionCounter
    );
    questions.push(...contractQuestions);
  }

  const blockingCount = questions.filter((q) => q.urgency === 'blocking').length;

  log.info('Clarification questions generated', {
    jobId,
    totalQuestions: questions.length,
    blockingQuestions: blockingCount,
  });

  return {
    questions,
    totalQuestions: questions.length,
    blockingQuestions: blockingCount,
  };
}

/**
 * Determine if a finding warrants clarification
 */
function shouldRequestClarification(finding: StepFinding): boolean {
  // Request clarification for medium severity with low confidence
  if (finding.severity === 'medium' && (finding.confidence || 1) < 0.7) {
    return true;
  }

  // Request clarification for ambiguous access control findings
  if (
    finding.title?.toLowerCase().includes('access control') ||
    finding.title?.toLowerCase().includes('privilege')
  ) {
    return true;
  }

  // Request clarification for external calls
  if (
    finding.title?.toLowerCase().includes('external call') &&
    finding.severity !== 'info'
  ) {
    return true;
  }

  // Request clarification for unusual patterns
  if (
    finding.title?.toLowerCase().includes('unusual') ||
    finding.title?.toLowerCase().includes('suspicious')
  ) {
    return true;
  }

  return false;
}

/**
 * Generate a clarification question for a specific finding
 */
function generateQuestionForFinding(
  jobId: string,
  finding: StepFinding,
  counter: number
): ClarificationQuestion | null {
  const questionId = `clarif-${jobId}-${counter}`;

  // Access control questions
  if (
    finding.title?.toLowerCase().includes('access control') ||
    finding.title?.toLowerCase().includes('onlyowner')
  ) {
    return {
      id: questionId,
      jobId,
      findingId: finding.findingId,
      questionText: `Function "${extractFunctionName(finding)}" has restricted access. Is this access restriction intentional and appropriate for your use case?`,
      questionType: 'select',
      options: [
        'Yes, this is intentional',
        'No, it should be more restrictive',
        'No, it should be less restrictive',
        'Not sure, need to review',
      ],
      context: {
        file: finding.location?.file,
        line: finding.location?.line,
        severity: finding.severity,
        snippet: extractCodeSnippet(finding),
        category: 'access-control',
      },
      urgency: finding.severity === 'high' ? 'important' : 'optional',
      phase: 'during-audit',
    };
  }

  // External call questions
  if (finding.title?.toLowerCase().includes('external call')) {
    return {
      id: questionId,
      jobId,
      findingId: finding.findingId,
      questionText: `External call detected to "${extractContractName(finding)}". Is this contract trusted or user-controlled?`,
      questionType: 'select',
      options: [
        'Known trusted contract (e.g., USDC, Chainlink)',
        'Internal contract we control',
        'User-provided address',
        'Unknown/uncertain',
      ],
      context: {
        file: finding.location?.file,
        line: finding.location?.line,
        severity: finding.severity,
        snippet: extractCodeSnippet(finding),
        category: 'external-calls',
      },
      urgency: finding.severity === 'high' ? 'blocking' : 'important',
      phase: 'during-audit',
    };
  }

  // Transfer restrictions
  if (finding.title?.toLowerCase().includes('transfer') && finding.title?.toLowerCase().includes('restriction')) {
    return {
      id: questionId,
      jobId,
      findingId: finding.findingId,
      questionText: `Transfer restrictions detected. Are these restrictions intentional for compliance or security purposes?`,
      questionType: 'select',
      options: [
        'Yes, required for compliance',
        'Yes, security feature',
        'No, unintended restriction',
        'Partially intentional',
      ],
      context: {
        file: finding.location?.file,
        line: finding.location?.line,
        severity: finding.severity,
        snippet: extractCodeSnippet(finding),
        category: 'token-economics',
      },
      urgency: 'optional',
      phase: 'during-audit',
    };
  }

  // Default for other findings
  if (finding.severity === 'medium') {
    return {
      id: questionId,
      jobId,
      findingId: finding.findingId,
      questionText: `We found: "${finding.title}". Is this pattern intentional in your design?`,
      questionType: 'yes-no',
      options: ['Yes', 'No'],
      context: {
        file: finding.location?.file,
        line: finding.location?.line,
        severity: finding.severity,
        snippet: extractCodeSnippet(finding),
      },
      urgency: 'optional',
      phase: 'during-audit',
    };
  }

  return null;
}

/**
 * Generate contract-type specific clarification questions
 */
function generateContractSpecificQuestions(
  jobId: string,
  category: ContractCategory,
  findings: StepFinding[],
  startCounter: number
): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  let counter = startCounter;

  switch (category) {
    case 'erc20-token':
      // Check for fee mechanisms
      const hasFeeFindings = findings.some((f) =>
        f.title?.toLowerCase().includes('fee')
      );
      if (hasFeeFindings) {
        questions.push({
          id: `clarif-${jobId}-${counter++}`,
          jobId,
          questionText: 'Transfer fees detected. What is the maximum fee percentage that can be set?',
          questionType: 'text',
          context: {
            category: 'token-economics',
          },
          urgency: 'important',
          phase: 'during-audit',
        });
      }
      break;

    case 'defi-amm':
    case 'defi-lending':
      // Check for oracle usage
      const hasOracleFindings = findings.some((f) =>
        f.title?.toLowerCase().includes('oracle') || f.title?.toLowerCase().includes('price')
      );
      if (hasOracleFindings) {
        questions.push({
          id: `clarif-${jobId}-${counter++}`,
          jobId,
          questionText: 'Oracle manipulation risk detected. What protections are in place against flash loan attacks?',
          questionType: 'multiselect',
          options: [
            'TWAP (Time-Weighted Average Price)',
            'Minimum block delay',
            'Multiple oracle sources',
            'None',
          ],
          context: {
            category: 'defi-security',
          },
          urgency: 'blocking',
          phase: 'during-audit',
        });
      }
      break;

    case 'proxy-upgradeable':
      questions.push({
        id: `clarif-${jobId}-${counter++}`,
        jobId,
        questionText: 'Upgradeable proxy detected. Who has upgrade authority and is there a timelock?',
        questionType: 'select',
        options: [
          'Multisig with timelock (48+ hours)',
          'Multisig without timelock',
          'Single address (EOA)',
          'DAO governance',
        ],
        context: {
          category: 'proxy-security',
        },
        urgency: 'blocking',
        phase: 'during-audit',
      });
      break;
  }

  return questions;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractFunctionName(finding: StepFinding): string {
  // Try to extract function name from description or title
  const text = finding.description || finding.title || '';
  const match = text.match(/(?:function|method)\s+`?(\w+)`?/i);
  return match ? match[1] : 'unknown function';
}

function extractContractName(finding: StepFinding): string {
  // Try to extract contract name from description
  const text = finding.description || finding.title || '';
  const match = text.match(/contract\s+`?(\w+)`?/i);
  return match ? match[1] : 'unknown contract';
}

function extractCodeSnippet(finding: StepFinding): string | undefined {
  // Return raw output if available
  if (typeof finding.rawOutput === 'string') {
    return finding.rawOutput.substring(0, 200);
  }

  if (finding.rawOutput && typeof finding.rawOutput === 'object') {
    return JSON.stringify(finding.rawOutput, null, 2).substring(0, 200);
  }

  return finding.description?.substring(0, 200);
}

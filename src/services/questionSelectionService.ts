/**
 * Question Selection Service
 *
 * Intelligently selects and filters pre-audit questions based on:
 * - Detected contract type (from contract classification)
 * - Audit depth (Quick/Standard/Deep)
 * - Priority levels (HIGH/MEDIUM/LOW)
 *
 * Used by: Pre-audit questionnaire endpoint and UI
 */

import type { ContractCategory } from '../db/schema';
import { getQuestionsForCategory, getRequiredQuestions, getQuestionsGroupedByCategory, type PreAuditQuestion, type QuestionPriority } from './questionTemplates';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'question-selection' });

// ============================================================================
// Types
// ============================================================================

export interface QuestionSelectionCriteria {
  contractCategory?: ContractCategory;
  auditDepth: 'quick' | 'standard' | 'deep';
  includeOptional?: boolean; // Include MEDIUM/LOW priority questions
  customFilters?: {
    excludeCategories?: string[];
    onlyCategories?: string[];
    minPriority?: QuestionPriority;
  };
}

export interface SelectedQuestions {
  questions: PreAuditQuestion[];
  groupedByCategory: Record<string, PreAuditQuestion[]>;
  metadata: {
    totalQuestions: number;
    requiredQuestions: number;
    optionalQuestions: number;
    contractCategory: ContractCategory;
    categoriesIncluded: string[];
  };
}

// ============================================================================
// Main Selection Function
// ============================================================================

/**
 * Select questions based on contract type and audit configuration
 */
export function selectQuestions(criteria: QuestionSelectionCriteria): SelectedQuestions {
  const contractCategory = criteria.contractCategory || 'generic';

  log.debug('Selecting questions', {
    contractCategory,
    auditDepth: criteria.auditDepth,
    includeOptional: criteria.includeOptional,
  });

  // Get base questions for this contract type
  let questions = getQuestionsForCategory(contractCategory);

  // Apply depth-based filtering
  questions = filterByDepth(questions, criteria.auditDepth);

  // Apply priority filtering
  if (!criteria.includeOptional) {
    // Only include HIGH priority questions for Quick/Standard scans
    questions = questions.filter((q) => q.priority === 'HIGH');
  } else {
    // For Deep scans, include all priorities but can filter by minimum
    if (criteria.customFilters?.minPriority) {
      questions = filterByMinPriority(questions, criteria.customFilters.minPriority);
    }
  }

  // Apply custom category filters
  if (criteria.customFilters) {
    if (criteria.customFilters.excludeCategories) {
      questions = questions.filter(
        (q) => !criteria.customFilters!.excludeCategories!.includes(q.category)
      );
    }

    if (criteria.customFilters.onlyCategories) {
      questions = questions.filter(
        (q) => criteria.customFilters!.onlyCategories!.includes(q.category)
      );
    }
  }

  // Group questions by category
  const groupedByCategory = groupQuestions(questions);

  // Calculate metadata
  const requiredCount = questions.filter((q) => q.priority === 'HIGH').length;
  const optionalCount = questions.length - requiredCount;
  const categoriesIncluded = Object.keys(groupedByCategory);

  const result: SelectedQuestions = {
    questions,
    groupedByCategory,
    metadata: {
      totalQuestions: questions.length,
      requiredQuestions: requiredCount,
      optionalQuestions: optionalCount,
      contractCategory,
      categoriesIncluded,
    },
  };

  log.info('Questions selected', {
    contractCategory,
    total: result.metadata.totalQuestions,
    required: result.metadata.requiredQuestions,
    optional: result.metadata.optionalQuestions,
    categories: result.metadata.categoriesIncluded,
  });

  return result;
}

/**
 * Get only required questions (HIGH priority)
 */
export function selectRequiredQuestions(contractCategory: ContractCategory): PreAuditQuestion[] {
  const questions = getRequiredQuestions(contractCategory);

  log.debug('Selected required questions only', {
    contractCategory,
    count: questions.length,
  });

  return questions;
}

/**
 * Get questions grouped by category for a specific contract type
 */
export function selectGroupedQuestions(contractCategory: ContractCategory): Record<string, PreAuditQuestion[]> {
  return getQuestionsGroupedByCategory(contractCategory);
}

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Filter questions based on audit depth
 */
function filterByDepth(
  questions: PreAuditQuestion[],
  depth: 'quick' | 'standard' | 'deep'
): PreAuditQuestion[] {
  switch (depth) {
    case 'quick':
      // Quick scans: Only essential HIGH priority questions
      return questions.filter((q) => q.priority === 'HIGH' && isEssentialForQuickScan(q));

    case 'standard':
      // Standard scans: All HIGH priority questions
      return questions.filter((q) => q.priority === 'HIGH');

    case 'deep':
      // Deep scans: All questions (HIGH, MEDIUM, LOW)
      return questions;

    default:
      return questions.filter((q) => q.priority === 'HIGH');
  }
}

/**
 * Check if question is essential for quick scans
 */
function isEssentialForQuickScan(question: PreAuditQuestion): boolean {
  // Only the most critical questions for quick scans
  const essentialKeys = [
    'project_description',
    'admin_privileges',
    'token_supply_cap', // For ERC20
    'token_transfer_restrictions', // For ERC20
    'nft_max_supply', // For NFT
    'nft_metadata_storage', // For NFT
    'defi_oracle_provider', // For DeFi
    'defi_flash_loan_protection', // For DeFi
    'gov_flash_loan_protection', // For Governance
    'proxy_upgrade_authority', // For Proxy
  ];

  return essentialKeys.includes(question.key);
}

/**
 * Filter by minimum priority level
 */
function filterByMinPriority(
  questions: PreAuditQuestion[],
  minPriority: QuestionPriority
): PreAuditQuestion[] {
  const priorityOrder: Record<QuestionPriority, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const minLevel = priorityOrder[minPriority];

  return questions.filter((q) => priorityOrder[q.priority] >= minLevel);
}

/**
 * Group questions by category
 */
function groupQuestions(questions: PreAuditQuestion[]): Record<string, PreAuditQuestion[]> {
  const grouped: Record<string, PreAuditQuestion[]> = {};

  for (const question of questions) {
    if (!grouped[question.category]) {
      grouped[question.category] = [];
    }
    grouped[question.category].push(question);
  }

  // Sort questions within each category by priority (HIGH first)
  for (const category in grouped) {
    grouped[category].sort((a, b) => {
      const priorityOrder: Record<QuestionPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  return grouped;
}

// ============================================================================
// Question Validation
// ============================================================================

/**
 * Validate answers against question requirements
 */
export function validateAnswers(
  questions: PreAuditQuestion[],
  answers: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const question of questions) {
    const answer = answers[question.key];

    // Check required questions
    if (question.priority === 'HIGH' || question.validation?.required) {
      if (answer === undefined || answer === null || answer === '') {
        errors.push(`Question "${question.text}" is required`);
        continue;
      }
    }

    // Skip validation if no answer provided for optional questions
    if (answer === undefined || answer === null || answer === '') {
      continue;
    }

    // Type-specific validation
    if (question.type === 'text' || question.type === 'textarea') {
      const textAnswer = String(answer);

      // Min length
      if (question.validation?.minLength && textAnswer.length < question.validation.minLength) {
        errors.push(
          `Question "${question.text}" requires at least ${question.validation.minLength} characters`
        );
      }

      // Max length
      if (question.validation?.maxLength && textAnswer.length > question.validation.maxLength) {
        errors.push(
          `Question "${question.text}" must not exceed ${question.validation.maxLength} characters`
        );
      }

      // Pattern validation
      if (question.validation?.pattern) {
        const regex = new RegExp(question.validation.pattern);
        if (!regex.test(textAnswer)) {
          errors.push(`Question "${question.text}" has invalid format`);
        }
      }
    }

    // Select validation
    if (question.type === 'select' && question.options) {
      if (!question.options.includes(answer)) {
        errors.push(`Question "${question.text}" has invalid selection`);
      }
    }

    // Multiselect validation
    if (question.type === 'multiselect' && question.options) {
      if (!Array.isArray(answer)) {
        errors.push(`Question "${question.text}" must be an array of selections`);
      } else {
        for (const selection of answer) {
          if (!question.options.includes(selection)) {
            errors.push(`Question "${question.text}" has invalid selection: ${selection}`);
          }
        }
      }
    }

    // Confirm validation
    if (question.type === 'confirm') {
      if (typeof answer !== 'boolean') {
        errors.push(`Question "${question.text}" must be true or false`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Helper: Get question by key
// ============================================================================

/**
 * Find a specific question by key across all contract types
 */
export function findQuestionByKey(
  questionKey: string,
  contractCategory?: ContractCategory
): PreAuditQuestion | undefined {
  const category = contractCategory || 'generic';
  const questions = getQuestionsForCategory(category);
  return questions.find((q) => q.key === questionKey);
}

// ============================================================================
// Category-Specific Question Counts
// ============================================================================

/**
 * Get statistics about questions for each contract category
 */
export function getQuestionStatistics(): Record<
  ContractCategory,
  { total: number; required: number; optional: number; categories: string[] }
> {
  const categories: ContractCategory[] = [
    'erc20-token',
    'erc721-nft',
    'erc1155-multi',
    'defi-amm',
    'defi-lending',
    'defi-staking',
    'governance',
    'bridge',
    'proxy-upgradeable',
    'multisig-wallet',
    'generic',
  ];

  const stats: Record<string, any> = {};

  for (const category of categories) {
    const questions = getQuestionsForCategory(category);
    const grouped = getQuestionsGroupedByCategory(category);
    const required = questions.filter((q) => q.priority === 'HIGH').length;
    const optional = questions.length - required;

    stats[category] = {
      total: questions.length,
      required,
      optional,
      categories: Object.keys(grouped),
    };
  }

  return stats;
}

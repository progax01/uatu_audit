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
import { getQuestionsForCategory, getRequiredQuestions, getQuestionsGroupedByCategory, getConditionalQuestions, type PreAuditQuestion, type QuestionPriority, type QuestionType } from './questionTemplates';
import { extractCodeContext, type CodeAnalysisContext } from './codeAnalysisContext';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'question-selection' });

// ============================================================================
// Types
// ============================================================================

export interface QuestionSelectionCriteria {
  contractCategory?: ContractCategory;
  auditDepth: 'quick' | 'standard' | 'deep';
  includeOptional?: boolean; // Include MEDIUM/LOW priority questions
  classification?: any; // Contract classification for dynamic questions
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
    hasClassification: !!criteria.classification,
  });

  // Extract code analysis context
  const codeContext = criteria.classification
    ? extractCodeContext(criteria.classification)
    : extractCodeContext(null);

  // Get base questions for this contract type
  let questions = getQuestionsForCategory(contractCategory);

  // Add conditional questions based on code analysis
  const conditionalQuestions = getConditionalQuestions();
  const applicableConditionalQuestions = conditionalQuestions.filter((q) => {
    // Check if condition is met
    return q.condition ? q.condition(codeContext) : true;
  });

  questions = [...questions, ...applicableConditionalQuestions];

  // Apply code context to generate dynamic text and options
  questions = questions.map((q) => {
    const processedQuestion = { ...q };

    // Generate dynamic text if function
    if (typeof q.text === 'function') {
      processedQuestion.text = q.text(codeContext);
    }

    // Generate dynamic options if function
    if (typeof q.options === 'function') {
      processedQuestion.options = q.options(codeContext);
    }

    return processedQuestion;
  });

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
    conditionalQuestionsAdded: applicableConditionalQuestions.length,
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
      const resolvedOptions = typeof question.options === 'function' ? question.options({} as any) : question.options;
      const optionValues = resolvedOptions.map((opt: any) => typeof opt === 'string' ? opt : opt.value);
      if (!optionValues.includes(answer)) {
        const questionText = typeof question.text === 'function' ? question.text({} as any) : question.text;
        errors.push(`Question "${questionText}" has invalid selection`);
      }
    }

    // Multiselect validation
    if (question.type === 'multiselect' && question.options) {
      if (!Array.isArray(answer)) {
        const questionText = typeof question.text === 'function' ? question.text({} as any) : question.text;
        errors.push(`Question "${questionText}" must be an array of selections`);
      } else {
        const resolvedOptions = typeof question.options === 'function' ? question.options({} as any) : question.options;
        const optionValues = resolvedOptions.map((opt: any) => typeof opt === 'string' ? opt : opt.value);
        for (const selection of answer) {
          if (!optionValues.includes(selection)) {
            const questionText = typeof question.text === 'function' ? question.text({} as any) : question.text;
            errors.push(`Question "${questionText}" has invalid selection: ${selection}`);
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

// ============================================================================
// Flow-Based Question Selection
// ============================================================================

/**
 * Map flow-based answer type to PreAuditQuestion type
 */
function mapAnswerTypeToQuestionType(answerType: 'text' | 'choice' | 'boolean'): QuestionType {
  switch (answerType) {
    case 'text':
      return 'textarea';
    case 'choice':
      return 'select';
    case 'boolean':
      return 'confirm';
    default:
      return 'text';
  }
}

/**
 * Select questions from user flow analysis
 * This integrates with the new flow-based questionnaire system
 */
export async function selectQuestionsFromFlows(
  auditJobId: string,
  depth: 'quick' | 'standard' | 'deep'
): Promise<PreAuditQuestion[]> {
  try {
    // Import flow-based question generator
    const { generateFlowBasedQuestions, prioritizeQuestions } = await import('./flowBasedQuestionGenerator.js');

    // Get user flow analysis from audit results metadata
    const { getDb } = await import('../db/index.js');
    const { auditResults, auditJobs } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const db = getDb();

    // Get audit results which contains metadata
    const [result] = await db.select().from(auditResults).where(eq(auditResults.jobId, auditJobId));

    if (!result) {
      log.warn('Audit results not found', { auditJobId });
      // Fallback to legacy question selection
      return [];
    }

    const metadata = result.metadata as any;
    const flowAnalysis = metadata?.userFlowAnalysis;

    if (!flowAnalysis) {
      log.warn('User flow analysis not found in results metadata', { auditJobId });
      // Fallback to legacy question selection
      return [];
    }

    // Generate flow-based questions
    const contractTypes = metadata?.contractTypes || [];
    const flowQuestions = await generateFlowBasedQuestions(flowAnalysis.flows, contractTypes);

    // Filter by priority based on depth
    let filteredQuestions = flowQuestions;
    if (depth === 'quick') {
      filteredQuestions = flowQuestions.filter((q) => q.priority === 'high');
    } else if (depth === 'standard') {
      filteredQuestions = flowQuestions.filter((q) => q.priority !== 'low');
    }

    // Prioritize questions
    const prioritized = prioritizeQuestions(filteredQuestions, depth === 'quick' ? 5 : undefined);

    // Convert to PreAuditQuestion format
    const preAuditQuestions: PreAuditQuestion[] = prioritized.map((fq) => ({
      key: fq.id,
      category: fq.category,
      text: fq.question,
      type: mapAnswerTypeToQuestionType(fq.answerType),
      options: fq.choices,
      priority: fq.priority.toUpperCase() as QuestionPriority,
      helpText: `Flow: ${fq.context.flowName}. Affected functions: ${fq.context.affectedFunctions.join(', ')}`,
      validation: undefined,
    }));

    log.info('Flow-based questions selected', {
      auditJobId,
      depth,
      totalFlows: flowAnalysis.flows.length,
      questionsGenerated: flowQuestions.length,
      questionsSelected: preAuditQuestions.length,
    });

    return preAuditQuestions;
  } catch (error: any) {
    log.error('Failed to select flow-based questions', {
      auditJobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Merge flow-based questions with traditional questions
 * This provides a unified questionnaire that includes both
 */
export async function selectMergedQuestions(
  auditJobId: string,
  criteria: QuestionSelectionCriteria
): Promise<SelectedQuestions> {
  // Get traditional questions
  const traditionalResult = selectQuestions(criteria);

  try {
    // Get flow-based questions
    const flowQuestions = await selectQuestionsFromFlows(auditJobId, criteria.auditDepth);

    // Merge questions (flow questions come first as they're more specific)
    const mergedQuestions = [...flowQuestions, ...traditionalResult.questions];

    // Re-group by category
    const groupedByCategory = groupQuestions(mergedQuestions);

    // Update metadata
    const requiredCount = mergedQuestions.filter((q) => q.priority === 'HIGH').length;
    const optionalCount = mergedQuestions.length - requiredCount;

    log.info('Questions merged', {
      flowQuestions: flowQuestions.length,
      traditionalQuestions: traditionalResult.questions.length,
      merged: mergedQuestions.length,
    });

    return {
      questions: mergedQuestions,
      groupedByCategory,
      metadata: {
        totalQuestions: mergedQuestions.length,
        requiredQuestions: requiredCount,
        optionalQuestions: optionalCount,
        contractCategory: criteria.contractCategory || 'generic',
        categoriesIncluded: Object.keys(groupedByCategory),
      },
    };
  } catch (error: any) {
    log.warn('Failed to merge flow-based questions, using traditional only', {
      error: error.message,
    });
    // Fallback to traditional questions if flow-based fails
    return traditionalResult;
  }
}

// ============================================================================
// Claude Session Tracking
// ============================================================================

/**
 * Build resumption prompt for answering a question later via Claude CLI
 */
export function buildResumptionPrompt(question: PreAuditQuestion, context?: any): string {
  let prompt = `I previously asked you about the audit and need your response:\n\n`;
  const questionText = typeof question.text === 'function' ? question.text({} as any) : question.text;
  prompt += `**Question:** ${questionText}\n\n`;

  if (question.category) {
    prompt += `**Category:** ${question.category}\n\n`;
  }

  if (context) {
    prompt += `**Context:**\n`;
    if (context.flowName) {
      prompt += `- Flow: ${context.flowName}\n`;
    }
    if (context.affectedFunctions?.length > 0) {
      prompt += `- Affected Functions: ${context.affectedFunctions.join(', ')}\n`;
    }
    if (context.contracts?.length > 0) {
      prompt += `- Contracts: ${context.contracts.join(', ')}\n`;
    }
    prompt += `\n`;
  }

  if (question.options) {
    const resolvedOptions = typeof question.options === 'function' ? question.options({} as any) : question.options;
    if (resolvedOptions && resolvedOptions.length > 0) {
      prompt += `**Options:**\n`;
      for (const option of resolvedOptions) {
        if (typeof option === 'string') {
          prompt += `- ${option}\n`;
        } else {
          prompt += `- ${option.value}: ${option.label}\n`;
        }
      }
      prompt += `\n`;
    }
  }

  prompt += `Please provide your answer now.`;

  return prompt;
}

/**
 * Save questions with Claude session tracking
 */
export async function saveQuestionsWithSession(
  jobId: string,
  questions: PreAuditQuestion[],
  claudeSessionId?: string,
  claudeConversationId?: string
): Promise<void> {
  const { getDb } = await import('../db/index.js');
  const { auditClarifications } = await import('../db/schema.js');

  const db = getDb();

  const clarifications = questions.map((q) => {
    const questionText = typeof q.text === 'function' ? q.text({} as any) : q.text;
    const resolvedOptions = q.options
      ? (typeof q.options === 'function' ? q.options({} as any) : q.options)
      : null;

    return {
      jobId,
      phase: 'pre_audit' as const,
      questionKey: q.key,
      questionText,
      questionType: q.type,
      options: resolvedOptions ? JSON.stringify(resolvedOptions) : null,
      context: null,
      status: 'pending' as const,
      claudeSessionId: claudeSessionId || null,
      claudeConversationId: claudeConversationId || null,
      resumptionPrompt: buildResumptionPrompt(q),
    };
  });

  await db.insert(auditClarifications).values(clarifications);

  log.info('Saved questions with Claude session tracking', {
    jobId,
    questionCount: questions.length,
    hasClaudeSession: !!claudeSessionId,
  });
}

/**
 * Resume audit with user answers from Claude CLI session
 */
export async function resumeAuditWithAnswers(
  jobId: string
): Promise<{ hasAnswers: boolean; pendingCount: number }> {
  const { getDb } = await import('../db/index.js');
  const { auditClarifications } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');

  const db = getDb();

  // Get all clarifications for this job
  const clarifications = await db
    .select()
    .from(auditClarifications)
    .where(eq(auditClarifications.jobId, jobId));

  const pendingQuestions = clarifications.filter((c) => c.status === 'pending');
  const answeredQuestions = clarifications.filter((c) => c.status === 'answered');

  log.info('Audit question status', {
    jobId,
    total: clarifications.length,
    pending: pendingQuestions.length,
    answered: answeredQuestions.length,
  });

  return {
    hasAnswers: answeredQuestions.length > 0,
    pendingCount: pendingQuestions.length,
  };
}

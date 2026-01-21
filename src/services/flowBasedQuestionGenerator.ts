import type { UserFlow } from './userFlowAnalyzer.js';

export interface FlowBasedQuestion {
  id: string;
  category: 'flow-permission' | 'flow-design' | 'flow-liability' | 'state-transition';
  priority: 'high' | 'medium' | 'low';
  question: string;
  context: {
    flowId: string;
    flowName: string;
    affectedFunctions: string[];
  };
  answerType: 'text' | 'choice' | 'boolean';
  choices?: string[];
}

/**
 * Generate flow-aware questions based on user flow analysis
 * These questions help understand design intent and liability for user interaction patterns
 */
export async function generateFlowBasedQuestions(
  flows: UserFlow[],
  contractTypes: string[]
): Promise<FlowBasedQuestion[]> {
  const questions: FlowBasedQuestion[] = [];

  // 1. Permission-based questions
  for (const flow of flows) {
    if (flow.requiredPermissions.length > 0) {
      questions.push({
        id: `flow_permission_${flow.id}`,
        category: 'flow-permission',
        priority: 'high',
        question: `The flow "${flow.name}" requires ${flow.requiredPermissions.join(', ')} permissions. Is this intended, and what safeguards are in place?`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'text',
      });
    }

    // Multi-step permission changes
    if (flow.requiredPermissions.length > 1) {
      questions.push({
        id: `flow_multi_permission_${flow.id}`,
        category: 'flow-permission',
        priority: 'high',
        question: `The flow "${flow.name}" changes permissions ${flow.requiredPermissions.length} times (${flow.requiredPermissions.join(' → ')}). Can a user escalate privileges through this sequence?`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'choice',
        choices: [
          'No - each step independently validates permissions',
          'Yes, but this is intended behavior for governance',
          'Yes, this is a known issue we plan to fix',
          'Unsure - needs security review',
        ],
      });
    }
  }

  // 2. State transition questions
  const complexFlows = flows.filter((f) => f.stateTransitions.length > 2);
  for (const flow of complexFlows) {
    questions.push({
      id: `flow_state_${flow.id}`,
      category: 'state-transition',
      priority: 'medium',
      question: `The flow "${flow.name}" modifies ${flow.stateTransitions.length} state variables (${flow.stateTransitions.slice(0, 3).join(', ')}${flow.stateTransitions.length > 3 ? '...' : ''}). Are these changes atomic, and what happens if the transaction reverts mid-flow?`,
      context: {
        flowId: flow.id,
        flowName: flow.name,
        affectedFunctions: flow.steps.map((s) => s.functionName),
      },
      answerType: 'text',
    });

    // Check for re-entrancy concerns
    const hasExternalCalls = flow.steps.some((s) => s.externalCalls.length > 0);
    if (hasExternalCalls && flow.stateTransitions.length > 0) {
      questions.push({
        id: `flow_reentrancy_${flow.id}`,
        category: 'state-transition',
        priority: 'high',
        question: `The flow "${flow.name}" makes external calls and modifies state. Have you considered re-entrancy protection (e.g., Checks-Effects-Interactions pattern, ReentrancyGuard)?`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'choice',
        choices: [
          'Yes - using ReentrancyGuard modifier',
          'Yes - following Checks-Effects-Interactions pattern',
          'Yes - trusted external calls only (no re-entrancy risk)',
          'No - re-entrancy protection not implemented',
        ],
      });
    }
  }

  // 3. Liability declaration questions
  const riskyFlows = flows.filter((f) => f.risks.length > 0);
  for (const flow of riskyFlows) {
    questions.push({
      id: `flow_liability_${flow.id}`,
      category: 'flow-liability',
      priority: 'high',
      question: `The flow "${flow.name}" has identified risks: ${flow.risks[0]}. Is this a known design decision, and who bears responsibility if exploited?`,
      context: {
        flowId: flow.id,
        flowName: flow.name,
        affectedFunctions: flow.steps.map((s) => s.functionName),
      },
      answerType: 'choice',
      choices: [
        'Internal responsibility - team will fix if exploited',
        'External dependency - third-party risk',
        'Accepted risk - disclosed in documentation',
        'False positive - not actually exploitable',
      ],
    });

    // Additional risk context questions
    if (flow.risks.length > 1) {
      questions.push({
        id: `flow_risk_context_${flow.id}`,
        category: 'flow-liability',
        priority: 'medium',
        question: `The flow "${flow.name}" has ${flow.risks.length} identified risks. Please describe your risk mitigation strategy for this flow.`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'text',
      });
    }
  }

  // 4. Design intent questions
  for (const flow of flows) {
    if (flow.steps.length > 4) {
      questions.push({
        id: `flow_design_${flow.id}`,
        category: 'flow-design',
        priority: 'low',
        question: `The flow "${flow.name}" involves ${flow.steps.length} steps. Can you describe the intended user journey and expected outcome?`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'text',
      });
    }

    // Public entry points with complex flows
    if (
      (flow.entryPoint.visibility === 'public' || flow.entryPoint.visibility === 'external') &&
      flow.steps.length > 3
    ) {
      questions.push({
        id: `flow_public_exposure_${flow.id}`,
        category: 'flow-design',
        priority: 'medium',
        question: `The public function "${flow.entryPoint.functionName}" triggers a ${flow.steps.length}-step execution path. Is this level of exposure intentional?`,
        context: {
          flowId: flow.id,
          flowName: flow.name,
          affectedFunctions: flow.steps.map((s) => s.functionName),
        },
        answerType: 'boolean',
      });
    }
  }

  // 5. Cross-flow questions (interactions between flows)
  const privilegedFlows = flows.filter((f) => f.requiredPermissions.length > 0);
  const publicFlows = flows.filter(
    (f) => f.entryPoint.visibility === 'public' || f.entryPoint.visibility === 'external'
  );

  if (privilegedFlows.length > 0 && publicFlows.length > 0) {
    questions.push({
      id: 'cross_flow_privilege',
      category: 'flow-permission',
      priority: 'high',
      question: `Your contract has ${privilegedFlows.length} privileged flows and ${publicFlows.length} public flows. Can public flows be chained together to bypass privileged function access controls?`,
      context: {
        flowId: 'cross_flow',
        flowName: 'Cross-Flow Analysis',
        affectedFunctions: [
          ...privilegedFlows.map((f) => f.name),
          ...publicFlows.map((f) => f.name),
        ],
      },
      answerType: 'choice',
      choices: [
        'No - all privileged operations are properly protected',
        'Unsure - needs further analysis',
        'Yes, but this is intended for composability',
        'Yes, this is a security concern',
      ],
    });
  }

  return questions;
}

/**
 * Convert flow-based questions to audit clarifications format
 */
export function toAuditClarifications(
  questions: FlowBasedQuestion[],
  auditJobId: string
): Array<{
  auditJobId: string;
  phase: string;
  questionKey: string;
  questionText: string;
  questionCategory: string;
  priority: string;
  status: string;
  metadata: any;
}> {
  return questions.map((q) => ({
    auditJobId,
    phase: 'pre_audit',
    questionKey: q.id,
    questionText: q.question,
    questionCategory: q.category,
    priority: q.priority,
    status: 'pending',
    metadata: {
      ...q.context,
      answerType: q.answerType,
      choices: q.choices,
    },
  }));
}

/**
 * Prioritize questions based on risk level
 */
export function prioritizeQuestions(
  questions: FlowBasedQuestion[],
  maxQuestions?: number
): FlowBasedQuestion[] {
  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = questions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Limit to max questions if specified
  if (maxQuestions) {
    return sorted.slice(0, maxQuestions);
  }

  return sorted;
}

/**
 * Group questions by category
 */
export function groupQuestionsByCategory(
  questions: FlowBasedQuestion[]
): Record<string, FlowBasedQuestion[]> {
  return questions.reduce((acc, q) => {
    if (!acc[q.category]) {
      acc[q.category] = [];
    }
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, FlowBasedQuestion[]>);
}

/**
 * Generate summary of questions
 */
export function summarizeQuestions(questions: FlowBasedQuestion[]): string {
  const byCategory = groupQuestionsByCategory(questions);
  const byPriority = questions.reduce((acc, q) => {
    acc[q.priority] = (acc[q.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let summary = `Flow-Based Questionnaire:\n`;
  summary += `- Total questions: ${questions.length}\n`;
  summary += `- High priority: ${byPriority.high || 0}\n`;
  summary += `- Medium priority: ${byPriority.medium || 0}\n`;
  summary += `- Low priority: ${byPriority.low || 0}\n\n`;

  summary += `By Category:\n`;
  for (const [category, qs] of Object.entries(byCategory)) {
    summary += `- ${category}: ${qs.length} questions\n`;
  }

  return summary;
}

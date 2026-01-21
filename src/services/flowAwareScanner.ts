import type { UserFlow } from './userFlowAnalyzer.js';

export interface FlowBasedFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  flow: string;
  description: string;
  affectedFunctions?: string[];
  recommendation?: string;
}

/**
 * Use user flow analysis to guide vulnerability scanning
 * This scanner identifies vulnerabilities based on how users interact with contracts
 */
export async function scanWithFlowContext(
  flows: UserFlow[],
  sourceDir: string
): Promise<FlowBasedFinding[]> {
  const findings: FlowBasedFinding[] = [];

  for (const flow of flows) {
    // Check for privilege escalation paths
    const privilegeFindings = checkPrivilegeEscalation(flow);
    findings.push(...privilegeFindings);

    // Check for re-entrancy in user flows
    const reentrancyFindings = checkFlowReentrancy(flow);
    findings.push(...reentrancyFindings);

    // Check for state manipulation sequences
    const stateFindings = checkStateManipulation(flow);
    findings.push(...stateFindings);

    // Check for access control gaps
    const accessControlFindings = checkAccessControl(flow);
    findings.push(...accessControlFindings);

    // Check for complex multi-step flows
    const complexityFindings = checkFlowComplexity(flow);
    findings.push(...complexityFindings);
  }

  return findings;
}

/**
 * Check for privilege escalation through multi-step flows
 */
function checkPrivilegeEscalation(flow: UserFlow): FlowBasedFinding[] {
  const findings: FlowBasedFinding[] = [];

  // Multi-permission requirement could indicate escalation opportunity
  if (flow.requiredPermissions.length > 1) {
    findings.push({
      type: 'privilege-escalation-path',
      severity: 'high',
      flow: flow.id,
      description: `Flow "${flow.name}" requires multiple permission changes: ${flow.requiredPermissions.join(' → ')}. This could indicate a privilege escalation path where a user can gain elevated permissions through a sequence of actions.`,
      affectedFunctions: flow.steps.map((s) => s.functionName),
      recommendation:
        'Review the permission requirements for each step. Ensure that privilege changes are properly validated and that users cannot bypass access controls through multi-step sequences.',
    });
  }

  // Check for flows that gain permissions without proper checks
  const hasOwnerFunction = flow.steps.some((s) =>
    s.modifiers.some((m) => m.toLowerCase().includes('owner'))
  );
  const hasPublicEntry = flow.entryPoint.visibility === 'public' || flow.entryPoint.visibility === 'external';

  if (hasOwnerFunction && hasPublicEntry && flow.steps.length > 1) {
    findings.push({
      type: 'indirect-privilege-access',
      severity: 'critical',
      flow: flow.id,
      description: `Public function "${flow.entryPoint.functionName}" can indirectly trigger privileged operations through a ${flow.steps.length}-step call chain. This may allow unauthorized users to execute admin-only functions.`,
      affectedFunctions: [flow.entryPoint.functionName, ...flow.steps.filter(s => s.modifiers.some(m => m.toLowerCase().includes('owner'))).map(s => s.functionName)],
      recommendation:
        'Verify that all functions in this call chain properly validate caller permissions. Consider adding access control checks at each step of the flow.',
    });
  }

  return findings;
}

/**
 * Check for re-entrancy vulnerabilities in user flows
 */
function checkFlowReentrancy(flow: UserFlow): FlowBasedFinding[] {
  const findings: FlowBasedFinding[] = [];

  // Check each step for external calls before state changes
  for (const step of flow.steps) {
    if (step.externalCalls.length > 0 && step.stateChanges.length > 0) {
      findings.push({
        type: 'flow-reentrancy-risk',
        severity: 'critical',
        flow: flow.id,
        description: `Function "${step.functionName}" in flow "${flow.name}" makes external calls and modifies state. External calls: ${step.externalCalls.join(', ')}. State changes: ${step.stateChanges.join(', ')}. This violates the Checks-Effects-Interactions pattern and creates a re-entrancy risk.`,
        affectedFunctions: [step.functionName],
        recommendation:
          'Refactor to follow Checks-Effects-Interactions pattern: (1) Perform all checks first, (2) Update state variables, (3) Make external calls last. Consider using ReentrancyGuard.',
      });
    }
  }

  // Check for cross-function re-entrancy
  if (flow.steps.length > 1) {
    const hasExternalCall = flow.steps.some((s) => s.externalCalls.length > 0);
    const hasStateChange = flow.steps.some((s) => s.stateChanges.length > 0);

    if (hasExternalCall && hasStateChange) {
      const externalCallSteps = flow.steps.filter((s) => s.externalCalls.length > 0);
      const stateChangeSteps = flow.steps.filter((s) => s.stateChanges.length > 0);

      findings.push({
        type: 'cross-function-reentrancy',
        severity: 'high',
        flow: flow.id,
        description: `Flow "${flow.name}" has external calls in ${externalCallSteps.map(s => s.functionName).join(', ')} and state changes in ${stateChangeSteps.map(s => s.functionName).join(', ')}. An attacker could re-enter this contract during the external call and exploit inconsistent state.`,
        affectedFunctions: [...externalCallSteps.map(s => s.functionName), ...stateChangeSteps.map(s => s.functionName)],
        recommendation:
          'Review the order of operations in this flow. Ensure state updates happen before external calls, or use a reentrancy guard to protect the entire flow.',
      });
    }
  }

  return findings;
}

/**
 * Check for state manipulation vulnerabilities
 */
function checkStateManipulation(flow: UserFlow): FlowBasedFinding[] {
  const findings: FlowBasedFinding[] = [];

  // Complex state transitions could indicate manipulation opportunities
  if (flow.stateTransitions.length > 5) {
    findings.push({
      type: 'complex-state-flow',
      severity: 'medium',
      flow: flow.id,
      description: `Flow "${flow.name}" involves ${flow.stateTransitions.length} state variable changes: ${flow.stateTransitions.slice(0, 5).join(', ')}${flow.stateTransitions.length > 5 ? '...' : ''}. Complex state transitions increase the risk of inconsistent state or manipulation.`,
      affectedFunctions: flow.steps.map((s) => s.functionName),
      recommendation:
        'Review the atomicity of these state changes. Ensure that if any operation fails, the entire transaction reverts to prevent partial state updates. Consider simplifying the flow or using a state machine pattern.',
    });
  }

  // Check for state changes without validation
  const stateChangingSteps = flow.steps.filter((s) => s.stateChanges.length > 0);
  for (const step of stateChangingSteps) {
    if (step.modifiers.length === 0 && (step.visibility === 'public' || step.visibility === 'external')) {
      findings.push({
        type: 'unprotected-state-change',
        severity: 'high',
        flow: flow.id,
        description: `Public function "${step.functionName}" modifies state variables (${step.stateChanges.join(', ')}) without access control modifiers. This allows any user to manipulate contract state.`,
        affectedFunctions: [step.functionName],
        recommendation:
          'Add appropriate access control modifiers (e.g., onlyOwner, onlyRole) to restrict who can modify these state variables. If public access is intentional, add validation checks to prevent invalid state changes.',
      });
    }
  }

  return findings;
}

/**
 * Check for access control gaps
 */
function checkAccessControl(flow: UserFlow): FlowBasedFinding[] {
  const findings: FlowBasedFinding[] = [];

  // Check for flows where internal functions lack access control
  const internalSteps = flow.steps.filter((s) => s.visibility === 'internal' || s.visibility === 'private');
  const hasPublicEntry = flow.entryPoint.visibility === 'public' || flow.entryPoint.visibility === 'external';

  if (hasPublicEntry && internalSteps.some((s) => s.stateChanges.length > 0)) {
    const criticalInternalSteps = internalSteps.filter((s) => s.stateChanges.length > 0);

    findings.push({
      type: 'internal-function-exposure',
      severity: 'medium',
      flow: flow.id,
      description: `Public entry point "${flow.entryPoint.functionName}" provides indirect access to internal functions that modify state: ${criticalInternalSteps.map(s => s.functionName).join(', ')}. Verify that the entry point properly validates inputs and permissions.`,
      affectedFunctions: [flow.entryPoint.functionName, ...criticalInternalSteps.map(s => s.functionName)],
      recommendation:
        'Ensure the public entry point has sufficient input validation and access control to safely expose these internal operations.',
    });
  }

  // Check for missing permission checks in privileged flows
  if (flow.requiredPermissions.length === 0 && flow.steps.some((s) => s.stateChanges.length > 2)) {
    findings.push({
      type: 'missing-access-control',
      severity: 'medium',
      flow: flow.id,
      description: `Flow "${flow.name}" performs significant state modifications but has no access control modifiers. Any user can execute this flow and modify contract state.`,
      affectedFunctions: flow.steps.filter((s) => s.stateChanges.length > 0).map((s) => s.functionName),
      recommendation:
        'Review whether this flow should be publicly accessible. If not, add appropriate access control modifiers. If yes, ensure thorough input validation.',
    });
  }

  return findings;
}

/**
 * Check for overly complex flows
 */
function checkFlowComplexity(flow: UserFlow): FlowBasedFinding[] {
  const findings: FlowBasedFinding[] = [];

  // Very long call chains are hard to reason about
  if (flow.steps.length > 10) {
    findings.push({
      type: 'excessive-flow-complexity',
      severity: 'low',
      flow: flow.id,
      description: `Flow "${flow.name}" involves ${flow.steps.length} function calls. Long call chains increase cognitive complexity and make security audits more difficult. This also increases gas costs.`,
      affectedFunctions: flow.steps.map((s) => s.functionName),
      recommendation:
        'Consider refactoring this flow to reduce complexity. Break it into smaller, more focused functions. This improves readability, testability, and security.',
    });
  }

  // Flows with many external calls are risky
  const externalCallCount = flow.steps.reduce((sum, s) => sum + s.externalCalls.length, 0);
  if (externalCallCount > 5) {
    findings.push({
      type: 'excessive-external-calls',
      severity: 'medium',
      flow: flow.id,
      description: `Flow "${flow.name}" makes ${externalCallCount} external calls across ${flow.steps.length} functions. Each external call is a potential attack vector and increases gas costs.`,
      affectedFunctions: flow.steps.filter((s) => s.externalCalls.length > 0).map((s) => s.functionName),
      recommendation:
        'Minimize external calls where possible. Batch operations, cache results, or redesign to reduce dependencies on external contracts.',
    });
  }

  return findings;
}

/**
 * Generate summary report of flow-based findings
 */
export function summarizeFlowFindings(findings: FlowBasedFinding[]): string {
  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let summary = `Flow-Based Vulnerability Scan Results:\n`;
  summary += `- Total findings: ${findings.length}\n`;
  summary += `- Critical: ${bySeverity.critical || 0}\n`;
  summary += `- High: ${bySeverity.high || 0}\n`;
  summary += `- Medium: ${bySeverity.medium || 0}\n`;
  summary += `- Low: ${bySeverity.low || 0}\n\n`;

  // Top findings
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  if (criticalFindings.length > 0) {
    summary += `Critical Issues:\n`;
    for (const finding of criticalFindings.slice(0, 3)) {
      summary += `- ${finding.type}: ${finding.description.split('.')[0]}\n`;
    }
  }

  return summary;
}

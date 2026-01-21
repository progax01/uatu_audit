import { parse, visit } from '@solidity-parser/parser';
import path from 'node:path';
import fs from 'fs-extra';

export interface UserFlowNode {
  functionName: string;
  visibility: 'public' | 'external' | 'internal' | 'private';
  modifiers: string[];
  stateChanges: string[];
  externalCalls: string[];
  events: string[];
  requiredRole?: string;
  parameters: string[];
  returns: string[];
}

export interface UserFlow {
  id: string;
  name: string;
  description: string;
  entryPoint: UserFlowNode;
  steps: UserFlowNode[];
  requiredPermissions: string[];
  stateTransitions: string[];
  risks: string[];
}

export interface UserFlowAnalysis {
  flows: UserFlow[];
  entryPoints: UserFlowNode[];
  privilegedPaths: Map<string, string[]>;
}

/**
 * Analyze contract code to extract user interaction flows
 */
export async function analyzeUserFlows(sourceDir: string): Promise<UserFlowAnalysis> {
  const contracts = await findSolidityFiles(sourceDir);
  const entryPoints: UserFlowNode[] = [];
  const flows: UserFlow[] = [];
  const privilegedPaths = new Map<string, string[]>();
  const allFunctions = new Map<string, UserFlowNode>();

  // First pass: Extract all functions from all contracts
  for (const contractPath of contracts) {
    try {
      const source = await fs.readFile(contractPath, 'utf-8');
      const functions = await extractFunctions(source, contractPath);

      // Store all functions in a map for cross-referencing
      for (const func of functions) {
        allFunctions.set(func.functionName, func);
      }

      // Identify public/external functions (user entry points)
      const publicFunctions = functions.filter(
        (f) => f.visibility === 'public' || f.visibility === 'external'
      );

      entryPoints.push(...publicFunctions);
    } catch (error: any) {
      console.warn(`Failed to parse ${contractPath}: ${error.message}`);
      // Continue processing other files
    }
  }

  // Second pass: Trace execution paths from each entry point
  for (const entryPoint of entryPoints) {
    try {
      const flow = traceUserFlow(entryPoint, allFunctions);
      flows.push(flow);

      // Identify privileged paths (require admin/owner)
      if (flow.requiredPermissions.length > 0) {
        privilegedPaths.set(flow.id, flow.requiredPermissions);
      }
    } catch (error: any) {
      console.warn(`Failed to trace flow for ${entryPoint.functionName}: ${error.message}`);
    }
  }

  return { flows, entryPoints, privilegedPaths };
}

/**
 * Extract function signatures and metadata from Solidity source
 */
async function extractFunctions(source: string, filePath: string): Promise<UserFlowNode[]> {
  const functions: UserFlowNode[] = [];

  try {
    const ast = parse(source, { loc: false, range: false });

    visit(ast, {
      FunctionDefinition: (node: any) => {
        const functionName = node.name || 'fallback';
        const visibility = node.visibility || 'public';
        const modifiers = node.modifiers?.map((m: any) => m.name) || [];
        const parameters = node.parameters?.map((p: any) => p.typeName?.name || 'unknown') || [];
        const returns =
          node.returnParameters?.map((r: any) => r.typeName?.name || 'unknown') || [];

        // Extract state changes and external calls from function body
        const stateChanges: string[] = [];
        const externalCalls: string[] = [];
        const events: string[] = [];

        if (node.body) {
          visitStatements(node.body, stateChanges, externalCalls, events);
        }

        // Determine required role from modifiers
        const requiredRole = determineRequiredRole(modifiers);

        functions.push({
          functionName,
          visibility: visibility as UserFlowNode['visibility'],
          modifiers,
          stateChanges,
          externalCalls,
          events,
          requiredRole,
          parameters,
          returns,
        });
      },
    });
  } catch (error: any) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }

  return functions;
}

/**
 * Visit statements in function body to extract state changes and external calls
 */
function visitStatements(
  body: any,
  stateChanges: string[],
  externalCalls: string[],
  events: string[]
): void {
  visit(body, {
    ExpressionStatement: (node: any) => {
      // Detect assignments (state changes)
      if (node.expression?.type === 'BinaryOperation' && node.expression.operator === '=') {
        const left = node.expression.left;
        if (left?.type === 'Identifier') {
          stateChanges.push(left.name);
        } else if (left?.type === 'MemberAccess') {
          stateChanges.push(`${left.expression?.name}.${left.memberName}`);
        }
      }

      // Detect function calls (potential external calls)
      if (node.expression?.type === 'FunctionCall') {
        const callee = node.expression.expression;
        if (callee?.type === 'Identifier') {
          externalCalls.push(callee.name);
        } else if (callee?.type === 'MemberAccess') {
          externalCalls.push(callee.memberName);
        }
      }
    },
    EmitStatement: (node: any) => {
      if (node.eventCall?.expression?.type === 'Identifier') {
        events.push(node.eventCall.expression.name);
      }
    },
  });
}

/**
 * Determine required role from modifiers
 */
function determineRequiredRole(modifiers: string[]): string | undefined {
  const roleModifiers = [
    'onlyOwner',
    'onlyAdmin',
    'onlyGovernance',
    'onlyMinter',
    'onlyBurner',
    'onlyPauser',
    'onlyRole',
  ];

  for (const modifier of modifiers) {
    if (roleModifiers.some((rm) => modifier.toLowerCase().includes(rm.toLowerCase()))) {
      return modifier;
    }
  }

  return undefined;
}

/**
 * Trace execution path from entry point through contract
 */
function traceUserFlow(
  entryPoint: UserFlowNode,
  allFunctions: Map<string, UserFlowNode>
): UserFlow {
  const visited = new Set<string>();
  const steps: UserFlowNode[] = [entryPoint];
  const requiredPermissions: string[] = [];
  const stateTransitions: string[] = [];
  const risks: string[] = [];

  // BFS to trace call graph
  const queue = [entryPoint];
  visited.add(entryPoint.functionName);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Collect permissions
    if (current.requiredRole) {
      requiredPermissions.push(current.requiredRole);
    }

    // Collect state changes
    stateTransitions.push(...current.stateChanges);

    // Identify risks
    if (current.externalCalls.length > 0) {
      risks.push(`External call in ${current.functionName}: Re-entrancy risk`);
    }
    if (current.modifiers.some((m) => m.toLowerCase().includes('owner'))) {
      risks.push(`Privileged function ${current.functionName}: Centralization risk`);
    }
    if (
      current.stateChanges.length > 0 &&
      current.externalCalls.length > 0 &&
      hasExternalCallBeforeStateChange(current)
    ) {
      risks.push(
        `${current.functionName} makes external calls before state updates: Checks-Effects-Interactions violation`
      );
    }

    // Follow internal function calls
    for (const call of current.externalCalls) {
      const calledFunction = allFunctions.get(call);
      if (calledFunction && !visited.has(call)) {
        visited.add(call);
        steps.push(calledFunction);
        queue.push(calledFunction);
      }
    }
  }

  return {
    id: `flow_${entryPoint.functionName}`,
    name: entryPoint.functionName,
    description: generateFlowDescription(entryPoint, steps),
    entryPoint,
    steps,
    requiredPermissions: [...new Set(requiredPermissions)],
    stateTransitions: [...new Set(stateTransitions)],
    risks: [...new Set(risks)],
  };
}

/**
 * Check if function has external call before state change (simplified heuristic)
 */
function hasExternalCallBeforeStateChange(func: UserFlowNode): boolean {
  // Simplified: if both exist, we consider it a potential risk
  // A more sophisticated implementation would analyze the actual order in the AST
  return func.externalCalls.length > 0 && func.stateChanges.length > 0;
}

/**
 * Generate human-readable flow description
 */
function generateFlowDescription(entryPoint: UserFlowNode, steps: UserFlowNode[]): string {
  if (steps.length === 1) {
    return `User calls ${entryPoint.functionName}()`;
  }

  const stepNames = steps.slice(0, 5).map((s) => s.functionName);
  const truncated = steps.length > 5 ? ` ... and ${steps.length - 5} more` : '';
  return `User calls ${entryPoint.functionName}() which triggers: ${stepNames.join(' → ')}${truncated}`;
}

/**
 * Find all Solidity files in directory
 */
async function findSolidityFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip common directories
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'test' &&
        entry.name !== 'tests'
      ) {
        files.push(...(await findSolidityFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith('.sol')) {
        files.push(fullPath);
      }
    }
  } catch (error: any) {
    console.warn(`Failed to read directory ${dir}: ${error.message}`);
  }

  return files;
}

/**
 * Summarize user flow analysis for reporting
 */
export function summarizeFlowAnalysis(analysis: UserFlowAnalysis): string {
  const { flows, entryPoints, privilegedPaths } = analysis;

  let summary = `User Flow Analysis Summary:\n`;
  summary += `- Total entry points: ${entryPoints.length}\n`;
  summary += `- Total flows: ${flows.length}\n`;
  summary += `- Privileged paths: ${privilegedPaths.size}\n\n`;

  // High-risk flows
  const highRiskFlows = flows.filter((f) => f.risks.length > 0);
  summary += `High-risk flows (${highRiskFlows.length}):\n`;
  for (const flow of highRiskFlows.slice(0, 5)) {
    summary += `- ${flow.name}: ${flow.risks[0]}\n`;
  }

  return summary;
}

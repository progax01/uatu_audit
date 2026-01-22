/**
 * Component Dependency Analyzer
 *
 * Detects dependencies between project components (backend, frontend, contracts, services)
 * and calculates dependency-aware security scores.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { parse as parseTS } from '@typescript-eslint/typescript-estree';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'component-dependency-analyzer' });

// ============================================================================
// Types
// ============================================================================

export interface ComponentDependency {
  targetComponent: string;           // Component ID or type (e.g., 'smart-contract', 'backend-api')
  dependencyType: 'api-call' | 'contract-call' | 'database' | 'external-service';
  callSites: DependencyCallSite[];   // Where the dependency is used
  confidence: number;                 // 0-1, how confident we are this is a real dependency
  critical: boolean;                  // Is this dependency critical to security?
}

export interface DependencyCallSite {
  filePath: string;
  lineNumber: number;
  functionName?: string;
  code: string;                       // Snippet of code making the call
  purpose?: string;                   // What this call does (inferred or AI-analyzed)
}

export interface DependencyImpact {
  dependentComponentId: string;
  dependentComponentScore?: number;   // Score of the component we depend on
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  scoreAdjustment: number;            // +/- points to add to our score
  reasoning: string;
}

export interface ComponentDependencyAnalysis {
  componentId: string;
  componentType: string;
  dependencies: ComponentDependency[];
  dependencyImpacts: DependencyImpact[];
  missingDependencies: string[];      // Dependencies not in audit
  riskAssessment: {
    hasUnauditedDependencies: boolean;
    hasBadDependencies: boolean;
    hasGoodDependencies: boolean;
    overallRisk: 'low' | 'medium' | 'high';
  };
}

// ============================================================================
// Dependency Detection
// ============================================================================

/**
 * Detect component dependencies for Node.js backend
 */
export async function detectNodeJSDependencies(
  srcDir: string,
  projectPath: string
): Promise<ComponentDependency[]> {
  log.info('Detecting Node.js component dependencies', { srcDir });

  const dependencies: ComponentDependency[] = [];

  // Detect smart contract calls (ethers.js, web3.js, viem)
  const contractDeps = await detectSmartContractCalls(srcDir);
  dependencies.push(...contractDeps);

  // Detect database connections
  const dbDeps = await detectDatabaseConnections(srcDir);
  dependencies.push(...dbDeps);

  // Detect external API calls
  const apiDeps = await detectExternalAPICalls(srcDir);
  dependencies.push(...apiDeps);

  log.info('Detected dependencies', {
    total: dependencies.length,
    contracts: contractDeps.length,
    databases: dbDeps.length,
    apis: apiDeps.length
  });

  return dependencies;
}

/**
 * Detect calls to smart contracts (ethers, web3, viem)
 */
async function detectSmartContractCalls(srcDir: string): Promise<ComponentDependency[]> {
  const callSites: DependencyCallSite[] = [];
  const files = await findFiles(srcDir, ['.ts', '.js']);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');

      // Look for ethers.js patterns
      if (content.includes('ethers') || content.includes('Contract')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          // new ethers.Contract(...)
          if (line.includes('new') && line.includes('Contract')) {
            callSites.push({
              filePath: file,
              lineNumber: idx + 1,
              code: line.trim(),
              purpose: 'Smart contract instantiation'
            });
          }
          // contract.someFunction(...)
          if (line.match(/contract\.\w+\(/)) {
            callSites.push({
              filePath: file,
              lineNumber: idx + 1,
              code: line.trim(),
              purpose: 'Smart contract function call'
            });
          }
        });
      }

      // Look for web3.js patterns
      if (content.includes('web3') || content.includes('Web3')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.match(/web3\.eth\./)) {
            callSites.push({
              filePath: file,
              lineNumber: idx + 1,
              code: line.trim(),
              purpose: 'Web3 Ethereum interaction'
            });
          }
        });
      }

      // Look for viem patterns
      if (content.includes('viem') || content.includes('publicClient') || content.includes('walletClient')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.match(/Client\.\w+\(/)) {
            callSites.push({
              filePath: file,
              lineNumber: idx + 1,
              code: line.trim(),
              purpose: 'Viem blockchain interaction'
            });
          }
        });
      }
    } catch (error: any) {
      log.warn('Failed to analyze file for contract calls', { file, error: error.message });
    }
  }

  if (callSites.length === 0) {
    return [];
  }

  return [{
    targetComponent: 'smart-contract',
    dependencyType: 'contract-call',
    callSites,
    confidence: 0.95,
    critical: true
  }];
}

/**
 * Detect database connections and queries
 */
async function detectDatabaseConnections(srcDir: string): Promise<ComponentDependency[]> {
  const callSites: DependencyCallSite[] = [];
  const files = await findFiles(srcDir, ['.ts', '.js']);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');

      // Look for database libraries
      const dbPatterns = [
        { pattern: /mongoose\./g, type: 'MongoDB (Mongoose)' },
        { pattern: /prisma\./g, type: 'Database (Prisma)' },
        { pattern: /knex\(/g, type: 'SQL (Knex)' },
        { pattern: /Pool\(/g, type: 'PostgreSQL Pool' },
        { pattern: /createConnection\(/g, type: 'Database Connection' },
        { pattern: /\.query\(/g, type: 'SQL Query' },
        { pattern: /\.find\(/g, type: 'Database Query' }
      ];

      const lines = content.split('\n');

      for (const { pattern, type } of dbPatterns) {
        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            callSites.push({
              filePath: file,
              lineNumber: idx + 1,
              code: line.trim(),
              purpose: type
            });
          }
        });
      }
    } catch (error: any) {
      log.warn('Failed to analyze file for database calls', { file, error: error.message });
    }
  }

  if (callSites.length === 0) {
    return [];
  }

  return [{
    targetComponent: 'database',
    dependencyType: 'database',
    callSites,
    confidence: 0.9,
    critical: true
  }];
}

/**
 * Detect external API calls (fetch, axios, etc.)
 */
async function detectExternalAPICalls(srcDir: string): Promise<ComponentDependency[]> {
  const callSites: DependencyCallSite[] = [];
  const files = await findFiles(srcDir, ['.ts', '.js']);

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');

      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // axios calls
        if (line.match(/axios\.(get|post|put|delete|patch)/)) {
          callSites.push({
            filePath: file,
            lineNumber: idx + 1,
            code: line.trim(),
            purpose: 'External API call (axios)'
          });
        }

        // fetch calls
        if (line.match(/fetch\s*\(/)) {
          callSites.push({
            filePath: file,
            lineNumber: idx + 1,
            code: line.trim(),
            purpose: 'External API call (fetch)'
          });
        }

        // http/https modules
        if (line.match(/http(s)?\.request/)) {
          callSites.push({
            filePath: file,
            lineNumber: idx + 1,
            code: line.trim(),
            purpose: 'External API call (http)'
          });
        }
      });
    } catch (error: any) {
      log.warn('Failed to analyze file for API calls', { file, error: error.message });
    }
  }

  if (callSites.length === 0) {
    return [];
  }

  return [{
    targetComponent: 'external-api',
    dependencyType: 'external-service',
    callSites,
    confidence: 0.85,
    critical: false
  }];
}

// ============================================================================
// Dependency Impact Calculation
// ============================================================================

/**
 * Calculate how component dependencies impact this component's score
 */
export function calculateDependencyImpact(
  dependencies: ComponentDependency[],
  auditedComponents: Map<string, { score: number; findings: number }>
): DependencyImpact[] {
  const impacts: DependencyImpact[] = [];

  for (const dep of dependencies) {
    const componentInfo = auditedComponents.get(dep.targetComponent);

    if (!componentInfo) {
      // Dependency not in audit - negative impact
      impacts.push({
        dependentComponentId: dep.targetComponent,
        impact: 'unknown',
        scoreAdjustment: dep.critical ? -10 : -5,
        reasoning: `This component depends on ${dep.targetComponent} which was NOT included in the audit. Security cannot be fully verified.`
      });
      continue;
    }

    // Dependency is in audit - check its score
    const depScore = componentInfo.score;

    if (depScore >= 80) {
      // Good dependency - positive impact
      impacts.push({
        dependentComponentId: dep.targetComponent,
        dependentComponentScore: depScore,
        impact: 'positive',
        scoreAdjustment: dep.critical ? +8 : +4,
        reasoning: `This component depends on ${dep.targetComponent} (score: ${depScore}/100), which has a good security posture. This increases confidence in this component's security.`
      });
    } else if (depScore >= 60) {
      // Moderate dependency - neutral/slight negative
      impacts.push({
        dependentComponentId: dep.targetComponent,
        dependentComponentScore: depScore,
        impact: 'neutral',
        scoreAdjustment: dep.critical ? -3 : 0,
        reasoning: `This component depends on ${dep.targetComponent} (score: ${depScore}/100), which has moderate security. Improvements to ${dep.targetComponent} would benefit this component.`
      });
    } else {
      // Bad dependency - negative impact
      impacts.push({
        dependentComponentId: dep.targetComponent,
        dependentComponentScore: depScore,
        impact: 'negative',
        scoreAdjustment: dep.critical ? -15 : -8,
        reasoning: `This component depends on ${dep.targetComponent} (score: ${depScore}/100), which has significant security issues. Vulnerabilities in ${dep.targetComponent} directly impact this component's security.`
      });
    }
  }

  return impacts;
}

/**
 * Apply dependency impacts to base score
 */
export function applyDependencyImpacts(
  baseScore: number,
  impacts: DependencyImpact[]
): { adjustedScore: number; totalAdjustment: number } {
  const totalAdjustment = impacts.reduce((sum, impact) => sum + impact.scoreAdjustment, 0);

  // Cap adjustments to prevent extreme swings
  const cappedAdjustment = Math.max(-20, Math.min(20, totalAdjustment));

  const adjustedScore = Math.max(0, Math.min(100, baseScore + cappedAdjustment));

  return { adjustedScore, totalAdjustment: cappedAdjustment };
}

// ============================================================================
// Helpers
// ============================================================================

async function findFiles(dir: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        const subFiles = await findFiles(fullPath, extensions);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return files;
}

/**
 * Analyze complete component dependency graph
 */
export async function analyzeComponentDependencies(
  componentId: string,
  componentType: string,
  srcDir: string,
  projectPath: string,
  auditedComponents: Map<string, { score: number; findings: number }>
): Promise<ComponentDependencyAnalysis> {
  // Detect dependencies based on component type
  let dependencies: ComponentDependency[] = [];

  if (componentType === 'backend-nodejs') {
    dependencies = await detectNodeJSDependencies(srcDir, projectPath);
  }
  // TODO: Add other component types (frontend-react, rust-backend, etc.)

  // Calculate impacts
  const dependencyImpacts = calculateDependencyImpact(dependencies, auditedComponents);

  // Identify missing dependencies
  const missingDependencies = dependencies
    .filter(dep => !auditedComponents.has(dep.targetComponent))
    .map(dep => dep.targetComponent);

  // Risk assessment
  const hasUnauditedDependencies = missingDependencies.length > 0;
  const hasBadDependencies = dependencyImpacts.some(i => i.impact === 'negative');
  const hasGoodDependencies = dependencyImpacts.some(i => i.impact === 'positive');

  let overallRisk: 'low' | 'medium' | 'high' = 'low';
  if (hasBadDependencies || (hasUnauditedDependencies && dependencies.some(d => d.critical))) {
    overallRisk = 'high';
  } else if (hasUnauditedDependencies || dependencyImpacts.some(i => i.impact === 'neutral')) {
    overallRisk = 'medium';
  }

  return {
    componentId,
    componentType,
    dependencies,
    dependencyImpacts,
    missingDependencies,
    riskAssessment: {
      hasUnauditedDependencies,
      hasBadDependencies,
      hasGoodDependencies,
      overallRisk
    }
  };
}

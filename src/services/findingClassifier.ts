/**
 * Finding Classifier
 *
 * Classifies audit findings by source (project vs dependencies vs compiler)
 * and filters out noisy/low-value findings.
 */

import type { StepFinding } from '../sops/definitions/types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'finding-classifier' });

export interface ClassifiedFinding extends StepFinding {
  source: 'project' | 'dependency' | 'compiler';
  category: 'security' | 'quality' | 'performance' | 'informational';
  isNoisy: boolean;
}

/**
 * Classify finding source - is it from project code, dependencies, or compiler?
 */
export function classifyFindingSource(finding: StepFinding): 'project' | 'dependency' | 'compiler' {
  const file = finding.location?.file || '';

  // Dependency detection - check if finding is in third-party code
  if (
    file.includes('node_modules/') ||
    file.includes('@openzeppelin/') ||
    file.includes('lib/') ||
    file.includes('forge-std/') ||
    file.includes('solady/') ||
    file.includes('.sol/') || // Forge remappings
    file.includes('dependencies/')
  ) {
    return 'dependency';
  }

  // Compiler warning detection
  const title = finding.title.toLowerCase();
  if (
    finding.tool === 'solc' ||
    title.includes('compiler') ||
    title.includes('pragma') ||
    title.includes('solc-version') ||
    title.includes('solidity version')
  ) {
    return 'compiler';
  }

  return 'project';
}

/**
 * Determine if finding is noisy and should be filtered out
 */
export function isNoisyFinding(finding: StepFinding, source: 'project' | 'dependency' | 'compiler'): boolean {
  const noisyPatterns = [
    'naming-convention',
    'solc-version',
    'pragma',
    'too-many-digits',
    'similar-names',
    'constable-states',    // Optimization, not security
    'external-function',   // Optimization, not security
    'immutable-states',    // Optimization, not security
    'assembly',            // Often intentional
    'low-level-calls',     // Often intentional
    'dead-code',           // Code quality, not security
    'unused-state',        // Code quality, not security
    'costly-loop',         // Gas optimization
    'cache-array-length',  // Gas optimization
  ];

  const title = finding.title.toLowerCase();
  const check = finding.rawOutput?.check_id || finding.rawOutput?.check || '';

  // Filter out noisy patterns
  if (noisyPatterns.some(pattern =>
    title.includes(pattern) || check.includes(pattern)
  )) {
    return true;
  }

  // Filter informational compiler warnings
  if (source === 'compiler' && finding.severity === 'info') {
    return true;
  }

  // Filter low-severity dependency issues (only keep medium+)
  if (source === 'dependency' && (finding.severity === 'low' || finding.severity === 'info')) {
    return true;
  }

  // Filter specific dependency-only issues
  if (source === 'dependency') {
    const dependencyOnlyNoise = [
      'divide-before-multiply', // Only in node_modules
      'incorrect-exp',          // Only in OpenZeppelin
      'timestamp',              // Often false positive in libraries
    ];

    if (dependencyOnlyNoise.some(pattern =>
      title.includes(pattern) || check.includes(pattern)
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Determine finding category for organization
 */
export function categorizeFinding(finding: StepFinding): ClassifiedFinding['category'] {
  const title = finding.title.toLowerCase();
  const check = finding.rawOutput?.check_id || finding.rawOutput?.check || '';

  // Security patterns
  const securityPatterns = [
    'reentrancy',
    'access-control',
    'unprotected',
    'unauthorized',
    'overflow',
    'underflow',
    'unchecked',
    'dangerous',
    'vulnerability',
    'exploit',
    'critical',
    'unsafe',
  ];

  if (securityPatterns.some(p => title.includes(p) || check.includes(p))) {
    return 'security';
  }

  // Performance patterns
  const performancePatterns = [
    'gas',
    'optimization',
    'costly',
    'cache',
    'immutable',
    'constant',
  ];

  if (performancePatterns.some(p => title.includes(p) || check.includes(p))) {
    return 'performance';
  }

  // Quality patterns
  const qualityPatterns = [
    'naming',
    'style',
    'dead-code',
    'unused',
    'redundant',
  ];

  if (qualityPatterns.some(p => title.includes(p) || check.includes(p))) {
    return 'quality';
  }

  // Default to informational if low severity
  if (finding.severity === 'info' || finding.severity === 'low') {
    return 'informational';
  }

  // Otherwise, it's security
  return 'security';
}

/**
 * Extract library name from file path
 */
export function extractLibraryName(filePath: string): string {
  // node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol -> OpenZeppelin Contracts
  if (filePath.includes('@openzeppelin/')) {
    return 'OpenZeppelin Contracts';
  }

  // node_modules/solady/src/tokens/ERC20.sol -> Solady
  if (filePath.includes('solady/')) {
    return 'Solady';
  }

  // lib/forge-std/src/Test.sol -> Forge Standard Library
  if (filePath.includes('forge-std/')) {
    return 'Forge Standard Library';
  }

  // node_modules/packagename/... -> packagename
  const nodeModulesMatch = filePath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if (nodeModulesMatch) {
    return nodeModulesMatch[1];
  }

  // lib/packagename/... -> packagename
  const libMatch = filePath.match(/lib\/([^/]+)/);
  if (libMatch) {
    return libMatch[1];
  }

  return 'Third-Party Library';
}

/**
 * Main classification function - separates findings into project, dependencies, and filtered
 */
export function classifyFindings(findings: StepFinding[]): {
  project: StepFinding[];
  dependencies: StepFinding[];
  filtered: StepFinding[];
  stats: {
    total: number;
    project: number;
    dependencies: number;
    filtered: number;
    filteredReasons: Record<string, number>;
  };
} {
  const classified = findings.map(f => {
    const source = classifyFindingSource(f);
    const isNoisy = isNoisyFinding(f, source);
    const category = categorizeFinding(f);

    return {
      ...f,
      source,
      category,
      isNoisy,
    } as ClassifiedFinding;
  });

  const project = classified.filter(f => f.source === 'project' && !f.isNoisy);
  const dependencies = classified.filter(f => f.source === 'dependency' && !f.isNoisy);
  const filtered = classified.filter(f => f.isNoisy);

  // Track why findings were filtered (for debugging)
  const filteredReasons: Record<string, number> = {};
  for (const f of filtered) {
    const key = f.source === 'compiler' ? 'compiler-warnings' :
                f.source === 'dependency' ? 'dependency-noise' :
                'code-quality-noise';
    filteredReasons[key] = (filteredReasons[key] || 0) + 1;
  }

  const stats = {
    total: findings.length,
    project: project.length,
    dependencies: dependencies.length,
    filtered: filtered.length,
    filteredReasons,
  };

  log.info('Finding classification complete', stats);

  return {
    project,
    dependencies,
    filtered,
    stats,
  };
}

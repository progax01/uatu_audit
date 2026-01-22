/**
 * Dependency Score Calculator
 *
 * Calculates individual audit scores for each third-party dependency
 * based on findings detected in that dependency's code.
 */

import { classifyFindings, extractLibraryName } from './findingClassifier.js';
import type { StepFinding } from '../sops/definitions/types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'dependency-score-calculator' });

export interface DependencyScore {
  library: string;           // "OpenZeppelin Contracts"
  version?: string;          // "4.8.0"
  score: number;             // 0-100
  grade: string;             // "A", "B", "C", etc.
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Calculate audit scores for each dependency library
 */
export function calculateDependencyScores(allFindings: StepFinding[]): DependencyScore[] {
  // 1. Classify findings into project vs dependencies
  const classified = classifyFindings(allFindings);
  const dependencyFindings = classified.dependencies;

  if (dependencyFindings.length === 0) {
    log.info('No dependency findings to score');
    return [];
  }

  // 2. Group by library
  const groupedByLibrary = new Map<string, StepFinding[]>();

  for (const finding of dependencyFindings) {
    const library = extractLibraryName(finding.location?.file || '');
    if (!groupedByLibrary.has(library)) {
      groupedByLibrary.set(library, []);
    }
    groupedByLibrary.get(library)!.push(finding);
  }

  // 3. Calculate score for each library
  const scores: DependencyScore[] = [];

  for (const [library, findings] of groupedByLibrary) {
    const findingsCount = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };

    // Score calculation (same as main audit)
    const score = calculateScoreFromFindings(findingsCount);
    const grade = getGradeFromScore(score);
    const riskLevel = getRiskLevelFromFindings(findingsCount);

    scores.push({
      library,
      version: extractVersionFromFindings(findings),
      score,
      grade,
      findingsCount,
      riskLevel,
    });

    log.info('Dependency score calculated', {
      library,
      score,
      grade,
      riskLevel,
      findingsCount,
    });
  }

  // Sort by risk level (critical first), then by score (lowest first)
  scores.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return a.score - b.score; // Lower scores first (more problematic)
  });

  log.info('Dependency scoring complete', {
    totalDependencies: scores.length,
    criticalRisk: scores.filter(s => s.riskLevel === 'critical').length,
    highRisk: scores.filter(s => s.riskLevel === 'high').length,
  });

  return scores;
}

/**
 * Calculate score from findings count
 * Same logic as main audit scoring
 */
function calculateScoreFromFindings(counts: DependencyScore['findingsCount']): number {
  let deductions = 0;
  deductions += counts.critical * 20;
  deductions += counts.high * 10;
  deductions += counts.medium * 5;
  deductions += counts.low * 2;
  deductions += counts.info * 0.5;

  return Math.max(0, 100 - deductions);
}

/**
 * Get letter grade from numeric score
 */
function getGradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Determine risk level from findings
 */
function getRiskLevelFromFindings(counts: DependencyScore['findingsCount']): 'low' | 'medium' | 'high' | 'critical' {
  if (counts.critical > 0) return 'critical';
  if (counts.high > 0) return 'high';
  if (counts.medium > 0) return 'medium';
  return 'low';
}

/**
 * Try to extract version from file paths
 */
function extractVersionFromFindings(findings: StepFinding[]): string | undefined {
  // Try to extract version from file path
  // Example: node_modules/@openzeppelin/contracts@4.8.0/...
  for (const finding of findings) {
    const path = finding.location?.file || '';

    // Match @version pattern
    const versionMatch = path.match(/@(\d+\.\d+\.\d+)/);
    if (versionMatch) return versionMatch[1];

    // Match /vX.Y.Z/ pattern
    const versionMatch2 = path.match(/\/v(\d+\.\d+\.\d+)\//);
    if (versionMatch2) return versionMatch2[1];
  }

  return undefined;
}

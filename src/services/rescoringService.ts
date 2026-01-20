/**
 * Rescoring Service
 *
 * Recalculates audit scores after triage verification.
 * Only dismisses findings that have been verified as accurate.
 */

import { logger } from '../utils/logger.js';
import type { Finding, VerificationResult } from './triageVerificationAgent.js';

const log = logger.child({ service: 'rescoring' });

// ============================================================================
// TYPES
// ============================================================================

export interface RescoringResult {
  originalScore: number;
  newScore: number;
  originalGrade: string;
  newGrade: string;
  findingsRemoved: number;
  findingsKept: number;
  findingsDowngraded: number;
  scoreImprovement: number;
  breakdown: {
    category: string;
    count: number;
    severityChanges: Array<{
      findingId: string;
      oldSeverity: string;
      newSeverity: string;
      reason: string;
    }>;
  }[];
}

// ============================================================================
// SCORING WEIGHTS
// ============================================================================

const SEVERITY_WEIGHTS = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
  dismissed: 0,
};

const GRADE_THRESHOLDS = [
  { grade: 'A+', minScore: 95 },
  { grade: 'A', minScore: 90 },
  { grade: 'A-', minScore: 85 },
  { grade: 'B+', minScore: 80 },
  { grade: 'B', minScore: 75 },
  { grade: 'B-', minScore: 70 },
  { grade: 'C+', minScore: 65 },
  { grade: 'C', minScore: 60 },
  { grade: 'C-', minScore: 55 },
  { grade: 'D+', minScore: 50 },
  { grade: 'D', minScore: 45 },
  { grade: 'D-', minScore: 40 },
  { grade: 'F', minScore: 0 },
];

// ============================================================================
// RESCORING LOGIC
// ============================================================================

/**
 * Recalculate audit score based on verified triage explanations
 */
export async function recalculateAuditScore(
  originalScore: number,
  findings: Finding[],
  verifications: VerificationResult[]
): Promise<RescoringResult> {
  log.info('Starting audit rescoring', {
    originalScore,
    findingsCount: findings.length,
    verificationsCount: verifications.length,
  });

  // Build map of findingId -> verification
  const verificationMap = new Map<string, VerificationResult>();
  for (const v of verifications) {
    verificationMap.set(v.findingId, v);
  }

  let findingsRemoved = 0;
  let findingsKept = 0;
  let findingsDowngraded = 0;

  const breakdown: RescoringResult['breakdown'] = [
    { category: 'Verified Dismissals', count: 0, severityChanges: [] },
    { category: 'Rejected Dismissals', count: 0, severityChanges: [] },
    { category: 'Severity Downgrades', count: 0, severityChanges: [] },
    { category: 'Needs Review', count: 0, severityChanges: [] },
  ];

  // Calculate penalty for original findings
  let originalPenalty = 0;
  for (const finding of findings) {
    originalPenalty += SEVERITY_WEIGHTS[finding.severity] || 0;
  }

  // Calculate new penalty after verifications
  let newPenalty = 0;
  for (const finding of findings) {
    const verification = verificationMap.get(finding.findingId);

    if (!verification) {
      // No triage explanation provided, keep original severity
      newPenalty += SEVERITY_WEIGHTS[finding.severity] || 0;
      findingsKept++;
      continue;
    }

    // Handle based on verification status
    switch (verification.verificationStatus) {
      case 'accurate':
        // User's explanation is accurate, apply suggested severity
        const newSeverity = verification.suggestedSeverity || 'dismissed';
        newPenalty += SEVERITY_WEIGHTS[newSeverity] || 0;

        if (newSeverity === 'dismissed' || newSeverity === 'info') {
          findingsRemoved++;
          breakdown[0].count++;
          breakdown[0].severityChanges.push({
            findingId: finding.findingId,
            oldSeverity: finding.severity,
            newSeverity,
            reason: verification.reasoning,
          });
        } else if (newSeverity !== finding.severity) {
          findingsDowngraded++;
          breakdown[2].count++;
          breakdown[2].severityChanges.push({
            findingId: finding.findingId,
            oldSeverity: finding.severity,
            newSeverity,
            reason: verification.reasoning,
          });
        }
        break;

      case 'misleading':
        // User's explanation is incorrect, keep original severity
        newPenalty += SEVERITY_WEIGHTS[finding.severity] || 0;
        findingsKept++;
        breakdown[1].count++;
        breakdown[1].severityChanges.push({
          findingId: finding.findingId,
          oldSeverity: finding.severity,
          newSeverity: finding.severity,
          reason: verification.reasoning,
        });
        break;

      case 'insufficient':
      case 'needs_human_review':
        // Not enough information or complex case, keep original severity
        newPenalty += SEVERITY_WEIGHTS[finding.severity] || 0;
        findingsKept++;
        breakdown[3].count++;
        breakdown[3].severityChanges.push({
          findingId: finding.findingId,
          oldSeverity: finding.severity,
          newSeverity: finding.severity,
          reason: verification.reasoning,
        });
        break;
    }
  }

  // Calculate new score: base 100, subtract penalty
  const maxPenalty = 100; // Maximum penalty that would result in 0 score
  const originalScoreCalc = Math.max(0, 100 - (originalPenalty / maxPenalty) * 100);
  const newScore = Math.max(0, Math.min(100, 100 - (newPenalty / maxPenalty) * 100));

  const originalGrade = calculateGrade(originalScore);
  const newGrade = calculateGrade(newScore);
  const scoreImprovement = newScore - originalScore;

  const result: RescoringResult = {
    originalScore,
    newScore: Math.round(newScore),
    originalGrade,
    newGrade,
    findingsRemoved,
    findingsKept,
    findingsDowngraded,
    scoreImprovement: Math.round(scoreImprovement),
    breakdown: breakdown.filter(b => b.count > 0), // Only include categories with changes
  };

  log.info('Rescoring complete', {
    originalScore,
    newScore: result.newScore,
    improvement: result.scoreImprovement,
    removedFindings: findingsRemoved,
    keptFindings: findingsKept,
    downgradedFindings: findingsDowngraded,
  });

  return result;
}

/**
 * Calculate letter grade from numeric score
 */
function calculateGrade(score: number): string {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.minScore) {
      return threshold.grade;
    }
  }
  return 'F';
}

/**
 * Generate human-readable rescoring summary
 */
export function generateRescoringSummary(result: RescoringResult): string {
  const lines: string[] = [];

  lines.push(`# Audit Rescoring Summary\n`);
  lines.push(`**Original Score**: ${result.originalScore} (${result.originalGrade})`);
  lines.push(`**New Score**: ${result.newScore} (${result.newGrade})`);
  lines.push(`**Improvement**: ${result.scoreImprovement > 0 ? '+' : ''}${result.scoreImprovement} points\n`);

  lines.push(`## Changes:`);
  lines.push(`- ✅ Verified Dismissals: ${result.findingsRemoved} findings removed`);
  lines.push(`- ⚠️ Severity Downgrades: ${result.findingsDowngraded} findings downgraded`);
  lines.push(`- ❌ Rejected Dismissals: ${result.findingsKept} findings kept\n`);

  if (result.breakdown.length > 0) {
    lines.push(`## Breakdown by Category:\n`);
    for (const category of result.breakdown) {
      lines.push(`### ${category.category} (${category.count})`);
      for (const change of category.severityChanges.slice(0, 5)) {
        lines.push(`- **${change.findingId}**: ${change.oldSeverity} → ${change.newSeverity}`);
        lines.push(`  *${change.reason}*`);
      }
      if (category.severityChanges.length > 5) {
        lines.push(`  *(${category.severityChanges.length - 5} more...)*`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

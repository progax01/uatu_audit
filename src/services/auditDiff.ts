import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'audit-diff' });

/**
 * Audit Diff Engine
 * Compares two audit reports to show improvements/regressions
 */

export interface AuditReport {
  audit_report: {
    findings: {
      summary: {
        total: number;
        by_severity: {
          critical: number;
          high: number;
          medium: number;
          low: number;
          info: number;
        };
      };
      critical?: any[];
      high?: any[];
      medium?: any[];
      low?: any[];
      info?: any[];
    };
    score: {
      value: number;
      grade: string;
    };
  };
}

export interface AuditDiff {
  fixed_vulnerabilities: any[];
  new_vulnerabilities: any[];
  unchanged_vulnerabilities: any[];
  regression_score: number; // -100 to +100 (positive = improvement)
  severity_changes: {
    critical: number; // delta
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  score_change: {
    before: number;
    after: number;
    delta: number; // positive = improvement
    percentage_change: number;
  };
  grade_change: {
    before: string;
    after: string;
    improved: boolean;
  };
  summary: string;
}

export class AuditDiffEngine {
  /**
   * Compare two audit reports
   */
  async compare(
    beforePath: string,
    afterPath: string
  ): Promise<AuditDiff> {
    log.info(`Comparing audits: ${beforePath} vs ${afterPath}`);

    try {
      // Load reports
      const beforeReport = await this.loadReport(beforePath);
      const afterReport = await this.loadReport(afterPath);

      // Calculate diff
      const diff = this.calculateDiff(beforeReport, afterReport);

      log.info(`Diff complete:`);
      log.info(`  Fixed: ${diff.fixed_vulnerabilities.length}`);
      log.info(`  New: ${diff.new_vulnerabilities.length}`);
      log.info(`  Unchanged: ${diff.unchanged_vulnerabilities.length}`);
      log.info(`  Regression Score: ${diff.regression_score}`);

      return diff;
    } catch (error: any) {
      log.error('Failed to compare audits:', error);
      throw error;
    }
  }

  /**
   * Calculate differences between reports
   */
  private calculateDiff(
    before: AuditReport,
    after: AuditReport
  ): AuditDiff {
    const beforeFindings = this.extractAllFindings(before);
    const afterFindings = this.extractAllFindings(after);

    // Find fixed, new, and unchanged vulnerabilities
    const fixed: any[] = [];
    const unchanged: any[] = [];
    const newVulns: any[] = [];

    // Compare by finding ID or title + location
    const afterMap = new Map(
      afterFindings.map(f => [this.getFindingKey(f), f])
    );

    for (const beforeFinding of beforeFindings) {
      const key = this.getFindingKey(beforeFinding);
      if (afterMap.has(key)) {
        unchanged.push({
          before: beforeFinding,
          after: afterMap.get(key)
        });
        afterMap.delete(key);
      } else {
        fixed.push(beforeFinding);
      }
    }

    // Remaining findings in after are new
    for (const finding of afterMap.values()) {
      newVulns.push(finding);
    }

    // Calculate severity changes
    const beforeSummary = before.audit_report.findings.summary.by_severity;
    const afterSummary = after.audit_report.findings.summary.by_severity;

    const severityChanges = {
      critical: afterSummary.critical - beforeSummary.critical,
      high: afterSummary.high - beforeSummary.high,
      medium: afterSummary.medium - beforeSummary.medium,
      low: afterSummary.low - beforeSummary.low,
      info: afterSummary.info - beforeSummary.info
    };

    // Calculate score changes
    const beforeScore = before.audit_report.score.value;
    const afterScore = after.audit_report.score.value;
    const scoreDelta = afterScore - beforeScore;
    const percentageChange = beforeScore > 0
      ? (scoreDelta / beforeScore) * 100
      : 0;

    // Calculate regression score (-100 to +100)
    const regressionScore = this.calculateRegressionScore(
      fixed.length,
      newVulns.length,
      scoreDelta
    );

    // Grade comparison
    const beforeGrade = before.audit_report.score.grade;
    const afterGrade = after.audit_report.score.grade;
    const gradeImproved = this.isGradeImproved(beforeGrade, afterGrade);

    // Generate summary
    const summary = this.generateSummary(
      fixed.length,
      newVulns.length,
      scoreDelta,
      gradeImproved
    );

    return {
      fixed_vulnerabilities: fixed,
      new_vulnerabilities: newVulns,
      unchanged_vulnerabilities: unchanged.map(u => u.before),
      regression_score: regressionScore,
      severity_changes: severityChanges,
      score_change: {
        before: beforeScore,
        after: afterScore,
        delta: scoreDelta,
        percentage_change: Number(percentageChange.toFixed(1))
      },
      grade_change: {
        before: beforeGrade,
        after: afterGrade,
        improved: gradeImproved
      },
      summary
    };
  }

  /**
   * Load audit report from file
   */
  private async loadReport(filePath: string): Promise<AuditReport> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      log.error(`Failed to load report from ${filePath}:`, error);
      throw new Error(`Failed to load audit report: ${error}`);
    }
  }

  /**
   * Extract all findings from report
   */
  private extractAllFindings(report: AuditReport): any[] {
    const findings: any[] = [];

    const findingsObj = report.audit_report.findings;

    if (findingsObj.critical) findings.push(...findingsObj.critical);
    if (findingsObj.high) findings.push(...findingsObj.high);
    if (findingsObj.medium) findings.push(...findingsObj.medium);
    if (findingsObj.low) findings.push(...findingsObj.low);
    if (findingsObj.info) findings.push(...findingsObj.info);

    return findings;
  }

  /**
   * Get unique key for a finding
   */
  private getFindingKey(finding: any): string {
    // Use ID if available, otherwise create key from title + location
    if (finding.id) {
      return finding.id;
    }

    const title = finding.title || 'unknown';
    const file = finding.location?.file || 'unknown';
    const line = finding.location?.line || 0;

    return `${title}::${file}::${line}`;
  }

  /**
   * Calculate regression score (-100 to +100)
   * Positive = improvement, Negative = regression
   */
  private calculateRegressionScore(
    fixedCount: number,
    newCount: number,
    scoreDelta: number
  ): number {
    // Base score on fixed vs new vulnerabilities
    let score = (fixedCount - newCount) * 10;

    // Adjust based on score delta
    score += scoreDelta * 0.5;

    // Clamp to -100 to +100
    return Math.max(-100, Math.min(100, Math.round(score)));
  }

  /**
   * Check if grade improved
   */
  private isGradeImproved(before: string, after: string): boolean {
    const grades = ['F', 'D', 'C', 'B', 'A'];
    const beforeIndex = grades.indexOf(before);
    const afterIndex = grades.indexOf(after);

    return afterIndex > beforeIndex;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    fixed: number,
    newVulns: number,
    scoreDelta: number,
    gradeImproved: boolean
  ): string {
    const parts: string[] = [];

    if (fixed > 0) {
      parts.push(`✅ ${fixed} vulnerabilities fixed`);
    }

    if (newVulns > 0) {
      parts.push(`⚠️  ${newVulns} new vulnerabilities introduced`);
    }

    if (scoreDelta > 0) {
      parts.push(`📈 Security score improved by ${scoreDelta} points`);
    } else if (scoreDelta < 0) {
      parts.push(`📉 Security score decreased by ${Math.abs(scoreDelta)} points`);
    } else {
      parts.push(`➡️  Security score unchanged`);
    }

    if (gradeImproved) {
      parts.push(`🎉 Security grade improved`);
    }

    if (parts.length === 0) {
      return 'No significant changes detected';
    }

    return parts.join('. ') + '.';
  }

  /**
   * Export diff as markdown report
   */
  exportMarkdown(diff: AuditDiff): string {
    const lines: string[] = [];

    lines.push('# Audit Comparison Report\n');

    // Summary
    lines.push('## Summary\n');
    lines.push(diff.summary);
    lines.push('');

    // Regression Score
    lines.push('## Regression Score\n');
    lines.push(`**${diff.regression_score}/100** ${
      diff.regression_score > 50 ? '✅ Significant Improvement' :
      diff.regression_score > 0 ? '✅ Improvement' :
      diff.regression_score === 0 ? '➡️  No Change' :
      diff.regression_score > -50 ? '⚠️  Minor Regression' :
      '❌ Significant Regression'
    }`);
    lines.push('');

    // Score Change
    lines.push('## Score Change\n');
    lines.push(`- **Before**: ${diff.score_change.before}/100 (Grade ${diff.grade_change.before})`);
    lines.push(`- **After**: ${diff.score_change.after}/100 (Grade ${diff.grade_change.after})`);
    lines.push(`- **Delta**: ${diff.score_change.delta > 0 ? '+' : ''}${diff.score_change.delta} (${diff.score_change.percentage_change}%)`);
    lines.push('');

    // Severity Changes
    lines.push('## Severity Changes\n');
    lines.push('| Severity | Change |');
    lines.push('|----------|--------|');
    for (const [severity, delta] of Object.entries(diff.severity_changes)) {
      const emoji = delta < 0 ? '✅' : delta > 0 ? '⚠️' : '➡️';
      lines.push(`| ${severity} | ${emoji} ${delta > 0 ? '+' : ''}${delta} |`);
    }
    lines.push('');

    // Fixed Vulnerabilities
    if (diff.fixed_vulnerabilities.length > 0) {
      lines.push('## Fixed Vulnerabilities ✅\n');
      for (const finding of diff.fixed_vulnerabilities) {
        lines.push(`- **[${finding.severity}]** ${finding.title} (${finding.location?.file || 'unknown'})`);
      }
      lines.push('');
    }

    // New Vulnerabilities
    if (diff.new_vulnerabilities.length > 0) {
      lines.push('## New Vulnerabilities ⚠️\n');
      for (const finding of diff.new_vulnerabilities) {
        lines.push(`- **[${finding.severity}]** ${finding.title} (${finding.location?.file || 'unknown'})`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export diff as JSON
   */
  exportJSON(diff: AuditDiff): string {
    return JSON.stringify(diff, null, 2);
  }
}

// Singleton instance
let diffEngine: AuditDiffEngine | null = null;

export function getAuditDiffEngine(): AuditDiffEngine {
  if (!diffEngine) {
    diffEngine = new AuditDiffEngine();
  }
  return diffEngine;
}

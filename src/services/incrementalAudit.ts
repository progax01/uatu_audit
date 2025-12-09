import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { UnifiedAuditReport, Finding } from '../agents/types';

const log = logger.child({ service: 'incremental-audit' });

/**
 * Incremental Audit Engine
 * Detects changed files and only re-analyzes what's needed
 */

export interface FileSnapshot {
  path: string;
  hash: string;
  size: number;
  lastModified: string;
}

export interface ProjectSnapshot {
  projectPath: string;
  timestamp: string;
  files: FileSnapshot[];
  totalFiles: number;
  snapshotHash: string;
}

export interface IncrementalAuditPlan {
  changedFiles: string[];
  newFiles: string[];
  deletedFiles: string[];
  unchangedFiles: string[];
  shouldFullAudit: boolean;
  reason?: string;
}

export interface IncrementalAuditResult {
  jobId: string;
  baseAuditId: string;
  incrementalPlan: IncrementalAuditPlan;
  newFindings: Finding[];
  removedFindings: Finding[];
  unchangedFindings: Finding[];
  mergedReport: UnifiedAuditReport;
  stats: {
    filesAnalyzed: number;
    filesSkipped: number;
    timeSaved: number; // estimated seconds
    costSaved: number; // estimated percentage
  };
}

export class IncrementalAuditEngine {
  private snapshotDir: string;

  constructor(snapshotDir: string = '.state/snapshots') {
    this.snapshotDir = snapshotDir;
  }

  /**
   * Create snapshot of current project state
   */
  async createSnapshot(projectPath: string): Promise<ProjectSnapshot> {
    log.info(`Creating project snapshot: ${projectPath}`);

    try {
      // Get all relevant files
      const files = await this.getAllRelevantFiles(projectPath);

      // Create snapshots for each file
      const fileSnapshots: FileSnapshot[] = [];

      for (const filePath of files) {
        try {
          const snapshot = await this.createFileSnapshot(filePath);
          fileSnapshots.push(snapshot);
        } catch (error) {
          log.warn(`Failed to snapshot ${filePath}:`, error);
        }
      }

      // Calculate snapshot hash
      const snapshotHash = this.calculateSnapshotHash(fileSnapshots);

      const snapshot: ProjectSnapshot = {
        projectPath,
        timestamp: new Date().toISOString(),
        files: fileSnapshots,
        totalFiles: fileSnapshots.length,
        snapshotHash
      };

      // Save snapshot
      await this.saveSnapshot(projectPath, snapshot);

      log.info(`✅ Created snapshot with ${fileSnapshots.length} files`);

      return snapshot;
    } catch (error: any) {
      log.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  /**
   * Load previous snapshot
   */
  async loadSnapshot(projectPath: string): Promise<ProjectSnapshot | null> {
    try {
      const snapshotPath = this.getSnapshotPath(projectPath);

      try {
        await fs.access(snapshotPath);
      } catch {
        log.info('No previous snapshot found');
        return null;
      }

      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot: ProjectSnapshot = JSON.parse(content);

      log.info(
        `Loaded snapshot from ${snapshot.timestamp} (${snapshot.totalFiles} files)`
      );

      return snapshot;
    } catch (error: any) {
      log.error('Failed to load snapshot:', error);
      return null;
    }
  }

  /**
   * Compare current state with previous snapshot
   */
  async compareWithSnapshot(
    projectPath: string,
    previousSnapshot: ProjectSnapshot
  ): Promise<IncrementalAuditPlan> {
    log.info('Comparing with previous snapshot...');

    try {
      // Get current files
      const currentFiles = await this.getAllRelevantFiles(projectPath);

      // Create map of previous files
      const previousMap = new Map(
        previousSnapshot.files.map(f => [f.path, f])
      );

      const changedFiles: string[] = [];
      const newFiles: string[] = [];
      const unchangedFiles: string[] = [];

      // Check each current file
      for (const filePath of currentFiles) {
        const previous = previousMap.get(filePath);

        if (!previous) {
          newFiles.push(filePath);
        } else {
          const currentSnapshot = await this.createFileSnapshot(filePath);

          if (currentSnapshot.hash !== previous.hash) {
            changedFiles.push(filePath);
          } else {
            unchangedFiles.push(filePath);
          }

          previousMap.delete(filePath);
        }
      }

      // Remaining files in map are deleted
      const deletedFiles = Array.from(previousMap.keys());

      // Determine if full audit is needed
      const changeRatio =
        (changedFiles.length + newFiles.length + deletedFiles.length) /
        previousSnapshot.totalFiles;

      const shouldFullAudit = changeRatio > 0.5; // More than 50% changed
      const reason = shouldFullAudit
        ? `Too many changes (${Math.round(changeRatio * 100)}% of files)`
        : undefined;

      log.info(
        `📊 Changes: ${changedFiles.length} changed, ${newFiles.length} new, ${deletedFiles.length} deleted`
      );

      if (shouldFullAudit) {
        log.warn(`⚠️  Full audit recommended: ${reason}`);
      }

      return {
        changedFiles,
        newFiles,
        deletedFiles,
        unchangedFiles,
        shouldFullAudit,
        reason
      };
    } catch (error: any) {
      log.error('Failed to compare snapshots:', error);
      throw error;
    }
  }

  /**
   * Merge incremental findings with base audit
   */
  async mergeFindings(
    baseReport: UnifiedAuditReport,
    newFindings: Finding[],
    plan: IncrementalAuditPlan
  ): Promise<{
    newFindings: Finding[];
    removedFindings: Finding[];
    unchangedFindings: Finding[];
    mergedReport: UnifiedAuditReport;
  }> {
    log.info('Merging incremental findings with base audit...');

    try {
      const baseFindings = this.extractAllFindings(baseReport);

      // Findings from unchanged files
      const unchangedFindings = baseFindings.filter(finding =>
        this.isFindingInFiles(finding, plan.unchangedFiles)
      );

      // Findings from changed/deleted files (to be removed)
      const removedFindings = baseFindings.filter(finding =>
        this.isFindingInFiles(
          finding,
          [...plan.changedFiles, ...plan.deletedFiles]
        )
      );

      // Create merged report
      const allFindings = [...unchangedFindings, ...newFindings];

      const mergedReport = this.createMergedReport(
        baseReport,
        allFindings,
        plan
      );

      log.info(
        `✅ Merged: ${unchangedFindings.length} unchanged + ${newFindings.length} new = ${allFindings.length} total`
      );

      return {
        newFindings,
        removedFindings,
        unchangedFindings,
        mergedReport
      };
    } catch (error: any) {
      log.error('Failed to merge findings:', error);
      throw error;
    }
  }

  /**
   * Calculate statistics for incremental audit
   */
  calculateStats(plan: IncrementalAuditPlan, baseReport: UnifiedAuditReport): {
    filesAnalyzed: number;
    filesSkipped: number;
    timeSaved: number;
    costSaved: number;
  } {
    const filesAnalyzed = plan.changedFiles.length + plan.newFiles.length;
    const filesSkipped = plan.unchangedFiles.length;
    const totalFiles =
      filesAnalyzed + filesSkipped + plan.deletedFiles.length;

    // Estimate time saved (assume 30s per file on average)
    const timeSaved = filesSkipped * 30;

    // Estimate cost saved (proportional to files skipped)
    const costSaved = Math.round((filesSkipped / totalFiles) * 100);

    return {
      filesAnalyzed,
      filesSkipped,
      timeSaved,
      costSaved
    };
  }

  /**
   * Check if finding is in specific files
   */
  private isFindingInFiles(finding: Finding, files: string[]): boolean {
    if (!finding.location?.file) {
      return false;
    }

    // Normalize paths for comparison
    const findingFile = path.normalize(finding.location.file);

    return files.some(file => {
      const normalizedFile = path.normalize(file);
      return (
        findingFile === normalizedFile || findingFile.endsWith(normalizedFile)
      );
    });
  }

  /**
   * Extract all findings from report
   */
  private extractAllFindings(report: UnifiedAuditReport): Finding[] {
    const findings: Finding[] = [];

    const findingsObj = report.audit_report.findings;

    if (findingsObj.critical) findings.push(...findingsObj.critical);
    if (findingsObj.high) findings.push(...findingsObj.high);
    if (findingsObj.medium) findings.push(...findingsObj.medium);
    if (findingsObj.low) findings.push(...findingsObj.low);
    if (findingsObj.info) findings.push(...findingsObj.info);

    return findings;
  }

  /**
   * Create merged audit report
   */
  private createMergedReport(
    baseReport: UnifiedAuditReport,
    allFindings: Finding[],
    plan: IncrementalAuditPlan
  ): UnifiedAuditReport {
    // Group findings by severity
    const bySeverity = {
      critical: allFindings.filter(f => f.severity === 'CRITICAL'),
      high: allFindings.filter(f => f.severity === 'HIGH'),
      medium: allFindings.filter(f => f.severity === 'MEDIUM'),
      low: allFindings.filter(f => f.severity === 'LOW'),
      info: allFindings.filter(f => f.severity === 'INFO')
    };

    // Calculate new score
    const score = this.calculateScore(bySeverity);

    // Create merged report
    const mergedReport: UnifiedAuditReport = {
      schema_version: baseReport.schema_version,
      audit_report: {
        metadata: {
          ...baseReport.audit_report.metadata,
          timestamp: new Date().toISOString()
        },
        executive_summary: {
          ...baseReport.audit_report.executive_summary
        },
        findings: {
          summary: {
            total: allFindings.length,
            by_severity: {
              critical: bySeverity.critical.length,
              high: bySeverity.high.length,
              medium: bySeverity.medium.length,
              low: bySeverity.low.length,
              info: bySeverity.info.length
            },
            by_category: baseReport.audit_report.findings.summary.by_category
          },
          critical: bySeverity.critical,
          high: bySeverity.high,
          medium: bySeverity.medium,
          low: bySeverity.low,
          info: bySeverity.info
        },
        score
      }
    };

    return mergedReport;
  }

  /**
   * Calculate audit score
   */
  private calculateScore(bySeverity: Record<string, Finding[]>) {
    const weights = { critical: 25, high: 10, medium: 3, low: 1 };

    const deductions =
      bySeverity.critical.length * weights.critical +
      bySeverity.high.length * weights.high +
      bySeverity.medium.length * weights.medium +
      bySeverity.low.length * weights.low;

    const value = Math.max(0, 100 - deductions);

    const grade =
      value >= 90 ? 'A' : value >= 80 ? 'B' : value >= 70 ? 'C' : value >= 60 ? 'D' : 'F';

    return {
      value,
      grade: grade as 'A' | 'B' | 'C' | 'D' | 'F',
      breakdown: {
        critical: bySeverity.critical.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length,
        info: bySeverity.info.length
      }
    };
  }

  /**
   * Get all relevant files to analyze
   */
  private async getAllRelevantFiles(projectPath: string): Promise<string[]> {
    const relevantExtensions = [
      '.sol', // Solidity
      '.js',
      '.ts',
      '.jsx',
      '.tsx', // JavaScript/TypeScript
      '.py', // Python
      '.go', // Go
      '.java', // Java
      '.rs' // Rust
    ];

    const ignoreDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      'out',
      'target'
    ];

    const files: string[] = [];

    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            await walk(fullPath);
          }
        } else {
          const ext = path.extname(entry.name);
          if (relevantExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(projectPath);

    return files;
  }

  /**
   * Create snapshot for a single file
   */
  private async createFileSnapshot(filePath: string): Promise<FileSnapshot> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);

    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      path: filePath,
      hash,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  }

  /**
   * Calculate hash of entire snapshot
   */
  private calculateSnapshotHash(snapshots: FileSnapshot[]): string {
    const combined = snapshots.map(s => `${s.path}:${s.hash}`).join('|');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get snapshot file path
   */
  private getSnapshotPath(projectPath: string): string {
    const projectName = path.basename(projectPath);
    return path.join(
      this.snapshotDir,
      `${projectName}-snapshot.json`
    );
  }

  /**
   * Save snapshot to disk
   */
  private async saveSnapshot(
    projectPath: string,
    snapshot: ProjectSnapshot
  ): Promise<void> {
    const snapshotPath = this.getSnapshotPath(projectPath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });

    await fs.writeFile(
      snapshotPath,
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );

    log.info(`Snapshot saved: ${snapshotPath}`);
  }
}

// Singleton instance
let incrementalAuditEngine: IncrementalAuditEngine | null = null;

export function getIncrementalAuditEngine(): IncrementalAuditEngine {
  if (!incrementalAuditEngine) {
    incrementalAuditEngine = new IncrementalAuditEngine();
  }
  return incrementalAuditEngine;
}

export function resetIncrementalAuditEngine(): void {
  incrementalAuditEngine = null;
}

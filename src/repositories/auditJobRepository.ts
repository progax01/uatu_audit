/**
 * Audit Job Repository
 *
 * UNIQUENESS RULES:
 * ================
 * Contract code is immutable - once deployed, it never changes. Therefore:
 *
 * 1. QUICK SCANS: Only one completed audit per (contractAddress, contractNetwork)
 *    - findExistingQuickScan() checks for existing completed scans
 *    - If found, return cached results instead of re-scanning
 *    - Re-scanning identical code wastes resources and produces identical results
 *
 * 2. FULL AUDITS: Only one completed audit per (repo, branch, commitSha)
 *    - findExistingFullAudit() checks for existing completed audits
 *    - Same commit = same code = same results
 *
 * These constraints are enforced at application level in scan.ts handlers.
 */

import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { getDb } from '../db';
import {
  auditJobs,
  auditResults,
  type AuditJob,
  type NewAuditJob,
  type AuditResult,
  type AuditType,
  type JobStatus,
} from '../db/schema';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'audit-job-repository' });

// ============================================================================
// QUICK SCAN JOB OPERATIONS
// ============================================================================

export interface CreateQuickScanJobInput {
  contractAddress: string;
  contractNetwork: string;
  contractName: string;
  isProxy?: boolean;
  implementationAddress?: string;
  deployerAddress?: string;
  creationTxHash?: string;
  userId?: string;
}

/**
 * Create a new audit job for a quick scan
 */
export async function createQuickScanJob(data: CreateQuickScanJobInput): Promise<AuditJob> {
  const db = getDb();

  const result = await db.insert(auditJobs).values({
    auditType: 'quick',
    visibility: 'public', // Quick scans are public by default
    status: 'pending',
    progressPct: 0,
    contractAddress: data.contractAddress,
    contractNetwork: data.contractNetwork,
    contractName: data.contractName,
    isProxy: data.isProxy || false,
    implementationAddress: data.implementationAddress,
    deployerAddress: data.deployerAddress,
    creationTxHash: data.creationTxHash,
    // Use a special repo format for quick scans
    repo: `scan://${data.contractNetwork}/${data.contractAddress}`,
    branch: 'main',
    userId: data.userId,
    startedAt: new Date(),
  }).returning();

  log.info('Created quick scan job', {
    jobId: result[0].id,
    contractAddress: data.contractAddress,
    network: data.contractNetwork,
  });

  return result[0];
}

/**
 * Update job progress (progressPct and progressMessage)
 */
export async function updateJobProgress(
  jobId: string,
  progressPct: number,
  progressMessage?: string,
  status?: JobStatus
): Promise<void> {
  const db = getDb();

  const updates: Partial<AuditJob> = {
    progressPct,
  };

  if (progressMessage !== undefined) {
    updates.progressMessage = progressMessage;
  }

  if (status !== undefined) {
    updates.status = status;
  }

  await db.update(auditJobs)
    .set(updates)
    .where(eq(auditJobs.id, jobId));
}

/**
 * Complete a quick scan job with results
 */
export async function completeQuickScanJob(
  jobId: string,
  result: {
    score: number;
    grade: string;
    riskLevel: string;
    vulnerabilities: any[];
    summary: string;
    contractAnalysis?: any;
    gasOptimizations?: any[];
    bestPractices?: any[];
    scanDuration?: number;
  }
): Promise<void> {
  const db = getDb();

  // Update job status to completed
  await db.update(auditJobs)
    .set({
      status: 'completed',
      progressPct: 100,
      progressMessage: 'Scan complete',
      completedAt: new Date(),
    })
    .where(eq(auditJobs.id, jobId));

  // Insert audit results
  await db.insert(auditResults).values({
    jobId,
    scoreValue: result.score,
    scoreLabel: result.grade,
    findings: result.vulnerabilities,
    summary: result.summary,
    metadata: {
      riskLevel: result.riskLevel,
      contractAnalysis: result.contractAnalysis,
      gasOptimizations: result.gasOptimizations,
      bestPractices: result.bestPractices,
      scanDuration: result.scanDuration,
    },
  });

  log.info('Completed quick scan job', {
    jobId,
    score: result.score,
    grade: result.grade,
    vulnerabilityCount: result.vulnerabilities?.length || 0,
  });
}

/**
 * Mark a quick scan job as failed
 */
export async function failQuickScanJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const db = getDb();

  await db.update(auditJobs)
    .set({
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    })
    .where(eq(auditJobs.id, jobId));

  log.error('Quick scan job failed', { jobId, errorMessage });
}

// ============================================================================
// PUBLIC LEDGER QUERIES
// ============================================================================

export interface GetPublicAuditsOptions {
  page?: number;
  limit?: number;
  network?: string;
  searchTerm?: string;
  auditType?: AuditType;
  includeInProgress?: boolean; // Include queued, analyzing, auditing, generating jobs
}

export interface PublicAuditListItem {
  id: string;
  legacyId: number;
  auditType: AuditType;
  contractAddress: string | null;
  contractNetwork: string | null;
  contractName: string | null;
  isProxy: boolean;
  repo: string;
  createdAt: Date;
  completedAt: Date | null;
  scoreValue: number | null;
  scoreLabel: string | null;
  summary: string | null;
  // New fields for in-progress status display
  status: JobStatus;
  progressPct: number;
  progressMessage: string | null;
}

/**
 * Get public audits for the ledger with pagination
 */
export async function getPublicAudits(options: GetPublicAuditsOptions = {}): Promise<{
  audits: PublicAuditListItem[];
  total: number;
  hasMore: boolean;
}> {
  const db = getDb();
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100);
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [
    eq(auditJobs.visibility, 'public'),
  ];

  // Include in-progress audits if requested
  if (options.includeInProgress) {
    // For in-progress jobs, also verify completedAt IS NULL to avoid stuck jobs
    // Jobs with completedAt set should be treated as completed regardless of status
    conditions.push(
      or(
        // Completed jobs (have completedAt set)
        sql`${auditJobs.completedAt} IS NOT NULL`,
        // True in-progress jobs (no completedAt and active status)
        and(
          sql`${auditJobs.completedAt} IS NULL`,
          or(
            eq(auditJobs.status, 'queued'),
            eq(auditJobs.status, 'pending'),
            eq(auditJobs.status, 'analyzing'),
            eq(auditJobs.status, 'auditing'),
            eq(auditJobs.status, 'generating')
          )
        )
      )!
    );
  } else {
    conditions.push(eq(auditJobs.status, 'completed'));
  }

  if (options.network) {
    conditions.push(eq(auditJobs.contractNetwork, options.network));
  }

  if (options.auditType) {
    conditions.push(eq(auditJobs.auditType, options.auditType));
  }

  // Search by contract name, address, or repo
  if (options.searchTerm) {
    const searchPattern = `%${options.searchTerm}%`;
    conditions.push(
      or(
        like(auditJobs.contractName, searchPattern),
        like(auditJobs.contractAddress, searchPattern),
        like(auditJobs.repo, searchPattern)
      )!
    );
  }

  // Query with join to auditResults
  const audits = await db
    .select({
      id: auditJobs.id,
      legacyId: auditJobs.legacyId,
      auditType: auditJobs.auditType,
      contractAddress: auditJobs.contractAddress,
      contractNetwork: auditJobs.contractNetwork,
      contractName: auditJobs.contractName,
      isProxy: auditJobs.isProxy,
      repo: auditJobs.repo,
      createdAt: auditJobs.createdAt,
      completedAt: auditJobs.completedAt,
      scoreValue: auditResults.scoreValue,
      scoreLabel: auditResults.scoreLabel,
      summary: auditResults.summary,
      // Include status fields for in-progress display
      status: auditJobs.status,
      progressPct: auditJobs.progressPct,
      progressMessage: auditJobs.progressMessage,
    })
    .from(auditJobs)
    .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
    .where(and(...conditions))
    // Order by: true in-progress first (no completedAt), then completed
    // Jobs with completedAt set are treated as completed regardless of status field
    .orderBy(
      sql`CASE WHEN ${auditJobs.completedAt} IS NULL AND ${auditJobs.status} IN ('queued', 'pending', 'analyzing', 'auditing', 'generating') THEN 0 ELSE 1 END`,
      desc(auditJobs.createdAt)
    )
    .limit(limit + 1) // Fetch one extra to check hasMore
    .offset(offset);

  const hasMore = audits.length > limit;
  const results = hasMore ? audits.slice(0, limit) : audits;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditJobs)
    .where(and(...conditions));

  return {
    audits: results as PublicAuditListItem[],
    total: Number(countResult[0].count),
    hasMore,
  };
}

/**
 * Get a single audit with full results
 */
export async function getAuditWithResults(jobId: string): Promise<{
  job: AuditJob;
  results: AuditResult | null;
} | null> {
  const db = getDb();

  const result = await db
    .select({
      job: auditJobs,
      results: auditResults,
    })
    .from(auditJobs)
    .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
    .where(eq(auditJobs.id, jobId))
    .limit(1);

  if (!result[0]) return null;

  return {
    job: result[0].job,
    results: result[0].results,
  };
}

/**
 * Get a single audit by legacy ID
 */
export async function getAuditByLegacyId(legacyId: number): Promise<{
  job: AuditJob;
  results: AuditResult | null;
} | null> {
  const db = getDb();

  const result = await db
    .select({
      job: auditJobs,
      results: auditResults,
    })
    .from(auditJobs)
    .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
    .where(eq(auditJobs.legacyId, legacyId))
    .limit(1);

  if (!result[0]) return null;

  return {
    job: result[0].job,
    results: result[0].results,
  };
}

/**
 * Check if a completed quick scan exists for a contract address + network
 */
export async function findExistingQuickScan(
  contractAddress: string,
  contractNetwork: string
): Promise<AuditJob | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(auditJobs)
    .where(and(
      eq(auditJobs.contractAddress, contractAddress),
      eq(auditJobs.contractNetwork, contractNetwork),
      eq(auditJobs.auditType, 'quick'),
      eq(auditJobs.status, 'completed')
    ))
    .orderBy(desc(auditJobs.completedAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Check if a completed full audit exists for a repo + branch + commit
 * Used to enforce uniqueness: same commit = same code = same results
 */
export async function findExistingFullAudit(
  repo: string,
  branch: string,
  commitSha: string
): Promise<AuditJob | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(auditJobs)
    .where(and(
      eq(auditJobs.repo, repo),
      eq(auditJobs.branch, branch),
      eq(auditJobs.commitSha, commitSha),
      eq(auditJobs.auditType, 'full'),
      eq(auditJobs.status, 'completed')
    ))
    .orderBy(desc(auditJobs.completedAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Check if a quick scan is currently running for a contract address + network
 * Returns pending, analyzing, auditing, or generating jobs that haven't completed
 * Jobs with completedAt set are considered completed regardless of status field
 */
export async function findRunningQuickScan(
  contractAddress: string,
  contractNetwork: string
): Promise<AuditJob | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(auditJobs)
    .where(and(
      eq(auditJobs.contractAddress, contractAddress),
      eq(auditJobs.contractNetwork, contractNetwork),
      eq(auditJobs.auditType, 'quick'),
      // Only consider jobs without completedAt as "running"
      // This handles stuck jobs that have completedAt but wrong status
      sql`${auditJobs.completedAt} IS NULL`,
      or(
        eq(auditJobs.status, 'pending'),
        eq(auditJobs.status, 'queued'),
        eq(auditJobs.status, 'analyzing'),
        eq(auditJobs.status, 'auditing'),
        eq(auditJobs.status, 'generating')
      )
    ))
    .orderBy(desc(auditJobs.createdAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Get job by ID with current status for polling/reconnection
 */
export async function getJobStatus(jobId: string): Promise<{
  job: AuditJob;
  results: AuditResult | null;
} | null> {
  const db = getDb();

  const result = await db
    .select({
      job: auditJobs,
      results: auditResults,
    })
    .from(auditJobs)
    .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
    .where(eq(auditJobs.id, jobId))
    .limit(1);

  if (!result[0]) return null;

  return {
    job: result[0].job,
    results: result[0].results,
  };
}

/**
 * Get aggregate stats for public audits
 */
export async function getPublicAuditStats(): Promise<{
  totalAudits: number;
  quickScans: number;
  fullAudits: number;
  avgScore: number;
  queuedCount: number;
  inProgressCount: number;
  totalVulnerabilities: number;
  chainsSupported: number;
}> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN aj.status = 'completed' OR aj.completed_at IS NOT NULL THEN 1 END) as total_audits,
      COUNT(CASE WHEN aj.audit_type = 'quick' AND (aj.status = 'completed' OR aj.completed_at IS NOT NULL) THEN 1 END) as quick_scans,
      COUNT(CASE WHEN aj.audit_type = 'full' AND (aj.status = 'completed' OR aj.completed_at IS NOT NULL) THEN 1 END) as full_audits,
      COALESCE(AVG(ar.score_value), 0) as avg_score,
      COUNT(CASE WHEN aj.status = 'queued' AND aj.completed_at IS NULL THEN 1 END) as queued_count,
      COUNT(CASE WHEN aj.status IN ('pending', 'analyzing', 'auditing', 'generating') AND aj.completed_at IS NULL THEN 1 END) as in_progress_count,
      COALESCE(SUM(jsonb_array_length(ar.findings)), 0) as total_vulnerabilities,
      COUNT(DISTINCT aj.contract_network) FILTER (WHERE aj.contract_network IS NOT NULL) as chains_supported
    FROM audit_jobs aj
    LEFT JOIN audit_results ar ON aj.id = ar.job_id
    WHERE aj.visibility = 'public'
  `);

  const row = result.rows[0] as any;

  return {
    totalAudits: Number(row.total_audits) || 0,
    quickScans: Number(row.quick_scans) || 0,
    fullAudits: Number(row.full_audits) || 0,
    avgScore: Math.round(Number(row.avg_score) || 0),
    queuedCount: Number(row.queued_count) || 0,
    inProgressCount: Number(row.in_progress_count) || 0,
    totalVulnerabilities: Number(row.total_vulnerabilities) || 0,
    chainsSupported: Number(row.chains_supported) || 0,
  };
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Count currently running audits (analyzing, auditing, or generating)
 * Used to check if we need to queue new scans
 */
export async function countRunningAudits(): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditJobs)
    .where(or(
      eq(auditJobs.status, 'analyzing'),
      eq(auditJobs.status, 'auditing'),
      eq(auditJobs.status, 'generating')
    ));

  return Number(result[0].count);
}

/**
 * Get the next queued job (oldest by createdAt)
 * Used by background processor to pick up queued jobs
 */
export async function getNextQueuedJob(): Promise<AuditJob | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(auditJobs)
    .where(eq(auditJobs.status, 'queued'))
    .orderBy(auditJobs.createdAt)
    .limit(1);

  return result[0] || null;
}

/**
 * Get count of queued jobs (for queue position display)
 */
export async function countQueuedAudits(): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditJobs)
    .where(eq(auditJobs.status, 'queued'));

  return Number(result[0].count);
}

/**
 * Update job status to queued
 */
export async function setJobQueued(jobId: string, queuePosition: number): Promise<void> {
  const db = getDb();

  await db.update(auditJobs)
    .set({
      status: 'queued',
      progressMessage: `Queued (position ${queuePosition})`,
    })
    .where(eq(auditJobs.id, jobId));

  log.info('Job queued', { jobId, queuePosition });
}

/**
 * Force-complete a stuck job (admin operation)
 * Used when a job has completedAt set but wrong status
 */
export async function forceCompleteJob(jobId: string): Promise<boolean> {
  const db = getDb();

  const result = await db.update(auditJobs)
    .set({
      status: 'completed',
      progressPct: 100,
      progressMessage: 'Scan complete (force-completed)',
      completedAt: new Date(),
    })
    .where(eq(auditJobs.id, jobId))
    .returning();

  if (result.length > 0) {
    log.info('Force-completed job', { jobId });
    return true;
  }
  return false;
}

/**
 * Cleanup stuck jobs - jobs that have been running for too long without completion
 * Called periodically to prevent indefinitely stuck jobs
 */
export async function cleanupStuckJobs(maxAgeMinutes: number = 30): Promise<number> {
  const db = getDb();
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  // Find jobs that have been in active status for too long without completedAt
  const stuckJobs = await db
    .select()
    .from(auditJobs)
    .where(and(
      sql`${auditJobs.completedAt} IS NULL`,
      sql`${auditJobs.startedAt} < ${cutoffTime}`,
      or(
        eq(auditJobs.status, 'analyzing'),
        eq(auditJobs.status, 'auditing'),
        eq(auditJobs.status, 'generating')
      )
    ));

  // Mark them as failed
  for (const job of stuckJobs) {
    await db.update(auditJobs)
      .set({
        status: 'failed',
        errorMessage: `Job timed out after ${maxAgeMinutes} minutes`,
        completedAt: new Date(),
      })
      .where(eq(auditJobs.id, job.id));

    log.warn('Cleaned up stuck job', { jobId: job.id, startedAt: job.startedAt });
  }

  return stuckJobs.length;
}

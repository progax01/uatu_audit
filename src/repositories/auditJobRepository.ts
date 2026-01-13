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
    eq(auditJobs.status, 'completed'),
  ];

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
    })
    .from(auditJobs)
    .leftJoin(auditResults, eq(auditJobs.id, auditResults.jobId))
    .where(and(...conditions))
    .orderBy(desc(auditJobs.completedAt))
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
 * Check if a quick scan is currently running for a contract address + network
 * Returns pending, analyzing, auditing, or generating jobs
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
      or(
        eq(auditJobs.status, 'pending'),
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
}> {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_audits,
      COUNT(CASE WHEN audit_type = 'quick' THEN 1 END) as quick_scans,
      COUNT(CASE WHEN audit_type = 'full' THEN 1 END) as full_audits,
      COALESCE(AVG(ar.score_value), 0) as avg_score
    FROM audit_jobs aj
    LEFT JOIN audit_results ar ON aj.id = ar.job_id
    WHERE aj.visibility = 'public' AND aj.status = 'completed'
  `);

  const row = result.rows[0] as any;

  return {
    totalAudits: Number(row.total_audits) || 0,
    quickScans: Number(row.quick_scans) || 0,
    fullAudits: Number(row.full_audits) || 0,
    avgScore: Math.round(Number(row.avg_score) || 0),
  };
}

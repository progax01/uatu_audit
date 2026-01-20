/**
 * Clarification Service
 * 
 * CRUD operations for audit clarifications (pre-audit and post-audit).
 * Used for:
 * - Pre-audit: Context gathering before scoring (admin wallets, deps, oracles)
 * - Post-audit: Score challenges/disputes after initial findings
 */

import { db } from '../db/index.js';
import {
    auditClarifications,
    type AuditClarification,
    type NewAuditClarification,
    type ClarificationPhase,
    type ClarificationStatus,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'clarification-service' });

// ============================================================================
// TYPES
// ============================================================================

export interface ClarificationContext {
    file?: string;
    line?: number;
    findingId?: string;
    findingIds?: string[];  // For grouped questions
    snippet?: string;
    category?: string;
    severity?: string;
    count?: number;  // Number of findings in group
    functions?: string[];  // Function names in group
}

export interface ClarificationOptions {
    label: string;
    value: string;
    risk?: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
}

export interface ScoreImpact {
    before: number;
    after: number;
    section: string;
    reason?: string;
}

export interface AddClarificationParams {
    jobId: string;
    phase: ClarificationPhase;
    questionKey: string;
    questionText: string;
    questionType: 'text' | 'select' | 'confirm' | 'multiselect';
    options?: ClarificationOptions[];
    context?: ClarificationContext;
}

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

/**
 * Add a pre-audit clarification question
 */
export async function addPreAuditQuestion(
    jobId: string,
    questionKey: string,
    questionText: string,
    context?: ClarificationContext,
    options?: ClarificationOptions[]
): Promise<AuditClarification> {
    log.info('Adding pre-audit clarification', { jobId, questionKey });

    const [clarification] = await db
        .insert(auditClarifications)
        .values({
            jobId,
            phase: 'pre_audit',
            questionKey,
            questionText,
            questionType: options ? 'select' : 'text',
            options: options ?? null,
            context: context ?? null,
            status: 'pending',
        })
        .returning();

    return clarification;
}

/**
 * Add a post-audit challenge/dispute
 */
export async function addPostAuditChallenge(
    jobId: string,
    findingId: string,
    questionText: string,
    context: ClarificationContext
): Promise<AuditClarification> {
    log.info('Adding post-audit challenge', { jobId, findingId });

    const [clarification] = await db
        .insert(auditClarifications)
        .values({
            jobId,
            phase: 'post_audit',
            questionKey: `challenge_${findingId}`,
            questionText,
            questionType: 'text',
            context: { ...context, findingId },
            status: 'pending',
        })
        .returning();

    return clarification;
}

/**
 * Add generic clarification
 */
export async function addClarification(
    params: AddClarificationParams
): Promise<AuditClarification | null> {
    log.info('Adding clarification', { jobId: params.jobId, key: params.questionKey });

    // Prevent duplicates
    const [existing] = await db
        .select()
        .from(auditClarifications)
        .where(
            and(
                eq(auditClarifications.jobId, params.jobId),
                eq(auditClarifications.questionKey, params.questionKey)
            )
        )
        .limit(1);

    if (existing) {
        log.info('Clarification with this key already exists, skipping', { jobId: params.jobId, key: params.questionKey });
        return existing as AuditClarification;
    }

    const [clarification] = await db
        .insert(auditClarifications)
        .values({
            jobId: params.jobId,
            phase: params.phase,
            questionKey: params.questionKey,
            questionText: params.questionText,
            questionType: params.questionType,
            options: params.options ?? null,
            context: params.context ?? null,
            status: 'pending',
        })
        .returning();

    return clarification;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all pending clarifications for a job
 */
export async function getPendingClarifications(
    jobId: string,
    phase?: ClarificationPhase
): Promise<AuditClarification[]> {
    log.debug('Fetching pending clarifications', { jobId, phase });

    const conditions = [
        eq(auditClarifications.jobId, jobId),
        eq(auditClarifications.status, 'pending'),
    ];

    if (phase) {
        conditions.push(eq(auditClarifications.phase, phase));
    }

    return db
        .select()
        .from(auditClarifications)
        .where(and(...conditions))
        .orderBy(desc(auditClarifications.createdAt));
}

/**
 * Get all clarifications for a job (any status)
 */
export async function getAllClarifications(
    jobId: string,
    phase?: ClarificationPhase
): Promise<AuditClarification[]> {
    const conditions = [eq(auditClarifications.jobId, jobId)];

    if (phase) {
        conditions.push(eq(auditClarifications.phase, phase));
    }

    return db
        .select()
        .from(auditClarifications)
        .where(and(...conditions))
        .orderBy(desc(auditClarifications.createdAt));
}

/**
 * Get a single clarification by ID
 */
export async function getClarificationById(
    id: string
): Promise<AuditClarification | null> {
    const [clarification] = await db
        .select()
        .from(auditClarifications)
        .where(eq(auditClarifications.id, id))
        .limit(1);

    return clarification ?? null;
}

/**
 * Check if job has any pending clarifications
 */
export async function hasPendingClarifications(
    jobId: string,
    phase?: ClarificationPhase
): Promise<boolean> {
    const pending = await getPendingClarifications(jobId, phase);
    return pending.length > 0;
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

/**
 * Submit an answer to a clarification
 */
export async function submitAnswer(
    clarificationId: string,
    answerValue: unknown
): Promise<AuditClarification> {
    log.info('Submitting clarification answer', { clarificationId });

    const [updated] = await db
        .update(auditClarifications)
        .set({
            answerValue,
            status: 'answered',
            answeredAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(auditClarifications.id, clarificationId))
        .returning();

    return updated;
}

/**
 * Skip a clarification (mark as skipped)
 */
export async function skipClarification(
    clarificationId: string
): Promise<AuditClarification> {
    log.info('Skipping clarification', { clarificationId });

    const [updated] = await db
        .update(auditClarifications)
        .set({
            status: 'skipped',
            updatedAt: new Date(),
        })
        .where(eq(auditClarifications.id, clarificationId))
        .returning();

    return updated;
}

/**
 * Record score impact after post-audit re-evaluation
 */
export async function recordScoreImpact(
    clarificationId: string,
    impact: ScoreImpact
): Promise<AuditClarification> {
    log.info('Recording score impact', { clarificationId, impact });

    const [updated] = await db
        .update(auditClarifications)
        .set({
            scoreImpact: impact,
            status: 'resolved',
            updatedAt: new Date(),
        })
        .where(eq(auditClarifications.id, clarificationId))
        .returning();

    return updated;
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Add multiple pre-audit questions at once
 */
export async function addBulkPreAuditQuestions(
    jobId: string,
    questions: Array<{
        questionKey: string;
        questionText: string;
        context?: ClarificationContext;
        options?: ClarificationOptions[];
    }>
): Promise<AuditClarification[]> {
    log.info('Adding bulk pre-audit questions', { jobId, count: questions.length });

    if (questions.length === 0) return [];

    const values: NewAuditClarification[] = questions.map(q => ({
        jobId,
        phase: 'pre_audit' as const,
        questionKey: q.questionKey,
        questionText: q.questionText,
        questionType: q.options ? 'select' : 'text',
        options: q.options ?? null,
        context: q.context ?? null,
        status: 'pending' as const,
    }));

    return db.insert(auditClarifications).values(values).returning();
}

/**
 * Get counts by status for a job
 */
export async function getClarificationCounts(
    jobId: string
): Promise<{ pending: number; answered: number; skipped: number; total: number }> {
    const all = await getAllClarifications(jobId);

    const counts = {
        pending: 0,
        answered: 0,
        skipped: 0,
        total: all.length,
    };

    for (const c of all) {
        if (c.status === 'pending') counts.pending++;
        else if (c.status === 'answered') counts.answered++;
        else if (c.status === 'skipped') counts.skipped++;
    }

    return counts;
}

export default {
    addPreAuditQuestion,
    addPostAuditChallenge,
    addClarification,
    getPendingClarifications,
    getAllClarifications,
    getClarificationById,
    hasPendingClarifications,
    submitAnswer,
    skipClarification,
    recordScoreImpact,
    addBulkPreAuditQuestions,
    getClarificationCounts,
};

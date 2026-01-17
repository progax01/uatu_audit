/**
 * Audit Questionnaire API Routes
 *
 * Contract-type aware pre-audit questionnaires for the unified audit system.
 * Automatically selects relevant questions based on detected contract type.
 *
 * Routes:
 * - GET /api/audit/:jobId/questionnaire - Get contract-specific questions
 * - POST /api/audit/:jobId/questionnaire/answers - Submit answers
 * - GET /api/audit/:jobId/questionnaire/classification - Get contract classification
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditJobs, contractClassifications, auditClarifications } from '../../db/schema.js';
import { selectQuestions, validateAnswers, getQuestionStatistics } from '../../services/questionSelectionService';
import type { ContractCategory } from '../../db/schema';
import { logger } from '../../utils/logger';

const log = logger.child({ module: 'audit-questionnaire-routes' });

// ============================================================================
// Route Handler
// ============================================================================

export async function handleAuditQuestionnaireRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {

  // ============================================================================
  // GET /api/audit/:jobId/questionnaire - Get contract-type specific questions
  // ============================================================================
  const questionnaireMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/questionnaire$/);
  if (req.method === 'GET' && questionnaireMatch) {
    const jobId = questionnaireMatch[1];

    try {
      // Get audit job
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      // Get contract classification
      const [classification] = await db
        .select()
        .from(contractClassifications)
        .where(eq(contractClassifications.jobId, jobId));

      const contractCategory: ContractCategory = classification?.category || 'generic';
      const auditDepth = job.auditDepth || 'standard';

      // Determine if optional questions should be included
      const includeOptional = auditDepth === 'deep';

      // Select questions based on contract type and audit depth
      const selectedQuestions = selectQuestions({
        contractCategory,
        auditDepth: auditDepth as 'quick' | 'standard' | 'deep',
        includeOptional,
      });

      log.info('Questions selected for audit', {
        jobId,
        contractCategory,
        auditDepth,
        totalQuestions: selectedQuestions.metadata.totalQuestions,
        requiredQuestions: selectedQuestions.metadata.requiredQuestions,
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        jobId,
        contractCategory,
        auditDepth,
        classification: classification ? {
          category: classification.category,
          subCategory: classification.subCategory,
          interfaces: classification.interfaces,
          patterns: classification.patterns,
          confidence: classification.confidence,
        } : null,
        questions: selectedQuestions.questions,
        groupedQuestions: selectedQuestions.groupedByCategory,
        metadata: selectedQuestions.metadata,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get questionnaire', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audit/:jobId/questionnaire/answers - Submit answers
  // ============================================================================
  const answersMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/questionnaire\/answers$/);
  if (req.method === 'POST' && answersMatch) {
    const jobId = answersMatch[1];

    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const { answers } = body;

      if (!answers || typeof answers !== 'object') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'answers object is required' }));
        return true;
      }

      // Get audit job
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      // Get contract classification
      const [classification] = await db
        .select()
        .from(contractClassifications)
        .where(eq(contractClassifications.jobId, jobId));

      const contractCategory: ContractCategory = classification?.category || 'generic';
      const auditDepth = job.auditDepth || 'standard';
      const includeOptional = auditDepth === 'deep';

      // Get questions for validation
      const selectedQuestions = selectQuestions({
        contractCategory,
        auditDepth: auditDepth as 'quick' | 'standard' | 'deep',
        includeOptional,
      });

      // Validate answers
      const validation = validateAnswers(selectedQuestions.questions, answers);

      if (!validation.valid) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
        }));
        return true;
      }

      // Store answers in audit_clarifications table (reusing existing table)
      // Clear previous questionnaire answers for this job
      await db.delete(auditClarifications)
        .where(eq(auditClarifications.jobId, jobId));

      // Insert new answers
      const answersToStore = [];
      for (const [questionKey, answer] of Object.entries(answers)) {
        const question = selectedQuestions.questions.find(q => q.key === questionKey);
        if (!question) continue;

        answersToStore.push({
          jobId,
          phase: 'pre_audit' as const,
          questionKey: questionKey,
          questionText: question.text,
          questionType: question.type as any,
          options: question.options ? JSON.parse(JSON.stringify(question.options)) : null,
          context: null,
          status: 'answered' as const,
          answerValue: { value: answer, questionKey },
          answeredAt: new Date(),
        });
      }

      if (answersToStore.length > 0) {
        await db.insert(auditClarifications).values(answersToStore);
      }

      log.info('Questionnaire answers submitted', {
        jobId,
        answersCount: answersToStore.length,
        contractCategory,
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        jobId,
        answersReceived: answersToStore.length,
        totalQuestions: selectedQuestions.metadata.totalQuestions,
        message: 'Answers saved successfully',
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to submit answers', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId/questionnaire/classification - Get contract classification
  // ============================================================================
  const classificationMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/questionnaire\/classification$/);
  if (req.method === 'GET' && classificationMatch) {
    const jobId = classificationMatch[1];

    try {
      const [classification] = await db
        .select()
        .from(contractClassifications)
        .where(eq(contractClassifications.jobId, jobId));

      if (!classification) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Contract classification not found',
          message: 'Classification will be available after source code analysis'
        }));
        return true;
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        classification: {
          category: classification.category,
          subCategory: classification.subCategory,
          interfaces: classification.interfaces,
          patterns: classification.patterns,
          confidence: classification.confidence,
          metadata: classification.detectionMetadata,
          detectedAt: classification.detectedAt,
        },
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get classification', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/questionnaire/statistics - Get question statistics
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname === '/api/audit/questionnaire/statistics') {
    try {
      const stats = getQuestionStatistics();

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        statistics: stats,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get statistics', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  return false;
}

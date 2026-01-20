/**
 * Unified Audit Routes
 *
 * API endpoints for the new SOP-based unified audit system.
 * Provides a single entry point for all audit types with micro-step progress tracking.
 */

import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditJobs, auditStepProgress, auditSopExecution, auditResults, projects, auditClarifications } from '../../db/schema.js';

import {
  startUnifiedAudit,
  getAuditProgress,
  cancelAudit,
  type UnifiedAuditRequest,
  type GitHubRepoInput,
  type DeployedContractInput,
  type ManualUploadInput,
} from '../../services/unifiedAuditService.js';
import { detectEcosystem, selectSOP } from '../../services/sopSelectionService.js';
import { getJobProgress } from '../../services/microStepProgressService.js';
import { getAllAvailableSOPs } from '../../sops/definitions/index.js';
import { checkToolsAvailable, getAvailableToolNames } from '../../tools/index.js';
import { getSessionId, loadUserId } from './auth.js';
import { verifyAuth } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'audit-routes' });

// ============================================================================
// Route Handler
// ============================================================================

export async function handleAuditRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {

  // ============================================================================
  // POST /api/audit/start - Start a new unified audit
  // ============================================================================
  if (req.method === 'POST' && parsed.pathname === '/api/audit/start') {
    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      // Get user session - check session-based auth first, then JWT auth as fallback
      const sessionId = getSessionId(req);
      let userId: string | undefined;
      if (sessionId) {
        userId = (await loadUserId(sessionId)) || undefined;
      }

      // If no session-based userId, try JWT auth
      if (!userId) {
        const jwtAuth = await verifyAuth(req);
        if (jwtAuth) {
          userId = jwtAuth.user.id;
          log.info('Authenticated audit request via JWT', { userId });
        }
      }

      // Validate request
      const { source, depth, visibility, projectId, options } = body;

      // Log audit request details for debugging
      log.info('Audit request details', {
        sourceType: source?.type,
        repo: source?.type === 'github-repo' ? source.repoUrl : undefined,
        branch: source?.type === 'github-repo' ? source.branch || 'main' : undefined,
        depth,
        projectId
      });

      if (!source || !source.type) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'source is required' }));
        return true;
      }

      if (!['quick', 'standard', 'deep'].includes(depth)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'depth must be quick, standard, or deep' }));
        return true;
      }

      // Build audit request
      const auditRequest: UnifiedAuditRequest = {
        source: source as GitHubRepoInput | DeployedContractInput | ManualUploadInput,
        depth: depth || 'standard',
        visibility: visibility || 'private',
        userId,
        projectId,
        options,
      };

      // Start audit
      const result = await startUnifiedAudit(auditRequest);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
      return true;
    } catch (error: any) {
      log.error('Failed to start audit', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId/progress - Get audit progress
  // ============================================================================
  const progressMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/progress$/);
  if (req.method === 'GET' && progressMatch) {
    const jobId = progressMatch[1];

    try {
      const progress = await getJobProgress(jobId);

      if (!progress) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, ...progress }));
      return true;
    } catch (error: any) {
      log.error('Failed to get progress', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId/progress/stream - SSE progress stream
  // ============================================================================
  const streamMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/progress\/stream$/);
  if (req.method === 'GET' && streamMatch) {
    const jobId = streamMatch[1];

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    let isComplete = false;

    const sendProgress = async () => {
      try {
        const progress = await getJobProgress(jobId);

        if (progress) {
          // Check if waiting for questionnaire
          const isWaitingForQuestionnaire =
            progress.currentStep?.id === 'wait-for-questionnaire-answers' ||
            progress.currentStep?.name?.includes('Wait for Questionnaire');

          if (isWaitingForQuestionnaire) {
            // Send special questionnaire_ready event
            res.write(`data: ${JSON.stringify({
              ...progress,
              questionnaireReady: true,
              questionnaireUrl: `/audits/${jobId}/questionnaire`,
              message: 'Questionnaire ready - please answer to continue audit'
            })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
          }

          // Check if audit is complete
          if (progress.status === 'completed' || progress.status === 'failed') {
            isComplete = true;
          }
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Audit not found' })}\n\n`);
          isComplete = true;
        }
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      }
    };

    // Send initial progress
    await sendProgress();

    // Set up interval for updates
    const interval = setInterval(async () => {
      if (isComplete) {
        clearInterval(interval);
        res.end();
        return;
      }
      await sendProgress();
    }, 1500); // Update every 1.5 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });

    return true;
  }

  // ============================================================================
  // POST /api/audit/:jobId/cancel - Cancel an audit
  // ============================================================================
  const cancelMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/cancel$/);
  if (req.method === 'POST' && cancelMatch) {
    const jobId = cancelMatch[1];

    try {
      // Check authorization
      const sessionId = getSessionId(req);
      const userId = sessionId ? await loadUserId(sessionId) : undefined;

      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      if (job.userId && userId && job.userId !== userId) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Not authorized' }));
        return true;
      }

      await cancelAudit(jobId);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return true;
    } catch (error: any) {
      log.error('Failed to cancel audit', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audit/:jobId/retry - Retry a failed audit
  // ============================================================================
  const retryMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/retry$/);
  if (req.method === 'POST' && retryMatch) {
    const jobId = retryMatch[1];

    try {
      const sessionId = getSessionId(req);
      const userId = sessionId ? await loadUserId(sessionId) : undefined;

      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      // Authorization check
      if (job.visibility === 'private' && job.userId !== userId) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        return true;
      }

      // Only allow retrying failed/cancelled audits
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: `Cannot retry audit with status: ${job.status}`
        }));
        return true;
      }

      // Reset job to pending so workers can pick it up
      // If job has projectPath + sopId, it can be resumed
      // Otherwise, it needs to be started from scratch
      if (job.projectPath && job.sopId) {
        // Can be resumed - reset to pending
        await db
          .update(auditJobs)
          .set({
            status: 'pending',
            errorMessage: null,
            completedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(auditJobs.id, jobId));

        log.info('Audit reset to pending for retry', { jobId });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          message: 'Audit reset to pending - will be picked up by workers'
        }));
      } else {
        // Can't be resumed - need to create new audit
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Cannot retry - audit never initialized. Please start a new audit instead.'
        }));
      }

      return true;
    } catch (error: any) {
      log.error('Failed to retry audit', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId - Get audit details (job + results)
  // ============================================================================
  const detailsMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && detailsMatch) {
    const jobId = detailsMatch[1];

    try {
      // Get user session for authorization check - try session first, then JWT
      const sessionId = getSessionId(req);
      let userId = sessionId ? await loadUserId(sessionId) : undefined;
      let authMethod = 'none';

      log.info('Session check', { sessionId: sessionId?.substring(0, 8), sessionUserId: userId });

      // If no session-based userId, try JWT auth
      if (!userId) {
        const jwtAuth = await verifyAuth(req);
        log.info('JWT auth result', { jwtAuth: !!jwtAuth, userId: jwtAuth?.user?.id });
        if (jwtAuth) {
          userId = jwtAuth.user.id;
          authMethod = 'jwt';
        }
      } else {
        authMethod = 'session';
      }

      log.info('GET audit details request', { jobId, userId, authMethod, hasAuth: !!userId });

      // Fetch job with project information
      const jobWithProject = await db
        .select({
          job: auditJobs,
          project: projects,
        })
        .from(auditJobs)
        .leftJoin(projects, eq(auditJobs.projectId, projects.id))
        .where(eq(auditJobs.id, jobId))
        .limit(1);

      if (!jobWithProject.length) {
        log.warn('Audit not found in DB', { jobId });
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      const { job, project } = jobWithProject[0];

      log.info('Audit job found', {
        jobId,
        found: !!job,
        jobUserId: job?.userId,
        requestUserId: userId,
        visibility: job?.visibility,
        match: job?.userId === userId,
        hasProject: !!project
      });

      // Check if user can view this audit
      // Public audits: anyone can view
      // Private audits: only the owner can view
      if (job.visibility === 'private' && job.userId && job.userId !== userId) {
        log.warn('Access denied - user mismatch', { jobId, jobUserId: job.userId, requestUserId: userId, visibility: job.visibility });
        res.statusCode = 404; // Return 404 instead of 403 to avoid leaking audit existence
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      log.info('Access granted to audit details', { jobId, userId });

      // Fetch SOP execution metadata (if exists)
      const [sopExec] = await db.select().from(auditSopExecution).where(eq(auditSopExecution.jobId, jobId));

      // Fetch audit results (if completed)
      const [results] = await db.select().from(auditResults).where(eq(auditResults.jobId, jobId));

      // Build response with both job metadata and results
      const response: any = {
        success: true,
        audit: {
          id: job.id,
          status: job.status,
          auditType: job.auditType,
          visibility: job.visibility,
          sourceType: job.sourceType,
          auditDepth: job.auditDepth,
          detectedFramework: job.detectedFramework,
          sopId: job.sopId,
          sopVersion: job.sopVersion,
          progressPct: job.progressPct,
          currentStepId: job.currentStepId,
          currentStepName: job.currentStepName,
          stepsCompleted: job.stepsCompleted,
          stepsTotal: job.stepsTotal,
          contractAddress: job.contractAddress,
          contractNetwork: job.contractNetwork,
          contractName: job.contractName,
          isProxy: job.isProxy,
          implementationAddress: job.implementationAddress,
          deployerAddress: job.deployerAddress,
          repo: job.repo,
          branch: job.branch,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
        },
      };

      // Include project information if available
      if (project) {
        response.project = {
          id: project.id,
          name: project.name,
          description: project.description,
          logoUrl: project.logoUrl,
          websiteUrl: project.websiteUrl,
          githubUrl: project.githubUrl,
          twitterUrl: project.twitterUrl,
          discordUrl: project.discordUrl,
          docsUrl: project.docsUrl,
        };
      }

      // Include SOP execution if exists
      if (sopExec) {
        response.sopExecution = sopExec;
      }

      // Include results if exists
      if (results) {
        response.results = {
          score: results.scoreValue,
          grade: results.scoreLabel,
          vulnerabilities: results.findings,
          summary: results.summary,
          metadata: results.metadata,
          // Extract commonly used fields from metadata for easy access
          technicalChecks: (results.metadata as any)?.technicalChecks || [],
          businessRiskChecks: (results.metadata as any)?.businessRiskChecks || [],
          functionOverview: (results.metadata as any)?.functionOverview || [],
          contractAnalysis: (results.metadata as any)?.contractAnalysis,
          gasOptimizations: (results.metadata as any)?.gasOptimizations,
          bestPractices: (results.metadata as any)?.bestPractices,
          riskLevel: (results.metadata as any)?.riskLevel,
          scanDuration: (results.metadata as any)?.scanDuration,
        };
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response));
      return true;
    } catch (error: any) {
      log.error('Failed to get audit details', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId/steps - Get all step progress for an audit
  // ============================================================================
  const stepsMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/steps$/);
  if (req.method === 'GET' && stepsMatch) {
    const jobId = stepsMatch[1];

    try {
      const steps = await db.select()
        .from(auditStepProgress)
        .where(eq(auditStepProgress.jobId, jobId))
        .orderBy(asc(auditStepProgress.orderIndex));

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        steps: steps.map((s) => ({
          id: s.stepId,
          name: s.stepName,
          category: s.stepCategory,
          status: s.status,
          pct: s.status === 'completed' ? 100 : s.internalPct || 0,
          message: s.internalMessage,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationMs: s.durationMs ? Number(s.durationMs) : null,
          errorMessage: s.errorMessage,
          retryCount: s.retryCount,
        })),
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get audit steps', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/:jobId/clarifications - Get post-audit clarification questions
  // ============================================================================
  const clarificationsMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/clarifications$/);
  if (req.method === 'GET' && clarificationsMatch) {
    const jobId = clarificationsMatch[1];

    try {
      const { getAllClarifications } = await import('../../services/clarificationService.js');

      // Get post-audit clarifications
      const clarifications = await getAllClarifications(jobId, 'post_audit');

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        clarifications: clarifications.map((c) => ({
          id: c.id,
          questionKey: c.questionKey,
          questionText: c.questionText,
          questionType: c.questionType,
          options: c.options,
          context: c.context,
          status: c.status,
          answerValue: c.answerValue,
          answeredAt: c.answeredAt,
        })),
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get clarifications', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audit/:jobId/clarifications/:clarificationId/answer - Submit answer
  // ============================================================================
  const answerMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/clarifications\/([a-f0-9-]+)\/answer$/);
  if (req.method === 'POST' && answerMatch) {
    const jobId = answerMatch[1];
    const clarificationId = answerMatch[2];

    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const { answer } = body;

      if (answer === undefined || answer === null) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'answer is required' }));
        return true;
      }

      const { submitAnswer } = await import('../../services/clarificationService.js');
      const updated = await submitAnswer(clarificationId, answer);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        clarification: updated,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to submit clarification answer', { jobId, clarificationId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audit/detect - Detect ecosystem for a project
  // ============================================================================
  if (req.method === 'POST' && parsed.pathname === '/api/audit/detect') {
    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const { projectPath } = body;

      if (!projectPath) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'projectPath is required' }));
        return true;
      }

      const detection = await detectEcosystem(projectPath);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, detection }));
      return true;
    } catch (error: any) {
      log.error('Failed to detect ecosystem', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/sops - Get available SOPs
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname === '/api/audit/sops') {
    try {
      const sops = getAllAvailableSOPs();

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        sops: sops.map((sop) => ({
          id: sop.id,
          name: sop.name,
          version: sop.version,
          framework: sop.framework,
          language: sop.language,
          depths: {
            quick: {
              stepCount: sop.depths.quick.enabledSteps.length,
              estimatedMinutes: sop.depths.quick.estimatedDurationMinutes,
            },
            standard: {
              stepCount: sop.depths.standard.enabledSteps.length,
              estimatedMinutes: sop.depths.standard.estimatedDurationMinutes,
            },
            deep: {
              stepCount: sop.depths.deep.enabledSteps.length,
              estimatedMinutes: sop.depths.deep.estimatedDurationMinutes,
            },
          },
        })),
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get SOPs', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audit/tools - Get available tools
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname === '/api/audit/tools') {
    try {
      const toolNames = await getAvailableToolNames();
      const toolChecks = await checkToolsAvailable(toolNames);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        tools: toolChecks,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to check tools', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // PUT /api/audit/:id/visibility - Update audit visibility
  // ============================================================================
  const visibilityMatch = parsed.pathname.match(/^\/api\/audit\/([a-f0-9-]{36})\/visibility$/);
  if (req.method === 'PUT' && visibilityMatch) {
    try {
      const jobId = visibilityMatch[1];
      log.info('Visibility update request received', { jobId, pathname: parsed.pathname });

      // Parse request body
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      const { visibility } = body;
      log.info('Visibility update parsed', { jobId, visibility });

      if (!visibility || !['private', 'public', 'unlisted'].includes(visibility)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: false,
          error: 'Valid visibility required (private, public, or unlisted)'
        }));
        return true;
      }

      // Get current user - try session first, then JWT
      const sessionId = getSessionId(req);
      let userId = sessionId ? await loadUserId(sessionId) : null;

      // If no session-based userId, try JWT auth
      if (!userId) {
        const jwtAuth = await verifyAuth(req);
        if (jwtAuth) {
          userId = jwtAuth.user.id;
        }
      }

      // Debug: Check all audits for this user
      const userAudits = await db.select({ id: auditJobs.id, status: auditJobs.status, visibility: auditJobs.visibility })
        .from(auditJobs)
        .where(eq(auditJobs.userId, userId || ''));
      log.info('User audits list', { userId, count: userAudits.length, audits: userAudits.slice(0, 5) });

      // Get audit job
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));
      log.info('Audit job query result', { jobId, found: !!job, jobData: job ? { id: job.id, status: job.status, userId: job.userId, visibility: job.visibility } : null });

      if (!job) {
        log.warn('Audit not found for visibility update', { jobId, userId });
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      // Check ownership - only owner can change visibility
      if (job.userId && job.userId !== userId) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }

      // Update visibility
      await db
        .update(auditJobs)
        .set({
          visibility: visibility as 'private' | 'public' | 'unlisted',
          updatedAt: new Date(),
        })
        .where(eq(auditJobs.id, jobId));

      log.info('Audit visibility updated', { jobId, visibility, userId });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        visibility,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to update audit visibility', { error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audit/:jobId/rescore - Rescore audit after triage
  // ============================================================================
  const rescoreMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)\/rescore$/);
  if (req.method === 'POST' && rescoreMatch) {
    const jobId = rescoreMatch[1];

    try {
      // Parse request body
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      // Get user session
      const sessionId = getSessionId(req);
      let userId: string | undefined;
      if (sessionId) {
        userId = (await loadUserId(sessionId)) || undefined;
      }

      // If no session-based userId, try JWT auth
      if (!userId) {
        const jwtAuth = await verifyAuth(req);
        if (jwtAuth) {
          userId = jwtAuth.user.id;
        }
      }

      // Get audit job
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

      // Check ownership
      if (job.userId && job.userId !== userId) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Access denied' }));
        return true;
      }

      // Get audit results
      const [results] = await db.select().from(auditResults).where(eq(auditResults.jobId, jobId));

      if (!results) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit results not found' }));
        return true;
      }

      const { triages } = body;

      if (!triages || !Array.isArray(triages) || triages.length === 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'triages array is required' }));
        return true;
      }

      log.info('Saving triage answers', {
        jobId,
        triageCount: triages.length,
      });

      // Store triage answers in metadata (no verification for now)
      const updatedMetadata = {
        ...(typeof results.metadata === 'object' ? results.metadata : {}),
        triageAnswers: triages,
        triageSubmittedAt: new Date().toISOString(),
      };

      await db
        .update(auditResults)
        .set({
          metadata: updatedMetadata,
        })
        .where(eq(auditResults.jobId, jobId));

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        message: 'Triage answers saved successfully',
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to rescore audit', { jobId, error: error.message, stack: error.stack });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audits/:jobId/triage - Submit triage answers
  // ============================================================================
  if (req.method === 'POST' && parsed.pathname.match(/^\/api\/audits\/([^/]+)\/triage$/)) {
    const jobId = parsed.pathname.split('/')[3];

    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const { answers } = body;

      if (!answers || typeof answers !== 'object') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'answers object required' }));
        return true;
      }

      // Import clarification service
      const { submitAnswer, getAllClarifications } = await import('../../services/clarificationService.js');

      // Submit each answer
      const savedAnswers = [];
      for (const [clarificationId, response] of Object.entries(answers)) {
        if (response && typeof response === 'object' && 'answer' in response) {
          const answer = await submitAnswer(clarificationId, response);
          savedAnswers.push(answer);
        }
      }

      log.info('Triage answers submitted', {
        jobId,
        count: savedAnswers.length,
      });

      // Trigger re-scoring with disclosure
      const { rescoreWithDisclosure } = await import('../../services/rescoreService.js');
      await rescoreWithDisclosure(jobId);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        answers: savedAnswers,
        rescored: true,
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to submit triage', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audits/:jobId/questionnaire - Get pre-audit questionnaire answers
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname.match(/^\/api\/audits\/([^/]+)\/questionnaire$/)) {
    const jobId = parsed.pathname.split('/')[3];

    try {
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Audit not found' }));
        return true;
      }

      // Get pre-audit clarifications for this job
      const { getAllClarifications } = await import('../../services/clarificationService.js');
      const clarifications = await getAllClarifications(jobId, 'pre_audit');

      // Format for display - extract actual values from answerValue
      const answers = clarifications.map(c => {
        let formattedAnswer = 'Not answered';

        if (c.answerValue) {
          // answerValue is typically { value: <actual answer>, questionKey: <key> }
          const answerObj = c.answerValue as any;
          if (answerObj.value !== undefined) {
            const value = answerObj.value;
            // Format arrays nicely
            if (Array.isArray(value)) {
              formattedAnswer = value.length > 0 ? value.join(', ') : 'None';
            } else {
              formattedAnswer = String(value);
            }
          } else {
            // Fallback to stringifying if structure is different
            formattedAnswer = typeof c.answerValue === 'string'
              ? c.answerValue
              : JSON.stringify(c.answerValue);
          }
        }

        return {
          question: c.questionText,
          answer: formattedAnswer,
          category: (c.context as any)?.category || 'general',
          status: c.status,
          answeredAt: c.answeredAt,
        };
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ answers }));
      return true;
    } catch (error: any) {
      log.error('Failed to get questionnaire', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audits/:jobId/clarifications - Get all clarifications with answers
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname.match(/^\/api\/audits\/([^/]+)\/clarifications$/)) {
    const jobId = parsed.pathname.split('/')[3];

    try {
      const { getAllClarifications } = await import('../../services/clarificationService.js');
      const clarifications = await getAllClarifications(jobId);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ clarifications }));
      return true;
    } catch (error: any) {
      log.error('Failed to get clarifications', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // GET /api/audits/:jobId/triage - Get triage questions with answers
  // ============================================================================
  if (req.method === 'GET' && parsed.pathname.match(/^\/api\/audits\/([^/]+)\/triage$/)) {
    const jobId = parsed.pathname.split('/')[3];

    try {
      // Get all post-audit triage clarifications
      const triage = await db
        .select()
        .from(auditClarifications)
        .where(eq(auditClarifications.jobId, jobId));

      const triageQuestions = triage
        .filter(c => c.phase === 'post_audit')
        .map(q => ({
          id: q.id,
          findingId: (q.context as any)?.findingId,
          questionText: q.questionText,
          finding: (q.context as any)?.finding,
          answerValue: q.answerValue,
          status: q.status,
          answeredAt: q.answeredAt
        }));

      log.info('Retrieved triage questions', {
        jobId,
        count: triageQuestions.length,
        answered: triageQuestions.filter(q => q.status === 'answered').length
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        questions: triageQuestions
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to get triage questions', { jobId, error: error.message });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  // ============================================================================
  // POST /api/audits/:jobId/generate-triage - Generate triage questions from findings
  // ============================================================================
  if (req.method === 'POST' && parsed.pathname.match(/^\/api\/audits\/([^/]+)\/generate-triage$/)) {
    const jobId = parsed.pathname.split('/')[3];

    try {
      // Get audit results
      const [results] = await db.select().from(auditResults).where(eq(auditResults.jobId, jobId));

      if (!results) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit results not found' }));
        return true;
      }

      // Get findings that need triage (critical, high)
      const findings = Array.isArray(results.findings) ? results.findings : [];
      const criticalFindings = findings.filter((f: any) =>
        f.severity === 'critical' || f.severity === 'high'
      );

      log.info('Generating triage questions', {
        jobId,
        totalFindings: findings.length,
        criticalFindings: criticalFindings.length
      });

      // Check if triage questions already exist
      const existingClarifications = await db
        .select()
        .from(auditClarifications)
        .where(eq(auditClarifications.jobId, jobId));

      const existingTriageQuestions = existingClarifications.filter(c => c.phase === 'post_audit');

      // If triage questions already exist, return them
      if (existingTriageQuestions.length > 0) {
        log.info('Triage questions already exist', {
          jobId,
          count: existingTriageQuestions.length
        });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          success: true,
          questions: existingTriageQuestions.map(q => ({
            id: q.id,
            findingId: (q.context as any)?.findingId,
            questionText: q.questionText,
            finding: (q.context as any)?.finding,
            answerValue: q.answerValue,
            status: q.status
          })),
          message: 'Loaded existing triage questions'
        }));
        return true;
      }

      // Generate new triage questions from critical/high findings
      const triageQuestions = [];
      for (const finding of criticalFindings) {
        const findingId = finding.findingId || finding.id || `finding-${Math.random().toString(36).substr(2, 9)}`;

        // Create a triage question for this finding
        const questionText = `[${finding.severity.toUpperCase()}] ${finding.title}: Please explain if this is a false positive, intentionally designed, or has been mitigated elsewhere.`;

        const [clarification] = await db
          .insert(auditClarifications)
          .values({
            jobId: jobId,
            phase: 'post_audit',
            questionText: questionText,
            questionKey: `triage_${findingId}`,
            questionType: 'text',
            status: 'pending',
            context: {
              findingId: findingId,
              finding: {
                title: finding.title,
                severity: finding.severity,
                description: finding.description,
                file: finding.file,
                line: finding.line,
                recommendation: finding.rec || finding.recommendation,
                code_snippet: finding.code_snippet || finding.codeSnippet
              },
              category: 'triage',
              generatedFromFinding: true
            },
            createdAt: new Date()
          })
          .returning();

        triageQuestions.push({
          id: clarification.id,
          findingId: findingId,
          questionText: questionText,
          finding: {
            title: finding.title,
            severity: finding.severity,
            description: finding.description,
            file: finding.file,
            line: finding.line,
            recommendation: finding.rec || finding.recommendation
          },
          status: 'pending'
        });
      }

      log.info('Generated triage questions', {
        jobId,
        count: triageQuestions.length
      });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: true,
        questions: triageQuestions,
        message: `Generated ${triageQuestions.length} triage questions from critical/high findings`
      }));
      return true;
    } catch (error: any) {
      log.error('Failed to generate triage questions', { jobId, error: error.message, stack: error.stack });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: error.message }));
      return true;
    }
  }

  return false;
}

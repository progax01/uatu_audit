/**
 * Unified Audit Routes
 *
 * API endpoints for the new SOP-based unified audit system.
 * Provides a single entry point for all audit types with micro-step progress tracking.
 */

import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditJobs, auditStepProgress, auditSopExecution, auditResults } from '../../db/schema.js';

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

      // Get user session
      const sessionId = getSessionId(req);
      let userId: string | undefined;
      if (sessionId) {
        userId = (await loadUserId(sessionId)) || undefined;
      }

      // Validate request
      const { source, depth, visibility, projectId, options } = body;

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
          res.write(`data: ${JSON.stringify(progress)}\n\n`);

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
  // GET /api/audit/:jobId - Get audit details (job + results)
  // ============================================================================
  const detailsMatch = parsed.pathname?.match(/^\/api\/audit\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && detailsMatch) {
    const jobId = detailsMatch[1];

    try {
      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      if (!job) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Audit not found' }));
        return true;
      }

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

  return false;
}

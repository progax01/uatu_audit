/**
 * Interactive Audit API Routes
 *
 * Endpoints for managing interactive audit sessions, prompts, and context.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditSessions,
  auditPrompts,
  auditUserAnswers,
  auditKnownAddresses,
  auditLinkedProjects,
  auditFindings,
  auditJobs,
  notifications,
} from '../../db/schema.js';
import type { AddressType, LinkedProjectRelationship } from '../../db/schema.js';
import { getPromptTemplate, PROMPT_TEMPLATES } from '../../services/promptTemplates.js';
import {
  getConversationHistory,
  getConversationSummary,
  resumeConversation,
  getLatestSnapshot,
} from '../../services/aiConversationService.js';
import { sendJson, sendError, parseJsonBody } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { getSessionId, loadUserId } from './auth.js';

const log = logger.child({ module: 'interactive-audit-routes' });

// ============================================================================
// Helpers
// ============================================================================

function getAddressTypeLabel(type: AddressType): string {
  const labels: Record<AddressType, string> = {
    eoa: 'EOA (Single Key)',
    multisig: 'Multisig Wallet',
    timelock: 'Timelock Contract',
    governance: 'Governance Contract',
    treasury: 'Treasury',
    oracle: 'Oracle',
    protocol: 'Protocol Contract',
    renounced: 'Renounced',
    unknown: 'Unknown',
  };
  return labels[type] || type;
}

async function getUserIdFromRequest(req: any): Promise<string | null> {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;
  return loadUserId(sessionId);
}

function extractJobId(pathname: string, prefix: string): string | null {
  const regex = new RegExp(`^${prefix}/([^/]+)`);
  const match = pathname.match(regex);
  return match ? match[1] : null;
}

function extractSecondParam(pathname: string, prefix: string): string | null {
  const regex = new RegExp(`^${prefix}/[^/]+/[^/]+/([^/]+)`);
  const match = pathname.match(regex);
  return match ? match[1] : null;
}

// ============================================================================
// Main Route Handler
// ============================================================================

export async function handleInteractiveAuditRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  const { pathname } = parsed;
  const prefix = '/api/audit';

  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const userId = await getUserIdFromRequest(req);

  // ==========================================================================
  // GET /api/audit/prompt-templates
  // ==========================================================================
  if (req.method === 'GET' && pathname === `${prefix}/prompt-templates`) {
    const templates = Object.values(PROMPT_TEMPLATES).map((t) => ({
      id: t.id,
      type: t.type,
      question: t.question,
      description: t.description,
      options: t.options,
      fields: t.fields,
      defaultValue: t.defaultValue,
      timeoutSeconds: t.timeoutSeconds,
    }));
    sendJson(res, { templates });
    return true;
  }

  // ==========================================================================
  // GET /api/audit/:jobId/session
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/session$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId) {
      sendError(res, 'Job ID required', 400);
      return true;
    }

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session) {
        sendError(res, 'Session not found', 404);
        return true;
      }

      if (session.userId !== userId) {
        sendError(res, 'Unauthorized', 403);
        return true;
      }

      const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

      let currentPrompt = null;
      if (session.currentPromptId) {
        const [prompt] = await db
          .select()
          .from(auditPrompts)
          .where(eq(auditPrompts.id, session.currentPromptId));

        if (prompt && prompt.status === 'pending') {
          const template = getPromptTemplate(prompt.templateId || '');
          const timeoutAt = new Date(
            prompt.createdAt.getTime() + (prompt.timeoutSeconds || 300) * 1000
          );
          const timeoutRemaining = Math.max(0, Math.floor((timeoutAt.getTime() - Date.now()) / 1000));

          currentPrompt = {
            ...prompt,
            template,
            timeoutAt: timeoutAt.toISOString(),
            timeoutRemaining,
          };
        }
      }

      const linkedProjects = await db
        .select()
        .from(auditLinkedProjects)
        .where(eq(auditLinkedProjects.sessionId, session.id));

      const knownAddresses = await db
        .select()
        .from(auditKnownAddresses)
        .where(eq(auditKnownAddresses.sessionId, session.id));

      const answers = await db
        .select()
        .from(auditUserAnswers)
        .where(eq(auditUserAnswers.sessionId, session.id));

      sendJson(res, {
        sessionId: session.id,
        status: session.status,
        progress: job
          ? {
              currentStep: job.stepsCompleted || 0,
              totalSteps: job.stepsTotal || 0,
              percent: job.progressPct || 0,
              stepName: job.currentStepName,
            }
          : null,
        currentPrompt,
        linkedProjects,
        knownAddresses,
        userAnswers: answers,
        config: {
          interactiveMode: session.interactiveMode,
          autoContinueTimeoutSeconds: session.autoContinueTimeoutSeconds,
          notificationEmail: session.notificationEmail,
        },
      });
      return true;
    } catch (error: any) {
      log.error('Failed to get session state', { error: error.message, jobId });
      sendError(res, 'Failed to get session state', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/prompts
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/prompts$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const prompts = await db
        .select()
        .from(auditPrompts)
        .where(eq(auditPrompts.sessionId, session.id))
        .orderBy(desc(auditPrompts.createdAt));

      const status = parsed.query.status;
      const filtered = status ? prompts.filter((p) => p.status === status) : prompts;

      const enriched = filtered.map((prompt) => ({
        ...prompt,
        template: getPromptTemplate(prompt.templateId || ''),
      }));

      sendJson(res, { prompts: enriched });
      return true;
    } catch (error: any) {
      log.error('Failed to get prompts', { error: error.message, jobId });
      sendError(res, 'Failed to get prompts', 500);
      return true;
    }
  }

  // ==========================================================================
  // POST /api/audit/:jobId/prompts/:promptId/answer
  // ==========================================================================
  if (req.method === 'POST' && pathname.match(/^\/api\/audit\/[^/]+\/prompts\/[^/]+\/answer$/)) {
    const jobId = extractJobId(pathname, prefix);
    const promptId = extractSecondParam(pathname, prefix);

    if (!jobId || !promptId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const body = (await parseJsonBody(req)) as { answer?: any; applyToSimilar?: boolean };
      const { answer, applyToSimilar = true } = body;

      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const [prompt] = await db
        .select()
        .from(auditPrompts)
        .where(and(eq(auditPrompts.id, promptId), eq(auditPrompts.sessionId, session.id)));

      if (!prompt) {
        sendError(res, 'Prompt not found', 404);
        return true;
      }

      if (prompt.status !== 'pending') {
        sendError(res, 'Prompt already answered or timed out', 400);
        return true;
      }

      await db.insert(auditUserAnswers).values({
        sessionId: session.id,
        promptId: prompt.id,
        answer,
        applyToSimilar,
        answeredBy: 'user',
      });

      await db
        .update(auditPrompts)
        .set({
          status: 'answered',
          answeredAt: new Date(),
        })
        .where(eq(auditPrompts.id, promptId));

      if (prompt.templateId === 'admin_address_type') {
        const address = (prompt.variables as any)?.address;
        if (address) {
          const addressType = (answer?.value || answer) as AddressType;

          await db.insert(auditKnownAddresses).values({
            sessionId: session.id,
            address,
            chain: 'ethereum',
            label: getAddressTypeLabel(addressType),
            addressType,
            metadata: answer?.metadata || {},
            source: 'user',
          });
        }
      }

      log.info('Prompt answered', { promptId, answer });

      sendJson(res, {
        success: true,
        promptId,
        status: 'answered',
      });
      return true;
    } catch (error: any) {
      log.error('Failed to answer prompt', { error: error.message, promptId });
      sendError(res, 'Failed to answer prompt', 500);
      return true;
    }
  }

  // ==========================================================================
  // POST /api/audit/:jobId/prompts/:promptId/skip
  // ==========================================================================
  if (req.method === 'POST' && pathname.match(/^\/api\/audit\/[^/]+\/prompts\/[^/]+\/skip$/)) {
    const jobId = extractJobId(pathname, prefix);
    const promptId = extractSecondParam(pathname, prefix);

    if (!jobId || !promptId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const [prompt] = await db
        .select()
        .from(auditPrompts)
        .where(and(eq(auditPrompts.id, promptId), eq(auditPrompts.sessionId, session.id)));

      if (!prompt || prompt.status !== 'pending') {
        sendError(res, 'Prompt not found or already handled', 400);
        return true;
      }

      await db
        .update(auditPrompts)
        .set({
          status: 'skipped',
          answeredAt: new Date(),
        })
        .where(eq(auditPrompts.id, promptId));

      const template = getPromptTemplate(prompt.templateId || '');
      const defaultValue = prompt.defaultValue || template?.defaultValue;

      if (defaultValue !== undefined) {
        await db.insert(auditUserAnswers).values({
          sessionId: session.id,
          promptId: prompt.id,
          answer: defaultValue,
          applyToSimilar: true,
          answeredBy: 'skip',
        });
      }

      sendJson(res, {
        success: true,
        promptId,
        status: 'skipped',
      });
      return true;
    } catch (error: any) {
      log.error('Failed to skip prompt', { error: error.message, promptId });
      sendError(res, 'Failed to skip prompt', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/linked-projects
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/linked-projects$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const linkedProjects = await db
        .select()
        .from(auditLinkedProjects)
        .where(eq(auditLinkedProjects.sessionId, session.id));

      sendJson(res, { linkedProjects });
      return true;
    } catch (error: any) {
      log.error('Failed to get linked projects', { error: error.message, jobId });
      sendError(res, 'Failed to get linked projects', 500);
      return true;
    }
  }

  // ==========================================================================
  // POST /api/audit/:jobId/linked-projects
  // ==========================================================================
  if (req.method === 'POST' && pathname.match(/^\/api\/audit\/[^/]+\/linked-projects$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const body = (await parseJsonBody(req)) as {
        name?: string;
        sourceType?: string;
        sourceConfig?: Record<string, any>;
        relationship?: string;
        relationshipDescription?: string;
        relevantContracts?: string[];
      };
      const {
        name,
        sourceType,
        sourceConfig,
        relationship,
        relationshipDescription,
        relevantContracts,
      } = body;

      if (!name || !sourceType || !sourceConfig || !relationship) {
        sendError(res, 'Missing required fields', 400);
        return true;
      }

      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const [linkedProject] = await db
        .insert(auditLinkedProjects)
        .values({
          sessionId: session.id,
          name,
          sourceType,
          sourceConfig,
          relationship: relationship as LinkedProjectRelationship,
          relationshipDescription,
          relevantContracts,
          addedBy: 'user',
        })
        .returning();

      log.info('Linked project added', { linkedProjectId: linkedProject.id, name });

      sendJson(res, { linkedProject });
      return true;
    } catch (error: any) {
      log.error('Failed to add linked project', { error: error.message, jobId });
      sendError(res, 'Failed to add linked project', 500);
      return true;
    }
  }

  // ==========================================================================
  // DELETE /api/audit/:jobId/linked-projects/:projectId
  // ==========================================================================
  if (req.method === 'DELETE' && pathname.match(/^\/api\/audit\/[^/]+\/linked-projects\/[^/]+$/)) {
    const jobId = extractJobId(pathname, prefix);
    const projectId = extractSecondParam(pathname, prefix);

    if (!jobId || !projectId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      await db
        .delete(auditLinkedProjects)
        .where(
          and(
            eq(auditLinkedProjects.id, projectId),
            eq(auditLinkedProjects.sessionId, session.id)
          )
        );

      sendJson(res, { success: true });
      return true;
    } catch (error: any) {
      log.error('Failed to delete linked project', { error: error.message, projectId });
      sendError(res, 'Failed to delete linked project', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/known-addresses
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/known-addresses$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const knownAddresses = await db
        .select()
        .from(auditKnownAddresses)
        .where(eq(auditKnownAddresses.sessionId, session.id));

      sendJson(res, { knownAddresses });
      return true;
    } catch (error: any) {
      log.error('Failed to get known addresses', { error: error.message, jobId });
      sendError(res, 'Failed to get known addresses', 500);
      return true;
    }
  }

  // ==========================================================================
  // POST /api/audit/:jobId/known-addresses
  // ==========================================================================
  if (req.method === 'POST' && pathname.match(/^\/api\/audit\/[^/]+\/known-addresses$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const body = (await parseJsonBody(req)) as {
        address?: string;
        chain?: string;
        label?: string;
        addressType?: AddressType;
        metadata?: Record<string, any>;
        linkedProjectId?: string;
      };
      const { address, chain, label, addressType, metadata, linkedProjectId } = body;

      if (!address || !chain || !label || !addressType) {
        sendError(res, 'Missing required fields', 400);
        return true;
      }

      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const [knownAddress] = await db
        .insert(auditKnownAddresses)
        .values({
          sessionId: session.id,
          address,
          chain,
          label,
          addressType,
          metadata: metadata || {},
          linkedProjectId,
          source: 'user',
        })
        .returning();

      log.info('Known address added', { knownAddressId: knownAddress.id, address });

      sendJson(res, { knownAddress });
      return true;
    } catch (error: any) {
      log.error('Failed to add known address', { error: error.message, jobId });
      sendError(res, 'Failed to add known address', 500);
      return true;
    }
  }

  // ==========================================================================
  // PUT /api/audit/:jobId/known-addresses/:addressId
  // ==========================================================================
  if (req.method === 'PUT' && pathname.match(/^\/api\/audit\/[^/]+\/known-addresses\/[^/]+$/)) {
    const jobId = extractJobId(pathname, prefix);
    const addressId = extractSecondParam(pathname, prefix);

    if (!jobId || !addressId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const body = (await parseJsonBody(req)) as {
        label?: string;
        addressType?: AddressType;
        metadata?: Record<string, any>;
      };
      const { label, addressType, metadata } = body;

      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const updateData: Record<string, any> = {};
      if (label !== undefined) updateData.label = label;
      if (addressType !== undefined) updateData.addressType = addressType;
      if (metadata !== undefined) updateData.metadata = metadata;

      const [updated] = await db
        .update(auditKnownAddresses)
        .set(updateData)
        .where(
          and(
            eq(auditKnownAddresses.id, addressId),
            eq(auditKnownAddresses.sessionId, session.id)
          )
        )
        .returning();

      if (!updated) {
        sendError(res, 'Address not found', 404);
        return true;
      }

      sendJson(res, { knownAddress: updated });
      return true;
    } catch (error: any) {
      log.error('Failed to update known address', { error: error.message, addressId });
      sendError(res, 'Failed to update known address', 500);
      return true;
    }
  }

  // ==========================================================================
  // DELETE /api/audit/:jobId/known-addresses/:addressId
  // ==========================================================================
  if (req.method === 'DELETE' && pathname.match(/^\/api\/audit\/[^/]+\/known-addresses\/[^/]+$/)) {
    const jobId = extractJobId(pathname, prefix);
    const addressId = extractSecondParam(pathname, prefix);

    if (!jobId || !addressId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      await db
        .delete(auditKnownAddresses)
        .where(
          and(
            eq(auditKnownAddresses.id, addressId),
            eq(auditKnownAddresses.sessionId, session.id)
          )
        );

      sendJson(res, { success: true });
      return true;
    } catch (error: any) {
      log.error('Failed to delete known address', { error: error.message, addressId });
      sendError(res, 'Failed to delete known address', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/findings
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/findings$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      let findings = await db
        .select()
        .from(auditFindings)
        .where(eq(auditFindings.jobId, jobId));

      const { severity, status } = parsed.query;
      if (severity) {
        findings = findings.filter(
          (f) => (f.adjustedSeverity || f.originalSeverity) === severity
        );
      }
      if (status) {
        findings = findings.filter((f) => f.status === status);
      }

      const summary = {
        total: findings.length,
        bySeverity: {
          critical: findings.filter((f) => (f.adjustedSeverity || f.originalSeverity) === 'critical').length,
          high: findings.filter((f) => (f.adjustedSeverity || f.originalSeverity) === 'high').length,
          medium: findings.filter((f) => (f.adjustedSeverity || f.originalSeverity) === 'medium').length,
          low: findings.filter((f) => (f.adjustedSeverity || f.originalSeverity) === 'low').length,
          info: findings.filter((f) => (f.adjustedSeverity || f.originalSeverity) === 'info').length,
        },
        adjusted: findings.filter((f) => f.adjustedSeverity && f.adjustedSeverity !== f.originalSeverity).length,
        withContext: findings.filter((f) => f.userContext && Object.keys(f.userContext as any).length > 0).length,
      };

      sendJson(res, { findings, summary });
      return true;
    } catch (error: any) {
      log.error('Failed to get findings', { error: error.message, jobId });
      sendError(res, 'Failed to get findings', 500);
      return true;
    }
  }

  // ==========================================================================
  // PUT /api/audit/:jobId/findings/:findingId/status
  // ==========================================================================
  if (req.method === 'PUT' && pathname.match(/^\/api\/audit\/[^/]+\/findings\/[^/]+\/status$/)) {
    const jobId = extractJobId(pathname, prefix);
    const parts = pathname.split('/');
    const findingId = parts[5];

    if (!jobId || !findingId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const body = (await parseJsonBody(req)) as { status?: string; disputeReason?: string };
      const { status, disputeReason } = body;

      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const updateData: Record<string, any> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'acknowledged') {
        updateData.acknowledged = true;
        updateData.acknowledgedAt = new Date();
      } else if (status === 'disputed') {
        updateData.disputed = true;
        updateData.disputeReason = disputeReason;
      }

      const [updated] = await db
        .update(auditFindings)
        .set(updateData)
        .where(
          and(eq(auditFindings.id, findingId), eq(auditFindings.jobId, jobId))
        )
        .returning();

      if (!updated) {
        sendError(res, 'Finding not found', 404);
        return true;
      }

      sendJson(res, { finding: updated });
      return true;
    } catch (error: any) {
      log.error('Failed to update finding status', { error: error.message, findingId });
      sendError(res, 'Failed to update finding status', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/notifications
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/notifications$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const notifs = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.jobId, jobId), eq(notifications.userId, userId)))
        .orderBy(desc(notifications.createdAt));

      sendJson(res, { notifications: notifs });
      return true;
    } catch (error: any) {
      log.error('Failed to get notifications', { error: error.message, jobId });
      sendError(res, 'Failed to get notifications', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/events (SSE endpoint for real-time updates)
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/events$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Session not found');
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      res.write(`event: connected\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`);

      const intervalId = setInterval(async () => {
        try {
          const [currentSession] = await db
            .select()
            .from(auditSessions)
            .where(eq(auditSessions.id, session.id));

          if (!currentSession) {
            clearInterval(intervalId);
            res.end();
            return;
          }

          res.write(`event: status\ndata: ${JSON.stringify({ status: currentSession.status })}\n\n`);

          if (currentSession.status === 'paused_for_input' && currentSession.currentPromptId) {
            const [prompt] = await db
              .select()
              .from(auditPrompts)
              .where(eq(auditPrompts.id, currentSession.currentPromptId));

            if (prompt && prompt.status === 'pending') {
              const template = getPromptTemplate(prompt.templateId || '');
              const timeoutAt = new Date(
                prompt.createdAt.getTime() + (prompt.timeoutSeconds || 300) * 1000
              );
              const timeoutRemaining = Math.max(0, Math.floor((timeoutAt.getTime() - Date.now()) / 1000));

              res.write(`event: prompt\ndata: ${JSON.stringify({
                prompt: { ...prompt, template, timeoutAt: timeoutAt.toISOString(), timeoutRemaining },
              })}\n\n`);
            }
          }

          if (currentSession.status === 'completed' || currentSession.status === 'failed') {
            res.write(`event: complete\ndata: ${JSON.stringify({ status: currentSession.status })}\n\n`);
            clearInterval(intervalId);
            res.end();
          }
        } catch (error) {
          log.error('SSE poll error', { error });
        }
      }, 2000);

      req.on('close', () => {
        clearInterval(intervalId);
      });

      return true;
    } catch (error: any) {
      log.error('Failed to set up SSE', { error: error.message, jobId });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to set up event stream');
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/conversation (AI Conversation Context for Resumption)
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/conversation$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      // Get conversation summary and context
      const summary = await getConversationSummary(session.id);
      const context = await resumeConversation(session.id);
      const latestSnapshot = await getLatestSnapshot(session.id);

      sendJson(res, {
        conversationId: session.aiConversationId,
        hasConversation: !!session.aiConversationId,
        summary,
        context,
        latestSnapshot: latestSnapshot
          ? {
              id: latestSnapshot.id,
              type: latestSnapshot.snapshotType,
              summary: latestSnapshot.contextSummary,
              createdAt: latestSnapshot.createdAt,
              resumable: latestSnapshot.resumable,
            }
          : null,
        config: {
          modelUsed: session.aiModelUsed,
          totalTurns: session.aiTotalTurns,
          totalTokensUsed: session.aiTotalTokensUsed,
          startedAt: session.aiConversationStartedAt,
          lastUsedAt: session.aiConversationLastUsedAt,
        },
      });
      return true;
    } catch (error: any) {
      log.error('Failed to get conversation context', { error: error.message, jobId });
      sendError(res, 'Failed to get conversation context', 500);
      return true;
    }
  }

  // ==========================================================================
  // GET /api/audit/:jobId/conversation/history
  // ==========================================================================
  if (req.method === 'GET' && pathname.match(/^\/api\/audit\/[^/]+\/conversation\/history$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      const { limit, offset, stepId } = parsed.query;
      const history = await getConversationHistory(session.id, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
        stepId: stepId || undefined,
      });

      sendJson(res, {
        history,
        total: history.length,
        conversationId: session.aiConversationId,
      });
      return true;
    } catch (error: any) {
      log.error('Failed to get conversation history', { error: error.message, jobId });
      sendError(res, 'Failed to get conversation history', 500);
      return true;
    }
  }

  // ==========================================================================
  // POST /api/audit/:jobId/conversation/resume
  // ==========================================================================
  if (req.method === 'POST' && pathname.match(/^\/api\/audit\/[^/]+\/conversation\/resume$/)) {
    const jobId = extractJobId(pathname, prefix);
    if (!jobId || !userId) {
      sendError(res, 'Unauthorized', 401);
      return true;
    }

    try {
      const [session] = await db
        .select()
        .from(auditSessions)
        .where(eq(auditSessions.jobId, jobId));

      if (!session || session.userId !== userId) {
        sendError(res, 'Session not found or unauthorized', 404);
        return true;
      }

      if (!session.aiConversationId) {
        sendError(res, 'No conversation to resume', 400);
        return true;
      }

      const context = await resumeConversation(session.id);

      if (!context) {
        sendError(res, 'Failed to build resumption context', 500);
        return true;
      }

      // Update last used timestamp
      await db
        .update(auditSessions)
        .set({
          aiConversationLastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(auditSessions.id, session.id));

      sendJson(res, {
        success: true,
        context,
        message: 'Conversation context loaded for resumption',
      });
      return true;
    } catch (error: any) {
      log.error('Failed to resume conversation', { error: error.message, jobId });
      sendError(res, 'Failed to resume conversation', 500);
      return true;
    }
  }

  return false;
}

export default handleInteractiveAuditRoutes;

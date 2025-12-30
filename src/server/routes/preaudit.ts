/**
 * Pre-Audit API Routes
 *
 * Handles the pre-audit questionnaire workflow:
 * 1. GET /preaudit/questions/:jobId - Get questionnaire for a job
 * 2. POST /preaudit/answers/:jobId - Submit user answers
 * 3. POST /preaudit/skip/:jobId - Skip questionnaire
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../../utils/logger.js';
import { getJob, updateJobPreAuditStatus } from '../../services/jobQueue.js';
import {
  loadQuestionnaire,
  saveQuestionnaire,
} from '../../services/preAuditQuestionGenerator.js';
import { loadPreAuditEvidence } from '../../services/preAuditScanService.js';
import type {
  PreAuditQuestionnaire,
  PreAuditAnswer,
} from '../../types/project.js';
import { getUatuHome } from '../../constants/paths.js';

const log = logger.child({ service: 'preaudit-routes' });

// ============================================================================
// UTILITIES
// ============================================================================

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

async function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Get context path for a job
 */
function getJobContextPath(job: { project: string; userId?: string; runTimestamp?: string }): string {
  const base = path.join(getUatuHome(), 'workspace');
  const userId = job.userId || 'anonymous';
  const projectSlug = job.project.replace(/\//g, '-');

  if (job.runTimestamp) {
    return path.join(base, 'users', userId, 'projects', projectSlug, 'runs', job.runTimestamp, 'context');
  }

  return path.join(base, 'users', userId, 'projects', projectSlug, 'context');
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /preaudit/questions/:jobId
 * Get the pre-audit questionnaire for a job
 */
async function getQuestions(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: number
): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'Job not found');
    }

    const contextPath = getJobContextPath(job);
    const questionnaire = await loadQuestionnaire(contextPath);

    if (!questionnaire) {
      // Check if evidence exists (scan completed but questions not generated)
      const evidence = await loadPreAuditEvidence(contextPath);
      if (evidence) {
        return sendJson(res, 200, {
          status: 'generating',
          message: 'Questions are being generated...',
        });
      }

      return sendJson(res, 200, {
        status: 'pending',
        message: 'Pre-audit scan not yet completed',
      });
    }

    sendJson(res, 200, questionnaire);
  } catch (error: any) {
    log.error('Failed to get questions', { error: error.message, jobId });
    sendError(res, 500, error.message || 'Failed to get questions');
  }
}

/**
 * POST /preaudit/answers/:jobId
 * Submit answers to pre-audit questionnaire
 */
async function submitAnswers(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: number
): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'Job not found');
    }

    const body = await parseJsonBody<{
      answers: PreAuditAnswer[];
    }>(req);

    if (!body.answers || !Array.isArray(body.answers)) {
      return sendError(res, 400, 'answers array is required');
    }

    const contextPath = getJobContextPath(job);
    const questionnaire = await loadQuestionnaire(contextPath);

    if (!questionnaire) {
      return sendError(res, 404, 'Questionnaire not found');
    }

    // Merge new answers with existing
    const answerMap = new Map<string, PreAuditAnswer>();

    // Existing answers
    for (const a of questionnaire.answers) {
      answerMap.set(a.questionId, a);
    }

    // New answers (override existing)
    for (const a of body.answers) {
      answerMap.set(a.questionId, {
        ...a,
        answeredAt: new Date().toISOString(),
      });
    }

    questionnaire.answers = Array.from(answerMap.values());
    questionnaire.updatedAt = new Date().toISOString();

    // Check if all required questions are answered
    const requiredQuestions = questionnaire.questions.filter(q => q.priority === 'HIGH');
    const answeredHigh = questionnaire.answers.filter(a =>
      requiredQuestions.some(q => q.id === a.questionId)
    );

    if (answeredHigh.length >= requiredQuestions.length) {
      questionnaire.status = 'COMPLETED';

      // Update job status
      await updateJobPreAuditStatus(jobId, 'completed', questionnaire.projectId);

      // Generate liability map from answers
      await generateLiabilityMap(contextPath, questionnaire);
    } else {
      questionnaire.status = 'IN_PROGRESS';
    }

    await saveQuestionnaire(contextPath, questionnaire);

    sendJson(res, 200, {
      success: true,
      status: questionnaire.status,
      answered: questionnaire.answers.length,
      total: questionnaire.questions.length,
    });
  } catch (error: any) {
    log.error('Failed to submit answers', { error: error.message, jobId });
    sendError(res, 500, error.message || 'Failed to submit answers');
  }
}

/**
 * POST /preaudit/skip/:jobId
 * Skip the pre-audit questionnaire
 */
async function skipQuestionnaire(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: number
): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'Job not found');
    }

    const contextPath = getJobContextPath(job);
    const questionnaire = await loadQuestionnaire(contextPath);

    if (questionnaire) {
      questionnaire.status = 'SKIPPED';
      questionnaire.updatedAt = new Date().toISOString();
      await saveQuestionnaire(contextPath, questionnaire);
    }

    // Update job status
    await updateJobPreAuditStatus(jobId, 'skipped');

    sendJson(res, 200, {
      success: true,
      message: 'Questionnaire skipped, proceeding with audit',
    });
  } catch (error: any) {
    log.error('Failed to skip questionnaire', { error: error.message, jobId });
    sendError(res, 500, error.message || 'Failed to skip questionnaire');
  }
}

/**
 * GET /preaudit/evidence/:jobId
 * Get the pre-audit evidence (for debugging/admin)
 */
async function getEvidence(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: number
): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, 404, 'Job not found');
    }

    const contextPath = getJobContextPath(job);
    const evidence = await loadPreAuditEvidence(contextPath);

    if (!evidence) {
      return sendError(res, 404, 'Evidence not found');
    }

    sendJson(res, 200, evidence);
  } catch (error: any) {
    log.error('Failed to get evidence', { error: error.message, jobId });
    sendError(res, 500, error.message || 'Failed to get evidence');
  }
}

// ============================================================================
// LIABILITY MAP GENERATION
// ============================================================================

interface LiabilityEntry {
  component: string;
  scope: 'INTERNAL' | 'EXTERNAL' | 'UNDECLARED';
  weight: number;
  reason: string;
  userOverride?: boolean;
}

/**
 * Generate liability map from questionnaire answers
 */
async function generateLiabilityMap(
  contextPath: string,
  questionnaire: PreAuditQuestionnaire
): Promise<void> {
  const liabilityMap: LiabilityEntry[] = [];

  // Process each answer
  for (const answer of questionnaire.answers) {
    const question = questionnaire.questions.find(q => q.id === answer.questionId);
    if (!question) continue;

    // Determine scope based on answer
    let scope: 'INTERNAL' | 'EXTERNAL' | 'UNDECLARED' = question.suggestedScope;
    let weight = 1.0;
    let reason = '';

    if (answer.scopeOverride) {
      scope = answer.scopeOverride;
    }

    if (answer.selectedOption && question.options) {
      const option = question.options.find(o => o.value === answer.selectedOption);
      if (option) {
        reason = option.label;

        // Adjust weight based on risk
        switch (option.risk) {
          case 'CRITICAL':
            weight = 1.0; // Full weight for critical risks
            break;
          case 'HIGH':
            weight = 0.8;
            break;
          case 'MEDIUM':
            weight = 0.5;
            break;
          case 'LOW':
            weight = 0.2;
            break;
        }
      }
    }

    liabilityMap.push({
      component: question.componentLabel,
      scope,
      weight: scope === 'EXTERNAL' ? weight * 0.2 : weight,
      reason: answer.freeformResponse || reason,
      userOverride: !!answer.scopeOverride,
    });
  }

  // Add hotspots that weren't explicitly answered
  for (const hotspot of questionnaire.evidenceSummary.riskHotspots) {
    const existing = liabilityMap.find(l => l.component === hotspot.component);
    if (!existing) {
      liabilityMap.push({
        component: hotspot.component,
        scope: hotspot.suggestedScope,
        weight: hotspot.suggestedScope === 'EXTERNAL' ? 0.2 : 1.0,
        reason: hotspot.reason,
      });
    }
  }

  // Save liability map
  const liabilityPath = path.join(contextPath, 'liability_map.json');
  await fs.mkdir(path.dirname(liabilityPath), { recursive: true });
  await fs.writeFile(liabilityPath, JSON.stringify({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    questionnaireId: questionnaire.projectId,
    entries: liabilityMap,
    summary: {
      internalCount: liabilityMap.filter(l => l.scope === 'INTERNAL').length,
      externalCount: liabilityMap.filter(l => l.scope === 'EXTERNAL').length,
      undeclaredCount: liabilityMap.filter(l => l.scope === 'UNDECLARED').length,
    },
  }, null, 2), 'utf-8');

  log.info('Generated liability map', {
    path: liabilityPath,
    entries: liabilityMap.length,
  });
}

// ============================================================================
// ROUTER
// ============================================================================

/**
 * Handle pre-audit API requests
 */
export async function handlePreAuditRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  const { pathname } = parsed;

  // Match /preaudit/questions/:jobId
  const questionsMatch = pathname.match(/^\/preaudit\/questions\/(\d+)$/);
  if (questionsMatch && req.method === 'GET') {
    await getQuestions(req, res, parseInt(questionsMatch[1], 10));
    return true;
  }

  // Match /preaudit/answers/:jobId
  const answersMatch = pathname.match(/^\/preaudit\/answers\/(\d+)$/);
  if (answersMatch && req.method === 'POST') {
    await submitAnswers(req, res, parseInt(answersMatch[1], 10));
    return true;
  }

  // Match /preaudit/skip/:jobId
  const skipMatch = pathname.match(/^\/preaudit\/skip\/(\d+)$/);
  if (skipMatch && req.method === 'POST') {
    await skipQuestionnaire(req, res, parseInt(skipMatch[1], 10));
    return true;
  }

  // Match /preaudit/evidence/:jobId
  const evidenceMatch = pathname.match(/^\/preaudit\/evidence\/(\d+)$/);
  if (evidenceMatch && req.method === 'GET') {
    await getEvidence(req, res, parseInt(evidenceMatch[1], 10));
    return true;
  }

  return false;
}

export default handlePreAuditRoutes;

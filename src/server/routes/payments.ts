/**
 * Payment API Routes
 *
 * Handles Neurons token payment operations:
 * - Create payment reservations
 * - Confirm payments
 * - Settle audits
 * - View payment history
 * - Check debt status
 */

import { IncomingMessage, ServerResponse } from 'http';
import log from '../../utils/logger.js';
import {
  createPaymentReservation,
  confirmPaymentReservation,
  settleReservation,
  checkUserDebtStatus,
  getUserPaymentHistory,
  getReservationForJob,
} from '../../services/tokenPaymentService.js';
import {
  estimateProjectSloc,
  estimateAiTokensForSloc,
  estimateAuditCost,
  getFullCostBreakdown,
} from '../../services/auditCostCalculator.js';

interface RouteContext {
  userId: string | null;
  parsed: {
    pathname: string;
    query: { [k: string]: string };
  };
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

/**
 * Parse request body
 */
async function parseBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();
  return JSON.parse(body);
}

/**
 * POST /api/payments/estimate
 * Get cost estimate for an audit
 */
async function handleEstimate(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const body = await parseBody(req);
    const { projectType, repoUrl, sloc, aiTokens } = body;

    let estimatedSloc = sloc;
    let estimatedAiTokens = aiTokens;

    // If SLOC not provided, estimate it
    if (!estimatedSloc) {
      estimatedSloc = await estimateProjectSloc(projectType, repoUrl);
    }

    // If AI tokens not provided, estimate based on SLOC
    if (!estimatedAiTokens) {
      estimatedAiTokens = estimateAiTokensForSloc(estimatedSloc, projectType === 'quick' ? 'quick' : 'standard');
    }

    const breakdown = await getFullCostBreakdown(estimatedSloc, estimatedAiTokens);

    sendJson(res, 200, {
      ...breakdown.estimate,
      pricing: breakdown.pricing,
      breakdown: breakdown.breakdown,
    });
  } catch (error: any) {
    log.error('Failed to estimate audit cost', { error: error.message });
    sendError(res, 500, error.message || 'Failed to estimate cost');
  }
}

/**
 * POST /api/payments/reservations
 * Create a payment reservation for an audit
 */
async function handleCreateReservation(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const body = await parseBody(req);
    const { jobId, walletAddress, chainId, estimatedSloc, estimatedAiTokens } = body;

    // Validate required fields
    if (!jobId || !walletAddress || !estimatedSloc || !estimatedAiTokens) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Check if reservation already exists for this job
    const existingReservation = await getReservationForJob(jobId);
    if (existingReservation) {
      return sendError(res, 400, 'Payment reservation already exists for this audit');
    }

    const reservation = await createPaymentReservation({
      userId: ctx.userId,
      jobId,
      walletAddress,
      chainId: chainId || 1,
      estimatedSloc,
      estimatedAiTokens,
    });

    sendJson(res, 201, reservation);
  } catch (error: any) {
    log.error('Failed to create payment reservation', { error: error.message });
    sendError(res, 500, error.message || 'Failed to create reservation');
  }
}

/**
 * POST /api/payments/reservations/:reservationId/confirm
 * Confirm payment reservation after user transfers tokens
 */
async function handleConfirmReservation(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const reservationId = ctx.parsed.pathname.split('/')[4];
    if (!reservationId) {
      return sendError(res, 400, 'Reservation ID required');
    }

    const body = await parseBody(req);
    const { txHash } = body;

    if (!txHash) {
      return sendError(res, 400, 'Approval transaction hash required');
    }

    await confirmPaymentReservation(reservationId, txHash);

    sendJson(res, 200, { success: true, message: 'Payment confirmed' });
  } catch (error: any) {
    log.error('Failed to confirm payment reservation', { error: error.message });
    sendError(res, 500, error.message || 'Failed to confirm payment');
  }
}

/**
 * POST /api/payments/reservations/:reservationId/settle
 * Settle reservation after audit completes (calculate actual cost and handle debt/refunds)
 */
async function handleSettleReservation(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const reservationId = ctx.parsed.pathname.split('/')[4];
    if (!reservationId) {
      return sendError(res, 400, 'Reservation ID required');
    }

    const body = await parseBody(req);
    const { actualSloc, actualAiTokens } = body;

    if (!actualSloc || !actualAiTokens) {
      return sendError(res, 400, 'Actual SLOC and AI tokens required');
    }

    const settlement = await settleReservation({
      reservationId,
      actualSloc,
      actualAiTokens,
    });

    sendJson(res, 200, settlement);
  } catch (error: any) {
    log.error('Failed to settle reservation', { error: error.message });
    sendError(res, 500, error.message || 'Failed to settle');
  }
}

/**
 * GET /api/payments/debt-status
 * Check user's debt status
 */
async function handleDebtStatus(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const debtStatus = await checkUserDebtStatus(ctx.userId);
    sendJson(res, 200, debtStatus);
  } catch (error: any) {
    log.error('Failed to check debt status', { error: error.message });
    sendError(res, 500, error.message || 'Failed to check debt');
  }
}

/**
 * GET /api/payments/history
 * Get user's payment history
 */
async function handlePaymentHistory(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const limit = parseInt(ctx.parsed.query.limit || '50');
    const history = await getUserPaymentHistory(ctx.userId, limit);

    sendJson(res, 200, { transactions: history });
  } catch (error: any) {
    log.error('Failed to fetch payment history', { error: error.message });
    sendError(res, 500, error.message || 'Failed to fetch history');
  }
}

/**
 * GET /api/payments/reservations/:jobId
 * Get reservation for a specific job
 */
async function handleGetReservation(req: IncomingMessage, res: ServerResponse, ctx: RouteContext) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const jobId = ctx.parsed.pathname.split('/')[4];
    if (!jobId) {
      return sendError(res, 400, 'Job ID required');
    }

    const reservation = await getReservationForJob(jobId);

    if (!reservation) {
      return sendError(res, 404, 'Reservation not found');
    }

    sendJson(res, 200, { reservation });
  } catch (error: any) {
    log.error('Failed to fetch reservation', { error: error.message });
    sendError(res, 500, error.message || 'Failed to fetch reservation');
  }
}

/**
 * Main payment routes handler
 */
export async function handlePaymentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<boolean> {
  const { pathname } = ctx.parsed;

  // Check if this is a payment route
  if (!pathname.startsWith('/api/payments')) {
    return false;
  }

  try {
    // Route to specific handlers
    if (pathname === '/api/payments/estimate') {
      await handleEstimate(req, res, ctx);
      return true;
    }

    if (pathname === '/api/payments/reservations' && req.method === 'POST') {
      await handleCreateReservation(req, res, ctx);
      return true;
    }

    if (pathname.match(/^\/api\/payments\/reservations\/[^/]+\/confirm$/)) {
      await handleConfirmReservation(req, res, ctx);
      return true;
    }

    if (pathname.match(/^\/api\/payments\/reservations\/[^/]+\/settle$/)) {
      await handleSettleReservation(req, res, ctx);
      return true;
    }

    if (pathname === '/api/payments/debt-status') {
      await handleDebtStatus(req, res, ctx);
      return true;
    }

    if (pathname === '/api/payments/history') {
      await handlePaymentHistory(req, res, ctx);
      return true;
    }

    if (pathname.match(/^\/api\/payments\/reservations\/[^/]+$/) && req.method === 'GET') {
      await handleGetReservation(req, res, ctx);
      return true;
    }

    // Route not found
    sendError(res, 404, 'Not found');
    return true;
  } catch (error: any) {
    log.error('Payment route error', { error: error.message, pathname });
    sendError(res, 500, 'Internal server error');
    return true;
  }
}

/**
 * Billing API Routes
 *
 * Handles neuron/SLOC/AI balance queries and USDT purchase verification.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/index.js';
import { users, neuronPurchases, xpTransactions } from '../../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

const log = logger.child({ service: 'billing-routes' });

// ============================================================================
// TYPES
// ============================================================================

interface RouteContext {
  userId?: string;
  sessionId?: string;
}

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
  params?: Record<string, string>
) => Promise<void>;

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

export const PRICING_TIERS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceUsd: 29,
    priceUsdt: 2900, // In cents
    neurons: 1000,
    sloc: 1000,
    aiCalls: 50,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsd: 149,
    priceUsdt: 14900,
    neurons: 6000,
    sloc: 5000,
    aiCalls: 300,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: 499,
    priceUsdt: 49900,
    neurons: 25000,
    sloc: 20000,
    aiCalls: 9999, // Essentially unlimited
  },
} as const;

// USDT contract addresses by chain
export const USDT_CONTRACTS: Record<number, string> = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',     // Ethereum Mainnet
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',   // Polygon
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum
};

// Supported chains
export const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', symbol: 'ETH' },
  { id: 137, name: 'Polygon', symbol: 'MATIC' },
  { id: 42161, name: 'Arbitrum', symbol: 'ARB' },
];

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

// Check if monthly quota should reset
function shouldResetMonthlyQuota(resetAt: Date | null): boolean {
  if (!resetAt) return true;
  return new Date() >= resetAt;
}

// Get next month reset date
function getNextMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/billing/balance
 * Returns user's current neuron/SLOC/AI balances
 */
const getBalance: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const [user] = await db
      .select({
        xpBalance: users.xpBalance,
        xpLifetime: users.xpLifetime,
        tier: users.tier,
        slocBalance: users.slocBalance,
        slocUsed: users.slocUsed,
        aiCallsBalance: users.aiCallsBalance,
        aiCallsUsed: users.aiCallsUsed,
        monthlyQuotaResetAt: users.monthlyQuotaResetAt,
      })
      .from(users)
      .where(eq(users.id, ctx.userId));

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Check if monthly quota should reset (for free tier)
    let needsReset = false;
    if (user.tier === 'free' && shouldResetMonthlyQuota(user.monthlyQuotaResetAt)) {
      needsReset = true;
      // Reset quotas for free tier
      await db
        .update(users)
        .set({
          xpBalance: 100, // Free monthly neurons
          slocBalance: 200, // Free SLOC capacity
          slocUsed: 0,
          aiCallsBalance: 3, // Free AI reports
          aiCallsUsed: 0,
          monthlyQuotaResetAt: getNextMonthReset(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));
    }

    // Calculate days until reset
    const resetAt = needsReset ? getNextMonthReset() : user.monthlyQuotaResetAt;
    const daysUntilReset = resetAt
      ? Math.ceil((resetAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    sendJson(res, 200, {
      neurons: {
        balance: needsReset ? 100 : user.xpBalance,
        lifetime: user.xpLifetime,
      },
      sloc: {
        balance: needsReset ? 200 : user.slocBalance,
        used: needsReset ? 0 : user.slocUsed,
        available: (needsReset ? 200 : user.slocBalance) - (needsReset ? 0 : user.slocUsed),
      },
      aiCalls: {
        balance: needsReset ? 3 : user.aiCallsBalance,
        used: needsReset ? 0 : user.aiCallsUsed,
        available: (needsReset ? 3 : user.aiCallsBalance) - (needsReset ? 0 : user.aiCallsUsed),
      },
      tier: user.tier,
      monthlyReset: {
        at: resetAt?.toISOString() || null,
        daysRemaining: daysUntilReset,
      },
    });
  } catch (err) {
    log.error('Failed to get billing balance', { error: err });
    sendError(res, 500, 'Failed to get balance');
  }
};

/**
 * GET /api/billing/pricing
 * Returns available pricing tiers
 */
const getPricing: RouteHandler = async (req, res) => {
  sendJson(res, 200, {
    tiers: Object.values(PRICING_TIERS),
    chains: SUPPORTED_CHAINS,
    receiverAddress: process.env.USDT_RECEIVER_ADDRESS || null,
  });
};

/**
 * GET /api/billing/history
 * Returns purchase and usage history
 */
const getHistory: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    // Get purchase history
    const purchases = await db
      .select({
        id: neuronPurchases.id,
        tier: neuronPurchases.tier,
        amountUsdt: neuronPurchases.amountUsdt,
        neuronsAwarded: neuronPurchases.neuronsAwarded,
        slocAwarded: neuronPurchases.slocAwarded,
        aiCallsAwarded: neuronPurchases.aiCallsAwarded,
        status: neuronPurchases.status,
        txHash: neuronPurchases.txHash,
        chainId: neuronPurchases.chainId,
        createdAt: neuronPurchases.createdAt,
        confirmedAt: neuronPurchases.confirmedAt,
      })
      .from(neuronPurchases)
      .where(eq(neuronPurchases.userId, ctx.userId))
      .orderBy(desc(neuronPurchases.createdAt))
      .limit(50);

    // Get recent XP transactions (spend/earn)
    const transactions = await db
      .select({
        id: xpTransactions.id,
        type: xpTransactions.type,
        amount: xpTransactions.amount,
        balanceAfter: xpTransactions.balanceAfter,
        description: xpTransactions.description,
        createdAt: xpTransactions.createdAt,
      })
      .from(xpTransactions)
      .where(eq(xpTransactions.userId, ctx.userId))
      .orderBy(desc(xpTransactions.createdAt))
      .limit(50);

    sendJson(res, 200, {
      purchases: purchases.map((p) => ({
        ...p,
        amountUsd: p.amountUsdt / 100, // Convert cents to dollars
      })),
      transactions,
    });
  } catch (err) {
    log.error('Failed to get billing history', { error: err });
    sendError(res, 500, 'Failed to get history');
  }
};

/**
 * POST /api/billing/purchase/initiate
 * Start a purchase flow - returns payment details
 */
const initiatePurchase: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const body = await parseJsonBody<{ tier: string; chainId: number }>(req);
    const { tier, chainId } = body;

    // Validate tier
    if (!tier || !['starter', 'pro', 'enterprise'].includes(tier)) {
      return sendError(res, 400, 'Invalid tier');
    }

    // Validate chain
    if (!chainId || !SUPPORTED_CHAINS.some((c) => c.id === chainId)) {
      return sendError(res, 400, 'Unsupported chain');
    }

    const tierConfig = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];
    const receiverAddress = process.env.USDT_RECEIVER_ADDRESS;

    if (!receiverAddress) {
      return sendError(res, 500, 'Payment receiver not configured');
    }

    sendJson(res, 200, {
      tier: tierConfig,
      chainId,
      usdtContract: USDT_CONTRACTS[chainId],
      receiverAddress,
      amountUsdt: tierConfig.priceUsdt / 100, // In USDT units (not cents)
      amountRaw: (tierConfig.priceUsdt / 100) * 1e6, // USDT has 6 decimals
    });
  } catch (err) {
    log.error('Failed to initiate purchase', { error: err });
    sendError(res, 500, 'Failed to initiate purchase');
  }
};

/**
 * POST /api/billing/purchase/verify
 * Verify an on-chain USDT transaction and credit the user
 */
const verifyPurchase: RouteHandler = async (req, res, ctx) => {
  if (!ctx.userId) {
    return sendError(res, 401, 'Authentication required');
  }

  try {
    const body = await parseJsonBody<{
      txHash: string;
      chainId: number;
      tier: string;
      fromAddress: string;
    }>(req);

    const { txHash, chainId, tier, fromAddress } = body;

    // Validate inputs
    if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
      return sendError(res, 400, 'Invalid transaction hash');
    }

    if (!tier || !['starter', 'pro', 'enterprise'].includes(tier)) {
      return sendError(res, 400, 'Invalid tier');
    }

    if (!chainId || !SUPPORTED_CHAINS.some((c) => c.id === chainId)) {
      return sendError(res, 400, 'Unsupported chain');
    }

    // Check if transaction already processed
    const [existing] = await db
      .select({ id: neuronPurchases.id })
      .from(neuronPurchases)
      .where(eq(neuronPurchases.txHash, txHash.toLowerCase()));

    if (existing) {
      return sendError(res, 409, 'Transaction already processed');
    }

    const tierConfig = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];

    // Create pending purchase record
    const [purchase] = await db
      .insert(neuronPurchases)
      .values({
        userId: ctx.userId,
        txHash: txHash.toLowerCase(),
        chainId,
        fromAddress: fromAddress.toLowerCase(),
        tier: tier as 'starter' | 'pro' | 'enterprise',
        amountUsdt: tierConfig.priceUsdt,
        neuronsAwarded: tierConfig.neurons,
        slocAwarded: tierConfig.sloc,
        aiCallsAwarded: tierConfig.aiCalls,
        status: 'confirming',
      })
      .returning();

    // TODO: In production, verify the transaction on-chain
    // For now, we'll auto-confirm for development
    // This should be replaced with actual on-chain verification

    // Simulate verification (in production, use viem/ethers to verify)
    const isVerified = true; // Replace with actual verification

    if (isVerified) {
      // Credit user's account
      await db
        .update(users)
        .set({
          xpBalance: sql`${users.xpBalance} + ${tierConfig.neurons}`,
          xpLifetime: sql`${users.xpLifetime} + ${tierConfig.neurons}`,
          slocBalance: sql`${users.slocBalance} + ${tierConfig.sloc}`,
          aiCallsBalance: sql`${users.aiCallsBalance} + ${tierConfig.aiCalls}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId));

      // Update purchase status
      await db
        .update(neuronPurchases)
        .set({
          status: 'completed',
          confirmedAt: new Date(),
        })
        .where(eq(neuronPurchases.id, purchase.id));

      // Record XP transaction
      const [user] = await db
        .select({ xpBalance: users.xpBalance })
        .from(users)
        .where(eq(users.id, ctx.userId));

      await db.insert(xpTransactions).values({
        userId: ctx.userId,
        type: 'bonus',
        amount: tierConfig.neurons,
        balanceAfter: user?.xpBalance || tierConfig.neurons,
        description: `Purchased ${tierConfig.name} tier`,
        referenceType: 'purchase',
        referenceId: purchase.id,
      });

      sendJson(res, 200, {
        success: true,
        purchase: {
          id: purchase.id,
          tier: tierConfig,
          status: 'completed',
        },
        credited: {
          neurons: tierConfig.neurons,
          sloc: tierConfig.sloc,
          aiCalls: tierConfig.aiCalls,
        },
      });
    } else {
      // Mark as failed
      await db
        .update(neuronPurchases)
        .set({
          status: 'failed',
          errorMessage: 'Transaction verification failed',
        })
        .where(eq(neuronPurchases.id, purchase.id));

      sendError(res, 400, 'Transaction verification failed');
    }
  } catch (err) {
    log.error('Failed to verify purchase', { error: err });
    sendError(res, 500, 'Failed to verify purchase');
  }
};

// ============================================================================
// ROUTER
// ============================================================================

export async function handleBillingRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
): Promise<boolean> {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // Match routes
  if (path === '/api/billing/balance' && method === 'GET') {
    await getBalance(req, res, ctx);
    return true;
  }

  if (path === '/api/billing/pricing' && method === 'GET') {
    await getPricing(req, res, ctx);
    return true;
  }

  if (path === '/api/billing/history' && method === 'GET') {
    await getHistory(req, res, ctx);
    return true;
  }

  if (path === '/api/billing/purchase/initiate' && method === 'POST') {
    await initiatePurchase(req, res, ctx);
    return true;
  }

  if (path === '/api/billing/purchase/verify' && method === 'POST') {
    await verifyPurchase(req, res, ctx);
    return true;
  }

  return false;
}

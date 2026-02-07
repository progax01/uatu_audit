/**
 * Token Payment Service
 *
 * Manages Neurons token payment reservations, debt tracking, and settlement.
 *
 * Payment Flow:
 * 1. User requests audit
 * 2. System estimates cost and creates reservation
 * 3. User approves and transfers Neurons tokens
 * 4. Audit executes
 * 5. System calculates actual cost and settles:
 *    - If actual <= reservation: Refund difference
 *    - If actual > reservation: Track debt
 */

import { db } from '../db/index.js';
import {
  tokenPaymentReservations,
  tokenPaymentTransactions,
  userTokenDebt,
  auditJobs,
  users,
  TokenPaymentStatus,
  TokenTransactionType,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { estimateAuditCost, calculateActualCost } from './auditCostCalculator.js';
import { checkUserAllowance, collectPayment } from './neuronsPaymentService.js';
import log from '../utils/logger.js';

export interface CreateReservationParams {
  userId: string;
  jobId: string;
  walletAddress: string;
  chainId: number;
  estimatedSloc: number;
  estimatedAiTokens: number;
}

export interface SettleReservationParams {
  reservationId: string;
  actualSloc: number;
  actualAiTokens: number;
}

/**
 * Check if user has outstanding debt that blocks new audits
 */
export async function checkUserDebtStatus(userId: string): Promise<{
  hasDebt: boolean;
  isBlocked: boolean;
  totalDebtNeurons: number;
  unpaidAuditCount: number;
}> {
  try {
    log.info('[DEBT_CHECK] Checking debt status for user', { userId });

    const [debt] = await db.select().from(userTokenDebt).where(eq(userTokenDebt.userId, userId));

    if (!debt) {
      log.info('[DEBT_CHECK] No debt record found - user is clear', { userId });
      return {
        hasDebt: false,
        isBlocked: false,
        totalDebtNeurons: 0,
        unpaidAuditCount: 0,
      };
    }

    const status = {
      hasDebt: debt.totalDebtNeurons > 0,
      isBlocked: debt.isBlocked,
      totalDebtNeurons: Number(debt.totalDebtNeurons),
      unpaidAuditCount: debt.unpaidAuditCount,
    };

    log.info('[DEBT_CHECK] User debt status retrieved', {
      userId,
      ...status,
      blockedReason: debt.blockedReason
    });

    return status;
  } catch (error) {
    log.error('[DEBT_CHECK] Failed to check user debt status', { userId, error });
    throw new Error('Failed to check debt status');
  }
}

/**
 * Create a payment reservation for an audit
 * Returns reservation details that user must fulfill
 */
export async function createPaymentReservation(params: CreateReservationParams): Promise<{
  reservationId: string;
  estimatedCostNeurons: number;
  reservationAmount: number;
  walletAddress: string;
}> {
  const { userId, jobId, walletAddress, chainId, estimatedSloc, estimatedAiTokens } = params;

  log.info('[RESERVATION_CREATE] Starting payment reservation', {
    userId,
    jobId,
    walletAddress,
    chainId,
    estimatedSloc,
    estimatedAiTokens
  });

  // Check if user is blocked due to debt
  const debtStatus = await checkUserDebtStatus(userId);
  if (debtStatus.isBlocked) {
    log.error('[RESERVATION_CREATE] User is blocked due to debt', {
      userId,
      totalDebt: debtStatus.totalDebtNeurons,
      unpaidAudits: debtStatus.unpaidAuditCount
    });
    throw new Error(
      `Cannot create audit reservation. You have outstanding debt of ${debtStatus.totalDebtNeurons.toFixed(2)} Neurons. Please clear your debt to continue.`
    );
  }

  log.info('[RESERVATION_CREATE] User debt check passed', {
    userId,
    hasDebt: debtStatus.hasDebt,
    debtAmount: debtStatus.totalDebtNeurons
  });

  // Calculate cost estimate
  log.info('[RESERVATION_CREATE] Calculating cost estimate', { estimatedSloc, estimatedAiTokens });
  const costEstimate = await estimateAuditCost(estimatedSloc, estimatedAiTokens);

  log.info('[RESERVATION_CREATE] Cost estimate calculated', {
    slocCost: costEstimate.slocCostNeurons,
    aiTokensCost: costEstimate.aiTokensCostNeurons,
    totalEstimate: costEstimate.totalEstimatedCostNeurons,
    reservationAmount: costEstimate.reservationAmount,
    bufferMultiplier: costEstimate.bufferMultiplier
  });

  // Create reservation record
  const [reservation] = await db
    .insert(tokenPaymentReservations)
    .values({
      userId,
      jobId,
      walletAddress,
      chainId,
      estimatedSloc: costEstimate.estimatedSloc,
      estimatedAiTokens: costEstimate.estimatedAiTokens,
      estimatedCostNeurons: Math.ceil(costEstimate.totalEstimatedCostNeurons),
      reservationAmount: Math.ceil(costEstimate.reservationAmount),
      bufferMultiplier: Math.floor(costEstimate.bufferMultiplier * 100),
      status: 'pending',
    })
    .returning();

  log.info('Created payment reservation', {
    reservationId: reservation.id,
    userId,
    jobId,
    estimatedCostNeurons: costEstimate.totalEstimatedCostNeurons,
    reservationAmount: costEstimate.reservationAmount,
  });

  return {
    reservationId: reservation.id,
    estimatedCostNeurons: costEstimate.totalEstimatedCostNeurons,
    reservationAmount: Number(reservation.reservationAmount), // Use rounded value from DB
    walletAddress,
  };
}

/**
 * Confirm payment reservation (called after user approves spending)
 * Checks that user has approved sufficient tokens for Uatu to spend
 */
export async function confirmPaymentReservation(
  reservationId: string,
  approveTxHash: string
): Promise<void> {
  log.info('[PAYMENT_CONFIRM] Starting payment confirmation (approval check)', {
    reservationId,
    approveTxHash
  });

  const [reservation] = await db
    .select()
    .from(tokenPaymentReservations)
    .where(eq(tokenPaymentReservations.id, reservationId));

  if (!reservation) {
    log.error('[PAYMENT_CONFIRM] Reservation not found', { reservationId });
    throw new Error('Reservation not found');
  }

  if (reservation.status !== 'pending') {
    log.error('[PAYMENT_CONFIRM] Invalid reservation status', {
      reservationId,
      currentStatus: reservation.status,
      expectedStatus: 'pending'
    });
    throw new Error(`Reservation already ${reservation.status}`);
  }

  log.info('[PAYMENT_CONFIRM] Reservation found', {
    reservationId,
    userId: reservation.userId,
    jobId: reservation.jobId,
    reservationAmount: Number(reservation.reservationAmount),
    status: reservation.status,
    walletAddress: reservation.walletAddress
  });

  // Check if user has approved enough tokens
  const requiredNeurons = Number(reservation.reservationAmount);
  const allowanceCheck = await checkUserAllowance(
    reservation.walletAddress,
    requiredNeurons
  );

  if (!allowanceCheck.hasAllowance) {
    log.error('[PAYMENT_CONFIRM] Insufficient allowance approved', {
      reservationId,
      required: requiredNeurons,
      approved: allowanceCheck.allowanceNeurons,
      shortfall: allowanceCheck.shortfall
    });
    throw new Error(
      `Insufficient approval. Approved: ${allowanceCheck.allowanceNeurons} Neurons, Required: ${requiredNeurons} Neurons. Please approve at least ${allowanceCheck.shortfall} more Neurons.`
    );
  }

  log.info('[PAYMENT_CONFIRM] Allowance check passed', {
    reservationId,
    required: requiredNeurons,
    approved: allowanceCheck.allowanceNeurons
  });

  // Update reservation status
  await db
    .update(tokenPaymentReservations)
    .set({
      status: 'reserved',
      txHash: approveTxHash,
      reservedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tokenPaymentReservations.id, reservationId));

  // Create approval record
  await db.insert(tokenPaymentTransactions).values({
    userId: reservation.userId,
    reservationId: reservation.id,
    jobId: reservation.jobId,
    transactionType: 'reservation',
    amount: Number(reservation.reservationAmount),
    balanceBefore: 0, // Not deducted yet - just approved
    balanceAfter: 0,
    description: `Approved ${requiredNeurons} Neurons for audit job ${reservation.jobId}`,
    metadata: {
      estimatedSloc: reservation.estimatedSloc.toString(),
      estimatedAiTokens: reservation.estimatedAiTokens.toString(),
      reservationAmount: reservation.reservationAmount.toString(),
      approvedAmount: allowanceCheck.allowanceNeurons.toString(),
    } as any,
    walletAddress: reservation.walletAddress,
    txHash: approveTxHash,
    chainId: reservation.chainId,
  });

  // Update job status to ready
  await db
    .update(auditJobs)
    .set({ status: 'queued', updatedAt: new Date() })
    .where(eq(auditJobs.id, reservation.jobId));

  log.info('Confirmed payment reservation (approval verified)', {
    reservationId,
    approveTxHash,
    jobId: reservation.jobId,
    approvedAmount: allowanceCheck.allowanceNeurons
  });
}

/**
 * Settle reservation after audit completes
 * Calculates actual cost vs reservation and handles refunds/debt
 */
export async function settleReservation(params: SettleReservationParams): Promise<{
  settled: boolean;
  actualCostNeurons: number;
  reservationAmount: number;
  difference: number; // Positive = refund, Negative = debt
  debtCreated: boolean;
}> {
  const { reservationId, actualSloc, actualAiTokens } = params;

  log.info('[SETTLEMENT] Starting reservation settlement', {
    reservationId,
    actualSloc,
    actualAiTokens
  });

  const [reservation] = await db
    .select()
    .from(tokenPaymentReservations)
    .where(eq(tokenPaymentReservations.id, reservationId));

  if (!reservation) {
    log.error('[SETTLEMENT] Reservation not found', { reservationId });
    throw new Error('Reservation not found');
  }

  if (reservation.status !== 'reserved' && reservation.status !== 'processing') {
    log.error('[SETTLEMENT] Invalid reservation status for settlement', {
      reservationId,
      currentStatus: reservation.status,
      expectedStatuses: ['reserved', 'processing']
    });
    throw new Error(`Cannot settle reservation with status: ${reservation.status}`);
  }

  log.info('[SETTLEMENT] Reservation found and valid', {
    reservationId,
    userId: reservation.userId,
    jobId: reservation.jobId,
    reservationAmount: Number(reservation.reservationAmount),
    estimatedSloc: Number(reservation.estimatedSloc),
    estimatedAiTokens: Number(reservation.estimatedAiTokens)
  });

  // Calculate actual cost
  log.info('[SETTLEMENT] Calculating actual cost', { actualSloc, actualAiTokens });
  const actualCost = await calculateActualCost(actualSloc, actualAiTokens);
  const actualCostNeurons = Math.ceil(actualCost.totalActualCostNeurons);
  const reservationAmount = Number(reservation.reservationAmount);
  const difference = reservationAmount - actualCostNeurons;

  log.info('[SETTLEMENT] Cost calculation complete', {
    actualCostNeurons,
    reservationAmount,
    difference,
    differenceType: difference >= 0 ? 'REFUND' : 'DEBT',
    slocCost: actualCost.slocCostNeurons,
    aiTokensCost: actualCost.aiTokensCostNeurons
  });

  let finalStatus: TokenPaymentStatus = 'completed';
  let debtAmount = 0;
  let paymentTxHash: string | null = null;

  // Collect actual payment from user
  try {
    log.info('[SETTLEMENT] Collecting payment from user', {
      userAddress: reservation.walletAddress,
      actualCostNeurons,
      jobId: reservation.jobId
    });

    const paymentResult = await collectPayment(
      reservation.walletAddress,
      actualCostNeurons,
      reservation.jobId
    );

    paymentTxHash = paymentResult.txHash;

    log.info('[SETTLEMENT] Payment collected successfully', {
      txHash: paymentTxHash,
      amountNeurons: actualCostNeurons,
      gasUsed: paymentResult.gasUsed.toString()
    });

    // Record successful payment
    await db.insert(tokenPaymentTransactions).values({
      userId: reservation.userId,
      reservationId: reservation.id,
      jobId: reservation.jobId,
      transactionType: 'debit',
      amount: actualCostNeurons,
      balanceBefore: 0, // Could fetch if needed
      balanceAfter: 0,
      description: `Payment collected for audit job ${reservation.jobId} - ${actualCostNeurons} Neurons`,
      metadata: {
        actualSloc: actualSloc.toString(),
        actualAiTokens: actualAiTokens.toString(),
        actualCostNeurons: actualCostNeurons.toString(),
        reservationAmount: reservationAmount.toString(),
        difference: difference.toString(),
        gasUsed: paymentResult.gasUsed.toString(),
      } as any,
      walletAddress: reservation.walletAddress,
      txHash: paymentTxHash,
      chainId: reservation.chainId,
    });

    finalStatus = 'completed';

  } catch (paymentError: any) {
    log.error('[SETTLEMENT] Payment collection failed - creating debt', {
      error: paymentError.message,
      userAddress: reservation.walletAddress,
      actualCostNeurons
    });

    // Payment failed - create debt
    debtAmount = actualCostNeurons;
    finalStatus = 'in_debt';

    // Update or create user debt record
    const [existingDebt] = await db.select().from(userTokenDebt).where(eq(userTokenDebt.userId, reservation.userId));

    if (existingDebt) {
      const newTotalDebt = Number(existingDebt.totalDebtNeurons) + debtAmount;
      const newUnpaidCount = existingDebt.unpaidAuditCount + 1;
      const shouldBlock = newUnpaidCount > 1; // Allow 1 audit in debt

      log.warn('[SETTLEMENT] Updating existing debt record', {
        userId: reservation.userId,
        previousDebt: Number(existingDebt.totalDebtNeurons),
        additionalDebt: debtAmount,
        newTotalDebt,
        newUnpaidCount,
        shouldBlock
      });

      await db
        .update(userTokenDebt)
        .set({
          totalDebtNeurons: Math.ceil(newTotalDebt),
          unpaidAuditCount: newUnpaidCount,
          isBlocked: shouldBlock,
          blockedAt: shouldBlock ? new Date() : existingDebt.blockedAt,
          blockedReason: shouldBlock
            ? `Outstanding debt of ${newTotalDebt.toFixed(2)} Neurons from ${newUnpaidCount} audit(s)`
            : existingDebt.blockedReason,
          updatedAt: new Date(),
        })
        .where(eq(userTokenDebt.userId, reservation.userId));
    } else {
      await db.insert(userTokenDebt).values({
        userId: reservation.userId,
        totalDebtNeurons: Math.ceil(debtAmount),
        unpaidAuditCount: 1,
        isBlocked: false,
        gracePeriodUsed: true,
      });
    }

    // Record debt transaction
    await db.insert(tokenPaymentTransactions).values({
      userId: reservation.userId,
      reservationId: reservation.id,
      jobId: reservation.jobId,
      transactionType: 'debit',
      amount: -debtAmount,
      balanceBefore: 0,
      balanceAfter: -debtAmount,
      description: `Debt incurred for audit job ${reservation.jobId} - payment collection failed`,
      metadata: {
        actualSloc: actualSloc.toString(),
        actualAiTokens: actualAiTokens.toString(),
        actualCostNeurons: actualCostNeurons.toString(),
        debtAmount: debtAmount.toString(),
        paymentError: paymentError.message,
      } as any,
    });
  }

  // Update reservation with final details
  await db
    .update(tokenPaymentReservations)
    .set({
      actualSloc: actualSloc,
      actualAiTokens: actualAiTokens,
      actualCostNeurons: actualCostNeurons,
      debtAmount: Math.max(0, debtAmount),
      status: finalStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tokenPaymentReservations.id, reservationId));

  log.info('Settled reservation', {
    reservationId,
    actualCostNeurons,
    reservationAmount,
    difference,
    finalStatus,
    debtCreated: debtAmount > 0,
  });

  return {
    settled: true,
    actualCostNeurons,
    reservationAmount,
    difference,
    debtCreated: debtAmount > 0,
  };
}

/**
 * Get reservation details for a job
 */
export async function getReservationForJob(jobId: string) {
  const [reservation] = await db.select().from(tokenPaymentReservations).where(eq(tokenPaymentReservations.jobId, jobId));

  return reservation || null;
}

/**
 * Get user's payment history
 */
export async function getUserPaymentHistory(userId: string, limit: number = 50) {
  const transactions = await db
    .select()
    .from(tokenPaymentTransactions)
    .where(eq(tokenPaymentTransactions.userId, userId))
    .orderBy(tokenPaymentTransactions.createdAt)
    .limit(limit);

  return transactions;
}

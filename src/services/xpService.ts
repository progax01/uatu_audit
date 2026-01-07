import { eq, and, gte, sql } from 'drizzle-orm';
import { getDb } from '../db';
import {
  xpTransactions,
  xpRules,
  tierThresholds,
  users,
  type XpTransaction,
  type XpRule,
  type TierThreshold,
} from '../db/schema';
import { updateUserXp, findUserById } from '../repositories/userRepository';
import { logger } from '../utils/logger';

/**
 * Get all active XP rules
 */
export async function getActiveXpRules(): Promise<XpRule[]> {
  const db = getDb();
  return db.select().from(xpRules).where(eq(xpRules.isActive, true));
}

/**
 * Get a specific XP rule by key
 */
export async function getXpRuleByKey(ruleKey: string): Promise<XpRule | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(xpRules)
    .where(and(eq(xpRules.ruleKey, ruleKey), eq(xpRules.isActive, true)))
    .limit(1);
  return result[0] || null;
}

/**
 * Get tier thresholds
 */
export async function getTierThresholds(): Promise<TierThreshold[]> {
  const db = getDb();
  return db.select().from(tierThresholds);
}

/**
 * Get tier threshold for a specific tier
 */
export async function getTierThreshold(
  tier: 'free' | 'pro' | 'enterprise'
): Promise<TierThreshold | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(tierThresholds)
    .where(eq(tierThresholds.tier, tier))
    .limit(1);
  return result[0] || null;
}

/**
 * Earn XP for a user based on a rule
 */
export async function earnXp(
  userId: string,
  ruleKey: string,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; xpEarned: number; newBalance: number; message?: string }> {
  const rule = await getXpRuleByKey(ruleKey);
  if (!rule) {
    return { success: false, xpEarned: 0, newBalance: 0, message: 'Rule not found' };
  }

  const user = await findUserById(userId);
  if (!user) {
    return { success: false, xpEarned: 0, newBalance: 0, message: 'User not found' };
  }

  const db = getDb();

  // Check max occurrences if set
  if (rule.maxOccurrences) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(xpTransactions)
      .where(
        and(
          eq(xpTransactions.userId, userId),
          eq(xpTransactions.description, rule.description)
        )
      );

    if (countResult.count >= rule.maxOccurrences) {
      return {
        success: false,
        xpEarned: 0,
        newBalance: user.xpBalance || 0,
        message: `Maximum occurrences (${rule.maxOccurrences}) reached for this action`,
      };
    }
  }

  // Check cooldown if set
  if (rule.cooldownMinutes) {
    const cooldownTime = new Date(Date.now() - rule.cooldownMinutes * 60 * 1000);
    const [recentResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(xpTransactions)
      .where(
        and(
          eq(xpTransactions.userId, userId),
          eq(xpTransactions.description, rule.description),
          gte(xpTransactions.createdAt, cooldownTime)
        )
      );

    if (recentResult.count > 0) {
      return {
        success: false,
        xpEarned: 0,
        newBalance: user.xpBalance || 0,
        message: `Please wait ${rule.cooldownMinutes} minutes before performing this action again`,
      };
    }
  }

  // Credit XP to user
  const updatedUser = await updateUserXp(userId, rule.xpAmount);
  if (!updatedUser) {
    return { success: false, xpEarned: 0, newBalance: 0, message: 'Failed to update user XP' };
  }

  // Record transaction
  await db.insert(xpTransactions).values({
    userId,
    type: 'earn',
    amount: rule.xpAmount,
    balanceAfter: updatedUser.xpBalance || 0,
    description: rule.description,
    referenceType,
    referenceId,
  });

  logger.info('XP earned', {
    userId,
    ruleKey,
    amount: rule.xpAmount,
    newBalance: updatedUser.xpBalance,
  });

  return {
    success: true,
    xpEarned: rule.xpAmount,
    newBalance: updatedUser.xpBalance || 0,
  };
}

/**
 * Spend XP for a user
 */
export async function spendXp(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number; message?: string }> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, newBalance: 0, message: 'User not found' };
  }

  if ((user.xpBalance || 0) < amount) {
    return {
      success: false,
      newBalance: user.xpBalance || 0,
      message: `Insufficient XP balance. Required: ${amount}, Available: ${user.xpBalance}`,
    };
  }

  const db = getDb();

  // Deduct XP from user
  const updatedUser = await updateUserXp(userId, -amount);
  if (!updatedUser) {
    return { success: false, newBalance: 0, message: 'Failed to update user XP' };
  }

  // Record transaction
  await db.insert(xpTransactions).values({
    userId,
    type: 'spend',
    amount: -amount, // Negative for spending
    balanceAfter: updatedUser.xpBalance || 0,
    description,
    referenceType,
    referenceId,
  });

  logger.info('XP spent', {
    userId,
    amount,
    description,
    newBalance: updatedUser.xpBalance,
  });

  return {
    success: true,
    newBalance: updatedUser.xpBalance || 0,
  };
}

/**
 * Refund XP to a user (e.g., failed audit)
 */
export async function refundXp(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number; message?: string }> {
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, newBalance: 0, message: 'User not found' };
  }

  const db = getDb();

  // Credit XP back to user (but don't increase lifetime XP)
  const newBalance = (user.xpBalance || 0) + amount;
  await db
    .update(users)
    .set({ xpBalance: newBalance, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Record transaction
  await db.insert(xpTransactions).values({
    userId,
    type: 'refund',
    amount,
    balanceAfter: newBalance,
    description,
    referenceType,
    referenceId,
  });

  logger.info('XP refunded', {
    userId,
    amount,
    description,
    newBalance,
  });

  return {
    success: true,
    newBalance,
  };
}

/**
 * Get user's XP transaction history
 */
export async function getXpHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<XpTransaction[]> {
  const db = getDb();
  return db
    .select()
    .from(xpTransactions)
    .where(eq(xpTransactions.userId, userId))
    .orderBy(sql`${xpTransactions.createdAt} desc`)
    .limit(limit)
    .offset(offset);
}

/**
 * Get user's XP balance
 */
export async function getXpBalance(userId: string): Promise<{
  balance: number;
  lifetime: number;
  tier: string;
} | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  return {
    balance: user.xpBalance || 0,
    lifetime: user.xpLifetime || 0,
    tier: user.tier,
  };
}

/**
 * Calculate XP cost for an audit based on user tier
 */
export async function getAuditXpCost(
  userId: string,
  auditType: 'quick' | 'standard' | 'deep'
): Promise<{ cost: number; isFreeAudit: boolean; canAfford: boolean }> {
  const user = await findUserById(userId);
  if (!user) {
    return { cost: 0, isFreeAudit: false, canAfford: false };
  }

  const threshold = await getTierThreshold(user.tier);
  if (!threshold) {
    return { cost: 0, isFreeAudit: false, canAfford: false };
  }

  // Check if user qualifies for free audit (free tier with monthly quota)
  if (user.tier === 'free') {
    const now = new Date();
    const resetAt = user.monthlyAuditsResetAt;
    const auditsUsed = user.monthlyAuditsUsed || 0;

    // Reset if past reset date or not set
    if (!resetAt || now >= resetAt) {
      return { cost: 0, isFreeAudit: true, canAfford: true };
    }

    // Check if under quota
    if (auditsUsed < threshold.monthlyFreeAudits) {
      return { cost: 0, isFreeAudit: true, canAfford: true };
    }

    // Free tier user out of free audits - need to upgrade
    return { cost: 0, isFreeAudit: false, canAfford: false };
  }

  // Pro/Enterprise tier - use XP
  let cost: number;
  switch (auditType) {
    case 'quick':
      cost = threshold.auditXpCostQuick;
      break;
    case 'standard':
      cost = threshold.auditXpCostStandard;
      break;
    case 'deep':
      cost = threshold.auditXpCostDeep;
      break;
    default:
      cost = threshold.auditXpCostStandard;
  }

  return {
    cost,
    isFreeAudit: false,
    canAfford: (user.xpBalance || 0) >= cost,
  };
}

/**
 * SLOC Service
 *
 * Handles SLOC (Source Lines of Code) tracking and deduction.
 *
 * SLOC Deduction Logic:
 * - Only deduct when code logic changes (not for minor updates like comments, formatting)
 * - Formula: test_case_lines_written / 2 = SLOC cost
 * - SLOC pool is global across all user projects
 */

import { db } from '../db/index.js';
import { users, xpTransactions } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'sloc-service' });

export interface SlocUsage {
  balance: number;
  used: number;
  available: number;
}

export interface SlocDeductionResult {
  success: boolean;
  amountDeducted: number;
  balanceAfter: number;
  error?: string;
}

/**
 * Calculate SLOC cost based on test case lines written
 * Formula: test_case_lines_written / 2 = SLOC cost
 */
export function calculateSlocCost(testCaseLinesWritten: number, hasLogicChanges: boolean): number {
  // No SLOC deduction if there are no logic changes
  // (e.g., only comments, formatting, or minor updates)
  if (!hasLogicChanges) {
    return 0;
  }

  // Round up to ensure at least 1 SLOC for any test generation
  return Math.ceil(testCaseLinesWritten / 2);
}

/**
 * Get user's current SLOC usage
 */
export async function getSlocUsage(userId: string): Promise<SlocUsage> {
  try {
    const [user] = await db
      .select({
        slocBalance: users.slocBalance,
        slocUsed: users.slocUsed,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { balance: 0, used: 0, available: 0 };
    }

    const balance = user.slocBalance || 0;
    const used = user.slocUsed || 0;

    return {
      balance,
      used,
      available: Math.max(0, balance - used),
    };
  } catch (error) {
    log.error('Failed to get SLOC usage', { error, userId });
    return { balance: 0, used: 0, available: 0 };
  }
}

/**
 * Check if user has enough SLOC to perform an audit
 */
export async function canPerformAudit(
  userId: string,
  estimatedSloc: number
): Promise<{ canProceed: boolean; available: number; required: number }> {
  const usage = await getSlocUsage(userId);

  return {
    canProceed: usage.available >= estimatedSloc,
    available: usage.available,
    required: estimatedSloc,
  };
}

/**
 * Deduct SLOC from user's balance
 */
export async function deductSloc(
  userId: string,
  amount: number,
  jobId: string,
  description: string
): Promise<SlocDeductionResult> {
  if (amount <= 0) {
    return {
      success: true,
      amountDeducted: 0,
      balanceAfter: (await getSlocUsage(userId)).available,
    };
  }

  try {
    // Check current balance
    const usage = await getSlocUsage(userId);

    if (usage.available < amount) {
      return {
        success: false,
        amountDeducted: 0,
        balanceAfter: usage.available,
        error: `Insufficient SLOC: need ${amount}, have ${usage.available}`,
      };
    }

    // Deduct SLOC (increment used counter)
    await db
      .update(users)
      .set({
        slocUsed: sql`${users.slocUsed} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Get updated balance
    const updatedUsage = await getSlocUsage(userId);

    log.info('SLOC deducted', {
      userId,
      amount,
      jobId,
      balanceAfter: updatedUsage.available,
    });

    return {
      success: true,
      amountDeducted: amount,
      balanceAfter: updatedUsage.available,
    };
  } catch (error) {
    log.error('Failed to deduct SLOC', { error, userId, amount, jobId });
    return {
      success: false,
      amountDeducted: 0,
      balanceAfter: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deduct AI calls from user's balance (for report generation)
 */
export async function deductAiCall(
  userId: string,
  jobId: string,
  description: string
): Promise<{ success: boolean; remaining: number; error?: string }> {
  try {
    // Check current balance
    const [user] = await db
      .select({
        aiCallsBalance: users.aiCallsBalance,
        aiCallsUsed: users.aiCallsUsed,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, remaining: 0, error: 'User not found' };
    }

    const available = (user.aiCallsBalance || 0) - (user.aiCallsUsed || 0);

    if (available < 1) {
      return {
        success: false,
        remaining: 0,
        error: 'No AI calls remaining',
      };
    }

    // Deduct one AI call
    await db
      .update(users)
      .set({
        aiCallsUsed: sql`${users.aiCallsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    log.info('AI call deducted', {
      userId,
      jobId,
      remaining: available - 1,
    });

    return {
      success: true,
      remaining: available - 1,
    };
  } catch (error) {
    log.error('Failed to deduct AI call', { error, userId, jobId });
    return {
      success: false,
      remaining: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estimate SLOC cost for a file or set of files
 * This is a rough estimate based on file size
 */
export function estimateSlocFromFileSize(totalLines: number): number {
  // Assume ~50% of lines are actual code (excluding comments, blank lines)
  // Then divide by 2 per our formula
  return Math.ceil(totalLines * 0.5 / 2);
}

/**
 * Detect if changes contain logic modifications
 * (vs. just comments, formatting, etc.)
 */
export function hasLogicChanges(diffContent: string): boolean {
  // Simple heuristic: check if diff contains actual code changes
  // This is a basic implementation - could be made smarter with AST analysis

  const lines = diffContent.split('\n');
  let codeChanges = 0;

  for (const line of lines) {
    // Skip diff headers
    if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
      continue;
    }

    // Only look at added/removed lines
    if (!line.startsWith('+') && !line.startsWith('-')) {
      continue;
    }

    const content = line.slice(1).trim();

    // Skip empty lines
    if (!content) continue;

    // Skip comments (basic detection for common languages)
    if (
      content.startsWith('//') ||
      content.startsWith('/*') ||
      content.startsWith('*') ||
      content.startsWith('#') ||
      content.startsWith('"""') ||
      content.startsWith("'''")
    ) {
      continue;
    }

    // Skip import/require statements (usually not logic)
    if (content.startsWith('import ') || content.startsWith('from ') || content.includes('require(')) {
      continue;
    }

    // This line contains potential logic changes
    codeChanges++;
  }

  // If we have at least 3 lines of actual code changes, consider it logic changes
  return codeChanges >= 3;
}

/**
 * Count lines in generated test cases
 */
export function countTestCaseLines(testContent: string): number {
  const lines = testContent.split('\n');
  let codeLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comments
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('#')
    ) {
      continue;
    }

    codeLines++;
  }

  return codeLines;
}

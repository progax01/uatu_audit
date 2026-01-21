import { getDb } from '../db/index.js';
import { users, userAccountLinks, auditJobs, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'account-merge' });

export interface MergeAccountsRequest {
  primaryUserId: string;    // Keep this account
  secondaryUserId: string;  // Merge into primary
}

export interface MergeAccountsResult {
  success: boolean;
  primaryUserId: string;
  secondaryUserId: string;
  auditsTransferred: number;
  projectsTransferred: number;
  error?: string;
}

/**
 * Merge a secondary account into primary account
 * Transfers all audits, projects, and data from secondary to primary
 * Marks secondary account as merged (doesn't delete for audit trail)
 *
 * @param request - Contains primary and secondary user IDs
 * @returns Result object with transfer counts and success status
 */
export async function mergeAccounts(request: MergeAccountsRequest): Promise<MergeAccountsResult> {
  const { primaryUserId, secondaryUserId } = request;

  log.info('Starting account merge', { primaryUserId, secondaryUserId });

  try {
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      // 1. Fetch both user records
      const [primary] = await tx.select().from(users).where(eq(users.id, primaryUserId));
      const [secondary] = await tx.select().from(users).where(eq(users.id, secondaryUserId));

      if (!primary) {
        throw new Error('Primary user not found');
      }
      if (!secondary) {
        throw new Error('Secondary user not found');
      }

      // 2. Copy missing authentication fields from secondary to primary
      const updates: Record<string, any> = {};

      if (!primary.githubId && secondary.githubId) {
        updates.githubId = secondary.githubId;
        updates.githubLogin = secondary.githubLogin;
        updates.githubEmail = secondary.githubEmail;
        updates.githubAvatarUrl = secondary.githubAvatarUrl;
        log.info('Merging GitHub credentials to primary', { primaryUserId });
      }

      if (!primary.walletAddress && secondary.walletAddress) {
        updates.walletAddress = secondary.walletAddress;
        updates.walletType = secondary.walletType;
        updates.walletNonce = secondary.walletNonce;
        log.info('Merging wallet credentials to primary', { primaryUserId });
      }

      // Copy other profile fields if primary is missing them
      if (!primary.email && secondary.email) {
        updates.email = secondary.email;
      }
      if (!primary.displayName && secondary.displayName) {
        updates.displayName = secondary.displayName;
      }
      if (!primary.bio && secondary.bio) {
        updates.bio = secondary.bio;
      }
      if (!primary.company && secondary.company) {
        updates.company = secondary.company;
      }
      if (!primary.website && secondary.website) {
        updates.website = secondary.website;
      }
      if (!primary.twitterHandle && secondary.twitterHandle) {
        updates.twitterHandle = secondary.twitterHandle;
      }

      // Merge XP balances
      if (secondary.xpBalance > 0 || secondary.xpLifetime > 0) {
        updates.xpBalance = (primary.xpBalance || 0) + (secondary.xpBalance || 0);
        updates.xpLifetime = (primary.xpLifetime || 0) + (secondary.xpLifetime || 0);
        log.info('Merging XP balances', {
          primaryUserId,
          primaryXP: primary.xpBalance,
          secondaryXP: secondary.xpBalance,
          totalXP: updates.xpBalance,
        });
      }

      // Update primary user if we have changes
      if (Object.keys(updates).length > 0) {
        await tx.update(users)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(users.id, primaryUserId));

        log.info('Updated primary user with merged fields', { primaryUserId, updates: Object.keys(updates) });
      }

      // 3. Transfer all audit jobs
      const auditResult = await tx.update(auditJobs)
        .set({ userId: primaryUserId })
        .where(eq(auditJobs.userId, secondaryUserId))
        .returning({ id: auditJobs.id });

      const auditsTransferred = auditResult.length;
      log.info('Transferred audit jobs', { count: auditsTransferred, from: secondaryUserId, to: primaryUserId });

      // 4. Transfer all projects
      const projectResult = await tx.update(projects)
        .set({ userId: primaryUserId })
        .where(eq(projects.userId, secondaryUserId))
        .returning({ id: projects.id });

      const projectsTransferred = projectResult.length;
      log.info('Transferred projects', { count: projectsTransferred, from: secondaryUserId, to: primaryUserId });

      // 5. Create link record for audit trail
      await tx.insert(userAccountLinks).values({
        primaryUserId: primaryUserId,
        linkedUserId: secondaryUserId,
        linkType: 'merged',
      });

      log.info('Created account link record', { primaryUserId, linkedUserId: secondaryUserId });

      // 6. Mark secondary account as merged
      // Remove unique constraints to prevent conflicts
      // Keep record for audit trail but make it unusable for login
      await tx.update(users)
        .set({
          githubId: null,
          walletAddress: null,
          email: `merged_${secondaryUserId}@merged.local`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, secondaryUserId));

      log.info('Marked secondary account as merged', { secondaryUserId });

      return {
        success: true,
        primaryUserId,
        secondaryUserId,
        auditsTransferred,
        projectsTransferred,
      };
    });

    log.info('Account merge completed successfully', result);
    return result;

  } catch (error: any) {
    log.error('Account merge failed', {
      error: error.message,
      stack: error.stack,
      primaryUserId,
      secondaryUserId,
    });

    return {
      success: false,
      primaryUserId,
      secondaryUserId,
      auditsTransferred: 0,
      projectsTransferred: 0,
      error: error.message || 'Unknown error occurred during merge',
    };
  }
}

/**
 * Check if two accounts can be merged
 * Returns validation errors if merge is not possible
 *
 * @param primaryUserId - Primary user ID
 * @param secondaryUserId - Secondary user ID
 * @returns Array of validation errors (empty if merge is valid)
 */
export async function validateMerge(primaryUserId: string, secondaryUserId: string): Promise<string[]> {
  const errors: string[] = [];

  if (primaryUserId === secondaryUserId) {
    errors.push('Cannot merge an account into itself');
    return errors;
  }

  const db = getDb();

  // Check if users exist
  const [primary] = await db.select().from(users).where(eq(users.id, primaryUserId));
  const [secondary] = await db.select().from(users).where(eq(users.id, secondaryUserId));

  if (!primary) {
    errors.push('Primary user not found');
  }
  if (!secondary) {
    errors.push('Secondary user not found');
  }

  if (errors.length > 0) {
    return errors;
  }

  // Check if secondary account is already merged
  if (secondary.email?.startsWith('merged_')) {
    errors.push('Secondary account has already been merged');
  }

  // Check for conflicting credentials
  if (primary.githubId && secondary.githubId && primary.githubId !== secondary.githubId) {
    errors.push('Both accounts have different GitHub accounts linked. Cannot merge.');
  }

  if (primary.walletAddress && secondary.walletAddress &&
      primary.walletAddress.toLowerCase() !== secondary.walletAddress.toLowerCase()) {
    errors.push('Both accounts have different wallet addresses linked. Cannot merge.');
  }

  return errors;
}

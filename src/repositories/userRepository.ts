import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { users, type User, type NewUser, type WalletType } from '../db/schema';

/**
 * Find a user by their UUID
 */
export async function findUserById(id: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Find a user by their GitHub ID
 */
export async function findUserByGithubId(githubId: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
  return result[0] || null;
}

/**
 * Find a user by their GitHub login (username)
 */
export async function findUserByGithubLogin(githubLogin: string): Promise<User | null> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.githubLogin, githubLogin)).limit(1);
  return result[0] || null;
}

/**
 * Find a user by their Uatu username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return result[0] || null;
}

/**
 * Create a new user
 */
export async function createUser(userData: NewUser): Promise<User> {
  const db = getDb();
  const result = await db.insert(users).values(userData).returning();
  return result[0];
}

/**
 * Update a user
 */
export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<User | null> {
  const db = getDb();
  const result = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0] || null;
}

/**
 * Find or create a user by GitHub ID (upsert)
 */
export async function findOrCreateUser(userData: {
  githubId: string;
  githubLogin: string;
  githubEmail?: string | null;
  githubAvatarUrl?: string | null;
  displayName?: string | null;
}): Promise<{ user: User; isNew: boolean }> {
  // Try to find existing user
  let user = await findUserByGithubId(userData.githubId);

  if (user) {
    // Update user info if needed
    const updates: Partial<User> = {
      githubLogin: userData.githubLogin,
      lastLoginAt: new Date(),
    };

    if (userData.githubEmail) {
      updates.githubEmail = userData.githubEmail;
    }
    if (userData.githubAvatarUrl) {
      updates.githubAvatarUrl = userData.githubAvatarUrl;
    }

    user = await updateUser(user.id, updates);
    return { user: user!, isNew: false };
  }

  // Create new user
  user = await createUser({
    githubId: userData.githubId,
    githubLogin: userData.githubLogin,
    githubEmail: userData.githubEmail || undefined,
    githubAvatarUrl: userData.githubAvatarUrl || undefined,
    displayName: userData.displayName || userData.githubLogin,
    tier: 'free',
    xpBalance: 0,
    xpLifetime: 0,
    monthlyAuditsUsed: 0,
    settings: {},
    lastLoginAt: new Date(),
  });

  return { user, isNew: true };
}

/**
 * Update user's XP balance
 */
export async function updateUserXp(
  id: string,
  xpDelta: number
): Promise<User | null> {
  const user = await findUserById(id);
  if (!user) return null;

  const newBalance = Math.max(0, (user.xpBalance || 0) + xpDelta);
  const newLifetime = xpDelta > 0
    ? (user.xpLifetime || 0) + xpDelta
    : user.xpLifetime || 0;

  // Check if tier should be upgraded based on lifetime XP
  let newTier = user.tier;
  if (newLifetime >= 10000 && user.tier !== 'enterprise') {
    newTier = 'enterprise';
  } else if (newLifetime >= 1000 && user.tier === 'free') {
    newTier = 'pro';
  }

  return updateUser(id, {
    xpBalance: newBalance,
    xpLifetime: newLifetime,
    tier: newTier,
  });
}

/**
 * Increment monthly audits used
 */
export async function incrementMonthlyAudits(id: string): Promise<User | null> {
  const user = await findUserById(id);
  if (!user) return null;

  const now = new Date();
  const resetAt = user.monthlyAuditsResetAt;

  // Check if we need to reset the monthly counter
  if (!resetAt || now >= resetAt) {
    // Reset counter and set new reset date (1 month from now)
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);

    return updateUser(id, {
      monthlyAuditsUsed: 1,
      monthlyAuditsResetAt: nextReset,
    });
  }

  // Increment existing counter
  return updateUser(id, {
    monthlyAuditsUsed: (user.monthlyAuditsUsed || 0) + 1,
  });
}

/**
 * Check if user can perform a free audit
 */
export async function canPerformFreeAudit(id: string): Promise<boolean> {
  const user = await findUserById(id);
  if (!user) return false;

  // Only free tier users get free audits
  if (user.tier !== 'free') return false;

  const now = new Date();
  const resetAt = user.monthlyAuditsResetAt;

  // If reset date has passed or not set, they have full quota
  if (!resetAt || now >= resetAt) {
    return true;
  }

  // Check if under the 3 audit limit
  return (user.monthlyAuditsUsed || 0) < 3;
}

// ============================================================================
// WALLET AUTHENTICATION
// ============================================================================

/**
 * Find a user by their wallet address
 */
export async function findUserByWalletAddress(walletAddress: string): Promise<User | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress.toLowerCase()))
    .limit(1);
  return result[0] || null;
}

/**
 * Generate a new nonce for wallet authentication
 */
export function generateWalletNonce(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Get or create a nonce for a wallet address
 */
export async function getOrCreateWalletNonce(walletAddress: string): Promise<string> {
  const normalizedAddress = walletAddress.toLowerCase();
  const user = await findUserByWalletAddress(normalizedAddress);

  if (user && user.walletNonce) {
    return user.walletNonce;
  }

  // Generate new nonce
  const nonce = generateWalletNonce();

  if (user) {
    // Update existing user with new nonce
    await updateUser(user.id, { walletNonce: nonce });
    return nonce;
  }

  // Create placeholder user with nonce (will be completed on verify)
  const db = getDb();
  await db.insert(users).values({
    walletAddress: normalizedAddress,
    walletNonce: nonce,
    tier: 'free',
    xpBalance: 0,
    xpLifetime: 0,
    monthlyAuditsUsed: 0,
    settings: {},
  }).onConflictDoNothing();

  return nonce;
}

/**
 * Find or create a user by wallet address (after signature verification)
 */
export async function findOrCreateWalletUser(data: {
  walletAddress: string;
  walletType: WalletType;
}): Promise<{ user: User; isNew: boolean }> {
  const normalizedAddress = data.walletAddress.toLowerCase();
  let user = await findUserByWalletAddress(normalizedAddress);
  let isNew = false;

  if (user) {
    // Update wallet type and login time
    user = await updateUser(user.id, {
      walletType: data.walletType,
      walletNonce: generateWalletNonce(), // Rotate nonce after successful auth
      lastLoginAt: new Date(),
    });
    return { user: user!, isNew: false };
  }

  // Create new wallet user
  const db = getDb();
  const result = await db.insert(users).values({
    walletAddress: normalizedAddress,
    walletType: data.walletType,
    walletNonce: generateWalletNonce(),
    displayName: `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
    tier: 'free',
    xpBalance: 0,
    xpLifetime: 0,
    monthlyAuditsUsed: 0,
    settings: {},
    lastLoginAt: new Date(),
  }).returning();

  return { user: result[0], isNew: true };
}

/**
 * Validate and clear the nonce after successful authentication
 */
export async function validateAndClearNonce(
  walletAddress: string,
  providedNonce: string
): Promise<boolean> {
  const user = await findUserByWalletAddress(walletAddress);
  if (!user || user.walletNonce !== providedNonce) {
    return false;
  }

  // Clear the nonce (one-time use)
  await updateUser(user.id, { walletNonce: generateWalletNonce() });
  return true;
}

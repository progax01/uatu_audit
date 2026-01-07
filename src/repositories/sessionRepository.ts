import { eq, and, isNull, gt, lt } from 'drizzle-orm';
import { getDb } from '../db';
import { sessions, type Session, type NewSession } from '../db/schema';
import { encrypt, decrypt, hashToken, type EncryptedData } from '../services/encryptionService';

/**
 * Create a new session with optional encrypted GitHub token
 */
export async function createSession(data: {
  userId: string;
  refreshTokenHash: string;
  refreshTokenFamily: string;
  githubToken?: string;
  authMethod?: 'github' | 'wallet';
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}): Promise<Session> {
  const db = getDb();

  // Encrypt the GitHub token if provided
  let encrypted: EncryptedData | null = null;
  if (data.githubToken) {
    encrypted = encrypt(data.githubToken);
  }

  const result = await db
    .insert(sessions)
    .values({
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      refreshTokenFamily: data.refreshTokenFamily,
      githubTokenEncrypted: encrypted?.encrypted,
      githubTokenIv: encrypted?.iv,
      authMethod: data.authMethod || 'github',
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
    })
    .returning();

  return result[0];
}

/**
 * Find a session by ID
 */
export async function findSessionById(id: string): Promise<Session | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Find a valid session by refresh token hash
 */
export async function findSessionByRefreshTokenHash(
  tokenHash: string
): Promise<Session | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Find all sessions in a token family (for reuse detection)
 */
export async function findSessionsByFamily(family: string): Promise<Session[]> {
  const db = getDb();
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenFamily, family));
}

/**
 * Get decrypted GitHub token from a session
 * Returns null if session doesn't have a GitHub token (e.g., wallet auth)
 */
export function getDecryptedGithubToken(session: Session): string | null {
  if (!session.githubTokenEncrypted || !session.githubTokenIv) {
    return null;
  }
  const encrypted: EncryptedData = {
    encrypted: session.githubTokenEncrypted,
    iv: session.githubTokenIv,
  };
  return decrypt(encrypted);
}

/**
 * Update a session's refresh token (for token rotation)
 */
export async function updateSessionRefreshToken(
  id: string,
  newTokenHash: string,
  newExpiresAt: Date
): Promise<Session | null> {
  const db = getDb();
  const result = await db
    .update(sessions)
    .set({
      refreshTokenHash: newTokenHash,
      expiresAt: newExpiresAt,
    })
    .where(eq(sessions.id, id))
    .returning();

  return result[0] || null;
}

/**
 * Revoke a session
 */
export async function revokeSession(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, id));
}

/**
 * Revoke all sessions in a family (for reuse detection)
 */
export async function revokeSessionFamily(family: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.refreshTokenFamily, family),
        isNull(sessions.revokedAt)
      )
    );
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    );
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<Session[]> {
  const db = getDb();
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    );
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = getDb();
  const result = await db
    .delete(sessions)
    .where(
      lt(sessions.expiresAt, new Date())
    )
    .returning();

  return result.length;
}

/**
 * Helper to hash a refresh token for storage/lookup
 */
export { hashToken };

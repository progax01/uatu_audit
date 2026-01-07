import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users, sessions, xpRules, tierThresholds } from '../src/db/schema';
import { generateTokenPair } from '../src/services/jwtService';
import { encrypt, hashToken } from '../src/services/encryptionService';

async function createTestUser() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  try {
    // Check if test user already exists
    const existingUser = await db.select().from(users).where(
      // @ts-ignore
      (await import('drizzle-orm')).eq(users.githubId, 'test-admin-123')
    ).limit(1);

    let user;

    if (existingUser.length > 0) {
      user = existingUser[0];
      console.log('Test user already exists:', user.id);
    } else {
      // Create test admin user
      const [newUser] = await db.insert(users).values({
        githubId: 'test-admin-123',
        githubLogin: 'test-admin',
        githubEmail: 'admin@uatu.xyz',
        githubAvatarUrl: 'https://avatars.githubusercontent.com/u/0?v=4',
        displayName: 'Test Admin',
        tier: 'enterprise', // Give admin enterprise tier
        xpBalance: 50000,
        xpLifetime: 50000,
        monthlyAuditsUsed: 0,
        settings: {},
        lastLoginAt: new Date(),
      }).returning();

      user = newUser;
      console.log('Created test user:', user.id);
    }

    // Generate JWT tokens
    const tokens = generateTokenPair(
      user.id,
      user.githubId,
      user.githubLogin,
      user.tier as 'free' | 'pro' | 'enterprise'
    );

    // Store session in database (with a fake GitHub token since we're testing)
    const fakeGithubToken = 'test-github-token-for-local-dev';
    const encrypted = encrypt(fakeGithubToken);

    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: hashToken(tokens.refreshToken),
      refreshTokenFamily: tokens.tokenFamily,
      githubTokenEncrypted: encrypted.encrypted,
      githubTokenIv: encrypted.iv,
      expiresAt: tokens.refreshExpiresAt,
      userAgent: 'Test Script',
      ipAddress: '127.0.0.1',
    });

    // Also seed XP rules and tier thresholds if not exists
    console.log('\nSeeding XP rules...');
    await db.insert(xpRules).values([
      { ruleKey: 'audit_completed', description: 'Complete a security audit', xpAmount: 100, isActive: true },
      { ruleKey: 'audit_shared_public', description: 'Share audit report publicly', xpAmount: 50, isActive: true },
      { ruleKey: 'first_audit', description: 'Complete your first audit (one-time bonus)', xpAmount: 500, maxOccurrences: 1, isActive: true },
      { ruleKey: 'daily_login', description: 'Daily login bonus', xpAmount: 5, cooldownMinutes: 1440, isActive: true },
    ]).onConflictDoNothing();

    console.log('Seeding tier thresholds...');
    await db.insert(tierThresholds).values([
      { tier: 'free', minXp: 0, monthlyFreeAudits: 3, auditXpCostQuick: 0, auditXpCostStandard: 0, auditXpCostDeep: 0, features: { basicReports: true } },
      { tier: 'pro', minXp: 1000, monthlyFreeAudits: 0, auditXpCostQuick: 50, auditXpCostStandard: 100, auditXpCostDeep: 200, features: { basicReports: true, advancedReports: true, apiAccess: true } },
      { tier: 'enterprise', minXp: 10000, monthlyFreeAudits: 0, auditXpCostQuick: 40, auditXpCostStandard: 80, auditXpCostDeep: 160, features: { basicReports: true, advancedReports: true, apiAccess: true, customReports: true, sso: true } },
    ]).onConflictDoNothing();

    console.log('\n' + '='.repeat(80));
    console.log('TEST USER CREDENTIALS');
    console.log('='.repeat(80));
    console.log('\nUser ID:', user.id);
    console.log('GitHub Login:', user.githubLogin);
    console.log('Tier:', user.tier);
    console.log('XP Balance:', user.xpBalance);
    console.log('\n--- TOKENS (save these for testing) ---\n');
    console.log('Access Token (expires in 15 min):');
    console.log(tokens.accessToken);
    console.log('\nRefresh Token (expires in 30 days):');
    console.log(tokens.refreshToken);
    console.log('\nAccess Token Expires At:', tokens.accessExpiresAt.toISOString());
    console.log('\n--- FOR FRONTEND localStorage ---\n');
    console.log(`localStorage.setItem('uatu_access_token', '${tokens.accessToken}');`);
    console.log(`localStorage.setItem('uatu_refresh_token', '${tokens.refreshToken}');`);
    console.log(`localStorage.setItem('uatu_token_expiry', '${tokens.accessExpiresAt.toISOString()}');`);
    console.log(`localStorage.setItem('uatu_user', '${JSON.stringify({
      id: user.id,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.githubAvatarUrl,
      tier: user.tier,
      xpBalance: user.xpBalance,
    })}');`);
    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createTestUser();

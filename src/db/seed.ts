import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { xpRules, tierThresholds, preauditQuestions } from './schema.js';

async function seed() {
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

  console.log('Seeding XP rules...');

  // XP Rules
  await db
    .insert(xpRules)
    .values([
      {
        ruleKey: 'audit_completed',
        description: 'Complete a security audit',
        xpAmount: 100,
        maxOccurrences: null,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'audit_shared_public',
        description: 'Share audit report publicly',
        xpAmount: 50,
        maxOccurrences: null,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'referral_signup',
        description: 'Refer a new user who signs up',
        xpAmount: 200,
        maxOccurrences: null,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'referral_audit',
        description: 'Referred user completes their first audit',
        xpAmount: 500,
        maxOccurrences: null,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'first_audit',
        description: 'Complete your first audit (one-time bonus)',
        xpAmount: 500,
        maxOccurrences: 1,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'daily_login',
        description: 'Daily login bonus',
        xpAmount: 5,
        maxOccurrences: null,
        cooldownMinutes: 1440, // 24 hours
        isActive: true,
      },
      {
        ruleKey: 'profile_complete',
        description: 'Complete your profile',
        xpAmount: 50,
        maxOccurrences: 1,
        cooldownMinutes: null,
        isActive: true,
      },
      {
        ruleKey: 'feedback_submitted',
        description: 'Submit feedback on an audit',
        xpAmount: 25,
        maxOccurrences: null,
        cooldownMinutes: 60, // 1 hour cooldown
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding tier thresholds...');

  // Tier Thresholds
  await db
    .insert(tierThresholds)
    .values([
      {
        tier: 'free',
        minXp: 0,
        monthlyFreeAudits: 3,
        auditXpCostQuick: 0,
        auditXpCostStandard: 0,
        auditXpCostDeep: 0,
        features: {
          basicReports: true,
          advancedReports: false,
          apiAccess: false,
          priorityQueue: false,
          customReports: false,
          sso: false,
          dedicatedSupport: false,
          emailSupport: true,
        },
      },
      {
        tier: 'pro',
        minXp: 1000,
        monthlyFreeAudits: 0,
        auditXpCostQuick: 50,
        auditXpCostStandard: 100,
        auditXpCostDeep: 200,
        features: {
          basicReports: true,
          advancedReports: true,
          apiAccess: true,
          priorityQueue: true,
          customReports: false,
          sso: false,
          dedicatedSupport: false,
          emailSupport: true,
          prioritySupport: true,
        },
      },
      {
        tier: 'enterprise',
        minXp: 10000,
        monthlyFreeAudits: 0,
        auditXpCostQuick: 40, // 20% discount
        auditXpCostStandard: 80,
        auditXpCostDeep: 160,
        features: {
          basicReports: true,
          advancedReports: true,
          apiAccess: true,
          priorityQueue: true,
          customReports: true,
          sso: true,
          dedicatedSupport: true,
          emailSupport: true,
          prioritySupport: true,
          bulkDiscount: true,
        },
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding pre-audit questions...');

  // Pre-audit Questions
  await db
    .insert(preauditQuestions)
    .values([
      {
        questionKey: 'project_description',
        questionText: 'Describe your project in a few sentences',
        questionType: 'textarea',
        required: true,
        orderIndex: 1,
        category: 'general',
      },
      {
        questionKey: 'blockchain_networks',
        questionText: 'Which blockchain networks will this contract be deployed on?',
        questionType: 'multiselect',
        options: ['Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism', 'Avalanche', 'Solana', 'Other'],
        required: true,
        orderIndex: 2,
        category: 'deployment',
      },
      {
        questionKey: 'contract_type',
        questionText: 'What type of smart contract is this?',
        questionType: 'select',
        options: ['DeFi', 'NFT', 'Token', 'DAO', 'Gaming', 'Bridge', 'Oracle', 'Other'],
        required: true,
        orderIndex: 3,
        category: 'general',
      },
      {
        questionKey: 'previous_audits',
        questionText: 'Has this code been audited before?',
        questionType: 'select',
        options: ['Yes', 'No', 'Partially'],
        required: false,
        orderIndex: 4,
        category: 'history',
      },
      {
        questionKey: 'known_issues',
        questionText: 'Are there any known issues or areas of concern?',
        questionType: 'textarea',
        required: false,
        orderIndex: 5,
        category: 'issues',
      },
      {
        questionKey: 'access_control',
        questionText: 'What access control mechanisms are used?',
        questionType: 'multiselect',
        options: ['Ownable', 'AccessControl', 'Multisig', 'Timelock', 'None', 'Custom'],
        required: false,
        orderIndex: 6,
        category: 'security',
      },
      {
        questionKey: 'external_dependencies',
        questionText: 'List any external contracts or protocols this integrates with',
        questionType: 'textarea',
        required: false,
        orderIndex: 7,
        category: 'dependencies',
      },
      {
        questionKey: 'expected_tvl',
        questionText: 'What is the expected Total Value Locked (TVL)?',
        questionType: 'select',
        options: ['< $100K', '$100K - $1M', '$1M - $10M', '$10M - $100M', '> $100M'],
        required: false,
        orderIndex: 8,
        category: 'deployment',
      },
    ])
    .onConflictDoNothing();

  console.log('Seed completed successfully!');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

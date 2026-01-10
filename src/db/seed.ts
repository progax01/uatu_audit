import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { xpRules, tierThresholds, preauditQuestions, auditJobs, auditResults } from './schema.js';

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

  console.log('Seeding demo audits for public ledger...');

  // Demo Audits - these will appear on the public security ledger
  const demoAudits = [
    {
      id: 'demo-001-uniswap-v3',
      auditType: 'quick' as const,
      visibility: 'public' as const,
      status: 'completed' as const,
      contractAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      contractNetwork: 'ethereum',
      contractName: 'UniswapV3Factory',
      isProxy: false,
      repo: 'scan://ethereum/0x1F98431c8aD98523631AE4a59f267346ea31F984',
      branch: 'main',
      progressPct: 100,
      progressMessage: 'Scan complete',
      startedAt: new Date('2024-12-15T10:30:00Z'),
      completedAt: new Date('2024-12-15T10:31:15Z'),
    },
    {
      id: 'demo-002-aave-v3',
      auditType: 'quick' as const,
      visibility: 'public' as const,
      status: 'completed' as const,
      contractAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      contractNetwork: 'ethereum',
      contractName: 'AavePool',
      isProxy: true,
      implementationAddress: '0x7EfFD7b47Bfd17e52fB7559d3f924201b9DbfF3d',
      repo: 'scan://ethereum/0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      branch: 'main',
      progressPct: 100,
      progressMessage: 'Scan complete',
      startedAt: new Date('2024-12-20T14:00:00Z'),
      completedAt: new Date('2024-12-20T14:02:30Z'),
    },
    {
      id: 'demo-003-compound-v3',
      auditType: 'quick' as const,
      visibility: 'public' as const,
      status: 'completed' as const,
      contractAddress: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
      contractNetwork: 'ethereum',
      contractName: 'Compound USDC',
      isProxy: true,
      repo: 'scan://ethereum/0xc3d688B66703497DAA19211EEdff47f25384cdc3',
      branch: 'main',
      progressPct: 100,
      progressMessage: 'Scan complete',
      startedAt: new Date('2024-12-22T09:15:00Z'),
      completedAt: new Date('2024-12-22T09:16:45Z'),
    },
    {
      id: 'demo-004-pancakeswap',
      auditType: 'quick' as const,
      visibility: 'public' as const,
      status: 'completed' as const,
      contractAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      contractNetwork: 'bnb',
      contractName: 'PancakeFactory',
      isProxy: false,
      repo: 'scan://bnb/0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      branch: 'main',
      progressPct: 100,
      progressMessage: 'Scan complete',
      startedAt: new Date('2025-01-02T11:00:00Z'),
      completedAt: new Date('2025-01-02T11:01:30Z'),
    },
    {
      id: 'demo-005-base-usdc',
      auditType: 'quick' as const,
      visibility: 'public' as const,
      status: 'completed' as const,
      contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractNetwork: 'base',
      contractName: 'USDC Token',
      isProxy: true,
      repo: 'scan://base/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      branch: 'main',
      progressPct: 100,
      progressMessage: 'Scan complete',
      startedAt: new Date('2025-01-05T16:30:00Z'),
      completedAt: new Date('2025-01-05T16:31:20Z'),
    },
  ];

  // Demo Results
  const demoResults = [
    {
      jobId: 'demo-001-uniswap-v3',
      scoreValue: 92,
      scoreLabel: 'A',
      summary: 'UniswapV3Factory demonstrates excellent security practices with proper access controls and well-implemented factory pattern. Minor gas optimizations possible.',
      findings: [
        { id: 'UV3-001', title: 'Unchecked Return Value', severity: 'low', description: 'Return value from pool creation not explicitly checked', location: 'createPool()', recommendation: 'Add explicit success check after pool deployment' },
        { id: 'UV3-002', title: 'Gas Optimization', severity: 'info', description: 'Storage reads in loop could be cached', location: 'setOwner()', recommendation: 'Cache owner address in memory variable' },
      ],
      metadata: {
        riskLevel: 'LOW',
        scanDuration: 75000,
        contractAnalysis: { sloc: 342, functions: 8, stateVariables: 4, externalCalls: 2, purpose: 'AMM Factory', architecture: 'Factory Pattern' },
        gasOptimizations: [{ title: 'Cache Storage Variable', description: 'Cache feeAmountTickSpacing mapping reads', savings: '~200 gas' }],
        bestPractices: [{ title: 'ReentrancyGuard', status: 'passed', description: 'No reentrancy risks identified' }],
      },
    },
    {
      jobId: 'demo-002-aave-v3',
      scoreValue: 88,
      scoreLabel: 'A-',
      summary: 'Aave V3 Pool shows robust security architecture with comprehensive access controls. Some complexity in flash loan logic requires careful monitoring.',
      findings: [
        { id: 'AAVE-001', title: 'Complex Flash Loan Logic', severity: 'medium', description: 'Flash loan execution has multiple code paths that increase attack surface', location: 'flashLoan()', recommendation: 'Consider simplifying flash loan validation logic' },
        { id: 'AAVE-002', title: 'Centralization Risk', severity: 'low', description: 'Admin functions have significant control over protocol parameters', location: 'setConfiguration()', recommendation: 'Implement timelock for sensitive parameter changes' },
        { id: 'AAVE-003', title: 'Gas Intensive Operations', severity: 'info', description: 'Reserve list iteration is O(n)', location: 'getReservesList()', recommendation: 'Consider pagination for large reserve lists' },
      ],
      metadata: {
        riskLevel: 'LOW',
        scanDuration: 150000,
        contractAnalysis: { sloc: 1250, functions: 45, stateVariables: 12, externalCalls: 8, purpose: 'Lending Pool', architecture: 'Proxy + Implementation' },
        gasOptimizations: [{ title: 'Batch Operations', description: 'Support batch supply/withdraw for gas savings', savings: '~30% on multiple ops' }],
        bestPractices: [{ title: 'Upgradeable Pattern', status: 'passed', description: 'Proper proxy implementation' }, { title: 'Access Control', status: 'passed', description: 'Role-based access control implemented' }],
      },
    },
    {
      jobId: 'demo-003-compound-v3',
      scoreValue: 90,
      scoreLabel: 'A',
      summary: 'Compound V3 (Comet) implements a clean, monolithic design with strong security guarantees. Excellent code quality and documentation.',
      findings: [
        { id: 'COMP-001', title: 'Oracle Dependency', severity: 'medium', description: 'Protocol relies on external price feeds without fallback mechanism', location: 'getPrice()', recommendation: 'Implement secondary oracle as fallback' },
        { id: 'COMP-002', title: 'Liquidation MEV Risk', severity: 'low', description: 'Liquidations are susceptible to MEV extraction', location: 'absorb()', recommendation: 'Consider MEV-resistant liquidation mechanism' },
      ],
      metadata: {
        riskLevel: 'LOW',
        scanDuration: 105000,
        contractAnalysis: { sloc: 890, functions: 32, stateVariables: 18, externalCalls: 5, purpose: 'Money Market', architecture: 'Monolithic' },
        gasOptimizations: [{ title: 'Storage Packing', description: 'User balances could be packed more efficiently', savings: '~5000 gas per update' }],
        bestPractices: [{ title: 'Immutable Variables', status: 'passed', description: 'Config values properly immutable' }],
      },
    },
    {
      jobId: 'demo-004-pancakeswap',
      scoreValue: 85,
      scoreLabel: 'B+',
      summary: 'PancakeSwap Factory follows standard AMM patterns. Some outdated Solidity patterns detected but no critical issues.',
      findings: [
        { id: 'CAKE-001', title: 'Outdated Compiler', severity: 'low', description: 'Contract uses Solidity 0.5.x which lacks modern safety features', location: 'pragma', recommendation: 'Upgrade to Solidity 0.8.x for built-in overflow checks' },
        { id: 'CAKE-002', title: 'Missing Events', severity: 'low', description: 'Some state changes do not emit events', location: 'setFeeTo()', recommendation: 'Add events for all state-changing operations' },
        { id: 'CAKE-003', title: 'Centralized Fee Control', severity: 'medium', description: 'Fee recipient can be changed by single admin', location: 'setFeeToSetter()', recommendation: 'Implement multi-sig or governance for fee changes' },
      ],
      metadata: {
        riskLevel: 'MEDIUM',
        scanDuration: 90000,
        contractAnalysis: { sloc: 280, functions: 6, stateVariables: 4, externalCalls: 1, purpose: 'AMM Factory', architecture: 'Factory Pattern' },
        gasOptimizations: [],
        bestPractices: [{ title: 'Create2 Deployment', status: 'passed', description: 'Deterministic pair addresses' }],
      },
    },
    {
      jobId: 'demo-005-base-usdc',
      scoreValue: 95,
      scoreLabel: 'A+',
      summary: 'Circle USDC on Base demonstrates enterprise-grade security with comprehensive access controls, pausability, and blacklist functionality.',
      findings: [
        { id: 'USDC-001', title: 'Centralization Concerns', severity: 'info', description: 'Contract has centralized controls (by design for regulated stablecoin)', location: 'blacklist()', recommendation: 'Documented and expected for regulated asset' },
      ],
      metadata: {
        riskLevel: 'SAFE',
        scanDuration: 80000,
        contractAnalysis: { sloc: 450, functions: 22, stateVariables: 8, externalCalls: 0, purpose: 'Stablecoin', architecture: 'Proxy + Implementation' },
        gasOptimizations: [{ title: 'Efficient Transfers', description: 'Transfer logic is optimized', savings: 'N/A - already optimized' }],
        bestPractices: [{ title: 'Pausable', status: 'passed', description: 'Emergency pause implemented' }, { title: 'Blacklist', status: 'passed', description: 'Compliance controls in place' }],
      },
    },
  ];

  // Insert demo audits
  for (const audit of demoAudits) {
    await db
      .insert(auditJobs)
      .values(audit)
      .onConflictDoNothing();
  }

  // Insert demo results
  for (const result of demoResults) {
    await db
      .insert(auditResults)
      .values(result)
      .onConflictDoNothing();
  }

  console.log('Seed completed successfully!');
  await pool.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

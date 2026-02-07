import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  smallint,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  serial,
  uniqueIndex,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const userTierEnum = pgEnum('user_tier', ['free', 'pro', 'enterprise']);

export const projectTypeEnum = pgEnum('project_type', [
  'full',
  'contract-only',
  'dapp-pentest',
  'library-audit',
]);

export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'active',
  'archived',
  'deleted',
]);

export const componentTypeEnum = pgEnum('component_type', [
  'github-repo',
  'deployed-contract',
  'dapp-url',
  'library-source',
  'manual-upload',
]);

export const componentStatusEnum = pgEnum('component_status', [
  'pending',
  'syncing',
  'synced',
  'error',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'queued',
  'running',
  'cloning',
  'analyzing',
  'awaiting_clarification',
  'auditing',
  'generating',
  'completed',
  'failed',
  'cancelled',
]);

export const auditVisibilityEnum = pgEnum('audit_visibility', [
  'private',
  'public',
  'unlisted',
]);

export const auditTypeEnum = pgEnum('audit_type', [
  'quick',  // Quick scan - immediate results, public by default
  'full',   // Full audit - queued job with phases
]);

export const xpTransactionTypeEnum = pgEnum('xp_transaction_type', [
  'earn',
  'spend',
  'refund',
  'bonus',
  'adjustment',
]);

export const walletTypeEnum = pgEnum('wallet_type', [
  'ethereum',
  'solana',
  'cosmos',
  'sui',
  'aptos',
]);

export const purchaseStatusEnum = pgEnum('purchase_status', [
  'pending',
  'confirming',
  'completed',
  'failed',
  'refunded',
]);

export const purchaseTierEnum = pgEnum('purchase_tier', [
  'starter',
  'pro',
  'enterprise',
]);

// ============================================================================
// USERS TABLE
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // GitHub OAuth fields (optional if using wallet auth)
    githubId: varchar('github_id', { length: 50 }).unique(),
    githubLogin: varchar('github_login', { length: 255 }),
    githubEmail: varchar('github_email', { length: 255 }),
    githubAvatarUrl: text('github_avatar_url'),
    // GitHub PAT (encrypted) - for users who provide their own token
    githubPatEncrypted: text('github_pat_encrypted'),
    githubPatIv: varchar('github_pat_iv', { length: 64 }),
    // Wallet auth fields
    walletAddress: varchar('wallet_address', { length: 128 }).unique(),
    walletType: walletTypeEnum('wallet_type'),
    walletNonce: varchar('wallet_nonce', { length: 64 }), // For signature verification
    // Profile fields
    username: varchar('username', { length: 50 }).unique(), // Claimed username on Uatu
    displayName: varchar('display_name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    bio: text('bio'),
    company: varchar('company', { length: 255 }),
    website: varchar('website', { length: 500 }),
    twitterHandle: varchar('twitter_handle', { length: 100 }),
    avatarUrl: text('avatar_url'), // Custom avatar (overrides github avatar)
    // XP/Neurons and tier
    xpBalance: bigint('xp_balance', { mode: 'number' }).notNull().default(0),
    xpLifetime: bigint('xp_lifetime', { mode: 'number' }).notNull().default(0),
    tier: userTierEnum('tier').notNull().default('free'),
    monthlyAuditsUsed: smallint('monthly_audits_used').notNull().default(0),
    monthlyAuditsResetAt: timestamp('monthly_audits_reset_at', { withTimezone: true }),
    // SLOC capacity (global pool across all projects)
    slocBalance: bigint('sloc_balance', { mode: 'number' }).notNull().default(200), // Free tier starts with 200
    slocUsed: bigint('sloc_used', { mode: 'number' }).notNull().default(0),
    // AI report generation quota
    aiCallsBalance: smallint('ai_calls_balance').notNull().default(3), // Free tier starts with 3
    aiCallsUsed: smallint('ai_calls_used').notNull().default(0),
    // Monthly reset for free tier quotas
    monthlyQuotaResetAt: timestamp('monthly_quota_reset_at', { withTimezone: true }),
    // Settings and timestamps
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    githubIdIdx: uniqueIndex('users_github_id_idx').on(table.githubId),
    walletAddressIdx: uniqueIndex('users_wallet_address_idx').on(table.walletAddress),
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    tierIdx: index('users_tier_idx').on(table.tier),
  })
);

// ============================================================================
// SESSIONS TABLE (JWT Refresh Tokens)
// ============================================================================

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
    refreshTokenFamily: uuid('refresh_token_family').notNull(),
    // GitHub token (optional - only for GitHub auth)
    githubTokenEncrypted: text('github_token_encrypted'),
    githubTokenIv: varchar('github_token_iv', { length: 64 }),
    // Auth method tracking
    authMethod: varchar('auth_method', { length: 20 }).notNull().default('github'), // 'github' | 'wallet'
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    familyIdx: index('sessions_family_idx').on(table.refreshTokenFamily),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
);

// ============================================================================
// USER ACCOUNT LINKS TABLE (For merged/linked accounts)
// ============================================================================

export const userAccountLinks = pgTable(
  'user_account_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    primaryUserId: uuid('primary_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    linkedUserId: uuid('linked_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    linkType: varchar('link_type', { length: 20 }).notNull(), // 'merged', 'linked'
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryUserIdx: index('user_account_links_primary_idx').on(table.primaryUserId),
    linkedUserIdx: index('user_account_links_linked_idx').on(table.linkedUserId),
    uniqueLink: unique('unique_account_link').on(table.primaryUserId, table.linkedUserId),
  })
);

// ============================================================================
// ORGANIZATIONS TABLE (Future-ready)
// ============================================================================

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).unique().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: text('avatar_url'),
    tier: userTierEnum('tier').notNull().default('free'),
    xpBalance: bigint('xp_balance', { mode: 'number' }).notNull().default(0),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  })
);

// ============================================================================
// ORGANIZATION MEMBERS TABLE
// ============================================================================

export const orgMemberRoleEnum = pgEnum('org_member_role', ['owner', 'admin', 'member', 'viewer']);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: orgMemberRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex('org_members_org_user_idx').on(table.organizationId, table.userId),
  })
);

// ============================================================================
// PROJECTS TABLE
// ============================================================================

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    type: projectTypeEnum('type').notNull().default('full'),
    status: projectStatusEnum('status').notNull().default('draft'),
    // Branding fields for audit reports
    logoUrl: text('logo_url'),
    websiteUrl: varchar('website_url', { length: 500 }),
    primaryColor: varchar('primary_color', { length: 7 }), // Hex color e.g. #5C61FF
    contractAddress: varchar('contract_address', { length: 128 }), // Main contract address
    chainId: varchar('chain_id', { length: 50 }), // e.g. 'ethereum', 'polygon'
    // Social/docs links
    docsUrl: varchar('docs_url', { length: 500 }),
    githubUrl: varchar('github_url', { length: 500 }),
    twitterUrl: varchar('twitter_url', { length: 500 }),
    discordUrl: varchar('discord_url', { length: 500 }),
    // Audit report customization
    reportConfig: jsonb('report_config').default({}), // Custom report settings
    settings: jsonb('settings').notNull().default({}),
    aggregatedScore: jsonb('aggregated_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userSlugIdx: uniqueIndex('projects_user_slug_idx').on(table.userId, table.slug),
    userIdIdx: index('projects_user_id_idx').on(table.userId),
    statusIdx: index('projects_status_idx').on(table.status),
  })
);

// ============================================================================
// BADGE SETTINGS TABLE
// ============================================================================

export const badgeSettings = pgTable(
  'badge_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    isPublic: boolean('is_public').notNull().default(false),
    selectedAuditId: uuid('selected_audit_id').references(() => auditJobs.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('badge_settings_project_id_idx').on(table.projectId),
  })
);

// ============================================================================
// COMPONENTS TABLE
// ============================================================================

export const components = pgTable(
  'components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: componentTypeEnum('type').notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    status: componentStatusEnum('status').notNull().default('pending'),
    config: jsonb('config').notNull().default({}),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('components_project_id_idx').on(table.projectId),
  })
);

// ============================================================================
// AUDIT JOBS TABLE
// ============================================================================

// UNIQUENESS CONSTRAINTS (enforced at application level):
// - Quick Scans: Only one completed audit per (contractAddress, contractNetwork)
//   Contract code is immutable on-chain, so re-scanning produces identical results
// - Full Audits: Only one completed audit per (repo, branch, commitSha)
//   Same commit = same code = same results
// See: auditJobRepository.ts - findExistingQuickScan(), findExistingFullAudit()
export const auditJobs = pgTable(
  'audit_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legacyId: serial('legacy_id').unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    componentId: uuid('component_id').references(() => components.id, { onDelete: 'set null' }),
    // Audit type: quick scan vs full audit
    auditType: auditTypeEnum('audit_type').notNull().default('full'),
    // Contract info for quick scans (no projectId required)
    // UNIQUE: (contractAddress, contractNetwork) for completed quick scans
    contractAddress: varchar('contract_address', { length: 128 }),
    contractNetwork: varchar('contract_network', { length: 50 }),
    contractName: varchar('contract_name', { length: 255 }),
    isProxy: boolean('is_proxy').notNull().default(false),
    implementationAddress: varchar('implementation_address', { length: 128 }),
    deployerAddress: varchar('deployer_address', { length: 128 }),
    creationTxHash: varchar('creation_tx_hash', { length: 128 }),
    // Repository info for full audits
    // UNIQUE: (repo, branch, commitSha) for completed full audits
    repo: varchar('repo', { length: 500 }).notNull(),
    branch: varchar('branch', { length: 255 }).notNull().default('main'),
    commitSha: varchar('commit_sha', { length: 40 }),
    status: jobStatusEnum('status').notNull().default('pending'),
    progressPct: smallint('progress_pct').notNull().default(0),
    progressMessage: text('progress_message'),
    visibility: auditVisibilityEnum('visibility').notNull().default('private'),
    xpCost: smallint('xp_cost'),
    xpRefunded: boolean('xp_refunded').notNull().default(false),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    // SOP-based audit fields
    sourceType: varchar('source_type', { length: 30 }), // github-repo, deployed-contract, manual-upload
    projectPath: text('project_path'),
    detectedFramework: varchar('detected_framework', { length: 50 }),
    sopId: varchar('sop_id', { length: 100 }),
    sopVersion: varchar('sop_version', { length: 20 }),
    auditDepth: varchar('audit_depth', { length: 20 }), // quick, standard, deep
    currentStepId: varchar('current_step_id', { length: 100 }),
    currentStepName: varchar('current_step_name', { length: 255 }),
    stepsCompleted: smallint('steps_completed'),
    stepsTotal: smallint('steps_total'),
    metadata: jsonb('metadata').default({}),
  },
  (table) => ({
    userIdIdx: index('audit_jobs_user_id_idx').on(table.userId),
    projectIdIdx: index('audit_jobs_project_id_idx').on(table.projectId),
    statusIdx: index('audit_jobs_status_idx').on(table.status),
    visibilityIdx: index('audit_jobs_visibility_idx').on(table.visibility),
    createdAtIdx: index('audit_jobs_created_at_idx').on(table.createdAt),
    auditTypeIdx: index('audit_jobs_audit_type_idx').on(table.auditType),
    contractAddressIdx: index('audit_jobs_contract_address_idx').on(table.contractAddress),
    // Composite index for public ledger queries
    publicLedgerIdx: index('audit_jobs_public_ledger_idx').on(table.visibility, table.status, table.completedAt),
  })
);

// ============================================================================
// AUDIT RESULTS TABLE
// ============================================================================

export const auditResults = pgTable(
  'audit_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    scoreValue: real('score_value'), // Changed from smallint to real to support decimal scores like 95.8
    scoreLabel: varchar('score_label', { length: 50 }),
    findings: jsonb('findings').notNull().default([]),
    summary: text('summary'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: uniqueIndex('audit_results_job_id_idx').on(table.jobId),
  })
);

// ============================================================================
// AUDIT REPORTS TABLE
// ============================================================================

export const auditReports = pgTable(
  'audit_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    format: varchar('format', { length: 20 }).default('json'), // 'html', 'pdf', 'json'
    filePath: text('file_path'),
    fileSize: bigint('file_size', { mode: 'number' }),
    checksum: varchar('checksum', { length: 64 }),
    reportData: jsonb('report_data'), // JSON report data for SOP-based audits
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('audit_reports_job_id_idx').on(table.jobId),
  })
);

// ============================================================================
// PRE-AUDIT QUESTIONNAIRES TABLE
// ============================================================================

export const preauditQuestionnaires = pgTable(
  'preaudit_questionnaires',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: uniqueIndex('preaudit_questionnaires_job_id_idx').on(table.jobId),
  })
);

// ============================================================================
// PRE-AUDIT QUESTIONS TABLE
// ============================================================================

export const preauditQuestions = pgTable(
  'preaudit_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionKey: varchar('question_key', { length: 100 }).unique().notNull(),
    questionText: text('question_text').notNull(),
    questionType: varchar('question_type', { length: 50 }).notNull(), // 'text', 'textarea', 'select', 'multiselect'
    options: jsonb('options'), // for select/multiselect types
    required: boolean('required').notNull().default(false),
    orderIndex: smallint('order_index').notNull().default(0),
    category: varchar('category', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    questionKeyIdx: uniqueIndex('preaudit_questions_key_idx').on(table.questionKey),
  })
);

// ============================================================================
// PRE-AUDIT ANSWERS TABLE
// ============================================================================

export const preauditAnswers = pgTable(
  'preaudit_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionnaireId: uuid('questionnaire_id')
      .notNull()
      .references(() => preauditQuestionnaires.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => preauditQuestions.id, { onDelete: 'cascade' }),
    answerValue: jsonb('answer_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    questionnaireQuestionIdx: uniqueIndex('preaudit_answers_q_q_idx').on(
      table.questionnaireId,
      table.questionId
    ),
  })
);

// ============================================================================
// CLARIFICATION PHASE ENUM (for two-stage clarifications)
// ============================================================================

export const clarificationPhaseEnum = pgEnum('clarification_phase', [
  'pre_audit',   // Before scoring - context gathering
  'post_audit',  // After scoring - dispute/challenge
]);

export const clarificationStatusEnum = pgEnum('clarification_status', [
  'pending',
  'answered',
  'skipped',
  'resolved',
]);

// ============================================================================
// AUDIT CLARIFICATIONS TABLE (unified pre/post audit questions)
// ============================================================================

export const auditClarifications = pgTable(
  'audit_clarifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    phase: clarificationPhaseEnum('phase').notNull(),
    questionKey: varchar('question_key', { length: 100 }).notNull(),
    questionText: text('question_text').notNull(),
    questionType: varchar('question_type', { length: 50 }).notNull(), // 'text', 'select', 'confirm'
    options: jsonb('options'), // For select/multiselect types
    context: jsonb('context'), // { file, line, findingId, snippet, category }
    status: clarificationStatusEnum('status').notNull().default('pending'),
    answerValue: jsonb('answer_value'),
    // Score impact tracking (for post-audit disputes)
    scoreImpact: jsonb('score_impact'), // { before, after, section }
    // Claude CLI session tracking (for async question answering)
    claudeSessionId: varchar('claude_session_id', { length: 255 }),
    claudeConversationId: varchar('claude_conversation_id', { length: 255 }),
    resumptionPrompt: text('resumption_prompt'), // Prompt to resume Claude session
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Commit resolution tracking
    resolvedInCommit: boolean('resolved_in_commit').default(false),
    commitSha: varchar('commit_sha', { length: 64 }),
    commitMessage: text('commit_message'),
    commitVerified: boolean('commit_verified').default(false),
    verificationNote: text('verification_note'),
  },
  (table) => ({
    jobIdIdx: index('audit_clarifications_job_id_idx').on(table.jobId),
    phaseIdx: index('audit_clarifications_phase_idx').on(table.phase),
    statusIdx: index('audit_clarifications_status_idx').on(table.status),
    jobPhaseIdx: index('audit_clarifications_job_phase_idx').on(table.jobId, table.phase),
  })
);

// ============================================================================
// CLARIFICATION FAQ TABLE
// ============================================================================

export const clarificationFaqCategoryEnum = pgEnum('clarification_faq_category', [
  'false_positive',
  'mitigated',
  'accepted_risk',
  'already_fixed',
  'commit_verified',
  'general',
]);

export const clarificationFaqs = pgTable(
  'clarification_faqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // Related clarification
    clarificationId: uuid('clarification_id').references(() => auditClarifications.id, {
      onDelete: 'set null',
    }),
    findingId: varchar('finding_id', { length: 500 }).notNull(), // Finding title or ID
    findingTitle: text('finding_title').notNull(),

    // FAQ content
    question: text('question').notNull(), // Auto-generated: "Why was this finding marked as resolved?"
    answer: text('answer').notNull(), // User explanation + verification reasoning
    category: clarificationFaqCategoryEnum('category').notNull().default('general'),

    // Verification details
    verified: boolean('verified').notNull().default(false),
    verifiedBy: varchar('verified_by', { length: 50 }).default('claude-verifier'), // claude-verifier, manual, system
    verificationReasoning: text('verification_reasoning'), // Why it was accepted/rejected
    confidence: varchar('confidence', { length: 20 }), // high, medium, low

    // Metadata
    helpful: boolean('helpful').default(true),
    viewCount: integer('view_count').default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('clarification_faqs_job_id_idx').on(table.jobId),
    categoryIdx: index('clarification_faqs_category_idx').on(table.category),
    verifiedIdx: index('clarification_faqs_verified_idx').on(table.verified),
    findingIdIdx: index('clarification_faqs_finding_id_idx').on(table.findingId),
  })
);

// ============================================================================
// CLARIFICATION VERIFICATION RESULTS TABLE
// ============================================================================

export const verificationRecommendationEnum = pgEnum('verification_recommendation', [
  'accept',
  'reject',
  'manual_review',
]);

export const clarificationVerifications = pgTable(
  'clarification_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    clarificationId: uuid('clarification_id')
      .notNull()
      .references(() => auditClarifications.id, { onDelete: 'cascade' }),

    // Finding context
    findingId: varchar('finding_id', { length: 500 }).notNull(),
    findingTitle: text('finding_title').notNull(),
    findingSeverity: varchar('finding_severity', { length: 20 }).notNull(),
    findingDescription: text('finding_description').notNull(),

    // User's clarification
    clarificationType: varchar('clarification_type', { length: 50 }).notNull(),
    userExplanation: text('user_explanation').notNull(),
    evidenceUrl: text('evidence_url'),

    // Commit resolution context
    resolvedInCommit: boolean('resolved_in_commit').default(false),
    commitSha: varchar('commit_sha', { length: 64 }),
    commitDiff: text('commit_diff'), // Actual code diff from commit
    commitMessage: text('commit_message'),

    // Code context used for verification
    codeSnippet: text('code_snippet'), // Code at finding location
    fileContext: text('file_context'), // Surrounding code context

    // Verification result
    verified: boolean('verified').notNull(),
    confidence: varchar('confidence', { length: 20 }).notNull(), // high, medium, low
    recommendation: verificationRecommendationEnum('recommendation').notNull(),
    reasoning: text('reasoning').notNull(), // Technical explanation from Claude

    // Verification metadata
    verifiedBy: varchar('verified_by', { length: 50 }).default('claude-verifier'),
    verificationModel: varchar('verification_model', { length: 50 }), // e.g., claude-opus-4.5
    verificationPromptVersion: varchar('verification_prompt_version', { length: 20 }), // Track prompt changes

    // Manual override
    manuallyReviewed: boolean('manually_reviewed').default(false),
    manualReviewer: varchar('manual_reviewer', { length: 255 }),
    manualDecision: verificationRecommendationEnum('manual_decision'),
    manualNotes: text('manual_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('clarification_verifications_job_id_idx').on(table.jobId),
    clarificationIdIdx: index('clarification_verifications_clarification_id_idx').on(
      table.clarificationId
    ),
    verifiedIdx: index('clarification_verifications_verified_idx').on(table.verified),
    recommendationIdx: index('clarification_verifications_recommendation_idx').on(
      table.recommendation
    ),
    confidenceIdx: index('clarification_verifications_confidence_idx').on(table.confidence),
  })
);

// ============================================================================
// CONTRACT CLASSIFICATIONS TABLE
// ============================================================================

export const contractCategoryEnum = pgEnum('contract_category', [
  'erc20-token',
  'erc721-nft',
  'erc1155-multi',
  'defi-amm',
  'defi-lending',
  'defi-staking',
  'governance',
  'bridge',
  'proxy-upgradeable',
  'multisig-wallet',
  'generic',
]);

export const contractClassifications = pgTable(
  'contract_classifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .unique()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // Classification results
    category: contractCategoryEnum('category').notNull(),
    subCategory: varchar('sub_category', { length: 100 }),

    // Detection details
    interfaces: jsonb('interfaces').notNull().default([]), // ['IERC20', 'Ownable']
    patterns: jsonb('patterns').notNull().default([]),     // ['minting', 'burning', 'staking']
    confidence: smallint('confidence'),                     // 0-100

    // Metadata
    detectionMetadata: jsonb('detection_metadata').notNull().default({}),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: uniqueIndex('contract_classifications_job_id_idx').on(table.jobId),
    categoryIdx: index('contract_classifications_category_idx').on(table.category),
    confidenceIdx: index('contract_classifications_confidence_idx').on(table.confidence),
  })
);

// ============================================================================
// XP TRANSACTIONS TABLE
// ============================================================================

export const xpTransactions = pgTable(
  'xp_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: xpTransactionTypeEnum('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    referenceType: varchar('reference_type', { length: 50 }), // 'audit_job', 'referral', etc.
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('xp_transactions_user_id_idx').on(table.userId),
    createdAtIdx: index('xp_transactions_created_at_idx').on(table.createdAt),
    referenceIdx: index('xp_transactions_reference_idx').on(
      table.referenceType,
      table.referenceId
    ),
  })
);

// ============================================================================
// NEURON PURCHASES TABLE (USDT Wallet Payments)
// ============================================================================

export const neuronPurchases = pgTable(
  'neuron_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Transaction details
    txHash: varchar('tx_hash', { length: 100 }).unique().notNull(),
    chainId: smallint('chain_id').notNull(), // 1=Ethereum, 137=Polygon, 42161=Arbitrum
    fromAddress: varchar('from_address', { length: 128 }).notNull(),
    // Payment details
    tier: purchaseTierEnum('tier').notNull(),
    amountUsdt: bigint('amount_usdt', { mode: 'number' }).notNull(), // In cents (e.g., 2900 = $29.00)
    // Credits awarded
    neuronsAwarded: bigint('neurons_awarded', { mode: 'number' }).notNull(),
    slocAwarded: bigint('sloc_awarded', { mode: 'number' }).notNull(),
    aiCallsAwarded: smallint('ai_calls_awarded').notNull(),
    // Status tracking
    status: purchaseStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('neuron_purchases_user_id_idx').on(table.userId),
    txHashIdx: uniqueIndex('neuron_purchases_tx_hash_idx').on(table.txHash),
    statusIdx: index('neuron_purchases_status_idx').on(table.status),
    createdAtIdx: index('neuron_purchases_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// XP RULES TABLE
// ============================================================================

export const xpRules = pgTable(
  'xp_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleKey: varchar('rule_key', { length: 100 }).unique().notNull(),
    description: text('description').notNull(),
    xpAmount: bigint('xp_amount', { mode: 'number' }).notNull(),
    maxOccurrences: smallint('max_occurrences'), // null = unlimited
    cooldownMinutes: smallint('cooldown_minutes'), // null = no cooldown
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ruleKeyIdx: uniqueIndex('xp_rules_key_idx').on(table.ruleKey),
  })
);

// ============================================================================
// TIER THRESHOLDS TABLE
// ============================================================================

export const tierThresholds = pgTable(
  'tier_thresholds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tier: userTierEnum('tier').unique().notNull(),
    minXp: bigint('min_xp', { mode: 'number' }).notNull(),
    monthlyFreeAudits: smallint('monthly_free_audits').notNull().default(0),
    auditXpCostQuick: smallint('audit_xp_cost_quick').notNull(),
    auditXpCostStandard: smallint('audit_xp_cost_standard').notNull(),
    auditXpCostDeep: smallint('audit_xp_cost_deep').notNull(),
    features: jsonb('features').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tierIdx: uniqueIndex('tier_thresholds_tier_idx').on(table.tier),
  })
);

// ============================================================================
// PUBLIC AUDIT SHOWCASE TABLE
// ============================================================================

export const publicAuditShowcase = pgTable(
  'public_audit_showcase',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).unique().notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    featured: boolean('featured').notNull().default(false),
    viewCount: bigint('view_count', { mode: 'number' }).notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('public_audit_showcase_slug_idx').on(table.slug),
    jobIdIdx: uniqueIndex('public_audit_showcase_job_id_idx').on(table.jobId),
    featuredIdx: index('public_audit_showcase_featured_idx').on(table.featured),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
  auditJobs: many(auditJobs),
  xpTransactions: many(xpTransactions),
  neuronPurchases: many(neuronPurchases),
  organizationMemberships: many(organizationMembers),
}));

export const neuronPurchasesRelations = relations(neuronPurchases, ({ one }) => ({
  user: one(users, {
    fields: [neuronPurchases.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  components: many(components),
  auditJobs: many(auditJobs),
}));

export const componentsRelations = relations(components, ({ one, many }) => ({
  project: one(projects, {
    fields: [components.projectId],
    references: [projects.id],
  }),
  auditJobs: many(auditJobs),
}));

export const auditJobsRelations = relations(auditJobs, ({ one, many }) => ({
  user: one(users, {
    fields: [auditJobs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [auditJobs.projectId],
    references: [projects.id],
  }),
  component: one(components, {
    fields: [auditJobs.componentId],
    references: [components.id],
  }),
  results: one(auditResults),
  reports: many(auditReports),
  questionnaire: one(preauditQuestionnaires),
  publicShowcase: one(publicAuditShowcase),
  clarifications: many(auditClarifications),
}));

export const auditClarificationsRelations = relations(auditClarifications, ({ one }) => ({
  job: one(auditJobs, {
    fields: [auditClarifications.jobId],
    references: [auditJobs.id],
  }),
}));

export const contractClassificationsRelations = relations(contractClassifications, ({ one }) => ({
  job: one(auditJobs, {
    fields: [contractClassifications.jobId],
    references: [auditJobs.id],
  }),
}));

export const auditResultsRelations = relations(auditResults, ({ one }) => ({
  job: one(auditJobs, {
    fields: [auditResults.jobId],
    references: [auditJobs.id],
  }),
}));

export const auditReportsRelations = relations(auditReports, ({ one }) => ({
  job: one(auditJobs, {
    fields: [auditReports.jobId],
    references: [auditJobs.id],
  }),
}));

export const preauditQuestionnairesRelations = relations(preauditQuestionnaires, ({ one, many }) => ({
  job: one(auditJobs, {
    fields: [preauditQuestionnaires.jobId],
    references: [auditJobs.id],
  }),
  answers: many(preauditAnswers),
}));

export const preauditAnswersRelations = relations(preauditAnswers, ({ one }) => ({
  questionnaire: one(preauditQuestionnaires, {
    fields: [preauditAnswers.questionnaireId],
    references: [preauditQuestionnaires.id],
  }),
  question: one(preauditQuestions, {
    fields: [preauditAnswers.questionId],
    references: [preauditQuestions.id],
  }),
}));

export const xpTransactionsRelations = relations(xpTransactions, ({ one }) => ({
  user: one(users, {
    fields: [xpTransactions.userId],
    references: [users.id],
  }),
}));

export const publicAuditShowcaseRelations = relations(publicAuditShowcase, ({ one }) => ({
  job: one(auditJobs, {
    fields: [publicAuditShowcase.jobId],
    references: [auditJobs.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type UserAccountLink = typeof userAccountLinks.$inferSelect;
export type NewUserAccountLink = typeof userAccountLinks.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;

export type AuditJob = typeof auditJobs.$inferSelect;
export type NewAuditJob = typeof auditJobs.$inferInsert;

export type AuditResult = typeof auditResults.$inferSelect;
export type NewAuditResult = typeof auditResults.$inferInsert;

export type XpTransaction = typeof xpTransactions.$inferSelect;
export type NewXpTransaction = typeof xpTransactions.$inferInsert;

export type XpRule = typeof xpRules.$inferSelect;
export type NewXpRule = typeof xpRules.$inferInsert;

export type TierThreshold = typeof tierThresholds.$inferSelect;
export type NewTierThreshold = typeof tierThresholds.$inferInsert;

export type NeuronPurchase = typeof neuronPurchases.$inferSelect;
export type NewNeuronPurchase = typeof neuronPurchases.$inferInsert;

// Enum types
export type WalletType = (typeof walletTypeEnum.enumValues)[number];
export type UserTier = (typeof userTierEnum.enumValues)[number];
export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type PurchaseTier = (typeof purchaseTierEnum.enumValues)[number];
export type ClarificationPhase = (typeof clarificationPhaseEnum.enumValues)[number];
export type ClarificationStatus = (typeof clarificationStatusEnum.enumValues)[number];
export type AuditType = (typeof auditTypeEnum.enumValues)[number];
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];
export type AuditVisibility = (typeof auditVisibilityEnum.enumValues)[number];

// Table types
export type AuditClarification = typeof auditClarifications.$inferSelect;
export type NewAuditClarification = typeof auditClarifications.$inferInsert;

export type ClarificationFaq = typeof clarificationFaqs.$inferSelect;
export type NewClarificationFaq = typeof clarificationFaqs.$inferInsert;
export type ClarificationFaqCategory = (typeof clarificationFaqCategoryEnum.enumValues)[number];

export type ClarificationVerification = typeof clarificationVerifications.$inferSelect;
export type NewClarificationVerification = typeof clarificationVerifications.$inferInsert;
export type VerificationRecommendation = (typeof verificationRecommendationEnum.enumValues)[number];

export type ContractClassification = typeof contractClassifications.$inferSelect;
export type NewContractClassification = typeof contractClassifications.$inferInsert;
export type ContractCategory = (typeof contractCategoryEnum.enumValues)[number];

// ============================================================================
// SOP STEP STATUS ENUM
// ============================================================================

export const stepStatusEnum = pgEnum('step_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

// ============================================================================
// AUDIT STEP PROGRESS TABLE (Micro-step tracking)
// ============================================================================

export const auditStepProgress = pgTable(
  'audit_step_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // Step identification
    stepId: varchar('step_id', { length: 100 }).notNull(),
    stepName: varchar('step_name', { length: 255 }).notNull(),
    stepCategory: varchar('step_category', { length: 50 }).notNull(),

    // Status
    status: stepStatusEnum('status').notNull().default('pending'),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: bigint('duration_ms', { mode: 'number' }),

    // Progress within step (for long-running steps)
    internalPct: smallint('internal_pct').default(0),
    internalMessage: text('internal_message'),

    // Output/errors
    outputSummary: jsonb('output_summary'),
    errorMessage: text('error_message'),
    retryCount: smallint('retry_count').default(0),

    // Ordering
    orderIndex: smallint('order_index').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('audit_step_progress_job_id_idx').on(table.jobId),
    jobStepIdx: uniqueIndex('audit_step_progress_job_step_idx').on(table.jobId, table.stepId),
    statusIdx: index('audit_step_progress_status_idx').on(table.status),
  })
);

// ============================================================================
// AUDIT SOP EXECUTION TABLE (SOP execution metadata)
// ============================================================================

export const auditSopExecution = pgTable(
  'audit_sop_execution',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // SOP info
    sopId: varchar('sop_id', { length: 100 }).notNull(),
    sopVersion: varchar('sop_version', { length: 20 }).notNull(),
    auditDepth: varchar('audit_depth', { length: 20 }).notNull(), // 'quick' | 'standard' | 'deep'

    // Framework detection
    detectedFramework: varchar('detected_framework', { length: 50 }),
    detectedLanguage: varchar('detected_language', { length: 20 }),

    // Step counts
    totalSteps: smallint('total_steps').notNull(),
    completedSteps: smallint('completed_steps').default(0),
    failedSteps: smallint('failed_steps').default(0),
    skippedSteps: smallint('skipped_steps').default(0),

    // Tool availability (recorded at start)
    availableTools: jsonb('available_tools'),

    // Timing
    estimatedDurationMinutes: smallint('estimated_duration_minutes'),
    actualDurationMinutes: smallint('actual_duration_minutes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: uniqueIndex('audit_sop_execution_job_id_idx').on(table.jobId),
    sopIdIdx: index('audit_sop_execution_sop_id_idx').on(table.sopId),
  })
);

// ============================================================================
// TOOL EXECUTION LOGS TABLE
// ============================================================================

export const toolExecutionLogs = pgTable(
  'tool_execution_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stepProgressId: uuid('step_progress_id')
      .notNull()
      .references(() => auditStepProgress.id, { onDelete: 'cascade' }),

    toolName: varchar('tool_name', { length: 50 }).notNull(),
    toolVersion: varchar('tool_version', { length: 50 }),

    command: text('command'),
    exitCode: smallint('exit_code'),
    stdout: text('stdout'),
    stderr: text('stderr'),

    findingsCount: smallint('findings_count'),
    executionTimeMs: bigint('execution_time_ms', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stepIdIdx: index('tool_execution_logs_step_id_idx').on(table.stepProgressId),
    toolNameIdx: index('tool_execution_logs_tool_name_idx').on(table.toolName),
  })
);

// ============================================================================
// SOP-RELATED RELATIONS
// ============================================================================

export const auditStepProgressRelations = relations(auditStepProgress, ({ one, many }) => ({
  job: one(auditJobs, {
    fields: [auditStepProgress.jobId],
    references: [auditJobs.id],
  }),
  toolLogs: many(toolExecutionLogs),
}));

export const auditSopExecutionRelations = relations(auditSopExecution, ({ one }) => ({
  job: one(auditJobs, {
    fields: [auditSopExecution.jobId],
    references: [auditJobs.id],
  }),
}));

export const toolExecutionLogsRelations = relations(toolExecutionLogs, ({ one }) => ({
  stepProgress: one(auditStepProgress, {
    fields: [toolExecutionLogs.stepProgressId],
    references: [auditStepProgress.id],
  }),
}));

// ============================================================================
// SOP-RELATED TYPE EXPORTS
// ============================================================================

export type AuditStepProgress = typeof auditStepProgress.$inferSelect;
export type NewAuditStepProgress = typeof auditStepProgress.$inferInsert;

export type AuditSopExecution = typeof auditSopExecution.$inferSelect;
export type NewAuditSopExecution = typeof auditSopExecution.$inferInsert;

export type ToolExecutionLog = typeof toolExecutionLogs.$inferSelect;
export type NewToolExecutionLog = typeof toolExecutionLogs.$inferInsert;

export type StepStatus = (typeof stepStatusEnum.enumValues)[number];

// ============================================================================
// INTERACTIVE AUDIT ENUMS
// ============================================================================

export const sessionStatusEnum = pgEnum('session_status', [
  'running',
  'paused_for_input',
  'completed',
  'failed',
  'cancelled',
]);

export const promptStatusEnum = pgEnum('prompt_status', [
  'pending',
  'answered',
  'skipped',
  'timed_out',
]);

export const promptTypeEnum = pgEnum('prompt_type', [
  'single_choice',
  'multi_choice',
  'text',
  'address',
  'contract_link',
  'confirm',
  'form',
]);

export const addressTypeEnum = pgEnum('address_type', [
  'eoa',
  'multisig',
  'timelock',
  'governance',
  'treasury',
  'oracle',
  'protocol',
  'renounced',
  'unknown',
]);

export const linkedProjectRelationshipEnum = pgEnum('linked_project_relationship', [
  'admin',
  'governance',
  'timelock',
  'dependency',
  'integration',
  'proxy',
  'implementation',
  'oracle',
  'other',
]);

export const findingStatusEnum = pgEnum('finding_status', [
  'new',
  'acknowledged',
  'disputed',
  'fixed',
  'wont_fix',
  'false_positive',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'audit_complete',
  'input_needed',
  'critical_finding',
  'audit_failed',
  'audit_cancelled',
  'prompt_timeout',
]);

// ============================================================================
// AUDIT SESSIONS TABLE (Interactive Audit State)
// ============================================================================

export const auditSessions = pgTable(
  'audit_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Session configuration
    interactiveMode: boolean('interactive_mode').notNull().default(true),
    autoContinueTimeoutSeconds: smallint('auto_continue_timeout_seconds').default(300),
    notificationEmail: varchar('notification_email', { length: 255 }),
    notifyOnCompletion: boolean('notify_on_completion').default(true),
    notifyOnInputNeeded: boolean('notify_on_input_needed').default(true),
    notifyOnCriticalFinding: boolean('notify_on_critical_finding').default(true),

    // Session state
    status: sessionStatusEnum('status').notNull().default('running'),
    currentPromptId: uuid('current_prompt_id'),
    pausedAtStep: varchar('paused_at_step', { length: 100 }),
    pausedAt: timestamp('paused_at', { withTimezone: true }),

    // AI Conversation Tracking (for resuming conversations per project)
    aiConversationId: varchar('ai_conversation_id', { length: 255 }),
    aiSessionId: varchar('ai_session_id', { length: 255 }),
    aiModelUsed: varchar('ai_model_used', { length: 100 }),
    aiConversationContext: jsonb('ai_conversation_context').default({}),
    aiConversationStartedAt: timestamp('ai_conversation_started_at', { withTimezone: true }),
    aiConversationLastUsedAt: timestamp('ai_conversation_last_used_at', { withTimezone: true }),
    aiTotalTokensUsed: bigint('ai_total_tokens_used', { mode: 'number' }).default(0),
    aiTotalTurns: smallint('ai_total_turns').default(0),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: uniqueIndex('audit_sessions_job_id_idx').on(table.jobId),
    userIdIdx: index('audit_sessions_user_id_idx').on(table.userId),
    statusIdx: index('audit_sessions_status_idx').on(table.status),
    aiConversationIdx: index('audit_sessions_ai_conversation_idx').on(table.aiConversationId),
  })
);

// ============================================================================
// AUDIT LINKED PROJECTS TABLE (Multi-Contract Support)
// ============================================================================

export const auditLinkedProjects = pgTable(
  'audit_linked_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),

    // Linked project info
    name: varchar('name', { length: 255 }).notNull(),
    sourceType: varchar('source_type', { length: 30 }).notNull(), // github-repo, deployed-contract, existing-project
    sourceConfig: jsonb('source_config').notNull(), // { repoUrl, branch } or { address, chain } or { projectId }

    // Relationship to primary project
    relationship: linkedProjectRelationshipEnum('relationship').notNull(),
    relationshipDescription: text('relationship_description'),

    // Which contracts are relevant
    relevantContracts: jsonb('relevant_contracts'), // ["Governance.sol", "Timelock.sol"]

    // If we're also auditing this linked project
    linkedJobId: uuid('linked_job_id').references(() => auditJobs.id, { onDelete: 'set null' }),

    // Metadata
    addedBy: varchar('added_by', { length: 30 }).default('user'), // user, ai_suggestion
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('audit_linked_projects_session_id_idx').on(table.sessionId),
    relationshipIdx: index('audit_linked_projects_relationship_idx').on(table.relationship),
  })
);

// ============================================================================
// AUDIT KNOWN ADDRESSES TABLE (User-Provided Context)
// ============================================================================

export const auditKnownAddresses = pgTable(
  'audit_known_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),

    // Address info
    address: varchar('address', { length: 128 }).notNull(),
    chain: varchar('chain', { length: 30 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),

    // Address type affects finding severity
    addressType: addressTypeEnum('address_type').notNull(),

    // Type-specific metadata
    metadata: jsonb('metadata').default({}), // { signers, threshold, walletType } for multisig

    // Optional link to another project
    linkedProjectId: uuid('linked_project_id').references(() => auditLinkedProjects.id, {
      onDelete: 'set null',
    }),

    // Source and verification
    source: varchar('source', { length: 30 }).default('user'), // user, ai_detected, on_chain_verified
    verified: boolean('verified').default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('audit_known_addresses_session_id_idx').on(table.sessionId),
    addressIdx: index('audit_known_addresses_address_idx').on(table.address),
    addressTypeIdx: index('audit_known_addresses_type_idx').on(table.addressType),
  })
);

// ============================================================================
// AUDIT PROMPTS TABLE (Interactive Questions During Audit)
// ============================================================================

export const auditPrompts = pgTable(
  'audit_prompts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),

    // Which step triggered this prompt
    stepId: varchar('step_id', { length: 100 }).notNull(),
    stepName: varchar('step_name', { length: 255 }),

    // Prompt template reference
    templateId: varchar('template_id', { length: 100 }),

    // Prompt content
    promptType: promptTypeEnum('prompt_type').notNull(),
    question: text('question').notNull(),

    // Variables substituted into question
    variables: jsonb('variables').default({}),

    // Context to show user (code snippet, finding, etc.)
    context: jsonb('context').default({}),

    // Available options (for choice types)
    options: jsonb('options'), // [{ value, label, description, severityImpact, followUp }]

    // Prompt behavior
    required: boolean('required').default(false),
    defaultValue: jsonb('default_value'),
    timeoutSeconds: smallint('timeout_seconds').default(300),

    // State
    status: promptStatusEnum('status').notNull().default('pending'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    timedOutAt: timestamp('timed_out_at', { withTimezone: true }),
  },
  (table) => ({
    sessionIdIdx: index('audit_prompts_session_id_idx').on(table.sessionId),
    statusIdx: index('audit_prompts_status_idx').on(table.status),
    stepIdIdx: index('audit_prompts_step_id_idx').on(table.stepId),
  })
);

// ============================================================================
// AUDIT USER ANSWERS TABLE (Responses to Prompts)
// ============================================================================

export const auditUserAnswers = pgTable(
  'audit_user_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),
    promptId: uuid('prompt_id')
      .notNull()
      .references(() => auditPrompts.id, { onDelete: 'cascade' }),

    // The answer
    answer: jsonb('answer').notNull(),

    // How to apply this answer
    applyToSimilar: boolean('apply_to_similar').default(true),
    appliedToFindings: jsonb('applied_to_findings').default([]), // Array of finding IDs
    severityAdjustments: jsonb('severity_adjustments').default({}), // { "finding-id": { from, to, reason } }

    // Source
    answeredBy: varchar('answered_by', { length: 30 }).default('user'), // user, auto_timeout, skip

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('audit_user_answers_session_id_idx').on(table.sessionId),
    promptIdIdx: uniqueIndex('audit_user_answers_prompt_id_idx').on(table.promptId),
  })
);

// ============================================================================
// AUDIT FINDINGS TABLE (Normalized, Enriched Findings)
// ============================================================================

export const auditFindings = pgTable(
  'audit_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => auditSessions.id, { onDelete: 'set null' }),

    // Finding identity
    findingId: varchar('finding_id', { length: 100 }).notNull(), // Original ID from tool/AI
    tool: varchar('tool', { length: 50 }), // slither, mythril, ai, etc.
    stepId: varchar('step_id', { length: 100 }),

    // Finding content
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    recommendation: text('recommendation'),

    // Severity (original and adjusted)
    originalSeverity: varchar('original_severity', { length: 20 }).notNull(),
    adjustedSeverity: varchar('adjusted_severity', { length: 20 }),
    severityAdjustmentReason: text('severity_adjustment_reason'),

    // Location
    filePath: varchar('file_path', { length: 500 }),
    lineStart: smallint('line_start'),
    lineEnd: smallint('line_end'),
    functionName: varchar('function_name', { length: 255 }),
    contractName: varchar('contract_name', { length: 255 }),

    // Related addresses (for context matching)
    relatedAddresses: jsonb('related_addresses').default([]),

    // Cross-references
    similarFindingIds: jsonb('similar_finding_ids').default([]),
    linkedProjectFindings: jsonb('linked_project_findings').default([]),

    // User interaction
    userContext: jsonb('user_context').default({}),
    acknowledged: boolean('acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    disputed: boolean('disputed').default(false),
    disputeReason: text('dispute_reason'),

    // State
    status: findingStatusEnum('status').notNull().default('new'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('audit_findings_job_id_idx').on(table.jobId),
    jobFindingIdx: uniqueIndex('audit_findings_job_finding_idx').on(table.jobId, table.findingId),
    severityIdx: index('audit_findings_severity_idx').on(table.adjustedSeverity),
    statusIdx: index('audit_findings_status_idx').on(table.status),
    toolIdx: index('audit_findings_tool_idx').on(table.tool),
  })
);

// ============================================================================
// NOTIFICATIONS TABLE
// ============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Notification content
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),

    // Related entities
    jobId: uuid('job_id').references(() => auditJobs.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id').references(() => auditSessions.id, { onDelete: 'set null' }),
    promptId: uuid('prompt_id').references(() => auditPrompts.id, { onDelete: 'set null' }),
    findingId: uuid('finding_id').references(() => auditFindings.id, { onDelete: 'set null' }),

    // Delivery channels
    channels: jsonb('channels').notNull().default(['in_app']), // ["in_app", "email"]
    emailSent: boolean('email_sent').default(false),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),

    // State
    read: boolean('read').default(false),
    readAt: timestamp('read_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    unreadIdx: index('notifications_unread_idx').on(table.userId, table.read),
    typeIdx: index('notifications_type_idx').on(table.type),
    jobIdIdx: index('notifications_job_id_idx').on(table.jobId),
  })
);

// ============================================================================
// AI CONVERSATION HISTORY TABLE (Audit Trail for AI Interactions)
// ============================================================================

export const aiConversationRoleEnum = pgEnum('ai_conversation_role', [
  'system',
  'user',
  'assistant',
  'tool',
]);

export const aiConversationHistory = pgTable(
  'ai_conversation_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // Conversation tracking
    conversationId: varchar('conversation_id', { length: 255 }).notNull(),
    turnIndex: smallint('turn_index').notNull(),
    role: aiConversationRoleEnum('role').notNull(),

    // Message content
    content: text('content').notNull(),
    contentSummary: text('content_summary'), // For long messages, store a summary

    // Step context (which audit step triggered this)
    stepId: varchar('step_id', { length: 100 }),
    stepName: varchar('step_name', { length: 255 }),

    // Tool usage (if role is 'tool')
    toolName: varchar('tool_name', { length: 100 }),
    toolInput: jsonb('tool_input'),
    toolOutput: jsonb('tool_output'),

    // Token tracking
    inputTokens: smallint('input_tokens'),
    outputTokens: smallint('output_tokens'),
    totalTokens: smallint('total_tokens'),

    // Model info
    modelUsed: varchar('model_used', { length: 100 }),

    // Metadata
    metadata: jsonb('metadata').default({}),

    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: smallint('duration_ms'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('ai_conversation_history_session_idx').on(table.sessionId),
    jobIdIdx: index('ai_conversation_history_job_idx').on(table.jobId),
    conversationIdIdx: index('ai_conversation_history_conv_idx').on(table.conversationId),
    stepIdIdx: index('ai_conversation_history_step_idx').on(table.stepId),
    turnIdx: index('ai_conversation_history_turn_idx').on(table.conversationId, table.turnIndex),
  })
);

// ============================================================================
// AI CONTEXT SNAPSHOTS (For Resuming Conversations)
// ============================================================================

export const aiContextSnapshots = pgTable(
  'ai_context_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => auditSessions.id, { onDelete: 'cascade' }),

    // Snapshot identification
    snapshotType: varchar('snapshot_type', { length: 50 }).notNull(), // 'checkpoint', 'step_complete', 'pause', 'error'
    stepId: varchar('step_id', { length: 100 }),

    // Context data for resumption
    conversationId: varchar('conversation_id', { length: 255 }).notNull(),
    contextSummary: text('context_summary').notNull(), // AI-generated summary of conversation so far
    keyFindings: jsonb('key_findings').default([]), // Important findings discovered
    keyDecisions: jsonb('key_decisions').default([]), // Decisions made during analysis
    pendingQuestions: jsonb('pending_questions').default([]), // Unanswered questions

    // State at snapshot time
    stepsCompleted: jsonb('steps_completed').default([]),
    findingsCount: smallint('findings_count').default(0),
    tokensUsed: bigint('tokens_used', { mode: 'number' }).default(0),

    // Resumption info
    resumable: boolean('resumable').default(true),
    resumptionPrompt: text('resumption_prompt'), // Pre-generated prompt to resume conversation

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('ai_context_snapshots_session_idx').on(table.sessionId),
    conversationIdIdx: index('ai_context_snapshots_conv_idx').on(table.conversationId),
    typeIdx: index('ai_context_snapshots_type_idx').on(table.snapshotType),
  })
);

// ============================================================================
// INTERACTIVE AUDIT RELATIONS
// ============================================================================

export const auditSessionsRelations = relations(auditSessions, ({ one, many }) => ({
  job: one(auditJobs, {
    fields: [auditSessions.jobId],
    references: [auditJobs.id],
  }),
  user: one(users, {
    fields: [auditSessions.userId],
    references: [users.id],
  }),
  conversationHistory: many(aiConversationHistory),
  contextSnapshots: many(aiContextSnapshots),
  linkedProjects: many(auditLinkedProjects),
  knownAddresses: many(auditKnownAddresses),
  prompts: many(auditPrompts),
  userAnswers: many(auditUserAnswers),
  findings: many(auditFindings),
  notifications: many(notifications),
}));

export const auditLinkedProjectsRelations = relations(auditLinkedProjects, ({ one, many }) => ({
  session: one(auditSessions, {
    fields: [auditLinkedProjects.sessionId],
    references: [auditSessions.id],
  }),
  linkedJob: one(auditJobs, {
    fields: [auditLinkedProjects.linkedJobId],
    references: [auditJobs.id],
  }),
  knownAddresses: many(auditKnownAddresses),
}));

export const auditKnownAddressesRelations = relations(auditKnownAddresses, ({ one }) => ({
  session: one(auditSessions, {
    fields: [auditKnownAddresses.sessionId],
    references: [auditSessions.id],
  }),
  linkedProject: one(auditLinkedProjects, {
    fields: [auditKnownAddresses.linkedProjectId],
    references: [auditLinkedProjects.id],
  }),
}));

export const auditPromptsRelations = relations(auditPrompts, ({ one }) => ({
  session: one(auditSessions, {
    fields: [auditPrompts.sessionId],
    references: [auditSessions.id],
  }),
  answer: one(auditUserAnswers),
}));

export const auditUserAnswersRelations = relations(auditUserAnswers, ({ one }) => ({
  session: one(auditSessions, {
    fields: [auditUserAnswers.sessionId],
    references: [auditSessions.id],
  }),
  prompt: one(auditPrompts, {
    fields: [auditUserAnswers.promptId],
    references: [auditPrompts.id],
  }),
}));

export const auditFindingsRelations = relations(auditFindings, ({ one, many }) => ({
  job: one(auditJobs, {
    fields: [auditFindings.jobId],
    references: [auditJobs.id],
  }),
  session: one(auditSessions, {
    fields: [auditFindings.sessionId],
    references: [auditSessions.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  job: one(auditJobs, {
    fields: [notifications.jobId],
    references: [auditJobs.id],
  }),
  session: one(auditSessions, {
    fields: [notifications.sessionId],
    references: [auditSessions.id],
  }),
  prompt: one(auditPrompts, {
    fields: [notifications.promptId],
    references: [auditPrompts.id],
  }),
  finding: one(auditFindings, {
    fields: [notifications.findingId],
    references: [auditFindings.id],
  }),
}));

// ============================================================================
// INTERACTIVE AUDIT TYPE EXPORTS
// ============================================================================

export type AuditSession = typeof auditSessions.$inferSelect;
export type NewAuditSession = typeof auditSessions.$inferInsert;

export type AuditLinkedProject = typeof auditLinkedProjects.$inferSelect;
export type NewAuditLinkedProject = typeof auditLinkedProjects.$inferInsert;

export type AuditKnownAddress = typeof auditKnownAddresses.$inferSelect;
export type NewAuditKnownAddress = typeof auditKnownAddresses.$inferInsert;

export type AuditPrompt = typeof auditPrompts.$inferSelect;
export type NewAuditPrompt = typeof auditPrompts.$inferInsert;

export type AuditUserAnswer = typeof auditUserAnswers.$inferSelect;
export type NewAuditUserAnswer = typeof auditUserAnswers.$inferInsert;

export type AuditFinding = typeof auditFindings.$inferSelect;
export type NewAuditFinding = typeof auditFindings.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type PromptStatus = (typeof promptStatusEnum.enumValues)[number];
export type PromptType = (typeof promptTypeEnum.enumValues)[number];
export type AddressType = (typeof addressTypeEnum.enumValues)[number];
export type LinkedProjectRelationship = (typeof linkedProjectRelationshipEnum.enumValues)[number];
export type FindingStatus = (typeof findingStatusEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type AIConversationRole = (typeof aiConversationRoleEnum.enumValues)[number];

export type AIConversationHistory = typeof aiConversationHistory.$inferSelect;
export type NewAIConversationHistory = typeof aiConversationHistory.$inferInsert;

export type AIContextSnapshot = typeof aiContextSnapshots.$inferSelect;
export type NewAIContextSnapshot = typeof aiContextSnapshots.$inferInsert;

// Neurons Token Payment Types
export type TokenPaymentReservation = typeof tokenPaymentReservations.$inferSelect;
export type NewTokenPaymentReservation = typeof tokenPaymentReservations.$inferInsert;

export type TokenPaymentTransaction = typeof tokenPaymentTransactions.$inferSelect;
export type NewTokenPaymentTransaction = typeof tokenPaymentTransactions.$inferInsert;

export type UserTokenDebt = typeof userTokenDebt.$inferSelect;
export type NewUserTokenDebt = typeof userTokenDebt.$inferInsert;

export type TokenPricingConfig = typeof tokenPricingConfig.$inferSelect;
export type NewTokenPricingConfig = typeof tokenPricingConfig.$inferInsert;

export type TokenPaymentStatus = (typeof tokenPaymentStatusEnum.enumValues)[number];
export type TokenTransactionType = (typeof tokenTransactionTypeEnum.enumValues)[number];

// ============================================================================
// AI CONVERSATION RELATIONS
// ============================================================================

export const aiConversationHistoryRelations = relations(aiConversationHistory, ({ one }) => ({
  session: one(auditSessions, {
    fields: [aiConversationHistory.sessionId],
    references: [auditSessions.id],
  }),
  job: one(auditJobs, {
    fields: [aiConversationHistory.jobId],
    references: [auditJobs.id],
  }),
}));

export const aiContextSnapshotsRelations = relations(aiContextSnapshots, ({ one }) => ({
  session: one(auditSessions, {
    fields: [aiContextSnapshots.sessionId],
    references: [auditSessions.id],
  }),
}));

// ============================================================================
// NEURONS TOKEN PAYMENT SYSTEM
// ============================================================================

export const tokenPaymentStatusEnum = pgEnum('token_payment_status', [
  'pending',      // Reservation created, awaiting payment
  'reserved',     // Tokens reserved successfully
  'processing',   // Audit in progress
  'completed',    // Audit completed, final cost settled
  'in_debt',      // Actual cost exceeded reservation
  'refunded',     // Reservation cancelled, tokens refunded
  'failed',       // Payment failed
]);

export const tokenTransactionTypeEnum = pgEnum('token_transaction_type', [
  'reservation',  // Initial upfront reservation
  'debit',        // Actual usage deduction
  'refund',       // Unused tokens returned
  'debt_payment', // Debt cleared
  'adjustment',   // Manual adjustment
]);

// Token Payment Reservations - Upfront cost estimates and reservations
export const tokenPaymentReservations = pgTable(
  'token_payment_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => auditJobs.id, { onDelete: 'cascade' })
      .unique(),

    // Cost Estimation
    estimatedSloc: bigint('estimated_sloc', { mode: 'number' }).notNull(),
    estimatedAiTokens: bigint('estimated_ai_tokens', { mode: 'number' }).notNull(),
    estimatedCostNeurons: bigint('estimated_cost_neurons', { mode: 'number' }).notNull(),

    // Reservation (with buffer)
    reservationAmount: bigint('reservation_amount', { mode: 'number' }).notNull(), // estimatedCost * bufferMultiplier
    bufferMultiplier: integer('buffer_multiplier').notNull().default(150), // 150 = 1.5x buffer

    // Actual Usage (populated after audit)
    actualSloc: bigint('actual_sloc', { mode: 'number' }),
    actualAiTokens: bigint('actual_ai_tokens', { mode: 'number' }),
    actualCostNeurons: bigint('actual_cost_neurons', { mode: 'number' }),

    // Wallet & Transaction
    walletAddress: varchar('wallet_address', { length: 128 }).notNull(),
    chainId: smallint('chain_id').notNull().default(1), // 1 = Ethereum mainnet
    txHash: varchar('tx_hash', { length: 100 }),

    // Status
    status: tokenPaymentStatusEnum('status').notNull().default('pending'),

    // Debt tracking
    debtAmount: bigint('debt_amount', { mode: 'number' }).default(0), // If actualCost > reservation
    debtPaidAt: timestamp('debt_paid_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('token_reservations_user_id_idx').on(table.userId),
    jobIdIdx: uniqueIndex('token_reservations_job_id_idx').on(table.jobId),
    statusIdx: index('token_reservations_status_idx').on(table.status),
    walletIdx: index('token_reservations_wallet_idx').on(table.walletAddress),
  })
);

// Token Payment Transactions - Detailed transaction log
export const tokenPaymentTransactions = pgTable(
  'token_payment_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reservationId: uuid('reservation_id')
      .references(() => tokenPaymentReservations.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .references(() => auditJobs.id, { onDelete: 'cascade' }),

    // Transaction details
    transactionType: tokenTransactionTypeEnum('transaction_type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(), // Amount in Neurons (can be negative for refunds)
    balanceBefore: bigint('balance_before', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),

    // Context
    description: text('description').notNull(),
    metadata: jsonb('metadata'), // { sloc, aiTokens, txHash, etc }

    // Blockchain transaction
    walletAddress: varchar('wallet_address', { length: 128 }),
    txHash: varchar('tx_hash', { length: 100 }),
    chainId: smallint('chain_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('token_transactions_user_id_idx').on(table.userId),
    reservationIdIdx: index('token_transactions_reservation_id_idx').on(table.reservationId),
    jobIdIdx: index('token_transactions_job_id_idx').on(table.jobId),
    typeIdx: index('token_transactions_type_idx').on(table.transactionType),
    createdAtIdx: index('token_transactions_created_at_idx').on(table.createdAt),
  })
);

// User Debt Tracking - Aggregate debt status per user
export const userTokenDebt = pgTable(
  'user_token_debt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Debt details
    totalDebtNeurons: bigint('total_debt_neurons', { mode: 'number' }).notNull().default(0),
    unpaidAuditCount: smallint('unpaid_audit_count').notNull().default(0),

    // Block status
    isBlocked: boolean('is_blocked').notNull().default(false), // Block new audits if true
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    blockedReason: text('blocked_reason'),

    // Grace period (optional - allow 1-2 audits to go into debt before blocking)
    gracePeriodUsed: boolean('grace_period_used').notNull().default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastDebtPaymentAt: timestamp('last_debt_payment_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: uniqueIndex('user_token_debt_user_id_idx').on(table.userId),
    isBlockedIdx: index('user_token_debt_is_blocked_idx').on(table.isBlocked),
  })
);

// Neurons Token Pricing Configuration
export const tokenPricingConfig = pgTable(
  'token_pricing_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    configKey: varchar('config_key', { length: 100 }).unique().notNull(), // e.g., 'neurons_per_sloc', 'neurons_per_1k_ai_tokens'
    configValue: bigint('config_value', { mode: 'number' }).notNull(), // Numeric value
    description: text('description').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    configKeyIdx: uniqueIndex('token_pricing_config_key_idx').on(table.configKey),
  })
);


-- ============================================================================
-- Migration: Verification System
-- Creates clarification verification and FAQ tables
-- Cleans up unused tables and orphaned data
-- ============================================================================

-- Step 1: Drop unused tables
-- ============================================================================
DROP TABLE IF EXISTS "audit_trail" CASCADE;
DROP TABLE IF EXISTS "audit_cross_references" CASCADE;

-- Step 2: Clean orphaned data
-- ============================================================================

-- Delete clarifications with fake finding IDs (vuln-XX format)
DELETE FROM "audit_clarifications"
WHERE ("answer_value"->>'findingId') LIKE 'vuln-%'
   OR ("context"->>'findingId') LIKE 'vuln-%';

-- Delete orphaned audit data (no parent job)
DELETE FROM "audit_clarifications" WHERE "job_id" NOT IN (SELECT "id" FROM "audit_jobs");
DELETE FROM "audit_results" WHERE "job_id" NOT IN (SELECT "id" FROM "audit_jobs");
DELETE FROM "audit_step_progress" WHERE "job_id" NOT IN (SELECT "id" FROM "audit_jobs");
DELETE FROM "audit_sessions" WHERE "job_id" NOT IN (SELECT "id" FROM "audit_jobs");
DELETE FROM "audit_findings" WHERE "job_id" NOT IN (SELECT "id" FROM "audit_jobs");

-- Step 3: Create enums
-- ============================================================================

DO $$ BEGIN
 CREATE TYPE "clarification_faq_category" AS ENUM('false_positive', 'mitigated', 'accepted_risk', 'already_fixed', 'commit_verified', 'general');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "verification_recommendation" AS ENUM('accept', 'reject', 'manual_review');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 4: Create clarification_faqs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "clarification_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"clarification_id" uuid,
	"finding_id" varchar(500) NOT NULL,
	"finding_title" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" "clarification_faq_category" DEFAULT 'general' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_by" varchar(50) DEFAULT 'claude-verifier',
	"verification_reasoning" text,
	"confidence" varchar(20),
	"helpful" boolean DEFAULT true,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 5: Create clarification_verifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "clarification_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"clarification_id" uuid NOT NULL,
	"finding_id" varchar(500) NOT NULL,
	"finding_title" text NOT NULL,
	"finding_severity" varchar(20) NOT NULL,
	"finding_description" text NOT NULL,
	"clarification_type" varchar(50) NOT NULL,
	"user_explanation" text NOT NULL,
	"evidence_url" text,
	"resolved_in_commit" boolean DEFAULT false,
	"commit_sha" varchar(64),
	"commit_diff" text,
	"commit_message" text,
	"code_snippet" text,
	"file_context" text,
	"verified" boolean NOT NULL,
	"confidence" varchar(20) NOT NULL,
	"recommendation" "verification_recommendation" NOT NULL,
	"reasoning" text NOT NULL,
	"verified_by" varchar(50) DEFAULT 'claude-verifier',
	"verification_model" varchar(50),
	"verification_prompt_version" varchar(20),
	"manually_reviewed" boolean DEFAULT false,
	"manual_reviewer" varchar(255),
	"manual_decision" "verification_recommendation",
	"manual_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 6: Add foreign keys
-- ============================================================================

DO $$ BEGIN
 ALTER TABLE "clarification_faqs" ADD CONSTRAINT "clarification_faqs_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "clarification_faqs" ADD CONSTRAINT "clarification_faqs_clarification_id_audit_clarifications_id_fk" FOREIGN KEY ("clarification_id") REFERENCES "audit_clarifications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "clarification_verifications" ADD CONSTRAINT "clarification_verifications_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "clarification_verifications" ADD CONSTRAINT "clarification_verifications_clarification_id_audit_clarifications_id_fk" FOREIGN KEY ("clarification_id") REFERENCES "audit_clarifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 7: Add missing foreign key constraints (CASCADE DELETE)
-- ============================================================================

DO $$ BEGIN
 ALTER TABLE "audit_clarifications" ADD CONSTRAINT "audit_clarifications_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_step_progress" ADD CONSTRAINT "audit_step_progress_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "audit_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Step 8: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "clarification_faqs_job_id_idx" ON "clarification_faqs" ("job_id");
CREATE INDEX IF NOT EXISTS "clarification_faqs_category_idx" ON "clarification_faqs" ("category");
CREATE INDEX IF NOT EXISTS "clarification_faqs_verified_idx" ON "clarification_faqs" ("verified");
CREATE INDEX IF NOT EXISTS "clarification_faqs_finding_id_idx" ON "clarification_faqs" ("finding_id");

CREATE INDEX IF NOT EXISTS "clarification_verifications_job_id_idx" ON "clarification_verifications" ("job_id");
CREATE INDEX IF NOT EXISTS "clarification_verifications_clarification_id_idx" ON "clarification_verifications" ("clarification_id");
CREATE INDEX IF NOT EXISTS "clarification_verifications_verified_idx" ON "clarification_verifications" ("verified");
CREATE INDEX IF NOT EXISTS "clarification_verifications_recommendation_idx" ON "clarification_verifications" ("recommendation");
CREATE INDEX IF NOT EXISTS "clarification_verifications_confidence_idx" ON "clarification_verifications" ("confidence");

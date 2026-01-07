CREATE TYPE "public"."audit_visibility" AS ENUM('private', 'public', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."component_status" AS ENUM('pending', 'syncing', 'synced', 'error');--> statement-breakpoint
CREATE TYPE "public"."component_type" AS ENUM('github-repo', 'deployed-contract', 'dapp-url', 'library-source', 'manual-upload');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'queued', 'cloning', 'analyzing', 'auditing', 'generating', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('full', 'contract-only', 'dapp-pentest', 'library-audit');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."wallet_type" AS ENUM('ethereum', 'solana', 'cosmos', 'sui', 'aptos');--> statement-breakpoint
CREATE TYPE "public"."xp_transaction_type" AS ENUM('earn', 'spend', 'refund', 'bonus', 'adjustment');--> statement-breakpoint
CREATE TABLE "audit_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" serial NOT NULL,
	"user_id" uuid,
	"project_id" uuid,
	"component_id" uuid,
	"repo" varchar(500) NOT NULL,
	"branch" varchar(255) DEFAULT 'main' NOT NULL,
	"commit_sha" varchar(40),
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"progress_pct" smallint DEFAULT 0 NOT NULL,
	"progress_message" text,
	"visibility" "audit_visibility" DEFAULT 'private' NOT NULL,
	"xp_cost" smallint,
	"xp_refunded" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_jobs_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "audit_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"format" varchar(20) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" bigint,
	"checksum" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"score_value" smallint,
	"score_label" varchar(50),
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "component_type" NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"status" "component_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar_url" text,
	"tier" "user_tier" DEFAULT 'free' NOT NULL,
	"xp_balance" bigint DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "preaudit_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preaudit_questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preaudit_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_key" varchar(100) NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(50) NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"order_index" smallint DEFAULT 0 NOT NULL,
	"category" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preaudit_questions_question_key_unique" UNIQUE("question_key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"type" "project_type" DEFAULT 'full' NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"logo_url" text,
	"website_url" varchar(500),
	"primary_color" varchar(7),
	"contract_address" varchar(128),
	"chain_id" varchar(50),
	"docs_url" varchar(500),
	"github_url" varchar(500),
	"twitter_url" varchar(500),
	"discord_url" varchar(500),
	"report_config" jsonb DEFAULT '{}'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aggregated_score" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_audit_showcase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"featured" boolean DEFAULT false NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_audit_showcase_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(128) NOT NULL,
	"refresh_token_family" uuid NOT NULL,
	"github_token_encrypted" text,
	"github_token_iv" varchar(64),
	"auth_method" varchar(20) DEFAULT 'github' NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "user_tier" NOT NULL,
	"min_xp" bigint NOT NULL,
	"monthly_free_audits" smallint DEFAULT 0 NOT NULL,
	"audit_xp_cost_quick" smallint NOT NULL,
	"audit_xp_cost_standard" smallint NOT NULL,
	"audit_xp_cost_deep" smallint NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tier_thresholds_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" varchar(50),
	"github_login" varchar(255),
	"github_email" varchar(255),
	"github_avatar_url" text,
	"wallet_address" varchar(128),
	"wallet_type" "wallet_type",
	"wallet_nonce" varchar(64),
	"display_name" varchar(255),
	"email" varchar(255),
	"bio" text,
	"company" varchar(255),
	"website" varchar(500),
	"twitter_handle" varchar(100),
	"avatar_url" text,
	"xp_balance" bigint DEFAULT 0 NOT NULL,
	"xp_lifetime" bigint DEFAULT 0 NOT NULL,
	"tier" "user_tier" DEFAULT 'free' NOT NULL,
	"monthly_audits_used" smallint DEFAULT 0 NOT NULL,
	"monthly_audits_reset_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "xp_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_key" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"xp_amount" bigint NOT NULL,
	"max_occurrences" smallint,
	"cooldown_minutes" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xp_rules_rule_key_unique" UNIQUE("rule_key")
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "xp_transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"description" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD CONSTRAINT "audit_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD CONSTRAINT "audit_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD CONSTRAINT "audit_jobs_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_results" ADD CONSTRAINT "audit_results_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preaudit_answers" ADD CONSTRAINT "preaudit_answers_questionnaire_id_preaudit_questionnaires_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."preaudit_questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preaudit_answers" ADD CONSTRAINT "preaudit_answers_question_id_preaudit_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."preaudit_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preaudit_questionnaires" ADD CONSTRAINT "preaudit_questionnaires_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_audit_showcase" ADD CONSTRAINT "public_audit_showcase_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_jobs_user_id_idx" ON "audit_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_jobs_project_id_idx" ON "audit_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_jobs_status_idx" ON "audit_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_jobs_visibility_idx" ON "audit_jobs" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "audit_jobs_created_at_idx" ON "audit_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_reports_job_id_idx" ON "audit_reports" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_results_job_id_idx" ON "audit_results" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "audit_trail_user_id_idx" ON "audit_trail" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_trail_entity_idx" ON "audit_trail" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_trail_created_at_idx" ON "audit_trail" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "components_project_id_idx" ON "components" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "preaudit_answers_q_q_idx" ON "preaudit_answers" USING btree ("questionnaire_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preaudit_questionnaires_job_id_idx" ON "preaudit_questionnaires" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preaudit_questions_key_idx" ON "preaudit_questions" USING btree ("question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_slug_idx" ON "projects" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "public_audit_showcase_slug_idx" ON "public_audit_showcase" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "public_audit_showcase_job_id_idx" ON "public_audit_showcase" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "public_audit_showcase_featured_idx" ON "public_audit_showcase" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("refresh_token_family");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_thresholds_tier_idx" ON "tier_thresholds" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_id_idx" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_address_idx" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "users_tier_idx" ON "users" USING btree ("tier");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_rules_key_idx" ON "xp_rules" USING btree ("rule_key");--> statement-breakpoint
CREATE INDEX "xp_transactions_user_id_idx" ON "xp_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "xp_transactions_created_at_idx" ON "xp_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xp_transactions_reference_idx" ON "xp_transactions" USING btree ("reference_type","reference_id");
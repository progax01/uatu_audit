CREATE TYPE "public"."address_type" AS ENUM('eoa', 'multisig', 'timelock', 'governance', 'treasury', 'oracle', 'protocol', 'renounced', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."ai_conversation_role" AS ENUM('system', 'user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."audit_type" AS ENUM('quick', 'full');--> statement-breakpoint
CREATE TYPE "public"."clarification_phase" AS ENUM('pre_audit', 'post_audit');--> statement-breakpoint
CREATE TYPE "public"."clarification_status" AS ENUM('pending', 'answered', 'skipped', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('new', 'acknowledged', 'disputed', 'fixed', 'wont_fix', 'false_positive');--> statement-breakpoint
CREATE TYPE "public"."linked_project_relationship" AS ENUM('admin', 'governance', 'timelock', 'dependency', 'integration', 'proxy', 'implementation', 'oracle', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('audit_complete', 'input_needed', 'critical_finding', 'audit_failed', 'audit_cancelled', 'prompt_timeout');--> statement-breakpoint
CREATE TYPE "public"."prompt_status" AS ENUM('pending', 'answered', 'skipped', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."prompt_type" AS ENUM('single_choice', 'multi_choice', 'text', 'address', 'contract_link', 'confirm', 'form');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'confirming', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."purchase_tier" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('running', 'paused_for_input', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'running' BEFORE 'cloning';--> statement-breakpoint
ALTER TYPE "public"."job_status" ADD VALUE 'awaiting_clarification' BEFORE 'auditing';--> statement-breakpoint
CREATE TABLE "ai_context_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"snapshot_type" varchar(50) NOT NULL,
	"step_id" varchar(100),
	"conversation_id" varchar(255) NOT NULL,
	"context_summary" text NOT NULL,
	"key_findings" jsonb DEFAULT '[]'::jsonb,
	"key_decisions" jsonb DEFAULT '[]'::jsonb,
	"pending_questions" jsonb DEFAULT '[]'::jsonb,
	"steps_completed" jsonb DEFAULT '[]'::jsonb,
	"findings_count" smallint DEFAULT 0,
	"tokens_used" bigint DEFAULT 0,
	"resumable" boolean DEFAULT true,
	"resumption_prompt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"turn_index" smallint NOT NULL,
	"role" "ai_conversation_role" NOT NULL,
	"content" text NOT NULL,
	"content_summary" text,
	"step_id" varchar(100),
	"step_name" varchar(255),
	"tool_name" varchar(100),
	"tool_input" jsonb,
	"tool_output" jsonb,
	"input_tokens" smallint,
	"output_tokens" smallint,
	"total_tokens" smallint,
	"model_used" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_clarifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"phase" "clarification_phase" NOT NULL,
	"question_key" varchar(100) NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar(50) NOT NULL,
	"options" jsonb,
	"context" jsonb,
	"status" "clarification_status" DEFAULT 'pending' NOT NULL,
	"answer_value" jsonb,
	"score_impact" jsonb,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_cross_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_finding_id" uuid,
	"target_linked_project_id" uuid,
	"target_known_address_id" uuid,
	"relationship_type" varchar(50) NOT NULL,
	"description" text,
	"created_by" varchar(30) DEFAULT 'ai',
	"confidence" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"session_id" uuid,
	"finding_id" varchar(100) NOT NULL,
	"tool" varchar(50),
	"step_id" varchar(100),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"original_severity" varchar(20) NOT NULL,
	"adjusted_severity" varchar(20),
	"severity_adjustment_reason" text,
	"file_path" varchar(500),
	"line_start" smallint,
	"line_end" smallint,
	"function_name" varchar(255),
	"contract_name" varchar(255),
	"related_addresses" jsonb DEFAULT '[]'::jsonb,
	"similar_finding_ids" jsonb DEFAULT '[]'::jsonb,
	"linked_project_findings" jsonb DEFAULT '[]'::jsonb,
	"user_context" jsonb DEFAULT '{}'::jsonb,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp with time zone,
	"disputed" boolean DEFAULT false,
	"dispute_reason" text,
	"status" "finding_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_known_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"address" varchar(128) NOT NULL,
	"chain" varchar(30) NOT NULL,
	"label" varchar(255) NOT NULL,
	"address_type" "address_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"linked_project_id" uuid,
	"source" varchar(30) DEFAULT 'user',
	"verified" boolean DEFAULT false,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_linked_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"source_type" varchar(30) NOT NULL,
	"source_config" jsonb NOT NULL,
	"relationship" "linked_project_relationship" NOT NULL,
	"relationship_description" text,
	"relevant_contracts" jsonb,
	"linked_job_id" uuid,
	"added_by" varchar(30) DEFAULT 'user',
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"step_id" varchar(100) NOT NULL,
	"step_name" varchar(255),
	"template_id" varchar(100),
	"prompt_type" "prompt_type" NOT NULL,
	"question" text NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb,
	"context" jsonb DEFAULT '{}'::jsonb,
	"options" jsonb,
	"required" boolean DEFAULT false,
	"default_value" jsonb,
	"timeout_seconds" smallint DEFAULT 300,
	"status" "prompt_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"timed_out_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"interactive_mode" boolean DEFAULT true NOT NULL,
	"auto_continue_timeout_seconds" smallint DEFAULT 300,
	"notification_email" varchar(255),
	"notify_on_completion" boolean DEFAULT true,
	"notify_on_input_needed" boolean DEFAULT true,
	"notify_on_critical_finding" boolean DEFAULT true,
	"status" "session_status" DEFAULT 'running' NOT NULL,
	"current_prompt_id" uuid,
	"paused_at_step" varchar(100),
	"paused_at" timestamp with time zone,
	"ai_conversation_id" varchar(255),
	"ai_session_id" varchar(255),
	"ai_model_used" varchar(100),
	"ai_conversation_context" jsonb DEFAULT '{}'::jsonb,
	"ai_conversation_started_at" timestamp with time zone,
	"ai_conversation_last_used_at" timestamp with time zone,
	"ai_total_tokens_used" bigint DEFAULT 0,
	"ai_total_turns" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_sop_execution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"sop_id" varchar(100) NOT NULL,
	"sop_version" varchar(20) NOT NULL,
	"audit_depth" varchar(20) NOT NULL,
	"detected_framework" varchar(50),
	"detected_language" varchar(20),
	"total_steps" smallint NOT NULL,
	"completed_steps" smallint DEFAULT 0,
	"failed_steps" smallint DEFAULT 0,
	"skipped_steps" smallint DEFAULT 0,
	"available_tools" jsonb,
	"estimated_duration_minutes" smallint,
	"actual_duration_minutes" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_step_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"step_id" varchar(100) NOT NULL,
	"step_name" varchar(255) NOT NULL,
	"step_category" varchar(50) NOT NULL,
	"status" "step_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" bigint,
	"internal_pct" smallint DEFAULT 0,
	"internal_message" text,
	"output_summary" jsonb,
	"error_message" text,
	"retry_count" smallint DEFAULT 0,
	"order_index" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_user_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"answer" jsonb NOT NULL,
	"apply_to_similar" boolean DEFAULT true,
	"applied_to_findings" jsonb DEFAULT '[]'::jsonb,
	"severity_adjustments" jsonb DEFAULT '{}'::jsonb,
	"answered_by" varchar(30) DEFAULT 'user',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neuron_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tx_hash" varchar(100) NOT NULL,
	"chain_id" smallint NOT NULL,
	"from_address" varchar(128) NOT NULL,
	"tier" "purchase_tier" NOT NULL,
	"amount_usdt" bigint NOT NULL,
	"neurons_awarded" bigint NOT NULL,
	"sloc_awarded" bigint NOT NULL,
	"ai_calls_awarded" smallint NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "neuron_purchases_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"job_id" uuid,
	"session_id" uuid,
	"prompt_id" uuid,
	"finding_id" uuid,
	"channels" jsonb DEFAULT '["in_app"]'::jsonb NOT NULL,
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp with time zone,
	"read" boolean DEFAULT false,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_execution_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_progress_id" uuid NOT NULL,
	"tool_name" varchar(50) NOT NULL,
	"tool_version" varchar(50),
	"command" text,
	"exit_code" smallint,
	"stdout" text,
	"stderr" text,
	"findings_count" smallint,
	"execution_time_ms" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_reports" ALTER COLUMN "format" SET DEFAULT 'json';--> statement-breakpoint
ALTER TABLE "audit_reports" ALTER COLUMN "format" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_reports" ALTER COLUMN "file_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "audit_type" "audit_type" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "contract_address" varchar(128);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "contract_network" varchar(50);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "contract_name" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "is_proxy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "implementation_address" varchar(128);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "source_type" varchar(30);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "project_path" text;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "detected_framework" varchar(50);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "sop_id" varchar(100);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "sop_version" varchar(20);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "audit_depth" varchar(20);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "current_step_id" varchar(100);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "current_step_name" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "steps_completed" smallint;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "steps_total" smallint;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD COLUMN "report_data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sloc_balance" bigint DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sloc_used" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_calls_balance" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_calls_used" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_quota_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_context_snapshots" ADD CONSTRAINT "ai_context_snapshots_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversation_history" ADD CONSTRAINT "ai_conversation_history_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversation_history" ADD CONSTRAINT "ai_conversation_history_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_clarifications" ADD CONSTRAINT "audit_clarifications_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_cross_references" ADD CONSTRAINT "audit_cross_references_finding_id_audit_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."audit_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_cross_references" ADD CONSTRAINT "audit_cross_references_target_finding_id_audit_findings_id_fk" FOREIGN KEY ("target_finding_id") REFERENCES "public"."audit_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_cross_references" ADD CONSTRAINT "audit_cross_references_target_linked_project_id_audit_linked_projects_id_fk" FOREIGN KEY ("target_linked_project_id") REFERENCES "public"."audit_linked_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_cross_references" ADD CONSTRAINT "audit_cross_references_target_known_address_id_audit_known_addresses_id_fk" FOREIGN KEY ("target_known_address_id") REFERENCES "public"."audit_known_addresses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_known_addresses" ADD CONSTRAINT "audit_known_addresses_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_known_addresses" ADD CONSTRAINT "audit_known_addresses_linked_project_id_audit_linked_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "public"."audit_linked_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_linked_projects" ADD CONSTRAINT "audit_linked_projects_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_linked_projects" ADD CONSTRAINT "audit_linked_projects_linked_job_id_audit_jobs_id_fk" FOREIGN KEY ("linked_job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_prompts" ADD CONSTRAINT "audit_prompts_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sessions" ADD CONSTRAINT "audit_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_sop_execution" ADD CONSTRAINT "audit_sop_execution_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_step_progress" ADD CONSTRAINT "audit_step_progress_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_user_answers" ADD CONSTRAINT "audit_user_answers_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_user_answers" ADD CONSTRAINT "audit_user_answers_prompt_id_audit_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."audit_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "neuron_purchases" ADD CONSTRAINT "neuron_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_session_id_audit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."audit_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_prompt_id_audit_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."audit_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_finding_id_audit_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."audit_findings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_execution_logs" ADD CONSTRAINT "tool_execution_logs_step_progress_id_audit_step_progress_id_fk" FOREIGN KEY ("step_progress_id") REFERENCES "public"."audit_step_progress"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_context_snapshots_session_idx" ON "ai_context_snapshots" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_context_snapshots_conv_idx" ON "ai_context_snapshots" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_context_snapshots_type_idx" ON "ai_context_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "ai_conversation_history_session_idx" ON "ai_conversation_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_conversation_history_job_idx" ON "ai_conversation_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ai_conversation_history_conv_idx" ON "ai_conversation_history" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_conversation_history_step_idx" ON "ai_conversation_history" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "ai_conversation_history_turn_idx" ON "ai_conversation_history" USING btree ("conversation_id","turn_index");--> statement-breakpoint
CREATE INDEX "audit_clarifications_job_id_idx" ON "audit_clarifications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "audit_clarifications_phase_idx" ON "audit_clarifications" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "audit_clarifications_status_idx" ON "audit_clarifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_clarifications_job_phase_idx" ON "audit_clarifications" USING btree ("job_id","phase");--> statement-breakpoint
CREATE INDEX "audit_cross_references_finding_id_idx" ON "audit_cross_references" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "audit_cross_references_target_type_idx" ON "audit_cross_references" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "audit_findings_job_id_idx" ON "audit_findings" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_findings_job_finding_idx" ON "audit_findings" USING btree ("job_id","finding_id");--> statement-breakpoint
CREATE INDEX "audit_findings_severity_idx" ON "audit_findings" USING btree ("adjusted_severity");--> statement-breakpoint
CREATE INDEX "audit_findings_status_idx" ON "audit_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_findings_tool_idx" ON "audit_findings" USING btree ("tool");--> statement-breakpoint
CREATE INDEX "audit_known_addresses_session_id_idx" ON "audit_known_addresses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_known_addresses_address_idx" ON "audit_known_addresses" USING btree ("address");--> statement-breakpoint
CREATE INDEX "audit_known_addresses_type_idx" ON "audit_known_addresses" USING btree ("address_type");--> statement-breakpoint
CREATE INDEX "audit_linked_projects_session_id_idx" ON "audit_linked_projects" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_linked_projects_relationship_idx" ON "audit_linked_projects" USING btree ("relationship");--> statement-breakpoint
CREATE INDEX "audit_prompts_session_id_idx" ON "audit_prompts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "audit_prompts_status_idx" ON "audit_prompts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_prompts_step_id_idx" ON "audit_prompts" USING btree ("step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_sessions_job_id_idx" ON "audit_sessions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "audit_sessions_user_id_idx" ON "audit_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_sessions_status_idx" ON "audit_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_sessions_ai_conversation_idx" ON "audit_sessions" USING btree ("ai_conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_sop_execution_job_id_idx" ON "audit_sop_execution" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "audit_sop_execution_sop_id_idx" ON "audit_sop_execution" USING btree ("sop_id");--> statement-breakpoint
CREATE INDEX "audit_step_progress_job_id_idx" ON "audit_step_progress" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_step_progress_job_step_idx" ON "audit_step_progress" USING btree ("job_id","step_id");--> statement-breakpoint
CREATE INDEX "audit_step_progress_status_idx" ON "audit_step_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_user_answers_session_id_idx" ON "audit_user_answers" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_user_answers_prompt_id_idx" ON "audit_user_answers" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "neuron_purchases_user_id_idx" ON "neuron_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "neuron_purchases_tx_hash_idx" ON "neuron_purchases" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "neuron_purchases_status_idx" ON "neuron_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "neuron_purchases_created_at_idx" ON "neuron_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_job_id_idx" ON "notifications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "tool_execution_logs_step_id_idx" ON "tool_execution_logs" USING btree ("step_progress_id");--> statement-breakpoint
CREATE INDEX "tool_execution_logs_tool_name_idx" ON "tool_execution_logs" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "audit_jobs_audit_type_idx" ON "audit_jobs" USING btree ("audit_type");--> statement-breakpoint
CREATE INDEX "audit_jobs_contract_address_idx" ON "audit_jobs" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "audit_jobs_public_ledger_idx" ON "audit_jobs" USING btree ("visibility","status","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
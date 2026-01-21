CREATE TYPE "public"."contract_category" AS ENUM('erc20-token', 'erc721-nft', 'erc1155-multi', 'defi-amm', 'defi-lending', 'defi-staking', 'governance', 'bridge', 'proxy-upgradeable', 'multisig-wallet', 'generic');--> statement-breakpoint
CREATE TABLE "badge_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"selected_audit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "badge_settings_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "contract_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"category" "contract_category" NOT NULL,
	"sub_category" varchar(100),
	"interfaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" smallint,
	"detection_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_classifications_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "user_account_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_user_id" uuid NOT NULL,
	"linked_user_id" uuid NOT NULL,
	"link_type" varchar(20) NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_account_link" UNIQUE("primary_user_id","linked_user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_clarifications" ADD COLUMN "claude_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_clarifications" ADD COLUMN "claude_conversation_id" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_clarifications" ADD COLUMN "resumption_prompt" text;--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "deployer_address" varchar(128);--> statement-breakpoint
ALTER TABLE "audit_jobs" ADD COLUMN "creation_tx_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "badge_settings" ADD CONSTRAINT "badge_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_settings" ADD CONSTRAINT "badge_settings_selected_audit_id_audit_jobs_id_fk" FOREIGN KEY ("selected_audit_id") REFERENCES "public"."audit_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_classifications" ADD CONSTRAINT "contract_classifications_job_id_audit_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."audit_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_links" ADD CONSTRAINT "user_account_links_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_account_links" ADD CONSTRAINT "user_account_links_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "badge_settings_project_id_idx" ON "badge_settings" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_classifications_job_id_idx" ON "contract_classifications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "contract_classifications_category_idx" ON "contract_classifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "contract_classifications_confidence_idx" ON "contract_classifications" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "user_account_links_primary_idx" ON "user_account_links" USING btree ("primary_user_id");--> statement-breakpoint
CREATE INDEX "user_account_links_linked_idx" ON "user_account_links" USING btree ("linked_user_id");
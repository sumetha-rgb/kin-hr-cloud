ALTER TABLE "company_settings" ADD COLUMN "demo_login" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "self_profile_edit" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "announcement" text;
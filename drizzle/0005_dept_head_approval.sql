ALTER TABLE "departments" ADD COLUMN "head_employee_id" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "head_approved_by" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "head_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "head_note" text;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_employee_id_employees_id_fk" FOREIGN KEY ("head_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_head_approved_by_users_id_fk" FOREIGN KEY ("head_approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
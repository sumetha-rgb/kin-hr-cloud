CREATE TYPE "public"."certificate_kind" AS ENUM('employment', 'salary');--> statement-breakpoint
CREATE TYPE "public"."swap_status" AS ENUM('pending_partner', 'pending_head', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "certificate_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" "certificate_kind" NOT NULL,
	"purpose" text NOT NULL,
	"copies" integer DEFAULT 1 NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"doc_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"name" text NOT NULL,
	"license_no" text,
	"issued_at" date,
	"expires_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"shift_id" integer,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_swaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"requester_date" date NOT NULL,
	"partner_date" date NOT NULL,
	"reason" text,
	"status" "swap_status" DEFAULT 'pending_partner' NOT NULL,
	"partner_at" timestamp with time zone,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "daily_job_date" date;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "pay_day" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sso_employer_no" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sso_branch_no" text DEFAULT '000000';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "acting_approver_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "acting_until" date;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_licenses" ADD CONSTRAINT "employee_licenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_requester_id_employees_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_partner_id_employees_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swaps" ADD CONSTRAINT "shift_swaps_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cert_employee_idx" ON "certificate_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "licenses_employee_idx" ON "employee_licenses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "licenses_expires_idx" ON "employee_licenses" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_assign_uq" ON "shift_assignments" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "shift_assign_date_idx" ON "shift_assignments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "swap_requester_idx" ON "shift_swaps" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "swap_partner_idx" ON "shift_swaps" USING btree ("partner_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_acting_approver_id_employees_id_fk" FOREIGN KEY ("acting_approver_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
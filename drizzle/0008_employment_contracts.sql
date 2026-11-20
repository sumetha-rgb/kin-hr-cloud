CREATE TABLE "contract_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"doc_code" text,
	"probation_days" integer DEFAULT 119 NOT NULL,
	"work_terms" text DEFAULT '' NOT NULL,
	"holiday_terms" text DEFAULT '' NOT NULL,
	"pay_labels" text DEFAULT 'ค่าฐานเงินเดือน' NOT NULL,
	"pay_unit" text DEFAULT 'ต่อเดือน' NOT NULL,
	"conditions" text DEFAULT '' NOT NULL,
	"extra_clause_title" text,
	"extra_clause" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employment_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"template_id" integer,
	"contract_date" date NOT NULL,
	"kind" text DEFAULT 'permanent' NOT NULL,
	"probation_days" integer DEFAULT 119 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"position" text,
	"department" text,
	"probation_pay" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regular_pay" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"probation_conditions" text,
	"regular_conditions" text,
	"terms" jsonb NOT NULL,
	"party" jsonb NOT NULL,
	"signers" jsonb NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "employer_rep_name" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "employer_rep_title" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "hr_head_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_no" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_moo" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_village" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_soi" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_road" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_subdistrict" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_district" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_province" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "addr_zip" text;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contracts_employee_idx" ON "employment_contracts" USING btree ("employee_id");
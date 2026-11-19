CREATE TYPE "public"."employee_status" AS ENUM('probation', 'active', 'resigned');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('monthly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."punch_method" AS ENUM('biometric', 'manual', 'correction');--> statement-breakpoint
CREATE TYPE "public"."punch_type" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('leave', 'ot', 'time_correction');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'hr', 'manager', 'employee');--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type" "punch_type" NOT NULL,
	"punched_at" timestamp with time zone NOT NULL,
	"method" "punch_method" DEFAULT 'biometric' NOT NULL,
	"branch_id" integer,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" double precision,
	"distance_m" double precision,
	"credential_id" text,
	"user_agent" text,
	"ip" text,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"radius_m" integer DEFAULT 150 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'บริษัทของฉัน' NOT NULL,
	"tax_id" text,
	"address" text,
	"sso_rate" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"sso_min_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sso_max_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deduct_late" boolean DEFAULT true NOT NULL,
	"max_gps_accuracy_m" integer DEFAULT 150 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"prefix" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"nickname" text,
	"national_id" text,
	"phone" text,
	"email" text,
	"birth_date" date,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "employee_status" DEFAULT 'probation' NOT NULL,
	"branch_id" integer,
	"department_id" integer,
	"position_id" integer,
	"shift_id" integer,
	"manager_id" integer,
	"pay_type" "pay_type" DEFAULT 'monthly' NOT NULL,
	"base_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"monthly_allowance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"extra_tax_allowance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sso_enabled" boolean DEFAULT true NOT NULL,
	"bank_name" text,
	"bank_account" text,
	"allow_remote_checkin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"paid" boolean DEFAULT true NOT NULL,
	"days_per_year" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payroll_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_type" "pay_type" NOT NULL,
	"base_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"worked_days" integer DEFAULT 0 NOT NULL,
	"paid_leave_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"unpaid_leave_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"absent_days" integer DEFAULT 0 NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"ot_hours" numeric(6, 2) DEFAULT '0' NOT NULL,
	"earned_salary" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ot_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"allowance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_income" numeric(12, 2) DEFAULT '0' NOT NULL,
	"late_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sso" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_deduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" "payroll_status" DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"calculated_at" timestamp with time zone,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"department_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "request_type" NOT NULL,
	"employee_id" integer NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"leave_type_id" integer,
	"start_date" date,
	"end_date" date,
	"days" numeric(5, 1),
	"ot_date" date,
	"ot_hours" numeric(5, 2),
	"ot_rate" numeric(3, 1),
	"correction_at" timestamp with time zone,
	"correction_type" "punch_type",
	"reason" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"late_grace_minutes" integer DEFAULT 0 NOT NULL,
	"work_days" text DEFAULT '1,2,3,4,5' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"employee_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_emp_time_idx" ON "attendance_logs" USING btree ("employee_id","punched_at");--> statement-breakpoint
CREATE INDEX "employees_branch_idx" ON "employees" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "employees_manager_idx" ON "employees" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_item_uq" ON "payroll_items" USING btree ("run_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_period_uq" ON "payroll_runs" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "requests_emp_idx" ON "requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webauthn_user_idx" ON "webauthn_credentials" USING btree ("user_id");
CREATE TABLE "employee_photos" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"mime" text DEFAULT 'image/jpeg' NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "line_id" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "employee_photos" ADD CONSTRAINT "employee_photos_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
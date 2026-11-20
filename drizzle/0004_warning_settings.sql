CREATE TABLE "warning_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "warning_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "warning_level_settings" (
	"level" "warning_level" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"doc_title" text NOT NULL,
	"description" text,
	"validity_months" integer DEFAULT 12 NOT NULL,
	"closing_text" text,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warnings" ADD COLUMN "valid_until" date;
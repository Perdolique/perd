ALTER TABLE "checklistItems" ALTER COLUMN "id" SET DEFAULT gen_ulid();--> statement-breakpoint
ALTER TABLE "checklists" ALTER COLUMN "id" SET DEFAULT gen_ulid();--> statement-breakpoint
ALTER TABLE "equipment" ALTER COLUMN "id" SET DEFAULT gen_ulid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_ulid();
ALTER TABLE "user_equipment" ADD COLUMN "customName" varchar(128);--> statement-breakpoint
ALTER TABLE "user_equipment" ALTER COLUMN "itemId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_source_check" CHECK (("itemId" IS NOT NULL) <> ("customName" IS NOT NULL));
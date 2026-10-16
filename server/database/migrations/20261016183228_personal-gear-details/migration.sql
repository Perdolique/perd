ALTER TABLE "user_equipment" ADD COLUMN "personalName" varchar(128);--> statement-breakpoint
ALTER TABLE "user_equipment" ADD COLUMN "note" varchar(2000);--> statement-breakpoint
ALTER TABLE "user_equipment" ADD COLUMN "measuredWeightGrams" numeric;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD COLUMN "ownedQuantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_personal_name_check" CHECK ("personalName" IS NULL OR "itemId" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_weight_check" CHECK ("measuredWeightGrams" IS NULL OR ("measuredWeightGrams" >= 0 AND "measuredWeightGrams" < 'Infinity'::numeric));--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_quantity_check" CHECK ("ownedQuantity" >= 1);
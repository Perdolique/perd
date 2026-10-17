ALTER TABLE "packing_list_entries" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD COLUMN "customWeightGrams" numeric;--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD CONSTRAINT "packing_list_entries_quantity_check" CHECK ("quantity" >= 1);--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD CONSTRAINT "packing_list_entries_weight_check" CHECK ("customWeightGrams" IS NULL OR ("customWeightGrams" >= 0 AND "customWeightGrams" < 'Infinity'::numeric));--> statement-breakpoint
ALTER TABLE "packing_list_entries" ADD CONSTRAINT "packing_list_entries_custom_weight_source_check" CHECK ("userEquipmentId" IS NULL OR "customWeightGrams" IS NULL);
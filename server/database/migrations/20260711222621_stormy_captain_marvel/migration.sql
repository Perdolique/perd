ALTER TABLE "category_properties" ADD COLUMN "displayOrder" integer;--> statement-breakpoint
WITH ordered_properties AS (
	SELECT
		"id",
		(row_number() OVER (PARTITION BY "categoryId" ORDER BY "id") - 1)::integer AS "displayOrder"
	FROM "category_properties"
)
UPDATE "category_properties" AS property
SET "displayOrder" = ordered_properties."displayOrder"
FROM ordered_properties
WHERE property."id" = ordered_properties."id";--> statement-breakpoint
ALTER TABLE "category_properties" ALTER COLUMN "displayOrder" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "category_properties" ADD CONSTRAINT "category_properties_categoryId_displayOrder_unique" UNIQUE("categoryId","displayOrder");--> statement-breakpoint
CREATE INDEX "equipment_items_approved_category_brand_index" ON "equipment_items" ("categoryId","brandId") WHERE "status" = 'approved';--> statement-breakpoint
CREATE INDEX "item_property_values_property_number_index" ON "item_property_values" ("propertyId","valueNumber","itemId");--> statement-breakpoint
CREATE INDEX "item_property_values_property_text_index" ON "item_property_values" ("propertyId","valueText","itemId");--> statement-breakpoint
CREATE INDEX "item_property_values_property_boolean_index" ON "item_property_values" ("propertyId","valueBoolean","itemId");

ALTER TABLE "category_properties" ADD COLUMN "allowsNegativeValues" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "category_properties" AS property
SET "allowsNegativeValues" = true
FROM "equipment_categories" AS category
WHERE property."categoryId" = category.id
  AND category.slug = 'sleeping-bags'
  AND property.slug = 'temperature-rating'
  AND property."dataType" = 'number';
